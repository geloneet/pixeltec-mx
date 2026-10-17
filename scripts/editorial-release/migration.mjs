/** Bounded two-table editorial release primitive. No environment/credentials, CLI,
 * production connection or automatic execution. Caller supplies a SQL pool.
 * Does not read/repair/write the app's drifted Drizzle migration journal. */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const names=['editorial_commands','editorial_drafts'];
const files=['0000_editorial_only.sql'];
const sha=v=>createHash('sha256').update(v).digest('hex');
export function migrationPlan() {
 const sources=files.map(name=>readFileSync(path.join(root,'drizzle/editorial-release',name),'utf8'));
 const statements=sources.join('\n--> statement-breakpoint\n').split('--> statement-breakpoint').map(s=>s.trim()).filter(Boolean);
 for(const statement of statements) {
  if(statement.replace(/;$/,'').includes(';'))throw new Error('MULTIPLE_SQL_STATEMENTS_REJECTED');
  for(const ref of statement.matchAll(/REFERENCES "([a-z_]+)"\."([a-z_]+)"/g))if(!(ref[1]==='public'&&['users','blog_posts'].includes(ref[2]))&&!(ref[1]==='mcp_safety_candidate'&&names.includes(ref[2])))throw new Error('OUT_OF_SCOPE_REFERENCE');
  if(statement.startsWith('ALTER TABLE')&&!/^ALTER TABLE "mcp_safety_candidate"\."[a-z_]+" ADD CONSTRAINT/.test(statement))throw new Error('OUT_OF_SCOPE_ALTER');
  if(/^CREATE SCHEMA "mcp_safety_candidate";?$/.test(statement))continue;
  const match=/^(?:CREATE TABLE|ALTER TABLE) "mcp_safety_candidate"\."([a-z_]+)"/.exec(statement)
    ??/^CREATE (?:UNIQUE )?INDEX "[a-z_]+" ON "mcp_safety_candidate"\."([a-z_]+)"/.exec(statement);
  if(!match||!names.includes(match[1]))throw new Error('OUT_OF_SCOPE_MIGRATION_STATEMENT');
 }
 return {files,statements,bundleHash:sha(sources.join('\n'))};
}
async function fingerprint(tx) {
 const rows=await tx.unsafe(`select 'column' kind,c.relname object,a.attname item,format_type(a.atttypid,a.atttypmod)||':'||a.attnotnull||':'||coalesce(pg_get_expr(d.adbin,d.adrelid),'') definition from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='mcp_safety_candidate' and c.relkind='r'
 union all select 'constraint',c.relname,k.conname,pg_get_constraintdef(k.oid) from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='mcp_safety_candidate'
 union all select 'index',tablename,indexname,indexdef from pg_indexes where schemaname='mcp_safety_candidate' order by 1,2,3`);
 const tables=[...new Set(rows.filter(r=>r.kind==='column').map(r=>r.object))].sort();
 if(JSON.stringify(tables)!==JSON.stringify(names))throw new Error('TWO_TABLE_SCOPE_MISMATCH');
 return sha(JSON.stringify(rows));
}
export async function applyLimitedMigration(sql) {
 const plan=migrationPlan();
 return sql.begin(async tx=>{
  await tx.unsafe("select pg_advisory_xact_lock(hashtextextended('pixeltec-editorial-only-migration',0))");
  const required=await tx.unsafe("select c.relname,a.attname,format_type(a.atttypid,a.atttypmod) type from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid where n.nspname='public' and c.relname in ('users','blog_posts') and a.attname='id' and not a.attisdropped");
  if(required.length!==2||required.some(r=>r.type!=='uuid'))throw new Error('CANONICAL_UUID_TARGETS_REQUIRED');
  const [existing]=await tx.unsafe("select obj_description(oid,'pg_namespace') receipt from pg_namespace where nspname='mcp_safety_candidate'");
  if(existing) {
   let receipt;try{receipt=JSON.parse(existing.receipt);if(!receipt||typeof receipt.bundleHash!=='string'||typeof receipt.fingerprint!=='string')throw new Error();}catch{throw new Error('EXISTING_SCHEMA_NOT_ADOPTED');}
   if(receipt.bundleHash!==plan.bundleHash)throw new Error('MIGRATION_VERSION_MISMATCH');
   if(receipt.fingerprint!==await fingerprint(tx))throw new Error('MIGRATION_DRIFT');
   return {applied:false,replayed:true,bundleHash:plan.bundleHash,tables:names};
  }
  for(const statement of plan.statements)await tx.unsafe(statement);
  const receipt={bundleHash:plan.bundleHash,fingerprint:await fingerprint(tx)};
  // Both values are locally generated SHA256 hex; no operator/model text is
  // interpolated. COMMENT has no bind-parameter grammar in PostgreSQL.
  await tx.unsafe(`COMMENT ON SCHEMA "mcp_safety_candidate" IS '${JSON.stringify(receipt)}'`);
  return {applied:true,replayed:false,...receipt,tables:names};
 });
}
