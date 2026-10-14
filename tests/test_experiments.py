from pathlib import Path

from quantlab.storage.repository import (
    delete_experiment,
    get_connection,
    get_experiment,
    init_db,
    list_experiments,
    save_experiment,
)


def test_init_db_creates_tables_idempotently(tmp_path: Path):
    db_file = tmp_path / "test_quantlab.db"
    conn = get_connection(db_file)
    init_db(conn)
    init_db(conn)  # idempotent second call
    conn.close()

    assert db_file.exists()


def test_save_and_get_experiment(tmp_path: Path):
    db_file = tmp_path / "test_quantlab.db"

    equity_points = [
        {"timestamp": "2025-01-01T00:00:00Z", "equity": 100000.0},
        {"timestamp": "2025-01-02T00:00:00Z", "equity": 101000.0},
    ]
    trades = [
        {
            "timestamp": "2025-01-02T00:00:00Z",
            "side": "buy",
            "price": 100.0,
            "quantity": 10.0,
            "commission": 1.0,
        }
    ]

    record = save_experiment(
        name="Test Experiment 1",
        notes="Testing slippage sensitivity",
        dataset="reliance_daily.csv",
        strategy="moving_average",
        parameters={"fast_period": 10, "slow_period": 30},
        initial_cash=100000.0,
        commission_rate=0.001,
        slippage_rate=0.001,
        sizing_mode="unit",
        quantity_per_trade=1.0,
        final_equity=101000.0,
        total_pnl=1000.0,
        total_return=0.01,
        max_drawdown=0.02,
        total_trades=1,
        win_rate=1.0,
        profit_factor=float("inf"),
        sharpe_ratio=1.5,
        sortino_ratio=2.0,
        cagr=0.12,
        equity_curve=equity_points,
        trades=trades,
        db_path=db_file,
    )

    assert record.id == 1
    assert record.name == "Test Experiment 1"
    assert record.notes == "Testing slippage sensitivity"
    assert record.parameters == {"fast_period": 10, "slow_period": 30}
    assert len(record.equity_curve) == 2
    assert len(record.trades) == 1

    # Fetch back by ID
    fetched = get_experiment(record.id, db_path=db_file)
    assert fetched is not None
    assert fetched.id == 1
    assert fetched.name == "Test Experiment 1"
    assert fetched.final_equity == 101000.0
    assert fetched.equity_curve == equity_points
    assert fetched.trades == trades


def test_list_experiments_and_filtering(tmp_path: Path):
    db_file = tmp_path / "test_quantlab.db"

    save_experiment(
        name="MA Run",
        dataset="reliance_daily.csv",
        strategy="moving_average",
        parameters={"fast_period": 5, "slow_period": 20},
        initial_cash=50000.0,
        commission_rate=0.001,
        slippage_rate=0.001,
        sizing_mode="unit",
        quantity_per_trade=1.0,
        final_equity=49000.0,
        total_pnl=-1000.0,
        total_return=-0.02,
        max_drawdown=0.05,
        total_trades=5,
        win_rate=0.4,
        profit_factor=0.6,
        sharpe_ratio=-0.2,
        sortino_ratio=-0.3,
        cagr=-0.05,
        equity_curve=[],
        trades=[],
        db_path=db_file,
    )

    save_experiment(
        name="Bollinger Run",
        dataset="tcs_daily.csv",
        strategy="bollinger",
        parameters={"bb_period": 20, "bb_std_dev": 2.0},
        initial_cash=100000.0,
        commission_rate=0.001,
        slippage_rate=0.001,
        sizing_mode="all_in",
        quantity_per_trade=1.0,
        final_equity=115000.0,
        total_pnl=15000.0,
        total_return=0.15,
        max_drawdown=0.03,
        total_trades=8,
        win_rate=0.75,
        profit_factor=2.4,
        sharpe_ratio=1.8,
        sortino_ratio=2.6,
        cagr=0.18,
        equity_curve=[],
        trades=[],
        db_path=db_file,
    )

    all_experiments = list_experiments(db_path=db_file)
    assert len(all_experiments) == 2
    # Newest first
    assert all_experiments[0].name == "Bollinger Run"
    assert all_experiments[1].name == "MA Run"

    # Filter by dataset
    tcs_experiments = list_experiments(dataset="tcs_daily.csv", db_path=db_file)
    assert len(tcs_experiments) == 1
    assert tcs_experiments[0].strategy == "bollinger"

    # Filter by strategy
    ma_experiments = list_experiments(strategy="moving_average", db_path=db_file)
    assert len(ma_experiments) == 1
    assert ma_experiments[0].dataset == "reliance_daily.csv"


def test_delete_experiment(tmp_path: Path):
    db_file = tmp_path / "test_quantlab.db"

    record = save_experiment(
        name="To Delete",
        dataset="reliance_daily.csv",
        strategy="rsi",
        parameters={"rsi_period": 14},
        initial_cash=100000.0,
        commission_rate=0.001,
        slippage_rate=0.001,
        sizing_mode="unit",
        quantity_per_trade=1.0,
        final_equity=100000.0,
        total_pnl=0.0,
        total_return=0.0,
        max_drawdown=0.0,
        total_trades=0,
        win_rate=None,
        profit_factor=None,
        sharpe_ratio=None,
        sortino_ratio=None,
        cagr=None,
        equity_curve=[],
        trades=[],
        db_path=db_file,
    )

    assert get_experiment(record.id, db_path=db_file) is not None

    deleted = delete_experiment(record.id, db_path=db_file)
    assert deleted is True

    # Confirm it is gone
    assert get_experiment(record.id, db_path=db_file) is None

    # Deleting again returns False
    deleted_again = delete_experiment(record.id, db_path=db_file)
    assert deleted_again is False
