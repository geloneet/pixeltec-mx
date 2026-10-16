import { createHash } from 'node:crypto';

export class ChannelDenied extends Error {
  constructor(code) { super(code); this.code = code; }
}
const deny = code => { throw new ChannelDenied(code); };
const ref = (tenant, phone) => createHash('sha256').update(JSON.stringify([tenant, phone])).digest('hex');
const pick = (row, fields) => Object.fromEntries(fields.map(k => [k, row[k] ?? null]));
const text = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
const modes = new Set(['BOT', 'HUMAN', 'PAUSED']);
const page = args => {
  const {offset = 0, limit = 25} = args;
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) deny('INVALID_PAGE');
  return {offset, limit};
};

/** Candidate only. Host supplies canonical services INSIDE authenticated CRM.
 * authorize revalidates OAuth/grant + owner + tenant binding on EVERY call.
 * No cookies, fetch, credentials, listeners, env flags or grants are created.
 * No method sends, marks read, changes mode, or delivers notifications.
 */
export function createChannelCandidate({authorize, commercialSnapshot, emailMessages, pixelbotRead, clock = () => new Date().toISOString()}) {
  async function context(principal, scope) {
    const c = await authorize(principal, scope);
    if (!c || !text(c.userId, 200) || !text(c.ownerId, 200) || (scope!=='channels:email:read' && !text(c.tenantId, 200))) deny('ACCESS_DENIED');
    return c;
  }
  async function wa(c) {
    // Host adapter must use canonical fetchPixelbot GET with egress guard.
    let r;
    try { r = await pixelbotRead(c, '/internal/conversations'); }
    catch { deny('SOURCE_UNAVAILABLE'); }
    if (!r || !Array.isArray(r.conversations) || r.conversations.some(x => !text(x.id, 64))) deny('SOURCE_INVALID');
    return r.conversations;
  }
  async function selected(c, id) {
    if (!text(id, 64)) deny('INVALID_CONVERSATION');
    const row = (await wa(c)).find(x => ref(c.tenantId, x.id) === id);
    if (!row) deny('CONVERSATION_NOT_FOUND');
    return row;
  }
  const stamp = (source, data) => ({source, observedAt: clock(), data, contentIsUntrusted: true});
  return {
    async listEmail(p, args = {}) {
      const c = await context(p, 'channels:email:read');
      const {offset, limit} = page(args);
      const s = await commercialSnapshot(c);
      if (s?.user?.id !== c.ownerId || !Array.isArray(s.conversations)) deny('OWNER_MISMATCH');
      const rows = s.conversations.filter(x => x.ownerId === c.ownerId && x.channel === 'email')
        .sort((a,b) => String(a.id).localeCompare(String(b.id)));
      return stamp('crm', {items: rows.slice(offset, offset+limit).map(x => pick(x, ['id','subject','mode','state','lastInboundAt','updatedAt'])),
        nextOffset: offset+limit < rows.length ? offset+limit : null, boundedSnapshot: true});
    },
    async getEmailMessages(p, {conversationId}) {
      const c = await context(p, 'channels:email:read');
      const s = await commercialSnapshot(c);
      if (s?.user?.id !== c.ownerId || !s.conversations?.some(x => x.id === conversationId && x.ownerId === c.ownerId && x.channel === 'email')) deny('CONVERSATION_NOT_FOUND');
      // Must be canonical owner-filtered DB read; NOT synchronizeCommercialEmail.
      const rows = await emailMessages(c, conversationId, 100);
      if (!Array.isArray(rows) || rows.length > 100 || rows.some(x => x.conversationId !== conversationId)) deny('SOURCE_INVALID');
      return stamp('crm', {items: rows.map(x => pick(x, ['id','direction','body','delivery','createdAt'])), boundedSnapshot: true});
    },
    async listWhatsApp(p, args = {}) {
      const c = await context(p, 'channels:whatsapp:read');
      const {offset, limit} = page(args);
      const rows = (await wa(c)).sort((a,b) => a.id.localeCompare(b.id));
      return stamp('pixelbot', {items: rows.slice(offset,offset+limit).map(x => ({conversationId:ref(c.tenantId,x.id),
        phoneSuffix:x.id.slice(-4), mode:modes.has(x.mode) ? x.mode : 'UNKNOWN', pausedUntil:x.pausedUntil ?? null,
        lastMessageAt:x.lastMessageAt ?? null})), nextOffset:offset+limit < rows.length ? offset+limit : null, boundedSnapshot:true});
    },
    async getWhatsAppMessages(p, {conversationId}) {
      const c = await context(p, 'channels:whatsapp:read');
      const row = await selected(c, conversationId);
      let r;
      try { r = await pixelbotRead(c, `/internal/conversations/${encodeURIComponent(row.id)}/messages`, {limit:100}); }
      catch { deny('SOURCE_UNAVAILABLE'); }
      if (!r || !Array.isArray(r.messages) || r.messages.length > 100) deny('SOURCE_INVALID');
      return stamp('pixelbot', {items:r.messages.map(x => pick(x,['id','direction','type','text','caption','deliveryStatus','metaTimestamp','createdAt'])), boundedSnapshot:true});
    },
    async prepareWhatsApp(p, {conversationId, action, body, expectedMode}) {
      const c = await context(p, 'channels:whatsapp:prepare');
      const row = await selected(c, conversationId);
      if (!['reply','take_control','resume'].includes(action) || !modes.has(expectedMode)) deny('INVALID_COMMAND');
      if (row.mode !== expectedMode) deny('STALE_MODE');
      if (action === 'reply' && !text(body,4096)) deny('INVALID_TEXT');
      // Deliberately ephemeral. Re-read + bind exact intent in trusted host broker
      // before ANY future commit. This returned object is not authorization.
      return stamp('pixelbot', {conversationId, action, expectedMode, ...(action === 'reply' ? {body} : {}),
        targetMode: action === 'take_control' ? 'HUMAN' : action === 'resume' ? 'BOT' : null,
        executable:false, blockers: action === 'reply' ? ['HUMAN_FENCE','DURABLE_SEND_IDEMPOTENCY','EXACT_SEND_AUTHORIZATION'] : ['ATOMIC_MODE_REVISION','INFLIGHT_AI_FENCE','EXACT_CONTROL_AUTHORIZATION']});
    },
    async commitWhatsApp() { deny('CONTROL_NOT_MOUNTED'); },
    async notifications() { deny('NOTIFICATION_SOURCE_AND_CHAT_DELIVERY_NOT_MOUNTED'); },
  };
}
