import sqlalchemy
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, async_session, engine, settings
from app.routes.auth import router as auth_router
from app.routes.exercises import router as exercises_router
from app.routes.programs import router as programs_router
from app.routes.progress import router as progress_router
from app.routes.sessions import router as sessions_router
from app.routes.stats import router as stats_router
from app.routes.sync import router as sync_router
from app.routes.templates import router as templates_router
from app.seed import seed_exercises


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        print(f"[LIFESPAN] Connecting to DB, schema={settings.DB_SCHEMA}")
        async with engine.begin() as conn:
            await conn.execute(
                sqlalchemy.text(f"CREATE SCHEMA IF NOT EXISTS {settings.DB_SCHEMA}")
            )
            print("[LIFESPAN] Schema created/verified")
            await conn.run_sync(Base.metadata.create_all)
            print("[LIFESPAN] Tables created")
        async with async_session() as db:
            await seed_exercises(db)
            print("[LIFESPAN] Seed complete")
    except Exception as e:
        print(f"[LIFESPAN] ERROR: {e}")
        raise
    yield


app = FastAPI(title="Gym Tracker API", lifespan=lifespan)

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
