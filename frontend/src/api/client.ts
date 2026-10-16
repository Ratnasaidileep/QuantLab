import type {
  BacktestRequest,
  BacktestResponse,
  BasketBacktestRequest,
  BasketBacktestResponse,
  BatchFetchDatasetsResponse,
  ComparisonResponse,
  DatasetInfo,
  DatasetUploadResponse,
  ExperimentDetailDTO,
  ExperimentListResponse,
  ParameterHeatmapRequest,
  ParameterHeatmapResponse,
  SaveExperimentRequest,
  TearSheetRequest,
  TearSheetResponse,
  WalkForwardRequest,
  WalkForwardResponse,
} from '../types';

const API_BASE = '/api/v1';

export async function fetchHealth(): Promise<{ status: string; app: string; version: string }> {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`API health check failed with status ${response.status}`);
  }
  return response.json();
}

export async function fetchDatasets(): Promise<DatasetInfo[]> {
  const response = await fetch(`${API_BASE}/datasets`);
  if (!response.ok) {
    throw new Error(`Failed to fetch datasets: ${response.statusText}`);
  }
  const data = await response.json();
  return data.datasets || [];
}

export async function uploadDataset(file: File): Promise<DatasetUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/datasets/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let message = 'Dataset upload failed.';
    if (errorData.detail) {
      if (typeof errorData.detail === 'string') {
        message = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        message = errorData.detail.map((e: { msg?: string }) => e.msg || '').join('; ');
      }
    }
    throw new Error(message);
  }

  return response.json();
}

export async function fetchDatasetFromAPI(
  symbol: string,
  period = '2y',
): Promise<DatasetUploadResponse> {
  const response = await fetch(`${API_BASE}/datasets/fetch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ symbol, period }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let message = `Failed to fetch market data for ${symbol}.`;
    if (errorData.detail) {
      if (typeof errorData.detail === 'string') {
        message = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        message = errorData.detail.map((e: { msg?: string }) => e.msg || '').join('; ');
      }
    }
    throw new Error(message);
  }

  return response.json();
}

export async function fetchBatchDatasetsFromAPI(
  symbols: string[],
  period = '2y',
): Promise<BatchFetchDatasetsResponse> {
  const response = await fetch(`${API_BASE}/datasets/fetch-batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ symbols, period }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let message = 'Failed to fetch batch datasets.';
    if (errorData.detail) {
      if (typeof errorData.detail === 'string') {
        message = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        message = errorData.detail.map((e: { msg?: string }) => e.msg || '').join('; ');
      }
    }
    throw new Error(message);
  }

  return response.json();
}

export async function executeBacktest(request: BacktestRequest): Promise<BacktestResponse> {
  const response = await fetch(`${API_BASE}/backtest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let message = 'Backtest execution failed.';
    if (errorData.detail) {
      if (typeof errorData.detail === 'string') {
        message = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        message = errorData.detail.map((e: { msg?: string }) => e.msg || '').join('; ');
      }
    }
    throw new Error(message);
  }

  return response.json();
}

export async function executeComparison(
  dataset = 'reliance_daily.csv',
  initialCash = 100_000,
  commissionRate = 0.001,
  slippageRate = 0.001,
  sizingMode = 'unit',
  quantityPerTrade = 1.0,
): Promise<ComparisonResponse> {
  const payload = {
    dataset,
    initial_cash: initialCash,
    commission_rate: commissionRate,
    slippage_rate: slippageRate,
    sizing_mode: sizingMode,
    quantity_per_trade: quantityPerTrade,
    ma_parameter_pairs: [
      [2, 3],
      [5, 20],
      [10, 30],
      [20, 50],
    ],
    rsi_configurations: [[14, 30.0, 70.0]],
    include_buy_and_hold: true,
  };

  const response = await fetch(`${API_BASE}/compare`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Strategy comparison failed.');
  }

  return response.json();
}

export async function executeWalkForward(
  request: WalkForwardRequest,
): Promise<WalkForwardResponse> {
  const response = await fetch(`${API_BASE}/analytics/walk-forward`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let message = 'Walk-Forward Optimization failed.';
    if (errorData.detail) {
      if (typeof errorData.detail === 'string') {
        message = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        message = errorData.detail.map((e: { msg?: string }) => e.msg || '').join('; ');
      }
    }
    throw new Error(message);
  }

  return response.json();
}

export async function executeParameterHeatmap(
  request: ParameterHeatmapRequest,
): Promise<ParameterHeatmapResponse> {
  const response = await fetch(`${API_BASE}/analytics/parameter-heatmap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let message = 'Parameter Heatmap execution failed.';
    if (errorData.detail) {
      if (typeof errorData.detail === 'string') {
        message = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        message = errorData.detail.map((e: { msg?: string }) => e.msg || '').join('; ');
      }
    }
    throw new Error(message);
  }

  return response.json();
}

export async function saveExperiment(
  request: SaveExperimentRequest,
): Promise<ExperimentDetailDTO> {
  const response = await fetch(`${API_BASE}/experiments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let message = 'Failed to save experiment.';
    if (errorData.detail) {
      if (typeof errorData.detail === 'string') {
        message = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        message = errorData.detail.map((e: { msg?: string }) => e.msg || '').join('; ');
      }
    }
    throw new Error(message);
  }

  return response.json();
}

export async function fetchExperiments(
  dataset?: string,
  strategy?: string,
): Promise<ExperimentListResponse> {
  const params = new URLSearchParams();
  if (dataset) params.append('dataset', dataset);
  if (strategy) params.append('strategy', strategy);

  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${API_BASE}/experiments${query}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch experiments: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchExperimentById(id: number): Promise<ExperimentDetailDTO> {
  const response = await fetch(`${API_BASE}/experiments/${id}`);

  if (!response.ok) {
    throw new Error(`Failed to load experiment ${id}: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteExperiment(id: number): Promise<{ message: string; id: number }> {
  const response = await fetch(`${API_BASE}/experiments/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete experiment ${id}: ${response.statusText}`);
  }

  return response.json();
}

export async function executeTearSheet(request: TearSheetRequest): Promise<TearSheetResponse> {
  const response = await fetch(`${API_BASE}/analytics/tear-sheet`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let message = 'Tear-sheet generation failed.';
    if (errorData.detail) {
      if (typeof errorData.detail === 'string') {
        message = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        message = errorData.detail.map((e: { msg?: string }) => e.msg || '').join('; ');
      }
    }
    throw new Error(message);
  }

  return response.json();
}

export async function executeBasketBacktest(
  request: BasketBacktestRequest,
): Promise<BasketBacktestResponse> {
  const response = await fetch(`${API_BASE}/basket`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let message = 'Basket portfolio backtest failed.';
    if (errorData.detail) {
      if (typeof errorData.detail === 'string') {
        message = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        message = errorData.detail.map((e: { msg?: string }) => e.msg || '').join('; ');
      }
    }
    throw new Error(message);
  }

  return response.json();
}


