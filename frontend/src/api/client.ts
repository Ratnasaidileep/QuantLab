import type {
  AuthResponse,
  BacktestRequest,
  BacktestResponse,
  BasketBacktestRequest,
  BasketBacktestResponse,
  BatchFetchDatasetsResponse,
  BenchmarkMatrixRequest,
  BenchmarkMatrixResponse,
  ComparisonResponse,
  DatasetInfo,
  DatasetUploadResponse,
  EfficientFrontierRequest,
  EfficientFrontierResponse,
  ExperimentDetailDTO,
  ExperimentListResponse,
  MonteCarloRequest,
  MonteCarloResponse,
  ParameterHeatmapRequest,
  ParameterHeatmapResponse,
  SaveExperimentRequest,
  TearSheetRequest,
  TearSheetResponse,
  UserDTO,
  WalkForwardRequest,
  WalkForwardResponse,
} from '../types';

const API_BASE = '/api/v1';
const AUTH_TOKEN_KEY = 'quantlab_jwt_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {
    // Ignore restricted localStorage
  }
}

export function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

export async function runMonteCarloSimulation(
  request: MonteCarloRequest,
): Promise<MonteCarloResponse> {
  const response = await fetch(`${API_BASE}/analytics/monte-carlo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let message = 'Monte Carlo simulation failed.';
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
      ...getAuthHeaders(),
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
  const response = await fetch(`${API_BASE}/experiments${query}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch experiments: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchExperimentById(id: number): Promise<ExperimentDetailDTO> {
  const response = await fetch(`${API_BASE}/experiments/${id}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load experiment ${id}: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteExperiment(id: number): Promise<{ message: string; id: number }> {
  const response = await fetch(`${API_BASE}/experiments/${id}`, {
    method: 'DELETE',
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete experiment ${id}: ${response.statusText}`);
  }

  return response.json();
}

export async function registerUser(username: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let message = 'Registration failed.';
    if (errorData.detail) {
      if (typeof errorData.detail === 'string') {
        message = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        message = errorData.detail.map((e: { msg?: string }) => e.msg || '').join('; ');
      }
    }
    throw new Error(message);
  }

  const data: AuthResponse = await response.json();
  setStoredToken(data.access_token);
  return data;
}

export async function loginUser(username: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let message = 'Invalid username or password.';
    if (errorData.detail) {
      if (typeof errorData.detail === 'string') {
        message = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        message = errorData.detail.map((e: { msg?: string }) => e.msg || '').join('; ');
      }
    }
    throw new Error(message);
  }

  const data: AuthResponse = await response.json();
  setStoredToken(data.access_token);
  return data;
}

export async function fetchCurrentUser(): Promise<UserDTO> {
  const token = getStoredToken();
  if (!token) {
    throw new Error('No authentication token found.');
  }

  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    setStoredToken(null);
    throw new Error('Authentication session expired.');
  }

  return response.json();
}

export function logoutUser(): void {
  setStoredToken(null);
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

export async function fetchEfficientFrontier(
  request: EfficientFrontierRequest,
): Promise<EfficientFrontierResponse> {
  const response = await fetch(`${API_BASE}/basket/efficient-frontier`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let message = 'Efficient Frontier optimization failed.';
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

export async function fetchBenchmarkMatrix(
  request: BenchmarkMatrixRequest,
): Promise<BenchmarkMatrixResponse> {
  const response = await fetch(`${API_BASE}/analytics/benchmark-matrix`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    let message = 'Academic benchmark suite execution failed.';
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

