import json
import sqlite3
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from quantlab.config import settings

DEFAULT_DB_PATH = settings.db_path


@dataclass(frozen=True)
class UserRecord:
    id: int
    username: str
    created_at: str


@dataclass(frozen=True)
class ExperimentSummary:
    id: int
    name: str
    notes: str
    created_at: str
    dataset: str
    strategy: str
    parameters: dict[str, Any]
    initial_cash: float
    final_equity: float
    total_pnl: float
    total_return: float
    max_drawdown: float
    total_trades: int
    win_rate: float | None = None
    profit_factor: float | None = None
    sharpe_ratio: float | None = None
    sortino_ratio: float | None = None
    cagr: float | None = None
    user_id: int | None = None


@dataclass(frozen=True)
class ExperimentRecord:
    id: int
    name: str
    notes: str
    created_at: str
    dataset: str
    strategy: str
    parameters: dict[str, Any]
    initial_cash: float
    commission_rate: float
    slippage_rate: float
    sizing_mode: str
    quantity_per_trade: float
    final_equity: float
    total_pnl: float
    total_return: float
    max_drawdown: float
    total_trades: int
    win_rate: float | None
    profit_factor: float | None
    sharpe_ratio: float | None
    sortino_ratio: float | None
    cagr: float | None
    equity_curve: list[dict[str, Any]] = field(default_factory=list)
    trades: list[dict[str, Any]] = field(default_factory=list)
    user_id: int | None = None


def get_connection(db_path: Path | str | None = None) -> sqlite3.Connection:
    """Create and configure a SQLite connection with foreign keys and row factory."""
    path = Path(db_path) if db_path is not None else DEFAULT_DB_PATH
    if str(path) != ":memory:":
        path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    init_db(conn)
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    """Initialize database tables and indexes if they do not exist."""
    with conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);"
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS experiments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                dataset TEXT NOT NULL,
                strategy TEXT NOT NULL,
                parameters_json TEXT NOT NULL,
                initial_cash REAL NOT NULL,
                commission_rate REAL NOT NULL,
                slippage_rate REAL NOT NULL,
                sizing_mode TEXT NOT NULL,
                quantity_per_trade REAL NOT NULL,
                final_equity REAL NOT NULL,
                total_pnl REAL NOT NULL,
                total_return REAL NOT NULL,
                max_drawdown REAL NOT NULL,
                total_trades INTEGER NOT NULL,
                win_rate REAL,
                profit_factor REAL,
                sharpe_ratio REAL,
                sortino_ratio REAL,
                cagr REAL,
                equity_curve_json TEXT NOT NULL,
                trades_json TEXT NOT NULL,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )
        # Migrate existing tables if user_id column is missing
        cols = [r[1] for r in conn.execute("PRAGMA table_info(experiments);").fetchall()]
        if "user_id" not in cols:
            conn.execute(
                "ALTER TABLE experiments ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;"
            )

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_experiments_created_at ON experiments(created_at DESC);"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_experiments_dataset ON experiments(dataset);"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_experiments_strategy ON experiments(strategy);"
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_experiments_user_id ON experiments(user_id);"
        )


