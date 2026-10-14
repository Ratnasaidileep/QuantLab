from pathlib import Path

from fastapi import APIRouter, HTTPException

from quantlab.analytics.walk_forward import (
    evaluate_parameter_grid_heatmap,
    run_walk_forward_optimization,
)
from quantlab.api.schemas import (
    MetricsDTO,
    ParameterGridPointDTO,
    ParameterHeatmapRequest,
    ParameterHeatmapResponse,
    WalkForwardRequest,
    WalkForwardResponse,
    WalkForwardWindowDTO,
)
from quantlab.data.csv_loader import load_bars_from_csv

router = APIRouter(prefix="/analytics", tags=["Advanced Analytics"])

DATA_DIR = Path("data")


@router.post("/walk-forward", response_model=WalkForwardResponse)
def walk_forward_analysis(request: WalkForwardRequest) -> WalkForwardResponse:
    """Execute Walk-Forward Optimization to evaluate out-of-sample robustness."""
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

    try:
        result = run_walk_forward_optimization(
            bars=bars,
            strategy_name=request.strategy.value,
            num_windows=request.num_windows,
            window_mode=request.window_mode,
            initial_cash=request.initial_cash,
            commission_rate=request.commission_rate,
            slippage_rate=request.slippage_rate,
            sizing_mode=request.sizing_mode.value,
            quantity_per_trade=request.quantity_per_trade,
            optimization_metric=request.optimization_metric,
        )
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Walk-Forward analysis failed: {error}",
        ) from error

    windows_dto = [
        WalkForwardWindowDTO(
            window_index=w.window_index,
            in_sample_start=w.in_sample_start.isoformat(),
            in_sample_end=w.in_sample_end.isoformat(),
            out_of_sample_start=w.out_of_sample_start.isoformat(),
            out_of_sample_end=w.out_of_sample_end.isoformat(),
            in_sample_bars_count=w.in_sample_bars_count,
            out_of_sample_bars_count=w.out_of_sample_bars_count,
            best_parameters=w.best_parameters,
            in_sample_return=w.in_sample_metrics.total_return,
            out_of_sample_return=w.out_of_sample_metrics.total_return,
            efficiency_ratio=w.efficiency_ratio,
        )
        for w in result.windows
    ]

    stitched_metrics_dto = (
        MetricsDTO(
            total_pnl=result.stitched_oos_metrics.total_pnl,
            total_return=result.stitched_oos_metrics.total_return,
            max_drawdown=result.stitched_oos_metrics.max_drawdown,
            total_trades=result.stitched_oos_metrics.total_trades,
            win_rate=result.stitched_oos_metrics.win_rate,
            profit_factor=result.stitched_oos_metrics.profit_factor,
            sharpe_ratio=result.stitched_oos_metrics.sharpe_ratio,
            sortino_ratio=result.stitched_oos_metrics.sortino_ratio,
            cagr=result.stitched_oos_metrics.cagr,
        )
        if result.stitched_oos_metrics
        else None
    )

    return WalkForwardResponse(
        strategy_name=result.strategy_name,
        total_bars=result.total_bars,
        window_mode=result.window_mode,
        windows=windows_dto,
        overall_efficiency=result.overall_efficiency,
        stitched_metrics=stitched_metrics_dto,
        robustness_grade=result.robustness_grade,
        explanation=result.explanation,
        stitched_equity_curve=result.stitched_oos_equity_curve,
    )


@router.post("/parameter-heatmap", response_model=ParameterHeatmapResponse)
def parameter_heatmap_analysis(request: ParameterHeatmapRequest) -> ParameterHeatmapResponse:
    """Evaluate 2D parameter space and determine plateau stability."""
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

    try:
        result = evaluate_parameter_grid_heatmap(
            bars=bars,
            fast_periods=request.fast_periods,
            slow_periods=request.slow_periods,
            initial_cash=request.initial_cash,
            commission_rate=request.commission_rate,
            slippage_rate=request.slippage_rate,
            sizing_mode=request.sizing_mode.value,
            quantity_per_trade=request.quantity_per_trade,
        )
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Parameter heatmap evaluation failed: {error}",
        ) from error

    grid_dto = [
        ParameterGridPointDTO(
            fast_period=pt.fast_period,
            slow_period=pt.slow_period,
            total_return=pt.total_return,
            total_pnl=pt.total_pnl,
            final_equity=pt.final_equity,
            sharpe_ratio=pt.sharpe_ratio,
            max_drawdown=pt.max_drawdown,
            trades_count=pt.trades_count,
            win_rate=pt.win_rate,
            profit_factor=pt.profit_factor,
            is_plateau=pt.is_plateau,
        )
        for pt in result.grid
    ]

    return ParameterHeatmapResponse(
        dataset=dataset_name,
        strategy_name=result.strategy_name,
        total_combinations=result.total_combinations,
        profitable_combinations=result.profitable_combinations,
        plateau_ratio=result.plateau_ratio,
        stability_verdict=result.stability_verdict,
        grid=grid_dto,
    )
