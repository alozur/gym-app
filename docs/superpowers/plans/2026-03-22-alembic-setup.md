# Alembic Migration Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Alembic the single source of truth for database schema management, replacing `create_all()` in the FastAPI lifespan, with CI validation and automated deployment.

**Architecture:** Fix the existing `env.py` for async schema-awareness, write an idempotent initial migration covering all 15 tables, remove `create_all()` from the app lifespan (keeping seed functions), add a CI migration validation job, create a standalone `migrate.yml` workflow, and update `deploy.yml` to run migrations before deploying.

**Tech Stack:** Alembic 1.13.3, SQLAlchemy 2.0.35 (async), asyncpg, PostgreSQL 16, FastAPI, GitHub Actions, Docker

**Spec:** `docs/superpowers/specs/2026-03-22-alembic-setup-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/alembic/env.py` | Edit | Async migration runner with schema-awareness |
| `backend/alembic/versions/0001_initial_schema.py` | Create | Idempotent initial migration for all 15 tables |
| `backend/app/main.py` | Edit | Remove `create_all()`, keep seed functions |
| `.github/workflows/ci.yml` | Edit | Add migration validation job |
| `.github/workflows/migrate.yml` | Create | Standalone migration workflow for deployment |
| `.github/workflows/deploy.yml` | Edit | Add migrate step before deploy |

---

### Task 1: Fix `alembic/env.py` for schema-awareness

**Files:**
- Modify: `backend/alembic/env.py`

- [ ] **Step 1: Rewrite `env.py` with schema-awareness**

Replace the contents of `backend/alembic/env.py` with:

```python
import asyncio
from logging.config import fileConfig

from sqlalchemy import pool, text
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

from app.database import Base, DB_SCHEMA, settings
from app.models import (  # noqa: F401 - ensure all models are registered
    Exercise,
    ExerciseProgress,
    ExerciseSubstitution,
    PhaseWorkout,
    PhaseWorkoutExercise,
    PhaseWorkoutSection,
    Program,
    ProgramPhase,
    ProgramRoutine,
    TemplateExercise,
    User,
    UserProgram,
    WorkoutSession,
    WorkoutSet,
    WorkoutTemplate,
)

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Override sqlalchemy.url from app settings (use the property with fallback logic)
config.set_main_option("sqlalchemy.url", settings.database_url)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
        version_table_schema=DB_SCHEMA,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_schemas=True,
        version_table_schema=DB_SCHEMA,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Create an async engine, ensure schema exists, then run migrations."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        # Create schema before migrations (requires commit before migration transaction)
        await connection.execute(
            text(f"CREATE SCHEMA IF NOT EXISTS {DB_SCHEMA}")
        )
        await connection.commit()
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

Key changes from current:
- Import `DB_SCHEMA` from `app.database` (module constant, NOT `settings.DB_SCHEMA`)
- Use `settings.database_url` (lowercase property with fallback) instead of `settings.DATABASE_URL`
- Add `include_schemas=True` and `version_table_schema=DB_SCHEMA` to both offline and online `context.configure()`
- Add `CREATE SCHEMA IF NOT EXISTS` + `commit()` before running migrations
- Add `Connection` type hint to `do_run_migrations`

- [ ] **Step 2: Verify env.py loads without errors**

Run from `backend/`:
```bash
cd backend && uv run python -c "from alembic.config import Config; from alembic import command; c = Config('alembic.ini'); print('env.py loads OK')"
```
Expected: `env.py loads OK` (no import errors)

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/env.py
git commit -m "fix: update alembic env.py for schema-awareness and correct URL"
```

---

### Task 2: Write initial migration `0001_initial_schema.py`

**Files:**
- Create: `backend/alembic/versions/0001_initial_schema.py`
- Reference: `backend/app/models.py` (all 15 models)

- [ ] **Step 1: Create the versions directory and initial migration file**

```bash
mkdir -p backend/alembic/versions
```

Create `backend/alembic/versions/0001_initial_schema.py`:

