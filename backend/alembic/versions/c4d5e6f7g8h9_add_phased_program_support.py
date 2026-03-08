"""add phased program support

Revision ID: c4d5e6f7g8h9
Revises: b3c4d5e6f7g8
Create Date: 2026-03-07 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c4d5e6f7g8h9'
down_revision: Union[str, None] = 'b3c4d5e6f7g8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to programs
    op.add_column(
        'programs',
        sa.Column('program_type', sa.String(20), nullable=False, server_default='rotating'),
    )
    op.alter_column('programs', 'program_type', server_default=None)

    op.add_column(
        'programs',
        sa.Column('current_phase_index', sa.Integer(), nullable=False, server_default='0'),
    )
    op.alter_column('programs', 'current_phase_index', server_default=None)

    op.add_column(
        'programs',
        sa.Column('current_week_in_phase', sa.Integer(), nullable=False, server_default='0'),
    )
    op.alter_column('programs', 'current_week_in_phase', server_default=None)

    op.add_column(
        'programs',
        sa.Column('current_day_index', sa.Integer(), nullable=False, server_default='0'),
    )
    op.alter_column('programs', 'current_day_index', server_default=None)

    # Create program_phases table
    op.create_table(
        'program_phases',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('program_id', sa.String(36), sa.ForeignKey('programs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('duration_weeks', sa.Integer(), nullable=False),
    )

    # Create phase_workouts table
    op.create_table(
        'phase_workouts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('phase_id', sa.String(36), sa.ForeignKey('program_phases.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('day_index', sa.Integer(), nullable=False),
        sa.Column('week_number', sa.Integer(), nullable=False),
    )

    # Add phase_workout_id to workout_sessions
    op.add_column(
        'workout_sessions',
        sa.Column('phase_workout_id', sa.String(36), sa.ForeignKey('phase_workouts.id'), nullable=True),
    )

    # Create phase_workout_sections table
    op.create_table(
        'phase_workout_sections',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('workout_id', sa.String(36), sa.ForeignKey('phase_workouts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
    )

    # Create phase_workout_exercises table
    op.create_table(
        'phase_workout_exercises',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('section_id', sa.String(36), sa.ForeignKey('phase_workout_sections.id', ondelete='CASCADE'), nullable=False),
        sa.Column('exercise_id', sa.String(36), sa.ForeignKey('exercises.id'), nullable=False),
        sa.Column('order', sa.Integer(), nullable=False),
        sa.Column('working_sets', sa.Integer(), nullable=False),
        sa.Column('reps_display', sa.String(50), nullable=False),
        sa.Column('rest_period', sa.String(50), nullable=True),
        sa.Column('intensity_technique', sa.String(200), nullable=True),
        sa.Column('warmup_sets', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('substitute1_exercise_id', sa.String(36), sa.ForeignKey('exercises.id'), nullable=True),
        sa.Column('substitute2_exercise_id', sa.String(36), sa.ForeignKey('exercises.id'), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('phase_workout_exercises')
    op.drop_table('phase_workout_sections')
    op.drop_column('workout_sessions', 'phase_workout_id')
    op.drop_table('phase_workouts')
    op.drop_table('program_phases')
    op.drop_column('programs', 'current_day_index')
    op.drop_column('programs', 'current_week_in_phase')
    op.drop_column('programs', 'current_phase_index')
    op.drop_column('programs', 'program_type')
