"""shared programs and user_programs enrollment table

Revision ID: d5e6f7g8h9i0
Revises: c4d5e6f7g8h9
Create Date: 2026-03-08 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d5e6f7g8h9i0"
down_revision: Union[str, None] = "c4d5e6f7g8h9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create user_programs table if it doesn't exist
    #    (Base.metadata.create_all may have already created it)
    conn = op.get_bind()
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.tables "
            "WHERE table_name = 'user_programs' "
            "AND table_schema = current_schema()"
        )
    )
    if result.fetchone() is None:
        op.create_table(
            "user_programs",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column(
                "user_id",
                sa.String(36),
                sa.ForeignKey("users.id"),
                nullable=False,
            ),
            sa.Column(
                "program_id",
                sa.String(36),
                sa.ForeignKey("programs.id"),
                nullable=False,
            ),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("started_at", sa.DateTime(), nullable=True),
            sa.Column(
                "current_routine_index",
                sa.Integer(),
                nullable=False,
                server_default="0",
            ),
            sa.Column(
                "current_phase_index",
                sa.Integer(),
                nullable=False,
                server_default="0",
            ),
            sa.Column(
                "current_week_in_phase",
                sa.Integer(),
                nullable=False,
                server_default="0",
            ),
            sa.Column(
                "current_day_index", sa.Integer(), nullable=False, server_default="0"
            ),
            sa.Column(
                "weeks_completed", sa.Integer(), nullable=False, server_default="0"
            ),
            sa.Column("last_workout_at", sa.DateTime(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.func.now(),
            ),
            sa.UniqueConstraint("user_id", "program_id", name="uq_user_program"),
        )

    # 2. Make programs.user_id nullable (NULL = shared blueprint)
    op.alter_column(
        "programs",
        "user_id",
        existing_type=sa.String(36),
        nullable=True,
    )

    # 3. Make workout_templates.user_id nullable (NULL = shared template)
    op.alter_column(
        "workout_templates",
        "user_id",
        existing_type=sa.String(36),
        nullable=True,
    )

    # 4. Add user_program_id FK to workout_sessions (if not already present)
    col_check = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = 'workout_sessions' "
            "AND column_name = 'user_program_id' "
            "AND table_schema = current_schema()"
        )
    )
    if col_check.fetchone() is None:
        op.add_column(
            "workout_sessions",
            sa.Column(
                "user_program_id",
                sa.String(36),
                sa.ForeignKey("user_programs.id"),
                nullable=True,
            ),
        )

    # 5. Migrate existing per-user program progress into user_programs enrollments
    rows = conn.execute(
        sa.text(
            "SELECT id, user_id, is_active, started_at, "
            "current_routine_index, current_phase_index, "
            "current_week_in_phase, current_day_index, "
            "weeks_completed, last_workout_at, created_at "
            "FROM programs WHERE user_id IS NOT NULL"
        )
    ).fetchall()

    for row in rows:
        # Generate a deterministic enrollment id from (user_id, program_id)
        import uuid

        enrollment_id = str(
            uuid.uuid5(uuid.NAMESPACE_URL, f"enrollment:{row[1]}:{row[0]}")
        )
        conn.execute(
            sa.text(
                "INSERT INTO user_programs "
                "(id, user_id, program_id, is_active, started_at, "
                "current_routine_index, current_phase_index, "
                "current_week_in_phase, current_day_index, "
                "weeks_completed, last_workout_at, created_at) "
                "VALUES (:id, :user_id, :program_id, :is_active, :started_at, "
                ":current_routine_index, :current_phase_index, "
                ":current_week_in_phase, :current_day_index, "
                ":weeks_completed, :last_workout_at, :created_at)"
            ),
            {
                "id": enrollment_id,
                "user_id": row[1],
                "program_id": row[0],
                "is_active": row[2],
                "started_at": row[3],
                "current_routine_index": row[4],
                "current_phase_index": row[5],
                "current_week_in_phase": row[6],
                "current_day_index": row[7],
                "weeks_completed": row[8],
                "last_workout_at": row[9],
                "created_at": row[10],
            },
        )

        # Link existing sessions to the enrollment
        conn.execute(
            sa.text(
                "UPDATE workout_sessions SET user_program_id = :up_id "
                "WHERE program_id = :prog_id AND user_id = :user_id"
            ),
            {"up_id": enrollment_id, "prog_id": row[0], "user_id": row[1]},
        )

    # 6. Drop old progress columns from programs
    op.drop_column("programs", "is_active")
    op.drop_column("programs", "started_at")
    op.drop_column("programs", "current_routine_index")
    op.drop_column("programs", "current_phase_index")
    op.drop_column("programs", "current_week_in_phase")
    op.drop_column("programs", "current_day_index")
    op.drop_column("programs", "weeks_completed")
    op.drop_column("programs", "last_workout_at")


def downgrade() -> None:
    raise NotImplementedError(
        "Downgrade not supported for shared programs migration"
    )
