# Gym Workout Tracker - PWA with FastAPI Backend

## Context

Build a personal gym workout tracking app that works offline at the gym (poor connectivity), syncs to Postgres when online, and includes built-in dashboards for visualizing progress over time.

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 + Vite + TypeScript | Fast dev experience, intermediate-friendly |
| PWA | vite-plugin-pwa (Workbox) | Service worker + offline caching |
| Offline DB | Dexie.js (IndexedDB wrapper) | Stores workouts locally when offline |
| Charts | Recharts | React-native charting, clean API |
| UI | Tailwind CSS + shadcn/ui | Fast to build, mobile-first, good defaults |
| Auth | JWT (access + refresh tokens) | Email/password login, tokens stored in httpOnly cookies |
| Backend | FastAPI + SQLAlchemy | Lightweight Python API, matches your skills |
| Database | PostgreSQL (your existing setup) | Persistent storage, sync target |
| Passwords | passlib + bcrypt | Industry-standard password hashing |
| Sync | Custom online/offline sync | Dexie -> FastAPI -> Postgres when online |

## Data Model

The data model separates **prescription** (what the program tells you to do) from **tracking** (what you actually did). Each template has Normal and Deload week variants with different RPE targets, set counts, and intensity techniques.

### PostgreSQL Tables

```
users
  id (UUID, PK)
  email (VARCHAR, UNIQUE)
  password_hash (VARCHAR) -- bcrypt hashed
  display_name (VARCHAR)
  preferred_unit (VARCHAR) -- 'kg' or 'lbs', default 'kg'
  created_at (TIMESTAMP)

exercises
  id (UUID, PK)
  user_id (FK -> users, nullable) -- null for pre-seeded, set for user-created
  name (VARCHAR) -- e.g., "Bench Press", "Squat"
  muscle_group (VARCHAR) -- e.g., "Chest", "Legs"
  equipment (VARCHAR, nullable) -- e.g., "Barbell", "Dumbbell"
  is_custom (BOOLEAN) -- user-created vs. pre-seeded
  youtube_url (VARCHAR, nullable) -- instructional video link
  notes (TEXT, nullable) -- form cues, tips, extra explanation
  created_at (TIMESTAMP)

exercise_substitutions
  id (UUID, PK)
  exercise_id (FK -> exercises) -- the primary exercise
  substitute_exercise_id (FK -> exercises) -- the replacement
  priority (INT) -- 1 = first choice, 2 = second choice

workout_templates
  id (UUID, PK)
  user_id (FK -> users)
  name (VARCHAR) -- e.g., "Push Day", "Leg Day"
  created_at (TIMESTAMP)

-- Prescription: what you SHOULD do for each exercise in a template.
-- Each exercise has TWO rows: one for week_type='normal', one for week_type='deload'.
template_exercises
  id (UUID, PK)
  template_id (FK -> workout_templates)
  exercise_id (FK -> exercises)
  week_type (VARCHAR) -- 'normal' or 'deload'
  order (INT) -- exercise order within the workout
  working_sets (INT) -- e.g., 2 or 3
  min_reps (INT) -- e.g., 6
  max_reps (INT) -- e.g., 8
  early_set_rpe_min (DECIMAL) -- e.g., 8 (normal) or 6 (deload)
  early_set_rpe_max (DECIMAL) -- e.g., 9 (normal) or 7 (deload)
  last_set_rpe_min (DECIMAL) -- e.g., 10 (normal) or 8 (deload)
  last_set_rpe_max (DECIMAL) -- e.g., 10 (normal) or 9 (deload)
  rest_period (VARCHAR) -- e.g., "1-2 mins", "3-5 mins"
  intensity_technique (VARCHAR, nullable) -- e.g., "Failure", "Failure + LLPs (Extend set)", "Static Stretch (30s)", null for deload
  min_warmup_sets (INT) -- e.g., 1
  max_warmup_sets (INT) -- e.g., 2

-- Tracking: what you ACTUALLY did.
workout_sessions
  id (UUID, PK)
  user_id (FK -> users)
  template_id (FK -> workout_templates, nullable) -- null if ad-hoc
  year_week (VARCHAR, nullable) -- e.g., "2025-27" for tracking over time
  week_type (VARCHAR) -- 'normal' or 'deload'
  started_at (TIMESTAMP)
  finished_at (TIMESTAMP, nullable)
  notes (TEXT, nullable)
  synced (BOOLEAN) -- tracks sync status

workout_sets
  id (UUID, PK)
  session_id (FK -> workout_sessions)
  exercise_id (FK -> exercises)
  set_type (VARCHAR) -- 'warmup' or 'working'
  set_number (INT) -- 1-based within its set_type
  reps (INT)
  weight (DECIMAL) -- in user's preferred unit
  rpe (DECIMAL, nullable) -- rate of perceived exertion (1-10)
  notes (TEXT, nullable)
  created_at (TIMESTAMP)

-- Tracks per-exercise maximums and warm-up weights over time.
-- Updated automatically when sets are logged.
exercise_progress
  id (UUID, PK)
  user_id (FK -> users)
  exercise_id (FK -> exercises)
  year_week (VARCHAR) -- e.g., "2025-27"
  max_weight (DECIMAL) -- heaviest working set weight that week
  warmup_weight_range (VARCHAR, nullable) -- e.g., "20 - 28"
  warmup_sets_done (INT, nullable)
  created_at (TIMESTAMP)
  UNIQUE(user_id, exercise_id, year_week)
```

