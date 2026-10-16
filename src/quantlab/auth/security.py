"""Cryptographic utilities for password hashing and RFC 7519 JWT handling.

Implements PBKDF2-HMAC-SHA256 password hashing with salt and HS256 JWT tokens
using Python standard library (hashlib, hmac, secrets, base64, json, time).
Zero external dependencies required.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any

# Standard PBKDF2 iterations recommended by NIST for SHA-256
PBKDF2_ITERATIONS = 100_000


def hash_password(password: str, salt: str | None = None) -> tuple[str, str]:
    """Hash a plaintext password with a cryptographically secure random salt using PBKDF2-HMAC-SHA256.

    Returns:
        tuple[str, str]: (password_hash_hex, salt_hex)
    """
    if salt is None:
        salt = secrets.token_hex(16)

    derived = hashlib.pbkdf2_hmac(
        hash_name="sha256",
        password=password.encode("utf-8"),
        salt=salt.encode("utf-8"),
        iterations=PBKDF2_ITERATIONS,
    )
    return derived.hex(), salt


def verify_password(plain_password: str, password_hash: str, salt: str) -> bool:
    """Verify a plaintext password against a stored PBKDF2 hash using constant-time comparison."""
    computed_hash, _ = hash_password(plain_password, salt=salt)
    return hmac.compare_digest(computed_hash, password_hash)


def _b64url_encode(data: bytes) -> str:
    """Base64url encode without trailing '=' padding."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")


def _b64url_decode(data: str) -> bytes:
    """Base64url decode with restored '=' padding."""
    rem = len(data) % 4
    if rem > 0:
        data += "=" * (4 - rem)
    return base64.urlsafe_b64decode(data.encode("utf-8"))


def create_access_token(
    data: dict[str, Any],
    secret_key: str,
    expires_in_seconds: int = 86400,
) -> str:
    """Create a standard RFC 7519 HS256 JSON Web Token (JWT).

    Args:
        data: Payload claims (e.g., {"sub": "1", "username": "alice"}).
        secret_key: Cryptographic HMAC signing secret key.
        expires_in_seconds: Token validity duration in seconds (default: 24h).

    Returns:
        str: Encoded and signed JWT token: '<header>.<payload>.<signature>'.
    """
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {**data, "iat": now, "exp": now + expires_in_seconds}

    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))

    signing_input = f"{header_b64}.{payload_b64}".encode()
    signature = hmac.new(secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(signature)

    return f"{header_b64}.{payload_b64}.{sig_b64}"


def decode_access_token(token: str, secret_key: str) -> dict[str, Any] | None:
    """Decode and cryptographically verify an RFC 7519 HS256 JWT token.

    Validates signature and expiration timestamp ('exp').

    Args:
        token: JWT string.
        secret_key: Signing secret key.

    Returns:
        dict[str, Any] | None: Decoded payload claims, or None if invalid/expired.
    """
    if not token or not isinstance(token, str):
        return None

    parts = token.strip().split(".")
    if len(parts) != 3:
        return None

    header_b64, payload_b64, sig_b64 = parts
    signing_input = f"{header_b64}.{payload_b64}".encode()
    expected_signature = hmac.new(secret_key.encode("utf-8"), signing_input, hashlib.sha256).digest()

    try:
        actual_signature = _b64url_decode(sig_b64)
        if not hmac.compare_digest(expected_signature, actual_signature):
            return None

        payload_bytes = _b64url_decode(payload_b64)
        claims = json.loads(payload_bytes.decode("utf-8"))

        # Verify expiration
        exp = claims.get("exp")
        if exp is not None and time.time() > float(exp):
            return None

        return claims
    except (ValueError, TypeError, json.JSONDecodeError):
        return None
