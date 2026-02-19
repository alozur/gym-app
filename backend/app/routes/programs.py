"""Program CRUD routes with routine rotation and deload logic."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models import (
    Program,
    ProgramRoutine,
    TemplateExercise,
    User,
    WorkoutTemplate,
)
from app.schemas import (
    MessageResponse,
    ProgramCreate,
    ProgramDetailResponse,
    ProgramResponse,
    ProgramRoutineResponse,
    TemplateExerciseResponse,
    TodayResponse,
)

router = APIRouter(prefix="/api/programs", tags=["programs"])


@router.get("", response_model=list[ProgramResponse])
async def list_programs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Program]:
    """List the current user's programs."""
    result = await db.execute(
        select(Program)
        .where(Program.user_id == current_user.id)
        .options(selectinload(Program.routines))
        .order_by(Program.created_at.desc())
    )
    return list(result.scalars().all())


@router.post(
    "", response_model=ProgramDetailResponse, status_code=status.HTTP_201_CREATED
)
async def create_program(
    body: ProgramCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Program:
    """Create a program with routines referencing templates."""
    kwargs: dict = dict(
        user_id=current_user.id,
        name=body.name,
        deload_every_n_weeks=body.deload_every_n_weeks,
    )
    if body.id:
        kwargs["id"] = body.id
    program = Program(**kwargs)
    db.add(program)
    await db.flush()

    for r in body.routines:
        rkw: dict = dict(
            program_id=program.id,
            template_id=r.template_id,
            order=r.order,
        )
        if r.id:
            rkw["id"] = r.id
        routine = ProgramRoutine(**rkw)
        db.add(routine)

    await db.commit()

    result = await db.execute(
        select(Program)
        .where(Program.id == program.id)
        .options(
            selectinload(Program.routines).selectinload(ProgramRoutine.template)
        )
    )
    return result.scalar_one()


@router.get("/today", response_model=TodayResponse)
async def get_today(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get today's workout data from the active program."""
    result = await db.execute(
        select(Program)
        .where(
            Program.user_id == current_user.id,
            Program.is_active == True,  # noqa: E712
        )
        .options(
            selectinload(Program.routines).selectinload(ProgramRoutine.template)
        )
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active program found",
        )

    if not program.routines:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Active program has no routines",
        )

    # Determine deload
    is_deload = (program.weeks_completed % program.deload_every_n_weeks) == (
        program.deload_every_n_weeks - 1
    )
    week_type = "deload" if is_deload else "normal"

    # Current routine
    idx = program.current_routine_index % len(program.routines)
    current_routine = program.routines[idx]

    # Load template exercises for the week_type
    te_result = await db.execute(
        select(TemplateExercise)
        .where(
            TemplateExercise.template_id == current_routine.template_id,
            TemplateExercise.week_type == week_type,
        )
        .order_by(TemplateExercise.order)
    )
    template_exercises = list(te_result.scalars().all())

    # Next routine name
    next_idx = (idx + 1) % len(program.routines)
    next_routine_name = program.routines[next_idx].template.name

    return {
        "program": program,
        "current_routine": current_routine,
        "template_name": current_routine.template.name,
        "template_exercises": template_exercises,
        "week_type": week_type,
        "week_number": program.weeks_completed + 1,
        "is_deload": is_deload,
        "next_routine_name": next_routine_name,
    }


@router.get("/{program_id}", response_model=ProgramDetailResponse)
async def get_program(
    program_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Program:
    """Get program detail with routines."""
    result = await db.execute(
        select(Program)
        .where(
            Program.id == program_id,
            Program.user_id == current_user.id,
        )
        .options(
            selectinload(Program.routines).selectinload(ProgramRoutine.template)
        )
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Program not found"
        )
    return program


@router.put("/{program_id}", response_model=ProgramDetailResponse)
async def update_program(
    program_id: str,
    body: ProgramCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Program:
    """Update a program, replacing all routines."""
    result = await db.execute(
        select(Program)
        .where(
            Program.id == program_id,
            Program.user_id == current_user.id,
        )
        .options(selectinload(Program.routines))
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Program not found"
        )

    program.name = body.name
    program.deload_every_n_weeks = body.deload_every_n_weeks

    # Replace routines: clear old, add new via relationship
    program.routines.clear()
    for r in body.routines:
        program.routines.append(
            ProgramRoutine(
                program_id=program.id,
                template_id=r.template_id,
                order=r.order,
            )
        )

    await db.commit()

    result = await db.execute(
        select(Program)
        .where(Program.id == program.id)
        .options(
            selectinload(Program.routines).selectinload(ProgramRoutine.template)
        )
    )
    return result.scalar_one()


@router.delete("/{program_id}", response_model=MessageResponse)
async def delete_program(
    program_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Delete a program and all its routines."""
    result = await db.execute(
        select(Program).where(
            Program.id == program_id,
            Program.user_id == current_user.id,
        )
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Program not found"
        )

    await db.delete(program)
    await db.commit()
    return {"message": "Program deleted successfully"}


@router.post("/{program_id}/activate", response_model=ProgramResponse)
async def activate_program(
    program_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Program:
    """Set a program as active, deactivating all others."""
    result = await db.execute(
        select(Program).where(
            Program.id == program_id,
            Program.user_id == current_user.id,
        )
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Program not found"
        )

    # Deactivate all user programs
    await db.execute(
        update(Program)
        .where(Program.user_id == current_user.id)
        .values(is_active=False)
    )

    # Activate this one and reset counters
    program.is_active = True
    program.started_at = datetime.utcnow()
    program.current_routine_index = 0
    program.weeks_completed = 0
    program.last_workout_at = None

    await db.commit()

    # Reload with routines for routine_count
    result = await db.execute(
        select(Program)
        .where(Program.id == program.id)
        .options(selectinload(Program.routines))
    )
    return result.scalar_one()


@router.post("/{program_id}/deactivate", response_model=ProgramResponse)
async def deactivate_program(
    program_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Program:
    """Deactivate a program."""
    result = await db.execute(
        select(Program).where(
            Program.id == program_id,
            Program.user_id == current_user.id,
        )
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Program not found"
        )

    program.is_active = False
    await db.commit()

    # Reload with routines for routine_count
    result = await db.execute(
        select(Program)
        .where(Program.id == program.id)
        .options(selectinload(Program.routines))
    )
    return result.scalar_one()
