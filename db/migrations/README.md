# DB Migrations

Baseline:
- Upstream `main` schema is captured at `db/baseline/main.sql`.
- New branch changes should be authored as migration files in this folder.

Use timestamped up/down SQL files in this folder.

File naming:
- `YYYYMMDDHHMMSS_description.up.sql`
- `YYYYMMDDHHMMSS_description.down.sql`

Examples:
- `20260707230000_add_exercise_sets.up.sql`
- `20260707230000_add_exercise_sets.down.sql`

Commands:
- `npm run db:migration:new -- add_exercise_sets`
- `npm run db:migrate`
- `npm run db:rollback -- 1`
- `npm run db:local:migrate`
- `npm run db:local:rollback -- 1`

Notes:
- The first migration run auto-applies `db/baseline/main.sql` as a baseline and records it in `schema_migrations`.
- Rollback requires a matching `.down.sql` file for the migration version.
