# QuantLab — Master Project Context and Development Roadmap

**Project name:** QuantLab  
**Project type:** B.Tech major project  
**Development environment:** Windows, VS Code / Antigravity, Python virtual environment  
**Repository:** https://github.com/Ratnasaidileep/QuantLab  
**Project owner:** Student developer working primarily with AI coding assistance  
**Target completion:** February 2027  
**Document purpose:** Give AI coding assistants the context needed to understand the project's past, present state, future vision, architectural decisions, and development standards.

---

## 1. Project Overview

QuantLab is intended to become an interactive quantitative research and algorithmic trading backtesting platform.

Its purpose is to let users upload or select historical financial market data, configure trading strategies, simulate how those strategies would have performed historically, evaluate performance and risk, compare different approaches, and visualize the results through a user-friendly web interface.

The project should combine:

- Historical market data management
- Trading strategy configuration
- Backtesting and simulated trade execution
- Portfolio and cash management
- Performance and risk analytics
- Strategy and benchmark comparison
- Interactive visualizations
- Experiment history and reproducibility
- A polished, full-stack web application

QuantLab is primarily a research, educational, and backtesting platform. It should not promise future stock-price accuracy or guaranteed profits.

### Central objective

Build a reliable application that answers questions such as:

1. How would a trading strategy have performed on historical data?
2. How many trades would it have generated?
3. What were its returns, drawdowns, and transaction costs?
4. How does it compare with other strategies and a buy-and-hold benchmark?
5. Which parameters or market conditions affected its performance?
6. Are the results sufficiently robust to justify further investigation?

The platform should distinguish historical results from predictions about future markets.

---

## 2. Past Development and Decisions

### 2.1 Initial direction

The project began as a Python-based quantitative backtesting application.

The initial priority was to build the core trading engine and test its logic before investing heavily in a complete frontend.

This was an intentional approach: the strategy engine, data validation, execution rules, and performance calculations must be dependable before they are presented through a polished web interface.

### 2.2 Initial technology choices

The existing project uses:

- Python for the quantitative engine
- Pandas and NumPy for data processing and numerical calculations
- Streamlit for the initial user interface
- Matplotlib for plotting
- Pytest for automated tests
- Ruff for Python linting and code quality

The project uses a `src/` layout and separates data handling, strategy logic, backtesting, portfolio logic, and analytics into different modules.

### 2.3 Historical dataset

The project has a historical daily dataset for Reliance Industries, sourced under the symbol `RELIANCE.NS`.

The known dataset snapshot contains:

- 441 rows
- Columns: `timestamp`, `open`, `high`, `low`, `close`, `volume`
- First date: 2025-01-01
- Last date: 2026-10-05
- No missing values or duplicate timestamps in the previously inspected snapshot

These facts describe the last inspected dataset. Verify the actual file before relying on these figures.

The main CSV is located at `data/reliance_daily.csv`.

### 2.4 Existing strategies

Three principal strategy types have been implemented.

**Moving Average Crossover**

The strategy uses a fast moving average and a slow moving average. Their relationship determines whether the strategy signals a long position or exits toward a flat position.

The fast period must be positive and smaller than the slow period.

**Relative Strength Index (RSI)**

The RSI strategy uses an RSI period, oversold threshold, and overbought threshold.

Its known default parameters are:

- RSI period: 14
- Oversold threshold: 30
- Overbought threshold: 70

The strategy can generate a long signal at or below the oversold threshold and a flat signal at or above the overbought threshold. In the neutral zone, it retains its existing target state.

**Bollinger Bands (Mean Reversion)**

The Bollinger Bands strategy computes the rolling simple moving average ($\mu$) and rolling population standard deviation ($\sigma$) over a configurable lookback window ($N$, default 20) with standard deviation multiplier ($k$, default 2.0):

- Upper Band: $\mu + k\sigma$
- Lower Band: $\mu - k\sigma$

