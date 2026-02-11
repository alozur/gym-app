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
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    user: Mapped[User] = relationship(back_populates="templates")
    template_exercises: Mapped[list["TemplateExercise"]] = relationship(
        back_populates="template", cascade="all, delete-orphan"
    )
    sessions: Mapped[list["WorkoutSession"]] = relationship(back_populates="template")


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
    min_warmup_sets: Mapped[int] = mapped_column(Integer, nullable=False)
    max_warmup_sets: Mapped[int] = mapped_column(Integer, nullable=False)

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
    year_week: Mapped[str | None] = mapped_column(String(10), nullable=True)
    week_type: Mapped[str] = mapped_column(String(20), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    synced: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    user: Mapped[User] = relationship(back_populates="sessions")
    template: Mapped[WorkoutTemplate | None] = relationship(back_populates="sessions")
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
    warmup_weight_range: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    warmup_sets_done: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )

    user: Mapped[User] = relationship(back_populates="progress")
    exercise: Mapped[Exercise] = relationship(back_populates="progress")
