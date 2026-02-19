"""Exercise CRUD routes with substitution management."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models import Exercise, ExerciseSubstitution, User
from app.schemas import (
    ExerciseCreate,
    ExerciseResponse,
    SubstitutionCreate,
    SubstitutionResponse,
)

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


@router.get("", response_model=list[ExerciseResponse])
async def list_exercises(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Exercise]:
    """List all pre-seeded exercises and the current user's custom exercises."""
    result = await db.execute(
        select(Exercise)
        .where(
            or_(
                Exercise.user_id.is_(None),
                Exercise.user_id == current_user.id,
            )
        )
        .options(
            selectinload(Exercise.substitutions).selectinload(
                ExerciseSubstitution.substitute_exercise
            )
        )
        .order_by(Exercise.name)
    )
    return list(result.scalars().all())


@router.post(
    "", response_model=ExerciseResponse, status_code=status.HTTP_201_CREATED
)
async def create_exercise(
    body: ExerciseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Exercise:
    """Create a custom exercise for the current user."""
    exercise = Exercise(
        user_id=current_user.id,
        name=body.name,
        muscle_group=body.muscle_group,
        equipment=body.equipment,
        is_custom=True,
        youtube_url=body.youtube_url,
        notes=body.notes,
    )
    db.add(exercise)
    await db.commit()
    await db.refresh(exercise, attribute_names=["substitutions"])
    return exercise


@router.get("/{exercise_id}", response_model=ExerciseResponse)
async def get_exercise(
    exercise_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Exercise:
    """Get exercise detail with substitutions."""
    result = await db.execute(
        select(Exercise)
        .where(Exercise.id == exercise_id)
        .options(
            selectinload(Exercise.substitutions).selectinload(
                ExerciseSubstitution.substitute_exercise
            )
        )
    )
    exercise = result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found"
        )
    # Only allow access to pre-seeded or own exercises
    if exercise.user_id is not None and exercise.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to view this exercise",
        )
    return exercise


@router.put("/{exercise_id}", response_model=ExerciseResponse)
async def update_exercise(
    exercise_id: str,
    body: ExerciseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Exercise:
    """Update an exercise. Only the owner can update custom exercises."""
    result = await db.execute(
        select(Exercise)
        .where(Exercise.id == exercise_id)
        .options(
            selectinload(Exercise.substitutions).selectinload(
                ExerciseSubstitution.substitute_exercise
            )
        )
    )
    exercise = result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found"
        )
    if exercise.user_id is not None and exercise.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to update this exercise",
        )

    exercise.name = body.name
    exercise.muscle_group = body.muscle_group
    exercise.equipment = body.equipment
    exercise.youtube_url = body.youtube_url
    exercise.notes = body.notes
    await db.commit()
    await db.refresh(exercise)
    return exercise


@router.post(
    "/{exercise_id}/substitutions",
    response_model=SubstitutionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_substitution(
    exercise_id: str,
    body: SubstitutionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ExerciseSubstitution:
    """Add a substitution exercise with priority."""
    # Verify both exercises exist and are accessible
    result = await db.execute(
        select(Exercise).where(Exercise.id == exercise_id)
    )
    exercise = result.scalar_one_or_none()
    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found"
        )

    result = await db.execute(
        select(Exercise).where(Exercise.id == body.substitute_exercise_id)
    )
    substitute = result.scalar_one_or_none()
    if not substitute:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Substitute exercise not found",
        )

    substitution = ExerciseSubstitution(
        exercise_id=exercise_id,
        substitute_exercise_id=body.substitute_exercise_id,
        priority=body.priority,
    )
    db.add(substitution)
    await db.commit()
    await db.refresh(substitution, attribute_names=["substitute_exercise"])
    return substitution
