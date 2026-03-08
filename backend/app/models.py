import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    preferred_unit: Mapped[str] = mapped_column(
        String(10), nullable=False, default="kg"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    exercises: Mapped[list["Exercise"]] = relationship(back_populates="user")
    templates: Mapped[list["WorkoutTemplate"]] = relationship(back_populates="user")
    sessions: Mapped[list["WorkoutSession"]] = relationship(back_populates="user")
    progress: Mapped[list["ExerciseProgress"]] = relationship(back_populates="user")
    programs: Mapped[list["Program"]] = relationship(back_populates="user")
    user_programs: Mapped[list["UserProgram"]] = relationship(back_populates="user")


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    muscle_group: Mapped[str] = mapped_column(String(100), nullable=False)
    equipment: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_custom: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    youtube_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    exercise_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="reps"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    user: Mapped[User | None] = relationship(back_populates="exercises")
    substitutions: Mapped[list["ExerciseSubstitution"]] = relationship(
        foreign_keys="ExerciseSubstitution.exercise_id",
        back_populates="exercise",
    )
    template_exercises: Mapped[list["TemplateExercise"]] = relationship(
        back_populates="exercise"
    )
    workout_sets: Mapped[list["WorkoutSet"]] = relationship(back_populates="exercise")
    progress: Mapped[list["ExerciseProgress"]] = relationship(
        back_populates="exercise"
    )


class ExerciseSubstitution(Base):
    __tablename__ = "exercise_substitutions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    exercise_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("exercises.id"), nullable=False
    )
    substitute_exercise_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("exercises.id"), nullable=False
    )
    priority: Mapped[int] = mapped_column(Integer, nullable=False)

    exercise: Mapped[Exercise] = relationship(
        foreign_keys=[exercise_id], back_populates="substitutions"
    )
    substitute_exercise: Mapped[Exercise] = relationship(
        foreign_keys=[substitute_exercise_id]
    )


class WorkoutTemplate(Base):
    __tablename__ = "workout_templates"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    user: Mapped[User | None] = relationship(back_populates="templates")
    template_exercises: Mapped[list["TemplateExercise"]] = relationship(
        back_populates="template", cascade="all, delete-orphan"
    )
    sessions: Mapped[list["WorkoutSession"]] = relationship(back_populates="template")
    program_routines: Mapped[list["ProgramRoutine"]] = relationship(
        back_populates="template"
    )


