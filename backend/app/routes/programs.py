"""Program CRUD routes with UserProgram enrollment and progress tracking."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models import (
    PhaseWorkout,
    PhaseWorkoutExercise,
    PhaseWorkoutSection,
    Program,
    ProgramPhase,
    ProgramRoutine,
    TemplateExercise,
    User,
    UserProgram,
)
from app.schemas import (
    MessageResponse,
    PhasedTodayResponse,
    ProgramCreate,
    ProgramDetailResponse,
    ProgramPhaseDetailResponse,
    ProgramResponse,
    ProgramRoutineResponse,
    TemplateExerciseResponse,
    TodayResponse,
    UserProgramResponse,
)

router = APIRouter(prefix="/api/programs", tags=["programs"])


# ---------------------------------------------------------------------------
# UserProgram endpoints
# ---------------------------------------------------------------------------


@router.get("/enrollments", response_model=list[UserProgramResponse])
async def list_enrollments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[UserProgram]:
    """List the current user's program enrollments with progress."""
    result = await db.execute(
        select(UserProgram)
        .where(UserProgram.user_id == current_user.id)
        .options(selectinload(UserProgram.program))
        .order_by(UserProgram.created_at.desc())
    )
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Program blueprint endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=list[ProgramResponse])
async def list_programs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Program]:
    """List shared programs and user's custom programs."""
    result = await db.execute(
        select(Program)
        .where((Program.user_id.is_(None)) | (Program.user_id == current_user.id))
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
    """Create a custom program with routines and auto-enroll."""
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

    # Auto-enroll the user
    enrollment = UserProgram(
        user_id=current_user.id,
        program_id=program.id,
    )
    db.add(enrollment)

    await db.commit()

    result = await db.execute(
        select(Program)
        .where(Program.id == program.id)
        .options(selectinload(Program.routines).selectinload(ProgramRoutine.template))
    )
    return result.scalar_one()


@router.get("/today", response_model=None)
async def get_today(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TodayResponse | PhasedTodayResponse:
    """Get today's workout data from the active user program."""
    result = await db.execute(
        select(UserProgram)
        .where(
            UserProgram.user_id == current_user.id,
            UserProgram.is_active == True,  # noqa: E712
        )
        .options(
            selectinload(UserProgram.program)
            .selectinload(Program.routines)
            .selectinload(ProgramRoutine.template),
            selectinload(UserProgram.program).selectinload(Program.phases),
        )
    )
    user_program = result.scalar_one_or_none()
    if not user_program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active program found",
        )

    program = user_program.program

    if program.program_type == "phased":
        return await _get_phased_today(db, program, user_program)

    # --- Rotating program logic ---
    if not program.routines:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Active program has no routines",
        )

    # Determine deload
    is_deload = (user_program.weeks_completed % program.deload_every_n_weeks) == (
        program.deload_every_n_weeks - 1
    )
    week_type = "deload" if is_deload else "normal"

    # Current routine
    idx = user_program.current_routine_index % len(program.routines)
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

    return TodayResponse(
        program=ProgramResponse.model_validate(program),
        user_program=UserProgramResponse.model_validate(user_program),
        current_routine=ProgramRoutineResponse.model_validate(current_routine),
        template_name=current_routine.template.name,
        template_exercises=[
            TemplateExerciseResponse.model_validate(te) for te in template_exercises
        ],
        week_type=week_type,
        week_number=user_program.weeks_completed + 1,
        is_deload=is_deload,
        next_routine_name=next_routine_name,
    )


