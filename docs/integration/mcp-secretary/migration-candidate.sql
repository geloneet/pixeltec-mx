-- Candidate additive migration. Apply only through governed CRM migration flow.
-- No users, roles, grants, keys or commercial records are inserted.
BEGIN;
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
COMMIT;