class TemplateExercise(Base):
    __tablename__ = "template_exercises"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    template_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workout_templates.id"), nullable=False
    )
    exercise_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("exercises.id"), nullable=False
    )
    week_type: Mapped[str] = mapped_column(String(20), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    working_sets: Mapped[int] = mapped_column(Integer, nullable=False)
    min_reps: Mapped[int] = mapped_column(Integer, nullable=False)
    max_reps: Mapped[int] = mapped_column(Integer, nullable=False)
    early_set_rpe_min: Mapped[Decimal] = mapped_column(Numeric(3, 1), nullable=False)
    early_set_rpe_max: Mapped[Decimal] = mapped_column(Numeric(3, 1), nullable=False)
    last_set_rpe_min: Mapped[Decimal] = mapped_column(Numeric(3, 1), nullable=False)
    last_set_rpe_max: Mapped[Decimal] = mapped_column(Numeric(3, 1), nullable=False)
    rest_period: Mapped[str] = mapped_column(String(50), nullable=False)
    intensity_technique: Mapped[str | None] = mapped_column(
        String(200), nullable=True
    )
    warmup_sets: Mapped[int] = mapped_column(Integer, nullable=False, default=2)

    template: Mapped[WorkoutTemplate] = relationship(
        back_populates="template_exercises"
    )
    exercise: Mapped[Exercise] = relationship(back_populates="template_exercises")


class WorkoutSession(Base):
    __tablename__ = "workout_sessions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    template_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("workout_templates.id"), nullable=True
    )
    program_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("programs.id"), nullable=True
    )
    phase_workout_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("phase_workouts.id"), nullable=True
    )
    user_program_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("user_programs.id"), nullable=True
    )
    year_week: Mapped[str | None] = mapped_column(String(10), nullable=True)
    week_type: Mapped[str] = mapped_column(String(20), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    synced: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    user: Mapped[User] = relationship(back_populates="sessions")
    template: Mapped[WorkoutTemplate | None] = relationship(back_populates="sessions")
    program: Mapped["Program | None"] = relationship(back_populates="sessions")
    user_program: Mapped["UserProgram | None"] = relationship(back_populates="sessions")
    phase_workout: Mapped["PhaseWorkout | None"] = relationship(
        foreign_keys=[phase_workout_id]
    )
    sets: Mapped[list["WorkoutSet"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class WorkoutSet(Base):
    __tablename__ = "workout_sets"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workout_sessions.id"), nullable=False
    )
    exercise_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("exercises.id"), nullable=False
    )
    set_type: Mapped[str] = mapped_column(String(20), nullable=False)
    set_number: Mapped[int] = mapped_column(Integer, nullable=False)
    reps: Mapped[int] = mapped_column(Integer, nullable=False)
    weight: Mapped[Decimal] = mapped_column(Numeric(7, 2), nullable=False)
    rpe: Mapped[Decimal | None] = mapped_column(Numeric(3, 1), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    session: Mapped[WorkoutSession] = relationship(back_populates="sets")
    exercise: Mapped[Exercise] = relationship(back_populates="workout_sets")


class ExerciseProgress(Base):
    __tablename__ = "exercise_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "exercise_id", "year_week", name="uq_progress"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    exercise_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("exercises.id"), nullable=False
    )
    year_week: Mapped[str] = mapped_column(String(10), nullable=False)
    max_weight: Mapped[Decimal] = mapped_column(Numeric(7, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    user: Mapped[User] = relationship(back_populates="progress")
    exercise: Mapped[Exercise] = relationship(back_populates="progress")


class Program(Base):
    __tablename__ = "programs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    program_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="rotating"
    )
    deload_every_n_weeks: Mapped[int] = mapped_column(
        Integer, nullable=False, default=6
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    user: Mapped["User | None"] = relationship(back_populates="programs")
    routines: Mapped[list["ProgramRoutine"]] = relationship(
        back_populates="program",
        cascade="all, delete-orphan",
        order_by="ProgramRoutine.order",
    )
    phases: Mapped[list["ProgramPhase"]] = relationship(
        back_populates="program",
        cascade="all, delete-orphan",
        order_by="ProgramPhase.order",
    )
    sessions: Mapped[list["WorkoutSession"]] = relationship(back_populates="program")
    enrollments: Mapped[list["UserProgram"]] = relationship(
        back_populates="program", cascade="all, delete-orphan"
    )


class UserProgram(Base):
    __tablename__ = "user_programs"
    __table_args__ = (
        UniqueConstraint("user_id", "program_id", name="uq_user_program"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    program_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("programs.id"), nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    current_routine_index: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    current_phase_index: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    current_week_in_phase: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    current_day_index: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    weeks_completed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_workout_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    user: Mapped["User"] = relationship(back_populates="user_programs")
    program: Mapped["Program"] = relationship(back_populates="enrollments")
    sessions: Mapped[list["WorkoutSession"]] = relationship(
        back_populates="user_program"
    )


class ProgramRoutine(Base):
    __tablename__ = "program_routines"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    program_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("programs.id", ondelete="CASCADE"),
        nullable=False,
    )
    template_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workout_templates.id"), nullable=False
    )
    order: Mapped[int] = mapped_column(Integer, nullable=False)

    program: Mapped["Program"] = relationship(back_populates="routines")
    template: Mapped["WorkoutTemplate"] = relationship(
        back_populates="program_routines"
    )


class ProgramPhase(Base):
    __tablename__ = "program_phases"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    program_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("programs.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_weeks: Mapped[int] = mapped_column(Integer, nullable=False)

    program: Mapped["Program"] = relationship(back_populates="phases")
    workouts: Mapped[list["PhaseWorkout"]] = relationship(
        back_populates="phase", cascade="all, delete-orphan"
    )


class PhaseWorkout(Base):
    __tablename__ = "phase_workouts"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    phase_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("program_phases.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    day_index: Mapped[int] = mapped_column(Integer, nullable=False)
    week_number: Mapped[int] = mapped_column(Integer, nullable=False)

    phase: Mapped["ProgramPhase"] = relationship(back_populates="workouts")
    sections: Mapped[list["PhaseWorkoutSection"]] = relationship(
        back_populates="workout",
        cascade="all, delete-orphan",
        order_by="PhaseWorkoutSection.order",
    )


class PhaseWorkoutSection(Base):
    __tablename__ = "phase_workout_sections"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    workout_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("phase_workouts.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    workout: Mapped["PhaseWorkout"] = relationship(back_populates="sections")
    exercises: Mapped[list["PhaseWorkoutExercise"]] = relationship(
        back_populates="section",
        cascade="all, delete-orphan",
        order_by="PhaseWorkoutExercise.order",
    )


class PhaseWorkoutExercise(Base):
    __tablename__ = "phase_workout_exercises"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    section_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("phase_workout_sections.id", ondelete="CASCADE"),
        nullable=False,
    )
    exercise_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("exercises.id"), nullable=False
    )
    order: Mapped[int] = mapped_column(Integer, nullable=False)
    working_sets: Mapped[int] = mapped_column(Integer, nullable=False)
    reps_display: Mapped[str] = mapped_column(String(50), nullable=False)
    rest_period: Mapped[str | None] = mapped_column(String(50), nullable=True)
    intensity_technique: Mapped[str | None] = mapped_column(
        String(200), nullable=True
    )
    warmup_sets: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    substitute1_exercise_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("exercises.id"), nullable=True
    )
    substitute2_exercise_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("exercises.id"), nullable=True
    )

    section: Mapped["PhaseWorkoutSection"] = relationship(back_populates="exercises")
    exercise: Mapped["Exercise"] = relationship(foreign_keys=[exercise_id])
    substitute1: Mapped["Exercise | None"] = relationship(
        foreign_keys=[substitute1_exercise_id]
    )
    substitute2: Mapped["Exercise | None"] = relationship(
        foreign_keys=[substitute2_exercise_id]
    )
