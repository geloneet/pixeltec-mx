import {test,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';
import {applyLimitedMigration,migrationPlan} from './migration.mjs';import {createEditorialService} from '../../src/lib/blog/editorial/service.mjs';import {readCommercialInventory} from '../../src/lib/commercial/inventory.mjs';
const require=createRequire(import.meta.url),postgres=require('postgres'),{drizzle}=require('drizzle-orm/postgres-js');
const u=new URL(process.env.DATABASE_URL||'');if(process.env.CMS_INVENTORY_SYNTHETIC!=='1'||u.hostname!=='127.0.0.1'||u.port!=='55479'||u.pathname!=='/cms_inventory_release')throw Error('OWN_SYNTHETIC_DATABASE_REQUIRED');
const sql=postgres(u.href,{max:2}),other=postgres('postgres://postgres@127.0.0.1:55479/cms_inventory_reject',{max:1});after(async()=>{await sql.end();await other.end();});
const owner='69100000-0000-4000-8000-000000000001',identity=Symbol('QA'),catalog=async p=>p.unsafe("select table_name,column_name,data_type from information_schema.columns where table_schema='public' order by 1,2");
let receipt;
test('generated DDL contains only two editorial tables and their original definitions',()=>{
 const p=migrationPlan();assert.equal(p.files.length,1);assert.equal(p.statements.filter(s=>s.startsWith('CREATE TABLE')).length,2);
 assert.equal(p.statements.some(s=>/event_|inbound_|GRANT|TRUNCATE|DROP |ALTER TABLE "public"/.test(s)),false);
 const canonical=JSON.parse(readFileSync(new URL('./editorial-statements.json',import.meta.url),'utf8'));
 assert.deepEqual(p.statements.map(s=>s.replace(/;$/,'')).sort(),canonical);
});
test('fresh migration + replay preserve public schema and produce exactly the two tables',async()=>{
 const before=await catalog(sql);receipt=await applyLimitedMigration(sql);assert.equal(receipt.applied,true);
 assert.deepEqual(receipt.tables,['editorial_commands','editorial_drafts']);
 const tables=await sql`select tablename from pg_tables where schemaname='mcp_safety_candidate' order by tablename`;assert.deepEqual(tables.map(t=>t.tablename),receipt.tables);
 const replay=await applyLimitedMigration(sql);assert.equal(replay.replayed,true);assert.equal(replay.bundleHash,receipt.bundleHash);assert.deepEqual(await catalog(sql),before);
});
test('partial DDL failure rolls back schema/table/receipt without touching canonical targets',async()=>{
 await other.unsafe('CREATE TABLE users(id uuid primary key);CREATE TABLE blog_posts(id uuid primary key)');
 const failPool={begin:fn=>other.begin(tx=>fn({unsafe:(s,args)=>{if(s.startsWith('CREATE TABLE "mcp_safety_candidate"."editorial_drafts"'))throw Error('INJECTED_DDL_FAILURE');return tx.unsafe(s,args);}}))};
 await assert.rejects(applyLimitedMigration(failPool),/INJECTED_DDL_FAILURE/);
 assert.equal((await other`select to_regnamespace('mcp_safety_candidate') present`)[0].present,null);
 assert.equal((await other`select count(*)::int n from information_schema.tables where table_schema='public'`)[0].n,2);
});
test('unreceipted existing schema and drift fail closed; transactional fixtures are rolled back',async()=>{
 await assert.rejects(other.begin(async tx=>{
  await tx.unsafe('CREATE SCHEMA mcp_safety_candidate');
  await assert.rejects(applyLimitedMigration({begin:fn=>fn(tx)}),/EXISTING_SCHEMA_NOT_ADOPTED/);throw Error('ROLLBACK_UNOWNED_FIXTURE');
 }),/ROLLBACK_UNOWNED_FIXTURE/);
 await assert.rejects(sql.begin(async tx=>{
  await tx.unsafe('CREATE INDEX qa_drift_only ON mcp_safety_candidate.editorial_drafts(digest)');
  await assert.rejects(applyLimitedMigration({begin:fn=>fn(tx)}),/MIGRATION_DRIFT/);throw Error('ROLLBACK_DRIFT_FIXTURE');
 }),/ROLLBACK_DRIFT_FIXTURE/);
 assert.equal((await applyLimitedMigration(sql)).replayed,true);
});
test('real shared Drizzle client creates/saves/reads private body using only editorial tables',async()=>{
 drizzle(sql);const service=createEditorialService({sql,authorize:async i=>i===identity?{userId:owner,role:'admin',name:'Miguel QA local'}:null,publicationGate:async()=>({ready:false})});
 const d=await service.createDraft(identity,{requestKey:randomUUID(),patch:{title:'Corte editorial',slug:'corte-editorial-'+randomUUID().slice(0,8),body:'Primera versión privada'}});
 const saved=await service.save(identity,{id:d.id,requestKey:randomUUID(),expectedVersion:d.version,patch:{body:'Cuerpo vigente del corte exclusivo'}});
 assert.equal((await service.read(identity,d.id)).content.body,'Cuerpo vigente del corte exclusivo');assert.equal(saved.version,'2');
 const [p]=await sql`select title,body,status from blog_posts where id=${d.id}`;assert.equal(p.title,'');assert.equal(p.body,'');assert.equal(p.status,'draft');
});
test('admin inventory dependency counts only own public rows and remains explicitly incomplete',async()=>{
 drizzle(sql);const [stamp]=await sql`select transaction_timestamp() now`;assert.equal(typeof stamp.now,'string','reproduce shared-client transparent timestamp parser');
 const r=await readCommercialInventory(sql,owner);assert.equal(Object.keys(r.counts).length,24);assert.equal(typeof r.snapshotAt,'string');assert.equal(Number.isNaN(Date.parse(r.snapshotAt)),false);assert.equal(r.counts.clients,'1');assert.equal(r.completeForDestructiveAction,false);assert.equal(r.coverage.whatsappSource.complete,false);assert.equal(r.coverage.r2.complete,false);
 const text=JSON.stringify(r);assert.equal(text.includes(owner),false);assert.equal(text.includes('Cliente QA'),false);
});
test('inventory transaction really rejects writes after the schema split',async()=>{
 const wrap={begin:(mode,fn)=>sql.begin(mode,async tx=>{await tx.unsafe("update clients set name='SHOULD_NOT_COMMIT'");return fn(tx);})};
 await assert.rejects(readCommercialInventory(wrap,owner),e=>e.code==='25006');assert.equal((await sql`select count(*)::int n from clients where name='SHOULD_NOT_COMMIT'`)[0].n,0);
});
