from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from quantlab.api.routes import analytics, backtest, basket, compare, datasets, experiments, health
from quantlab.config import settings


def create_app() -> FastAPI:
    """Create and configure the QuantLab FastAPI application."""
    app = FastAPI(
        title="QuantLab API",
        version="0.1.0",
        description=(
            "Quantitative Research & Algorithmic Trading Backtesting Engine API. "
            "Supports moving average crossovers, RSI, custom friction modeling, "
            "risk analytics, and benchmark comparisons."
        ),
    )

    # Allow configured CORS origins for web development and production deployment
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    api_v1_router = APIRouter(prefix="/api/v1")
    api_v1_router.include_router(health.router)
    api_v1_router.include_router(datasets.router)
    api_v1_router.include_router(backtest.router)
    api_v1_router.include_router(basket.router)
    api_v1_router.include_router(compare.router)
    api_v1_router.include_router(analytics.router)
    api_v1_router.include_router(experiments.router)

    app.include_router(api_v1_router)

    @app.get("/", tags=["Root"])
    def root() -> dict[str, str]:
        return {
            "app": "QuantLab API",
            "version": "0.1.0",
            "documentation": "/docs",
            "health": "/api/v1/health",
        }

    return app


app = create_app()
