from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models import User
from app.schemas import (
    MessageResponse,
    UserResponse,
    UserUpdateRequest,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", status_code=410)
async def login_gone() -> MessageResponse:
    """Login is handled by Authelia. This endpoint is kept for backwards compat."""
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Login is now handled by Authelia at https://auth.zurera.cloud",
    )


@router.post("/register", status_code=410)
async def register_gone() -> MessageResponse:
    """Registration is handled by Authelia."""
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Registration is now handled by Authelia at https://auth.zurera.cloud",
    )


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    """Return the currently authenticated user."""
    return UserResponse.model_validate(current_user)


@router.put("/me", response_model=UserResponse)
async def update_me(
    body: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    """Update the currently authenticated user's profile."""
    if body.display_name is not None:
        current_user.display_name = body.display_name
    if body.preferred_unit is not None:
        if body.preferred_unit not in ("kg", "lbs"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="preferred_unit must be 'kg' or 'lbs'",
            )
        current_user.preferred_unit = body.preferred_unit
    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.post("/logout", response_model=MessageResponse)
async def logout() -> MessageResponse:
    """Log out — actual session handled by Authelia."""
    return MessageResponse(message="Successfully logged out")
