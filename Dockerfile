# ==============================================================================
# QuantLab FastAPI Backend Dockerfile
# Production-ready Python 3.11 image with security best practices
# ==============================================================================

FROM python:3.11-slim as base

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/src \
    PORT=8000

WORKDIR /app

# Install system dependencies (curl for container healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first for caching layers
COPY pyproject.toml README.md ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir .

# Copy application source code and initial market data
COPY src/ ./src/
COPY data/ ./data/
COPY app.py ./

# Re-install package to register console scripts and metadata
RUN pip install --no-cache-dir -e .

# Create unprivileged system user for container security
RUN groupadd -r quantgroup && useradd -r -g quantgroup -d /app quantuser && \
    chown -R quantuser:quantgroup /app

USER quantuser

EXPOSE 8000

# Docker native container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

# Launch FastAPI ASGI server with Uvicorn
CMD ["uvicorn", "quantlab.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
