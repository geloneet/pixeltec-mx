-- CANDIDATE ONLY. Requires exact GO, backup/restore and reserved window.
-- Source 0053 sha256:35fea9dc5045571f1c051f2cac38ccbdbbdd23753f7cc543afe17d8455899caa; MCP sha256:4fcca7e40cb752d2ce373956c395adb9ed604d96c7c23f9eea1d015041c7d47c
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
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY(ARRAY['commercial_opportunities','commercial_opportunities_owner_idx','commercial_opportunities_active_client_idx','commercial_identifiers','commercial_identifier_verified_idx','commercial_conversations','commercial_conversation_external_idx','commercial_messages','commercial_message_provider_idx','commercial_message_time_idx','commercial_outbox','commercial_outbox_key_idx','commercial_webhook_events','commercial_policies','commercial_policy_versions','commercial_policy_version_idx','commercial_reminders','commercial_reminder_period_idx','quote_versions','quote_versions_number_idx','quote_decisions','quote_decision_version_idx','commercial_commands'])) THEN RAISE EXCEPTION 'MIGRATION_RESERVED_OBJECT_EXISTS'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY(ARRAY['commercial_opportunities','commercial_identifiers','commercial_conversations','commercial_messages','commercial_outbox','commercial_webhook_events','commercial_policies','commercial_policy_versions','commercial_reminders','quote_versions','quote_decisions','commercial_commands'])) THEN RAISE EXCEPTION 'MIGRATION_TARGET_NOT_EMPTY'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND ((table_name='projects' AND column_name=ANY(ARRAY['commercial_stage','client_note','next_step','next_step_due','commercial_revision'])) OR (table_name='quotes' AND column_name='version'))) THEN RAISE EXCEPTION 'MIGRATION_COLUMN_ALREADY_PRESENT'; END IF;
 CREATE TEMP TABLE _mcp_before_projects ON COMMIT DROP AS SELECT id,to_jsonb(p) AS row FROM public.projects p;
 CREATE TEMP TABLE _mcp_before_quotes ON COMMIT DROP AS SELECT id,to_jsonb(q) AS row FROM public.quotes q;
 EXECUTE $commercial$
-- WO-2026-00566. Migración aditiva, transaccional y versionada.
-- Aplicar con ON_ERROR_STOP; no usar db:push ni regenerar el historial legado.

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS commercial_stage text NOT NULL DEFAULT 'arranque';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_note text NOT NULL DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS next_step text NOT NULL DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS next_step_due date;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS commercial_revision integer NOT NULL DEFAULT 0;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS public.commercial_opportunities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES public.users(id), client_id uuid NOT NULL REFERENCES public.clients(id),
 assigned_to uuid REFERENCES public.users(id), source text NOT NULL CHECK(source IN ('manual','whatsapp','email','form')),
 need text NOT NULL, stage text NOT NULL DEFAULT 'nuevo' CHECK(stage IN ('nuevo','conversacion','cotizacion','cierre','ganado','pausado','perdido')),
 next_action text NOT NULL DEFAULT '', next_action_due date, reason text NOT NULL DEFAULT '', quote_id uuid REFERENCES public.quotes(id), revision integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commercial_opportunities_owner_idx ON public.commercial_opportunities(owner_id,stage);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_opportunities_active_client_idx ON public.commercial_opportunities(owner_id,client_id) WHERE stage NOT IN ('ganado','perdido');
CREATE TABLE IF NOT EXISTS public.commercial_identifiers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES public.users(id), client_id uuid NOT NULL REFERENCES public.clients(id),
 channel text NOT NULL CHECK(channel IN ('whatsapp','email')), value text NOT NULL, verified_at timestamptz, verified_by text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_identifier_verified_idx ON public.commercial_identifiers(owner_id,channel,value) WHERE verified_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.commercial_conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES public.users(id), client_id uuid REFERENCES public.clients(id), opportunity_id uuid REFERENCES public.commercial_opportunities(id),
 channel text NOT NULL CHECK(channel IN ('whatsapp','email','form')), external_id text NOT NULL, address text NOT NULL, subject text NOT NULL DEFAULT '',
 state text NOT NULL DEFAULT 'sin_atender' CHECK(state IN ('sin_atender','decision','esperando','humano')),
 mode text NOT NULL DEFAULT 'HUMAN' CHECK(mode IN ('BOT','HUMAN','PAUSED')), match_review boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 0, last_inbound_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_conversation_external_idx ON public.commercial_conversations(owner_id,channel,external_id);
