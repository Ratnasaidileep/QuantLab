import pytest
from fastapi.testclient import TestClient

from quantlab.api.main import app


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_root_endpoint(client: TestClient):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["app"] == "QuantLab API"
    assert data["documentation"] == "/docs"
    assert data["health"] == "/api/v1/health"


def test_health_endpoint(client: TestClient):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "QuantLab"
    assert data["version"] == "0.1.0"


def test_datasets_endpoint(client: TestClient):
    response = client.get("/api/v1/datasets")
    assert response.status_code == 200
    data = response.json()
    assert "datasets" in data
    assert isinstance(data["datasets"], list)
    assert len(data["datasets"]) >= 1

    dataset_names = [d["filename"] for d in data["datasets"]]
    assert "reliance_daily.csv" in dataset_names

    reliance = next(d for d in data["datasets"] if d["filename"] == "reliance_daily.csv")
    assert reliance["symbol"] == "RELIANCE"
    assert reliance["bars_count"] == 441
    assert reliance["start_date"] == "2025-01-01"


def test_backtest_ma_strategy_success(client: TestClient):
    payload = {
        "dataset": "reliance_daily.csv",
        "strategy": "moving_average",
        "fast_period": 10,
        "slow_period": 30,
        "initial_cash": 100000.0,
        "commission_rate": 0.001,
        "slippage_rate": 0.001,
        "sizing_mode": "unit",
    }
    response = client.post("/api/v1/backtest", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["strategy_name"] == "Moving Average Crossover"
    assert "Fast 10 / Slow 30" in data["configuration"]
    assert data["bars_processed"] == 441
    assert data["initial_cash"] == 100000.0
    assert len(data["equity_curve"]) == 441
    assert len(data["trades"]) == 18

    metrics = data["metrics"]
    assert metrics["total_trades"] == 18
    assert metrics["win_rate"] == pytest.approx(0.111, rel=1e-2)
    assert metrics["profit_factor"] == pytest.approx(0.379, rel=1e-2)
    assert metrics["sharpe_ratio"] is not None
    assert metrics["cagr"] is not None


def test_backtest_rsi_strategy_success(client: TestClient):
    payload = {
        "dataset": "reliance_daily.csv",
        "strategy": "rsi",
        "rsi_period": 14,
        "oversold": 30.0,
        "overbought": 70.0,
        "initial_cash": 100000.0,
        "commission_rate": 0.001,
        "slippage_rate": 0.001,
        "sizing_mode": "unit",
    }
    response = client.post("/api/v1/backtest", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["strategy_name"] == "RSI"
    assert data["bars_processed"] == 441
    assert len(data["trades"]) == 5

    metrics = data["metrics"]
    assert metrics["win_rate"] == 1.0
    assert metrics["total_pnl"] > 0.0


def test_backtest_bollinger_strategy_success(client: TestClient):
    payload = {
        "dataset": "reliance_daily.csv",
        "strategy": "bollinger",
        "bb_period": 20,
        "bb_std_dev": 2.0,
        "initial_cash": 100000.0,
        "commission_rate": 0.001,
        "slippage_rate": 0.001,
        "sizing_mode": "unit",
    }
    response = client.post("/api/v1/backtest", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["strategy_name"] == "Bollinger Bands"
    assert data["bars_processed"] == 441
    assert "Period 20 / StdDev 2" in data["configuration"]
    assert len(data["trades"]) >= 1
    assert data["metrics"] is not None


def test_backtest_macd_strategy_success(client: TestClient):
    payload = {
        "dataset": "reliance_daily.csv",
        "strategy": "macd",
        "macd_fast": 12,
        "macd_slow": 26,
        "macd_signal": 9,
        "initial_cash": 100000.0,
        "commission_rate": 0.001,
        "slippage_rate": 0.001,
        "sizing_mode": "unit",
    }
    response = client.post("/api/v1/backtest", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["strategy_name"] == "MACD"
    assert "Fast 12 / Slow 26 / Signal 9" in data["configuration"]
    assert data["bars_processed"] == 441
    assert len(data["equity_curve"]) == 441
    assert len(data["trades"]) >= 1
    assert data["metrics"] is not None


def test_backtest_confluence_strategy_success(client: TestClient):
    payload = {
        "dataset": "reliance_daily.csv",
        "strategy": "confluence",
        "confluence_trend_period": 50,
        "confluence_pullback_period": 14,
        "confluence_oversold": 35.0,
        "confluence_overbought": 65.0,
        "initial_cash": 100000.0,
        "commission_rate": 0.001,
        "slippage_rate": 0.001,
        "sizing_mode": "unit",
    }
    response = client.post("/api/v1/backtest", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["strategy_name"] == "Confluence"
    assert "Trend EMA 50" in data["configuration"]
    assert data["bars_processed"] == 441
    assert len(data["equity_curve"]) == 441
    assert data["metrics"] is not None


def test_backtest_macd_invalid_parameters(client: TestClient):
    payload = {
        "dataset": "reliance_daily.csv",
        "strategy": "macd",
        "macd_fast": 30,
        "macd_slow": 20,  # invalid: fast >= slow
        "macd_signal": 9,
    }
    response = client.post("/api/v1/backtest", json=payload)
    assert response.status_code == 422


def test_backtest_all_in_sizing(client: TestClient):
    payload = {
        "dataset": "reliance_daily.csv",
        "strategy": "moving_average",
        "fast_period": 10,
        "slow_period": 30,
        "initial_cash": 100000.0,
        "commission_rate": 0.001,
        "slippage_rate": 0.001,
        "sizing_mode": "all_in",
    }
    response = client.post("/api/v1/backtest", json=payload)
    assert response.status_code == 200
    data = response.json()

    # Under all-in sizing, trades will have quantity > 1.0
    first_trade = data["trades"][0]
    assert first_trade["quantity"] > 1.0


def test_backtest_with_stop_loss_and_take_profit(client: TestClient):
    payload = {
        "dataset": "reliance_daily.csv",
        "strategy": "moving_average",
        "fast_period": 10,
        "slow_period": 30,
        "initial_cash": 100000.0,
        "stop_loss_pct": 0.03,
        "take_profit_pct": 0.08,
    }
    response = client.post("/api/v1/backtest", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["strategy_name"] == "Moving Average Crossover"
    assert len(data["trades"]) > 0
    # Verify exit_reason field exists on trade objects
    for trade in data["trades"]:
        assert "exit_reason" in trade
        if trade["side"] == "sell":
            assert trade["exit_reason"] in ("signal", "stop_loss", "take_profit")


def test_backtest_invalid_ma_parameters(client: TestClient):
    payload = {
        "dataset": "reliance_daily.csv",
        "strategy": "moving_average",
        "fast_period": 30,
        "slow_period": 10,  # Fast >= Slow
    }
    response = client.post("/api/v1/backtest", json=payload)
    assert response.status_code == 422


def test_backtest_invalid_rsi_parameters(client: TestClient):
    payload = {
        "dataset": "reliance_daily.csv",
        "strategy": "rsi",
        "oversold": 80.0,
        "overbought": 20.0,  # Oversold >= Overbought
    }
    response = client.post("/api/v1/backtest", json=payload)
    assert response.status_code == 422


def test_backtest_invalid_bollinger_parameters(client: TestClient):
    payload = {
        "dataset": "reliance_daily.csv",
        "strategy": "bollinger",
        "bb_period": 1,  # period < 2
        "bb_std_dev": -1.0,
    }
    response = client.post("/api/v1/backtest", json=payload)
    assert response.status_code == 422


def test_backtest_nonexistent_dataset(client: TestClient):
    payload = {
        "dataset": "nonexistent_file.csv",
        "strategy": "moving_average",
    }
    response = client.post("/api/v1/backtest", json=payload)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_compare_endpoint_success(client: TestClient):
    payload = {
        "dataset": "reliance_daily.csv",
        "initial_cash": 100000.0,
        "commission_rate": 0.001,
        "slippage_rate": 0.001,
        "ma_parameter_pairs": [[2, 3], [10, 30]],
        "rsi_configurations": [[14, 30.0, 70.0]],
        "bb_configurations": [[20, 2.0]],
        "include_buy_and_hold": True,
    }
    response = client.post("/api/v1/compare", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["dataset"] == "reliance_daily.csv"
    assert len(data["results"]) == 6  # 2 MA + 1 RSI + 1 BB + 1 MACD + 1 BnH
    assert data["best_strategy"] is not None

    strategy_names = [item["strategy_name"] for item in data["results"]]
    assert "Moving Average Crossover" in strategy_names
    assert "RSI" in strategy_names
    assert "Bollinger Bands" in strategy_names
    assert "MACD" in strategy_names
    assert "Buy and Hold" in strategy_names


def test_compare_endpoint_invalid_parameters(client: TestClient):
    payload = {
        "dataset": "reliance_daily.csv",
        "ma_parameter_pairs": [[30, 10]],  # Invalid: fast >= slow
    }
    response = client.post("/api/v1/compare", json=payload)
    assert response.status_code == 422


def test_compare_endpoint_nonexistent_dataset(client: TestClient):
    payload = {
        "dataset": "missing_data.csv",
    }
    response = client.post("/api/v1/compare", json=payload)
    assert response.status_code == 404


def test_walk_forward_endpoint_success(client: TestClient):
    payload = {
        "dataset": "reliance_daily.csv",
        "strategy": "moving_average",
        "num_windows": 3,
        "window_mode": "rolling",
        "initial_cash": 100000.0,
    }
    response = client.post("/api/v1/analytics/walk-forward", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["strategy_name"] == "moving_average"
    assert data["total_bars"] == 441
    assert len(data["windows"]) >= 2
    assert data["robustness_grade"] is not None
    assert data["explanation"] is not None
    assert len(data["stitched_equity_curve"]) > 1


def test_walk_forward_bollinger_endpoint_success(client: TestClient):
    payload = {
        "dataset": "reliance_daily.csv",
        "strategy": "bollinger",
        "num_windows": 3,
        "window_mode": "rolling",
        "initial_cash": 100000.0,
    }
    response = client.post("/api/v1/analytics/walk-forward", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["strategy_name"] == "bollinger"
    assert data["total_bars"] == 441
    assert len(data["windows"]) >= 2
    assert "period" in data["windows"][0]["best_parameters"]


def test_walk_forward_endpoint_nonexistent_dataset(client: TestClient):
    payload = {
        "dataset": "missing.csv",
    }
    response = client.post("/api/v1/analytics/walk-forward", json=payload)
    assert response.status_code == 404


def test_parameter_heatmap_endpoint_success(client: TestClient):
    payload = {
        "dataset": "reliance_daily.csv",
        "fast_periods": [2, 5],
        "slow_periods": [15, 30],
        "initial_cash": 100000.0,
    }
    response = client.post("/api/v1/analytics/parameter-heatmap", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["total_combinations"] == 4
    assert len(data["grid"]) == 4
    assert data["stability_verdict"] is not None
    assert 0.0 <= data["plateau_ratio"] <= 1.0


def test_parameter_heatmap_endpoint_nonexistent_dataset(client: TestClient):
    payload = {
        "dataset": "missing.csv",
    }
    response = client.post("/api/v1/analytics/parameter-heatmap", json=payload)
    assert response.status_code == 404


def test_upload_dataset_success(client: TestClient):
    from pathlib import Path

    csv_content = (
        "timestamp,open,high,low,close,volume\n"
        "2026-01-01,100,105,98,102,1000\n"
        "2026-01-02,102,106,101,105,1200\n"
        "2026-01-03,105,108,103,107,1500\n"
        "2026-01-04,107,109,104,106,1100\n"
        "2026-01-05,106,110,105,109,1300\n"
    )
    files = {"file": ("test_upload_sample.csv", csv_content.encode("utf-8"), "text/csv")}
    response = client.post("/api/v1/datasets/upload", files=files)
    assert response.status_code == 200
    data = response.json()
    assert "Successfully uploaded" in data["message"]
    assert data["dataset"]["bars_count"] == 5
    assert data["dataset"]["symbol"] == "TEST_UPLOAD_SAMPLE"

    # Clean up generated file
    test_file = Path("data/test_upload_sample.csv")
    if test_file.exists():
        test_file.unlink()


def test_upload_dataset_invalid_extension(client: TestClient):
    files = {"file": ("sample.txt", b"some text", "text/plain")}
    response = client.post("/api/v1/datasets/upload", files=files)
    assert response.status_code == 400
    assert "must be a .csv file" in response.json()["detail"].lower()


def test_upload_dataset_empty_file(client: TestClient):
    files = {"file": ("empty.csv", b"", "text/csv")}
    response = client.post("/api/v1/datasets/upload", files=files)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_upload_dataset_missing_columns(client: TestClient):
    csv_content = "timestamp,open,high,low,close\n2026-01-01,100,105,98,102\n"
    files = {"file": ("bad_sample.csv", csv_content.encode("utf-8"), "text/csv")}
    response = client.post("/api/v1/datasets/upload", files=files)
    assert response.status_code == 400
    assert "missing required columns" in response.json()["detail"].lower()


def test_fetch_dataset_mocked(client: TestClient, monkeypatch):
    from datetime import UTC, datetime
    from pathlib import Path

    from quantlab.data.models import Bar

    fake_bars = [
        Bar(timestamp=datetime(2026, 1, 1, tzinfo=UTC), open=100.0, high=105.0, low=98.0, close=102.0, volume=1000.0),
        Bar(timestamp=datetime(2026, 1, 2, tzinfo=UTC), open=102.0, high=106.0, low=101.0, close=105.0, volume=1100.0),
        Bar(timestamp=datetime(2026, 1, 3, tzinfo=UTC), open=105.0, high=108.0, low=103.0, close=107.0, volume=1200.0),
        Bar(timestamp=datetime(2026, 1, 4, tzinfo=UTC), open=107.0, high=109.0, low=104.0, close=106.0, volume=1300.0),
        Bar(timestamp=datetime(2026, 1, 5, tzinfo=UTC), open=106.0, high=110.0, low=105.0, close=109.0, volume=1400.0),
    ]

    def mock_fetch(symbol: str, period: str = "2y"):
        return fake_bars

    monkeypatch.setattr("quantlab.api.routes.datasets.fetch_ohlcv_from_yfinance", mock_fetch)

    payload = {"symbol": "TEST_TICKER", "period": "1y"}
    response = client.post("/api/v1/datasets/fetch", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "Successfully downloaded" in data["message"]
    assert data["dataset"]["bars_count"] == 5
    assert data["dataset"]["symbol"] == "TEST_TICKER"

    # Clean up generated file
    test_file = Path("data/test_ticker_daily.csv")
    if test_file.exists():
        test_file.unlink()


def test_fetch_dataset_error(client: TestClient, monkeypatch):
    def mock_fetch_error(symbol: str, period: str = "2y"):
        raise ValueError("Ticker not found")

    monkeypatch.setattr("quantlab.api.routes.datasets.fetch_ohlcv_from_yfinance", mock_fetch_error)

    payload = {"symbol": "UNKNOWN", "period": "1y"}
    response = client.post("/api/v1/datasets/fetch", json=payload)
    assert response.status_code == 400
    assert "could not download" in response.json()["detail"].lower()


def test_fetch_batch_datasets_mocked(client: TestClient, monkeypatch):
    from datetime import UTC, datetime
    from pathlib import Path

    from quantlab.data.models import Bar

    fake_bars = [
        Bar(timestamp=datetime(2026, 1, 1, tzinfo=UTC), open=100.0, high=105.0, low=98.0, close=102.0, volume=1000.0),
        Bar(timestamp=datetime(2026, 1, 2, tzinfo=UTC), open=102.0, high=106.0, low=101.0, close=105.0, volume=1100.0),
        Bar(timestamp=datetime(2026, 1, 3, tzinfo=UTC), open=105.0, high=108.0, low=103.0, close=107.0, volume=1200.0),
        Bar(timestamp=datetime(2026, 1, 4, tzinfo=UTC), open=107.0, high=109.0, low=104.0, close=106.0, volume=1300.0),
        Bar(timestamp=datetime(2026, 1, 5, tzinfo=UTC), open=106.0, high=110.0, low=105.0, close=109.0, volume=1400.0),
    ]

    def mock_fetch(symbol: str, period: str = "2y"):
        return fake_bars

    monkeypatch.setattr("quantlab.api.routes.datasets.fetch_ohlcv_from_yfinance", mock_fetch)

    payload = {"symbols": ["TCS.NS", "INFY.NS"], "period": "1y"}
    response = client.post("/api/v1/datasets/fetch-batch", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert len(data["datasets"]) == 2
    assert len(data["failed_symbols"]) == 0
    assert "successfully downloaded 2" in data["message"].lower()

    # Clean up created files
    for ds in data["datasets"]:
        p = Path("data") / ds["filename"]
        if p.exists():
            p.unlink(missing_ok=True)


def test_fetch_batch_datasets_partial_failure(client: TestClient, monkeypatch):
    from datetime import UTC, datetime
    from pathlib import Path

    from quantlab.data.models import Bar

    fake_bars = [
        Bar(timestamp=datetime(2026, 1, 1, tzinfo=UTC), open=100.0, high=105.0, low=98.0, close=102.0, volume=1000.0),
        Bar(timestamp=datetime(2026, 1, 2, tzinfo=UTC), open=102.0, high=106.0, low=101.0, close=105.0, volume=1100.0),
        Bar(timestamp=datetime(2026, 1, 3, tzinfo=UTC), open=105.0, high=108.0, low=103.0, close=107.0, volume=1200.0),
        Bar(timestamp=datetime(2026, 1, 4, tzinfo=UTC), open=107.0, high=109.0, low=104.0, close=106.0, volume=1300.0),
        Bar(timestamp=datetime(2026, 1, 5, tzinfo=UTC), open=106.0, high=110.0, low=105.0, close=109.0, volume=1400.0),
    ]

    def mock_fetch(symbol: str, period: str = "2y"):
        if symbol == "FAIL":
            raise ValueError("Invalid symbol")
        return fake_bars

    monkeypatch.setattr("quantlab.api.routes.datasets.fetch_ohlcv_from_yfinance", mock_fetch)

    payload = {"symbols": ["GOOD_TICKER", "FAIL"], "period": "1y"}
    response = client.post("/api/v1/datasets/fetch-batch", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert len(data["datasets"]) == 1
    assert len(data["failed_symbols"]) == 1
    assert data["failed_symbols"][0]["symbol"] == "FAIL"

    for ds in data["datasets"]:
        p = Path("data") / ds["filename"]
        if p.exists():
            p.unlink(missing_ok=True)


def test_experiment_endpoints_lifecycle(client: TestClient):
    payload = {
        "name": "Reliance Test Run",
        "notes": "Testing persistence endpoints",
        "dataset": "reliance_daily.csv",
        "strategy": "moving_average",
        "parameters": {"fast_period": 10, "slow_period": 30},
        "initial_cash": 100000.0,
        "commission_rate": 0.001,
        "slippage_rate": 0.001,
        "sizing_mode": "unit",
        "quantity_per_trade": 1.0,
        "final_equity": 102500.0,
        "total_pnl": 2500.0,
        "total_return": 0.025,
        "max_drawdown": 0.015,
        "total_trades": 12,
        "win_rate": 0.58,
        "profit_factor": 1.8,
        "sharpe_ratio": 1.45,
        "sortino_ratio": 2.1,
        "cagr": 0.08,
        "equity_curve": [
            {"timestamp": "2025-01-01T00:00:00Z", "equity": 100000.0},
            {"timestamp": "2025-01-02T00:00:00Z", "equity": 102500.0},
        ],
        "trades": [
            {
                "timestamp": "2025-01-02T00:00:00Z",
                "side": "buy",
                "price": 1000.0,
                "quantity": 1.0,
                "commission": 1.0,
            }
        ],
    }

    # 1. Create experiment
    create_resp = client.post("/api/v1/experiments", json=payload)
    assert create_resp.status_code == 201
    created_data = create_resp.json()
    assert created_data["id"] is not None
    assert created_data["name"] == "Reliance Test Run"
    exp_id = created_data["id"]

    # 2. Get experiment detail
    detail_resp = client.get(f"/api/v1/experiments/{exp_id}")
    assert detail_resp.status_code == 200
    detail_data = detail_resp.json()
    assert detail_data["name"] == "Reliance Test Run"
    assert len(detail_data["equity_curve"]) == 2
    assert len(detail_data["trades"]) == 1

    # 3. List experiments
    list_resp = client.get("/api/v1/experiments?strategy=moving_average")
    assert list_resp.status_code == 200
    list_data = list_resp.json()
    assert list_data["total"] >= 1
    found = any(exp["id"] == exp_id for exp in list_data["experiments"])
    assert found is True

    # 4. Delete experiment
    del_resp = client.delete(f"/api/v1/experiments/{exp_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["id"] == exp_id

    # 5. Verify 404 after deletion
    missing_resp = client.get(f"/api/v1/experiments/{exp_id}")
    assert missing_resp.status_code == 404


def test_tear_sheet_endpoint_success(client: TestClient):
    payload = {
        "dataset": "reliance_daily.csv",
        "strategy": "moving_average",
        "fast_period": 10,
        "slow_period": 30,
        "initial_cash": 100000.0,
        "risk_free_rate": 0.05,
    }
    response = client.post("/api/v1/analytics/tear-sheet", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["strategy_name"] == "Moving Average Crossover"
    assert data["bars_processed"] == 441
    assert data["summary"]["total_pnl"] is not None
    assert "calmar_ratio" in data["summary"]

    tail = data["tail_risk"]
    assert tail["var_95_historical"] is not None
    assert tail["var_95_parametric"] is not None
    assert tail["var_99_historical"] is not None
    assert tail["cvar_95"] is not None
    assert tail["annualized_volatility"] is not None
    assert tail["skewness"] is not None
    assert tail["kurtosis"] is not None

    assert len(data["monthly_matrix"]) >= 1
    assert len(data["underwater_curve"]) == 441


def test_tear_sheet_endpoint_nonexistent_dataset(client: TestClient):
    payload = {
        "dataset": "missing_data.csv",
        "strategy": "moving_average",
    }
    response = client.post("/api/v1/analytics/tear-sheet", json=payload)
    assert response.status_code == 404


def test_basket_endpoint_equal_weight_success(client: TestClient):
    payload = {
        "datasets": ["reliance_daily.csv", "tcs_daily.csv"],
        "weighting": "equal_weight",
        "rebalance_freq": "monthly",
        "initial_cash": 100000.0,
        "commission_rate": 0.001,
        "slippage_rate": 0.0005,
    }
    response = client.post("/api/v1/basket", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "RELIANCE" in data["symbols"]
    assert "TCS" in data["symbols"]
    assert data["weighting"] == "equal_weight"
    assert data["rebalance_freq"] == "monthly"
    assert data["initial_cash"] == 100000.0
    assert data["final_equity"] > 0
    assert "total_pnl" in data
    assert data["asset_weights"]["RELIANCE"] == 0.5
    assert data["asset_weights"]["TCS"] == 0.5

    assert data["summary"]["total_pnl"] is not None
    assert data["summary"]["cagr"] is not None
    assert data["tail_risk"]["var_95_historical"] is not None
    assert len(data["trades"]) >= 2
    assert len(data["equity_points"]) > 0


def test_basket_endpoint_inverse_volatility(client: TestClient):
    payload = {
        "datasets": ["reliance_daily.csv", "tcs_daily.csv"],
        "weighting": "inverse_volatility",
        "rebalance_freq": "none",
        "initial_cash": 100000.0,
    }
    response = client.post("/api/v1/basket", json=payload)
    assert response.status_code == 200
    data = response.json()

    weights = data["asset_weights"]
    assert abs(sum(weights.values()) - 1.0) < 1e-3


def test_basket_endpoint_custom_weights(client: TestClient):
    payload = {
        "datasets": ["reliance_daily.csv", "tcs_daily.csv"],
        "weighting": "custom",
        "custom_weights": {"RELIANCE": 0.7, "TCS": 0.3},
        "rebalance_freq": "monthly",
        "initial_cash": 100000.0,
    }
    response = client.post("/api/v1/basket", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert abs(data["asset_weights"]["RELIANCE"] - 0.7) < 1e-3
    assert abs(data["asset_weights"]["TCS"] - 0.3) < 1e-3


def test_basket_endpoint_missing_custom_weights(client: TestClient):
    payload = {
        "datasets": ["reliance_daily.csv", "tcs_daily.csv"],
        "weighting": "custom",
    }
    response = client.post("/api/v1/basket", json=payload)
    assert response.status_code == 400


def test_basket_endpoint_missing_dataset(client: TestClient):
    payload = {
        "datasets": ["nonexistent.csv"],
        "weighting": "equal_weight",
    }
    response = client.post("/api/v1/basket", json=payload)
    assert response.status_code == 404


def test_basket_endpoint_max_sharpe(client: TestClient):
    payload = {
        "datasets": ["reliance_daily.csv", "tcs_daily.csv"],
        "weighting": "max_sharpe",
        "initial_cash": 100000.0,
    }
    response = client.post("/api/v1/basket", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert abs(sum(data["asset_weights"].values()) - 1.0) < 1e-3


def test_basket_endpoint_min_variance(client: TestClient):
    payload = {
        "datasets": ["reliance_daily.csv", "tcs_daily.csv"],
        "weighting": "min_variance",
        "initial_cash": 100000.0,
    }
    response = client.post("/api/v1/basket", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert abs(sum(data["asset_weights"].values()) - 1.0) < 1e-3


def test_efficient_frontier_endpoint_success(client: TestClient):
    payload = {
        "datasets": ["reliance_daily.csv", "tcs_daily.csv"],
        "num_points": 10,
        "num_simulations": 50,
    }
    response = client.post("/api/v1/basket/efficient-frontier", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "frontier_curve" in data
    assert len(data["frontier_curve"]) >= 5
    assert len(data["simulated_portfolios"]) == 50
    assert "max_sharpe" in data
    assert "min_variance" in data
    assert data["max_sharpe"]["sharpe_ratio"] >= data["min_variance"]["sharpe_ratio"]