```python
"""initial schema - all tables

Revision ID: 0001
Revises:
Create Date: 2026-03-22
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision: str = "0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "gym"


def _table_exists(table_name: str) -> bool:
    """Check if a table already exists in the schema."""
    bind = op.get_bind()
    insp = inspect(bind)
    return table_name in insp.get_table_names(schema=SCHEMA)


def upgrade() -> None:
    """Create all tables (skips any that already exist)."""

    # 1. users
    if not _table_exists("users"):
        op.create_table(
            "users",
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("email", sa.String(255), nullable=False),
            sa.Column("password_hash", sa.String(255), nullable=False),
            sa.Column("display_name", sa.String(100), nullable=False),
            sa.Column("preferred_unit", sa.String(10), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("email"),
            schema=SCHEMA,
        )

    # 2. exercises
    if not _table_exists("exercises"):
        op.create_table(
            "exercises",
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("user_id", sa.String(36), nullable=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("muscle_group", sa.String(100), nullable=False),
            sa.Column("equipment", sa.String(100), nullable=True),
            sa.Column("is_custom", sa.Boolean(), nullable=False),
            sa.Column("youtube_url", sa.String(500), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("exercise_type", sa.String(20), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], [f"{SCHEMA}.users.id"]),
            sa.PrimaryKeyConstraint("id"),
            schema=SCHEMA,
        )

    # 3. exercise_substitutions
    if not _table_exists("exercise_substitutions"):
        op.create_table(
            "exercise_substitutions",
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("exercise_id", sa.String(36), nullable=False),
            sa.Column("substitute_exercise_id", sa.String(36), nullable=False),
            sa.Column("priority", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["exercise_id"], [f"{SCHEMA}.exercises.id"]),
            sa.ForeignKeyConstraint(
                ["substitute_exercise_id"], [f"{SCHEMA}.exercises.id"]
            ),
            sa.PrimaryKeyConstraint("id"),
            schema=SCHEMA,
        )

    # 4. workout_templates
    if not _table_exists("workout_templates"):
        op.create_table(
            "workout_templates",
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("user_id", sa.String(36), nullable=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], [f"{SCHEMA}.users.id"]),
            sa.PrimaryKeyConstraint("id"),
            schema=SCHEMA,
        )

    # 5. template_exercises
    if not _table_exists("template_exercises"):
        op.create_table(
            "template_exercises",
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("template_id", sa.String(36), nullable=False),
            sa.Column("exercise_id", sa.String(36), nullable=False),
            sa.Column("week_type", sa.String(20), nullable=False),
            sa.Column("order", sa.Integer(), nullable=False),
            sa.Column("working_sets", sa.Integer(), nullable=False),
            sa.Column("min_reps", sa.Integer(), nullable=False),
            sa.Column("max_reps", sa.Integer(), nullable=False),
            sa.Column("early_set_rpe_min", sa.Numeric(3, 1), nullable=False),
            sa.Column("early_set_rpe_max", sa.Numeric(3, 1), nullable=False),
            sa.Column("last_set_rpe_min", sa.Numeric(3, 1), nullable=False),
            sa.Column("last_set_rpe_max", sa.Numeric(3, 1), nullable=False),
            sa.Column("rest_period", sa.String(50), nullable=False),
            sa.Column("intensity_technique", sa.String(200), nullable=True),
            sa.Column("warmup_sets", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(
                ["template_id"], [f"{SCHEMA}.workout_templates.id"]
            ),
            sa.ForeignKeyConstraint(["exercise_id"], [f"{SCHEMA}.exercises.id"]),
            sa.PrimaryKeyConstraint("id"),
            schema=SCHEMA,
        )

    # 6. programs
    if not _table_exists("programs"):
        op.create_table(
            "programs",
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("user_id", sa.String(36), nullable=True),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("program_type", sa.String(20), nullable=False),
            sa.Column("deload_every_n_weeks", sa.Integer(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], [f"{SCHEMA}.users.id"]),
            sa.PrimaryKeyConstraint("id"),
            schema=SCHEMA,
        )

    # 7. user_programs
    if not _table_exists("user_programs"):
        op.create_table(
            "user_programs",
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("user_id", sa.String(36), nullable=False),
            sa.Column("program_id", sa.String(36), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column("current_routine_index", sa.Integer(), nullable=False),
            sa.Column("current_phase_index", sa.Integer(), nullable=False),
            sa.Column("current_week_in_phase", sa.Integer(), nullable=False),
            sa.Column("current_day_index", sa.Integer(), nullable=False),
            sa.Column("weeks_completed", sa.Integer(), nullable=False),
            sa.Column("last_workout_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], [f"{SCHEMA}.users.id"]),
            sa.ForeignKeyConstraint(["program_id"], [f"{SCHEMA}.programs.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("user_id", "program_id", name="uq_user_program"),
            schema=SCHEMA,
        )

    # 8. program_routines
    if not _table_exists("program_routines"):
        op.create_table(
            "program_routines",
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("program_id", sa.String(36), nullable=False),
            sa.Column("template_id", sa.String(36), nullable=False),
            sa.Column("order", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(
                ["program_id"], [f"{SCHEMA}.programs.id"], ondelete="CASCADE"
            ),
            sa.ForeignKeyConstraint(
                ["template_id"], [f"{SCHEMA}.workout_templates.id"]
            ),
            sa.PrimaryKeyConstraint("id"),
            schema=SCHEMA,
        )

    # 9. program_phases
    if not _table_exists("program_phases"):
        op.create_table(
            "program_phases",
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("program_id", sa.String(36), nullable=False),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("order", sa.Integer(), nullable=False),
            sa.Column("duration_weeks", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(
                ["program_id"], [f"{SCHEMA}.programs.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
            schema=SCHEMA,
        )

    # 10. phase_workouts
    if not _table_exists("phase_workouts"):
        op.create_table(
            "phase_workouts",
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("phase_id", sa.String(36), nullable=False),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("day_index", sa.Integer(), nullable=False),
            sa.Column("week_number", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(
                ["phase_id"], [f"{SCHEMA}.program_phases.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
            schema=SCHEMA,
        )

    # 11. phase_workout_sections
    if not _table_exists("phase_workout_sections"):
        op.create_table(
            "phase_workout_sections",
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("workout_id", sa.String(36), nullable=False),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("order", sa.Integer(), nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(
                ["workout_id"], [f"{SCHEMA}.phase_workouts.id"], ondelete="CASCADE"
            ),
            sa.PrimaryKeyConstraint("id"),
            schema=SCHEMA,
        )

    # 12. phase_workout_exercises
    if not _table_exists("phase_workout_exercises"):
        op.create_table(
            "phase_workout_exercises",
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("section_id", sa.String(36), nullable=False),
            sa.Column("exercise_id", sa.String(36), nullable=False),
            sa.Column("order", sa.Integer(), nullable=False),
            sa.Column("working_sets", sa.Integer(), nullable=False),
            sa.Column("reps_display", sa.String(50), nullable=False),
            sa.Column("rest_period", sa.String(50), nullable=True),
            sa.Column("intensity_technique", sa.String(200), nullable=True),
            sa.Column("warmup_sets", sa.Integer(), nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("substitute1_exercise_id", sa.String(36), nullable=True),
            sa.Column("substitute2_exercise_id", sa.String(36), nullable=True),
            sa.ForeignKeyConstraint(
                ["section_id"],
                [f"{SCHEMA}.phase_workout_sections.id"],
                ondelete="CASCADE",
            ),
            sa.ForeignKeyConstraint(["exercise_id"], [f"{SCHEMA}.exercises.id"]),
            sa.ForeignKeyConstraint(
                ["substitute1_exercise_id"], [f"{SCHEMA}.exercises.id"]
            ),
            sa.ForeignKeyConstraint(
                ["substitute2_exercise_id"], [f"{SCHEMA}.exercises.id"]
            ),
            sa.PrimaryKeyConstraint("id"),
            schema=SCHEMA,
        )

    # 13. workout_sessions
    if not _table_exists("workout_sessions"):
        op.create_table(
            "workout_sessions",
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("user_id", sa.String(36), nullable=False),
            sa.Column("template_id", sa.String(36), nullable=True),
            sa.Column("program_id", sa.String(36), nullable=True),
            sa.Column("phase_workout_id", sa.String(36), nullable=True),
            sa.Column("user_program_id", sa.String(36), nullable=True),
            sa.Column("year_week", sa.String(10), nullable=True),
            sa.Column("week_type", sa.String(20), nullable=False),
            sa.Column("started_at", sa.DateTime(), nullable=False),
            sa.Column("finished_at", sa.DateTime(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("synced", sa.Boolean(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], [f"{SCHEMA}.users.id"]),
            sa.ForeignKeyConstraint(
                ["template_id"], [f"{SCHEMA}.workout_templates.id"]
            ),
            sa.ForeignKeyConstraint(["program_id"], [f"{SCHEMA}.programs.id"]),
            sa.ForeignKeyConstraint(
                ["phase_workout_id"], [f"{SCHEMA}.phase_workouts.id"]
            ),
            sa.ForeignKeyConstraint(
                ["user_program_id"], [f"{SCHEMA}.user_programs.id"]
            ),
            sa.PrimaryKeyConstraint("id"),
            schema=SCHEMA,
        )

    # 14. workout_sets
    if not _table_exists("workout_sets"):
        op.create_table(
            "workout_sets",
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("session_id", sa.String(36), nullable=False),
            sa.Column("exercise_id", sa.String(36), nullable=False),
            sa.Column("set_type", sa.String(20), nullable=False),
            sa.Column("set_number", sa.Integer(), nullable=False),
            sa.Column("reps", sa.Integer(), nullable=False),
            sa.Column("weight", sa.Numeric(7, 2), nullable=False),
            sa.Column("rpe", sa.Numeric(3, 1), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(
                ["session_id"], [f"{SCHEMA}.workout_sessions.id"]
            ),
            sa.ForeignKeyConstraint(["exercise_id"], [f"{SCHEMA}.exercises.id"]),
            sa.PrimaryKeyConstraint("id"),
            schema=SCHEMA,
        )

    # 15. exercise_progress
    if not _table_exists("exercise_progress"):
        op.create_table(
            "exercise_progress",
            sa.Column("id", sa.String(36), nullable=False),
            sa.Column("user_id", sa.String(36), nullable=False),
            sa.Column("exercise_id", sa.String(36), nullable=False),
            sa.Column("year_week", sa.String(10), nullable=False),
            sa.Column("max_weight", sa.Numeric(7, 2), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], [f"{SCHEMA}.users.id"]),
            sa.ForeignKeyConstraint(["exercise_id"], [f"{SCHEMA}.exercises.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "user_id", "exercise_id", "year_week", name="uq_progress"
            ),
            schema=SCHEMA,
        )


def downgrade() -> None:
    """Drop all tables in reverse dependency order."""
    op.drop_table("exercise_progress", schema=SCHEMA)
    op.drop_table("workout_sets", schema=SCHEMA)
    op.drop_table("workout_sessions", schema=SCHEMA)
    op.drop_table("phase_workout_exercises", schema=SCHEMA)
    op.drop_table("phase_workout_sections", schema=SCHEMA)
    op.drop_table("phase_workouts", schema=SCHEMA)
    op.drop_table("program_phases", schema=SCHEMA)
    op.drop_table("program_routines", schema=SCHEMA)
    op.drop_table("user_programs", schema=SCHEMA)
    op.drop_table("programs", schema=SCHEMA)
    op.drop_table("template_exercises", schema=SCHEMA)
    op.drop_table("workout_templates", schema=SCHEMA)
    op.drop_table("exercise_substitutions", schema=SCHEMA)
    op.drop_table("exercises", schema=SCHEMA)
    op.drop_table("users", schema=SCHEMA)
```

