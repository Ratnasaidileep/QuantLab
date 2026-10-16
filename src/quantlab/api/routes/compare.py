from pathlib import Path

from fastapi import APIRouter, HTTPException

from quantlab.analytics.strategy_comparison import (
    compare_buy_and_hold,
    compare_strategies,
)
from quantlab.api.schemas import (
    ComparisonRequest,
    ComparisonResponse,
    StrategyComparisonItemDTO,
)
from quantlab.config import settings
from quantlab.data.csv_loader import load_bars_from_csv

router = APIRouter(prefix="/compare", tags=["Strategy Comparison"])

DATA_DIR = settings.data_dir


@router.post("", response_model=ComparisonResponse)
def compare_strategy_configurations(request: ComparisonRequest) -> ComparisonResponse:
    """Compare multiple strategy configurations and benchmark against Buy and Hold."""
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

    try:
        results = compare_strategies(
            bars=bars,
            initial_cash=request.initial_cash,
            commission_rate=request.commission_rate,
            slippage_rate=request.slippage_rate,
            ma_parameter_pairs=request.ma_parameter_pairs,
            rsi_configurations=request.rsi_configurations,
            bb_configurations=request.bb_configurations,
            macd_configurations=request.macd_configurations,
            sizing_mode=request.sizing_mode.value,
            quantity_per_trade=request.quantity_per_trade,
        )

        if request.include_buy_and_hold:
            bnh_result = compare_buy_and_hold(
                bars=bars,
                initial_cash=request.initial_cash,
                commission_rate=request.commission_rate,
                slippage_rate=request.slippage_rate,
                liquidate_on_end=request.liquidate_buy_and_hold_on_end,
                sizing_mode=request.sizing_mode.value,
                quantity_per_trade=request.quantity_per_trade,
            )
            results.append(bnh_result)
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Strategy comparison failed: {error}",
        ) from error

    items_dto = [
        StrategyComparisonItemDTO(
            strategy_name=item.strategy_name,
            configuration=item.configuration,
            trades=item.trades,
            final_equity=item.final_equity,
            total_pnl=item.total_pnl,
            total_return=item.total_return,
            max_drawdown=item.max_drawdown,
            win_rate=item.win_rate,
            profit_factor=item.profit_factor,
            sharpe_ratio=item.sharpe_ratio,
            sortino_ratio=item.sortino_ratio,
            cagr=item.cagr,
            parameters=item.parameters,
        )
        for item in results
    ]

    best_strategy = (
        max(items_dto, key=lambda item: item.final_equity)
        if items_dto
        else None
    )

    return ComparisonResponse(
        dataset=dataset_name,
        results=items_dto,
        best_strategy=best_strategy,
    )
