import json
import sqlite3
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from quantlab.config import settings

DEFAULT_DB_PATH = settings.db_path


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
                trades_json TEXT NOT NULL
            );
            """
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
                    equity_curve_json, trades_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
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
        )
    finally:
        conn.close()


def list_experiments(
    dataset: str | None = None,
    strategy: str | None = None,
    db_path: Path | str | None = None,
) -> list[ExperimentSummary]:
    """Retrieve lightweight summaries of saved experiments ordered newest first."""
    conn = get_connection(db_path)
    try:
        query = """
            SELECT id, name, notes, created_at, dataset, strategy, parameters_json,
                   initial_cash, final_equity, total_pnl, total_return, max_drawdown,
                   total_trades, win_rate, profit_factor, sharpe_ratio, sortino_ratio, cagr
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
                )
            )
        return summaries
    finally:
        conn.close()


def get_experiment(
    experiment_id: int,
    db_path: Path | str | None = None,
) -> ExperimentRecord | None:
    """Retrieve full details of an experiment by ID, including equity curve and trades."""
    conn = get_connection(db_path)
    try:
        row = conn.execute(
            """
            SELECT * FROM experiments WHERE id = ?;
            """,
            (experiment_id,),
        ).fetchone()

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
        )
    finally:
        conn.close()


def delete_experiment(
    experiment_id: int,
    db_path: Path | str | None = None,
) -> bool:
    """Delete an experiment by ID. Returns True if row was deleted, False otherwise."""
    conn = get_connection(db_path)
    try:
        with conn:
            cursor = conn.execute(
                "DELETE FROM experiments WHERE id = ?;",
                (experiment_id,),
            )
            return cursor.rowcount > 0
    finally:
        conn.close()