def save_experiment(
    name: str,
    dataset: str,
    strategy: str,
    parameters: dict[str, Any],
    initial_cash: float,
    commission_rate: float,
    slippage_rate: float,
    sizing_mode: str,
    quantity_per_trade: float,
    final_equity: float,
    total_pnl: float,
    total_return: float,
    max_drawdown: float,
    total_trades: int,
    win_rate: float | None,
    profit_factor: float | None,
    sharpe_ratio: float | None,
    sortino_ratio: float | None,
    cagr: float | None,
    equity_curve: list[dict[str, Any]],
    trades: list[dict[str, Any]],
    notes: str = "",
    created_at: str | None = None,
    user_id: int | None = None,
    db_path: Path | str | None = None,
) -> ExperimentRecord:
    """Persist a completed backtest run as an experiment."""
    now_iso = created_at or datetime.now(UTC).isoformat()
    conn = get_connection(db_path)
    try:
        with conn:
            cursor = conn.execute(
                """
                INSERT INTO experiments (
                    name, notes, created_at, dataset, strategy, parameters_json,
                    initial_cash, commission_rate, slippage_rate, sizing_mode, quantity_per_trade,
                    final_equity, total_pnl, total_return, max_drawdown, total_trades,
                    win_rate, profit_factor, sharpe_ratio, sortino_ratio, cagr,
                    equity_curve_json, trades_json, user_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """,
                (
                    name.strip(),
                    notes.strip(),
                    now_iso,
                    dataset,
                    strategy,
                    json.dumps(parameters),
                    initial_cash,
                    commission_rate,
                    slippage_rate,
                    sizing_mode,
                    quantity_per_trade,
                    final_equity,
                    total_pnl,
                    total_return,
                    max_drawdown,
                    total_trades,
                    win_rate,
                    profit_factor,
                    sharpe_ratio,
                    sortino_ratio,
                    cagr,
                    json.dumps(equity_curve),
                    json.dumps(trades),
                    user_id,
                ),
            )
            experiment_id = cursor.lastrowid
            if experiment_id is None:
                raise RuntimeError("Failed to obtain ID for saved experiment.")

        return ExperimentRecord(
            id=experiment_id,
            name=name.strip(),
            notes=notes.strip(),
            created_at=now_iso,
            dataset=dataset,
            strategy=strategy,
            parameters=parameters,
            initial_cash=initial_cash,
            commission_rate=commission_rate,
            slippage_rate=slippage_rate,
            sizing_mode=sizing_mode,
            quantity_per_trade=quantity_per_trade,
            final_equity=final_equity,
            total_pnl=total_pnl,
            total_return=total_return,
            max_drawdown=max_drawdown,
            total_trades=total_trades,
            win_rate=win_rate,
            profit_factor=profit_factor,
            sharpe_ratio=sharpe_ratio,
            sortino_ratio=sortino_ratio,
            cagr=cagr,
            equity_curve=equity_curve,
            trades=trades,
            user_id=user_id,
        )
    finally:
        conn.close()


def list_experiments(
    dataset: str | None = None,
    strategy: str | None = None,
    user_id: int | None = None,
    db_path: Path | str | None = None,
) -> list[ExperimentSummary]:
    """Retrieve lightweight summaries of saved experiments ordered newest first."""
    conn = get_connection(db_path)
    try:
        query = """
            SELECT id, name, notes, created_at, dataset, strategy, parameters_json,
                   initial_cash, final_equity, total_pnl, total_return, max_drawdown,
                   total_trades, win_rate, profit_factor, sharpe_ratio, sortino_ratio, cagr, user_id
            FROM experiments
        """
        conditions: list[str] = []
        params: list[Any] = []

        if dataset:
            conditions.append("dataset = ?")
            params.append(dataset)
        if strategy:
            conditions.append("strategy = ?")
            params.append(strategy)
        if user_id is not None:
            conditions.append("user_id = ?")
            params.append(user_id)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY id DESC;"

        rows = conn.execute(query, params).fetchall()
        summaries: list[ExperimentSummary] = []
        for r in rows:
            summaries.append(
                ExperimentSummary(
                    id=r["id"],
                    name=r["name"],
                    notes=r["notes"],
                    created_at=r["created_at"],
                    dataset=r["dataset"],
                    strategy=r["strategy"],
                    parameters=json.loads(r["parameters_json"]),
                    initial_cash=r["initial_cash"],
                    final_equity=r["final_equity"],
                    total_pnl=r["total_pnl"],
                    total_return=r["total_return"],
                    max_drawdown=r["max_drawdown"],
                    total_trades=r["total_trades"],
                    win_rate=r["win_rate"],
                    profit_factor=r["profit_factor"],
                    sharpe_ratio=r["sharpe_ratio"],
                    sortino_ratio=r["sortino_ratio"],
                    cagr=r["cagr"],
                    user_id=r["user_id"],
                )
            )
        return summaries
    finally:
        conn.close()


