from pathlib import Path

from fastapi import APIRouter, HTTPException

from quantlab.analytics.monte_carlo import run_monte_carlo_simulation
from quantlab.analytics.tear_sheet import generate_tear_sheet
from quantlab.analytics.walk_forward import (
    evaluate_parameter_grid_heatmap,
    run_walk_forward_optimization,
)
from quantlab.api.schemas import (
    DrawdownHistogramBinDTO,
    MetricsDTO,
    MonteCarloPointDTO,
    MonteCarloRequest,
    MonteCarloResponse,
    MonteCarloSummaryDTO,
    MonthlyReturnRowDTO,
    ParameterGridPointDTO,
    ParameterHeatmapRequest,
    ParameterHeatmapResponse,
    StrategyType,
    TailRiskDTO,
    TearSheetRequest,
    TearSheetResponse,
    UnderwaterPointDTO,
    WalkForwardRequest,
    WalkForwardResponse,
    WalkForwardWindowDTO,
)
from quantlab.backtest.engine import Backtest
from quantlab.config import settings
from quantlab.data.csv_loader import load_bars_from_csv
from quantlab.strategy.bollinger import BollingerBandsStrategy
from quantlab.strategy.macd import MACDStrategy
from quantlab.strategy.moving_average import MovingAverageCrossover
from quantlab.strategy.rsi import RSIStrategy

router = APIRouter(prefix="/analytics", tags=["Advanced Analytics"])

DATA_DIR = settings.data_dir


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


@router.post("/tear-sheet", response_model=TearSheetResponse)
def generate_tear_sheet_report(request: TearSheetRequest) -> TearSheetResponse:
    """Generate a comprehensive quantitative tear-sheet with tail-risk metrics and monthly returns."""
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
    elif request.strategy == StrategyType.MACD:
        strategy = MACDStrategy(
            fast_period=request.macd_fast,
            slow_period=request.macd_slow,
            signal_period=request.macd_signal,
        )
        use_crossover = True
        strategy_name = "MACD"
        configuration = (
            f"Fast {request.macd_fast} / Slow {request.macd_slow} / Signal {request.macd_signal}"
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
            stop_loss_pct=request.stop_loss_pct,
            take_profit_pct=request.take_profit_pct,
            trailing_stop_pct=request.trailing_stop_pct,
        )
        result = backtest.run(bars)
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Backtest simulation failed: {error}",
        ) from error

    try:
        sheet = generate_tear_sheet(
            bars=bars,
            equity_curve=result.equity_curve,
            trades=result.trades,
            initial_cash=request.initial_cash,
            risk_free_rate=request.risk_free_rate,
        )
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Tear-sheet calculation failed: {error}",
        ) from error

    summary_dto = MetricsDTO(
        total_pnl=sheet.summary.total_pnl,
        total_return=sheet.summary.total_return,
        max_drawdown=sheet.summary.max_drawdown,
        total_trades=sheet.summary.total_trades,
        win_rate=sheet.summary.win_rate,
        profit_factor=sheet.summary.profit_factor,
        sharpe_ratio=sheet.summary.sharpe_ratio,
        sortino_ratio=sheet.summary.sortino_ratio,
        cagr=sheet.summary.cagr,
        calmar_ratio=sheet.summary.calmar_ratio,
    )

    tail_risk_dto = TailRiskDTO(
        var_95_historical=sheet.tail_risk.var_95_historical,
        var_95_parametric=sheet.tail_risk.var_95_parametric,
        var_99_historical=sheet.tail_risk.var_99_historical,
        var_99_parametric=sheet.tail_risk.var_99_parametric,
        cvar_95=sheet.tail_risk.cvar_95,
        cvar_99=sheet.tail_risk.cvar_99,
        tail_ratio=sheet.tail_risk.tail_ratio,
        skewness=sheet.tail_risk.skewness,
        kurtosis=sheet.tail_risk.kurtosis,
        annualized_volatility=sheet.tail_risk.annualized_volatility,
        calmar_ratio=sheet.tail_risk.calmar_ratio,
    )

    monthly_dto = [
        MonthlyReturnRowDTO(
            year=row.year,
            months=row.months,
            year_total=row.year_total,
        )
        for row in sheet.monthly_matrix
    ]

    underwater_dto = [
        UnderwaterPointDTO(
            timestamp=pt.timestamp.isoformat(),
            drawdown=pt.drawdown,
        )
        for pt in sheet.underwater_curve
    ]

    return TearSheetResponse(
        strategy_name=strategy_name,
        configuration=configuration,
        dataset=dataset_name,
        bars_processed=result.bars_processed,
        initial_cash=request.initial_cash,
        final_equity=result.final_equity,
        total_pnl=result.total_pnl,
        summary=summary_dto,
        tail_risk=tail_risk_dto,
        monthly_matrix=monthly_dto,
        underwater_curve=underwater_dto,
    )


