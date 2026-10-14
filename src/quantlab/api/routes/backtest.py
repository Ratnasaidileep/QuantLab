from pathlib import Path

from fastapi import APIRouter, HTTPException

from quantlab.api.schemas import (
    BacktestRequest,
    BacktestResponse,
    EquityPointDTO,
    MetricsDTO,
    StrategyType,
    TradeDTO,
)
from quantlab.backtest.engine import Backtest
from quantlab.data.csv_loader import load_bars_from_csv
from quantlab.strategy.bollinger import BollingerBandsStrategy
from quantlab.strategy.moving_average import MovingAverageCrossover
from quantlab.strategy.rsi import RSIStrategy

router = APIRouter(prefix="/backtest", tags=["Backtest"])

DATA_DIR = Path("data")


@router.post("", response_model=BacktestResponse)
def run_backtest(request: BacktestRequest) -> BacktestResponse:
    """Execute a backtest for a configured trading strategy."""
    dataset_name = Path(request.dataset).name
    file_path = DATA_DIR / dataset_name

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{dataset_name}' not found.",
        )

    try:
        bars = load_bars_from_csv(file_path)
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to load dataset: {error}",
        ) from error

    if not bars:
        raise HTTPException(
            status_code=400,
            detail="The dataset contains no usable market bars.",
        )

    if request.strategy == StrategyType.MOVING_AVERAGE:
        strategy = MovingAverageCrossover(
            fast_period=request.fast_period,
            slow_period=request.slow_period,
        )
        use_crossover = True
        strategy_name = "Moving Average Crossover"
        configuration = f"Fast {request.fast_period} / Slow {request.slow_period}"
    elif request.strategy == StrategyType.RSI:
        strategy = RSIStrategy(
            period=request.rsi_period,
            oversold=request.oversold,
            overbought=request.overbought,
        )
        use_crossover = False
        strategy_name = "RSI"
        configuration = (
            f"Period {request.rsi_period} / "
            f"Oversold {request.oversold:g} / "
            f"Overbought {request.overbought:g}"
        )
    elif request.strategy == StrategyType.BOLLINGER:
        strategy = BollingerBandsStrategy(
            period=request.bb_period,
            std_dev_multiplier=request.bb_std_dev,
        )
        use_crossover = False
        strategy_name = "Bollinger Bands"
        configuration = (
            f"Period {request.bb_period} / StdDev {request.bb_std_dev:g}"
        )
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported strategy '{request.strategy}'.",
        )

    try:
        backtest = Backtest(
            initial_cash=request.initial_cash,
            strategy=strategy,
            commission_rate=request.commission_rate,
            slippage_rate=request.slippage_rate,
            use_crossover=use_crossover,
            sizing_mode=request.sizing_mode.value,
            quantity_per_trade=request.quantity_per_trade,
        )
        result = backtest.run(bars)
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Backtest execution failed: {error}",
        ) from error

    trades_dto = [
        TradeDTO(
            timestamp=trade.timestamp.isoformat(),
            side=trade.side.value.lower(),
            price=trade.price,
            quantity=trade.quantity,
            commission=trade.commission,
        )
        for trade in result.trades
    ]

    equity_points = [
        EquityPointDTO(
            timestamp=bar.timestamp.isoformat(),
            equity=equity,
        )
        for bar, equity in zip(bars, result.equity_curve)
    ]

    metrics_dto = (
        MetricsDTO(
            total_pnl=result.metrics.total_pnl,
            total_return=result.metrics.total_return,
            max_drawdown=result.metrics.max_drawdown,
            total_trades=result.metrics.total_trades,
            win_rate=result.metrics.win_rate,
            profit_factor=result.metrics.profit_factor,
            sharpe_ratio=result.metrics.sharpe_ratio,
            sortino_ratio=result.metrics.sortino_ratio,
            cagr=result.metrics.cagr,
            calmar_ratio=result.metrics.calmar_ratio,
        )
        if result.metrics is not None
        else MetricsDTO(
            total_pnl=result.total_pnl,
            total_return=0.0,
            max_drawdown=0.0,
            total_trades=0,
        )
    )

    return BacktestResponse(
        strategy_name=strategy_name,
        configuration=configuration,
        dataset=dataset_name,
        bars_processed=result.bars_processed,
        initial_cash=request.initial_cash,
        final_cash=result.final_cash,
        final_equity=result.final_equity,
        total_pnl=result.total_pnl,
        metrics=metrics_dto,
        trades=trades_dto,
        equity_curve=equity_points,
    )
