# Issue: node-pg-migrate double-quotes string defaults

**Severity:** P1 (causes 500 errors on INSERT)
**Root cause:** `node-pg-migrate` adds its own quoting around `default` values. Writing `default: "'active'"` produces `DEFAULT '''active'''` in DDL, which inserts the literal string `'active'` (with quotes) instead of `active`.

## The bug

```javascript
// WRONG: produces DEFAULT '''active''' in Postgres
status: {
  type: 'varchar(20)',
  default: "'active'",
}

// CORRECT: produces DEFAULT 'active' in Postgres
status: {
  type: 'varchar(20)',
  default: 'active',
}
```

The CHECK constraint then rejects the insert because `'active'` (with embedded quotes) does not match `active`.

## Rules

- Bare strings for constants: `default: 'active'`
- `pgm.func()` for SQL expressions: `default: pgm.func('gen_random_uuid()')`
- Never nest quotes
- The `migration-defaults` pre-commit hook in `lefthook.yml` catches this mechanically (R-214)

## Verification

After running `migrate:up`, verify the default in the DB:

```sql
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_name = '<table>' AND column_name = '<column>';
```

The default should be `'value'::character varying`, not `'''value'''::character varying`.
