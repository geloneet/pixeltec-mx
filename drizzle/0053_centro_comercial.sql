-- WO-2026-00566. Migración aditiva, transaccional y versionada.
-- Aplicar con ON_ERROR_STOP; no usar db:push ni regenerar el historial legado.
BEGIN;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS commercial_stage text NOT NULL DEFAULT 'arranque';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_note text NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS next_step text NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS next_step_due date;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS commercial_revision integer NOT NULL DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS commercial_opportunities (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id), client_id uuid NOT NULL REFERENCES clients(id),
 assigned_to uuid REFERENCES users(id), source text NOT NULL CHECK(source IN ('manual','whatsapp','email','form')),
 need text NOT NULL, stage text NOT NULL DEFAULT 'nuevo' CHECK(stage IN ('nuevo','conversacion','cotizacion','cierre','ganado','pausado','perdido')),
 next_action text NOT NULL DEFAULT '', next_action_due date, reason text NOT NULL DEFAULT '', quote_id uuid REFERENCES quotes(id), revision integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commercial_opportunities_owner_idx ON commercial_opportunities(owner_id,stage);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_opportunities_active_client_idx ON commercial_opportunities(owner_id,client_id) WHERE stage NOT IN ('ganado','perdido');
CREATE TABLE IF NOT EXISTS commercial_identifiers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id), client_id uuid NOT NULL REFERENCES clients(id),
 channel text NOT NULL CHECK(channel IN ('whatsapp','email')), value text NOT NULL, verified_at timestamptz, verified_by text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_identifier_verified_idx ON commercial_identifiers(owner_id,channel,value) WHERE verified_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS commercial_conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id), client_id uuid REFERENCES clients(id), opportunity_id uuid REFERENCES commercial_opportunities(id),
 channel text NOT NULL CHECK(channel IN ('whatsapp','email','form')), external_id text NOT NULL, address text NOT NULL, subject text NOT NULL DEFAULT '',
 state text NOT NULL DEFAULT 'sin_atender' CHECK(state IN ('sin_atender','decision','esperando','humano')),
 mode text NOT NULL DEFAULT 'HUMAN' CHECK(mode IN ('BOT','HUMAN','PAUSED')), match_review boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 0, last_inbound_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_conversation_external_idx ON commercial_conversations(owner_id,channel,external_id);
CREATE TABLE IF NOT EXISTS commercial_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES commercial_conversations(id), provider_id text,
 direction text NOT NULL CHECK(direction IN ('inbound','outbound')), body text NOT NULL,
 delivery text NOT NULL CHECK(delivery IN ('received','queued','sent','delivered','failed','unknown')),
 actor_id uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_message_provider_idx ON commercial_messages(conversation_id,provider_id);
CREATE INDEX IF NOT EXISTS commercial_message_time_idx ON commercial_messages(conversation_id,created_at);
CREATE TABLE IF NOT EXISTS commercial_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id), conversation_id uuid NOT NULL REFERENCES commercial_conversations(id),
 idempotency_key uuid NOT NULL, payload_hash text NOT NULL, body text NOT NULL, subject text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','delivered','failed','unknown')),
 provider_id text, error_code text, attempts integer NOT NULL DEFAULT 0, actor_id uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_outbox_key_idx ON commercial_outbox(owner_id,idempotency_key);
CREATE TABLE IF NOT EXISTS commercial_webhook_events (
 id text PRIMARY KEY, provider text NOT NULL, payload_hash text NOT NULL,
 status text NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','done','failed')), error_code text,
 received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz
);
CREATE TABLE IF NOT EXISTS commercial_policies (
 owner_id uuid PRIMARY KEY REFERENCES users(id), automatic_enabled boolean NOT NULL DEFAULT false, tone text NOT NULL DEFAULT 'cercano' CHECK(tone IN ('cercano','formal')),
 approved_answers jsonb NOT NULL DEFAULT '[]', revision integer NOT NULL DEFAULT 0, updated_by uuid NOT NULL REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE commercial_webhook_events ADD COLUMN IF NOT EXISTS provider_message_id text;
ALTER TABLE commercial_webhook_events ADD COLUMN IF NOT EXISTS delivery text CHECK(delivery IN ('sent','delivered','failed'));
ALTER TABLE commercial_webhook_events ADD COLUMN IF NOT EXISTS occurred_at timestamptz;
CREATE TABLE IF NOT EXISTS commercial_policy_versions (
 owner_id uuid NOT NULL REFERENCES users(id), revision integer NOT NULL, snapshot jsonb NOT NULL,
 updated_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_policy_version_idx ON commercial_policy_versions(owner_id,revision);
CREATE TABLE IF NOT EXISTS commercial_reminders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id), billing_item_id uuid NOT NULL REFERENCES billing_items(id),
 conversation_id uuid NOT NULL REFERENCES commercial_conversations(id), due_period date NOT NULL, scheduled_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','paused','sent','cancelled','failed')),
 body text NOT NULL, revision integer NOT NULL DEFAULT 0, outbox_id uuid REFERENCES commercial_outbox(id), created_by uuid NOT NULL REFERENCES users(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS commercial_reminder_period_idx ON commercial_reminders(billing_item_id,due_period);
CREATE TABLE IF NOT EXISTS quote_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quote_id uuid NOT NULL REFERENCES quotes(id), version integer NOT NULL,
 snapshot jsonb NOT NULL, created_by uuid REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS quote_versions_number_idx ON quote_versions(quote_id,version);
CREATE TABLE IF NOT EXISTS quote_decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quote_id uuid NOT NULL REFERENCES quotes(id), version integer NOT NULL,
 decision text NOT NULL CHECK(decision IN ('accept','changes')), actor_name text NOT NULL, comment text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS quote_decision_version_idx ON quote_decisions(quote_id,version);
INSERT INTO quote_versions(quote_id,version,snapshot,created_by,created_at)
 SELECT id,version,to_jsonb(q),created_by,updated_at FROM quotes q ON CONFLICT(quote_id,version) DO NOTHING;
CREATE TABLE IF NOT EXISTS commercial_commands (
 id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), resource_id uuid NOT NULL, action text NOT NULL, payload_hash text NOT NULL,
 status text NOT NULL CHECK(status IN ('processing','done','unknown')), result jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
