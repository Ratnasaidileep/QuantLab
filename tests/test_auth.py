"""Unit and integration tests for authentication, JWT cryptography, and isolated workspaces."""

import time

import pytest
from fastapi.testclient import TestClient

from quantlab.api.main import app
from quantlab.auth.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


@pytest.fixture
def client():
    return TestClient(app)


def test_password_hashing_and_verification():
    password = "SuperSecretPassword123!"
    hash1, salt1 = hash_password(password)
    hash2, salt2 = hash_password(password)

    # Hashes and salts must be unique per invocation
    assert salt1 != salt2
    assert hash1 != hash2

    # Verification must succeed for correct password
    assert verify_password(password, hash1, salt1) is True
    assert verify_password(password, hash2, salt2) is True

    # Verification must fail for incorrect password
    assert verify_password("WrongPassword", hash1, salt1) is False
    assert verify_password("", hash1, salt1) is False


def test_jwt_creation_and_decoding():
    secret = "test-secret-key-for-jwt-testing-12345"
    payload = {"sub": "42", "username": "quant_trader"}

    token = create_access_token(payload, secret_key=secret, expires_in_seconds=3600)
    assert isinstance(token, str)
    parts = token.split(".")
    assert len(parts) == 3

    # Valid token decoding
    claims = decode_access_token(token, secret_key=secret)
    assert claims is not None
    assert claims["sub"] == "42"
    assert claims["username"] == "quant_trader"
    assert "exp" in claims
    assert "iat" in claims


def test_jwt_tampering_and_expiration():
    secret = "test-secret-key-for-jwt-testing-12345"
    payload = {"sub": "100", "username": "eve"}

    token = create_access_token(payload, secret_key=secret, expires_in_seconds=1)
    parts = token.split(".")

    # Tampered signature
    tampered_token = f"{parts[0]}.{parts[1]}.badsignature"
    assert decode_access_token(tampered_token, secret_key=secret) is None

    # Wrong secret key
    assert decode_access_token(token, secret_key="different-secret-key") is None

    # Expired token
    expired_token = create_access_token(payload, secret_key=secret, expires_in_seconds=-10)
    assert decode_access_token(expired_token, secret_key=secret) is None


