/** Fixed aggregate queries only. No identifiers, names, content, URLs, money,
 * hashes, secrets, arbitrary SQL or caller-selected owner cross this boundary. */
const queries={
 clients:'select count(*) n from clients where owner_id=$1',
 projects:'select count(*) n from projects p join clients c on c.id=p.client_id where c.owner_id=$1',
 quotes:'select count(*) n from quotes q join clients c on c.id=q.client_id where c.owner_id=$1',
 quoteVersions:'select count(*) n from quote_versions v join quotes q on q.id=v.quote_id join clients c on c.id=q.client_id where c.owner_id=$1',
 quoteDecisions:'select count(*) n from quote_decisions v join quotes q on q.id=v.quote_id join clients c on c.id=q.client_id where c.owner_id=$1',
 opportunities:'select count(*) n from commercial_opportunities where owner_id=$1',
 identifiers:'select count(*) n from commercial_identifiers where owner_id=$1',
 conversations:'select count(*) n from commercial_conversations where owner_id=$1',
 messages:'select count(*) n from commercial_messages m join commercial_conversations c on c.id=m.conversation_id where c.owner_id=$1',
 outbox:'select count(*) n from commercial_outbox where owner_id=$1',
 reminders:'select count(*) n from commercial_reminders where owner_id=$1',
 activity:'select count(*) n from client_activity where owner_id=$1',
 billingItems:'select count(*) n from billing_items where owner_id=$1',
 payments:'select count(*) n from payment_records p join billing_items b on b.id=p.billing_item_id where b.owner_id=$1',
 invoices:'select count(*) n from invoices where owner_id=$1',
 invoiceItems:'select count(*) n from invoice_items i join invoices f on f.id=i.invoice_id where f.owner_id=$1',
 contracts:'select count(*) n from contracts where owner_id=$1',
 proposals:'select count(*) n from proposals where owner_id=$1',
 tasks:'select count(*) n from tasks t join projects p on p.id=t.project_id join clients c on c.id=p.client_id where c.owner_id=$1',
 projectKeys:'select count(*) n from project_keys t join projects p on p.id=t.project_id join clients c on c.id=p.client_id where c.owner_id=$1',
 projectLogEntries:'select count(*) n from project_log_entries t join projects p on p.id=t.project_id join clients c on c.id=p.client_id where c.owner_id=$1',
 documentEntries:`select count(*) n from clients c cross join lateral jsonb_array_elements(case when jsonb_typeof(c.documents)='array' then c.documents else '[]'::jsonb end) d where c.owner_id=$1`,
 documentReferences:`select count(*) n from clients c cross join lateral jsonb_array_elements(case when jsonb_typeof(c.documents)='array' then c.documents else '[]'::jsonb end) d where c.owner_id=$1 and jsonb_typeof(d->'url')='string' and length(d->>'url')>0`,
 malformedDocumentContainers:`select count(*) n from clients where owner_id=$1 and jsonb_typeof(documents) is distinct from 'array'`,
};
export async function readCommercialInventory(sql,ownerId) {
 if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(ownerId??'')) throw new Error('CANONICAL_OWNER_REQUIRED');
 return sql.begin('isolation level repeatable read read only',async tx=>{
  const counts={};
  for(const [key,query] of Object.entries(queries)) {
   const [row]=await tx.unsafe(query,[ownerId]);counts[key]=String(row.n);
  }
  const [stamp]=await tx.unsafe('select transaction_timestamp() snapshot_at');
  return {version:1,snapshotAt:new Date(stamp.snapshot_at).toISOString(),counts,countEncoding:'decimal-string',
   coverage:{postgres:'one repeatable-read read-only snapshot, owner-filtered fixed queries; counts have no presentation limits',
    documents:'clients.documents entries and URL-reference counts only; other JSON/file stores are not inventoried',
    whatsappSource:{complete:false,count:null,reason:'PixelBot SQLite is separate; no total-count/snapshot contract is mounted'},
    r2:{complete:false,count:null,reason:'No bucket listing or shared/orphan object coverage is mounted'},
    webhookReceipts:{complete:false,count:null,reason:'Receipts lack an unambiguous owner column; no global count is exposed'},
    otherRelations:{complete:false,reason:'Not a full live FK/catalog or retirement manifest; unlisted relations and name-only links remain outside coverage'}},
   completeForDestructiveAction:false};
 });
}
