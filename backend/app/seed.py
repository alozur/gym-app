from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Exercise, ExerciseSubstitution, TemplateExercise, WorkoutTemplate

exercises_data = [
    # ── Upper Day ──
    {
        "name": "45° Incline Barbell Press",
        "muscle_group": "Chest",
        "equipment": "Barbell",
        "youtube_url": "https://www.youtube.com/watch?v=vqQ9ok0dEgk",
        "notes": "1 second pause at the bottom of each rep while maintaining tension on the pecs",
    },
    {
        "name": "Cable Crossover Ladder",
        "muscle_group": "Chest",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=0TP9kVcWGic",
        "notes": "Do one set with low cable position, one set with medium-height cable position, and one height with a high cable position. If you only have one or two sets, choose the one or two cable positions you prefer.\nNote: Start bottom and go mid",
    },
    {
        "name": "Wide-Grip Pull-Up",
        "muscle_group": "Back",
        "equipment": "Bodyweight",
        "youtube_url": "https://www.youtube.com/watch?v=yGnp0HU8BnA",
        "notes": "1.5x shoulder width overhand grip. Slow 2-3 second negative. Feel your lats pulling apart on the way down.",
    },
    {
        "name": "High-Cable Lateral Raise",
        "muscle_group": "Shoulders",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=MnMux3Wc0Ac",
        "notes": "Focus on squeezing your lateral delt to move the weight.",
    },
    {
        "name": "Pendlay Deficit Row",
        "muscle_group": "Back",
        "equipment": "Barbell",
        "youtube_url": "https://www.youtube.com/watch?v=MmuyHKYCLps",
        "notes": "Stand on a bumper plate. Focus on getting a big stretch and touch your stomach/chest on each rep!",
    },
    {
        "name": "Overhead Cable Triceps Extension (Bar)",
        "muscle_group": "Triceps",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=9_I1PqZAjdA",
        "notes": "Optionally pause for 0.5-1 second in the stretched aspect of each rep",
    },
    {
        "name": "Bayesian Cable Curl",
        "muscle_group": "Biceps",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=CWH5J_7kzjM",
        "notes": "If you have a left-right bicep size imbalance, do these 1 arm at a time, starting with the weaker arm. Take the weaker arm to the listed RPE. Then match the reps with the other arm (stop once you've matched the reps, even if the RPE is lower). If you don't have a size imbalance, do these both arms at the same time.",
    },
    {
        "name": "45° Incline DB Press",
        "muscle_group": "Chest",
        "equipment": "Dumbbell",
        "youtube_url": "https://www.youtube.com/watch?v=p2t9daxLpB8",
    },
    {
        "name": "45° Incline Machine Press",
        "muscle_group": "Chest",
        "equipment": "Machine",
        "youtube_url": "https://www.youtube.com/watch?v=b8fYnZ-usP0",
    },
    {
        "name": "Pec Deck",
        "muscle_group": "Chest",
        "equipment": "Machine",
        "youtube_url": "https://www.youtube.com/watch?v=CI88L1VNvEs",
    },
    {
        "name": "Wide-Grip Lat Pulldown",
        "muscle_group": "Back",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=IYXRrYXfVLc",
    },
    {
        "name": "Dual-Handle Lat Pulldown",
        "muscle_group": "Back",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=NwQ5Ch5t5Vk",
    },
    {
        "name": "High-Cable Cuffed Lateral Raise",
        "muscle_group": "Shoulders",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=8m2jNHBP580",
    },
    {
        "name": "Lean-In DB Lateral Raise",
        "muscle_group": "Shoulders",
        "equipment": "Dumbbell",
        "youtube_url": "https://www.youtube.com/watch?v=BmYuAG2j2co",
    },
    {
        "name": "Smith Machine Row",
        "muscle_group": "Back",
        "equipment": "Smith Machine",
        "youtube_url": "https://www.youtube.com/watch?v=Wmivm40AV3Q",
    },
    {
        "name": "Single-Arm DB Row",
        "muscle_group": "Back",
        "equipment": "Dumbbell",
        "youtube_url": "https://www.youtube.com/watch?v=roKtfQZbxzg",
    },
    {
        "name": "Overhead Cable Triceps Extension (Rope)",
        "muscle_group": "Triceps",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=GYoUoVNlbGc",
    },
    {
        "name": "DB Skull Crusher",
        "muscle_group": "Triceps",
        "equipment": "Dumbbell",
        "youtube_url": "https://www.youtube.com/watch?v=fbLTzgTKOR8",
    },
    {
        "name": "Seated Super-Bayesian High Cable Curl",
        "muscle_group": "Biceps",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=jQ9rkfvAbIc",
    },
    {
        "name": "Incline DB Stretch Curl",
        "muscle_group": "Biceps",
        "equipment": "Dumbbell",
        "youtube_url": "https://www.youtube.com/watch?v=Z0NIYS9nyoQ",
    },
    # ── Lower Day ──
    {
        "name": "Lying Leg Curl",
        "muscle_group": "Hamstrings",
        "equipment": "Machine",
        "youtube_url": "https://www.youtube.com/watch?v=sX4tGtcc62k",
        "notes": "Set the machine so that you get the biggest stretch possible at the bottom. Prevent your butt from popping up as you curl.",
    },
    {
        "name": "Seated Leg Curl",
        "muscle_group": "Hamstrings",
        "equipment": "Machine",
        "youtube_url": "https://www.youtube.com/watch?v=yv0aAY7M1mk",
        "notes": "Lean forward over the machine to get a maximum stretch in your hamstrings.",
    },
    {
        "name": "Nordic Ham Curl",
        "muscle_group": "Hamstrings",
        "equipment": "Bodyweight",
        "youtube_url": "https://www.youtube.com/watch?v=fzpYiRtzmFA",
    },
    {
        "name": "Smith Machine Squat",
        "muscle_group": "Quads",
        "equipment": "Smith Machine",
        "youtube_url": "https://www.youtube.com/watch?v=J2D2J7RO_tA",
        "notes": "Once you are under the bar, set up your feet as you would a normal squat and then bring them forward ~3-6 inches. This will cause you to lean back into the bar slightly, allowing for a more upright squat, while also placing more tension on the quads. If your heels are raising at the bottom, you may need to bring your feet more forward. If your feet feel like they are slipping or your lower back is rounding at the bottom, try bringing your feet back a bit.\nNote: Black bar counted as 10kg",
    },
    {
        "name": "DB Bulgarian Split Squat",
        "muscle_group": "Quads",
        "equipment": "Dumbbell",
        "youtube_url": "https://www.youtube.com/watch?v=htDXu61MPio",
        "notes": "Lower all the way down until your front thigh is parallel to the ground. Drive through your front heel on the way up.",
    },
    {
        "name": "High-Bar Back Squat",
        "muscle_group": "Quads",
        "equipment": "Barbell",
        "youtube_url": "https://www.youtube.com/watch?v=V-B_Y-OvOTQ",
    },
    {
        "name": "Barbell RDL",
        "muscle_group": "Hamstrings",
        "equipment": "Barbell",
        "youtube_url": "https://www.youtube.com/watch?v=3fJwfg51cv0",
        "notes": "To keep tension on the hamstrings, stop about 75% of the way to full lockout on each rep (i.e. stay in the bottom 3/4 of the range of motion).",
    },
    {
        "name": "Dumbell RDL",
        "muscle_group": "Hamstrings",
        "equipment": "Dumbbell",
    },
    {
        "name": "DB RDL",
        "muscle_group": "Hamstrings",
        "equipment": "Dumbbell",
        "youtube_url": "https://www.youtube.com/watch?v=VRwSgUoj7uI",
    },
    {
        "name": "Snatch-Grip RDL",
        "muscle_group": "Hamstrings",
        "equipment": "Barbell",
        "youtube_url": "https://www.youtube.com/watch?v=b8fmEaXHapU",
    },
    {
        "name": "Leg Extension",
        "muscle_group": "Quads",
        "equipment": "Machine",
        "youtube_url": "https://www.youtube.com/watch?v=uFbNtqP966A",
        "notes": "Set the seat back as far as it will go while still feeling comfortable. Grab the handles as hard as you can to pull your butt down into the seat. Use a 2-3 second negative. Feel your quads pulling apart on the negative.",
    },
    {
        "name": "Reverse Nordic",
        "muscle_group": "Quads",
        "equipment": "Bodyweight",
        "youtube_url": "https://www.youtube.com/watch?v=D-kqUKEQZZ0",
    },
    {
        "name": "Sissy Squat",
        "muscle_group": "Quads",
        "equipment": "Bodyweight",
        "youtube_url": "https://www.youtube.com/watch?v=eWAjlO4FWPQ",
    },
    {
        "name": "Standing Calf Raise",
        "muscle_group": "Calves",
        "equipment": "Machine",
        "youtube_url": "https://www.youtube.com/watch?v=6lR2JdxUh7w",
        "notes": "1-2 second pause at the bottom of each rep. Instead of just going up onto your toes, think about rolling your ankle back and forth on the balls of your feet.",
    },
    {
        "name": "Seated Calf Raise",
        "muscle_group": "Calves",
        "equipment": "Machine",
        "youtube_url": "https://www.youtube.com/watch?v=6pfj0G7VKdM",
    },
    {
        "name": "Leg Press Calf Press",
        "muscle_group": "Calves",
        "equipment": "Machine",
        "youtube_url": "https://www.youtube.com/watch?v=S6DTPNZ_-F4",
    },
    {
        "name": "Cable Crunch",
        "muscle_group": "Abs",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=epBrpaGHMcg",
        "notes": "Round your lower back as you crunch. Maintain a mind-muscle connection with your 6-pack.",
    },
    {
        "name": "Decline Weighted Crunch",
        "muscle_group": "Abs",
        "equipment": "Dumbbell",
        "youtube_url": "https://www.youtube.com/watch?v=ZheUsKqU81M",
    },
    {
        "name": "Machine Crunch",
        "muscle_group": "Abs",
        "equipment": "Machine",
        "youtube_url": "https://www.youtube.com/watch?v=K2yKEoazT3g",
    },
    # ── Pull Day ──
    {
        "name": "Neutral-Grip Lat Pulldown",
        "muscle_group": "Back",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=lA4_1F9EAFU",
        "notes": "Do these pulldowns with the handle more out in front of you, more like a cross between pullover and a pulldown. Focus on feeling your lats working more than the weight you're using.",
    },
    {
        "name": "Neutral-Grip Pull-Up",
        "muscle_group": "Back",
        "equipment": "Bodyweight",
        "youtube_url": "https://www.youtube.com/watch?v=b0ypSz63UGo",
    },
    {
        "name": "Chest-Supported Machine Row",
        "muscle_group": "Back",
        "equipment": "Machine",
        "youtube_url": "https://www.youtube.com/watch?v=ijsSiWSzYw0",
        "notes": "Flare elbows out at roughly 45\u00b0 and squeeze your shoulder blades together hard at the top of each rep.",
    },
    {
        "name": "Chest-Supported T-Bar Row",
        "muscle_group": "Back",
        "equipment": "Barbell",
        "youtube_url": "https://www.youtube.com/watch?v=q8qlHwcuOtc",
    },
    {
        "name": "Incline Chest-Supported DB Row",
        "muscle_group": "Back",
        "equipment": "Dumbbell",
        "youtube_url": "https://www.youtube.com/watch?v=okCWuhxJEvw",
    },
    {
        "name": "Neutral-Grip Seated Cable Row",
        "muscle_group": "Back",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=hM7XHxQgvLk",
        "notes": "Focus on squeezing your shoulder blades together, driving your elbows down and back.",
    },
    {
        "name": "Helms Row",
        "muscle_group": "Back",
        "equipment": "Dumbbell",
        "youtube_url": "https://www.youtube.com/watch?v=DjO2G9DIerQ",
    },
    {
        "name": "Meadows Row",
        "muscle_group": "Back",
        "equipment": "Barbell",
        "youtube_url": "https://www.youtube.com/watch?v=TwOkRqvcX_c",
    },
    {
        "name": "1-Arm 45\u00b0 Cable Rear Delt Flye",
        "muscle_group": "Shoulders",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=6G5DmVaocGM",
        "notes": "Pause for 1-2 seconds in the squeeze of each rep. Contract the rear delts hard!",
    },
    {
        "name": "Rope Face Pull",
        "muscle_group": "Shoulders",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=GhrVM-jPIEA",
    },
    {
        "name": "Reverse Pec Deck",
        "muscle_group": "Shoulders",
        "equipment": "Machine",
        "youtube_url": "https://www.youtube.com/watch?v=Y8fb_rtEU_4",
    },
    {
        "name": "Machine Shrug",
        "muscle_group": "Traps",
        "equipment": "Machine",
        "youtube_url": "https://www.youtube.com/watch?v=ua0XuKwKQ9M",
        "notes": "Brief pause at the top of the bottom of ROM. Think about pulling your shoulders up to your ears!",
    },
    {
        "name": "Cable Paused Shrug-In",
        "muscle_group": "Traps",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=Hy6f1Lz_PiA",
    },
    {
        "name": "DB Shrug",
        "muscle_group": "Traps",
        "equipment": "Dumbbell",
    },
    {
        "name": "EZ-Bar Cable Curl",
        "muscle_group": "Biceps",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=ck1zjNTnFew",
        "notes": "Set up the cable at the lowest position. Maintain constant tension on the biceps. Slow, controlled reps!",
    },
    {
        "name": "EZ-Bar Curl",
        "muscle_group": "Biceps",
        "equipment": "Barbell",
        "youtube_url": "https://www.youtube.com/watch?v=WMrgn4GG7mI",
    },
    {
        "name": "DB Curl",
        "muscle_group": "Biceps",
        "equipment": "Dumbbell",
        "youtube_url": "https://www.youtube.com/watch?v=XxGCRSJmgwY",
    },
    {
        "name": "Machine Preacher Curl",
        "muscle_group": "Biceps",
        "equipment": "Machine",
        "youtube_url": "https://www.youtube.com/watch?v=R2iUnBxFtis",
        "notes": "Smooth, controlled reps. Mind-muscle connection with the biceps.",
    },
    {
        "name": "EZ-Bar Preacher Curl",
        "muscle_group": "Biceps",
        "equipment": "Barbell",
        "youtube_url": "https://www.youtube.com/watch?v=Dn7qgf9iSH8",
    },
    {
        "name": "DB Preacher Curl",
        "muscle_group": "Biceps",
        "equipment": "Dumbbell",
        "youtube_url": "https://www.youtube.com/watch?v=WTkQLAethtg",
    },
    # ── Push Day ──
    {
        "name": "Barbell Bench Press",
        "muscle_group": "Chest",
        "equipment": "Barbell",
        "youtube_url": "https://www.youtube.com/watch?v=nQL5ieH39sw",
        "notes": "Set up a comfortable arch, quick pause on the chest and explode up on each rep.",
    },
    {
        "name": "Machine Chest Press",
        "muscle_group": "Chest",
        "equipment": "Machine",
        "youtube_url": "https://www.youtube.com/watch?v=zDecGJLyVm8",
    },
    {
        "name": "DB Bench Press",
        "muscle_group": "Chest",
        "equipment": "Dumbbell",
        "youtube_url": "https://www.youtube.com/watch?v=zGXvPjlgVkk",
    },
    {
        "name": "Machine Shoulder Press",
        "muscle_group": "Shoulders",
        "equipment": "Machine",
        "youtube_url": "https://www.youtube.com/watch?v=SCQVmN1gYsk",
        "notes": "Ensure that your elbows break at least 90\u00b0. Mind-muscle connection with your delts. Smooth, controlled reps.",
    },
    {
        "name": "Cable Shoulder Press",
        "muscle_group": "Shoulders",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=OfjncdW_Vyc",
    },
    {
        "name": "Seated DB Shoulder Press",
        "muscle_group": "Shoulders",
        "equipment": "Dumbbell",
        "youtube_url": "https://www.youtube.com/watch?v=B8PB5RPhTWQ",
    },
    {
        "name": "Bottom-Half DB Flye",
        "muscle_group": "Chest",
        "equipment": "Dumbbell",
        "youtube_url": "https://www.youtube.com/watch?v=qJzc-iHKGdg",
        "notes": "All reps and sets are to be performed in the bottom half of the ROM. Focus on feeling a deep stretch in your pecs at the bottom of each rep.",
    },
    {
        "name": "Bottom-Half Seated Cable Flye",
        "muscle_group": "Chest",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=tsJMV9Gxw-o",
    },
    {
        "name": "Low-to-High Cable Crossover",
        "muscle_group": "Chest",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=1LhGmhVFe2Y",
    },
    {
        "name": "Overhead CableTriceps Extension (Bar)",
        "muscle_group": "Triceps",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=9_I1PqZAjdA",
        "notes": "Optionally pause for 0.5-1 second in the stretched aspect of each rep",
    },
    {
        "name": "Cable Triceps Kickback",
        "muscle_group": "Triceps",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=oRxTKRtP8RE",
        "notes": "There are two ways you can do this: upright or bent over. Choose the one that feels more comfortable for you. The main thing is that when you're in the full squeeze, your shoulder should be positioned back behind your torso.",
    },
    {
        "name": "DB TricepsKickback",
        "muscle_group": "Triceps",
        "equipment": "Dumbbell",
        "youtube_url": "https://www.youtube.com/watch?v=YdUUYFgpA7g",
    },
    {
        "name": "Bench Dip",
        "muscle_group": "Triceps",
        "equipment": "Bodyweight",
        "youtube_url": "https://www.youtube.com/watch?v=3CaIq8jZe18",
    },
    {
        "name": "Roman Chair Leg Raise",
        "muscle_group": "Abs",
        "equipment": "Bodyweight",
        "youtube_url": "https://www.youtube.com/watch?v=irOzFVqJ0IE",
        "notes": "Allow your lower back to round as you curl your legs up. 10-20 reps is a broad range on purpose: just go until you hit the listed RPE with controlled form.",
    },
    {
        "name": "Hanging Leg Raise",
        "muscle_group": "Abs",
        "equipment": "Bodyweight",
        "youtube_url": "https://www.youtube.com/watch?v=rGqwkinWqYI",
    },
    {
        "name": "Modified Candlestick",
        "muscle_group": "Abs",
        "equipment": "Bodyweight",
        "youtube_url": "https://www.youtube.com/watch?v=-XVRl8KU7x0",
    },
    # ── Legs Day ──
    {
        "name": "Leg Press",
        "muscle_group": "Quads",
        "equipment": "Machine",
        "youtube_url": "https://www.youtube.com/watch?v=1yKAQLVV_XI",
        "notes": "Feet lower on the platform for more quad focus. Get as deep as you can without excessive back rounding. Control the negative and do a slight pause at the bottom of each rep.",
    },
    {
        "name": "Smith Machine Static Lunge",
        "muscle_group": "Quads",
        "equipment": "Smith Machine",
        "youtube_url": "https://www.youtube.com/watch?v=SEjKxJGg_C8",
    },
    {
        "name": "DB Walking Lunge",
        "muscle_group": "Quads",
        "equipment": "Dumbbell",
        "youtube_url": "https://www.youtube.com/watch?v=BC_eDtrB-M4",
    },
    {
        "name": "DB Step-Up",
        "muscle_group": "Quads",
        "equipment": "Dumbbell",
        "youtube_url": "https://www.youtube.com/watch?v=3FNfi_PrP9Y",
    },
    {
        "name": "Goblet Squat",
        "muscle_group": "Quads",
        "equipment": "Dumbbell",
        "youtube_url": "https://www.youtube.com/watch?v=S2agsLlUSII",
    },
    {
        "name": "Machine Hip Adduction",
        "muscle_group": "Adductors",
        "equipment": "Machine",
        "youtube_url": "https://www.youtube.com/watch?v=FMSCZYu1JhE",
        "notes": "Mind-muscle connection with your inner thighs. These are great for adding thigh mass from the front! Push them hard!",
    },
    {
        "name": "Cable Hip Adduction",
        "muscle_group": "Adductors",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=6GYTbv-LtV0",
    },
    {
        "name": "Copenhagen Hip Adduction",
        "muscle_group": "Adductors",
        "equipment": "Bodyweight",
        "youtube_url": "https://www.youtube.com/watch?v=QRLGyl5-i4k",
    },
    {
        "name": "Machine Hip Abduction",
        "muscle_group": "Abductors",
        "equipment": "Machine",
        "youtube_url": "https://www.youtube.com/watch?v=pozooPg6PBE",
        "notes": "If possible, use pads to increase the range of motion on the machine. Lean forward and grab onto the machine rails to stretch the glutes further.",
    },
    {
        "name": "Cable Hip Abduction",
        "muscle_group": "Abductors",
        "equipment": "Cable",
        "youtube_url": "https://www.youtube.com/watch?v=552L1K3Rb_Q",
    },
    {
        "name": "Lateral Band Walk",
        "muscle_group": "Abductors",
        "equipment": "Band",
        "youtube_url": "https://www.youtube.com/watch?v=sOYvvFPYdsU",
    },
]

