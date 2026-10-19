from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from quantlab.api.dependencies import get_current_user_optional
from quantlab.api.schemas import (
    EquityPointDTO,
    ExperimentDetailDTO,
    ExperimentListResponse,
    ExperimentSummaryDTO,
    SaveExperimentRequest,
    TradeDTO,
)
from quantlab.storage.repository import (
    UserRecord,
    delete_experiment,
    get_experiment,
    list_experiments,
    save_experiment,
)

router = APIRouter(prefix="/experiments", tags=["Experiments"])


@router.post("", response_model=ExperimentDetailDTO, status_code=status.HTTP_201_CREATED)
def create_experiment(
    request: SaveExperimentRequest,
    current_user: Annotated[UserRecord | None, Depends(get_current_user_optional)] = None,
) -> ExperimentDetailDTO:
    """Save a completed backtest run into persistent storage, scoping to current user if authenticated."""
    equity_curve_dicts = [pt.model_dump() for pt in request.equity_curve]
    trades_dicts = [tr.model_dump() for tr in request.trades]

    try:
        record = save_experiment(
            name=request.name,
            notes=request.notes,
            dataset=request.dataset,
            strategy=request.strategy,
            parameters=request.parameters,
            initial_cash=request.initial_cash,
            commission_rate=request.commission_rate,
            slippage_rate=request.slippage_rate,
            sizing_mode=request.sizing_mode,
            quantity_per_trade=request.quantity_per_trade,
            final_equity=request.final_equity,
            total_pnl=request.total_pnl,
            total_return=request.total_return,
            max_drawdown=request.max_drawdown,
            total_trades=request.total_trades,
            win_rate=request.win_rate,
            profit_factor=request.profit_factor,
            sharpe_ratio=request.sharpe_ratio,
            sortino_ratio=request.sortino_ratio,
            cagr=request.cagr,
            equity_curve=equity_curve_dicts,
            trades=trades_dicts,
            user_id=current_user.id if current_user else None,
        )
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to persist experiment: {err}",
        ) from err

    return ExperimentDetailDTO(
        id=record.id,
        name=record.name,
        notes=record.notes,
        created_at=record.created_at,
        dataset=record.dataset,
        strategy=record.strategy,
        parameters=record.parameters,
        initial_cash=record.initial_cash,
        commission_rate=record.commission_rate,
        slippage_rate=record.slippage_rate,
        sizing_mode=record.sizing_mode,
        quantity_per_trade=record.quantity_per_trade,
        final_equity=record.final_equity,
        total_pnl=record.total_pnl,
        total_return=record.total_return,
        max_drawdown=record.max_drawdown,
        total_trades=record.total_trades,
        win_rate=record.win_rate,
        profit_factor=record.profit_factor,
        sharpe_ratio=record.sharpe_ratio,
        sortino_ratio=record.sortino_ratio,
        cagr=record.cagr,
        equity_curve=[EquityPointDTO(**pt) for pt in record.equity_curve],
        trades=[TradeDTO(**tr) for tr in record.trades],
        user_id=record.user_id,
    )


@router.get("", response_model=ExperimentListResponse)
def get_all_experiments(
    dataset: str | None = Query(None, description="Filter by dataset filename"),
    strategy: str | None = Query(None, description="Filter by strategy name"),
    current_user: Annotated[UserRecord | None, Depends(get_current_user_optional)] = None,
) -> ExperimentListResponse:
    """List lightweight summaries of saved experiments, scoped to current user workspace."""
    summaries = list_experiments(
        dataset=dataset,
        strategy=strategy,
        user_id=current_user.id if current_user else None,
        scope_to_user=True,
    )
    items = [
        ExperimentSummaryDTO(
            id=s.id,
            name=s.name,
            notes=s.notes,
            created_at=s.created_at,
            dataset=s.dataset,
            strategy=s.strategy,
            parameters=s.parameters,
            initial_cash=s.initial_cash,
            final_equity=s.final_equity,
            total_pnl=s.total_pnl,
            total_return=s.total_return,
            max_drawdown=s.max_drawdown,
            total_trades=s.total_trades,
            win_rate=s.win_rate,
            profit_factor=s.profit_factor,
            sharpe_ratio=s.sharpe_ratio,
            sortino_ratio=s.sortino_ratio,
            cagr=s.cagr,
            user_id=s.user_id,
        )
        for s in summaries
    ]
    return ExperimentListResponse(experiments=items, total=len(items))


@router.get("/{experiment_id}", response_model=ExperimentDetailDTO)
def get_single_experiment(
    experiment_id: int,
    current_user: Annotated[UserRecord | None, Depends(get_current_user_optional)] = None,
) -> ExperimentDetailDTO:
    """Retrieve full details of a saved experiment including its equity curve and trades."""
    record = get_experiment(
        experiment_id,
        user_id=current_user.id if current_user else None,
        scope_to_user=True,
    )
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment with ID {experiment_id} not found.",
        )

    return ExperimentDetailDTO(
        id=record.id,
        name=record.name,
        notes=record.notes,
        created_at=record.created_at,
        dataset=record.dataset,
        strategy=record.strategy,
        parameters=record.parameters,
        initial_cash=record.initial_cash,
        commission_rate=record.commission_rate,
        slippage_rate=record.slippage_rate,
        sizing_mode=record.sizing_mode,
        quantity_per_trade=record.quantity_per_trade,
        final_equity=record.final_equity,
        total_pnl=record.total_pnl,
        total_return=record.total_return,
        max_drawdown=record.max_drawdown,
        total_trades=record.total_trades,
        win_rate=record.win_rate,
        profit_factor=record.profit_factor,
        sharpe_ratio=record.sharpe_ratio,
        sortino_ratio=record.sortino_ratio,
        cagr=record.cagr,
        equity_curve=[EquityPointDTO(**pt) for pt in record.equity_curve],
        trades=[TradeDTO(**tr) for tr in record.trades],
        user_id=record.user_id,
    )


@router.delete("/{experiment_id}")
def remove_experiment(
    experiment_id: int,
    current_user: Annotated[UserRecord | None, Depends(get_current_user_optional)] = None,
) -> dict[str, Any]:
    """Delete a saved experiment from persistent storage."""
    deleted = delete_experiment(
        experiment_id,
        user_id=current_user.id if current_user else None,
        scope_to_user=True,
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Experiment with ID {experiment_id} not found.",
        )
    return {
        "message": f"Experiment {experiment_id} successfully deleted.",
        "id": experiment_id,
    }
