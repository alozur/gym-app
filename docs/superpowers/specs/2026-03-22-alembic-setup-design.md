# Alembic Migration Setup Design

Make Alembic the single source of truth for database schema management in the gym-app backend, following the proven pattern from the mealmate repo.

## Context

- Alembic is partially set up: `alembic.ini`, `alembic/env.py`, and empty `alembic/versions/` exist
- App currently relies on `Base.metadata.create_all()` in the FastAPI lifespan
- 15 ORM models in `app/models.py` using SQLAlchemy 2.0+ with `Mapped[]` type hints
- PostgreSQL with schema `gym` (hardcoded `DB_SCHEMA = "gym"` in `database.py`)
- Async-first: `asyncpg` driver, `AsyncSession`
- Deploys on self-hosted Synology runner via Docker Compose with `postgres_infra_network`

## Decisions

- `DB_SCHEMA` stays as a hardcoded module constant (`"gym"`), not promoted to a setting
- Seed functions remain in the FastAPI lifespan (idempotent, run on every startup)
- Initial migration is hand-written and idempotent (uses `_table_exists()` checks)
- Follow the mealmate `migrate.yml` pattern: `docker run --rm` against `postgres_infra_network`

## Design

### 1. Fix `alembic/env.py`

Current issues:
- Uses `settings.DATABASE_URL` (raw field, can be `None`) instead of `settings.database_url` (property with fallback)
- Missing schema-awareness (`include_schemas`, `version_table_schema`)
- Missing schema creation (`CREATE SCHEMA IF NOT EXISTS`)

Changes:
- Import `DB_SCHEMA` from `app.database`
- Use `settings.database_url` (lowercase property)
- Add `CREATE SCHEMA IF NOT EXISTS gym` + `commit()` before running migrations
- Pass `include_schemas=True` and `version_table_schema=DB_SCHEMA` to `context.configure()` in both offline and online modes
- Keep existing model imports (all 15 models)

**Note:** Unlike mealmate (where `DB_SCHEMA` is a `Settings` field accessed as `settings.DB_SCHEMA`), gym-app uses a module-level constant `DB_SCHEMA` imported directly from `app.database`. All references in `env.py` must use `DB_SCHEMA` directly, not `settings.DB_SCHEMA`.

### 2. Initial migration `0001_initial_schema.py`

Hand-written, idempotent migration covering all 15 tables:

- `SCHEMA = "gym"` constant (self-contained, no app imports)
- `_table_exists()` helper for idempotency
- Table creation order respects FK dependencies:
  1. `users`
  2. `exercises` (FK -> users)
  3. `exercise_substitutions` (FK -> exercises x2)
  4. `workout_templates` (FK -> users)
  5. `template_exercises` (FK -> templates, exercises)
  6. `programs` (FK -> users)
  7. `user_programs` (FK -> users, programs)
  8. `program_routines` (FK -> programs, templates)
  9. `program_phases` (FK -> programs)
  10. `phase_workouts` (FK -> phases)
  11. `phase_workout_sections` (FK -> phase_workouts)
  12. `phase_workout_exercises` (FK -> sections, exercises x3)
  13. `workout_sessions` (FK -> users, templates, programs, phase_workouts, user_programs)
  14. `workout_sets` (FK -> sessions, exercises)
  15. `exercise_progress` (FK -> users, exercises)
- FK references use fully qualified `gym.table.column` format
- ForeignKeyConstraints must include `ondelete='CASCADE'` where the ORM models specify it: `program_routines.program_id`, `program_phases.program_id`, `phase_workouts.phase_id`, `phase_workout_sections.workout_id`, `phase_workout_exercises.section_id`
- UniqueConstraints: `uq_progress` (exercise_progress), `uq_user_program` (user_programs)
- Downgrade drops in reverse dependency order

### 3. `main.py` lifespan changes

- Remove `Base.metadata.create_all()` call and the `engine.begin()` block
- Remove `Base` and `engine` from imports
- Keep `async_session` and `settings` imports
- Seed functions remain unchanged

### 4. CI/CD workflow changes

#### 4a. `ci.yml` — New `migrate` job

- PostgreSQL 16 service container
- Installs backend deps, runs `alembic upgrade head`
- Env vars: `DATABASE_URL=postgresql+asyncpg://test:test@localhost:5432/testdb?ssl=disable`, `JWT_SECRET=test-secret-for-ci`
- No `DB_SCHEMA` env var needed in CI — it is hardcoded as a module constant in `database.py`

#### 4b. New `.github/workflows/migrate.yml`

- Inputs: `environment` (dev/prod)
- Triggers: `workflow_call`, `workflow_dispatch`
- Steps:
  1. Checkout
  2. Create `.env` from GitHub vars/secrets
  3. Build backend Docker image
  4. `docker run --rm --env-file .env --network postgres_infra_network gym-backend-migrate alembic upgrade head`
  5. Cleanup `.env`
- Runner: `[self-hosted, synology]`

#### 4c. `deploy.yml` — Pipeline update

- Pipeline: CI -> Migrate -> Deploy
- `migrate` job calls `migrate.yml` with `secrets: inherit`
- `deploy` job: `needs: [ci, migrate]`
- Environment selection: `main` -> prod, `dev` -> dev (unchanged logic)

## Files changed

| File | Action |
|------|--------|
| `backend/alembic/env.py` | Edit — schema-awareness, fix URL |
| `backend/alembic/versions/0001_initial_schema.py` | Create — initial migration |
| `backend/app/main.py` | Edit — remove `create_all()` |
| `.github/workflows/ci.yml` | Edit — add migrate job |
| `.github/workflows/migrate.yml` | Create — standalone migration workflow |
| `.github/workflows/deploy.yml` | Edit — add migrate step before deploy |