substitutions_data = [
    # Upper Day
    ("45\u00b0 Incline Barbell Press", "45\u00b0 Incline DB Press", 1),
    ("45\u00b0 Incline Barbell Press", "45\u00b0 Incline Machine Press", 2),
    ("Cable Crossover Ladder", "Pec Deck", 1),
    ("Cable Crossover Ladder", "Bottom-Half DB Flye", 2),
    ("Wide-Grip Pull-Up", "Wide-Grip Lat Pulldown", 1),
    ("Wide-Grip Pull-Up", "Dual-Handle Lat Pulldown", 2),
    ("High-Cable Lateral Raise", "High-Cable Cuffed Lateral Raise", 1),
    ("High-Cable Lateral Raise", "Lean-In DB Lateral Raise", 2),
    ("Pendlay Deficit Row", "Smith Machine Row", 1),
    ("Pendlay Deficit Row", "Single-Arm DB Row", 2),
    ("Overhead Cable Triceps Extension (Bar)", "Overhead Cable Triceps Extension (Rope)", 1),
    ("Overhead Cable Triceps Extension (Bar)", "DB Skull Crusher", 2),
    ("Bayesian Cable Curl", "Seated Super-Bayesian High Cable Curl", 1),
    ("Bayesian Cable Curl", "Incline DB Stretch Curl", 2),
    # Lower Day
    ("Lying Leg Curl", "Seated Leg Curl", 1),
    ("Lying Leg Curl", "Nordic Ham Curl", 2),
    ("Smith Machine Squat", "DB Bulgarian Split Squat", 1),
    ("Smith Machine Squat", "High-Bar Back Squat", 2),
    ("Barbell RDL", "DB RDL", 1),
    ("Barbell RDL", "Snatch-Grip RDL", 2),
    ("Leg Extension", "Reverse Nordic", 1),
    ("Leg Extension", "Sissy Squat", 2),
    ("Standing Calf Raise", "Seated Calf Raise", 1),
    ("Standing Calf Raise", "Leg Press Calf Press", 2),
    ("Cable Crunch", "Decline Weighted Crunch", 1),
    ("Cable Crunch", "Machine Crunch", 2),
    # Pull Day
    ("Neutral-Grip Lat Pulldown", "Neutral-Grip Pull-Up", 1),
    ("Neutral-Grip Lat Pulldown", "Dual-Handle Lat Pulldown", 2),
    ("Chest-Supported Machine Row", "Chest-Supported T-Bar Row", 1),
    ("Chest-Supported Machine Row", "Incline Chest-Supported DB Row", 2),
    ("Neutral-Grip Seated Cable Row", "Helms Row", 1),
    ("Neutral-Grip Seated Cable Row", "Meadows Row", 2),
    ("1-Arm 45\u00b0 Cable Rear Delt Flye", "Rope Face Pull", 1),
    ("1-Arm 45\u00b0 Cable Rear Delt Flye", "Reverse Pec Deck", 2),
    ("Machine Shrug", "Cable Paused Shrug-In", 1),
    ("Machine Shrug", "DB Shrug", 2),
    ("EZ-Bar Cable Curl", "EZ-Bar Curl", 1),
    ("EZ-Bar Cable Curl", "DB Curl", 2),
    ("Machine Preacher Curl", "EZ-Bar Preacher Curl", 1),
    ("Machine Preacher Curl", "DB Preacher Curl", 2),
    # Push Day
    ("Barbell Bench Press", "Machine Chest Press", 1),
    ("Barbell Bench Press", "DB Bench Press", 2),
    ("Machine Shoulder Press", "Cable Shoulder Press", 1),
    ("Machine Shoulder Press", "Seated DB Shoulder Press", 2),
    ("Bottom-Half DB Flye", "Bottom-Half Seated Cable Flye", 1),
    ("Bottom-Half DB Flye", "Low-to-High Cable Crossover", 2),
    ("Overhead CableTriceps Extension (Bar)", "Overhead Cable Triceps Extension (Rope)", 1),
    ("Overhead CableTriceps Extension (Bar)", "DB Skull Crusher", 2),
    ("Cable Triceps Kickback", "DB TricepsKickback", 1),
    ("Cable Triceps Kickback", "Bench Dip", 2),
    ("Roman Chair Leg Raise", "Hanging Leg Raise", 1),
    ("Roman Chair Leg Raise", "Modified Candlestick", 2),
    # Legs Day
    ("Leg Press", "Smith Machine Static Lunge", 1),
    ("Leg Press", "DB Walking Lunge", 2),
    ("Seated Leg Curl", "Lying Leg Curl", 1),
    ("Seated Leg Curl", "Nordic Ham Curl", 2),
    ("DB Bulgarian Split Squat", "DB Step-Up", 1),
    ("DB Bulgarian Split Squat", "Goblet Squat", 2),
    ("Machine Hip Adduction", "Cable Hip Adduction", 1),
    ("Machine Hip Adduction", "Copenhagen Hip Adduction", 2),
    ("Machine Hip Abduction", "Cable Hip Abduction", 1),
    ("Machine Hip Abduction", "Lateral Band Walk", 2),
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


# ── Default template prescriptions (normal + deload) for new users ──
# Extracted from import_historical_data.sql lines 170-238
# Each exercise tuple: (name, order, working_sets, min_reps, max_reps,
#   early_set_rpe_min, early_set_rpe_max, last_set_rpe_min, last_set_rpe_max,
#   rest_period, intensity_technique, warmup_sets)

templates_data = [
    {
        "name": "1 Upper Day",
        "normal": [
            ("45° Incline Barbell Press", 1, 3, 6, 8, 8, 9, 10, 10, "3-5 mins", "Failure", 2),
            ("Cable Crossover Ladder", 2, 2, 8, 10, 8, 9, 10, 10, "1-2 mins", "Failure", 1),
            ("Wide-Grip Pull-Up", 3, 3, 8, 10, 8, 9, 10, 10, "2-3 mins", "Failure", 1),
            ("High-Cable Lateral Raise", 4, 2, 8, 10, 8, 9, 10, 10, "1-2 mins", "Failure", 1),
            ("Pendlay Deficit Row", 5, 2, 6, 8, 8, 9, 10, 10, "2-3 mins", "Failure + LLPs (Extend set)", 1),
            ("Overhead Cable Triceps Extension (Bar)", 6, 2, 8, 10, 8, 9, 10, 10, "1-2 mins", "Failure", 1),
            ("Bayesian Cable Curl", 7, 2, 8, 10, 8, 9, 10, 10, "1-2 mins", "Failure", 1),
        ],
        "deload": [
            ("45° Incline Barbell Press", 1, 2, 6, 8, 6, 7, 7, 8, "3-5 mins", None, 2),
            ("Cable Crossover Ladder", 2, 2, 8, 10, 7, 8, 8, 9, "1-2 mins", None, 1),
            ("Wide-Grip Pull-Up", 3, 2, 8, 10, 6, 7, 7, 8, "2-3 mins", None, 1),
            ("High-Cable Lateral Raise", 4, 2, 8, 10, 7, 8, 8, 9, "1-2 mins", None, 1),
            ("Pendlay Deficit Row", 5, 2, 6, 8, 7, 8, 8, 9, "2-3 mins", None, 1),
            ("Overhead Cable Triceps Extension (Bar)", 6, 2, 8, 10, 7, 8, 8, 9, "1-2 mins", None, 1),
            ("Bayesian Cable Curl", 7, 2, 8, 10, 7, 8, 8, 9, "1-2 mins", None, 1),
        ],
    },
    {
        "name": "2 Lower Day",
        "normal": [
            ("Lying Leg Curl", 1, 2, 8, 10, 8, 9, 10, 10, "1-2 mins", "Failure + LLPs (Extend set)", 2),
            ("Smith Machine Squat", 2, 3, 6, 8, 8, 9, 10, 10, "3-5 mins", "Failure", 3),
            ("Barbell RDL", 3, 3, 6, 8, 8, 9, 10, 10, "2-3 mins", "Failure", 3),
            ("Leg Extension", 4, 2, 8, 10, 8, 9, 10, 10, "1-2 mins", "Failure", 1),
            ("Standing Calf Raise", 5, 2, 6, 8, 8, 9, 10, 10, "1-2 mins", "Static Stretch (30s)", 1),
            ("Cable Crunch", 6, 2, 8, 10, 8, 9, 10, 10, "1-2 mins", "Failure", 1),
        ],
        "deload": [
            ("Lying Leg Curl", 1, 2, 8, 10, 7, 8, 8, 9, "1-2 mins", None, 2),
            ("Smith Machine Squat", 2, 2, 6, 8, 6, 7, 7, 8, "3-5 mins", None, 3),
            ("Barbell RDL", 3, 2, 6, 8, 6, 7, 7, 8, "2-3 mins", None, 3),
            ("Leg Extension", 4, 2, 8, 10, 7, 8, 8, 9, "1-2 mins", None, 1),
            ("Standing Calf Raise", 5, 2, 6, 8, 7, 8, 8, 9, "1-2 mins", None, 1),
            ("Cable Crunch", 6, 2, 8, 10, 7, 8, 8, 9, "1-2 mins", None, 1),
        ],
    },
    {
        "name": "3 Pull Day",
        "normal": [
            ("Neutral-Grip Lat Pulldown", 1, 2, 8, 10, 8, 9, 10, 10, "2-3 mins", "Failure", 2),
            ("Chest-Supported Machine Row", 2, 3, 8, 10, 8, 9, 10, 10, "2-3 mins", "Failure", 2),
            ("Neutral-Grip Seated Cable Row", 3, 2, 10, 12, 8, 9, 10, 10, "2-3 mins", "Failure + LLPs (Extend set)", 1),
            ("1-Arm 45° Cable Rear Delt Flye", 4, 2, 10, 12, 8, 9, 10, 10, "1-2 mins", "Myo-reps", 1),
            ("Machine Shrug", 5, 2, 10, 12, 8, 9, 10, 10, "1-2 mins", "Failure", 2),
            ("EZ-Bar Cable Curl", 6, 2, 10, 12, 8, 9, 10, 10, "1-2 mins", "Failure", 1),
            ("Machine Preacher Curl", 7, 1, 12, 15, 7, 8, 10, 10, "1-2 mins", "Myo-reps", 1),
        ],
        "deload": [
            ("Neutral-Grip Lat Pulldown", 1, 2, 8, 10, 6, 7, 7, 8, "2-3 mins", None, 2),
            ("Chest-Supported Machine Row", 2, 2, 8, 10, 6, 7, 7, 8, "2-3 mins", None, 2),
            ("Neutral-Grip Seated Cable Row", 3, 2, 10, 12, 7, 8, 8, 9, "2-3 mins", None, 1),
            ("1-Arm 45° Cable Rear Delt Flye", 4, 2, 10, 12, 7, 8, 8, 9, "1-2 mins", None, 1),
            ("Machine Shrug", 5, 2, 10, 12, 7, 8, 8, 9, "1-2 mins", None, 2),
            ("EZ-Bar Cable Curl", 6, 2, 10, 12, 7, 8, 8, 9, "1-2 mins", None, 1),
            ("Machine Preacher Curl", 7, 1, 12, 15, 7, 8, 8, 9, "1-2 mins", None, 1),
        ],
    },
    {
        "name": "4 Push Day",
        "normal": [
            ("Barbell Bench Press", 1, 3, 8, 10, 8, 9, 10, 10, "3-5 mins", "Failure", 3),
            ("Machine Shoulder Press", 2, 2, 8, 10, 8, 9, 10, 10, "2-3 mins", "Failure", 2),
            ("Bottom-Half DB Flye", 3, 2, 10, 12, 8, 9, 10, 10, "1-2 mins", "Failure", 1),
            ("High-Cable Lateral Raise", 4, 2, 10, 12, 8, 9, 10, 10, "1-2 mins", "Myo-reps", 1),
            ("Overhead CableTriceps Extension (Bar)", 5, 2, 10, 12, 8, 9, 10, 10, "1-2 mins", "Failure", 1),
            ("Cable Triceps Kickback", 6, 1, 12, 15, 7, 8, 10, 10, "1-2 mins", "Myo-reps", 1),
            ("Roman Chair Leg Raise", 7, 2, 10, 20, 8, 9, 10, 10, "1-2 mins", "Failure", 1),
        ],
        "deload": [
            ("Barbell Bench Press", 1, 2, 8, 10, 6, 7, 7, 8, "3-5 mins", None, 3),
            ("Machine Shoulder Press", 2, 2, 8, 10, 6, 7, 7, 8, "2-3 mins", None, 2),
            ("Bottom-Half DB Flye", 3, 2, 10, 12, 7, 8, 8, 9, "1-2 mins", None, 1),
            ("High-Cable Lateral Raise", 4, 2, 10, 12, 7, 8, 8, 9, "1-2 mins", None, 1),
            ("Overhead CableTriceps Extension (Bar)", 5, 2, 10, 12, 7, 8, 8, 9, "1-2 mins", None, 1),
            ("Cable Triceps Kickback", 6, 1, 12, 15, 7, 8, 8, 9, "1-2 mins", None, 1),
            ("Roman Chair Leg Raise", 7, 2, 10, 20, 7, 8, 8, 9, "1-2 mins", None, 1),
        ],
    },
    {
        "name": "5 Legs Day",
        "normal": [
            ("Leg Press", 1, 3, 8, 10, 8, 9, 10, 10, "2-3 mins", "Failure", 3),
            ("Seated Leg Curl", 2, 2, 10, 12, 8, 9, 10, 10, "1-2 mins", "Failure + LLPs (Extend set)", 1),
            ("DB Bulgarian Split Squat", 3, 2, 8, 10, 8, 9, 10, 10, "2-3 mins", "Failure", 2),
            ("Leg Extension", 4, 2, 10, 12, 8, 9, 10, 10, "1-2 mins", "Myo-reps", 1),
            ("Machine Hip Adduction", 5, 2, 10, 12, 8, 9, 10, 10, "1-2 mins", "Failure", 1),
            ("Machine Hip Abduction", 6, 2, 10, 12, 8, 9, 10, 10, "1-2 mins", "Failure", 1),
            ("Standing Calf Raise", 7, 2, 10, 12, 8, 9, 10, 10, "1-2 mins", "Static Stretch (30sec)", 1),
        ],
        "deload": [
            ("Leg Press", 1, 2, 8, 10, 6, 7, 7, 8, "2-3 mins", None, 3),
            ("Seated Leg Curl", 2, 2, 10, 12, 7, 8, 8, 9, "1-2 mins", None, 1),
            ("DB Bulgarian Split Squat", 3, 2, 8, 10, 6, 7, 7, 8, "2-3 mins", None, 2),
            ("Leg Extension", 4, 2, 10, 12, 7, 8, 8, 9, "1-2 mins", None, 1),
            ("Machine Hip Adduction", 5, 2, 10, 12, 7, 8, 8, 9, "1-2 mins", None, 1),
            ("Machine Hip Abduction", 6, 2, 10, 12, 7, 8, 8, 9, "1-2 mins", None, 1),
            ("Standing Calf Raise", 7, 2, 10, 12, 7, 8, 8, 9, "1-2 mins", None, 1),
        ],
    },
]


async def clone_default_templates(db: AsyncSession, user_id: str | UUID) -> None:
    """Create copies of the 5 default workout templates for a new user."""
    # Build exercise name → id lookup from global (user_id=NULL) exercises
    result = await db.execute(
        select(Exercise).where(Exercise.user_id.is_(None))
    )
    name_to_id: dict[str, str] = {
        e.name: e.id for e in result.scalars().all()
    }

    for tpl_data in templates_data:
        template = WorkoutTemplate(user_id=str(user_id), name=tpl_data["name"])
        db.add(template)
        await db.flush()  # populate template.id

        for week_type in ("normal", "deload"):
            for ex in tpl_data[week_type]:
                (ex_name, order, working_sets, min_reps, max_reps,
                 es_rpe_min, es_rpe_max, ls_rpe_min, ls_rpe_max,
                 rest_period, intensity_technique, warmup_sets) = ex

                exercise_id = name_to_id.get(ex_name)
                if exercise_id is None:
                    continue

                te = TemplateExercise(
                    template_id=template.id,
                    exercise_id=exercise_id,
                    week_type=week_type,
                    order=order,
                    working_sets=working_sets,
                    min_reps=min_reps,
                    max_reps=max_reps,
                    early_set_rpe_min=es_rpe_min,
                    early_set_rpe_max=es_rpe_max,
                    last_set_rpe_min=ls_rpe_min,
                    last_set_rpe_max=ls_rpe_max,
                    rest_period=rest_period,
                    intensity_technique=intensity_technique,
                    warmup_sets=warmup_sets,
                )
                db.add(te)

    await db.flush()
