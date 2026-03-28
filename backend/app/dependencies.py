from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session, settings
from app.models import User


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async database session."""
    async with async_session() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Read Authelia forward-auth headers and return the authenticated User.

    If the user doesn't exist in the database yet, auto-provision them.
    """
    email = request.headers.get("Remote-Email") or settings.DEV_USER_EMAIL
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None:
        display_name = request.headers.get("Remote-Name", email.split("@")[0])
        user = User(
            email=email,
            display_name=display_name,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return user
