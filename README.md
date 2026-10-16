# QuantLab — Quantitative Research & Backtesting Platform

QuantLab is an interactive quantitative research and algorithmic trading platform designed for strategy development, event-driven backtesting, and performance analysis.

Developed as a B.Tech major project, QuantLab focuses on realistic historical simulation, strict prevention of look-ahead bias, explicit transaction friction modeling, and empirical benchmark comparisons.

---

## 1. Key Capabilities

- **Look-Ahead Bias Prevention**: Strategy signals are evaluated using bar $t$'s closing price; simulated order executions occur at bar $t+1$'s opening price.
- **Friction & Cost Modeling**: Realistic broker commissions and bid-ask slippage are applied to both entries and exits.
- **Modular Strategy Framework**: Clean `Protocol`-based strategy contract allowing arbitrary quantitative strategies to be plugged in.
- **Built-in Strategies**:
  - **Moving Average Crossover**: Supports level-based signals and event-driven crossovers.
  - **RSI (Wilder's Smoothing)**: Stateful overbought/oversold regime tracking with neutral zone retention.
  - **Bollinger Bands (Dynamic Channels)**: Statistical mean reversion computing rolling mean $\mu$ and standard deviation channels $\mu \pm k\sigma$, generating dynamic volatility-based entry and exit signals.
- **Unified Benchmark Comparison**: Standardized Buy & Hold benchmark evaluated under the exact same valuation conventions and cost assumptions.
- **Advanced Performance & Risk Analytics**:
  - Total P&L and Percentage Return
  - Maximum Peak-to-Trough Drawdown
  - Realized Trade Win Rate (via FIFO round-trip matching)
  - Profit Factor (Gross Profits / Gross Losses)
  - Compound Annual Growth Rate (CAGR) & Calmar Ratio ($\text{CAGR} / \text{Max Drawdown}$)
- **Comprehensive Tear-Sheet & Tail-Risk Diagnostics**:
  - **Value-at-Risk (VaR 95% & 99%)**: Historical empirical quantile and Gaussian parametric models.
  - **Conditional Value-at-Risk (CVaR / Expected Shortfall)**: Average loss in worst 5% and 1% tail regimes.
  - **Distribution Diagnostics**: Tail ratio ($P_{95}/|P_5|$), Fisher-Pearson skewness, and excess kurtosis.
  - **Calendar Monthly/Annual Return Heatmap**: Year-over-month performance matrix with annual compounding.
  - **Underwater Drawdown Curve**: Continuous peak-to-trough drawdown depth tracking.
- **Flexible Capital & Position Sizing**:
  - Unit Trade (`unit` — 1 share, baseline)
  - Full Capital Allocation (`all_in` — maximal capital deployment, eliminates cash drag)
  - Fixed Quantity (`fixed_quantity` — customizable lot sizing)
- **Multi-Asset Data Ingestion**:
  - Upload custom OHLCV CSV files with automatic header normalization and data validation.
  - Download live market data on the fly from Yahoo Finance for any global symbol (e.g. `TCS.NS`, `AAPL`, `NVDA`, `SPY`).
- **FastAPI REST API**: High-performance OpenAPI backend serving strategy execution, parameter validation, dataset metadata, and benchmark comparison to web clients.
- **Interactive Web Interface**: Streamlit dashboard with position sizing selection, parameter tuning, metric scorecards, dual-panel Matplotlib charts, trade history tables, and multi-strategy leaderboards.

---

## 2. Architecture & Codebase Layout

QuantLab strictly decouples its core quantitative engine from presentation frameworks:

```text
QuantLab/
├── app.py                               # Streamlit interactive application
├── pyproject.toml                       # Build system, dependencies, and tool settings
├── data/
│   └── reliance_daily.csv               # Historical daily OHLCV dataset (RELIANCE.NS)
├── src/
│   └── quantlab/
│       ├── data/                        # OHLCV models, validation rules, and CSV loaders
│       │   ├── models.py
│       │   ├── validation.py
│       │   └── csv_loader.py
│       ├── strategy/                    # Strategy protocol and indicator implementations
│       │   ├── base.py
│       │   ├── models.py
│       │   ├── moving_average.py
│       │   ├── rsi.py
│       │   └── bollinger.py
│       ├── portfolio/                   # Position models and state tracking
│       │   ├── models.py
│       │   └── manager.py
│       ├── backtest/                    # Execution engine and trade models
│       │   ├── models.py
│       │   └── engine.py
│       ├── storage/                     # SQLite persistence and experiment repository
│       │   ├── __init__.py
│       │   └── repository.py
│       ├── analytics/                   # Performance metrics, charts, and strategy comparisons
│       │   ├── metrics.py
│       │   ├── plotting.py
│       │   ├── strategy_comparison.py
│       │   ├── tear_sheet.py
│       │   └── walk_forward.py
│       └── api/                         # FastAPI REST API layer
│           ├── main.py
│           ├── schemas.py
│           └── routes/
│               ├── health.py
│               ├── datasets.py
│               ├── backtest.py
│               ├── compare.py
│               └── analytics.py
├── tests/                               # Comprehensive unit and integration test suite
│   ├── test_data.py
│   ├── test_strategy.py
│   ├── test_rsi.py
│   ├── test_bollinger.py
│   ├── test_portfolio.py
│   ├── test_backtest.py
│   ├── test_analytics.py
│   ├── test_walk_forward.py
│   └── test_api.py
└── frontend/                            # React + TypeScript + Vite web client (Phase 3)
```

---

## 3. Installation & Setup

### Prerequisites
- Python 3.11 or higher
- Git

### Virtual Environment Setup

```bash
# Clone the repository
git clone https://github.com/Ratnasaidileep/QuantLab.git
cd QuantLab

# Create and activate a virtual environment
python -m venv .venv

# Windows (PowerShell)
.venv\Scripts\Activate.ps1
# Windows (Command Prompt)
.venv\Scripts\activate.bat
# Linux / macOS
source .venv/bin/activate

# Install QuantLab in editable mode with development dependencies
pip install -e ".[dev]"
```

---

## 4. Running QuantLab

### FastAPI REST Backend

Launch the backend API server:

```bash
uvicorn quantlab.api.main:app --reload --port 8000
```

- Interactive OpenAPI Swagger UI: `http://localhost:8000/docs`
- ReDoc Documentation: `http://localhost:8000/redoc`
- Health check: `http://localhost:8000/api/v1/health`

### React + TypeScript + Vite Web Client

Launch the modern frontend dashboard:

```bash
cd frontend
npm run dev
```

The client will start at `http://localhost:5173` and automatically proxies requests to the FastAPI backend (`http://localhost:8000`).

### Interactive Streamlit Prototype

Launch the Streamlit interface locally:

```bash
streamlit run app.py
```

The application will start at `http://localhost:8501`. From the dashboard, you can:
- Select between **Moving Average Crossover**, **RSI**, and **Bollinger Bands**.
- Adjust strategy parameters (MA periods, RSI thresholds, BB standard deviations).
- Configure initial capital, broker commission rate, slippage rate, and position sizing.
- Inspect the interactive equity curve, trade log, risk tear-sheets, and multi-asset basket portfolio engine.

---

## 5. Running with Docker & Production Containers

QuantLab provides complete multi-container orchestration via Docker and Docker Compose.

### Quick Start (Full-Stack Containerized)

1. Copy the environment configuration template:
   ```bash
   cp .env.example .env
   ```

2. Build and launch all services:
   ```bash
   docker compose up --build
   ```

3. Access the running services:
   - **React Production Frontend (Nginx)**: [http://localhost:3000](http://localhost:3000)
   - **FastAPI OpenAPI Backend**: [http://localhost:8000/docs](http://localhost:8000/docs)
   - **Streamlit Prototype** (optional profile):
     ```bash
     docker compose --profile streamlit up
     ```
     Access at: [http://localhost:8501](http://localhost:8501)

4. Stop all services:
   ```bash
   docker compose down
   ```

*Persistent data (`data/quantlab.db` and CSV files) is preserved across container lifecycles via Docker volume binding.*

---

## 6. Automated Testing & CI/CD Pipeline

QuantLab enforces strict test-driven development, continuous integration, and style standards:

```bash
# Run backend pytest suite (168 verified passing tests)
python -m pytest -v

# Run Python linter
ruff check .

# Run Frontend TypeScript build and lint
cd frontend
npm run lint
npm run build
```

### GitHub Actions CI/CD Pipeline

Every push and pull request to `main` automatically runs `.github/workflows/ci.yml`:
- **Python Quality & Tests**: Sets up Python 3.11, validates code with `ruff check .`, and runs the full 168-test `pytest` suite.
- **Frontend Verification**: Sets up Node 20, verifies code with `npm run lint`, checks TypeScript types, and compiles the production Vite bundle.
- **Docker Build Validation**: Validates backend and frontend Docker builds and verifies `docker compose config` syntax.

---

## 7. Sample Dataset & Baseline Results

The included dataset (`data/reliance_daily.csv`) contains 441 daily bars for Reliance Industries (`RELIANCE.NS`) from January 2025 to October 2026.

Baseline performance with ₹100,000 initial capital, 0.1% commission, and 0.1% slippage:

| Strategy | Parameters | Trades | Win Rate | Profit Factor | Final Equity | Net P&L | Max Drawdown |
| :--- | :--- | :---:| :---:| :---:| :---:| :---:| :---:|
| **MA Crossover** | Fast 10 / Slow 30 | 18 | 33.3% | 0.73 | ₹99,981.46 | -₹18.54 | 0.07% |
| **RSI** | Period 14 / OS 30 / OB 70 | 5 | 100.0% | ∞ | ₹100,057.11 | +₹57.11 | 0.30% |
| **Buy & Hold** | Buy Day 1 Open / Hold | 1 | N/A | N/A | ₹99,969.12 | -₹30.88 | 0.42% |

> **Note on Position Sizing**: In the baseline unit-trade convention, order quantity is fixed at 1 unit. Out of ₹100,000 capital, only ~₹1,216 is deployed in the asset, leaving ~98.8% in idle cash. Switching to **Full Capital Allocation (All-in)** in the sidebar or passing `sizing_mode="all_in"` deploys 100% of available cash into whole shares, reflecting fully deployed capital dynamics.

---

## 8. Research Principles & Disclaimers

1. **Research Tool**: Backtest results represent historical simulation under specific assumptions and do not guarantee future profitability.
2. **Execution Realism**: Apparent trading advantages can disappear once slippage, commissions, and execution delays are accounted for.
3. **Data Integrity**: All market data must be validated for chronological ordering and positive prices before simulation.
4. **Out-of-Sample Validation**: Robustness requires evaluating strategies out-of-sample via rolling Walk-Forward Optimization (WFO) and confirming parameter plateaus rather than relying solely on in-sample curve-fitting.

---

## 9. Development Roadmap

- [x] **Phase 0 — Audit & Baseline Stabilization**: Codebase audit, test baseline established (67 -> 79 tests), benchmark accounting unified.
- [x] **Phase 1 — Engine Hardening**: Flexible position sizing (`unit`, `all_in`, `fixed_quantity`), annualized Sharpe/Sortino ratios, CAGR, and trade-level analytics (79 -> 99 tests).
- [x] **Phase 2 — FastAPI Backend**: REST API wrapping the quantitative engine with Pydantic validation, CORS, Swagger documentation, and automated endpoint tests (99 -> 111 tests).
- [x] **Phase 3 — React Frontend**: Modern full-stack dashboard with real-time API health monitoring, interactive parameter controls, SVG equity curves, trade logs, and comparative benchmark leaderboards.
- [x] **Phase 4 — Persistence & Saved Experiment History**: Zero-dependency SQLite repository with relational indexing, JSON serialization for equity curves and trade traces, FastAPI CRUD endpoints, React history browser with reload capability, and Streamlit inspector parity (139 -> 144 tests).
- [x] **Phase 5 — Advanced Quantitative Analytics & Tear-Sheet**: Walk-Forward Optimization (WFO) with Pardo efficiency grading, 2D parameter plateau stability heatmaps, Calmar ratio, Value-at-Risk (VaR 95/99%), Expected Shortfall (CVaR), monthly calendar return heatmaps, underwater drawdown curves, and Multi-Asset Basket Rebalancing Engine (111 -> 166 tests).
- [x] **Phase 6A — Production Containerization & CI/CD Pipeline**: Multi-stage Docker builds for FastAPI backend and React Nginx frontend, root `docker-compose.yml`, centralized `Settings` module, `.env.example`, and automated GitHub Actions CI/CD workflow (168 tests).
- [ ] **Phase 6B — Academic Demonstration & Viva Defense Guide**: Comprehensive Major Project evaluation guide, mathematical proofs of zero look-ahead bias, and viva Q&A defense preparation.

