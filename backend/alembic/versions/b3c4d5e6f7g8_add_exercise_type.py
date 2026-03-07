"""add exercise_type to exercises

Revision ID: b3c4d5e6f7g8
Revises: a2b3c4d5e6f7
Create Date: 2026-03-07 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.database import settings

# revision identifiers, used by Alembic.
revision: str = 'b3c4d5e6f7g8'
down_revision: Union[str, None] = 'a2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

schema = settings.DB_SCHEMA


def upgrade() -> None:
    op.add_column(
        'exercises',
        sa.Column('exercise_type', sa.String(20), nullable=False, server_default='reps'),
        schema=schema,
    )
    op.alter_column('exercises', 'exercise_type', server_default=None, schema=schema)


def downgrade() -> None:
    op.drop_column('exercises', 'exercise_type', schema=schema)