Mean-reversion signals trigger LONG when the price touches or dips below the lower band ($P \le \text{Lower}$), and reverts to FLAT when the price returns to the mean ($P \ge \text{Middle}$) or reaches the upper band ($P \ge \text{Upper}$). Fully integrated into Backtest engine, Walk-Forward Optimization (WFO), Strategy Comparison, FastAPI backend, React dashboard, and Streamlit.

These rules must be verified against the current source code before modifying them.

### 2.5 Backtesting design decisions

The existing backtest engine has the following known characteristics:

- Long-only trading
- Unit trade quantity
- Configurable commission and slippage
- Signals generated using a bar's closing price
- Orders executed at the next bar's opening price
- Open positions marked to market using the latest close
- No forced liquidation of the position at the end of the test

The next-bar execution rule is important because it helps avoid using information that would not have been available at the simulated execution time.

The engine has a `BacktestResult` structure containing processed-bar count, equity curve, trades, final cash, final equity, total P&L, and metrics.

Do not silently change execution semantics or position sizing while adding features. Document and test any intentional change.

### 2.6 Previous exploratory results

An earlier experiment on the historical Reliance dataset produced these approximate results:

| Strategy configuration | Trades | P&L | Return |
|---|---:|---:|---:|
| MA 2/3 | 166 | -₹398.15 | -0.40% |
| MA 5/20 | 32 | -₹127.49 | -0.13% |
| MA 10/30 | 18 | -₹18.54 | -0.02% |
| MA 20/50 | 10 | -₹79.54 | -0.08% |
| RSI 14/30/70 | 5 | +₹57.11 | +0.06% |

An earlier RSI run reported approximately ₹100,057.11 final equity from ₹100,000 initial capital, before treating this as evidence of a reliable trading advantage.

These are exploratory results, not verified current outputs or proof of profitability. Re-run the backtests before using the numbers in reports or demonstrations. Verify transaction-cost assumptions, benchmark performance, and metric calculations.

The small sample, limited asset coverage, and short historical period do not establish that RSI is better than moving averages.

### 2.7 Testing history

The project maintains comprehensive test coverage across data ingestion, strategy logic, friction accounting, performance metrics, benchmark comparisons, walk-forward out-of-sample optimization, and REST API endpoints.

The full automated test suite reports **139 passing tests** with 0 failures and 0 ruff lint errors (`pytest -q` and `ruff check .`). The React frontend builds cleanly (`tsc -b && vite build`) and passes `npm run lint`.

The project uses commands such as:

`.venv\Scripts\python.exe -m pytest -q`

and:

`.venv\Scripts\ruff.exe check .`

### 2.8 GitHub

The local Git repository has been pushed successfully to:

https://github.com/Ratnasaidileep/QuantLab

The `main` branch tracks `origin/main`.

Use Git commits to preserve working states and provide a recovery point before risky changes.

---

## 3. Current Project State

The last known project structure is approximately:

```text
QuantLab/
├── app.py
├── README.md
├── pyproject.toml
├── .gitignore
├── data/
│   ├── reliance_daily.csv
│   ├── raw/
│   └── processed/
│       └── reliance_backtest.png
├── notebooks/
├── src/
│   └── quantlab/
│       ├── analytics/
│       │   ├── metrics.py
│       │   ├── plotting.py
│       │   └── strategy_comparison.py
│       ├── backtest/
│       │   ├── engine.py
│       │   └── models.py
│       ├── data/
│       │   ├── csv_loader.py
│       │   ├── models.py
│       │   └── validation.py
│       ├── execution/
│       ├── portfolio/
│       │   ├── manager.py
│       │   └── models.py
│       └── strategy/
│           ├── base.py
│           ├── models.py
│           ├── moving_average.py
│           └── rsi.py
├── tests/
│   ├── test_analytics.py
│   ├── test_backtest.py
│   ├── test_data.py
│   ├── test_portfolio.py
│   ├── test_strategy.py
│   └── test_rsi.py
└── frontend/
    └── [Vite + React + TypeScript starter]
```

This is the last known layout, not a guaranteed inventory of the current checkout. Inspect the actual repository.

### Current implementation status

**Existing or previously implemented**

