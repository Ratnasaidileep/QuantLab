from fastapi import APIRouter

from quantlab.api.schemas import HealthResponse

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("", response_model=HealthResponse)
def get_health() -> HealthResponse:
    """Check system health and API engine status."""
    return HealthResponse(
        status="ok",
        app="QuantLab",
        version="0.1.0",
    )
