import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const commercial=readFileSync(path.join(root,'drizzle/0053_centro_comercial.sql'),'utf8');
const mcp=readFileSync(path.join(root,'docs/integration/mcp-secretary/migration-candidate.sql'),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
function body(s){if((s.match(/^BEGIN;$/gm)||[]).length!==1||(s.match(/^COMMIT;$/gm)||[]).length!==1)throw new Error('TRANSACTION_BOUNDARY_CHANGED');return s.replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');}
const qualifiedCommercial=body(commercial).replace(/CREATE TABLE IF NOT EXISTS ([a-z_]+)/g,'CREATE TABLE IF NOT EXISTS public.$1').replace(/ALTER TABLE ([a-z_]+)/g,'ALTER TABLE public.$1').replace(/REFERENCES ([a-z_]+)/g,'REFERENCES public.$1').replace(/INSERT INTO ([a-z_]+)/g,'INSERT INTO public.$1').replace(/\bON ([a-z_]+)\(/g,'ON public.$1(').replace(/FROM quotes q/g,'FROM public.quotes q');
if((qualifiedCommercial.match(/CREATE TABLE IF NOT EXISTS public\./g)||[]).length!==12)throw new Error('DDL_QUALIFICATION_CHANGED');
const ref=hash(commercial)+':'+hash(mcp);
const reserved=[...commercial.matchAll(/^CREATE (?:UNIQUE )?(?:TABLE|INDEX) IF NOT EXISTS ([a-z_]+)/gm)].map(x=>x[1]);
if(reserved.length<20)throw new Error('RESERVED_MANIFEST_INCOMPLETE');
export const activationSql=`-- CANDIDATE ONLY. Requires exact GO, backup/restore and reserved window.
-- Source 0053 sha256:${hash(commercial)}; MCP sha256:${hash(mcp)}
-- Derived commercial DDL removes transaction delimiters and qualifies public tables/FKs.
-- No Drizzle journal edits, global migration, users, keys or grants.
BEGIN;
SET LOCAL search_path=pg_catalog,public;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';
SELECT pg_advisory_xact_lock(hashtextextended('pixeltec:commercial-mcp-migration-v1',0));
LOCK TABLE public.projects, public.quotes IN ACCESS EXCLUSIVE MODE NOWAIT;
DO $activation$
BEGIN
 IF to_regnamespace('mcp_secretary') IS NOT NULL THEN RAISE EXCEPTION 'MCP_SCHEMA_ALREADY_PRESENT_VERIFY_RECEIPT'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(ARRAY[${reserved.map(x=>"'"+x+"'").join(',')}])) THEN RAISE EXCEPTION 'MIGRATION_RESERVED_OBJECT_EXISTS'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY(ARRAY['commercial_opportunities','commercial_identifiers','commercial_conversations','commercial_messages','commercial_outbox','commercial_webhook_events','commercial_policies','commercial_policy_versions','commercial_reminders','quote_versions','quote_decisions','commercial_commands'])) THEN RAISE EXCEPTION 'MIGRATION_TARGET_NOT_EMPTY'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND ((table_name='projects' AND column_name=ANY(ARRAY['commercial_stage','client_note','next_step','next_step_due','commercial_revision'])) OR (table_name='quotes' AND column_name='version'))) THEN RAISE EXCEPTION 'MIGRATION_COLUMN_ALREADY_PRESENT'; END IF;
 CREATE TEMP TABLE _mcp_before_projects ON COMMIT DROP AS SELECT id,to_jsonb(p) AS row FROM public.projects p;
 CREATE TEMP TABLE _mcp_before_quotes ON COMMIT DROP AS SELECT id,to_jsonb(q) AS row FROM public.quotes q;
 EXECUTE $commercial$
${qualifiedCommercial}
$commercial$;
 EXECUTE $mcp$
${body(mcp)}
$mcp$;
 IF EXISTS(SELECT 1 FROM _mcp_before_projects b FULL JOIN public.projects p USING(id) WHERE b.row IS DISTINCT FROM (to_jsonb(p)-ARRAY['commercial_stage','client_note','next_step','next_step_due','commercial_revision'])) THEN RAISE EXCEPTION 'PROJECT_PRESERVATION_FAILED'; END IF;
 IF EXISTS(SELECT 1 FROM _mcp_before_quotes b FULL JOIN public.quotes q USING(id) WHERE b.row IS DISTINCT FROM (to_jsonb(q)-'version')) THEN RAISE EXCEPTION 'QUOTE_PRESERVATION_FAILED'; END IF;
 IF (SELECT count(*) FROM public.quotes)<>(SELECT count(*) FROM public.quote_versions) OR EXISTS(SELECT 1 FROM public.quotes q LEFT JOIN public.quote_versions v ON v.quote_id=q.id AND v.version=q.version WHERE v.id IS NULL OR v.snapshot IS DISTINCT FROM to_jsonb(q)) THEN RAISE EXCEPTION 'SNAPSHOT_PRESERVATION_FAILED'; END IF;
 IF EXISTS(SELECT 1 FROM mcp_secretary.grants) OR EXISTS(SELECT 1 FROM mcp_secretary.codes) OR EXISTS(SELECT 1 FROM mcp_secretary.refresh) THEN RAISE EXCEPTION 'UNEXPECTED_ACCESS_CREATED'; END IF;
 INSERT INTO mcp_secretary.audit(domain,at,owner,action,ref,status) VALUES('crm',(extract(epoch from clock_timestamp())*1000)::bigint,NULL,'migration_0053_mcp_v1','${ref}','done');
END $activation$;
COMMIT;
`;
if(process.argv[1]===fileURLToPath(import.meta.url))writeFileSync(path.join(root,'docs/integration/mcp-secretary/activation-batch-candidate.sql'),activationSql);
