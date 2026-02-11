from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Exercise, ExerciseSubstitution

exercises_data = [
    {
        "name": "Lying Leg Curl",
        "muscle_group": "Hamstrings",
        "equipment": "Machine",
        "youtube_url": "https://youtube.com/watch?v=placeholder_lying_leg_curl",
        "notes": "Keep hips pressed into pad. Control the eccentric. Squeeze at peak contraction.",
    },
    {
        "name": "Seated Leg Curl",
        "muscle_group": "Hamstrings",
        "equipment": "Machine",
        "youtube_url": "https://youtube.com/watch?v=placeholder_seated_leg_curl",
        "notes": "Adjust pad to sit just above ankles. Maintain upright posture throughout.",
    },
    {
        "name": "Nordic Ham Curl",
        "muscle_group": "Hamstrings",
        "equipment": "Bodyweight",
        "youtube_url": "https://youtube.com/watch?v=placeholder_nordic_ham_curl",
        "notes": "Control the descent as slowly as possible. Use hands to push off floor if needed.",
    },
    {
        "name": "Smith Machine Squat",
        "muscle_group": "Quads",
        "equipment": "Smith Machine",
        "youtube_url": "https://youtube.com/watch?v=placeholder_smith_squat",
        "notes": "Feet slightly forward of bar. Keep core braced. Full depth below parallel.",
    },
    {
        "name": "Barbell RDL",
        "muscle_group": "Hamstrings",
        "equipment": "Barbell",
        "youtube_url": "https://youtube.com/watch?v=placeholder_barbell_rdl",
        "notes": "Hinge at hips, slight knee bend. Bar stays close to body. Feel stretch in hamstrings.",
    },
    {
        "name": "Leg Extension",
        "muscle_group": "Quads",
        "equipment": "Machine",
        "youtube_url": "https://youtube.com/watch?v=placeholder_leg_extension",
        "notes": "Full range of motion. Squeeze quads at top. Control the negative.",
    },
    {
        "name": "Standing Calf Raise",
        "muscle_group": "Calves",
        "equipment": "Machine",
        "youtube_url": "https://youtube.com/watch?v=placeholder_standing_calf_raise",
        "notes": "Full stretch at bottom, pause at top. Slow and controlled reps.",
    },
    {
        "name": "Cable Crunch",
        "muscle_group": "Abs",
        "equipment": "Cable",
        "youtube_url": "https://youtube.com/watch?v=placeholder_cable_crunch",
        "notes": "Curl spine down, don't just hinge at hips. Focus on abs contracting.",
    },
    {
        "name": "Bench Press",
        "muscle_group": "Chest",
        "equipment": "Barbell",
        "youtube_url": "https://youtube.com/watch?v=placeholder_bench_press",
        "notes": "Retract scapula, arch back slightly. Bar touches mid-chest. Drive feet into floor.",
    },
    {
        "name": "Incline Dumbbell Press",
        "muscle_group": "Chest",
        "equipment": "Dumbbell",
        "youtube_url": "https://youtube.com/watch?v=placeholder_incline_db_press",
        "notes": "30-45 degree incline. Dumbbells at chest level, press up and slightly in.",
    },
    {
        "name": "Squat",
        "muscle_group": "Quads",
        "equipment": "Barbell",
        "youtube_url": "https://youtube.com/watch?v=placeholder_squat",
        "notes": "Bar on upper traps. Brace core, break at hips and knees simultaneously. Below parallel.",
    },
    {
        "name": "Deadlift",
        "muscle_group": "Back",
        "equipment": "Barbell",
        "youtube_url": "https://youtube.com/watch?v=placeholder_deadlift",
        "notes": "Bar over mid-foot. Hinge at hips, neutral spine. Drive through floor. Lock out at top.",
    },
    {
        "name": "Overhead Press",
        "muscle_group": "Shoulders",
        "equipment": "Barbell",
        "youtube_url": "https://youtube.com/watch?v=placeholder_ohp",
        "notes": "Bar starts at collarbones. Brace core, press straight up. Move head through at top.",
    },
    {
        "name": "Barbell Row",
        "muscle_group": "Back",
        "equipment": "Barbell",
        "youtube_url": "https://youtube.com/watch?v=placeholder_barbell_row",
        "notes": "Hinge forward ~45 degrees. Pull to lower chest/upper abs. Squeeze shoulder blades.",
    },
    {
        "name": "Lat Pulldown",
        "muscle_group": "Back",
        "equipment": "Cable",
        "youtube_url": "https://youtube.com/watch?v=placeholder_lat_pulldown",
        "notes": "Wide grip, pull to upper chest. Lean back slightly. Squeeze lats at bottom.",
    },
    {
        "name": "Pull-Up",
        "muscle_group": "Back",
        "equipment": "Bodyweight",
        "youtube_url": "https://youtube.com/watch?v=placeholder_pullup",
        "notes": "Dead hang start. Pull until chin over bar. Control the descent fully.",
    },
    {
        "name": "Dumbbell Lateral Raise",
        "muscle_group": "Shoulders",
        "equipment": "Dumbbell",
        "youtube_url": "https://youtube.com/watch?v=placeholder_lateral_raise",
        "notes": "Slight bend in elbows. Raise to shoulder height. Lead with elbows, not hands.",
    },
    {
        "name": "Tricep Pushdown",
        "muscle_group": "Triceps",
        "equipment": "Cable",
        "youtube_url": "https://youtube.com/watch?v=placeholder_tricep_pushdown",
        "notes": "Elbows pinned to sides. Full extension at bottom. Control the return.",
    },
    {
        "name": "Barbell Curl",
        "muscle_group": "Biceps",
        "equipment": "Barbell",
        "youtube_url": "https://youtube.com/watch?v=placeholder_barbell_curl",
        "notes": "Keep elbows at sides. Full range of motion. Don't swing the weight.",
    },
]

substitutions_data = [
    ("Lying Leg Curl", "Seated Leg Curl", 1),
    ("Lying Leg Curl", "Nordic Ham Curl", 2),
    ("Bench Press", "Incline Dumbbell Press", 1),
    ("Squat", "Smith Machine Squat", 1),
    ("Barbell Row", "Lat Pulldown", 1),
    ("Barbell Row", "Pull-Up", 2),
]


async def seed_exercises(db: AsyncSession) -> None:
    result = await db.execute(select(Exercise).limit(1))
    if result.scalars().first() is not None:
        return

    exercises = []
    for data in exercises_data:
        exercise = Exercise(
            user_id=None,
            is_custom=False,
            **data,
        )
        exercises.append(exercise)
        db.add(exercise)

    await db.flush()

    name_to_id = {e.name: e.id for e in exercises}

    for exercise_name, substitute_name, priority in substitutions_data:
        sub = ExerciseSubstitution(
            exercise_id=name_to_id[exercise_name],
            substitute_exercise_id=name_to_id[substitute_name],
            priority=priority,
        )
        db.add(sub)

    await db.commit()
