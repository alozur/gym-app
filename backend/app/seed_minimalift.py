"""Minimalift 3-Day Full Body program seed data.

Exercises and program structure sourced from the official Minimalift JSON.
Phase 1 is fully implemented; Phases 2 and 3 will be added when data is provided.
"""

from uuid import UUID, uuid5, NAMESPACE_URL

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def _shared_id(key: str) -> str:
    """Generate a deterministic UUID for shared/seeded data."""
    return str(uuid5(NAMESPACE_URL, f"shared:{key}"))


SHARED_MINIMALIFT_PROGRAM_ID = _shared_id("ml:program")

# ---------------------------------------------------------------------------
# Exercises used by the Minimalift program (skips any that already exist)
# ---------------------------------------------------------------------------

minimalift_exercises_data: list[dict] = [
    # ── Plyometric / Warm-Up ──
    {"name": "Pogos", "muscle_group": "Calves", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/42A85k9"},
    {"name": "Split Stance Pogos", "muscle_group": "Calves", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3Gg0tvN"},
    {"name": "Split Exchange Pogos", "muscle_group": "Calves", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/44upD3K"},
    {"name": "Wall Assisted Pogo", "muscle_group": "Calves", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/4jcGRal"},
    {"name": "Knee Tuck", "muscle_group": "Core", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3YCVCep"},
    {"name": "Single Leg Lift", "muscle_group": "Core", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3Gg0tvN"},
    {"name": "Lying Leg Raise", "muscle_group": "Core", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3YAFN80"},
    {"name": "Hanging Knee Raise", "muscle_group": "Core", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/4je4102"},
    {"name": "Hollowbody Hold", "muscle_group": "Core", "equipment": "Bodyweight", "exercise_type": "timed", "youtube_url": "https://bit.ly/3Y4cPxa"},
    {"name": "Scapula Pull Up", "muscle_group": "Back", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/4ji3sm8"},
    {"name": "Scapula Push Up", "muscle_group": "Shoulders", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/4jeS6iC"},
    {"name": "Turkish Get Up", "muscle_group": "Full Body", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/4itxHoJ"},
    # ── Strength — Squat / Press / Pull ──
    {"name": "Barbell Squat", "muscle_group": "Quads", "equipment": "Barbell", "youtube_url": "https://bit.ly/4jgblZp"},
    {"name": "Z-Press", "muscle_group": "Shoulders", "equipment": "Barbell", "youtube_url": "https://bit.ly/4jptvb1"},
    {"name": "Deadlift", "muscle_group": "Back", "equipment": "Barbell", "youtube_url": "https://bit.ly/4jnMnHC"},
    {"name": "Chin Up", "muscle_group": "Back", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3GdkNxU"},
    {"name": "Wide Deadlift", "muscle_group": "Back", "equipment": "Barbell", "youtube_url": "https://bit.ly/3YAiHOS"},
    {"name": "Dumbbell Row", "muscle_group": "Back", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/4ja2KqZ"},
    {"name": "Close Grip Bench Press", "muscle_group": "Chest", "equipment": "Barbell", "youtube_url": "https://bit.ly/3Y59Og8"},
    # ── Swole & Flexy ──
    {"name": "Dumbbell Press", "muscle_group": "Chest", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/3Y59NZC"},
    {"name": "Dumbbell RDL", "muscle_group": "Hamstrings", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/4jfn9ed"},
    {"name": "Deficit Reverse Lunge", "muscle_group": "Quads", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/3Y6Ba5w"},
    {"name": "Copenhagen Plank", "muscle_group": "Core", "equipment": "Bodyweight", "exercise_type": "timed", "youtube_url": "https://bit.ly/3YFgRMH"},
    {"name": "Seated Good Morning", "muscle_group": "Hamstrings", "equipment": "Barbell", "youtube_url": "https://bit.ly/4jeS6z8"},
    # ── Accessories ──
    {"name": "Y Raise", "muscle_group": "Shoulders", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/4jHGnsR"},
    {"name": "Squat Curl", "muscle_group": "Biceps", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/4jm8w9c"},
    {"name": "Katana Extension", "muscle_group": "Triceps", "equipment": "Cable", "youtube_url": "https://bit.ly/4lQo9ay"},
    {"name": "Pullover + Skullcrusher", "muscle_group": "Triceps", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/3Y63swX"},
    {"name": "Halos (KB or DB)", "muscle_group": "Shoulders", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/3Y47IwW"},
    {"name": "Backwards Treadmill Walk", "muscle_group": "Quads", "equipment": "Machine", "exercise_type": "timed"},
    {"name": "Suitcase March", "muscle_group": "Core", "equipment": "Dumbbell", "exercise_type": "timed", "youtube_url": "https://bit.ly/3Y19Tl2"},
    # ── Substitutes (Phase 1) ──
    {"name": "Calf Raise", "muscle_group": "Calves", "equipment": "Machine", "youtube_url": "https://bit.ly/3Gd3sFj"},
    {"name": "Dumbbell Overhead Press", "muscle_group": "Shoulders", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/3GdkNOq"},
    {"name": "Incline Dumbbell Press", "muscle_group": "Chest", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/4jfPotl"},
    {"name": "Bench Press", "muscle_group": "Chest", "equipment": "Barbell", "youtube_url": "https://bit.ly/3Yw4UJp"},
    {"name": "Push Up", "muscle_group": "Chest", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/4ji3sCE"},
    {"name": "Cat Cow", "muscle_group": "Back", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3Ya77df"},
    {"name": "Single Leg RDL", "muscle_group": "Hamstrings", "equipment": "Dumbbell", "youtube_url": "https://youtu.be/r6rQLPpcPTM?si=c5GyI7IFlaRK-yXy&t=503"},
    {"name": "DB Lateral Raise", "muscle_group": "Shoulders", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/3EtQ2UW"},
    {"name": "Band Lateral Raise", "muscle_group": "Shoulders", "equipment": "Band", "youtube_url": "https://bit.ly/3EwLq0i"},
    {"name": "Incline Curl", "muscle_group": "Biceps", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/3GgJA48"},
    {"name": "Preacher Curl", "muscle_group": "Biceps", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/4jgQK7e"},
    {"name": "DB Overhead Ext", "muscle_group": "Triceps", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/3EovU6E"},
    {"name": "DB Side Lying Ext", "muscle_group": "Triceps", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/3EvXuPh"},
    {"name": "DB Deadlift", "muscle_group": "Back", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/3RqxB6p"},
    {"name": "Trap Bar Deadlift", "muscle_group": "Back", "equipment": "Barbell", "youtube_url": "https://bit.ly/3Y7bplD"},
    {"name": "Lat Pulldown", "muscle_group": "Back", "equipment": "Cable", "youtube_url": "https://bit.ly/3Gg0u2P"},
    {"name": "Inverted Row", "muscle_group": "Back", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/4jiOnRj"},
    {"name": "Single Leg Press", "muscle_group": "Quads", "equipment": "Machine", "youtube_url": "https://bit.ly/442JBme"},
    {"name": "Split Squat", "muscle_group": "Quads", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/4jiOnAN"},
    {"name": "Triceps Extension", "muscle_group": "Triceps", "equipment": "Cable", "youtube_url": "https://bit.ly/44vemQL"},
    {"name": "Single DB Row", "muscle_group": "Back", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/4ir6Rhd"},
    {"name": "Cable Row", "muscle_group": "Back", "equipment": "Cable", "youtube_url": "https://bit.ly/4j85sgC"},
    {"name": "Close Grip Push Up", "muscle_group": "Triceps", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3Gg0tMj"},
    {"name": "Dip", "muscle_group": "Triceps", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/42BK6ky"},
    {"name": "Backwards Sled Drag", "muscle_group": "Quads", "equipment": "Other", "youtube_url": "https://bit.ly/4jlMjYO"},
    {"name": "Poliquin Step Up", "muscle_group": "Quads", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/44AiCOV"},
    # ── Extra exercises from video URL list (for Phases 2 & 3) ──
    {"name": "45 Degree Hyperextension", "muscle_group": "Hamstrings", "equipment": "Machine", "youtube_url": "https://bit.ly/3Ggi4DQ"},
    {"name": "B-Stance RDL", "muscle_group": "Hamstrings", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/4jfn9ed"},
    {"name": "Barbell Row", "muscle_group": "Back", "equipment": "Barbell", "youtube_url": "https://bit.ly/4jcGRqR"},
    {"name": "Bench Dip", "muscle_group": "Triceps", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/42zQpp3"},
    {"name": "Bicycle Crunch", "muscle_group": "Core", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/42Bo5me"},
    {"name": "Bodyweight Skullcrusher", "muscle_group": "Triceps", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3Y7xctj"},
    {"name": "Box Step Over", "muscle_group": "Quads", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3GgJAkE"},
    {"name": "Broad Jump", "muscle_group": "Full Body", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3Y85TiG"},
    {"name": "DB Bulgarian Split Squat", "muscle_group": "Quads", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/4jiOnAN"},
    {"name": "Cable Curl", "muscle_group": "Biceps", "equipment": "Cable", "youtube_url": "https://bit.ly/44xjoMA"},
    {"name": "Cable Raise", "muscle_group": "Shoulders", "equipment": "Cable", "youtube_url": "https://bit.ly/3EwLq0i"},
    {"name": "Cross Body Triceps Extension", "muscle_group": "Triceps", "equipment": "Cable", "youtube_url": "https://bit.ly/4jqUVx2"},
    {"name": "DB Cross Body Extension", "muscle_group": "Triceps", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/42QEHrg"},
    {"name": "DB Row - Dual", "muscle_group": "Back", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/4ja2KqZ"},
    {"name": "Depth Jump", "muscle_group": "Full Body", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/4jiJcki"},
    {"name": "Dumbbell Push Press", "muscle_group": "Shoulders", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/4jfPoJR"},
    {"name": "Face Pull", "muscle_group": "Shoulders", "equipment": "Cable", "youtube_url": "https://bit.ly/4jf8VtJ"},
    {"name": "Full Range Crunch", "muscle_group": "Core", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/4jirQnI"},
    {"name": "Glute Bridge", "muscle_group": "Glutes", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3Y3rysd"},
    {"name": "Hamstring Bridge", "muscle_group": "Hamstrings", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/4jfn9uJ"},
    {"name": "Hip Flexor Plank", "muscle_group": "Core", "equipment": "Bodyweight", "exercise_type": "timed", "youtube_url": "https://bit.ly/4cIWggw"},
    {"name": "Horse Stance Good Morning", "muscle_group": "Hamstrings", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3Y3rybH"},
    {"name": "Incline Skullcrusher", "muscle_group": "Triceps", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/4lyks94"},
    {"name": "Landmine Press", "muscle_group": "Shoulders", "equipment": "Barbell", "youtube_url": "https://bit.ly/4jihBj4"},
    {"name": "Lateral Jump", "muscle_group": "Full Body", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/4jgdST6"},
    {"name": "Lateral Raise + Hold", "muscle_group": "Shoulders", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/3EtQ2UW"},
    {"name": "Pike Pulse", "muscle_group": "Core", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3Y19T4w"},
    {"name": "Pike Raise", "muscle_group": "Shoulders", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/4jyFxz7"},
    {"name": "Prone Y Raise", "muscle_group": "Shoulders", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/4jFgc5U"},
    {"name": "Rear Delt Fly", "muscle_group": "Shoulders", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/44xfEL6"},
    {"name": "Reverse Crunch", "muscle_group": "Core", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/42wKNND"},
    {"name": "Romanian Deadlift", "muscle_group": "Hamstrings", "equipment": "Barbell", "youtube_url": "https://bit.ly/3YFgS3d"},
    {"name": "Russian Twist", "muscle_group": "Core", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3EuhZMn"},
    {"name": "Scapula Circles", "muscle_group": "Shoulders", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3EDLpYi"},
    {"name": "Side Lying Compound Raise", "muscle_group": "Shoulders", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/4jcGRqR"},
    {"name": "Single Arm Cable Y Raise", "muscle_group": "Shoulders", "equipment": "Cable", "youtube_url": "https://bit.ly/3EwLq0i"},
    {"name": "Single Leg Raise", "muscle_group": "Core", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3Y47Igq"},
    {"name": "Smith Machine Split Squat", "muscle_group": "Quads", "equipment": "Machine", "youtube_url": "https://bit.ly/3Y74Dw6"},
    {"name": "Stand to Triple Extension", "muscle_group": "Full Body", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3YAFNow"},
    {"name": "Twisting Bear", "muscle_group": "Core", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/4irk0qE"},
    {"name": "Vertical Jump", "muscle_group": "Full Body", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/4jad5mI"},
    {"name": "Walking Lunge", "muscle_group": "Quads", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/3Y7bp57"},
    {"name": "Windmill", "muscle_group": "Core", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/4jzBVwe"},
    {"name": "Zercher March", "muscle_group": "Core", "equipment": "Barbell", "youtube_url": "https://bit.ly/4jf8VKf"},
    {"name": "Cable Crunch", "muscle_group": "Core", "equipment": "Cable", "youtube_url": "https://bit.ly/3GkBCqL"},
    # ── Substitutes (Phase 2) ──
    {"name": "Dead Hang", "muscle_group": "Back", "equipment": "Bodyweight", "exercise_type": "timed", "youtube_url": "https://bit.ly/44kU50v"},
    {"name": "Plank", "muscle_group": "Core", "equipment": "Bodyweight", "exercise_type": "timed", "youtube_url": "https://bit.ly/3Y6Bam2"},
    {"name": "Goblet Squat", "muscle_group": "Quads", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/4jptvrx"},
    {"name": "Leg Press", "muscle_group": "Quads", "equipment": "Machine", "youtube_url": "https://bit.ly/42o38MJ"},
    {"name": "Skullcrusher", "muscle_group": "Triceps", "equipment": "Dumbbell"},
    {"name": "Barbell RDL", "muscle_group": "Hamstrings", "equipment": "Barbell", "youtube_url": "https://bit.ly/3YFgS3d"},
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _ex(name: str, working_sets: int, reps_display: str, *,
        rest_period: str | None = None,
        warmup_sets: int = 0,
        notes: str | None = None,
        sub1: str | None = None,
        sub2: str | None = None) -> dict:
    return {
        "name": name,
        "working_sets": working_sets,
        "reps_display": reps_display,
        "rest_period": rest_period,
        "warmup_sets": warmup_sets,
        "notes": notes,
        "sub1": sub1,
        "sub2": sub2,
    }


def _workout(name: str, day_index: int, week_number: int,
             warmup_exercises: list[dict],
             strength_exercises: list[dict], strength_notes: str | None,
             swole_exercises: list[dict], swole_notes: str | None,
             accessory_exercises: list[dict], accessory_notes: str | None) -> dict:
    return {
        "name": name,
        "day_index": day_index,
        "week_number": week_number,
        "sections": [
            {"name": "Warm Up", "notes": None, "exercises": warmup_exercises},
            {"name": "Strength & Condition", "notes": strength_notes, "exercises": strength_exercises},
            {"name": "Swole & Flexy", "notes": swole_notes, "exercises": swole_exercises},
            {"name": "Accessories", "notes": accessory_notes, "exercises": accessory_exercises},
        ],
    }


# ---------------------------------------------------------------------------
# Section notes (shared across workouts)
# ---------------------------------------------------------------------------

EMOM_NOTES = (
    "Set a timer for 12 minutes. Every 2 minutes on the minute, perform "
    "1 set of 5 reps on both exercises. Rest in the remainder of the 2 "
    "minutes. Start light and add weight each set, aiming to hit your "
    "heaviest weight around Set 4-5 (at Minutes 6 or 8)."
)
SWOLE_EXTRA_SETS = "For additional gains, you can increase by 1 to 2 sets per exercise."
ACC_EXTRA_SETS = "Feel free to add extra sets if time permits."
ACC_TIMED_CIRCUIT = (
    "Perform both exercises as a timed circuit. No rest between exercises. "
    "30s rest between rounds."
)


# ---------------------------------------------------------------------------
# Phase 1: "The Base"
# ---------------------------------------------------------------------------

# ── Day 1 warm-ups (rotate by week) ──
_P1_D1_WARMUP = {
    1: [
        _ex("Pogos", 3, "20", rest_period="0-10s",
            notes="Stay light on your feet and keep soft knees",
            sub1="Calf Raise"),
        _ex("Knee Tuck", 3, "10-15", rest_period="0-10s",
            notes="Sit on an elevated surface for more range of motion if desired"),
    ],
    2: [
        _ex("Split Stance Pogos", 3, "10 e/s", rest_period="0-10s",
            notes="Stay light on your feet and keep soft knees",
            sub1="Calf Raise"),
        _ex("Single Leg Lift", 3, "10-15", rest_period="0-10s",
            notes="Lay on an elevated surface for more range of motion if desired"),
    ],
    3: [
        _ex("Split Exchange Pogos", 3, "10 e/s", rest_period="0-10s",
            notes="Stay light on your feet and keep soft knees",
            sub1="Calf Raise"),
        _ex("Lying Leg Raise", 3, "10-15", rest_period="0-10s",
            notes="Sit on an elevated surface for more range of motion if desired"),
    ],
    4: [
        _ex("Wall Assisted Pogo", 3, "20", rest_period="0-10s",
            notes="Go for extra height here using the wall assist",
            sub1="Calf Raise"),
        _ex("Hanging Knee Raise", 3, "10-15", rest_period="0-10s",
            sub1="Lying Leg Raise"),
    ],
}

# ── Day 2 warm-ups (same every week) ──
_P1_D2_WARMUP = [
    _ex("Hollowbody Hold", 3, "15s", rest_period="0-10s",
        notes="Pick a level of difficulty that is just manageable by the end",
        sub1="Plank"),
    _ex("Scapula Pull Up", 3, "10", rest_period="0-10s",
        notes="Place your feet on the ground to offload your bodyweight as needed"),
]

# ── Day 3 warm-ups (same every week) ──
_P1_D3_WARMUP = [
    _ex("Turkish Get Up", 3, "5 e/s", rest_period="0-10s",
        notes="Dumbbell, Kettlebell or Bodyweight"),
]

# ── Day 1 main exercises ──
_P1_D1_STRENGTH = [
    _ex("Barbell Squat", 6, "5", rest_period="-",
        sub1="Goblet Squat", sub2="Leg Press"),
    _ex("Z-Press", 6, "5", rest_period="-",
        sub1="Dumbbell Overhead Press", sub2="Incline Dumbbell Press"),
]
_P1_D1_SWOLE = [
    _ex("Dumbbell Press", 1, "6-10", rest_period="0s",
        sub1="Bench Press", sub2="Push Up"),
    _ex("Scapula Push Up", 1, "10", rest_period="0s",
        notes="Use this as active rest before going to the next exercise.",
        sub1="Cat Cow", sub2="Plank"),
    _ex("Dumbbell RDL", 1, "6-10", rest_period="60s",
        notes="Pause on final rep for 10 seconds in the stretch position",
        sub1="Barbell RDL", sub2="Single Leg RDL"),
]
_P1_D1_ACC = [
    _ex("Y Raise", 1, "10-15", rest_period="0s",
        sub1="DB Lateral Raise", sub2="Band Lateral Raise"),
    _ex("Squat Curl", 1, "10-15", rest_period="0s",
        sub1="Incline Curl", sub2="Preacher Curl"),
    _ex("Katana Extension", 1, "10-15", rest_period="0s",
        sub1="DB Overhead Ext", sub2="DB Side Lying Ext"),
]

# ── Day 2 main exercises ──
_P1_D2_STRENGTH = [
    _ex("Deadlift", 6, "5", rest_period="-",
        sub1="DB Deadlift", sub2="Trap Bar Deadlift"),
    _ex("Chin Up", 6, "5", rest_period="-",
        sub1="Lat Pulldown", sub2="Inverted Row"),
]
_P1_D2_SWOLE = [
    _ex("Deficit Reverse Lunge", 1, "8-12 e/s", rest_period="0s",
        notes="Perform all reps on one side before switching to the other leg",
        sub1="Single Leg Press", sub2="Split Squat"),
    _ex("Copenhagen Plank", 1, "20s e/s", rest_period="0s",
        notes="Select your choice of difficulty"),
]
_P1_D2_ACC = [
    _ex("Pullover + Skullcrusher", 1, "10-15", rest_period="0s",
        sub1="Triceps Extension"),
    _ex("Dumbbell Row", 1, "10-15", rest_period="0s",
        sub1="Single DB Row", sub2="Cable Row"),
    _ex("Halos (KB or DB)", 1, "10-15", rest_period="0s"),
]

# ── Day 3 main exercises ──
_P1_D3_STRENGTH = [
    _ex("Wide Deadlift", 6, "5", rest_period="-",
        sub1="DB Deadlift", sub2="Trap Bar Deadlift"),
    _ex("Dumbbell Row", 6, "5", rest_period="-",
        sub1="Cable Row", sub2="Inverted Row"),
]
_P1_D3_SWOLE = [
    _ex("Close Grip Bench Press", 1, "8-12", rest_period="0s",
        sub1="Close Grip Push Up", sub2="Dip"),
    _ex("Seated Good Morning", 1, "8-10", rest_period="0s",
        notes="2 second pause in the bottom of each rep. Only go as low as mobility allows"),
]
_P1_D3_ACC = [
    _ex("Backwards Treadmill Walk", 5, "60s", rest_period="0s",
        sub1="Backwards Sled Drag", sub2="Poliquin Step Up"),
    _ex("Suitcase March", 5, "30s e/s", rest_period="0s",
        notes="Perform stationary if space is limited. Switch the starting arm on each round"),
]


def _build_phase1_workouts() -> list[dict]:
    workouts: list[dict] = []
    for week in range(1, 5):
        workouts.append(_workout(
            "Full Body 1", 0, week,
            _P1_D1_WARMUP[week], _P1_D1_STRENGTH, EMOM_NOTES,
            _P1_D1_SWOLE, SWOLE_EXTRA_SETS,
            _P1_D1_ACC, ACC_EXTRA_SETS,
        ))
        workouts.append(_workout(
            "Full Body 2", 1, week,
            _P1_D2_WARMUP, _P1_D2_STRENGTH, EMOM_NOTES,
            _P1_D2_SWOLE, None,
            _P1_D2_ACC, ACC_EXTRA_SETS,
        ))
        workouts.append(_workout(
            "Full Body 3", 2, week,
            _P1_D3_WARMUP, _P1_D3_STRENGTH, EMOM_NOTES,
            _P1_D3_SWOLE, None,
            _P1_D3_ACC, ACC_TIMED_CIRCUIT,
        ))
    return workouts


# ---------------------------------------------------------------------------
# Phase 2: "The Build"
# ---------------------------------------------------------------------------

P2_EMOM_D1 = (
    "Set a timer for 12 minutes. Every 4 minutes, perform the following: "
    "5 Squats, 5 Z-Press, 5 Squats. Add weight on each set."
)
P2_EMOM_D2 = (
    "Set a timer for 12 minutes. Every 4 minutes, perform the following: "
    "5 Deadlifts, 5 Chin Ups, 5 Deadlifts. Add weight on each set."
)
P2_EMOM_D3 = (
    "Set a timer for 12 minutes. Every 4 minutes, perform the following: "
    "5 Deadlifts, 5 Rows, 5 Deadlifts. Add weight on each set."
)

# ── Day 1 warm-ups (rotate: W1&W3 same, W2&W4 same) ──
_P2_D1_WARMUP = {
    1: [
        _ex("Depth Jump", 3, "5", rest_period="0-10s",
            notes="Aim for knee height at most",
            sub1="Stand to Triple Extension"),
        _ex("Hanging Knee Raise", 3, "10", rest_period="0-10s",
            sub1="Lying Leg Raise"),
    ],
    2: [
        _ex("Vertical Jump", 3, "5", rest_period="0-10s",
            sub1="Stand to Triple Extension"),
        _ex("Full Range Crunch", 3, "10", rest_period="0-10s",
            sub1="Lying Leg Raise"),
    ],
    3: [
        _ex("Depth Jump", 3, "5", rest_period="0-10s",
            notes="Aim for knee height at most",
            sub1="Stand to Triple Extension"),
        _ex("Hanging Knee Raise", 3, "10", rest_period="0-10s",
            sub1="Lying Leg Raise"),
    ],
    4: [
        _ex("Vertical Jump", 3, "5", rest_period="0-10s",
            sub1="Stand to Triple Extension"),
        _ex("Full Range Crunch", 3, "10", rest_period="0-10s",
            sub1="Lying Leg Raise"),
    ],
}

# ── Day 2 warm-ups (same every week) ──
_P2_D2_WARMUP = [
    _ex("Hollowbody Hold", 3, "15s", rest_period="0-10s",
        notes="Pick a level of difficulty that is just manageable by the end",
        sub1="Plank"),
    _ex("Dead Hang", 3, "30s", rest_period="0-10s",
        notes="Place your feet on the ground to offload your bodyweight as needed"),
]

# ── Day 3 warm-ups (same every week) ──
_P2_D3_WARMUP = [
    _ex("Windmill", 3, "5 e/s", rest_period="0-10s",
        notes="Dumbbell, Kettlebell or Bodyweight"),
]

# ── Day 1 main exercises ──
_P2_D1_STRENGTH = [
    _ex("Barbell Squat", 6, "5", rest_period="-",
        sub1="Goblet Squat", sub2="Leg Press"),
    _ex("Z-Press", 3, "5", rest_period="-",
        sub1="Dumbbell Overhead Press", sub2="Incline Dumbbell Press"),
]
_P2_D1_SWOLE = [
    _ex("Incline Dumbbell Press", 1, "6-10", rest_period="0s",
        notes="2 second pause in the stretch on each rep.",
        sub1="Bench Press", sub2="Push Up"),
    _ex("B-Stance RDL", 1, "10 e/s", rest_period="0s",
        notes="2 second pause in the stretch on each rep",
        sub1="Dumbbell RDL"),
    _ex("Pike Pulse", 1, "10 e/s", rest_period="60s",
        notes="2 second pause at the top of each rep",
        sub1="Single Leg Raise"),
]
_P2_D1_ACC = [
    _ex("Face Pull", 1, "10-15", rest_period="0s",
        notes="2 second hold at the top of each rep",
        sub1="Prone Y Raise", sub2="Rear Delt Fly"),
    _ex("Incline Curl", 1, "10-15", rest_period="0s",
        sub1="Cable Curl", sub2="Preacher Curl"),
    _ex("Cross Body Triceps Extension", 1, "10-15 e/s", rest_period="0s",
        sub1="DB Cross Body Extension", sub2="DB Side Lying Ext"),
]

# ── Day 2 main exercises ──
_P2_D2_STRENGTH = [
    _ex("Deadlift", 6, "5", rest_period="-",
        sub1="DB Deadlift", sub2="Trap Bar Deadlift"),
    _ex("Chin Up", 3, "5", rest_period="-",
        sub1="Lat Pulldown", sub2="Inverted Row"),
]
_P2_D2_SWOLE_W12 = [
    _ex("DB Bulgarian Split Squat", 1, "8-12 e/s", rest_period="0s",
        notes="Pause in the bottom of each rep for 3 seconds",
        sub1="Single Leg Press", sub2="Smith Machine Split Squat"),
    _ex("Hip Flexor Plank", 1, "20s e/s", rest_period="60s",
        sub1="Plank"),
]
_P2_D2_SWOLE_W34 = [
    _ex("DB Bulgarian Split Squat", 1, "8-12 e/s", rest_period="0s",
        notes="1 & 1/4 reps. Go all the way down, 1/4 of the way up, all the way down, all the way up \u2014 that counts as 1 rep.",
        sub1="Single Leg Press", sub2="Smith Machine Split Squat"),
    _ex("Hip Flexor Plank", 1, "20s e/s", rest_period="60s",
        sub1="Plank"),
]
_P2_D2_ACC = [
    _ex("Bodyweight Skullcrusher", 1, "10-15", rest_period="0s",
        sub1="Close Grip Push Up", sub2="Skullcrusher"),
    _ex("Cable Row", 1, "10-15", rest_period="0s",
        notes="2 second hold at the top of each rep",
        sub1="Single DB Row", sub2="Barbell Row"),
    _ex("Side Lying Compound Raise", 1, "10-15 e/s", rest_period="0s",
        sub1="Y Raise", sub2="Cable Raise"),
]

# ── Day 3 main exercises ──
_P2_D3_STRENGTH = [
    _ex("Wide Deadlift", 6, "5", rest_period="-",
        sub1="DB Deadlift", sub2="Trap Bar Deadlift"),
    _ex("Dumbbell Row", 3, "5", rest_period="-",
        sub1="Cable Row", sub2="Inverted Row"),
]
_P2_D3_SWOLE_W12 = [
    _ex("Dumbbell Overhead Press", 1, "8-12", rest_period="0s",
        notes="1 & 1/4 reps. Go all the way down, 1/4 of the way up, all the way down, all the way up \u2014 that counts as 1 rep.",
        sub1="Incline Dumbbell Press", sub2="Landmine Press"),
    _ex("Glute Bridge", 1, "8-12", rest_period="0s",
        notes="2 second pause at the top of each rep"),
]
_P2_D3_SWOLE_W3 = [
    _ex("Dumbbell Overhead Press", 1, "8-12", rest_period="0s",
        notes="Regular reps \u2014 not 1 & 1/4",
        sub1="Incline Dumbbell Press", sub2="Landmine Press"),
    _ex("Glute Bridge", 1, "8-12", rest_period="0s",
        notes="2 second pause at the top of each rep"),
]
_P2_D3_SWOLE_W4 = [
    _ex("Dumbbell Overhead Press", 1, "8-12", rest_period="0s",
        notes="Regular reps. Not 1 & 1/4",
        sub1="Incline Dumbbell Press", sub2="Landmine Press"),
    _ex("Glute Bridge", 1, "8-12", rest_period="0s",
        notes="2 second pause at the top of each rep"),
]
_P2_D3_ACC = [
    _ex("Zercher March", 5, "30s", rest_period="0s",
        sub1="Backwards Sled Drag", sub2="Poliquin Step Up"),
    _ex("Russian Twist", 5, "10 e/s", rest_period="0s"),
]


def _build_phase2_workouts() -> list[dict]:
    workouts: list[dict] = []
    for week in range(1, 5):
        d2_swole = _P2_D2_SWOLE_W12 if week <= 2 else _P2_D2_SWOLE_W34
        if week <= 2:
            d3_swole = _P2_D3_SWOLE_W12
        elif week == 3:
            d3_swole = _P2_D3_SWOLE_W3
        else:
            d3_swole = _P2_D3_SWOLE_W4

        workouts.append(_workout(
            "Full Body 1", 0, week,
            _P2_D1_WARMUP[week], _P2_D1_STRENGTH, P2_EMOM_D1,
            _P2_D1_SWOLE, None,
            _P2_D1_ACC, None,
        ))
        workouts.append(_workout(
            "Full Body 2", 1, week,
            _P2_D2_WARMUP, _P2_D2_STRENGTH, P2_EMOM_D2,
            d2_swole, None,
            _P2_D2_ACC, None,
        ))
        workouts.append(_workout(
            "Full Body 3", 2, week,
            _P2_D3_WARMUP, _P2_D3_STRENGTH, P2_EMOM_D3,
            d3_swole, None,
            _P2_D3_ACC, ACC_TIMED_CIRCUIT,
        ))
    return workouts


# ---------------------------------------------------------------------------
# Phase 3: "The Peak"
# ---------------------------------------------------------------------------

P3_STRENGTH_D1 = (
    "Barbell Squat: Every 90 seconds for 5 total sets, perform 5 reps. "
    "Work up to a heavy weight by your last set. "
    "Z-Press: Every 2 minutes for 3 total sets, perform 10 reps."
)
P3_STRENGTH_D2 = (
    "Deadlift: Every 90 seconds for 5 total sets, perform 5 reps. "
    "Work up to a heavy weight by your last set. "
    "Chin Up: Every 2 minutes for 3 total sets, perform 10 reps."
)
P3_STRENGTH_D3 = (
    "Wide Deadlift: Every 90 seconds for 5 total sets, perform 5 reps. "
    "Work up to a heavy weight by your last set. "
    "Dumbbell Row: Every 2 minutes for 3 total sets, perform 10 reps."
)

# ── Day 1 warm-ups (W1&W3 same, W2 no notes, W4 with notes) ──
_P3_D1_WARMUP = {
    1: [
        _ex("Broad Jump", 3, "5", rest_period="0-10s",
            notes="Perform reps unbroken, or take a pause between each jump",
            sub1="Stand to Triple Extension"),
        _ex("Reverse Crunch", 3, "10", rest_period="0-10s",
            sub1="Lying Leg Raise", sub2="Knee Tuck"),
    ],
    2: [
        _ex("Lateral Jump", 3, "5", rest_period="0-10s",
            sub1="Stand to Triple Extension"),
        _ex("Cable Crunch", 3, "10", rest_period="0-10s",
            sub1="Lying Leg Raise", sub2="Knee Tuck"),
    ],
    3: [
        _ex("Broad Jump", 3, "5", rest_period="0-10s",
            notes="Perform reps unbroken, or take a pause between each jump",
            sub1="Stand to Triple Extension"),
        _ex("Reverse Crunch", 3, "10", rest_period="0-10s",
            sub1="Lying Leg Raise", sub2="Knee Tuck"),
    ],
    4: [
        _ex("Lateral Jump", 3, "5", rest_period="0-10s",
            notes="Perform reps unbroken, or take a pause between each jump",
            sub1="Stand to Triple Extension"),
        _ex("Cable Crunch", 3, "10", rest_period="0-10s",
            sub1="Lying Leg Raise", sub2="Knee Tuck"),
    ],
}

# ── Day 2 warm-ups (same every week) ──
_P3_D2_WARMUP = [
    _ex("Hollowbody Hold", 3, "15s", rest_period="0-10s",
        notes="Pick a level of difficulty that is just manageable by the end",
        sub1="Plank"),
    _ex("Scapula Circles", 3, "30s", rest_period="0-10s",
        notes="Place your feet on the ground to offload your bodyweight as needed",
        sub1="Dead Hang", sub2="Scapula Push Up"),
]

# ── Day 3 warm-ups (same every week) ──
_P3_D3_WARMUP = [
    _ex("Twisting Bear", 5, "5 e/s", rest_period="0-10s",
        notes="Flow through smoothly. If you need to, rest your hips on the ground during the transition as a mini rest."),
]

# ── Day 1 main exercises ──
_P3_D1_STRENGTH = [
    _ex("Barbell Squat", 5, "5", rest_period="-",
        notes="Every 90 seconds for 5 total sets, perform 5 reps of Squats. Work up to a heavy weight by your last set.",
        sub1="Goblet Squat", sub2="Leg Press"),
    _ex("Z-Press", 3, "10", rest_period="-",
        notes="Every 2 minutes for 3 total sets, perform 10 Z-Presses",
        sub1="Dumbbell Overhead Press", sub2="Incline Dumbbell Press"),
]
_P3_D1_SWOLE = [
    _ex("Dip", 1, "6-10", rest_period="0s",
        notes="2 second pause in the stretch on each rep.",
        sub1="Close Grip Push Up", sub2="Bench Dip"),
    _ex("Romanian Deadlift", 1, "6-10", rest_period="0s",
        notes="2 second pause in the stretch on each rep",
        sub1="Dumbbell RDL", sub2="45 Degree Hyperextension"),
    _ex("Horse Stance Good Morning", 1, "15", rest_period="60s",
        notes="This is a gentle mobility stretch. Don't push it hard",
        sub1="Seated Good Morning"),
]
_P3_D1_ACC = [
    _ex("Single Arm Cable Y Raise", 1, "10-15", rest_period="0s",
        notes="Finish each set with a cluster set. Go to failure, then take 10 seconds rest, then go again to failure.",
        sub1="Y Raise", sub2="Side Lying Compound Raise"),
    _ex("Preacher Curl", 1, "10-15", rest_period="0s",
        sub1="Cable Curl", sub2="Incline Curl"),
    _ex("Katana Extension", 1, "10-15 e/s", rest_period="0s",
        notes="Finish each set with a cluster set. Go to failure, then take 10 seconds rest, then go again to failure.",
        sub1="DB Cross Body Extension", sub2="DB Side Lying Ext"),
]

# ── Day 2 main exercises ──
_P3_D2_STRENGTH = [
    _ex("Deadlift", 5, "5", rest_period="-",
        notes="Every 90 seconds for 5 total sets, perform 5 reps of Deadlifts. Work up to a heavy weight by your last set.",
        sub1="DB Deadlift", sub2="Trap Bar Deadlift"),
    _ex("Chin Up", 3, "10", rest_period="-",
        notes="Every 2 minutes for 3 total sets, perform 10 Chin Ups",
        sub1="Lat Pulldown", sub2="Inverted Row"),
]
_P3_D2_SWOLE = [
    _ex("Walking Lunge", 1, "8-12 e/s", rest_period="0s",
        sub1="Single Leg Press", sub2="Smith Machine Split Squat"),
    _ex("Pike Raise", 1, "10 e/s", rest_period="60s",
        sub1="Plank", sub2="Hanging Knee Raise"),
]
_P3_D2_ACC = [
    _ex("Incline Skullcrusher", 1, "10-15", rest_period="0s",
        sub1="Bodyweight Skullcrusher", sub2="Close Grip Push Up"),
    _ex("Barbell Row", 1, "10-15", rest_period="0s",
        notes="2 second hold at the top of each rep",
        sub1="Single DB Row", sub2="DB Row - Dual"),
    _ex("Lateral Raise + Hold", 1, "10-15", rest_period="0s",
        notes="Hold the top for 10 seconds for 1 rep. Then, perform 10-15 full range reps.",
        sub1="Y Raise", sub2="Cable Raise"),
]

# ── Day 3 main exercises ──
_P3_D3_STRENGTH = [
    _ex("Wide Deadlift", 5, "5", rest_period="-",
        notes="Every 90 seconds for 5 total sets, perform 5 reps of Deadlifts. Work up to a heavy weight by your last set.",
        sub1="DB Deadlift", sub2="Trap Bar Deadlift"),
    _ex("Dumbbell Row", 3, "10", rest_period="-",
        notes="Every 2 minutes for 3 total sets, perform 10 Chin Ups",
        sub1="Cable Row", sub2="Inverted Row"),
]
_P3_D3_SWOLE = [
    _ex("Dumbbell Push Press", 1, "6-10", rest_period="0s",
        sub1="Incline Dumbbell Press", sub2="Landmine Press"),
    _ex("Hamstring Bridge", 1, "8-12", rest_period="0s",
        notes="2 second pause at the top of each rep"),
]
_P3_D3_ACC = [
    _ex("Box Step Over", 5, "60s", rest_period="0s"),
    _ex("Bicycle Crunch", 5, "10 e/s", rest_period="0s"),
]


def _build_phase3_workouts() -> list[dict]:
    workouts: list[dict] = []
    for week in range(1, 5):
        # Section notes on Strength only in Week 1
        d1_sn = P3_STRENGTH_D1 if week == 1 else None
        d2_sn = P3_STRENGTH_D2 if week == 1 else None
        d3_sn = P3_STRENGTH_D3 if week == 1 else None

        workouts.append(_workout(
            "Full Body 1", 0, week,
            _P3_D1_WARMUP[week], _P3_D1_STRENGTH, d1_sn,
            _P3_D1_SWOLE, None,
            _P3_D1_ACC, None,
        ))
        workouts.append(_workout(
            "Full Body 2", 1, week,
            _P3_D2_WARMUP, _P3_D2_STRENGTH, d2_sn,
            _P3_D2_SWOLE, None,
            _P3_D2_ACC, None,
        ))
        workouts.append(_workout(
            "Full Body 3", 2, week,
            _P3_D3_WARMUP, _P3_D3_STRENGTH, d3_sn,
            _P3_D3_SWOLE, None,
            _P3_D3_ACC, ACC_TIMED_CIRCUIT,
        ))
    return workouts


# ---------------------------------------------------------------------------
# Full program data
# ---------------------------------------------------------------------------

minimalift_program_data: dict = {
    "name": "Minimalift 3-Day Full Body",
    "phases": [
        {
            "name": "The Base",
            "description": "Foundation building - establish movement patterns and base strength",
            "duration_weeks": 4,
            "workouts": _build_phase1_workouts(),
        },
        {
            "name": "The Build",
            "description": "Progressive overload - increase intensity and volume",
            "duration_weeks": 4,
            "workouts": _build_phase2_workouts(),
        },
        {
            "name": "The Peak",
            "description": "Performance phase - peak strength and power expression",
            "duration_weeks": 4,
            "workouts": _build_phase3_workouts(),
        },
    ],
}


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

async def seed_minimalift_exercises(db: AsyncSession) -> None:
    """Seed Minimalift-specific exercises, skipping any that already exist by name."""
    from app.models import Exercise

    result = await db.execute(select(Exercise).where(Exercise.user_id.is_(None)))
    existing_names = {e.name for e in result.scalars().all()}

    for data in minimalift_exercises_data:
        if data["name"] in existing_names:
            continue
        exercise = Exercise(
            user_id=None,
            is_custom=False,
            name=data["name"],
            muscle_group=data["muscle_group"],
            equipment=data.get("equipment"),
            youtube_url=data.get("youtube_url"),
            exercise_type=data.get("exercise_type", "reps"),
        )
        db.add(exercise)

    await db.flush()


async def seed_minimalift_program(db: AsyncSession) -> None:
    """Create the shared Minimalift 3-Day Full Body phased program blueprint (idempotent)."""
    from app.models import (
        Exercise,
        Program,
        ProgramPhase,
        PhaseWorkout,
        PhaseWorkoutSection,
        PhaseWorkoutExercise,
    )

    existing = await db.execute(
        select(Program).where(Program.id == SHARED_MINIMALIFT_PROGRAM_ID)
    )
    if existing.scalar_one_or_none() is not None:
        return

    # Build exercise name -> id lookup from global exercises
    result = await db.execute(
        select(Exercise).where(Exercise.user_id.is_(None))
    )
    name_to_id: dict[str, str] = {
        e.name: e.id for e in result.scalars().all()
    }

    data = minimalift_program_data

    program = Program(
        id=SHARED_MINIMALIFT_PROGRAM_ID,
        user_id=None,  # shared
        name=data["name"],
        program_type="phased",
    )
    db.add(program)
    await db.flush()

    for phase_order, phase_data in enumerate(data["phases"]):
        phase_id = _shared_id(f"ml:phase:{phase_order}")
        phase = ProgramPhase(
            id=phase_id,
            program_id=SHARED_MINIMALIFT_PROGRAM_ID,
            name=phase_data["name"],
            description=phase_data["description"],
            order=phase_order,
            duration_weeks=phase_data["duration_weeks"],
        )
        db.add(phase)
        await db.flush()

        for workout_data in phase_data["workouts"]:
            wo_id = _shared_id(
                f"ml:workout:{phase_order}:{workout_data['day_index']}:{workout_data['week_number']}"
            )
            workout = PhaseWorkout(
                id=wo_id,
                phase_id=phase_id,
                name=workout_data["name"],
                day_index=workout_data["day_index"],
                week_number=workout_data["week_number"],
            )
            db.add(workout)
            await db.flush()

            for section_order, section_data in enumerate(workout_data["sections"]):
                sec_id = _shared_id(
                    f"ml:section:{phase_order}:{workout_data['day_index']}:{workout_data['week_number']}:{section_order}"
                )
                section = PhaseWorkoutSection(
                    id=sec_id,
                    workout_id=wo_id,
                    name=section_data["name"],
                    order=section_order,
                    notes=section_data.get("notes"),
                )
                db.add(section)
                await db.flush()

                for ex_order, ex_data in enumerate(section_data["exercises"]):
                    exercise_id = name_to_id.get(ex_data["name"])
                    if exercise_id is None:
                        continue

                    sub1_id = (
                        name_to_id.get(ex_data["sub1"])
                        if ex_data.get("sub1")
                        else None
                    )
                    sub2_id = (
                        name_to_id.get(ex_data["sub2"])
                        if ex_data.get("sub2")
                        else None
                    )

                    pwe_id = _shared_id(
                        f"ml:pwe:{phase_order}:{workout_data['day_index']}:{workout_data['week_number']}:{section_order}:{ex_order}"
                    )
                    pwe = PhaseWorkoutExercise(
                        id=pwe_id,
                        section_id=sec_id,
                        exercise_id=exercise_id,
                        order=ex_order,
                        working_sets=ex_data["working_sets"],
                        reps_display=ex_data["reps_display"],
                        rest_period=ex_data.get("rest_period"),
                        warmup_sets=ex_data.get("warmup_sets", 0),
                        notes=ex_data.get("notes"),
                        substitute1_exercise_id=sub1_id,
                        substitute2_exercise_id=sub2_id,
                    )
                    db.add(pwe)

    await db.commit()
