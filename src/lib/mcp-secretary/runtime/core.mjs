import { randomUUID, createHash } from 'node:crypto';

export class Denied extends Error { constructor(code) { super(code); this.code = code; } }
const deny = code => { throw new Denied(code); };
const fields = {
  contacts: ['id','name','status','nextAction'],
  opportunities: ['id','clientId','stage','need','nextAction','nextActionDue','revision'],
  projects: ['id','clientId','name','stage','nextStep','due','revision'],
  quotes: ['id','clientId','folio','title','status'],
  bills: ['id','clientId','concept','amount','currency','status','dueDate'],
};
export const entities = Object.keys(fields);
function strict(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !keys.includes(k))) deny('INVALID_INPUT');
}
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Inject the existing PostgreSQL pool through PgStore. No automatic migration.
export class Ledger {
 constructor(store){if(!store?.atomic)throw new Error('POSTGRES_STORE_REQUIRED');this.store=store;}
 async audit(owner,action,ref,status){await this.store.audit(owner,action,ref,status);}
 close(){} // The host owns the shared pool.
}

export class Secretary {
  constructor({ ledger, authority, snapshot, execute, approval, clock = Date.now, allowedEntities=entities }) {
    Object.assign(this, { ledger, authority, snapshot, execute, approval, clock, allowedEntities });
  }
  async principal(identity, scope) {
    // identity comes exclusively from verified host auth, never tool arguments.
    const p = await this.authority(identity);
    if (!p || !p.userId || !['admin','staff'].includes(p.role) || !p.scopes?.includes(scope)) deny('ACCESS_DENIED');
    return p;
  }
  async read(p) {
    const s = await this.snapshot(p);
    if (s.user?.id !== p.userId) deny('OWNER_MISMATCH');
    return s;
  }
  async list(identity, input) {
    strict(input, ['entity','offset','limit']);
    if (!entities.includes(input.entity)||!this.allowedEntities.includes(input.entity)) deny('UNSUPPORTED_ENTITY');
    const { offset=0, limit=25 } = input;
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) deny('INVALID_INPUT');
    const p = await this.principal(identity, 'crm:read');
    try {
      const s = await this.read(p);
      if (!Array.isArray(s[input.entity])) deny('SOURCE_UNAVAILABLE');
      const rows = s[input.entity].slice(offset,offset+limit).map(row => Object.fromEntries(fields[input.entity].filter(k => k in row).map(k => [k,row[k]])));
      // Never forward arbitrary snapshot extras, auth metadata or global leads.
      await this.ledger.audit(p.userId,'list',input.entity,'ok');
      return { source:'Pixeltec.mx', observedAt:s.now, entity:input.entity, rows, coverage:s.coverage ?? {fullExport:false,source:'provided snapshot'}, nextOffset: offset+limit < s[input.entity].length ? offset+limit : null };
    } catch (e) { await this.ledger.audit(p.userId,'list',input.entity,'failed'); throw e; }
  }
  async prepare(identity, input) {
    strict(input,['id','revision','nextAction','nextActionDue']);
    if (typeof input.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.id) || !Number.isInteger(input.revision) || input.revision < 0 || typeof input.nextAction !== 'string' || !input.nextAction.trim() || input.nextAction.length > 500) deny('INVALID_INPUT');
    if (input.nextActionDue !== null && (typeof input.nextActionDue !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.nextActionDue) || !Number.isFinite(Date.parse(input.nextActionDue)) || new Date(input.nextActionDue).toISOString().slice(0,10) !== input.nextActionDue)) deny('INVALID_INPUT');
    const p = await this.principal(identity,'crm:prepare');
    const s = await this.read(p);
    const row = s.opportunities?.find(r => r.id === input.id);
    if (!row) deny('NOT_FOUND');
    if (row.revision !== input.revision) deny('STALE_REVISION');
    const body = { id:input.id, revision:input.revision, nextAction:input.nextAction.trim(), nextActionDue:input.nextActionDue };
    const id=randomUUID(), hash=digest(body), expires=this.clock()+600000;
    (await this.ledger.store.run('INSERT INTO mcp_secretary.intents(id,owner,body,hash,expires,state,result) VALUES($1,$2,$3,$4,$5,$6,NULL)',id,p.userId,JSON.stringify(body),hash,expires,'prepared'));
    await this.ledger.audit(p.userId,'prepare',id,'ok');
    return { intentId:id, digest:hash, expiresAt:new Date(expires).toISOString(), action:'opportunity', data:body, requiresHumanConfirmation:true };
  }
  async resume(identity) {
    const p=await this.principal(identity,'crm:read');
    const rows=(await this.ledger.store.all('SELECT id,hash,expires,state FROM mcp_secretary.intents WHERE owner=$1 ORDER BY seq DESC LIMIT 25',p.userId));
    await this.ledger.audit(p.userId,'resume',null,'ok');
    return { intents:rows, note:'Releer CRM antes de actuar. Estado dispatching/uncertain requiere conciliación humana, nunca reenvío automático.' };
  }
  async commit(identity,input) {
    strict(input,['intentId']);
    if (typeof input.intentId !== 'string') deny('INVALID_INPUT');
    const p=await this.principal(identity,'crm:write:followup');
    const row=(await this.ledger.store.one('SELECT * FROM mcp_secretary.intents WHERE id=$1 AND owner=$2',input.intentId,p.userId));
    if (!row) deny('NOT_FOUND');
    if (row.state === 'done') return JSON.parse(row.result);
    if (row.state !== 'prepared') deny('RECONCILIATION_REQUIRED');
    if (row.expires <= this.clock()) deny('INTENT_EXPIRED');
    if (!this.execute || !this.approval) deny('WRITE_NOT_CONFIGURED');
    // Trusted approval broker verifies human actor, owner, exact digest and TTL.
    // A tool-supplied boolean or model assertion cannot constitute approval.
    if (!await this.approval({principal:p,intentId:row.id,digest:row.hash})) deny('CONFIRMATION_REQUIRED');
    const data=JSON.parse(row.body), s=await this.read(p);
    const current=s.opportunities?.find(r=>r.id===data.id);
    if (!current) deny('NOT_FOUND');
    if (current.revision!==data.revision) deny('STALE_REVISION');
    // Atomic compare-and-set serializes independent processes/repeated calls.
    await this.ledger.store.atomic(async tx=>{
      const changed=await tx.run("UPDATE mcp_secretary.intents SET state='dispatching' WHERE id=$1 AND owner=$2 AND state='prepared' RETURNING id",row.id,p.userId);
      if(changed.changes!==1)deny('RECONCILIATION_REQUIRED');
      await tx.audit(p.userId,'commit',row.id,'dispatching');
    });
    try {
      const result=await this.execute(p,{action:'opportunity',data,idempotencyKey:row.id});
      // Store only a validated receipt, never arbitrary upstream response data.
      if (result?.id!==data.id || result?.revision!==data.revision+1) deny('INVALID_RECEIPT');
      const receipt={id:result.id,revision:result.revision,intentId:row.id};
      await this.ledger.store.atomic(async tx=>{
        await tx.run("UPDATE mcp_secretary.intents SET state='done',result=$1 WHERE id=$2",JSON.stringify(receipt),row.id);
        await tx.audit(p.userId,'commit',row.id,'done');
      });
      return receipt;
    } catch(e) {
      (await this.ledger.store.run("UPDATE mcp_secretary.intents SET state='uncertain' WHERE id=$1",row.id));
      await this.ledger.audit(p.userId,'commit',row.id,'uncertain');
      deny('RECONCILIATION_REQUIRED');
    }
  }
}
