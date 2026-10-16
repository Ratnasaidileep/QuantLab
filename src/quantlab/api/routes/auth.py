"""Authentication endpoints for QuantLab (User Registration, Login, Token generation)."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from quantlab.api.dependencies import get_current_user_required
from quantlab.api.schemas import AuthResponse, LoginRequest, RegisterRequest, UserDTO
from quantlab.auth.security import (
    create_access_token,
    hash_password,
    verify_password,
)
from quantlab.config import settings
from quantlab.storage.repository import (
    UserRecord,
    create_user,
    get_user_by_username,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest) -> AuthResponse:
    """Register a new QuantLab user account."""
    clean_username = request.username.strip().lower()

    if len(clean_username) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be at least 3 characters long.",
        )

    if len(request.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long.",
        )

    # Check if user already exists
    existing = get_user_by_username(clean_username)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{clean_username}' is already taken.",
        )

    password_hash, salt = hash_password(request.password)
    try:
        user_record = create_user(clean_username, password_hash, salt)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(err),
        ) from err

    token = create_access_token(
        data={"sub": str(user_record.id), "username": user_record.username},
        secret_key=settings.jwt_secret,
        expires_in_seconds=settings.jwt_expiration_hours * 3600,
    )

    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=UserDTO(
            id=user_record.id,
            username=user_record.username,
            created_at=user_record.created_at,
        ),
    )


@router.post("/login", response_model=AuthResponse)
def login(request: LoginRequest) -> AuthResponse:
    """Authenticate with username and password, returning a signed JWT access token."""
    clean_username = request.username.strip().lower()
    user_data = get_user_by_username(clean_username)

    if user_data is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_record, stored_hash, salt = user_data
    if not verify_password(request.password, stored_hash, salt):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(
        data={"sub": str(user_record.id), "username": user_record.username},
        secret_key=settings.jwt_secret,
        expires_in_seconds=settings.jwt_expiration_hours * 3600,
    )

    return AuthResponse(
        access_token=token,
        token_type="bearer",
        user=UserDTO(
            id=user_record.id,
            username=user_record.username,
            created_at=user_record.created_at,
        ),
    )


@router.get("/me", response_model=UserDTO)
def get_current_user_profile(
    current_user: Annotated[UserRecord, Depends(get_current_user_required)],
) -> UserDTO:
    """Retrieve profile of the currently authenticated user."""
    return UserDTO(
        id=current_user.id,
        username=current_user.username,
        created_at=current_user.created_at,
    )
