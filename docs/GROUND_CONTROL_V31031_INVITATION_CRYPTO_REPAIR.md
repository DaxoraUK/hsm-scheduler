# Ground Control v3.10.3.1 — Invitation Crypto Search-Path Repair

## Fault

Coach Hub invitation creation failed with:

`function gen_random_bytes(integer) does not exist`

The invitation RPC was reached successfully, but its security-definer function had an empty PostgreSQL `search_path`. Supabase installs `gen_random_bytes()` and `digest()` through `pgcrypto`, normally in the `extensions` schema, so the unqualified calls could not be resolved.

## Repair

Migration `202607160005_crypto_search_path_token_functions.sql`:

- Discovers the actual schema containing the installed `pgcrypto` extension.
- Verifies `gen_random_bytes(integer)` and `digest(text,text)` exist.
- Finds affected functions in the `public` and `private` schemas.
- Restricts each affected function to `pg_catalog` plus the discovered `pgcrypto` schema.
- Covers Coach Hub invitations, invitation acceptance, calendar feeds and any existing league or club token functions with the same defect.
- Reloads the PostgREST schema cache.

No React or API file is changed in this hotfix.
