-- UDCShare Developer API — reference schema (metadata only)
-- PostgreSQL / Supabase compatible.
--
-- This is a SMALL, reusable reference schema for the API file-resource model.
-- It is NOT a dump of the UDCShare production database and contains NO data,
-- API keys, OAuth credentials, Google tokens, service-role keys or customer records.
--
-- Before production use:
-- 1. Connect owner_user_id / subject_user_id to YOUR authentication table.
-- 2. Store Google access_token and refresh_token only after application-level
--    encryption with a managed server-side key. Never store plaintext tokens.
-- 3. Keep all tables server-only. Do not grant direct browser access.
-- 4. Keep binary file contents in the authorized Google Drive; these tables
--    hold metadata and Drive file IDs only.
--
-- This script models the API-only file-resource subsystem. It intentionally
-- excludes UDCShare account profiles, billing, plans, API-key hashes, OAuth
-- login clients, transfers and unrelated platform tables.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.developer_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 3000),
  integration_mode TEXT NOT NULL
    CHECK (integration_mode IN ('oauth_only', 'api_only', 'oauth_api')),
  uses_file_api BOOLEAN NOT NULL DEFAULT FALSE,
  storage_mode TEXT
    CHECK (storage_mode IS NULL OR storage_mode IN ('company', 'individual')),
  environment TEXT NOT NULL DEFAULT 'sandbox'
    CHECK (environment IN ('sandbox', 'production')),
  api_production_review_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (api_production_review_status IN ('not_requested','pending','approved','rejected','suspended')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT developer_projects_file_api_mode_check
    CHECK (integration_mode <> 'oauth_only' OR uses_file_api = FALSE),
  CONSTRAINT developer_projects_storage_mode_check
    CHECK (
      (uses_file_api = TRUE AND storage_mode IS NOT NULL)
      OR (uses_file_api = FALSE AND storage_mode IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_developer_projects_owner_created
  ON public.developer_projects(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.developer_api_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE
    REFERENCES public.developer_projects(id) ON DELETE CASCADE,
  oauth_app_id UUID,
  owner_user_id UUID NOT NULL,
  api_client_id TEXT NOT NULL UNIQUE,
  storage_mode TEXT NOT NULL CHECK (storage_mode IN ('company','individual')),
  drive_redirect_uris TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive','revoked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT developer_api_apps_client_id_check
    CHECK (api_client_id ~ '^udc_api_[A-Za-z0-9_-]{24,}$'),
  CONSTRAINT developer_api_apps_redirects_count_check
    CHECK (cardinality(drive_redirect_uris) <= 10)
);

CREATE INDEX IF NOT EXISTS idx_developer_api_apps_owner
  ON public.developer_api_apps(owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.developer_api_google_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_app_id UUID NOT NULL
    REFERENCES public.developer_api_apps(id) ON DELETE CASCADE,
  subject_user_id UUID,
  external_subject_hash TEXT,
  google_sub TEXT NOT NULL,
  google_email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','revoked','error','reauth_required')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT developer_api_google_connections_id_app_unique
    UNIQUE (id, api_app_id),
  CONSTRAINT developer_api_google_connections_identity_check CHECK (
    (subject_user_id IS NOT NULL AND external_subject_hash IS NULL)
    OR (subject_user_id IS NULL AND external_subject_hash IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_developer_api_google_connections_user
  ON public.developer_api_google_connections(api_app_id, subject_user_id)
  WHERE subject_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_developer_api_google_connections_external
  ON public.developer_api_google_connections(api_app_id, external_subject_hash)
  WHERE external_subject_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.developer_api_app_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_app_id UUID NOT NULL
    REFERENCES public.developer_api_apps(id) ON DELETE CASCADE,
  subject_user_id UUID,
  external_subject_hash TEXT,
  google_connection_id UUID NOT NULL,
  google_drive_file_id TEXT NOT NULL,
  name TEXT NOT NULL,
  size BIGINT NOT NULL DEFAULT 0 CHECK (size >= 0),
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  web_view_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT developer_api_app_files_connection_resource_fk
    FOREIGN KEY (google_connection_id, api_app_id)
    REFERENCES public.developer_api_google_connections(id, api_app_id)
    ON DELETE RESTRICT,
  CONSTRAINT developer_api_app_files_identity_check CHECK (
    (subject_user_id IS NOT NULL AND external_subject_hash IS NULL)
    OR (subject_user_id IS NULL AND external_subject_hash IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_developer_api_app_files_user
  ON public.developer_api_app_files(api_app_id, subject_user_id, created_at DESC)
  WHERE subject_user_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_developer_api_app_files_external
  ON public.developer_api_app_files(api_app_id, external_subject_hash, created_at DESC)
  WHERE external_subject_hash IS NOT NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_developer_api_app_files_drive_id
  ON public.developer_api_app_files(api_app_id, google_connection_id, google_drive_file_id);

CREATE TABLE IF NOT EXISTS public.developer_api_external_google_states (
  state_hash TEXT PRIMARY KEY,
  api_app_id UUID NOT NULL
    REFERENCES public.developer_api_apps(id) ON DELETE CASCADE,
  external_subject_hash TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  developer_state TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_developer_api_external_google_states_expiry
  ON public.developer_api_external_google_states(expires_at);

-- Server-only access: RLS plus explicit privilege revocation.
ALTER TABLE public.developer_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_api_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_api_google_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_api_app_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.developer_api_external_google_states ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.developer_projects FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.developer_api_apps FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.developer_api_google_connections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.developer_api_app_files FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.developer_api_external_google_states FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.developer_projects TO service_role;
GRANT ALL ON public.developer_api_apps TO service_role;
GRANT ALL ON public.developer_api_google_connections TO service_role;
GRANT ALL ON public.developer_api_app_files TO service_role;
GRANT ALL ON public.developer_api_external_google_states TO service_role;

COMMENT ON TABLE public.developer_api_app_files IS
  'Metadata only. Binary file content remains in the Google Drive authorized for the resource/user.';
COMMENT ON COLUMN public.developer_api_apps.api_client_id IS
  'Public resource identifier only; never an authentication credential.';
COMMENT ON TABLE public.developer_api_google_connections IS
  'Server-side Google Drive connection metadata; encrypt token values before persistence.';

COMMIT;