async def _get_phased_today(
    db: AsyncSession, program: Program, user_program: UserProgram
) -> PhasedTodayResponse:
    """Build the phased today response."""
    if not program.phases:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phased program has no phases",
        )

    phase_idx = user_program.current_phase_index % len(program.phases)
    current_phase = program.phases[phase_idx]

    days_result = await db.execute(
        select(PhaseWorkout.day_index)
        .where(PhaseWorkout.phase_id == current_phase.id)
        .distinct()
    )
    days_per_week = len(days_result.scalars().all()) or 1

    # week_number is 1-indexed in PhaseWorkout
    week_num = (user_program.current_week_in_phase % current_phase.duration_weeks) + 1
    day_idx = user_program.current_day_index % days_per_week

    # Load workout with sections and exercises
    workout_result = await db.execute(
        select(PhaseWorkout)
        .where(
            PhaseWorkout.phase_id == current_phase.id,
            PhaseWorkout.week_number == week_num,
            PhaseWorkout.day_index == day_idx,
        )
        .options(
            selectinload(PhaseWorkout.sections)
            .selectinload(PhaseWorkoutSection.exercises)
            .selectinload(PhaseWorkoutExercise.exercise),
            selectinload(PhaseWorkout.sections)
            .selectinload(PhaseWorkoutSection.exercises)
            .selectinload(PhaseWorkoutExercise.substitute1),
            selectinload(PhaseWorkout.sections)
            .selectinload(PhaseWorkoutSection.exercises)
            .selectinload(PhaseWorkoutExercise.substitute2),
        )
    )
    workout = workout_result.scalar_one_or_none()
    if not workout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No workout found for phase {phase_idx}, week {week_num}, day {day_idx}",
        )

    from app.schemas import (
        PhaseWorkoutExerciseResponse,
        PhaseWorkoutResponse,
        PhaseWorkoutSectionResponse,
        ProgramPhaseResponse,
    )

    return PhasedTodayResponse(
        program=ProgramResponse.model_validate(program),
        user_program=UserProgramResponse.model_validate(user_program),
        phase=ProgramPhaseResponse.model_validate(current_phase),
        workout=PhaseWorkoutResponse(
            id=workout.id,
            name=workout.name,
            day_index=workout.day_index,
            week_number=workout.week_number,
            sections=[
                PhaseWorkoutSectionResponse(
                    id=s.id,
                    name=s.name,
                    order=s.order,
                    notes=s.notes,
                    exercises=[
                        PhaseWorkoutExerciseResponse.model_validate(ex)
                        for ex in s.exercises
                    ],
                )
                for s in sorted(workout.sections, key=lambda s: s.order)
            ],
        ),
        phase_number=phase_idx + 1,
        week_in_phase=week_num,
        day_number=day_idx + 1,
        total_phases=len(program.phases),
    )


@router.get("/{program_id}/phases", response_model=list[ProgramPhaseDetailResponse])
async def list_phases(
    program_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list:
    """Get all phases for a phased program with full workout hierarchy."""
    # Allow access to shared programs or user's own
    result = await db.execute(
        select(Program).where(
            Program.id == program_id,
            (Program.user_id.is_(None)) | (Program.user_id == current_user.id),
        )
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Program not found"
        )

    phases_result = await db.execute(
        select(ProgramPhase)
        .where(ProgramPhase.program_id == program_id)
        .options(
            selectinload(ProgramPhase.workouts)
            .selectinload(PhaseWorkout.sections)
            .selectinload(PhaseWorkoutSection.exercises)
            .selectinload(PhaseWorkoutExercise.exercise),
            selectinload(ProgramPhase.workouts)
            .selectinload(PhaseWorkout.sections)
            .selectinload(PhaseWorkoutSection.exercises)
            .selectinload(PhaseWorkoutExercise.substitute1),
            selectinload(ProgramPhase.workouts)
            .selectinload(PhaseWorkout.sections)
            .selectinload(PhaseWorkoutSection.exercises)
            .selectinload(PhaseWorkoutExercise.substitute2),
        )
        .order_by(ProgramPhase.order)
    )
    return list(phases_result.scalars().all())


@router.get("/{program_id}", response_model=ProgramDetailResponse)
async def get_program(
    program_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Program:
    """Get program detail with routines. Allows shared access."""
    result = await db.execute(
        select(Program)
        .where(
            Program.id == program_id,
            (Program.user_id.is_(None)) | (Program.user_id == current_user.id),
        )
        .options(selectinload(Program.routines).selectinload(ProgramRoutine.template))
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
    """Update a custom program, replacing all routines. 403 for shared."""
    result = await db.execute(
        select(Program)
        .where(Program.id == program_id)
        .options(selectinload(Program.routines))
    )
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Program not found"
        )
    if program.user_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot edit a shared program",
        )
    if program.user_id != current_user.id:
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
        .options(selectinload(Program.routines).selectinload(ProgramRoutine.template))
    )
    return result.scalar_one()