- [ ] **Step 2: Verify migration file is detected by Alembic**

Run from `backend/`:
```bash
cd backend && uv run alembic history
```
Expected output should show revision `0001` as head.

- [ ] **Step 3: Commit**

```bash
git add backend/alembic/versions/0001_initial_schema.py
git commit -m "feat: add idempotent initial migration for all 15 tables"
```

---

### Task 3: Test migration against fresh PostgreSQL

**Files:**
- No file changes — validation only

This task requires a running PostgreSQL instance. If a local PostgreSQL is available via Docker, use it. Otherwise, skip to Task 4 and rely on CI validation.

- [ ] **Step 1: Run migration against local database**

Ensure your local PostgreSQL is running and env vars are set, then run from `backend/`:
```bash
cd backend && uv run alembic upgrade head
```
Expected: Migration applies successfully, creates all 15 tables in the `gym` schema and the `alembic_version` tracking table.

- [ ] **Step 2: Verify migration is idempotent**

Run again:
```bash
cd backend && uv run alembic upgrade head
```
Expected: No errors, no changes applied (already at head).

- [ ] **Step 3: Verify current revision**

```bash
cd backend && uv run alembic current
```
Expected: Shows `0001 (head)`.

---

### Task 4: Remove `create_all()` from `main.py`

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Update `main.py` lifespan**