CREATE TABLE IF NOT EXISTS public.commercial_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES public.commercial_conversations(id), provider_id text,
 direction text NOT NULL CHECK(direction IN ('inbound','outbound')), body text NOT NULL,
 delivery text NOT NULL CHECK(delivery IN ('received','queued','sent','delivered','failed','unknown')),
 actor_id uuid REFERENCES public.users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_message_provider_idx ON public.commercial_messages(conversation_id,provider_id);
CREATE INDEX IF NOT EXISTS commercial_message_time_idx ON public.commercial_messages(conversation_id,created_at);
CREATE TABLE IF NOT EXISTS public.commercial_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES public.users(id), conversation_id uuid NOT NULL REFERENCES public.commercial_conversations(id),
 idempotency_key uuid NOT NULL, payload_hash text NOT NULL, body text NOT NULL, subject text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','delivered','failed','unknown')),
 provider_id text, error_code text, attempts integer NOT NULL DEFAULT 0, actor_id uuid NOT NULL REFERENCES public.users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_outbox_key_idx ON public.commercial_outbox(owner_id,idempotency_key);
CREATE TABLE IF NOT EXISTS public.commercial_webhook_events (
 id text PRIMARY KEY, provider text NOT NULL, payload_hash text NOT NULL,
 status text NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','done','failed')), error_code text,
 received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz
);
CREATE TABLE IF NOT EXISTS public.commercial_policies (
 owner_id uuid PRIMARY KEY REFERENCES public.users(id), automatic_enabled boolean NOT NULL DEFAULT false, tone text NOT NULL DEFAULT 'cercano' CHECK(tone IN ('cercano','formal')),
 approved_answers jsonb NOT NULL DEFAULT '[]', revision integer NOT NULL DEFAULT 0, updated_by uuid NOT NULL REFERENCES public.users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commercial_webhook_events ADD COLUMN IF NOT EXISTS provider_message_id text;
ALTER TABLE public.commercial_webhook_events ADD COLUMN IF NOT EXISTS delivery text CHECK(delivery IN ('sent','delivered','failed'));
ALTER TABLE public.commercial_webhook_events ADD COLUMN IF NOT EXISTS occurred_at timestamptz;
CREATE TABLE IF NOT EXISTS public.commercial_policy_versions (
 owner_id uuid NOT NULL REFERENCES public.users(id), revision integer NOT NULL, snapshot jsonb NOT NULL,
 updated_by uuid NOT NULL REFERENCES public.users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_policy_version_idx ON public.commercial_policy_versions(owner_id,revision);
CREATE TABLE IF NOT EXISTS public.commercial_reminders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES public.users(id), billing_item_id uuid NOT NULL REFERENCES public.billing_items(id),
 conversation_id uuid NOT NULL REFERENCES public.commercial_conversations(id), due_period date NOT NULL, scheduled_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','paused','sent','cancelled','failed')),
 body text NOT NULL, revision integer NOT NULL DEFAULT 0, outbox_id uuid REFERENCES public.commercial_outbox(id), created_by uuid NOT NULL REFERENCES public.users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_reminder_period_idx ON public.commercial_reminders(billing_item_id,due_period);
CREATE TABLE IF NOT EXISTS public.quote_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quote_id uuid NOT NULL REFERENCES public.quotes(id), version integer NOT NULL,
 snapshot jsonb NOT NULL, created_by uuid REFERENCES public.users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS quote_versions_number_idx ON public.quote_versions(quote_id,version);
CREATE TABLE IF NOT EXISTS public.quote_decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quote_id uuid NOT NULL REFERENCES public.quotes(id), version integer NOT NULL,
 decision text NOT NULL CHECK(decision IN ('accept','changes')), actor_name text NOT NULL, comment text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS quote_decision_version_idx ON public.quote_decisions(quote_id,version);
INSERT INTO public.quote_versions(quote_id,version,snapshot,created_by,created_at)
 SELECT id,version,to_jsonb(q),created_by,updated_at FROM public.quotes q ON CONFLICT(quote_id,version) DO NOTHING;
CREATE TABLE IF NOT EXISTS public.commercial_commands (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES public.users(id), resource_id uuid NOT NULL, action text NOT NULL, payload_hash text NOT NULL,
 status text NOT NULL CHECK(status IN ('processing','done','unknown')), result jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);


$commercial$;
 EXECUTE $mcp$
-- Candidate additive migration. Apply only through governed CRM migration flow.
-- No users, roles, grants, keys or commercial records are inserted.

CREATE SCHEMA mcp_secretary;
CREATE TABLE mcp_secretary.pending(id text PRIMARY KEY,session_hash text NOT NULL,user_id text NOT NULL,credential_epoch bigint NOT NULL,request text NOT NULL,csrf_hash text,expires bigint NOT NULL,used smallint NOT NULL DEFAULT 0 CHECK(used IN(0,1)));
CREATE TABLE mcp_secretary.grants(seq bigint GENERATED ALWAYS AS IDENTITY UNIQUE,id text PRIMARY KEY,subject text UNIQUE NOT NULL,user_id text NOT NULL,credential_epoch bigint NOT NULL,client text NOT NULL,scopes text NOT NULL DEFAULT '["crm:read"]',expires bigint NOT NULL,revoked smallint NOT NULL DEFAULT 0 CHECK(revoked IN(0,1)));
CREATE INDEX grants_owner_seq ON mcp_secretary.grants(user_id,seq DESC);
CREATE TABLE mcp_secretary.codes(hash text PRIMARY KEY CHECK(length(hash)=64),grant_id text NOT NULL REFERENCES mcp_secretary.grants(id),request text NOT NULL,expires bigint NOT NULL,used smallint NOT NULL DEFAULT 0 CHECK(used IN(0,1)));
CREATE TABLE mcp_secretary.refresh(hash text PRIMARY KEY CHECK(length(hash)=64),grant_id text NOT NULL REFERENCES mcp_secretary.grants(id),expires bigint NOT NULL,used smallint NOT NULL DEFAULT 0 CHECK(used IN(0,1)));
CREATE INDEX refresh_grant ON mcp_secretary.refresh(grant_id);
CREATE TABLE mcp_secretary.disconnect(id text PRIMARY KEY,user_id text NOT NULL,session_hash text NOT NULL,grant_id text NOT NULL REFERENCES mcp_secretary.grants(id),csrf_hash text NOT NULL,expires bigint NOT NULL,used smallint NOT NULL DEFAULT 0 CHECK(used IN(0,1)));
CREATE TABLE mcp_secretary.intents(seq bigint GENERATED ALWAYS AS IDENTITY UNIQUE,id text PRIMARY KEY,owner text NOT NULL,body text NOT NULL,hash text NOT NULL,expires bigint NOT NULL,state text NOT NULL CHECK(state IN('prepared','dispatching','done','uncertain')),result text);
CREATE INDEX intents_owner_seq ON mcp_secretary.intents(owner,seq DESC);
CREATE TABLE mcp_secretary.audit(seq bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,domain text NOT NULL DEFAULT 'crm' CHECK(domain IN('crm','oauth')),at bigint NOT NULL,owner text,action text NOT NULL,ref text,status text NOT NULL);
CREATE INDEX audit_owner_at ON mcp_secretary.audit(owner,at DESC);
CREATE VIEW mcp_secretary.issuer_audit AS SELECT seq,at,owner AS user_id,ref,action AS event FROM mcp_secretary.audit WHERE domain='oauth';


$mcp$;
 IF EXISTS(SELECT 1 FROM _mcp_before_projects b FULL JOIN public.projects p USING(id) WHERE b.row IS DISTINCT FROM (to_jsonb(p)-ARRAY['commercial_stage','client_note','next_step','next_step_due','commercial_revision'])) THEN RAISE EXCEPTION 'PROJECT_PRESERVATION_FAILED'; END IF;
 IF EXISTS(SELECT 1 FROM _mcp_before_quotes b FULL JOIN public.quotes q USING(id) WHERE b.row IS DISTINCT FROM (to_jsonb(q)-'version')) THEN RAISE EXCEPTION 'QUOTE_PRESERVATION_FAILED'; END IF;
 IF (SELECT count(*) FROM public.quotes)<>(SELECT count(*) FROM public.quote_versions) OR EXISTS(SELECT 1 FROM public.quotes q LEFT JOIN public.quote_versions v ON v.quote_id=q.id AND v.version=q.version WHERE v.id IS NULL OR v.snapshot IS DISTINCT FROM to_jsonb(q)) THEN RAISE EXCEPTION 'SNAPSHOT_PRESERVATION_FAILED'; END IF;
 IF EXISTS(SELECT 1 FROM mcp_secretary.grants) OR EXISTS(SELECT 1 FROM mcp_secretary.codes) OR EXISTS(SELECT 1 FROM mcp_secretary.refresh) THEN RAISE EXCEPTION 'UNEXPECTED_ACCESS_CREATED'; END IF;
 INSERT INTO mcp_secretary.audit(domain,at,owner,action,ref,status) VALUES('crm',(extract(epoch from clock_timestamp())*1000)::bigint,NULL,'migration_0053_mcp_v1','35fea9dc5045571f1c051f2cac38ccbdbbdd23753f7cc543afe17d8455899caa:4fcca7e40cb752d2ce373956c395adb9ed604d96c7c23f9eea1d015041c7d47c','done');
END $activation$;
COMMIT;