@router.delete("/{program_id}", response_model=MessageResponse)
async def delete_program(
    program_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Delete a custom program, or unenroll from a shared program."""
    result = await db.execute(select(Program).where(Program.id == program_id))
    program = result.scalar_one_or_none()
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Program not found"
        )

    if program.user_id is None:
        # Shared program — delete enrollment instead
        enrollment_result = await db.execute(
            select(UserProgram).where(
                UserProgram.user_id == current_user.id,
                UserProgram.program_id == program_id,
            )
        )
        enrollment = enrollment_result.scalar_one_or_none()
        if enrollment:
            await db.delete(enrollment)
            await db.commit()
        return {"message": "Unenrolled from program"}

    if program.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Program not found"
        )

    await db.delete(program)
    await db.commit()
    return {"message": "Program deleted successfully"}


@router.post("/{program_id}/activate", response_model=UserProgramResponse)
async def activate_program(
    program_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProgram:
    """Activate a program enrollment, deactivating all others."""
    # Find or create enrollment
    result = await db.execute(
        select(UserProgram)
        .where(
            UserProgram.user_id == current_user.id,
            UserProgram.program_id == program_id,
        )
        .options(selectinload(UserProgram.program))
    )
    enrollment = result.scalar_one_or_none()

    if not enrollment:
        # Verify program exists
        prog_result = await db.execute(select(Program).where(Program.id == program_id))
        if not prog_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Program not found"
            )
        enrollment = UserProgram(
            user_id=current_user.id,
            program_id=program_id,
        )
        db.add(enrollment)
        await db.flush()

    # Deactivate all user enrollments
    await db.execute(
        update(UserProgram)
        .where(UserProgram.user_id == current_user.id)
        .values(is_active=False)
    )

    # Activate this one and reset counters
    enrollment.is_active = True
    enrollment.started_at = datetime.utcnow()
    enrollment.current_routine_index = 0
    enrollment.current_phase_index = 0
    enrollment.current_week_in_phase = 0
    enrollment.current_day_index = 0
    enrollment.weeks_completed = 0
    enrollment.last_workout_at = None

    await db.commit()

    # Reload with program
    result = await db.execute(
        select(UserProgram)
        .where(UserProgram.id == enrollment.id)
        .options(selectinload(UserProgram.program))
    )
    return result.scalar_one()


@router.post("/{program_id}/advance", response_model=UserProgramResponse)
async def advance_program(
    program_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProgram:
    """Advance the user's enrollment to the next routine after a workout."""
    result = await db.execute(
        select(UserProgram)
        .where(
            UserProgram.user_id == current_user.id,
            UserProgram.program_id == program_id,
        )
        .options(selectinload(UserProgram.program).selectinload(Program.routines))
    )
    enrollment = result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found"
        )

    routines = enrollment.program.routines
    if not routines:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Program has no routines",
        )

    next_index = enrollment.current_routine_index + 1
    if next_index >= len(routines):
        next_index = 0
        enrollment.weeks_completed += 1

    enrollment.current_routine_index = next_index
    enrollment.last_workout_at = datetime.utcnow()
    await db.commit()

    result = await db.execute(
        select(UserProgram)
        .where(UserProgram.id == enrollment.id)
        .options(selectinload(UserProgram.program))
    )
    return result.scalar_one()


@router.post("/{program_id}/advance-phased", response_model=UserProgramResponse)
async def advance_phased_program(
    program_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProgram:
    """Advance a phased program enrollment: day -> week -> phase."""
    result = await db.execute(
        select(UserProgram)
        .where(
            UserProgram.user_id == current_user.id,
            UserProgram.program_id == program_id,
        )
        .options(
            selectinload(UserProgram.program).selectinload(Program.phases),
        )
    )
    enrollment = result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found"
        )

    program = enrollment.program
    if program.program_type != "phased" or not program.phases:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not a phased program or no phases",
        )

    current_phase = program.phases[enrollment.current_phase_index % len(program.phases)]

    days_result = await db.execute(
        select(PhaseWorkout.day_index)
        .where(PhaseWorkout.phase_id == current_phase.id)
        .distinct()
    )
    days_per_week = len(days_result.scalars().all()) or 1

    new_day = enrollment.current_day_index + 1
    new_week = enrollment.current_week_in_phase
    new_phase = enrollment.current_phase_index

    if new_day >= days_per_week:
        new_day = 0
        new_week += 1
        if new_week >= current_phase.duration_weeks:
            new_week = 0
            new_phase += 1
            if new_phase >= len(program.phases):
                new_phase = 0
                enrollment.started_at = datetime.utcnow()

    enrollment.current_day_index = new_day
    enrollment.current_week_in_phase = new_week
    enrollment.current_phase_index = new_phase
    enrollment.last_workout_at = datetime.utcnow()

    await db.commit()

    result = await db.execute(
        select(UserProgram)
        .where(UserProgram.id == enrollment.id)
        .options(selectinload(UserProgram.program))
    )
    return result.scalar_one()


@router.post("/{program_id}/deactivate", response_model=UserProgramResponse)
async def deactivate_program(
    program_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProgram:
    """Deactivate a program enrollment."""
    result = await db.execute(
        select(UserProgram)
        .where(
            UserProgram.user_id == current_user.id,
            UserProgram.program_id == program_id,
        )
        .options(selectinload(UserProgram.program))
    )
    enrollment = result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found"
        )

    enrollment.is_active = False
    await db.commit()

    result = await db.execute(
        select(UserProgram)
        .where(UserProgram.id == enrollment.id)
        .options(selectinload(UserProgram.program))
    )
    return result.scalar_one()