In `backend/app/main.py`, replace the lifespan function and update imports.

Remove from imports:
- `Base` and `engine` from the `app.database` import line

The import line changes from:
```python
from app.database import Base, async_session, engine, settings
```
to:
```python
from app.database import async_session, settings
```

Replace the lifespan function with:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        print("[LIFESPAN] Connecting to DB")
        async with async_session() as db:
            await seed_exercises(db)
            print("[LIFESPAN] Exercises seeded")
            await seed_default_program(db)
            print("[LIFESPAN] JN program seeded")
            await seed_minimalift_program(db)
            print("[LIFESPAN] Minimalift 3-Day program seeded")
            await seed_minimalift_5day_program(db)
            print("[LIFESPAN] Minimalift 5-Day program seeded")
    except Exception as e:
        print(f"[LIFESPAN] ERROR: {e}")
        raise
    yield
```

- [ ] **Step 2: Run existing tests to verify nothing broke**

Run from `backend/`:
```bash
cd backend && uv run python -m pytest tests/ -v
```
Expected: All existing tests pass. Tests use their own in-memory SQLite with `create_all()` in fixtures — they are unaffected by this change.

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "refactor: remove create_all() from lifespan, Alembic owns schema"
```

---

### Task 5: Add migration validation job to CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add `migrate` job to `ci.yml`**