### Example: Lying Leg Curl Prescription vs Tracking

**Prescription (template_exercises, week_type='normal'):**
- 2 working sets, 8-10 reps, early RPE 8-9, last RPE 10
- Rest: 1-2 mins, intensity: "Failure + LLPs (Extend set)"
- 2 warm-up sets, substitutions: Seated Leg Curl, Nordic Ham Curl

**Tracking (workout_sets for session 2025-30):**
- Warm-up: Set 1 @ 20kg, Set 2 @ 28kg
- Working: Set 1 @ 37.5kg x 12 reps, Set 2 @ 40kg x 11 reps
- Max weight: 40kg

### IndexedDB (Dexie) mirrors the same schema for offline storage, plus a `sync_status` field (`pending` | `synced`) on each record.

## Key Features

### Phase 1 - Core (MVP)
1. **Workout logging** - Start a session (from template or blank), log warm-up and working sets with exercise/reps/weight/RPE
2. **Exercise library** - Pre-seeded common exercises with YouTube links, notes, and substitution exercises + ability to add custom ones
3. **Workout templates with prescriptions** - Create routines with full programming: working sets, rep ranges, RPE targets, rest periods, intensity techniques, warm-up set ranges
4. **Normal vs Deload weeks** - Each template has Normal and Deload variants with different set counts, RPE targets, and intensity techniques
5. **Per-exercise tracking log** - Year-week tracking of all sets (kg + reps), max weight, warm-up weights per exercise over time
6. **Exercise substitutions** - Each exercise can have 2 substitution alternatives with their own warm-up sets and max KG tracking
7. **Offline-first** - Full functionality without internet, auto-sync when online
8. **PWA install** - Add to home screen, feels like a native app

### Phase 2 - Dashboards
9. **Progress charts** - Weight progression per exercise over time (line charts), sourced from exercise_progress table
10. **Volume tracking** - Total volume (sets x reps x weight) per muscle group per week
11. **Personal records** - Track and highlight PRs (heaviest weight, most reps) with year-week context
12. **Workout history** - Calendar view of past sessions with summaries, filterable by year-week
13. **Workout frequency** - Heatmap or bar chart of training consistency

### Phase 3 - Polish
14. **Rest timer** - Configurable countdown between sets (pre-filled from template prescription)
15. **Quick-log mode** - Minimal UI for fast input mid-workout
16. **Data export** - CSV/JSON export for external analysis
17. **Unit toggle** - kg/lbs preference
18. **Intensity technique prompts** - After last working set, prompt for the prescribed intensity technique (Failure, LLPs, Static Stretch, etc.)

## Project Structure (New Repo)

```
gym-tracker/
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Route pages (Login, Home, Workout, Dashboard, Templates)
│   │   ├── context/          # React contexts (AuthContext, ThemeContext)
│   │   ├── db/               # Dexie.js schema + sync logic
│   │   ├── hooks/            # Custom React hooks (useAuth, useWorkout, useSync)
│   │   ├── api/              # API client (fetch wrapper with auth headers)
│   │   ├── charts/           # Dashboard chart components
│   │   └── utils/            # Helpers (date formatting, unit conversion)
│   ├── public/
│   │   └── manifest.json     # PWA manifest
│   ├── index.html
│   ├── vite.config.ts        # PWA plugin config
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app entry
│   │   ├── models.py         # SQLAlchemy models (8 tables: users, exercises, exercise_substitutions, workout_templates, template_exercises, workout_sessions, workout_sets, exercise_progress)
│   │   ├── schemas.py        # Pydantic request/response schemas
│   │   ├── auth.py           # JWT creation, verification, password hashing
│   │   ├── dependencies.py   # FastAPI dependencies (get_current_user, get_db)
│   │   ├── routes/
│   │   │   ├── auth.py       # Register, login, refresh, logout
│   │   │   ├── exercises.py  # Exercise CRUD + substitutions
│   │   │   ├── templates.py  # Template CRUD with normal/deload prescriptions
│   │   │   ├── sessions.py   # Session + set logging
│   │   │   ├── progress.py   # Per-exercise year-week tracking log
│   │   │   ├── sync.py
│   │   │   └── stats.py      # Volume, PRs
│   │   ├── database.py       # DB connection + session
│   │   └── seed.py           # Pre-seed exercises with youtube_url, notes, substitutions
│   ├── alembic/              # DB migrations
│   ├── requirements.txt
│   └── .env                  # DB connection string + JWT secret
├── docker-compose.yml        # Optional: local Postgres + API
├── CODING_STANDARDS.md       # Project coding standards
└── README.md
```

## Offline Sync Strategy

