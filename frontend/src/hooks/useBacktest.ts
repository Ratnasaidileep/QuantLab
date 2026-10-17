import { useContext } from 'react';
import { BacktestContext, type BacktestContextType, DEFAULT_CONFIG } from '../context/backtest-context';

export function useBacktest(): BacktestContextType {
  const context = useContext(BacktestContext);
  if (!context) {
    throw new Error('useBacktest must be used within a BacktestProvider');
  }
  return context;
}

export { DEFAULT_CONFIG };