Add the following job after the existing `backend-test` job in `.github/workflows/ci.yml`:

```yaml
  migrate:
    name: Validate Migrations
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: uv pip install --system -r requirements.txt
      - name: Run migrations against fresh DB
        env:
          DATABASE_URL: postgresql+asyncpg://test:test@localhost:5432/testdb?ssl=disable
          JWT_SECRET: test-secret-for-ci
        run: alembic upgrade head
```

No `DB_SCHEMA` env var needed — it is hardcoded as a module constant in `database.py`.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add migration validation job with PostgreSQL service"
```

---

### Task 6: Create standalone `migrate.yml` workflow

**Files:**
- Create: `.github/workflows/migrate.yml`

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/migrate.yml`:

```yaml
name: Migrate

on:
  workflow_call:
    inputs:
      environment:
        description: "Target environment"
        required: true
        type: string
  workflow_dispatch:
    inputs:
      environment:
        description: "Target environment"
        required: true
        default: "dev"
        type: choice
        options:
          - dev
          - prod

jobs:
  migrate:
    name: Run Database Migrations
    runs-on: [self-hosted, synology]
    environment: ${{ inputs.environment }}
    env:
      ENV: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4

      - name: Create .env file
        run: |
          cat <<EOF > .env
          DATABASE_URL=postgresql+asyncpg://${{ vars.POSTGRES_USER }}:${{ secrets.POSTGRES_PASSWORD }}@postgres_shared:5432/${{ vars.POSTGRES_DB }}?ssl=disable
          JWT_SECRET=${{ secrets.JWT_SECRET }}
          CORS_ORIGINS=${{ vars.CORS_ORIGINS }}
          EOF

      - name: Build backend image
        run: docker build -t gym-backend-migrate ./backend

      - name: Run alembic upgrade head
        run: |
          docker run --rm \
            --env-file .env \
            --network postgres_infra_network \
            gym-backend-migrate \
            alembic upgrade head

      - name: Cleanup .env
        if: always()
        run: rm -f .env
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/migrate.yml
git commit -m "ci: add standalone migrate workflow for deployment"
```