1. **All writes go to IndexedDB first** (via Dexie.js)
2. **Navigator.onLine** + periodic checks detect connectivity
3. **When online**: background sync pushes `pending` records to FastAPI -> Postgres
4. **Conflict resolution**: Last-write-wins (simple, sufficient for single-user)
5. **Sync queue**: Failed syncs retry with exponential backoff
6. **Full offline capability**: App loads from Service Worker cache, all CRUD works against IndexedDB

## Authentication

- **Registration**: Email + password -> hash with bcrypt, store in `users` table
- **Login**: Verify credentials -> issue JWT access token (15min) + refresh token (7 days)
- **Token storage**: httpOnly cookies (secure, no XSS risk) + localStorage fallback for offline
- **Protected routes**: All API endpoints except `/auth/*` require valid JWT
- **Offline auth**: After first login, user token is cached locally; app works offline without re-auth
- **Password reset**: Email-based reset flow (Phase 3 - nice to have)

## API Endpoints (FastAPI)

```
# Auth (public)
POST   /api/auth/register       # Create account (email, password, display_name)
POST   /api/auth/login           # Login -> returns JWT tokens
POST   /api/auth/refresh         # Refresh access token
POST   /api/auth/logout          # Invalidate refresh token

# Exercises (protected)
GET    /api/exercises            # List all exercises (pre-seeded + user's custom) with substitutions
POST   /api/exercises            # Create custom exercise (with youtube_url, notes)
GET    /api/exercises/{id}       # Get exercise detail with substitutions
PUT    /api/exercises/{id}       # Update exercise (youtube_url, notes, etc.)
POST   /api/exercises/{id}/substitutions  # Add substitution exercise (priority 1 or 2)

# Templates (protected)
GET    /api/templates            # List user's workout templates
POST   /api/templates            # Create template with full prescription (normal + deload variants)
GET    /api/templates/{id}       # Get template with all exercise prescriptions for both week types
PUT    /api/templates/{id}       # Update template
DELETE /api/templates/{id}       # Delete template

# Sessions (protected)
GET    /api/sessions             # List user's workout sessions (filterable by year_week, week_type)
POST   /api/sessions             # Start a session (from template or ad-hoc, specify week_type)
GET    /api/sessions/{id}        # Get session detail with all sets (warmup + working)
PUT    /api/sessions/{id}        # Update session (finish, add notes)

# Sets (protected)
POST   /api/sessions/{id}/sets   # Log a set (set_type, exercise, reps, weight, rpe)
PUT    /api/sets/{id}            # Update a logged set
DELETE /api/sets/{id}            # Delete a logged set

# Progress & Stats (protected)
GET    /api/progress/exercise/{id}  # Exercise tracking log: year-week history of sets, max weight, warm-up weights
GET    /api/stats/volume            # Volume over time by muscle group
GET    /api/stats/records           # Personal records (max weight, max reps per exercise)

# Sync
POST   /api/sync                 # Bulk sync from client (receives pending records)
```

## Implementation Order

1. **Backend setup** - FastAPI project, SQLAlchemy models (all 8 tables), Alembic migrations, connect to Postgres
2. **Authentication** - User model, registration, login, JWT middleware, protected routes
3. **Seed data** - Pre-populate exercises with youtube_url, notes, muscle_group, equipment + substitution relationships (e.g., Lying Leg Curl -> Seated Leg Curl / Nordic Ham Curl)
4. **Backend API routes** - Exercise CRUD (with substitutions), template CRUD (with normal/deload prescriptions), session/set CRUD, progress tracking, sync endpoint
5. **Frontend scaffold** - Vite + React + TypeScript + Tailwind + shadcn/ui + PWA plugin
6. **Login/Register UI** - Auth pages, token management, auth context provider
7. **Dexie.js offline DB** - Mirror all 8 tables in IndexedDB
8. **Template builder UI** - Create/edit templates with full prescription: working sets, rep ranges, RPE targets (normal + deload), rest periods, intensity techniques, warm-up set ranges, exercise substitutions
9. **Workout logging UI** - Start session (pick template + week type), log warm-up and working sets per exercise with weight/reps/RPE, show prescribed targets inline, prompt intensity techniques on last set
10. **Exercise tracking log UI** - Per-exercise year-week history table (Set 1-4 kg/reps, max weight, warm-up kg), matching the spreadsheet layout
11. **Sync engine** - Background sync from IndexedDB to API
12. **Dashboard page** - Recharts visualizations (progress, volume, PRs, year-week timeline)
13. **PWA polish** - Icons, manifest, install prompt, offline indicator

## Verification

- **Offline test**: Enable airplane mode on phone, log a full workout -> data persists in IndexedDB
- **Sync test**: Disable airplane mode -> pending records sync to Postgres
- **Auth test**: Register, login, logout, refresh token flow
- **PWA install**: "Add to Home Screen" from Chrome on Android / Safari on iOS
- **Dashboard test**: After several logged workouts, verify charts show correct progression
- **Lighthouse audit**: Run Lighthouse PWA audit, target 90+ score
