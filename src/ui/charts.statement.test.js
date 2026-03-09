// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock chart.js so no real canvas rendering occurs
vi.mock('chart.js', () => {
  const Chart = vi.fn().mockImplementation(() => ({ destroy: vi.fn() }));
  Chart.register = vi.fn();
  return {
    Chart,
    LineController: {}, BarController: {}, DoughnutController: {},
    CategoryScale: {}, LinearScale: {},
    PointElement: {}, LineElement: {}, BarElement: {}, ArcElement: {},
    Filler: {}, Tooltip: {}, Legend: {},
  };
});

import {
  renderStatementBalanceChart,
  renderStatementInterestChart,
  renderStatementPaymentChart,
  renderStatementUtilisationChart,
  destroyStatementCharts,
} from './charts.js';
import { Chart } from 'chart.js';

// Helper: build a canvas element in the document
function makeCanvas(id) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('canvas');
    el.id = id;
    document.body.appendChild(el);
  }
  return el;
}

// Sample statements in pence
const TWO_STMTS = [
  { date: '2025-01-01', amount: 50000, openingBalance: 60000, interest: 1500, fees: 0, minimumPayment: 2500, actualPaymentAmount: 2500 },
  { date: '2025-02-01', amount: 48000, openingBalance: 50000, interest: 1400, fees: 200, minimumPayment: 2400, actualPaymentAmount: null },
];

const ONE_STMT = [TWO_STMTS[0]];

describe('renderStatementBalanceChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeCanvas('stmt-chart-balance');
  });

  it('creates a line chart when >= 2 statements', () => {
    renderStatementBalanceChart('stmt-chart-balance', TWO_STMTS);
    expect(Chart).toHaveBeenCalledOnce();
    const config = Chart.mock.calls[0][1];
    expect(config.type).toBe('line');
    // Data points are in pounds (pence / 100)
    expect(config.data.datasets[0].data).toEqual([500, 480]);
  });

  it('does NOT create a chart when < 2 statements', () => {
    renderStatementBalanceChart('stmt-chart-balance', ONE_STMT);
    expect(Chart).not.toHaveBeenCalled();
  });

  it('does NOT create a chart when statements is empty', () => {
    renderStatementBalanceChart('stmt-chart-balance', []);
    expect(Chart).not.toHaveBeenCalled();
  });
});

describe('renderStatementInterestChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeCanvas('stmt-chart-interest');
  });

  it('creates a line chart with cumulative interest+fees', () => {
    renderStatementInterestChart('stmt-chart-interest', TWO_STMTS);
    expect(Chart).toHaveBeenCalledOnce();
    const config = Chart.mock.calls[0][1];
    expect(config.type).toBe('line');
    // Cumulative: [15+0, 15+14+2] = [15, 31] pounds (pence/100: [1500, 1500+1400+200]=3100)
    expect(config.data.datasets[0].data[0]).toBeCloseTo(15);
    expect(config.data.datasets[0].data[1]).toBeCloseTo(31);
  });

  it('does NOT create a chart when < 2 statements', () => {
    renderStatementInterestChart('stmt-chart-interest', ONE_STMT);
    expect(Chart).not.toHaveBeenCalled();
  });
});

describe('renderStatementPaymentChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeCanvas('stmt-chart-payments');
  });

  it('creates a bar chart comparing actual vs min payment', () => {
    renderStatementPaymentChart('stmt-chart-payments', TWO_STMTS);
    expect(Chart).toHaveBeenCalledOnce();
    const config = Chart.mock.calls[0][1];
    expect(config.type).toBe('bar');
    // Two datasets: min due and actual paid
    expect(config.data.datasets).toHaveLength(2);
  });

  it('does NOT create a chart when < 2 statements', () => {
    renderStatementPaymentChart('stmt-chart-payments', ONE_STMT);
    expect(Chart).not.toHaveBeenCalled();
  });
});

describe('renderStatementUtilisationChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeCanvas('stmt-chart-utilisation');
  });

  it('creates a line chart showing utilisation % when creditLimit > 0', () => {
    renderStatementUtilisationChart('stmt-chart-utilisation', TWO_STMTS, 100000); // £1000 limit
    expect(Chart).toHaveBeenCalledOnce();
    const config = Chart.mock.calls[0][1];
    expect(config.type).toBe('line');
    // 50000/100000*100=50%, 48000/100000*100=48%
    expect(config.data.datasets[0].data[0]).toBeCloseTo(50);
    expect(config.data.datasets[0].data[1]).toBeCloseTo(48);
  });

  it('does NOT create a chart when creditLimit is 0', () => {
    renderStatementUtilisationChart('stmt-chart-utilisation', TWO_STMTS, 0);
    expect(Chart).not.toHaveBeenCalled();
  });

  it('does NOT create a chart when < 2 statements', () => {
    renderStatementUtilisationChart('stmt-chart-utilisation', ONE_STMT, 100000);
    expect(Chart).not.toHaveBeenCalled();
  });
});

describe('destroyStatementCharts', () => {
  it('destroys all 4 chart instances without errors', () => {
    // Render all 4 charts to populate _chartInstances
    ['stmt-chart-balance', 'stmt-chart-interest', 'stmt-chart-payments', 'stmt-chart-utilisation'].forEach(makeCanvas);
    renderStatementBalanceChart('stmt-chart-balance', TWO_STMTS);
    renderStatementInterestChart('stmt-chart-interest', TWO_STMTS);
    renderStatementPaymentChart('stmt-chart-payments', TWO_STMTS);
    renderStatementUtilisationChart('stmt-chart-utilisation', TWO_STMTS, 100000);

    // Should not throw
    expect(() => destroyStatementCharts()).not.toThrow();
    // Re-rendering after destroy should work (Chart called 4 more times = 8 total)
    renderStatementBalanceChart('stmt-chart-balance', TWO_STMTS);
    expect(Chart).toHaveBeenCalledTimes(5); // 4 initial + 1 re-render
  });
});