@router.post("/monte-carlo", response_model=MonteCarloResponse)
def monte_carlo_analysis(request: MonteCarloRequest) -> MonteCarloResponse:
    """Execute Monte Carlo simulation over backtest trade history."""
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
    elif request.strategy == StrategyType.MACD:
        strategy = MACDStrategy(
            fast_period=request.macd_fast,
            slow_period=request.macd_slow,
            signal_period=request.macd_signal,
        )
        use_crossover = True
        strategy_name = "MACD"
        configuration = (
            f"Fast {request.macd_fast} / Slow {request.macd_slow} / Signal {request.macd_signal}"
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
            stop_loss_pct=request.stop_loss_pct,
            take_profit_pct=request.take_profit_pct,
            trailing_stop_pct=request.trailing_stop_pct,
        )
        result = backtest.run(bars)
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Backtest simulation failed: {error}",
        ) from error

    try:
        mc_result = run_monte_carlo_simulation(
            initial_cash=request.initial_cash,
            trades=result.trades,
            num_simulations=request.num_simulations,
            ruin_drawdown_pct=request.ruin_drawdown_pct,
            mode=request.mode.value,
            seed=request.seed,
        )
    except ValueError as val_err:
        raise HTTPException(
            status_code=400,
            detail=str(val_err),
        ) from val_err
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Monte Carlo simulation failed: {error}",
        ) from error

    summary_dto = MonteCarloSummaryDTO(
        simulations_count=mc_result.summary.simulations_count,
        trades_resampled=mc_result.summary.trades_resampled,
        ruin_threshold=mc_result.summary.ruin_threshold,
        probability_of_ruin=mc_result.summary.probability_of_ruin,
        median_max_drawdown=mc_result.summary.median_max_drawdown,
        p95_max_drawdown=mc_result.summary.p95_max_drawdown,
        p5_max_drawdown=mc_result.summary.p5_max_drawdown,
        median_terminal_equity=mc_result.summary.median_terminal_equity,
        p5_terminal_equity=mc_result.summary.p5_terminal_equity,
        p95_terminal_equity=mc_result.summary.p95_terminal_equity,
    )

    cone_dto = [
        MonteCarloPointDTO(
            step=pt.step,
            p5=pt.p5,
            p25=pt.p25,
            p50=pt.p50,
            p75=pt.p75,
            p95=pt.p95,
        )
        for pt in mc_result.confidence_cone
    ]

    hist_dto = [
        DrawdownHistogramBinDTO(
            bin_start=b.bin_start,
            bin_end=b.bin_end,
            count=b.count,
            percentage=b.percentage,
        )
        for b in mc_result.drawdown_histogram
    ]

    return MonteCarloResponse(
        strategy_name=strategy_name,
        configuration=configuration,
        dataset=dataset_name,
        initial_cash=request.initial_cash,
        summary=summary_dto,
        confidence_cone=cone_dto,
        drawdown_histogram=hist_dto,
    )

