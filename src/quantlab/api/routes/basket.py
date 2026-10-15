from pathlib import Path

from fastapi import APIRouter, HTTPException

from quantlab.api.schemas import (
    BasketBacktestRequest,
    BasketBacktestResponse,
    BasketEquityPointDTO,
    BasketTradeDTO,
    MetricsDTO,
    TailRiskDTO,
)
from quantlab.data.csv_loader import load_bars_from_csv
from quantlab.portfolio.basket import (
    AllocationWeighting,
    BasketBacktestEngine,
    RebalanceFrequency,
)

router = APIRouter(prefix="/basket", tags=["Basket Portfolio"])

DATA_DIR = Path("data")


def _symbol_from_filename(filename: str) -> str:
    base = Path(filename).name
    clean = base.replace("_daily.csv", "").replace(".csv", "").upper()
    return clean or base


@router.post("", response_model=BasketBacktestResponse)
def run_basket_backtest(request: BasketBacktestRequest) -> BasketBacktestResponse:
    """Execute a multi-asset basket portfolio backtest with rebalancing."""
    if not request.datasets:
        raise HTTPException(
            status_code=400,
            detail="At least one dataset must be selected for the portfolio basket.",
        )

    bars_by_symbol = {}
    symbols = []

    for dataset_name in request.datasets:
        clean_name = Path(dataset_name).name
        file_path = DATA_DIR / clean_name

        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(
                status_code=404,
                detail=f"Dataset '{clean_name}' not found.",
            )

        try:
            bars = load_bars_from_csv(file_path)
        except Exception as error:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to load dataset '{clean_name}': {error}",
            ) from error

        if not bars:
            raise HTTPException(
                status_code=400,
                detail=f"Dataset '{clean_name}' contains no usable market bars.",
            )

        sym = _symbol_from_filename(clean_name)
        bars_by_symbol[sym] = bars
        symbols.append(sym)

    # Convert custom weights if provided
    custom_weights = None
    if request.weighting.value == AllocationWeighting.CUSTOM.value:
        if not request.custom_weights:
            raise HTTPException(
                status_code=400,
                detail="Custom weights must be provided when weighting is 'custom'.",
            )
        custom_weights = request.custom_weights

    try:
        engine = BasketBacktestEngine(
            initial_cash=request.initial_cash,
            weighting=AllocationWeighting(request.weighting.value),
            custom_weights=custom_weights,
            rebalance_freq=RebalanceFrequency(request.rebalance_freq.value),
            commission_rate=request.commission_rate,
            slippage_rate=request.slippage_rate,
            risk_free_rate=request.risk_free_rate,
        )
        result = engine.run(bars_by_symbol)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Basket simulation error: {exc}",
        ) from exc

    trades_dto = [
        BasketTradeDTO(
            timestamp=t.timestamp.isoformat(),
            symbol=t.symbol,
            side=t.side.value if hasattr(t.side, "value") else str(t.side),
            price=round(t.price, 4),
            quantity=round(t.quantity, 4),
            commission=round(t.commission, 4),
            reason=t.reason,
        )
        for t in result.trades
    ]

    equity_points_dto = [
        BasketEquityPointDTO(
            timestamp=pt.timestamp.isoformat(),
            equity=round(pt.equity, 2),
            cash=round(pt.cash, 2),
            holdings_value=round(pt.holdings_value, 2),
            weights={s: round(w, 4) for s, w in pt.weights.items()},
        )
        for pt in result.equity_points
    ]

    summary_dto = MetricsDTO(
        total_pnl=round(result.metrics.total_pnl, 2),
        total_return=round(result.metrics.total_return, 4),
        max_drawdown=round(result.metrics.max_drawdown, 4),
        total_trades=result.metrics.total_trades,
        win_rate=round(result.metrics.win_rate, 4)
        if result.metrics.win_rate is not None
        else None,
        profit_factor=round(result.metrics.profit_factor, 4)
        if result.metrics.profit_factor is not None
        else None,
        sharpe_ratio=round(result.metrics.sharpe_ratio, 4)
        if result.metrics.sharpe_ratio is not None
        else None,
        sortino_ratio=round(result.metrics.sortino_ratio, 4)
        if result.metrics.sortino_ratio is not None
        else None,
        cagr=round(result.metrics.cagr, 4)
        if result.metrics.cagr is not None
        else None,
        calmar_ratio=round(result.metrics.calmar_ratio, 4)
        if result.metrics.calmar_ratio is not None
        else None,
    )

    tail_risk_dto = TailRiskDTO(
        var_95_historical=round(result.tail_risk.var_95_historical, 4)
        if result.tail_risk.var_95_historical is not None
        else None,
        var_95_parametric=round(result.tail_risk.var_95_parametric, 4)
        if result.tail_risk.var_95_parametric is not None
        else None,
        var_99_historical=round(result.tail_risk.var_99_historical, 4)
        if result.tail_risk.var_99_historical is not None
        else None,
        var_99_parametric=round(result.tail_risk.var_99_parametric, 4)
        if result.tail_risk.var_99_parametric is not None
        else None,
        cvar_95=round(result.tail_risk.cvar_95, 4)
        if result.tail_risk.cvar_95 is not None
        else None,
        cvar_99=round(result.tail_risk.cvar_99, 4)
        if result.tail_risk.cvar_99 is not None
        else None,
        tail_ratio=round(result.tail_risk.tail_ratio, 4)
        if result.tail_risk.tail_ratio is not None
        else None,
        skewness=round(result.tail_risk.skewness, 4)
        if result.tail_risk.skewness is not None
        else None,
        kurtosis=round(result.tail_risk.kurtosis, 4)
        if result.tail_risk.kurtosis is not None
        else None,
        annualized_volatility=round(result.tail_risk.annualized_volatility, 4)
        if result.tail_risk.annualized_volatility is not None
        else None,
        calmar_ratio=round(result.tail_risk.calmar_ratio, 4)
        if result.tail_risk.calmar_ratio is not None
        else None,
    )

    return BasketBacktestResponse(
        datasets=request.datasets,
        symbols=symbols,
        weighting=request.weighting.value,
        rebalance_freq=request.rebalance_freq.value,
        initial_cash=round(result.initial_cash, 2),
        final_cash=round(result.final_cash, 2),
        final_equity=round(result.final_equity, 2),
        total_pnl=round(result.total_pnl, 2),
        asset_weights={s: round(w, 4) for s, w in result.asset_weights.items()},
        holdings={s: round(qty, 4) for s, qty in result.holdings.items()},
        summary=summary_dto,
        tail_risk=tail_risk_dto,
        trades=trades_dto,
        equity_points=equity_points_dto,
    )
