# Database reference schema

This folder contains a **small reference SQL schema** for the UDCShare project/API file-resource model.

It is deliberately not a backup, export or copy of the UDCShare production database. It contains schema definitions only: no rows, customer data, API keys, OAuth secrets, Google tokens, passwords or service-role credentials.

## File

- [udcshare-api-reference-schema.sql](./udcshare-api-reference-schema.sql) — project container, API resource, Google Drive connection metadata, file metadata and one-time external Google authorization state.

## Important before running

The script targets Supabase PostgreSQL (it expects the standard `anon`, `authenticated` and `service_role` roles). It is a reusable reference model, not a one-click deployment of UDCShare's private backend.

- It intentionally uses UUID owner/user identifiers without binding them to a particular authentication table. Add foreign keys to your own user table after adapting the schema.
- The SQL grants server access to Supabase's `service_role`; use that role only in a trusted backend. Never expose its key in a browser or public repository.
- Keep Google access and refresh tokens encrypted at application level before storing them. The column names in the schema do not mean plaintext storage is safe.
- RLS and revoked client privileges are defense in depth. Your backend must still verify project ownership, resource status, user identity, plan/quota and authorization on every request.
- The `developer_api_app_files` table stores Drive file IDs and metadata only. It does not store file binaries.
- Do not apply this reference schema to an existing production database without reviewing name conflicts, dependencies, indexes, RLS and migration order.

## What is intentionally excluded

The complete UDCShare database also contains authentication, profiles, billing, subscriptions, API key hashes, OAuth clients, webhooks, transfer metadata and many unrelated product tables. None of those are exported here. The actual UDCShare production schema and customer records are not part of this public examples repository.

For an ordinary API consumer, you do **not** need to recreate these UDCShare backend tables. You only need your own application database for your users and any business metadata your app chooses to retain.
