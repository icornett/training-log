# GitHub Copilot Instructions — Training Log

## Project Overview

**Training Log** is a Ruby 4.0.4 / Sinatra 4.x web application backed by PostgreSQL. Users track workouts and exercises with per-user CRUD access. The app is containerized with Docker and deployed to Azure Container Apps via automated OpenTofu (Terraform-compatible) pipelines — **no manual `apply` or CLI steps are ever required in production**.

### Directory layout

```
training-log/
├── .github/
│   ├── copilot-instructions.md   # this file
│   └── workflows/                # GitHub Actions CI/CD
├── .githooks/
│   └── pre-commit                # shareable pre-commit hook (activate: git config core.hooksPath .githooks)
├── infra/                        # OpenTofu infrastructure
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   └── backend.tf
├── spec/                         # RSpec test suite
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── views/                        # Erubi/ERB templates
├── public/                       # Static assets
├── database_access.rb            # PostgreSQL data layer
├── workouts.rb                   # Sinatra routes (app entry point)
├── schema.sql                    # DB schema + seed data
├── Gemfile
└── Dockerfile
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | Ruby 4.0.4 |
| Web framework | Sinatra 4.x + sinatra-contrib |
| Templates | Erubi (HTML-escaped by default) |
| Database | PostgreSQL (pg gem) |
| Auth | BCrypt password hashing |
| App server | Puma |
| Container | Docker (multi-stage, non-root) |
| IaC | Managed by `workout-blog` infra repo (OpenTofu) |
| Cloud | Azure (ACI + PostgreSQL Flexible Server) — provisioned by infra repo |
| Registry | GHCR (`ghcr.io/icornett/training-log`) — published by `publish` job in `ci.yml` |
| CI/CD | GitHub Actions (zero-touch deploy) |
| Tests | RSpec + Rack::Test + Capybara + SQLite3 (integration) |
| SAST/Lint | Brakeman + bundler-audit + RuboCop + ERB Lint |

---

## Ruby / Sinatra Conventions

- **Ruby version:** always `4.0.4` (locked in `.ruby-version` and `Gemfile`).
- **Entry point:** `workouts.rb` — do not rename.
- **Data layer:** all DB access lives in `DatabaseAccess` (`database_access.rb`). No SQL in routes.
- **Sessions:** cookie-based Sinatra sessions; always use `session[:username]` as the identity key.
- **HTML escaping:** enabled globally via `set :erb, escape_html: true`. Use `<%==` only for trusted content.
- **Helpers:** pagination helpers (`next_page_num`, `prior_page_num`, `max_number_pages`) live in the `helpers` block in `workouts.rb`.
- **Error handling:** validation errors set `session[:message]` and redirect; never raise unhandled exceptions to the user.
- **Gemfile groups:**
  - `default` — production gems only.
  - `development` — `pry`, `sinatra/reloader`.
  - `test` — RSpec, Rack::Test, Capybara, Database Cleaner, factory helpers.
- **Removed / not needed:** `webrick` is not used in production (Puma handles all serving); keep it out of the Gemfile.

---

## Testing

### Philosophy

Every public method in `DatabaseAccess` and every Sinatra route **must** have a test. Tests live in `spec/` and are run with:

```bash
bundle exec rspec
```

### Test layers

#### Unit (`spec/unit/`)

- Test `DatabaseAccess` methods in isolation using **RSpec** with a **stubbed/mocked PG connection** (`instance_double` or `allow`).
- Test pure helper/utility methods in `workouts.rb` by extracting them into a testable module when needed.
- No real database connection required.
- Example: `spec/unit/database_access_spec.rb`

#### Integration (`spec/integration/`)

Integration tests exercise `DatabaseAccess` logic against a **real relational database** without needing a PostgreSQL server — they use **SQLite3 in-memory** via the `sequel` adapter.

- `DatabaseAccess` wraps a `Sequel::Database` connection injected at construction time (`DatabaseAccess.new(db:)`). Production passes a `Sequel.connect(ENV["DATABASE_URL"])` (PostgreSQL); tests pass `Sequel.sqlite`.
- SQL must be written in the **common subset** supported by both SQLite and PostgreSQL (avoid `SERIAL`, use `INTEGER PRIMARY KEY AUTOINCREMENT` in SQLite schema helper; avoid `pg`-only extensions like `ON CONFLICT DO UPDATE` syntax).
- A `spec/support/sqlite_schema.rb` helper creates all tables in an in-memory SQLite database at the start of each example group and tears them down after.
- Use **DatabaseCleaner** with the `:deletion` strategy to reset rows between examples.
- Seed minimal fixture data via factory helpers in `spec/support/factories.rb`.
- Tests cover: CRUD operations, constraint enforcement (duplicate exercise, >10 exercises, >1 workout per day), pagination offsets, and all validation predicates.
- **No PostgreSQL service required** — these run anywhere Ruby + sqlite3 gem is available.
- Example: `spec/integration/database_access_spec.rb`

#### End-to-End / Feature (`spec/e2e/`)

E2E tests are the **only layer that connects to a real PostgreSQL database**. They verify the full request→DB→response cycle.

- Use **Rack::Test** (fast, in-process HTTP) for route-level tests.
- Use **Capybara** with the `rack_test` driver for multi-page flow tests (login → create workout → add exercises → delete).
- The app is booted against a real PostgreSQL test database: `DATABASE_URL=postgres://localhost/training_log_test`.
- Apply `schema.sql` once per CI run before the e2e suite starts (via a `before(:suite)` hook or Rake task).
- Use **DatabaseCleaner** with the `:truncation` strategy to reset state between examples.
- Every Sinatra route (GET and POST) must have at least one happy-path and one error-path test.
- Session state is set via `env "rack.session", { username: "test_user" }` in Rack::Test, or through the login flow in Capybara specs.
- Example: `spec/e2e/workouts_spec.rb`