- Python quantitative research modules
- Historical CSV loading and validation
- Moving Average Crossover strategy (level-based and crossover signals)
- RSI strategy (Wilder's smoothing with stateful regimes)
- Bollinger Bands Mean-Reversion strategy (volatility bands with stateful reversion exit)
- Long-only backtesting engine with look-ahead bias prevention
- Flexible position sizing (`unit`, `all_in`, `fixed_quantity`)
- Portfolio and trade models with FIFO round-trip trade P&L matching
- Performance & risk analytics: P&L, returns, max drawdown, win rate, profit factor, annualized Sharpe ratio ($R_f=5\%$), Sortino ratio, CAGR, and Calmar ratio
- Walk-Forward Optimization (WFO) engine: rolling/expanding windows, Walk-Forward Efficiency (WFE), and robustness classification
- 2D Parameter Surface & Stability Heatmap generator
- Persistent experiment history (SQLite repository) with CRUD endpoints, UI panel, and Streamlit viewer
- Quantitative Tear-Sheet & Tail-Risk Diagnostics: historical & parametric VaR (95%/99%), CVaR/Expected Shortfall (95%/99%), skewness, excess kurtosis, annualized volatility, tail ratio, calendar monthly return matrix, and underwater drawdown curves
- Multi-Asset Basket & Portfolio Rebalancing Engine: Equal Weight ($1/N$), Inverse Volatility (Risk Parity), and Custom Target Weights with Next-Bar Open execution, monthly/quarterly rebalance friction, and mark-to-market daily equity curves
- Unified strategy comparison and Buy & Hold benchmark accounting
- Streamlit interactive prototype with complete Advanced Quantitative Analytics suite
- FastAPI REST backend (`/health`, `/datasets`, `/backtest`, `/basket`, `/compare`, `/analytics`, `/experiments`) with Pydantic validation, CORS middleware, and OpenAPI documentation
- 166 automated tests passing with 100% clean Ruff linting
- React, TypeScript, and Vite frontend dashboard with interactive parameter tuning, SVG equity curves, trade logs, and Multi-Asset Basket panel
- GitHub repository

**Not yet established as complete**

- PostgreSQL persistence (currently SQLite repository active)
- User registration, login, and profile management
- Production deployment and containerization
- Full end-to-end Cypress/Playwright testing

Do not claim that an item is implemented until you inspect its code and verify its behavior.

### Immediate task for the AI coding assistant

Before changing any files:

1. Inspect the whole project structure.
2. Read `README.md`, `pyproject.toml`, `.gitignore`, `app.py`, all files under `src/quantlab/`, and the tests.
3. Inspect the frontend package configuration and existing components.
4. Check Git status and identify uncommitted work.
5. Run the current test suite and lint checks when possible.
6. Report the actual implementation status, current failures, and differences from this document.
7. Identify any unfinished or potentially incorrect benchmark and strategy-comparison code.

Do not make large changes during this initial audit.

---

## 4. Future Product Vision

QuantLab should evolve from the current prototype into a full-stack web application.

### 4.1 Authentication and user profiles

Planned functionality:

- Registration and login
- Secure password handling
- User profile
- User-specific saved datasets and experiments
- Ownership and access controls for private resources

Authentication must be implemented securely. Do not store plaintext passwords or hardcode credentials.

### 4.2 Dashboard

The dashboard should provide a clear overview of the user's research activity:

- Recent backtests
- Saved strategies
- Available datasets
- Recent performance summaries
- Shortcuts to create a new experiment
- Useful project and account information

Do not overload the dashboard with financial metrics that are not clearly defined.

### 4.3 Dataset management

Users should be able to:

- Upload supported CSV files
- Browse available datasets
- View dataset metadata
- Inspect column names and date ranges
- Preview historical rows
- Validate the data before running a backtest
- Reuse previously uploaded datasets
- Delete datasets they own, subject to dependency and audit rules

Data validation should address:

- Missing or invalid timestamps
- Duplicate timestamps
- Invalid OHLC values
- Missing or nonnumeric prices
- Nonpositive prices where inappropriate
- Negative volume where inappropriate
- Incorrect date ordering
- Insufficient data for a selected strategy
- Unsupported file size or format

Use explicit, understandable validation messages.

### 4.4 Strategy configuration

The interface should support a registry of available strategies.

Initial strategies:

1. Moving Average Crossover
2. RSI

Potential future strategies, subject to research and testing:

- MACD
- Bollinger Bands
- Momentum strategies
- Other clearly documented quantitative approaches

Users should be able to configure valid strategy parameters, starting capital, commission, slippage, and other supported backtest settings.

Keep strategy logic in the quantitative engine rather than duplicating it inside frontend components.

### 4.5 Backtesting

The user should be able to select a dataset, choose a strategy, configure its parameters, and run a historical simulation.

A backtest should record enough information to reproduce the result:

- Dataset identity and version
- Strategy name and parameters
- Initial capital
- Commission and slippage assumptions
- Date range
- Engine version or relevant configuration
- Performance metrics
- Trade history
- Equity curve

The interface should clearly show loading states, validation errors, completed results, and execution failures.

### 4.6 Performance analytics

Provide clearly defined metrics such as:

- Initial and final equity
- Net profit or loss
- Total return
- Maximum drawdown
- Number of trades
- Win rate
- Average winning and losing trade
- Profit factor, when mathematically defined
- Exposure or time in market, where supported
- Sharpe ratio, when supported by appropriate return-frequency and risk-free-rate assumptions

Metrics must be calculated consistently and tested. Do not invent values when data is insufficient.

### 4.7 Visualizations

Planned visualizations include:

- Historical price chart
- Buy and sell markers
- Equity curve
- Drawdown chart
- Trade history table
- Strategy comparison chart
- Benchmark comparison
- Relevant summary metrics

Charts must label their axes, date ranges, units, and assumptions. Use the selected dataset's identity instead of hardcoded labels such as `RELIANCE Close`.

### 4.8 Strategy and benchmark comparison

The platform should compare multiple strategies under the same dataset and comparable assumptions.

Include a buy-and-hold benchmark to help determine whether an active strategy added value over simply holding the asset.

Comparison should use consistent:

- Initial capital
- Date range
- Transaction-cost assumptions where applicable
- Data inputs
- Equity valuation conventions
- Performance metric definitions

Be explicit about differences between strategy trading costs and benchmark trading costs.

Do not automatically label the highest historical return as the best strategy. Consider drawdown, trade frequency, risk, stability, and out-of-sample performance.

### 4.9 Experiment history

Users should eventually be able to:

- Save completed experiments
- Reopen previous results
- Compare experiments
- Review parameter configurations
- Rename or annotate experiments
- Reproduce results using the original dataset and configuration

Persisted experiment records should not change silently when a dataset or strategy is later edited.

### 4.10 Future predictive functionality

Future research may explore statistical or machine-learning models that estimate returns, volatility, or market regimes.

This is an optional research extension, not the immediate priority.

If introduced, it must be separate from the established backtesting engine and must include:

- Time-aware train, validation, and test splits
- Protection against look-ahead bias
- Appropriate baseline models
- Out-of-sample evaluation
- Transparent uncertainty
- Comparison against simple benchmarks
- Clear separation of predictions from actual trading signals

Do not promise that a model can reliably predict whether a stock will rise or fall. Predictive performance must be demonstrated empirically.

---

## 5. Target Technical Architecture

The following is the intended direction, not the current completed architecture.

### Frontend

**React + TypeScript + Vite**

Responsibilities:

- Application pages and navigation
- Forms and strategy configuration
- Dataset browsing and upload UI
- Interactive charts and tables
- Authentication screens
- API requests and response handling
- Loading, error, and empty states

Keep components modular and use typed API contracts.

### Backend API

**FastAPI + Python**

Responsibilities:

- Authentication and authorization
- Dataset management endpoints
- Strategy configuration validation
- Backtest orchestration
- Analytics and comparison endpoints
- Saved experiment management
- Request validation and consistent error responses

The backend should call the existing quantitative engine rather than reimplement its trading rules.

### Quantitative engine

**Existing Python package: `src/quantlab/`**

Keep the engine independent of the web framework wherever practical.

It should remain testable directly from Python and reusable by the API.

### Database

**PostgreSQL + SQLAlchemy + Alembic**

Planned responsibilities:

- Users and profiles
- Dataset metadata
- Strategy definitions or configurations
- Backtest and experiment metadata
- Saved result summaries
- Resource ownership and relationships

Use database migrations rather than manually changing production schemas.

CSV files and large result artifacts may require a file-storage strategy separate from relational metadata. Decide this deliberately.

### Testing and quality

- Pytest for Python tests
- Ruff for Python linting
- Frontend tests appropriate to the chosen React tooling
- API integration tests
- End-to-end tests for critical user workflows
- TypeScript type checking and production builds

### Architectural flow

```text
User
  |
  v
React + TypeScript Frontend
  |
  v
FastAPI Backend
  |                 |
  v                 v
QuantLab Engine   PostgreSQL
  |
  v
Backtest Results and Analytics
  |
  v
API Response
  |
  v
Charts, Metrics, and Trade History
```

The database stores persistent application information. The quantitative engine performs simulation and calculations. The frontend presents the results.

---

## 6. Recommended Development Roadmap

### Phase 0 — Audit and stabilize the current project

- Inspect the repository and Git status.
- Run tests and lint checks.
- Verify strategy and benchmark calculations.
- Identify incomplete code.
- Fix defects without breaking existing functionality.
- Document how to run the current Streamlit prototype.

**Completion criterion:** The existing project is understood, reproducible, and has a verified baseline.

### Phase 1 — Strengthen the quantitative engine

- Verify CSV validation.
- Verify execution timing and transaction costs.
- Verify cash, positions, and equity calculations.
- Test all strategy boundary conditions.
- Test drawdown and return calculations.
- Validate benchmark accounting.
- Add reproducibility and regression tests.

**Completion criterion:** Core calculations are independently testable and documented.

### Phase 2 — Build the FastAPI backend

- Create a clean API package.
- Add health and version endpoints.
- Integrate dataset validation.
- Add strategy discovery and parameter validation.
- Add backtest and comparison endpoints.
- Return structured, typed results.
- Add API tests.

**Completion criterion:** The engine can be accessed through a working API without depending on Streamlit.

### Phase 3 — Build the React frontend

- Replace the starter screen with the QuantLab interface.
- Build navigation and dashboard.
- Build dataset management pages.
- Build strategy configuration forms.
- Build the backtest results screen.
- Add charts, trade tables, and comparison views.
- Connect the frontend to the API.

**Completion criterion:** A user can run a backtest through the web interface and inspect the results.

### Phase 4 — Add persistence and experiment history (COMPLETED)

- Design relational schema for experiments with primary key, timestamps, dataset, strategy, parameters JSON, full performance scorecards, equity curve JSON, and trade logs JSON. (Completed)
- Implement SQLite Storage Repository (`quantlab.storage.repository`) using Python's standard library `sqlite3` without adding heavy ORM dependencies, ensuring reproducibility across environments. (Completed)
- Create FastAPI REST CRUD endpoints (`POST /api/v1/experiments`, `GET /api/v1/experiments`, `GET /api/v1/experiments/{id}`, `DELETE /api/v1/experiments/{id}`). (Completed)
- Implement React Experiment History dashboard (`ExperimentHistoryPanel.tsx`) with dataset/strategy filters, performance metric chips, full experiment loader (`handleLoadExperiment`), and delete actions. (Completed)
- Implement Streamlit parity with "💾 Save Experiment Run" expander and "📁 Saved Experiments / Run History" inspector tab in `app.py`. (Completed)
- Maintain 100% automated test coverage with 144 passing pytest unit tests and 0 ruff lint errors. (Completed)

**Completion criterion:** Users can reliably save, browse, reload, and inspect past quantitative simulation runs across both React and Streamlit interfaces. (Satisfied)

### Phase 5 — Improve research quality (COMPLETED)

- Add buy-and-hold comparisons. (Completed)
- Add robust metric definitions (Win Rate FIFO, Profit Factor, Annualized Sharpe Rf=5%, Sortino, CAGR). (Completed)
- Add out-of-sample evaluation (`split_bars_train_test`). (Completed)
- Add Walk-Forward Optimization (WFO) engine (`run_walk_forward_optimization`) with rolling and expanding window modes. (Completed)
- Implement Robert Pardo Walk-Forward Efficiency (WFE) scoring ($WFE = R_{oos} / R_{is}$) and academic robustness grading (`ROBUST (Pass)`, `MODERATE (Acceptable)`, `OVERFITTED (Caution)`). (Completed)
- Stitched out-of-sample forward simulation equity curve calculation. (Completed)
- 2D Parameter Surface Grid & Plateau Stability Analysis (`evaluate_parameter_grid_heatmap`) with neighbor-plateau clustering to distinguish robust parameter plateaus from brittle curve-fit spikes. (Completed)
- FastAPI REST endpoints (`POST /api/v1/analytics/walk-forward`, `POST /api/v1/analytics/parameter-heatmap`). (Completed)
- React frontend components (`WalkForwardPanel.tsx`, `ParameterHeatmap.tsx`) with pure SVG charts, plateau indicators, point inspector drawer, and tabbed navigation in `App.tsx`. (Completed)
- Streamlit application parity with "Advanced Quantitative Analytics" tabs in `app.py`. (Completed)
- Multi-Asset Data Ingestion: Custom CSV file uploading and live Yahoo Finance ticker downloads (`POST /api/v1/datasets/upload`, `POST /api/v1/datasets/fetch`) with automatic header normalization and validation. (Completed)
- Quantitative Tear-Sheet & Tail-Risk Diagnostics (`src/quantlab/analytics/tear_sheet.py`):
  - Value-at-Risk (Historical & Parametric Gaussian VaR at 95% and 99% confidence levels). (Completed)
  - Conditional Value-at-Risk (CVaR / Expected Shortfall) measuring expected loss in extreme tail percentiles. (Completed)
  - Calmar ratio ($\text{CAGR} / \text{Max Drawdown}$), tail ratio ($P_{95}/|P_5|$), Fisher-Pearson skewness, and excess kurtosis. (Completed)
  - Calendar Monthly & Annual compound return heatmap matrix calculation. (Completed)
  - Continuous underwater drawdown curve calculation. (Completed)
  - FastAPI endpoint `POST /api/v1/analytics/tear-sheet`. (Completed)
  - React interactive panel (`TearSheetPanel.tsx`) with dynamic monthly heatmap and pure SVG underwater drawdown chart. (Completed)
  - Streamlit parity with "Quantitative Tear-Sheet & Tail-Risk Diagnostics" tab in `app.py`. (Completed)
- Full automated test suite (155 passing tests in `pytest`, 0 lint warnings in `ruff`, 0 errors in Vite/TypeScript). (Completed)

**Completion criterion:** The platform supports meaningful, reproducible out-of-sample strategy evaluation, multi-asset data ingestion, parameter stability analysis, and comprehensive PyFolio-grade risk tear-sheets. (Satisfied)

### Phase 6 — Deployment and final major-project preparation

- Configure environment variables and production settings.
- Deploy frontend, backend, and database.
- Add logging and error handling.
- Add backups and deployment documentation.
- Perform end-to-end testing.
- Prepare architecture diagrams, testing evidence, limitations, screenshots, and project documentation.
- Re-run the full test suite and record verified results.

**Target:** Work toward completion by February 2027. Reassess the schedule after the initial audit.

---

## 7. Engineering Rules for the AI Coding Assistant

These rules are mandatory throughout development.

### Understand before editing

- Read the relevant files before proposing changes.
- Check existing implementations and tests.
- Do not assume that the documentation perfectly matches the repository.
- Identify the files that need changing and explain the approach before large changes.

### Preserve the working code

- Do not rewrite the entire project unnecessarily.
- Do not replace the quantitative engine with a different implementation just to simplify integration.
- Do not remove existing functionality without explicit justification.
- Prefer small, reversible changes.

### Test-driven development

For each meaningful change:

1. Define the expected behavior.
2. Add or update tests.
3. Implement the smallest suitable change.
4. Run the relevant tests.
5. Run the full test suite when practical.
6. Run lint and type checks as applicable.
7. Report the actual commands and results.

Never claim that tests passed unless they were actually run and passed.

### Financial correctness

- Avoid look-ahead bias.
- Avoid using future data to generate current signals.
- Make execution timing explicit.
- Include commissions and slippage where configured.
- Define end-of-test liquidation and mark-to-market behavior.
- Validate position, cash, and equity accounting.
- Avoid survivorship bias where relevant.
- Avoid overstating the significance of a small backtest.
- Never describe historical profitability as a guarantee of future returns.

### Security and data handling

- Never commit passwords, API keys, access tokens, or secrets.
- Keep `.env` files excluded from Git.
- Validate uploads and enforce reasonable size limits.
- Do not trust user-supplied filenames or file paths.
- Enforce authentication and ownership on private resources.
- Review destructive commands and database changes before execution.
- Keep the GitHub repository private while data rights or project-sharing decisions remain unresolved.

### Maintainable architecture

- Keep business logic out of React components.
- Keep quantitative calculations out of FastAPI route handlers when they belong in the engine.
- Use clear data models and interfaces.
- Avoid unnecessary abstractions and dependencies.
- Document non-obvious decisions.
- Keep the code suitable for a student project that must be explained and defended academically.

### Collaboration and communication

The project owner is developing the project with AI assistance and benefits from explicit, step-by-step instructions.

For significant tasks, provide:

1. The objective
2. Why the change is needed
3. The files involved
4. The implementation plan
5. The commands to run
6. Expected verification results
7. Any limitations or follow-up work

Do not silently make broad architectural changes.

---

## 8. How to Start Each New Development Task

At the start of a task:

1. Read this document.
2. Inspect the current Git status.
3. Read the relevant source files and tests.
4. Confirm the current implementation.
5. Identify the smallest useful change.
6. State the plan and risks.
7. Implement and verify the change.
8. Summarize modified files, test results, and remaining work.

Before major changes, create a Git commit or another recoverable checkpoint. Do not overwrite uncommitted user work.

After a task, update this document if the architecture, completed features, or important decisions have changed.

---

## 9. First Prompt for Antigravity

After saving this file, give Antigravity the following instruction:

"Read PROJECT_CONTEXT.md completely before taking any action. Then inspect the entire QuantLab repository and compare the actual codebase against the documented past, present, and future state.

Do not implement features yet.

First, produce an audit report containing:

1. The actual repository structure.
2. Existing features and their source files.
3. Current tests and their real execution results.
4. Current lint and type-check results where applicable.
5. Bugs, incomplete features, and technical debt.
6. Any inconsistencies between this document and the code.
7. The status of the Streamlit prototype, strategy comparison, and buy-and-hold benchmark.
8. The recommended next development phase and its dependencies.
9. A prioritized list of tasks, with acceptance criteria for each.

Do not claim that a feature works merely because a file exists. Verify behavior where possible. Do not make code changes during this audit. Ask for approval before beginning implementation.

Treat PROJECT_CONTEXT.md as the project roadmap, but treat the actual repository and verified test results as the source of truth for current implementation status."

---

## 10. Definition of Success

QuantLab is successful when it becomes a maintainable, well-tested, full-stack quantitative research platform in which users can manage historical datasets, configure strategies, execute realistic backtests, inspect trades and performance, compare strategies against benchmarks, and save reproducible experiments.

The priority order is:

**Correctness → Testability → Maintainability → Usability → Advanced features.**

A polished interface is important, but it must be built on trustworthy data handling and sound quantitative calculations.

The long-term aim is not merely to display charts or generate buy/sell signals. It is to provide a credible environment for quantitative experimentation, analysis, and learning.
