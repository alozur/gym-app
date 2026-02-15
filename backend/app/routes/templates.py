"""Workout template CRUD routes with exercise prescriptions."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models import TemplateExercise, WorkoutTemplate, User
from app.schemas import (
    MessageResponse,
    TemplateCreate,
    TemplateDetailResponse,
    TemplateResponse,
)

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("/", response_model=list[TemplateResponse])
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[WorkoutTemplate]:
    """List the current user's workout templates."""
    result = await db.execute(
        select(WorkoutTemplate)
        .where(WorkoutTemplate.user_id == current_user.id)
        .order_by(WorkoutTemplate.created_at.desc())
    )
    return list(result.scalars().all())


@router.post(
    "/", response_model=TemplateDetailResponse, status_code=status.HTTP_201_CREATED
)
async def create_template(
    body: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkoutTemplate:
    """Create a workout template with exercise prescriptions for normal and deload weeks."""
    kwargs: dict = dict(user_id=current_user.id, name=body.name)
    if body.id:
        kwargs["id"] = body.id
    template = WorkoutTemplate(**kwargs)
    db.add(template)
    await db.flush()

    for te in body.template_exercises:
        tekw: dict = dict(
            template_id=template.id,
            exercise_id=te.exercise_id,
            week_type=te.week_type,
            order=te.order,
            working_sets=te.working_sets,
            min_reps=te.min_reps,
            max_reps=te.max_reps,
            early_set_rpe_min=te.early_set_rpe_min,
            early_set_rpe_max=te.early_set_rpe_max,
            last_set_rpe_min=te.last_set_rpe_min,
            last_set_rpe_max=te.last_set_rpe_max,
            rest_period=te.rest_period,
            intensity_technique=te.intensity_technique,
            warmup_sets=te.warmup_sets,
        )
        if te.id:
            tekw["id"] = te.id
        template_exercise = TemplateExercise(**tekw)
        db.add(template_exercise)

    await db.commit()
    # Reload with relationships
    result = await db.execute(
        select(WorkoutTemplate)
        .where(WorkoutTemplate.id == template.id)
        .options(
            selectinload(WorkoutTemplate.template_exercises).selectinload(
                TemplateExercise.exercise
            )
        )
    )
    return result.scalar_one()


@router.get("/{template_id}", response_model=TemplateDetailResponse)
async def get_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkoutTemplate:
    """Get a template with all exercise prescriptions grouped by week type."""
    result = await db.execute(
        select(WorkoutTemplate)
        .where(
            WorkoutTemplate.id == template_id,
            WorkoutTemplate.user_id == current_user.id,
        )
        .options(
            selectinload(WorkoutTemplate.template_exercises).selectinload(
                TemplateExercise.exercise
            )
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )
    return template


@router.put("/{template_id}", response_model=TemplateDetailResponse)
async def update_template(
    template_id: str,
    body: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkoutTemplate:
    """Update a template, replacing all exercise prescriptions."""
    result = await db.execute(
        select(WorkoutTemplate)
        .where(
            WorkoutTemplate.id == template_id,
            WorkoutTemplate.user_id == current_user.id,
        )
        .options(selectinload(WorkoutTemplate.template_exercises))
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    template.name = body.name

    # Delete existing template exercises (cascade handles this via ORM)
    template.template_exercises.clear()
    await db.flush()

    # Add new template exercises
    for te in body.template_exercises:
        template_exercise = TemplateExercise(
            template_id=template.id,
            exercise_id=te.exercise_id,
            week_type=te.week_type,
            order=te.order,
            working_sets=te.working_sets,
            min_reps=te.min_reps,
            max_reps=te.max_reps,
            early_set_rpe_min=te.early_set_rpe_min,
            early_set_rpe_max=te.early_set_rpe_max,
            last_set_rpe_min=te.last_set_rpe_min,
            last_set_rpe_max=te.last_set_rpe_max,
            rest_period=te.rest_period,
            intensity_technique=te.intensity_technique,
            warmup_sets=te.warmup_sets,
        )
        db.add(template_exercise)

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(WorkoutTemplate)
        .where(WorkoutTemplate.id == template.id)
        .options(
            selectinload(WorkoutTemplate.template_exercises).selectinload(
                TemplateExercise.exercise
            )
        )
    )
    return result.scalar_one()


@router.delete("/{template_id}", response_model=MessageResponse)
async def delete_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Delete a template and all its exercise prescriptions."""
    result = await db.execute(
        select(WorkoutTemplate).where(
            WorkoutTemplate.id == template_id,
            WorkoutTemplate.user_id == current_user.id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Template not found"
        )

    await db.delete(template)
    await db.commit()
    return {"message": "Template deleted successfully"}
