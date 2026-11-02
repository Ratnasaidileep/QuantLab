from pathlib import Path

from quantlab.storage.repository import (
    create_user,
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


def test_scope_to_user_isolation(tmp_path: Path):
    db_file = tmp_path / "test_quantlab.db"
    user10 = create_user("alice10", "hash10", "salt10", db_path=db_file)

    # User 10 experiment
    user_exp = save_experiment(
        name="User 10 Private Run",
        dataset="reliance_daily.csv",
        strategy="moving_average",
        parameters={"fast_period": 10, "slow_period": 30},
        initial_cash=100000.0,
        commission_rate=0.001,
        slippage_rate=0.001,
        sizing_mode="unit",
        quantity_per_trade=1.0,
        final_equity=105000.0,
        total_pnl=5000.0,
        total_return=0.05,
        max_drawdown=0.01,
        total_trades=4,
        win_rate=0.5,
        profit_factor=1.5,
        sharpe_ratio=1.2,
        sortino_ratio=1.8,
        cagr=0.06,
        equity_curve=[],
        trades=[],
        user_id=user10.id,
        db_path=db_file,
    )

    # Guest experiment (user_id is None)
    guest_exp = save_experiment(
        name="Guest Public Run",
        dataset="reliance_daily.csv",
        strategy="rsi",
        parameters={"period": 14},
        initial_cash=50000.0,
        commission_rate=0.001,
        slippage_rate=0.001,
        sizing_mode="unit",
        quantity_per_trade=1.0,
        final_equity=52000.0,
        total_pnl=2000.0,
        total_return=0.04,
        max_drawdown=0.02,
        total_trades=2,
        win_rate=0.5,
        profit_factor=1.2,
        sharpe_ratio=0.9,
        sortino_ratio=1.1,
        cagr=0.04,
        equity_curve=[],
        trades=[],
        user_id=None,
        db_path=db_file,
    )

    # 1. Guest list: only sees guest experiment
    guest_list = list_experiments(scope_to_user=True, user_id=None, db_path=db_file)
    assert len(guest_list) == 1
    assert guest_list[0].id == guest_exp.id

    # 2. User 10 list: only sees User 10 experiment
    user_list = list_experiments(scope_to_user=True, user_id=user10.id, db_path=db_file)
    assert len(user_list) == 1
    assert user_list[0].id == user_exp.id

    # 3. Guest cannot retrieve User 10 experiment detail
    assert get_experiment(user_exp.id, scope_to_user=True, user_id=None, db_path=db_file) is None
    # User 10 can retrieve their own
    assert get_experiment(user_exp.id, scope_to_user=True, user_id=user10.id, db_path=db_file) is not None

    # 4. Guest cannot delete User 10 experiment
    assert delete_experiment(user_exp.id, scope_to_user=True, user_id=None, db_path=db_file) is False
    # User 10 can delete their own
    assert delete_experiment(user_exp.id, scope_to_user=True, user_id=user10.id, db_path=db_file) is True

    # 5. Guest can delete guest experiment
    assert delete_experiment(guest_exp.id, scope_to_user=True, user_id=None, db_path=db_file) is True


def test_confluence_experiment_persistence_and_reproducibility(tmp_path: Path):
    """Verify Confluence experiment parameters survive persistence and reproduce identical results."""
    from quantlab.backtest.engine import Backtest
    from quantlab.data.csv_loader import load_bars_from_csv
    from quantlab.strategy.confluence import ConfluenceStrategy

    db_file = tmp_path / "test_quantlab.db"
    data_file = Path("data/reliance_daily.csv")
    bars = load_bars_from_csv(data_file)

    conf_params = {
        "confluence_trend_period": 30,
        "confluence_pullback_period": 10,
        "confluence_oversold": 45.0,
        "confluence_overbought": 65.0,
    }

    # 1. Run actual engine backtest
    strategy = ConfluenceStrategy(
        trend_period=conf_params["confluence_trend_period"],
        pullback_period=conf_params["confluence_pullback_period"],
        oversold=conf_params["confluence_oversold"],
        overbought=conf_params["confluence_overbought"],
    )
    bt = Backtest(
        initial_cash=100000.0,
        strategy=strategy,
        commission_rate=0.001,
        slippage_rate=0.001,
        use_crossover=False,
    )
    result = bt.run(bars)

    # 2. Save experiment to SQLite repository
    record = save_experiment(
        name="Confluence Persistence Run",
        notes="Testing full parameter roundtrip",
        dataset="reliance_daily.csv",
        strategy="confluence",
        parameters=conf_params,
        initial_cash=100000.0,
        commission_rate=0.001,
        slippage_rate=0.001,
        sizing_mode="unit",
        quantity_per_trade=1.0,
        final_equity=result.final_equity,
        total_pnl=result.total_pnl,
        total_return=result.metrics.total_return,
        max_drawdown=result.metrics.max_drawdown,
        total_trades=result.metrics.total_trades,
        win_rate=result.metrics.win_rate,
        profit_factor=result.metrics.profit_factor,
        sharpe_ratio=result.metrics.sharpe_ratio,
        sortino_ratio=result.metrics.sortino_ratio,
        cagr=result.metrics.cagr,
        equity_curve=[{"timestamp": b.timestamp.isoformat(), "equity": eq} for b, eq in zip(bars, result.equity_curve)],
        trades=[{"timestamp": t.timestamp.isoformat(), "side": t.side.value.lower(), "price": t.price, "quantity": t.quantity, "commission": t.commission} for t in result.trades],
        db_path=db_file,
    )

    # 3. Retrieve and verify all 4 parameters survived
    fetched = get_experiment(record.id, db_path=db_file)
    assert fetched is not None
    assert fetched.strategy == "confluence"
    assert fetched.parameters["confluence_trend_period"] == 30
    assert fetched.parameters["confluence_pullback_period"] == 10
    assert fetched.parameters["confluence_oversold"] == 45.0
    assert fetched.parameters["confluence_overbought"] == 65.0

    # 4. Reconstruct strategy from fetched parameters and rerun
    restored_strat = ConfluenceStrategy(
        trend_period=fetched.parameters["confluence_trend_period"],
        pullback_period=fetched.parameters["confluence_pullback_period"],
        oversold=fetched.parameters["confluence_oversold"],
        overbought=fetched.parameters["confluence_overbought"],
    )
    rerun_bt = Backtest(
        initial_cash=fetched.initial_cash,
        strategy=restored_strat,
        commission_rate=fetched.commission_rate,
        slippage_rate=fetched.slippage_rate,
        use_crossover=False,
    )
    rerun_result = rerun_bt.run(bars)

    # 5. Ensure exact identical reproducibility
    assert rerun_result.final_equity == result.final_equity
    assert rerun_result.metrics.total_trades == result.metrics.total_trades
    assert rerun_result.metrics.total_return == result.metrics.total_return


def test_confluence_backward_compatibility_with_legacy_parameters(tmp_path: Path):
    """Verify that older experiments saved with legacy or missing keys still load cleanly."""
    db_file = tmp_path / "test_quantlab.db"

    # Legacy experiment with old parameter key names
    legacy_record = save_experiment(
        name="Legacy Confluence",
        dataset="tcs_daily.csv",
        strategy="confluence",
        parameters={
            "trend_period": 50,
            "pullback_period": 14,
            "oversold": 30.0,
            "overbought": 70.0,
        },
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

    fetched = get_experiment(legacy_record.id, db_path=db_file)
    assert fetched is not None
    assert fetched.parameters["trend_period"] == 50
    assert fetched.parameters["pullback_period"] == 14

    # Simulate UI normalization fallback (matching BacktestContext.tsx logic)
    p = fetched.parameters
    normalized_trend = p.get("confluence_trend_period", p.get("trend_period", 50))
    normalized_pullback = p.get("confluence_pullback_period", p.get("pullback_period", 14))
    assert normalized_trend == 50
    assert normalized_pullback == 14




def test_demo_seeder_idempotency_and_user_isolation(tmp_path: Path):
    """Verify demo seeder is idempotent and preserves user-owned experiments."""
    from quantlab.storage.demo_seeder import seed_demo_experiments

    db_file = tmp_path / "test_demo_quantlab.db"

    # 1. Create a user and a user-owned experiment
    user1 = create_user("demo_user_1", "hash", "salt", db_path=db_file)
    user_exp = save_experiment(
        name="Real User Secret Experiment",
        dataset="reliance_daily.csv",
        strategy="rsi",
        parameters={"rsi_period": 14},
        initial_cash=100000.0,
        commission_rate=0.001,
        slippage_rate=0.001,
        sizing_mode="unit",
        quantity_per_trade=1.0,
        final_equity=105000.0,
        total_pnl=5000.0,
        total_return=0.05,
        max_drawdown=0.01,
        total_trades=2,
        win_rate=1.0,
        profit_factor=float("inf"),
        sharpe_ratio=2.0,
        sortino_ratio=3.0,
        cagr=0.10,
        equity_curve=[],
        trades=[],
        user_id=user1.id,
        db_path=db_file,
    )

    # 2. First seed run
    seeded_first = seed_demo_experiments(db_path=db_file, data_dir="data", force=False)
    assert len(seeded_first) == 4

    # Ensure user experiment was NOT deleted or modified
    fetched_user_exp = get_experiment(user_exp.id, db_path=db_file)
    assert fetched_user_exp is not None
    assert fetched_user_exp.name == "Real User Secret Experiment"
    assert fetched_user_exp.user_id == user1.id

    # 3. Second seed run must be idempotent (0 new experiments created)
    seeded_second = seed_demo_experiments(db_path=db_file, data_dir="data", force=False)
    assert len(seeded_second) == 0

    # Ensure total experiments in DB is exactly 5 (1 user + 4 demo)
    all_exps = list_experiments(db_path=db_file)
    assert len(all_exps) == 5
