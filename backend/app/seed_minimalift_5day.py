"""Minimalift 5-Day Upper/Lower/Full Body program seed data.

Exercises and program structure sourced from the official Minimalift JSON.
All three phases are fully implemented.
"""

from uuid import uuid5, NAMESPACE_URL

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def _shared_id(key: str) -> str:
    """Generate a deterministic UUID for shared/seeded data."""
    return str(uuid5(NAMESPACE_URL, f"shared:{key}"))


SHARED_MINIMALIFT_5DAY_PROGRAM_ID = _shared_id("ml5:program")

# ---------------------------------------------------------------------------
# New exercises used by the 5-Day program (skips any that already exist)
# ---------------------------------------------------------------------------

minimalift_5day_exercises_data: list[dict] = [
    {"name": "Air Squats", "muscle_group": "Quads", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/4jgdT9C"},
    {"name": "Bear Crawl", "muscle_group": "Full Body", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3Y1vhGL"},
    {"name": "Box Squat", "muscle_group": "Quads", "equipment": "Barbell", "youtube_url": "https://bit.ly/42jTavI"},
    {"name": "Burpee", "muscle_group": "Full Body", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3Y4coTF"},
    {"name": "Couch Stretch", "muscle_group": "Quads", "equipment": "Bodyweight", "exercise_type": "timed", "youtube_url": "https://bit.ly/4jqUVNy"},
    {"name": "Dual Elevated Hip Thrust", "muscle_group": "Glutes", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/42AqMEn"},
    {"name": "Dumbbell Clean & Press", "muscle_group": "Full Body", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/4je41gy"},
    {"name": "Dumbbell Thruster", "muscle_group": "Full Body", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/44uy5jt"},
    {"name": "Kettlebell Swing", "muscle_group": "Full Body", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/4jiJcAO"},
    {"name": "Long Lunge Hold", "muscle_group": "Quads", "equipment": "Bodyweight", "exercise_type": "timed", "youtube_url": "https://bit.ly/4jad5De"},
    {"name": "Paused Deadlift", "muscle_group": "Back", "equipment": "Barbell", "youtube_url": "https://bit.ly/44AtnAN"},
    {"name": "Platz Stretch", "muscle_group": "Quads", "equipment": "Bodyweight", "exercise_type": "timed", "youtube_url": "https://bit.ly/4jgQKnK"},
    {"name": "Pull Up", "muscle_group": "Back", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/3GdkNxU"},
    {"name": "Renegade Row", "muscle_group": "Back", "equipment": "Dumbbell", "youtube_url": "https://bit.ly/4jirQEe"},
    {"name": "Seated Shoulder Extension", "muscle_group": "Shoulders", "equipment": "Bodyweight", "exercise_type": "timed", "youtube_url": "https://bit.ly/4jnMnY8"},
    {"name": "Seated Vertical Jump", "muscle_group": "Quads", "equipment": "Bodyweight", "youtube_url": "https://bit.ly/4jgDnUB"},
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
             sections: list[tuple[str, str | None, list[dict]]]) -> dict:
    """Build a workout dict with flexible sections.

    Each section is a tuple of (section_name, section_notes, exercises).
    """
    return {
        "name": name,
        "day_index": day_index,
        "week_number": week_number,
        "sections": [
            {"name": sname, "notes": snotes, "exercises": sexercises}
            for sname, snotes, sexercises in sections
        ],
    }


# ---------------------------------------------------------------------------
# Phase 1: "The Base"
# ---------------------------------------------------------------------------

_P1_D1_WARMUP = {
    1: [
        _ex('Pogos', 3, '20',
                rest_period='0-10s',
                notes="Stay light on your feet and keep your knees soft",
                sub1='Calf Raise',
                sub2='Stand to Triple Extension'),
    ],
    2: [
        _ex('Split Stance Pogos', 3, '10e/s',
                rest_period='0-10s',
                notes="Stay light on your feet and keep your knees soft",
                sub1='Calf Raise',
                sub2='Stand to Triple Extension'),
    ],
    3: [
        _ex('Split Exchange Pogos', 3, '10e/s',
                rest_period='0-10s',
                notes="Stay light on your feet and keep your knees soft",
                sub1='Calf Raise',
                sub2='Stand to Triple Extension'),
    ],
    4: [
        _ex('Wall Assisted Pogo', 3, '20',
                rest_period='0-10s',
                notes="Go for extra height here using the wall assist",
                sub1='Calf Raise'),
    ],
}

_P1_D1_STRENGTH = {
    1: [
        _ex('Barbell Squat', 1, '3',
                rest_period='-',
                notes="AMRAP — First, work up to a hard 8-10 reps. Then, start a 15 minute timer and perform as many rounds as possible of 3 reps. Track total rounds completed.",
                sub1='Goblet Squat',
                sub2='Leg Press'),
        _ex('Knee Tuck', 1, '8',
                rest_period='-',
                notes="AMRAP — After each set of Squats, perform the core exercise. Then, rest as required before returning to squats"),
    ],
    2: [
        _ex('Barbell Squat', 1, '3',
                rest_period='-',
                notes="AMRAP — First, work up to a hard 8-10 reps. Then, start a 15 minute timer and perform as many rounds as possible of 3 reps. Track total rounds completed.",
                sub1='Goblet Squat',
                sub2='Leg Press'),
        _ex('Single Leg Lift', 1, '8',
                rest_period='-',
                notes="AMRAP — After each set of Squats, perform the core exercise. Then, rest as required before returning to squats"),
    ],
    3: [
        _ex('Barbell Squat', 1, '3',
                rest_period='-',
                notes="AMRAP — First, work up to a hard 8-10 reps. Then, start a 15 minute timer and perform as many rounds as possible of 3 reps. Track total rounds completed.",
                sub1='Goblet Squat',
                sub2='Leg Press'),
        _ex('Lying Leg Raise', 1, '8',
                rest_period='-',
                notes="AMRAP — After each set of Squats, perform the core exercise. Then, rest as required before returning to squats"),
    ],
    4: [
        _ex('Barbell Squat', 1, '3',
                rest_period='-',
                notes="AMRAP — First, work up to a hard 8-10 reps. Then, start a 15 minute timer and perform as many rounds as possible of 3 reps. Track total rounds completed.",
                sub1='Goblet Squat',
                sub2='Leg Press'),
        _ex('Hanging Knee Raise', 1, '8',
                rest_period='-',
                notes="AMRAP — After each set of Squats, perform the core exercise. Then, rest as required before returning to squats"),
    ],
}

_P1_D1_SWOLE = [
    _ex('Dumbbell RDL', 2, '6-10',
            rest_period='60s',
            notes="Pause on final rep for 10 seconds in the stretch position",
            sub1='Barbell RDL',
            sub2='Single Leg RDL'),
]

_P1_D1_ACC = [
    _ex('Seated Good Morning', 2, '10-15',
            rest_period='0s',
            notes="2 second pause at the bottom of each rep."),
    _ex('Couch Stretch', 2, '30s e/s',
            rest_period='60s',
            notes="Perform this immediately after each set of SGMs, then rest and return to SGMs"),
]

_P1_D2_WARMUP = [
    _ex('Scapula Pull Up', 3, '10',
            rest_period='0-10s',
            notes="Place your feet on the ground to offload your bodyweight as needed"),
]

_P1_D2_STRENGTH = [
    _ex('Z-Press', 1, '3',
            rest_period='-',
            notes="AMRAP — First, work up to a hard 8-10 reps on both exercises. Then, start a 15 minute timer and perform as many rounds as possible of 3 reps on each exercise. Rest as needed. Track total rounds completed.",
            sub1='Dumbbell Overhead Press',
            sub2='Incline Dumbbell Press'),
    _ex('Chin Up', 1, '3',
            rest_period='-',
            notes="AMRAP",
            sub1='Lat Pulldown',
            sub2='Inverted Row'),
]

_P1_D2_SWOLE = [
    _ex('Dumbbell Press', 2, '6-10',
            rest_period='0s',
            notes="For additional gains, you can increase by 1 to 2 sets per exercise.",
            sub1='Bench Press',
            sub2='Push Up'),
    _ex('Scapula Push Up', 2, '10',
            rest_period='60s',
            notes="Perform immediately after each set of Dumbbell Presses, then rest before returning to Dumbbell Press",
            sub1='Cat Cow',
            sub2='Plank'),
]

_P1_D2_ACC = [
    _ex('Pullover + Skullcrusher', 2, '10-15',
            rest_period='0s',
            notes="Perform as a superset - minimal rest between exercises",
            sub1='Triceps Extension'),
    _ex('Dumbbell Row', 2, '10-15',
            rest_period='0s',
            notes="Perform as a superset - minimal rest between exercises",
            sub1='Single DB Row',
            sub2='Cable Row'),
    _ex('Halos (KB or DB)', 2, '10-15',
            rest_period='60s',
            notes="Perform as a superset - minimal rest between exercises"),
]

_P1_D3_WARMUP = [
    _ex('Turkish Get Up', 3, '5 e/s',
            rest_period='0-10s',
            notes="Dumbbell, Kettlebell or Bodyweight"),
]

_P1_D3_STRENGTH = [
    _ex('Deadlift', 1, '3',
            rest_period='-',
            notes="AMRAP — First, work up to a hard 8-10 reps. Then, start a 15 minute timer and perform as many rounds as possible of 3 reps. Track total rounds completed.",
            sub1='DB Deadlift',
            sub2='Trap Bar Deadlift'),
    _ex('Hollowbody Hold', 1, '10s',
            rest_period='-',
            notes="AMRAP — Between each set of Deadlifts, perform a set of Hollow Holds. Rest as needed, then return to Deadlifts. Pick a level of difficulty that is just manageable by the end",
            sub1='Plank'),
]

_P1_D3_SWOLE = [
    _ex('Deficit Reverse Lunge', 2, '8-12 e/s',
            rest_period='0s',
            notes="Perform all reps on one side before switching to the other leg",
            sub1='Single Leg Press',
            sub2='Split Squat'),
    _ex('Copenhagen Plank', 2, '20s e/s',
            rest_period='60s',
            notes="Select your choice of difficulty"),
]

_P1_D3_ACC = [
    _ex('Backwards Treadmill Walk', 5, '60s',
            rest_period='0s',
            notes="Perform both exercises as a timed circuit. No rest between exercises. 30s rest between rounds",
            sub1='Backwards Sled Drag',
            sub2='Poliquin Step Up'),
    _ex('Suitcase March', 5, '30s e/s',
            rest_period='0s',
            notes="Perform stationary if space is limited. Switch the starting arm on each round"),
]

_P1_D4_WARMUP = [
    _ex('Scapula Pull Up', 3, '10',
            rest_period='0-10s',
            notes="Place your feet on the ground to offload your bodyweight as needed"),
]

_P1_D4_STRENGTH = [
    _ex('Bench Press', 1, '3',
            rest_period='-',
            notes="AMRAP — First, work up to a hard 8-10 reps on both exercises. Then, start a 15 minute timer and perform as many rounds as possible of 3 reps on each exercise. Rest as needed. Track total rounds completed.",
            sub1='Dumbbell Press',
            sub2='Push Up'),
    _ex('Dumbbell Row', 1, '3',
            rest_period='-',
            notes="AMRAP",
            sub1='Cable Row',
            sub2='Inverted Row'),
]

_P1_D4_SWOLE = [
    _ex('Close Grip Bench Press', 2, '8-12',
            rest_period='0s',
            notes="1 & ¼ reps. Go all the way down, ¼ of the way up, all the way down, all the way up - that counts as 1 rep.",
            sub1='Close Grip Push Up',
            sub2='Dip'),
    _ex('Seated Shoulder Extension', 2, '30s',
            rest_period='60s',
            notes="Do this immediately after each set of CGBP. Then rest and return to CGBP"),
]

_P1_D4_ACC = [
    _ex('Y Raise', 2, '10-15',
            rest_period='0s',
            notes="Perform as a superset - minimal rest between exercises",
            sub1='DB Lateral Raise',
            sub2='Band Lateral Raise'),
    _ex('Squat Curl', 2, '10-15',
            rest_period='0s',
            notes="Perform as a superset - minimal rest between exercises",
            sub1='Incline Curl',
            sub2='Preacher Curl'),
    _ex('Katana Extension', 2, '10-15',
            rest_period='60s',
            notes="Perform as a superset - minimal rest between exercises",
            sub1='DB Overhead Ext',
            sub2='DB Side Lying Ext'),
]

_P1_D5_WARMUP = [
    _ex('Bear Crawl', 3, '10m',
            rest_period='0-10s',
            notes="Count your reps as steps - 10 reps forwards, 10 reps back"),
]

_P1_D5_STRENGTH = [
    _ex('Box Squat', 3, '5-7',
            rest_period='60',
            notes="Perform all reps explosively. Keep the weight slightly below a true max (70-80%) to ensure you can maintain max power and speed.",
            sub1='DB Deadlift',
            sub2='Trap Bar Deadlift'),
    _ex('Vertical Jump', 3, '3-5',
            rest_period='60',
            sub1='Stand to Triple Extension'),
]

_P1_D5_SWOLE = [
    _ex('Chin Up', 3, '6-10',
            rest_period='0s',
            notes="Perform as a superset - minimal rest between exercises",
            sub1='Lat Pulldown',
            sub2='Inverted Row'),
    _ex('Kettlebell Swing', 3, '20',
            rest_period='60s',
            notes="Perform as a superset - minimal rest between exercises"),
]

_P1_D5_METCON = [
    _ex('Dumbbell Thruster', 5, '10',
            rest_period='0s',
            notes="Pace yourself - you’re going to get seriously gassed from this superset!",
            sub1='Dumbbell Overhead Press',
            sub2='Dumbbell Push Press'),
    _ex('Plank', 5, '30s',
            rest_period='0s',
            notes="This is your rest period between rounds of Thrusters."),
]


def _build_phase1_workouts() -> list[dict]:
    workouts: list[dict] = []
    for week in range(1, 5):
        workouts.append(_workout(
            "Lower Body 1", 0, week,
            [
                ("Warm Up", None, _P1_D1_WARMUP[week]),
                ("Strength & Condition", None, _P1_D1_STRENGTH[week]),
                ("Swole & Flexy", None, _P1_D1_SWOLE),
                ("Accessories", None, _P1_D1_ACC),
            ],
        ))
        workouts.append(_workout(
            "Upper Body 1", 1, week,
            [
                ("Warm Up", None, _P1_D2_WARMUP),
                ("Strength & Condition", None, _P1_D2_STRENGTH),
                ("Swole & Flexy", None, _P1_D2_SWOLE),
                ("Accessories", None, _P1_D2_ACC),
            ],
        ))
        workouts.append(_workout(
            "Lower Body 2", 2, week,
            [
                ("Warm Up", None, _P1_D3_WARMUP),
                ("Strength & Condition", None, _P1_D3_STRENGTH),
                ("Swole & Flexy", None, _P1_D3_SWOLE),
                ("Accessories", None, _P1_D3_ACC),
            ],
        ))
        workouts.append(_workout(
            "Upper Body 2", 3, week,
            [
                ("Warm Up", None, _P1_D4_WARMUP),
                ("Strength & Condition", None, _P1_D4_STRENGTH),
                ("Swole & Flexy", None, _P1_D4_SWOLE),
                ("Accessories", None, _P1_D4_ACC),
            ],
        ))
        workouts.append(_workout(
            "Full Body", 4, week,
            [
                ("Warm Up", None, _P1_D5_WARMUP),
                ("Strength & Condition", None, _P1_D5_STRENGTH),
                ("Swole & Flexy", None, _P1_D5_SWOLE),
                ("Metabolic Conditioning", None, _P1_D5_METCON),
            ],
        ))
    return workouts


# ---------------------------------------------------------------------------
# Phase 2: "The Build"
# ---------------------------------------------------------------------------

_P2_D1_WARMUP = {
    1: [
        _ex('Depth Jump', 3, '5',
                rest_period='0-10s',
                notes="Aim for knee height at most",
                sub1='Stand to Triple Extension'),
    ],
    2: [
        _ex('Vertical Jump', 3, '5',
                rest_period='0-10s',
                sub1='Stand to Triple Extension'),
    ],
    3: [
        _ex('Depth Jump', 3, '5',
                rest_period='0-10s',
                notes="Aim for knee height at most",
                sub1='Stand to Triple Extension'),
    ],
    4: [
        _ex('Vertical Jump', 3, '5',
                rest_period='0-10s',
                sub1='Stand to Triple Extension'),
    ],
}

_P2_D1_STRENGTH = {
    1: [
        _ex('Barbell Squat', 10, '3-5',
                rest_period='-',
                notes="Warm up as required. Set a timer for 10 minutes. EMOM, do the following: Minute 1: 1 set of 5 at 6 RIR Minute 2: 1 set of 5 at 4 RIR Minute 3-10: Sets of 3-5 at 3 RIR",
                sub1='Goblet Squat',
                sub2='Leg Press'),
        _ex('Hanging Knee Raise', 1, '8',
                rest_period='-',
                notes="AMRAP — After each set of Squats, perform the core exercise. Then, rest as required before returning to squats",
                sub1='Lying Leg Raise'),
    ],
    2: [
        _ex('Barbell Squat', 10, '3-5',
                rest_period='-',
                notes="Warm up as required. Set a timer for 10 minutes. EMOM, do the following: Minute 1: 1 set of 5 at 6 RIR Minute 2: 1 set of 5 at 4 RIR Minute 3-10: Sets of 3-5 at 2-3 RIR",
                sub1='Goblet Squat',
                sub2='Leg Press'),
        _ex('Full Range Crunch', 3, '10',
                rest_period='0-10s',
                sub1='Lying Leg Raise'),
    ],
    3: [
        _ex('Barbell Squat', 10, '3-5',
                rest_period='-',
                notes="Warm up as required. Set a timer for 10 minutes. EMOM, do the following: Minute 1: 1 set of 5 at 6 RIR Minute 2: 1 set of 5 at 4 RIR Minute 3-10: Sets of 3-5 at 2-3 RIR",
                sub1='Goblet Squat',
                sub2='Leg Press'),
        _ex('Hanging Knee Raise', 1, '8',
                rest_period='-',
                notes="AMRAP — After each set of Squats, perform the core exercise. Then, rest as required before returning to squats",
                sub1='Lying Leg Raise'),
    ],
    4: [
        _ex('Barbell Squat', 10, '3-5',
                rest_period='-',
                notes="Warm up as required. Set a timer for 10 minutes. EMOM, do the following: Minute 1: 1 set of 5 at 6 RIR Minute 2: 1 set of 5 at 4 RIR Minute 3-10: Sets of 3-5 at 1-2 RIR",
                sub1='Goblet Squat',
                sub2='Leg Press'),
        _ex('Hanging Knee Raise', 1, '8',
                rest_period='-',
                notes="AMRAP — After each set of Squats, perform the core exercise. Then, rest as required before returning to squats",
                sub1='Lying Leg Raise'),
    ],
}

_P2_D1_SWOLE = [
    _ex('B-Stance RDL', 2, '10 e/s',
            rest_period='0s',
            notes="2 second pause in the stretch on each rep",
            sub1='Dumbbell RDL'),
    _ex('Pike Pulse', 2, '10 e/s',
            rest_period='60s',
            notes="2 second pause at the top of each rep",
            sub1='Single Leg Raise'),
]

_P2_D1_ACC = [
    _ex('Dual Elevated Hip Thrust', 2, '8-12',
            rest_period='0s',
            notes="2 second pause at the top of each rep",
            sub1='Glute Bridge'),
    _ex('Platz Stretch', 2, '30s',
            rest_period='60s',
            notes="Perform this immediately after each set of Hip Thrusts, then rest and return to Hip Thrusts",
            sub1='Couch Stretch'),
]

_P2_D2_WARMUP = [
    _ex('Scapula Circles', 3, '10',
            rest_period='0-10s',
            notes="Place your feet on the ground to offload your bodyweight as needed"),
]

_P2_D2_STRENGTH = {
    1: [
        _ex('Z-Press', 10, '3-5',
                rest_period='-',
                notes="Warm up as required. Set a timer for 20 minutes. E2MOM, do the following: Minute 1: 1 set of 5 at 6 RIR Minute 2: 1 set of 5 at 4 RIR Minute 3-10: Sets of 3-5 at 3 RIR",
                sub1='Dumbbell Overhead Press',
                sub2='Incline Dumbbell Press'),
        _ex('Chin Up', 10, '3-5',
                rest_period='-',
                sub1='Lat Pulldown',
                sub2='Inverted Row'),
    ],
    2: [
        _ex('Z-Press', 10, '3-5',
                rest_period='-',
                notes="Warm up as required. Set a timer for 20 minutes. E2MOM, do the following: Minute 1: 1 set of 5 at 6 RIR Minute 2: 1 set of 5 at 4 RIR Minute 3-10: Sets of 3-5 at 2-3 RIR",
                sub1='Dumbbell Overhead Press',
                sub2='Incline Dumbbell Press'),
        _ex('Chin Up', 10, '3-5',
                rest_period='-',
                sub1='Lat Pulldown',
                sub2='Inverted Row'),
    ],
    3: [
        _ex('Z-Press', 10, '3-5',
                rest_period='-',
                notes="Warm up as required. Set a timer for 20 minutes. E2MOM, do the following: Minute 1: 1 set of 5 at 6 RIR Minute 2: 1 set of 5 at 4 RIR Minute 3-10: Sets of 3-5 at 2-3 RIR",
                sub1='Dumbbell Overhead Press',
                sub2='Incline Dumbbell Press'),
        _ex('Chin Up', 10, '3-5',
                rest_period='-',
                sub1='Lat Pulldown',
                sub2='Inverted Row'),
    ],
    4: [
        _ex('Z-Press', 10, '3-5',
                rest_period='-',
                notes="Warm up as required. Set a timer for 20 minutes. E2MOM, do the following: Minute 1: 1 set of 5 at 6 RIR Minute 2: 1 set of 5 at 4 RIR Minute 3-10: Sets of 3-5 at 1-2 RIR",
                sub1='Dumbbell Overhead Press',
                sub2='Incline Dumbbell Press'),
        _ex('Chin Up', 10, '3-5',
                rest_period='-',
                sub1='Lat Pulldown',
                sub2='Inverted Row'),
    ],
}

_P2_D2_SWOLE = [
    _ex('Incline Dumbbell Press', 2, '6-10',
            rest_period='0s',
            notes="2 second pause in the stretch on each rep.",
            sub1='Bench Press',
            sub2='Push Up'),
    _ex('Scapula Push Up', 2, '10',
            rest_period='60s',
            notes="Perform immediately after each set of Dumbbell Presses, then rest before returning to Dumbbell Press",
            sub1='Cat Cow',
            sub2='Plank'),
]

_P2_D2_ACC = [
    _ex('Bodyweight Skullcrusher', 2, '10-15',
            rest_period='0s',
            notes="Perform as a superset - no rest between exercises.",
            sub1='Close Grip Push Up',
            sub2='Skullcrusher'),
    _ex('Cable Row', 2, '10-15',
            rest_period='0s',
            notes="2 second hold at the top of each rep Perform as a superset - no rest between exercises.",
            sub1='Single DB Row',
            sub2='Barbell Row'),
    _ex('Side Lying Compound Raise', 2, '10-15 e/s',
            rest_period='60s',
            notes="Switch the starting arm on each round. Perform as a superset - no rest between exercises.",
            sub1='Y Raise',
            sub2='Cable Raise'),
]

_P2_D3_WARMUP = [
    _ex('Seated Vertical Jump', 3, '5',
            rest_period='0-10s',
            sub1='Stand to Triple Extension'),
]

_P2_D3_STRENGTH = {
    1: [
        _ex('Deadlift', 10, '3-5',
                rest_period='-',
                notes="Warm up as required. Set a timer for 10 minutes. EMOM, do the following: Minute 1: 1 set of 5 at 6 RIR Minute 2: 1 set of 5 at 4 RIR Minute 3-10: Sets of 3-5 at 3 RIR",
                sub1='DB Deadlift',
                sub2='Trap Bar Deadlift'),
        _ex('Hollowbody Hold', 10, '10s',
                rest_period='-',
                notes="Between each set of Deadlifts, perform a set of Hollow Holds. Rest as needed, then return to Deadlifts. Pick a level of difficulty that is just manageable by the end",
                sub1='Plank'),
    ],
    2: [
        _ex('Deadlift', 10, '3-5',
                rest_period='-',
                notes="Warm up as required. Set a timer for 10 minutes. EMOM, do the following: Minute 1: 1 set of 5 at 6 RIR Minute 2: 1 set of 5 at 4 RIR Minute 3-10: Sets of 3-5 at 2-3 RIR",
                sub1='DB Deadlift',
                sub2='Trap Bar Deadlift'),
        _ex('Hollowbody Hold', 10, '10s',
                rest_period='-',
                notes="Between each set of Deadlifts, perform a set of Hollow Holds. Rest as needed, then return to Deadlifts. Pick a level of difficulty that is just manageable by the end",
                sub1='Plank'),
    ],
    3: [
        _ex('Deadlift', 10, '3-5',
                rest_period='-',
                notes="Warm up as required. Set a timer for 10 minutes. EMOM, do the following: Minute 1: 1 set of 5 at 6 RIR Minute 2: 1 set of 5 at 4 RIR Minute 3-10: Sets of 3-5 at 2-3 RIR",
                sub1='DB Deadlift',
                sub2='Trap Bar Deadlift'),
        _ex('Hollowbody Hold', 10, '10s',
                rest_period='-',
                notes="Between each set of Deadlifts, perform a set of Hollow Holds. Rest as needed, then return to Deadlifts. Pick a level of difficulty that is just manageable by the end",
                sub1='Plank'),
    ],
    4: [
        _ex('Deadlift', 10, '3-5',
                rest_period='-',
                notes="Warm up as required. Set a timer for 10 minutes. EMOM, do the following: Minute 1: 1 set of 5 at 6 RIR Minute 2: 1 set of 5 at 4 RIR Minute 3-10: Sets of 3-5 at 1-2 RIR",
                sub1='DB Deadlift',
                sub2='Trap Bar Deadlift'),
        _ex('Hollowbody Hold', 10, '10s',
                rest_period='-',
                notes="Between each set of Deadlifts, perform a set of Hollow Holds. Rest as needed, then return to Deadlifts. Pick a level of difficulty that is just manageable by the end",
                sub1='Plank'),
    ],
}

_P2_D3_SWOLE = {
    1: [
        _ex('DB Bulgarian Split Squat', 1, '8-12 e/s',
                rest_period='0s',
                notes="Pause in the bottom of each rep for 3 seconds",
                sub1='Single Leg Press',
                sub2='Smith Machine Split Squat'),
        _ex('Hip Flexor Plank', 1, '20s e/s',
                rest_period='60s',
                sub1='Plank'),
    ],
    2: [
        _ex('DB Bulgarian Split Squat', 2, '8-12 e/s',
                rest_period='0s',
                notes="Pause in the bottom of each rep for 3 seconds",
                sub1='Single Leg Press',
                sub2='Smith Machine Split Squat'),
        _ex('Hip Flexor Plank', 2, '20s e/s',
                rest_period='60s',
                sub1='Plank'),
    ],
    3: [
        _ex('DB Bulgarian Split Squat', 2, '8-12 e/s',
                rest_period='0s',
                notes="Pause in the bottom of each rep for 3 seconds",
                sub1='Single Leg Press',
                sub2='Smith Machine Split Squat'),
        _ex('Hip Flexor Plank', 2, '20s e/s',
                rest_period='60s',
                sub1='Plank'),
    ],
    4: [
        _ex('DB Bulgarian Split Squat', 2, '8-12 e/s',
                rest_period='0s',
                notes="Pause in the bottom of each rep for 3 seconds",
                sub1='Single Leg Press',
                sub2='Smith Machine Split Squat'),
        _ex('Hip Flexor Plank', 2, '20s e/s',
                rest_period='60s',
                sub1='Plank'),
    ],
}

_P2_D3_ACC = [
    _ex('Zercher March', 5, '30s',
            rest_period='0s',
            notes="Perform both exercises as a timed circuit. No rest between exercises. 30s rest between rounds",
            sub1='Backwards Sled Drag',
            sub2='Poliquin Step Up'),
    _ex('Russian Twist', 5, '10 e/s',
            rest_period='0s'),
]

_P2_D4_WARMUP = [
    _ex('Turkish Get Up', 3, '5 e/s',
            rest_period='0-10s',
            notes="Dumbbell, Kettlebell or Bodyweight"),
]

_P2_D4_STRENGTH = {
    1: [
        _ex('Bench Press', 1, '3',
                rest_period='-',
                notes="AMRAP — Warm up as required. Set a timer for 20 minutes. E2MOM, do the following: Minute 1: 1 set of 5 at 6 RIR Minute 2: 1 set of 5 at 4 RIR Minute 3-10: Sets of 3-5 at 3 RIR",
                sub1='Dumbbell Press',
                sub2='Push Up'),
        _ex('Dumbbell Row', 1, '3',
                rest_period='-',
                notes="AMRAP",
                sub1='Cable Row',
                sub2='Inverted Row'),
    ],
    2: [
        _ex('Bench Press', 1, '3',
                rest_period='-',
                notes="AMRAP — Warm up as required. Set a timer for 20 minutes. E2MOM, do the following: Minute 1: 1 set of 5 at 6 RIR Minute 2: 1 set of 5 at 4 RIR Minute 3-10: Sets of 3-5 at 2-3 RIR",
                sub1='Dumbbell Press',
                sub2='Push Up'),
        _ex('Dumbbell Row', 1, '3',
                rest_period='-',
                notes="AMRAP",
                sub1='Cable Row',
                sub2='Inverted Row'),
    ],
    3: [
        _ex('Bench Press', 1, '3',
                rest_period='-',
                notes="AMRAP — Warm up as required. Set a timer for 20 minutes. E2MOM, do the following: Minute 1: 1 set of 5 at 6 RIR Minute 2: 1 set of 5 at 4 RIR Minute 3-10: Sets of 3-5 at 2-3 RIR",
                sub1='Dumbbell Press',
                sub2='Push Up'),
        _ex('Dumbbell Row', 1, '3',
                rest_period='-',
                notes="AMRAP",
                sub1='Cable Row',
                sub2='Inverted Row'),
    ],
    4: [
        _ex('Bench Press', 1, '3',
                rest_period='-',
                notes="AMRAP — Warm up as required. Set a timer for 20 minutes. E2MOM, do the following: Minute 1: 1 set of 5 at 6 RIR Minute 2: 1 set of 5 at 4 RIR Minute 3-10: Sets of 3-5 at 1-2 RIR",
                sub1='Dumbbell Press',
                sub2='Push Up'),
        _ex('Dumbbell Row', 1, '3',
                rest_period='-',
                notes="AMRAP",
                sub1='Cable Row',
                sub2='Inverted Row'),
    ],
}

_P2_D4_SWOLE = [
    _ex('Dumbbell Overhead Press', 2, '8-12',
            rest_period='0s',
            sub1='Incline Dumbbell Press',
            sub2='Landmine Press'),
    _ex('Seated Shoulder Extension', 2, '30s',
            rest_period='60s',
            notes="Do this immediately after each set of OHP. Then rest and return to OHP"),
]

_P2_D4_ACC = [
    _ex('Face Pull', 2, '10-15',
            rest_period='0s',
            notes="2 second hold at the top of each rep. Perform as a superset. Minimal rest between exercises",
            sub1='Prone Y Raise',
            sub2='Rear Delt Fly'),
    _ex('Incline Curl', 2, '10-15',
            rest_period='0s',
            notes="2 second hold at the top of each rep. Perform as a superset. Minimal rest between exercises",
            sub1='Cable Curl',
            sub2='Preacher Curl'),
    _ex('Cross Body Triceps Extension', 2, '10-15 e/s',
            rest_period='60s',
            notes="2 second hold at the top of each rep. Perform as a superset. Rest, then return to Face Pulls.",
            sub1='DB Cross Body Extension',
            sub2='DB Side Lying Ext'),
]

_P2_D5_WARMUP = [
    _ex('Twisting Bear', 3, '10m',
            rest_period='0-10s',
            notes="Count your reps as steps - 10 reps forwards, 10 reps back"),
]

_P2_D5_STRENGTH = [
    _ex('Paused Deadlift', 3, '3-5',
            rest_period='60',
            notes="2 second pause at mid shin, then complete the rep explosively",
            sub1='DB Deadlift',
            sub2='Trap Bar Deadlift'),
    _ex('Broad Jump', 3, '3-5',
            rest_period='60',
            sub1='Stand to Triple Extension'),
]

_P2_D5_SWOLE = [
    _ex('Dumbbell Clean & Press', 3, '6-10',
            rest_period='0s',
            notes="Perform as a superset - minimal rest between exercises"),
    _ex('Kettlebell Swing', 3, '20',
            rest_period='60s',
            notes="Perform as a superset - minimal rest between exercises"),
]

_P2_D5_METCON = [
    _ex('Renegade Row', 5, '10 e/s',
            rest_period='0s'),
    _ex('Air Squats', 5, '20',
            rest_period='0s',
            notes="This is your rest period between rounds of Renegade Rows"),
]


def _build_phase2_workouts() -> list[dict]:
    workouts: list[dict] = []
    for week in range(1, 5):
        workouts.append(_workout(
            "Lower Body 1", 0, week,
            [
                ("Warm Up", None, _P2_D1_WARMUP[week]),
                ("Strength & Condition", None, _P2_D1_STRENGTH[week]),
                ("Swole & Flexy", None, _P2_D1_SWOLE),
                ("Accessories", None, _P2_D1_ACC),
            ],
        ))
        workouts.append(_workout(
            "Upper Body 1", 1, week,
            [
                ("Warm Up", None, _P2_D2_WARMUP),
                ("Strength & Condition", None, _P2_D2_STRENGTH[week]),
                ("Swole & Flexy", None, _P2_D2_SWOLE),
                ("Accessories", None, _P2_D2_ACC),
            ],
        ))
        workouts.append(_workout(
            "Lower Body 2", 2, week,
            [
                ("Warm Up", None, _P2_D3_WARMUP),
                ("Strength & Condition", None, _P2_D3_STRENGTH[week]),
                ("Swole & Flexy", None, _P2_D3_SWOLE[week]),
                ("Accessories", None, _P2_D3_ACC),
            ],
        ))
        workouts.append(_workout(
            "Upper Body 2", 3, week,
            [
                ("Warm Up", None, _P2_D4_WARMUP),
                ("Strength & Condition", None, _P2_D4_STRENGTH[week]),
                ("Swole & Flexy", None, _P2_D4_SWOLE),
                ("Accessories", None, _P2_D4_ACC),
            ],
        ))
        workouts.append(_workout(
            "Full Body", 4, week,
            [
                ("Warm Up", None, _P2_D5_WARMUP),
                ("Strength & Condition", None, _P2_D5_STRENGTH),
                ("Swole & Flexy", None, _P2_D5_SWOLE),
                ("Metabolic Conditioning", None, _P2_D5_METCON),
            ],
        ))
    return workouts


# ---------------------------------------------------------------------------
# Phase 3: "The Peak"
# ---------------------------------------------------------------------------

_P3_D1_WARMUP = [
    _ex('Broad Jump', 3, '5',
            rest_period='0-10s',
            notes="Perform reps unbroken, or take a pause between each jump",
            sub1='Stand to Triple Extension'),
]

_P3_D1_STRENGTH = [
    _ex('Barbell Squat', 3, '5-10',
            rest_period='-',
            notes="Warm up as required. Then perform 2 sets of 5 @ 2RIR 1 set of 10 (decrease weight by 10-20%)",
            sub1='Goblet Squat',
            sub2='Leg Press'),
    _ex('Reverse Crunch', 3, '8',
            rest_period='-',
            notes="After each set of Squats, perform the core exercise. Then, rest as required before returning to squats",
            sub1='Lying Leg Raise'),
]

_P3_D1_SWOLE = [
    _ex('Romanian Deadlift', 2, '6-10',
            rest_period='0s',
            notes="2 second pause in the stretch on each rep",
            sub1='Dumbbell RDL',
            sub2='45 Degree Hyperextension'),
    _ex('Horse Stance Good Morning', 2, '15',
            rest_period='60s',
            notes="This is a gentle mobility stretch. Don’t push it hard",
            sub1='Seated Good Morning'),
]

_P3_D1_ACC = [
    _ex('Hamstring Bridge', 2, '8-12',
            rest_period='0s',
            notes="2 second pause at the top of each rep"),
    _ex('Long Lunge Hold', 2, '30s',
            rest_period='60s',
            notes="Add weight if desired"),
]

_P3_D2_WARMUP = [
    _ex('Scapula Circles', 3, '10',
            rest_period='0-10s',
            notes="Place your feet on the ground to offload your bodyweight as needed"),
]

_P3_D2_STRENGTH = [
    _ex('Z-Press', 3, '5-10',
            rest_period='-',
            notes="Warm up as required. Then perform 2 sets of 5 @ 2RIR 1 set of 10 (decrease weight by 10-20%)",
            sub1='Dumbbell Overhead Press',
            sub2='Incline Dumbbell Press'),
    _ex('Chin Up', 3, '5-10',
            rest_period='-',
            notes="Warm up as required. Then perform 2 sets of 5 @ 2RIR 1 set of 10 (decrease weight by 10-20%)",
            sub1='Lat Pulldown',
            sub2='Inverted Row'),
]

_P3_D2_SWOLE = [
    _ex('Dip', 2, '6-10',
            rest_period='0s',
            notes="2 second pause in the stretch on each rep",
            sub1='Close Grip Push Up',
            sub2='Bench Dip'),
    _ex('Scapula Push Up', 2, '10',
            rest_period='60s',
            notes="Perform immediately after each set of Dips, then rest before returning to Dips",
            sub1='Cat Cow',
            sub2='Plank'),
]

_P3_D2_ACC = [
    _ex('Incline Skullcrusher', 2, '10-15',
            rest_period='0s',
            sub1='Bodyweight Skullcrusher',
            sub2='Close Grip Push Up'),
    _ex('Barbell Row', 2, '10-15',
            rest_period='0s',
            notes="2 second hold at the top of each rep",
            sub1='Single DB Row',
            sub2='DB Row - Dual'),
    _ex('Lateral Raise + Hold', 2, '10-15',
            rest_period='0s',
            notes="Hold the top for 10 seconds for 1 rep. Then, perform 10-15 full range reps.",
            sub1='Y Raise',
            sub2='Cable Raise'),
]

_P3_D3_WARMUP = [
    _ex('Seated Vertical Jump', 3, '5',
            rest_period='0-10s',
            sub1='Stand to Triple Extension'),
]

_P3_D3_STRENGTH = [
    _ex('Deadlift', 3, '5-10',
            rest_period='-',
            notes="Warm up as required. Then perform 2 sets of 5 @ 2RIR 1 set of 10 (decrease weight by 10-20%)",
            sub1='DB Deadlift',
            sub2='Trap Bar Deadlift'),
    _ex('Hollowbody Hold', 3, '10s',
            rest_period='-',
            notes="Between each set of Deadlifts, perform a set of Hollow Holds. Rest as needed, then return to Deadlifts. Pick a level of difficulty that is just manageable by the end",
            sub1='Plank'),
]

_P3_D3_SWOLE = [
    _ex('Walking Lunge', 2, '8-12 e/s',
            rest_period='0s',
            notes="Perform as a superset. Minimal rest between exercises",
            sub1='Single Leg Press',
            sub2='Smith Machine Split Squat'),
    _ex('Pike Raise', 2, '10 e/s',
            rest_period='60s',
            notes="Perform as a superset. Minimal rest between exercises",
            sub1='Plank',
            sub2='Hanging Knee Raise'),
]

_P3_D3_ACC = [
    _ex('Box Step Over', 5, '60s',
            rest_period='0s',
            notes="Perform both exercises as a timed circuit. No rest between exercises. 30s rest between rounds"),
    _ex('Bicycle Crunch', 5, '10 e/s',
            rest_period='0s'),
]

_P3_D4_WARMUP = [
    _ex('Turkish Get Up', 3, '5 e/s',
            rest_period='0-10s',
            notes="Dumbbell, Kettlebell or Bodyweight"),
]

_P3_D4_STRENGTH = [
    _ex('Bench Press', 3, '5-10',
            rest_period='-',
            notes="Warm up as required. Then perform 2 sets of 5 @ 2RIR 1 set of 10 (decrease weight by 10-20%)",
            sub1='Dumbbell Press',
            sub2='Push Up'),
    _ex('Dumbbell Row', 3, '5-10',
            rest_period='-',
            notes="Warm up as required. Then perform 2 sets of 5 @ 2RIR 1 set of 10 (decrease weight by 10-20%)",
            sub1='Cable Row',
            sub2='Inverted Row'),
]

_P3_D4_SWOLE = [
    _ex('Dumbbell Push Press', 2, '8-12',
            rest_period='0s',
            sub1='Incline Dumbbell Press',
            sub2='Landmine Press'),
    _ex('Seated Shoulder Extension', 2, '30s',
            rest_period='60s',
            notes="Do this immediately after each set of OHP. Then rest and return to OHP"),
]

_P3_D4_ACC = [
    _ex('Single Arm Cable Y Raise', 2, '10-15',
            rest_period='0s',
            notes="Finish each set with a cluster set. Go to failure, then take 10 seconds rest, then go again to failure.",
            sub1='Y Raise',
            sub2='Side Lying Compound Raise'),
    _ex('Preacher Curl', 2, '10-15',
            rest_period='0s',
            sub1='Cable Curl',
            sub2='Incline Curl'),
    _ex('Katana Extension', 2, '10-15 e/s',
            rest_period='0s',
            notes="Finish each set with a cluster set. Go to failure, then take 10 seconds rest, then go again to failure.",
            sub1='DB Cross Body Extension',
            sub2='DB Side Lying Ext'),
]

_P3_D5_WARMUP = [
    _ex('Twisting Bear', 3, '10m',
            rest_period='0-10s',
            notes="Count your reps as steps - 10 reps forwards, 10 reps back"),
]

_P3_D5_STRENGTH = [
    _ex('Dumbbell Thruster', 3, '6-10',
            rest_period='60s',
            notes="Perform as a superset - minimal rest between exercises",
            sub1='DB Deadlift',
            sub2='Trap Bar Deadlift'),
    _ex('Pull Up', 3, '6-10',
            rest_period='60s',
            notes="Perform as a superset - minimal rest between exercises",
            sub1='Lat Pulldown',
            sub2='Inverted Row'),
]

_P3_D5_METCON = [
    _ex('Burpee', 1, '10',
            rest_period='-',
            notes="AMRAP — Perform AMRAP in 10 minutes of 10 Burpees & 20 KB Swings. Rest as needed"),
    _ex('Kettlebell Swing', 1, '20',
            rest_period='-',
            notes="AMRAP"),
]


def _build_phase3_workouts() -> list[dict]:
    workouts: list[dict] = []
    for week in range(1, 5):
        workouts.append(_workout(
            "Lower Body 1", 0, week,
            [
                ("Warm Up", None, _P3_D1_WARMUP),
                ("Strength & Condition", None, _P3_D1_STRENGTH),
                ("Swole & Flexy", None, _P3_D1_SWOLE),
                ("Accessories", None, _P3_D1_ACC),
            ],
        ))
        workouts.append(_workout(
            "Upper Body 1", 1, week,
            [
                ("Warm Up", None, _P3_D2_WARMUP),
                ("Strength & Condition", None, _P3_D2_STRENGTH),
                ("Swole & Flexy", None, _P3_D2_SWOLE),
                ("Accessories", None, _P3_D2_ACC),
            ],
        ))
        workouts.append(_workout(
            "Lower Body 2", 2, week,
            [
                ("Warm Up", None, _P3_D3_WARMUP),
                ("Strength & Condition", None, _P3_D3_STRENGTH),
                ("Swole & Flexy", None, _P3_D3_SWOLE),
                ("Accessories", None, _P3_D3_ACC),
            ],
        ))
        workouts.append(_workout(
            "Upper Body 2", 3, week,
            [
                ("Warm Up", None, _P3_D4_WARMUP),
                ("Strength & Condition", None, _P3_D4_STRENGTH),
                ("Swole & Flexy", None, _P3_D4_SWOLE),
                ("Accessories", None, _P3_D4_ACC),
            ],
        ))
        workouts.append(_workout(
            "Full Body", 4, week,
            [
                ("Warm Up", None, _P3_D5_WARMUP),
                ("Strength & Condition", None, _P3_D5_STRENGTH),
                ("Metabolic Conditioning", None, _P3_D5_METCON),
            ],
        ))
    return workouts


# ---------------------------------------------------------------------------
# Full program data
# ---------------------------------------------------------------------------

minimalift_5day_program_data: dict = {
    "name": "Minimalift 5-Day Upper/Lower",
    "phases": [
        {
            "name": "The Base",
            "description": "Higher reps, shorter rest periods, exercise selection focused on improving range of motion and endurance. Lays the found...",
            "duration_weeks": 4,
            "workouts": _build_phase1_workouts(),
        },
        {
            "name": "The Build",
            "description": "Main work shifts to heavier weights to improve nervous system efficiency. Activates high threshold motor units more effe...",
            "duration_weeks": 4,
            "workouts": _build_phase2_workouts(),
        },
        {
            "name": "The Peak",
            "description": "Heaviest weights. Set volume decreases and rest periods go up to unlock all the strength built over the previous 2 phase...",
            "duration_weeks": 4,
            "workouts": _build_phase3_workouts(),
        },
    ],
}


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------

async def seed_minimalift_5day_exercises(db: AsyncSession) -> None:
    """Seed Minimalift 5-Day-specific exercises, skipping any that already exist by name."""
    from app.models import Exercise

    result = await db.execute(select(Exercise).where(Exercise.user_id.is_(None)))
    existing_names = {e.name for e in result.scalars().all()}

    for data in minimalift_5day_exercises_data:
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


async def seed_minimalift_5day_program(db: AsyncSession) -> None:
    """Create the shared Minimalift 5-Day Upper/Lower phased program blueprint (idempotent)."""
    from app.models import (
        Exercise,
        Program,
        ProgramPhase,
        PhaseWorkout,
        PhaseWorkoutSection,
        PhaseWorkoutExercise,
    )

    existing = await db.execute(
        select(Program).where(Program.id == SHARED_MINIMALIFT_5DAY_PROGRAM_ID)
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

    data = minimalift_5day_program_data

    program = Program(
        id=SHARED_MINIMALIFT_5DAY_PROGRAM_ID,
        user_id=None,  # shared
        name=data["name"],
        program_type="phased",
    )
    db.add(program)
    await db.flush()

    for phase_order, phase_data in enumerate(data["phases"]):
        phase_id = _shared_id(f"ml5:phase:{phase_order}")
        phase = ProgramPhase(
            id=phase_id,
            program_id=SHARED_MINIMALIFT_5DAY_PROGRAM_ID,
            name=phase_data["name"],
            description=phase_data["description"],
            order=phase_order,
            duration_weeks=phase_data["duration_weeks"],
        )
        db.add(phase)
        await db.flush()

        for workout_data in phase_data["workouts"]:
            wo_id = _shared_id(
                f"ml5:workout:{phase_order}:{workout_data['day_index']}:{workout_data['week_number']}" 
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
                    f"ml5:section:{phase_order}:{workout_data['day_index']}:{workout_data['week_number']}:{section_order}" 
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
                        f"ml5:pwe:{phase_order}:{workout_data['day_index']}:{workout_data['week_number']}:{section_order}:{ex_order}" 
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
