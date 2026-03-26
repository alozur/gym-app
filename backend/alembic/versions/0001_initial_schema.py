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
