"""FastAPI dependencies for authentication, user resolution, and security."""

from __future__ import annotations

import logging
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from quantlab.auth.security import decode_access_token
from quantlab.config import settings
from quantlab.storage.repository import UserRecord, get_user_by_id

logger = logging.getLogger(__name__)

# auto_error=False ensures unauthenticated guests do not automatically fail with 403
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user_optional(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
) -> UserRecord | None:
    """Extract current user from Bearer JWT token if present.

    Returns None if no token or token is invalid/expired. Does not raise HTTPException.
    """
    if credentials is None or not credentials.credentials:
        return None

    token = credentials.credentials
    claims = decode_access_token(token, secret_key=settings.jwt_secret)
    if not claims or "sub" not in claims:
        return None

    try:
        user_id = int(claims["sub"])
    except (ValueError, TypeError):
        return None

    user = get_user_by_id(user_id)
    return user


def get_current_user_required(
    user: Annotated[UserRecord | None, Depends(get_current_user_optional)] = None,
) -> UserRecord:
    """Enforce authentication on protected endpoints."""
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
