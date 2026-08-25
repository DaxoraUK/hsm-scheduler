-- Later invitation functions replaced earlier repaired definitions and restored
-- an empty search path. Discover pgcrypto's real schema and repair every token
-- function, including club invitations and acceptance, in one idempotent pass.
do $$
declare
  crypto_schema text;
  target_function record;
begin
  select namespace.nspname into crypto_schema
  from pg_catalog.pg_extension extension_row
  join pg_catalog.pg_namespace namespace on namespace.oid = extension_row.extnamespace
  where extension_row.extname = 'pgcrypto';

  if crypto_schema is null then
    raise exception 'The pgcrypto extension is required for secure invitation tokens';
  end if;

  if pg_catalog.to_regprocedure(pg_catalog.format('%I.gen_random_bytes(integer)', crypto_schema)) is null
     or pg_catalog.to_regprocedure(pg_catalog.format('%I.digest(text,text)', crypto_schema)) is null then
    raise exception 'Required pgcrypto token functions are unavailable in schema %', crypto_schema;
  end if;

  for target_function in
    select procedure_row.oid::pg_catalog.regprocedure as function_identity
    from pg_catalog.pg_proc procedure_row
    join pg_catalog.pg_namespace namespace on namespace.oid = procedure_row.pronamespace
    where namespace.nspname in ('public', 'private')
      and procedure_row.prokind = 'f'
      and (
        procedure_row.prosrc ~ '(^|[^[:alnum:]_])gen_random_bytes[[:space:]]*[(]'
        or procedure_row.prosrc ~ '(^|[^[:alnum:]_])digest[[:space:]]*[(]'
      )
  loop
    execute pg_catalog.format(
      'alter function %s set search_path = pg_catalog, %I',
      target_function.function_identity,
      crypto_schema
    );
  end loop;
end;
$$;

notify pgrst, 'reload schema';
