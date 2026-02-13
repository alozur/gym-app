"""replace warmup min_max with single warmup_sets

Revision ID: a2b3c4d5e6f7
Revises: 1426e081e683
Create Date: 2026-02-13 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, None] = '1426e081e683'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add warmup_sets column with default 2
    op.add_column(
        'template_exercises',
        sa.Column('warmup_sets', sa.Integer(), nullable=False, server_default='2'),
    )

    # Populate from max_warmup_sets
    op.execute(
        "UPDATE template_exercises SET warmup_sets = max_warmup_sets"
    )

    # Remove server default after populating
    op.alter_column('template_exercises', 'warmup_sets', server_default=None)

    # Drop old columns
    op.drop_column('template_exercises', 'min_warmup_sets')
    op.drop_column('template_exercises', 'max_warmup_sets')

    # Drop warmup fields from exercise_progress
    op.drop_column('exercise_progress', 'warmup_weight_range')
    op.drop_column('exercise_progress', 'warmup_sets_done')


def downgrade() -> None:
    # Re-add warmup fields to exercise_progress
    op.add_column(
        'exercise_progress',
        sa.Column('warmup_sets_done', sa.Integer(), nullable=True),
    )
    op.add_column(
        'exercise_progress',
        sa.Column('warmup_weight_range', sa.String(length=50), nullable=True),
    )

    # Re-add min/max warmup columns to template_exercises
    op.add_column(
        'template_exercises',
        sa.Column('max_warmup_sets', sa.Integer(), nullable=False, server_default='2'),
    )
    op.add_column(
        'template_exercises',
        sa.Column('min_warmup_sets', sa.Integer(), nullable=False, server_default='1'),
    )

    # Populate from warmup_sets
    op.execute(
        "UPDATE template_exercises SET max_warmup_sets = warmup_sets, min_warmup_sets = warmup_sets"
    )

    # Drop warmup_sets
    op.drop_column('template_exercises', 'warmup_sets')
