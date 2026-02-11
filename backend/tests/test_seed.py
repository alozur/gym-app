"""Tests for exercise seeding logic."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Exercise, ExerciseSubstitution
from app.seed import seed_exercises


@pytest.mark.asyncio
async def test_seed_populates_exercises(db_session: AsyncSession):
    await seed_exercises(db_session)

    result = await db_session.execute(select(Exercise).where(Exercise.user_id.is_(None)))
    exercises = result.scalars().all()

    assert len(exercises) == 19

    names = {e.name for e in exercises}
    assert "Lying Leg Curl" in names
    assert "Bench Press" in names
    assert "Squat" in names
    assert "Deadlift" in names
    assert "Overhead Press" in names
    assert "Barbell Row" in names
    assert "Barbell Curl" in names


@pytest.mark.asyncio
async def test_seed_creates_substitutions(db_session: AsyncSession):
    await seed_exercises(db_session)

    # Get Lying Leg Curl with substitutions
    result = await db_session.execute(
        select(Exercise)
        .where(Exercise.name == "Lying Leg Curl")
        .options(
            selectinload(Exercise.substitutions).selectinload(
                ExerciseSubstitution.substitute_exercise
            )
        )
    )
    lying_leg_curl = result.scalar_one()

    assert len(lying_leg_curl.substitutions) == 2

    sub_names = {
        s.substitute_exercise.name for s in lying_leg_curl.substitutions
    }
    assert "Seated Leg Curl" in sub_names
    assert "Nordic Ham Curl" in sub_names


@pytest.mark.asyncio
async def test_seed_is_idempotent(db_session: AsyncSession):
    """Running seed twice should not duplicate exercises."""
    await seed_exercises(db_session)
    await seed_exercises(db_session)

    result = await db_session.execute(select(Exercise).where(Exercise.user_id.is_(None)))
    exercises = result.scalars().all()
    assert len(exercises) == 19