### Gemfile `test` group additions

```ruby
group :test do
  gem "rspec"
  gem "rack-test"
  gem "capybara"
  gem "database_cleaner-sequel"
  gem "sequel"          # DB adapter abstraction used by integration tests
  gem "sqlite3"         # in-memory DB for integration tests
  gem "rubocop"
  gem "rubocop-rspec"
end
```

### Test database setup (E2E only)

```bash
createdb training_log_test
DATABASE_URL=postgres://localhost/training_log_test bundle exec rake db:schema
```

Integration and unit tests require no database setup.

### Running tests

```bash
bundle exec rspec                        # all tests
bundle exec rspec spec/unit              # unit only (no DB)
bundle exec rspec spec/integration       # integration only (SQLite, no postgres)
bundle exec rspec spec/e2e               # e2e only (requires PostgreSQL)
bundle exec rspec --format documentation # verbose
```

### CI gate

All three layers run on every push and pull request. A PR cannot merge if any test fails. Unit and integration run without any services; E2E requires the PostgreSQL service container (see CI section below).

---

## CI/CD (GitHub Actions)

This repo owns **testing and image building only**. Infrastructure provisioning and deployment live in the `workout-blog` infra repo (see that repo's `copilot-instructions.md`).

One workflow lives in `.github/workflows/`:

### `ci.yml` — runs on every push / PR

Five jobs run; `lint-and-sast` and `test-fast`/`test-e2e` run in parallel first:

**`lint-and-sast`** (runs in parallel with tests — no services needed):
1. `bundle exec rubocop --format github --format json --out rubocop.json`
2. `bundle exec erb_lint --lint-all`
3. `bundle exec brakeman --quiet --no-pager --format github --format json --output brakeman.json`
4. `bundle exec bundle-audit check --update`
5. Uploads `rubocop.json` + `brakeman.json` as the `sast-reports` artifact (runs even on failure).

**`test-fast`** (unit + integration — no services needed):
1. `bundle install`
2. `bundle exec rspec spec/unit spec/integration` — runs against SQLite in-memory, zero infrastructure required.

**`test-e2e`** (requires PostgreSQL service):
1. `bundle install`
2. Start a PostgreSQL 16 **service container**.
3. Apply `schema.sql` to `training_log_test` (`psql -d training_log_test < schema.sql`).
4. `DATABASE_URL=postgres://postgres:postgres@localhost/training_log_test bundle exec rspec spec/e2e`

**`docker-build`** (smoke-test, runs after `test-fast` + `lint-and-sast`):
- `docker build` — verifies the image builds successfully (no push). Image push is handled by the `publish` job.

**`publish`** (main branch only, runs after all three above pass):
- Logs in to GHCR, builds, and pushes the image tagged with the commit SHA and `latest`.

All five jobs must pass before a PR can merge.

### GitHub Actions secrets (this repo only)

| Secret/Var | Usage |
|---|---|
| *(none for deploy)* | Deployment is triggered by the infra repo reading the image tag |

---

## Docker

- **Multi-stage build:** `build` stage installs gems; `runtime` stage copies only what's needed.
- **Non-root user:** `appuser` in group `appgroup`.
- **Port:** `4567` (mapped to `80`/`443` by the Container App ingress).
- **Entrypoint:** `bundle exec ruby workouts.rb -o 0.0.0.0 -p 4567`.
- The `development` and `test` gem groups are excluded from the production image (`bundle config set without 'development test'`).

---

## Database

- **Schema file:** `schema.sql` — authoritative source of truth for table definitions.
- **Migrations:** schema changes are applied by re-running `schema.sql` with `IF NOT EXISTS` guards, or via a migration script when destructive changes are needed.
- **Connection:** `DatabaseAccess` accepts an optional `db:` keyword argument (a `Sequel::Database` instance). When `db:` is omitted, it connects using `DATABASE_URL` env var (PostgreSQL in production/e2e); integration tests inject a `Sequel.sqlite` in-memory database. This keeps the class fully testable without a running PostgreSQL server.
- **Constraints enforced in DB:** unique `(user_id, date)` on `workouts`; `ON DELETE CASCADE` for child records; `varchar` length limits matching application-level validation.

---

## Key Business Rules (encode in tests)

1. A user may log **at most 1 workout per day**.
2. A workout may have **at most 10 exercises**.
3. Exercise descriptions must be **5–40 characters** (after stripping punctuation).
4. Weight descriptions must be `<number> lbs`, `<number> kgs`, or `bodyweight` (≤ 10 chars).
5. Workout names must be **4–15 characters**.
6. Usernames and passwords must be **≤ 25 characters**; passwords must be **> 10 characters**.
7. A user can only **edit or delete their own** workouts and exercises; they can **view** all.
8. Duplicate exercises (case-insensitive, whitespace-collapsed) are not allowed within one workout.

---

## Code Quality Guidelines

- Prefer **parameterized queries** via the `Sequel` dataset API or `db.run` with placeholders — never interpolate user input into SQL strings.
- `DatabaseAccess` must accept a `db:` keyword argument so tests can inject any `Sequel::Database` (SQLite for integration, PostgreSQL for production/e2e).
- Keep routes thin: validation and DB access delegated to `DatabaseAccess`.
- Avoid `session[:message]` chains longer than one redirect hop.
- All new methods must have corresponding RSpec examples before merging.
- Remove dead code and unused gems promptly.

### SAST & Lint Tooling

All four tools must pass (zero offenses/warnings) before a PR can merge. The `lint-and-sast` CI job enforces this automatically.

| Tool | What it checks | How to run locally |
|---|---|---|
| **RuboCop** | Ruby style, complexity, and correctness. Config in `.rubocop.yml`. | `bundle exec rubocop` |
| **RuboCop-RSpec** | RSpec-specific cops (included via `.rubocop.yml`). | *(included in rubocop run)* |
| **RuboCop-Performance** | Performance anti-patterns (included via `.rubocop.yml`). | *(included in rubocop run)* |
| **ERB Lint** | Lints `.erb` templates in `views/`. | `bundle exec erb_lint --lint-all` |
| **Brakeman** | Static analysis for Ruby/Sinatra security vulnerabilities. Config in `.brakeman.yml`. | `bundle exec brakeman --quiet --no-pager` |
| **bundler-audit** | Scans `Gemfile.lock` against the Ruby Advisory Database for known CVEs. | `bundle exec bundle-audit check --update` |

### CI artifact reports

After each `lint-and-sast` job run (including failures), these artifacts are uploaded as `sast-reports`:
- `rubocop.json` — full RuboCop offense list (JSON format)
- `brakeman.json` — Brakeman security warning report (JSON format)

Download them from the Actions run page in GitHub.

### Pre-commit hook setup

A shareable pre-commit hook lives at `.githooks/pre-commit`. It runs all four tools locally before each commit and skips any tool not present in the bundle.

**One-time setup:**
```bash
git config core.hooksPath .githooks
```

To also install directly into `.git/hooks/` (for contributors who don't set `core.hooksPath`):
```bash
cp .githooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

**Initial setup for new clones:**
```bash
mkdir -p .githooks
cp .githooks/pre-commit .git/hooks/pre-commit
chmod +x .githooks/pre-commit .git/hooks/pre-commit
git config core.hooksPath .githooks
```