---

### Task 7: Update `deploy.yml` to run migrations before deploying

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Add migrate step to deploy pipeline**

Replace the contents of `.github/workflows/deploy.yml` with:

```yaml
name: Deploy

on:
  push:
    branches: [main, dev]
  workflow_dispatch:
    inputs:
      environment:
        description: "Target environment"
        required: true
        default: "dev"
        type: choice
        options:
          - dev
          - prod

jobs:
  ci:
    uses: ./.github/workflows/ci.yml

  migrate:
    needs: ci
    uses: ./.github/workflows/migrate.yml
    with:
      environment: ${{ inputs.environment || (github.ref == 'refs/heads/main' && 'prod' || 'dev') }}
    secrets: inherit

  deploy:
    name: Deploy to Synology
    needs: [ci, migrate]
    runs-on: [self-hosted, synology]
    environment: ${{ inputs.environment || (github.ref == 'refs/heads/main' && 'prod' || 'dev') }}
    env:
      ENV: ${{ inputs.environment || (github.ref == 'refs/heads/main' && 'prod' || 'dev') }}
      APP_PORT: ${{ github.ref == 'refs/heads/main' && '3080' || '3084' }}
      SUBNET: ${{ github.ref == 'refs/heads/main' && '172.27.0.0/16' || '172.22.0.0/16' }}
      GATEWAY: ${{ github.ref == 'refs/heads/main' && '172.27.0.1' || '172.22.0.1' }}
    steps:
      - uses: actions/checkout@v4

      - name: Create .env file
        run: |
          cat <<EOF > .env
          ENV=${ENV}
          APP_PORT=${APP_PORT}
          SUBNET=${SUBNET}
          GATEWAY=${GATEWAY}
          POSTGRES_USER=${{ vars.POSTGRES_USER }}
          POSTGRES_PASSWORD=${{ secrets.POSTGRES_PASSWORD }}
          POSTGRES_DB=${{ vars.POSTGRES_DB }}
          JWT_SECRET=${{ secrets.JWT_SECRET }}
          CORS_ORIGINS=${{ vars.CORS_ORIGINS }}
          EOF

      - name: Deploy with docker compose
        run: |
          docker compose -p gym-${ENV} down
          docker compose -p gym-${ENV} up --build -d

      - name: Cleanup .env
        if: always()
        run: rm -f .env
```

Key changes:
- Added `workflow_dispatch` with environment input
- Added `migrate` job between `ci` and `deploy`
- `deploy` now `needs: [ci, migrate]`
- Environment selection supports both push triggers and manual dispatch

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add migrate step to deploy pipeline (CI -> Migrate -> Deploy)"
```

---

### Task 8: Final verification

**Files:**
- No file changes — validation only

- [ ] **Step 1: Run all existing tests**

```bash
cd backend && uv run python -m pytest tests/ -v
```
Expected: All tests pass.

- [ ] **Step 2: Verify Alembic history**

```bash
cd backend && uv run alembic history
```
Expected: Shows `0001 -> (head), initial schema - all tables`

- [ ] **Step 3: Verify no autogenerate drift**

If a local PostgreSQL is available and migration has been applied:
```bash
cd backend && uv run alembic check
```
Expected: No new changes detected (models match migration).

- [ ] **Step 4: Review all changes**

```bash
git log --oneline
```
Expected commits (most recent first):
- `ci: add migrate step to deploy pipeline (CI -> Migrate -> Deploy)`
- `ci: add standalone migrate workflow for deployment`
- `ci: add migration validation job with PostgreSQL service`
- `refactor: remove create_all() from lifespan, Alembic owns schema`
- `feat: add idempotent initial migration for all 15 tables`
- `fix: update alembic env.py for schema-awareness and correct URL`
