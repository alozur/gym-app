from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import async_session, settings
from app.routes.auth import router as auth_router
from app.routes.exercises import router as exercises_router
from app.routes.programs import router as programs_router
from app.routes.progress import router as progress_router
from app.routes.sessions import router as sessions_router
from app.routes.stats import router as stats_router
from app.routes.sync import router as sync_router
from app.routes.templates import router as templates_router
from app.seed import seed_default_program, seed_exercises
from app.seed_minimalift import seed_minimalift_program
from app.seed_minimalift_5day import seed_minimalift_5day_program


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        print("[LIFESPAN] Connecting to DB")
        async with async_session() as db:
            await seed_exercises(db)
            print("[LIFESPAN] Exercises seeded")
            await seed_default_program(db)
            print("[LIFESPAN] JN program seeded")
            await seed_minimalift_program(db)
            print("[LIFESPAN] Minimalift 3-Day program seeded")
            await seed_minimalift_5day_program(db)
            print("[LIFESPAN] Minimalift 5-Day program seeded")
    except Exception as e:
        print(f"[LIFESPAN] ERROR: {e}")
        raise
    yield


app = FastAPI(
    title="Gym Tracker API",
    lifespan=lifespan,
    redirect_slashes=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(exercises_router)
app.include_router(templates_router)
app.include_router(sessions_router)
app.include_router(programs_router)
app.include_router(progress_router)
app.include_router(stats_router)
app.include_router(sync_router)


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}