def get_experiment(
    experiment_id: int,
    user_id: int | None = None,
    db_path: Path | str | None = None,
) -> ExperimentRecord | None:
    """Retrieve full details of an experiment by ID, with optional user workspace isolation."""
    conn = get_connection(db_path)
    try:
        query = "SELECT * FROM experiments WHERE id = ?"
        params: list[Any] = [experiment_id]
        if user_id is not None:
            query += " AND (user_id = ? OR user_id IS NULL)"
            params.append(user_id)

        row = conn.execute(query, params).fetchone()

        if row is None:
            return None

        return ExperimentRecord(
            id=row["id"],
            name=row["name"],
            notes=row["notes"],
            created_at=row["created_at"],
            dataset=row["dataset"],
            strategy=row["strategy"],
            parameters=json.loads(row["parameters_json"]),
            initial_cash=row["initial_cash"],
            commission_rate=row["commission_rate"],
            slippage_rate=row["slippage_rate"],
            sizing_mode=row["sizing_mode"],
            quantity_per_trade=row["quantity_per_trade"],
            final_equity=row["final_equity"],
            total_pnl=row["total_pnl"],
            total_return=row["total_return"],
            max_drawdown=row["max_drawdown"],
            total_trades=row["total_trades"],
            win_rate=row["win_rate"],
            profit_factor=row["profit_factor"],
            sharpe_ratio=row["sharpe_ratio"],
            sortino_ratio=row["sortino_ratio"],
            cagr=row["cagr"],
            equity_curve=json.loads(row["equity_curve_json"]),
            trades=json.loads(row["trades_json"]),
            user_id=row["user_id"],
        )
    finally:
        conn.close()


def delete_experiment(
    experiment_id: int,
    user_id: int | None = None,
    db_path: Path | str | None = None,
) -> bool:
    """Delete an experiment by ID, with optional user workspace isolation."""
    conn = get_connection(db_path)
    try:
        with conn:
            query = "DELETE FROM experiments WHERE id = ?"
            params: list[Any] = [experiment_id]
            if user_id is not None:
                query += " AND user_id = ?"
                params.append(user_id)
            cursor = conn.execute(query, params)
            return cursor.rowcount > 0
    finally:
        conn.close()


def create_user(
    username: str,
    password_hash: str,
    salt: str,
    created_at: str | None = None,
    db_path: Path | str | None = None,
) -> UserRecord:
    """Create a new user account with hashed credentials."""
    clean_username = username.strip().lower()
    if len(clean_username) < 3:
        raise ValueError("Username must be at least 3 characters long.")

    now_iso = created_at or datetime.now(UTC).isoformat()
    conn = get_connection(db_path)
    try:
        with conn:
            cursor = conn.execute(
                """
                INSERT INTO users (username, password_hash, salt, created_at)
                VALUES (?, ?, ?, ?);
                """,
                (clean_username, password_hash, salt, now_iso),
            )
            user_id = cursor.lastrowid
            if user_id is None:
                raise RuntimeError("Failed to obtain ID for created user.")
            return UserRecord(id=user_id, username=clean_username, created_at=now_iso)
    except sqlite3.IntegrityError as err:
        raise ValueError(f"Username '{clean_username}' already exists.") from err
    finally:
        conn.close()


def get_user_by_username(
    username: str,
    db_path: Path | str | None = None,
) -> tuple[UserRecord, str, str] | None:
    """Retrieve user record, password_hash, and salt by username."""
    conn = get_connection(db_path)
    try:
        row = conn.execute(
            "SELECT id, username, password_hash, salt, created_at FROM users WHERE username = ?;",
            (username.strip().lower(),),
        ).fetchone()
        if row is None:
            return None
        return (
            UserRecord(id=row["id"], username=row["username"], created_at=row["created_at"]),
            row["password_hash"],
            row["salt"],
        )
    finally:
        conn.close()


def get_user_by_id(
    user_id: int,
    db_path: Path | str | None = None,
) -> UserRecord | None:
    """Retrieve user record by user ID."""
    conn = get_connection(db_path)
    try:
        row = conn.execute(
            "SELECT id, username, created_at FROM users WHERE id = ?;",
            (user_id,),
        ).fetchone()
        if row is None:
            return None
        return UserRecord(id=row["id"], username=row["username"], created_at=row["created_at"])
    finally:
        conn.close()