def test_auth_registration_and_login_flow(client: TestClient):
    unique_user = f"user_{int(time.time() * 1000)}"

    # 1. Register new user
    reg_res = client.post(
        "/api/v1/auth/register",
        json={"username": unique_user, "password": "password123"},
    )
    assert reg_res.status_code == 201
    data = reg_res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == unique_user

    # 2. Duplicate registration fails with 409
    dup_res = client.post(
        "/api/v1/auth/register",
        json={"username": unique_user, "password": "password123"},
    )
    assert dup_res.status_code == 409

    # 3. Validation limits: short username or password
    short_user = client.post(
        "/api/v1/auth/register",
        json={"username": "ab", "password": "password123"},
    )
    assert short_user.status_code in (400, 422)

    short_pass = client.post(
        "/api/v1/auth/register",
        json={"username": "valid_user", "password": "123"},
    )
    assert short_pass.status_code in (400, 422)

    # 4. Login with valid credentials
    login_res = client.post(
        "/api/v1/auth/login",
        json={"username": unique_user, "password": "password123"},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    token = login_data["access_token"]
    assert token

    # 5. Login with invalid password
    bad_login = client.post(
        "/api/v1/auth/login",
        json={"username": unique_user, "password": "wrong_password"},
    )
    assert bad_login.status_code == 401

    # 6. Check /auth/me profile
    headers = {"Authorization": f"Bearer {token}"}
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["username"] == unique_user

    # 7. Check /auth/me without token fails with 401
    unauth_res = client.get("/api/v1/auth/me")
    assert unauth_res.status_code == 401


def test_workspace_isolation_between_users(client: TestClient):
    ts = int(time.time() * 1000)
    user1 = f"alice_{ts}"
    user2 = f"bob_{ts}"

    # Register Alice
    res1 = client.post("/api/v1/auth/register", json={"username": user1, "password": "password123"})
    token1 = res1.json()["access_token"]
    headers1 = {"Authorization": f"Bearer {token1}"}

    # Register Bob
    res2 = client.post("/api/v1/auth/register", json={"username": user2, "password": "password123"})
    token2 = res2.json()["access_token"]
    headers2 = {"Authorization": f"Bearer {token2}"}

    # Alice saves an experiment
    exp_payload_alice = {
        "name": "Alice Private MA Strategy",
        "notes": "Confidential",
        "dataset": "reliance_daily.csv",
        "strategy": "moving_average",
        "parameters": {"fast_period": 10, "slow_period": 30},
        "initial_cash": 100000.0,
        "commission_rate": 0.001,
        "slippage_rate": 0.001,
        "sizing_mode": "unit",
        "quantity_per_trade": 1.0,
        "final_equity": 115000.0,
        "total_pnl": 15000.0,
        "total_return": 0.15,
        "max_drawdown": 0.05,
        "total_trades": 12,
        "win_rate": 0.6,
        "profit_factor": 1.8,
        "sharpe_ratio": 1.5,
        "sortino_ratio": 2.1,
        "cagr": 0.12,
        "equity_curve": [{"timestamp": "2026-01-01", "equity": 100000.0, "cash": 100000.0}],
        "trades": [],
    }
    create_alice = client.post("/api/v1/experiments", json=exp_payload_alice, headers=headers1)
    assert create_alice.status_code == 201
    alice_exp_id = create_alice.json()["id"]

    # Bob saves an experiment
    exp_payload_bob = {
        **exp_payload_alice,
        "name": "Bob Private RSI Strategy",
        "strategy": "rsi",
    }
    create_bob = client.post("/api/v1/experiments", json=exp_payload_bob, headers=headers2)
    assert create_bob.status_code == 201
    bob_exp_id = create_bob.json()["id"]

    # Alice queries experiments: sees only Alice's experiment
    alice_list = client.get("/api/v1/experiments", headers=headers1).json()
    alice_names = [e["name"] for e in alice_list["experiments"]]
    assert "Alice Private MA Strategy" in alice_names
    assert "Bob Private RSI Strategy" not in alice_names

    # Bob queries experiments: sees only Bob's experiment
    bob_list = client.get("/api/v1/experiments", headers=headers2).json()
    bob_names = [e["name"] for e in bob_list["experiments"]]
    assert "Bob Private RSI Strategy" in bob_names
    assert "Alice Private MA Strategy" not in bob_names

    # Bob attempts to delete Alice's experiment -> returns 404 (isolated)
    bad_delete = client.delete(f"/api/v1/experiments/{alice_exp_id}", headers=headers2)
    assert bad_delete.status_code == 404

    # Unauthenticated guest attempts to delete Alice's experiment -> returns 404 (isolated)
    guest_delete = client.delete(f"/api/v1/experiments/{alice_exp_id}")
    assert guest_delete.status_code == 404

    # Unauthenticated guest attempts to fetch Alice's private experiment -> returns 404
    guest_get = client.get(f"/api/v1/experiments/{alice_exp_id}")
    assert guest_get.status_code == 404

    # Unauthenticated guest list -> Alice's and Bob's private experiments are NOT leaked
    guest_list = client.get("/api/v1/experiments").json()
    guest_names = [e["name"] for e in guest_list["experiments"]]
    assert "Alice Private MA Strategy" not in guest_names
    assert "Bob Private RSI Strategy" not in guest_names

    # Alice deletes her own experiment -> succeeds
    good_delete = client.delete(f"/api/v1/experiments/{alice_exp_id}", headers=headers1)
    assert good_delete.status_code == 200

    # Cleanup Bob's experiment
    client.delete(f"/api/v1/experiments/{bob_exp_id}", headers=headers2)

