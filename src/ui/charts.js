import {
  Chart,
  LineController,
  BarController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';

// Register only the components needed for charts
Chart.register(
  LineController,
  BarController,
  DoughnutController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend
);

/**
 * Okabe-Ito color-blind safe palette.
 * Reference: https://jfly.uni-koeln.de/color/
 */
export const OKABE_ITO = {
  income:   '#0072B2', // Blue
  fixed:    '#D55E00', // Orange
  variable: '#F0E442', // Yellow
  // Extended palette for multiple debt lines or categories
  debt: [
    '#0072B2', // Blue
    '#D55E00', // Vermilion
    '#009E73', // Bluish green
    '#CC79A7', // Reddish purple
    '#56B4E9', // Sky blue
    '#E69F00', // Orange
    '#F0E442', // Yellow
    '#000000', // Black
  ],
  palette: [
    '#0072B2', // Blue
    '#D55E00', // Vermilion
    '#009E73', // Bluish green
    '#CC79A7', // Reddish purple
    '#56B4E9', // Sky blue
    '#E69F00', // Orange
    '#F0E442', // Yellow
    '#999999', // Grey
    '#000000', // Black
  ]
};

/** Track active chart instances so we can destroy before re-render. */
const _chartInstances = new Map();

/**
 * Format pence value as GBP string for tooltips.
 * @param {number} pence
 * @returns {string}
 */
function formatPence(pence) {
  return '£' + (pence / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Render (or re-render) a Doughnut chart showing spending breakdown by category.
 *
 * @param {string} canvasId - The id of the <canvas> element.
 * @param {Object} categorySpending - Map of category names to pence amounts.
 */
export function renderSpendingBreakdownChart(canvasId, categorySpending) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (_chartInstances.has(canvasId)) {
    _chartInstances.get(canvasId).destroy();
    _chartInstances.delete(canvasId);
  }

  const entries = Object.entries(categorySpending)
    .filter(([_, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);

  const labels = entries.map(([name, _]) => name);
  const data = entries.map(([_, value]) => value);
  const colors = entries.map((_, idx) => OKABE_ITO.palette[idx % OKABE_ITO.palette.length]);

  const chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: 'var(--card)',
        borderWidth: 2,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            font: { size: 10 },
            usePointStyle: true,
            boxWidth: 8,
            padding: 10
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((sum, v) => sum + v, 0);
              const percentage = ((ctx.parsed / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${formatPence(ctx.parsed)} (${percentage}%)`;
            }
          }
        }
      }
    }
  });

  _chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * Render (or re-render) a stacked area chart showing 12-month spending trends.
 *
 * @param {string} canvasId - The id of the <canvas> element to render into.
 * @param {Array<{month: string, income: number, fixed: number, variable: number}>} data
 *   Array of 12 monthly entries. Amounts are in pence.
 */
export function renderTrendsChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Destroy previous instance to avoid Chart.js "Canvas already in use" error
  if (_chartInstances.has(canvasId)) {
    _chartInstances.get(canvasId).destroy();
    _chartInstances.delete(canvasId);
  }

  const labels = data.map(d => d.month);
  const incomeData = data.map(d => d.income);
  const expenseData = data.map(d => (d.fixed || 0) + (d.variable || 0));

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          borderColor: OKABE_ITO.income,
          backgroundColor: OKABE_ITO.income + '33',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5
        },
        {
          label: 'Expenses',
          data: expenseData,
          borderColor: OKABE_ITO.fixed,
          backgroundColor: OKABE_ITO.fixed + '33',
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { size: 11 },
            usePointStyle: true,
            pointStyleWidth: 10
          }
        },
        tooltip: {
          position: 'nearest',
          callbacks: {
            label: (ctx) => {
              return ` ${ctx.dataset.label}: ${formatPence(ctx.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 } }
        },
        y: {
          beginAtZero: true,
          ticks: {
            font: { size: 10 },
            callback: (value) => formatPence(value)
          },
          grid: {
            color: 'rgba(148,163,184,0.15)'
          }
        }
      }
    }
  });

  _chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * Render (or re-render) a 90-day balance trend chart.
 * Actual months use solid lines; projected months use dashed lines.
 *
 * @param {string} canvasId - The id of the <canvas> element to render into.
 * @param {Array<{month: string, closingBalance: number, isProjection: boolean}>} snapshots
 *   Balance snapshots in chronological order. Amounts are in pence.
 */
export function renderBalanceChart(canvasId, snapshots) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Destroy previous instance to avoid Chart.js "Canvas already in use" error
  if (_chartInstances.has(canvasId)) {
    _chartInstances.get(canvasId).destroy();
    _chartInstances.delete(canvasId);
  }

  if (!snapshots || snapshots.length === 0) return;

  const labels = snapshots.map(s => s.month);
  const actualData = snapshots.map(s => s.isProjection ? null : s.closingBalance);
  const projectionData = snapshots.map((s, i) => {
    // Connect the projection line to the last actual data point
    if (s.isProjection) return s.closingBalance;
    if (i === snapshots.length - 1 || snapshots[i + 1]?.isProjection) return s.closingBalance;
    return null;
  });

  const balanceColor = '#0072B2'; // Okabe-Ito Blue

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Balance (Actual)',
          data: actualData,
          borderColor: balanceColor,
          backgroundColor: balanceColor + '22',
          fill: true,
          tension: 0.2,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2,
          spanGaps: false
        },
        {
          label: 'Balance (Forecast)',
          data: projectionData,
          borderColor: balanceColor,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.2,
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          borderDash: [6, 4],
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { size: 11 },
            usePointStyle: true,
            pointStyleWidth: 10
          }
        },
        tooltip: {
          position: 'nearest',
          callbacks: {
            label: (ctx) => {
              if (ctx.parsed.y === null) return null;
              return ` ${ctx.dataset.label}: ${formatPence(ctx.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 } }
        },
        y: {
          beginAtZero: false,
          ticks: {
            font: { size: 10 },
            callback: (value) => formatPence(value)
          },
          grid: {
            color: 'rgba(148,163,184,0.15)'
          }
        }
      }
    }
  });

  _chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * Render (or re-render) a line chart showing debt balance projections over time.
 *
 * Initial X-axis view is focused on the next 24 months for mobile readability.
 * The full timeline remains accessible via scrolling/panning if Chart.js zoom is added.
 *
 * @param {string} canvasId - The id of the <canvas> element to render into.
 * @param {Array<{name: string, balances: number[]}>} projectionData
 *   Array of debt series. Each entry has a `name` (debt name) and `balances`
 *   — an array of pence values per month (index 0 = month 1, etc.).
 */
export function renderDebtPayoffChart(canvasId, projectionData) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Destroy previous instance to avoid Chart.js "Canvas already in use" error
  if (_chartInstances.has(canvasId)) {
    _chartInstances.get(canvasId).destroy();
    _chartInstances.delete(canvasId);
  }

  if (!projectionData || projectionData.length === 0) return;

  // Determine the longest series to build labels
  const maxMonths = Math.max(...projectionData.map(d => d.balances.length));

  // Build labels: "Month 1", "Month 2", ... truncated to 24 for initial focus
  const INITIAL_MONTHS = 24;
  const displayMonths = Math.min(maxMonths, INITIAL_MONTHS);
  const labels = Array.from({ length: displayMonths }, (_, i) => `Mo ${i + 1}`);

  const datasets = projectionData.map((debt, idx) => {
    const color = OKABE_ITO.debt[idx % OKABE_ITO.debt.length];
    return {
      label: debt.name,
      data: debt.balances.slice(0, displayMonths),
      borderColor: color,
      backgroundColor: color + '22', // ~13% opacity fill
      fill: false,
      tension: 0.2,
      pointRadius: displayMonths <= 24 ? 3 : 0, // show dots only for shorter timelines
      pointHoverRadius: 5,
      borderWidth: 2
    };
  });

  const chart = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { size: 11 },
            usePointStyle: true,
            pointStyleWidth: 10
          }
        },
        tooltip: {
          position: 'nearest',
          callbacks: {
            label: (ctx) => {
              return ` ${ctx.dataset.label}: ${formatPence(ctx.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 } }
        },
        y: {
          beginAtZero: true,
          ticks: {
            font: { size: 10 },
            callback: (value) => formatPence(value)
          },
          grid: {
            color: 'rgba(148,163,184,0.15)'
          }
        }
      }
    }
  });

  _chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * Render (or re-render) the unified Rolling Financial Overview chart.
 * Shows history and forecast balance with mixed Line/Bar visualization.
 *
 * @param {string} canvasId - The id of the <canvas> element.
 * @param {Object} data - { labels, data: { balance, income, expenses }, todayIndex }
 */
export function renderRollingOverviewChart(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (_chartInstances.has(canvasId)) {
    _chartInstances.get(canvasId).destroy();
    _chartInstances.delete(canvasId);
  }

  const { labels, data: components, todayIndex } = data;
  const { balance, income, expenses } = components;

  const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
  const balanceColor = isDarkMode ? '#E2E8F0' : '#000000';
  const incomeColor = '#009E73';  // Bluish green (Better for income bars)
  const expenseColor = '#D55E00'; // Vermilion (Reddish)

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Account Balance',
          data: balance,
          borderColor: balanceColor,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.2,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2.5,
          segment: {
            borderDash: ctx => todayIndex !== -1 && ctx.p0DataIndex >= todayIndex ? [6, 4] : undefined,
          }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            font: { size: 10 },
            usePointStyle: true,
            boxWidth: 8
          }
        },
        tooltip: {
          position: 'nearest',
          callbacks: {
            label: (ctx) => {
              const isForecast = todayIndex !== -1 && ctx.dataIndex > todayIndex;
              const suffix = isForecast ? ' (Forecast)' : '';
              return ` ${ctx.dataset.label}${suffix}: ${formatPence(Math.abs(ctx.parsed.y))}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 10 },
            autoSkip: true,
            maxTicksLimit: 12,
            callback: function(val, index) {
              const label = this.getLabelForValue(val);
              const date = new Date(label);
              if (isNaN(date.getTime())) return label;

              const day = date.getDay();
              const dayOfMonth = date.getDate();

              if (dayOfMonth === 1 || day === 1) {
                return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
              }
              return null;
            }
          }
        },
        y: {
          position: 'left',
          beginAtZero: false,
          ticks: {
            font: { size: 10 },
            callback: (value) => formatPence(value)
          },
          grid: {
            color: 'rgba(148,163,184,0.15)'
          }
        }
      }
    }
  });

  _chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * Render (or re-render) a 90-day daily cash flow forecast chart.
 *
 * @param {string} canvasId - The id of the <canvas> element.
 * @param {Array} snapshots - Array of daily snapshots.
 */
export function renderCashFlowChart(canvasId, snapshots) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (_chartInstances.has(canvasId)) {
    _chartInstances.get(canvasId).destroy();
    _chartInstances.delete(canvasId);
  }

  if (!snapshots || snapshots.length === 0) return;

  const labels = snapshots.map(s => s.date);
  const data = snapshots.map(s => s.closingBalance);

  const primaryColor = '#0072B2'; // OKABE_ITO.income (Blue)
  const warnColor = '#D55E00';    // Vermilion

  const pointColors = data.map(val => val < 0 ? warnColor : primaryColor);

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Daily Balance',
        data: data,
        borderColor: primaryColor,
        backgroundColor: primaryColor + '11',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: pointColors,
        pointBorderColor: pointColors,
        pointRadius: (ctx) => (ctx.raw < 0 ? 4 : 0),
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` Balance: ${formatPence(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 10 },
            autoSkip: true,
            maxTicksLimit: 8,
            maxRotation: 0
          }
        },
        y: {
          beginAtZero: false,
          ticks: {
            font: { size: 10 },
            callback: (value) => formatPence(value)
          },
          grid: {
            color: (ctx) => (ctx.tick.value === 0 ? warnColor : 'rgba(148,163,184,0.15)'),
            lineWidth: (ctx) => (ctx.tick.value === 0 ? 2 : 1)
          }
        }
      }
    }
  });

  _chartInstances.set(canvasId, chart);
  return chart;
}

// ---------------------------------------------------------------------------
// Statement history charts — used by debtUI history modal
// ---------------------------------------------------------------------------

/**
 * Canvas IDs used by statement charts. Exported so debtUI can clean up.
 */
export const STMT_CHART_IDS = [
  'stmt-chart-balance',
  'stmt-chart-interest',
  'stmt-chart-payments',
  'stmt-chart-utilisation',
];

/**
 * Destroy all statement chart instances (call on modal close).
 */
export function destroyStatementCharts() {
  STMT_CHART_IDS.forEach(id => {
    if (_chartInstances.has(id)) {
      _chartInstances.get(id).destroy();
      _chartInstances.delete(id);
    }
  });
}

/**
 * Balance Over Time — line chart of closing balance (pence → pounds).
 * Only renders when statements.length >= 2.
 *
 * @param {string} canvasId
 * @param {Array} statements - sorted chronologically (oldest first)
 */
export function renderStatementBalanceChart(canvasId, statements) {
  if (!statements || statements.length < 2) return;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (_chartInstances.has(canvasId)) {
    _chartInstances.get(canvasId).destroy();
    _chartInstances.delete(canvasId);
  }

  const labels = statements.map(s => new Date(s.date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }));
  const data   = statements.map(s => s.amount / 100);

  const color = OKABE_ITO.debt[0]; // Blue

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Closing Balance',
        data,
        borderColor: color,
        backgroundColor: color + '22',
        fill: true,
        tension: 0.2,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` Balance: £${ctx.parsed.y.toFixed(2)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: {
          beginAtZero: false,
          ticks: { font: { size: 10 }, callback: v => `£${v.toFixed(0)}` },
          grid: { color: 'rgba(148,163,184,0.15)' }
        }
      }
    }
  });

  _chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * Cumulative Interest + Fees — line chart accumulating interest and fees over time.
 * Only renders when statements.length >= 2.
 *
 * @param {string} canvasId
 * @param {Array} statements - sorted chronologically (oldest first)
 */
export function renderStatementInterestChart(canvasId, statements) {
  if (!statements || statements.length < 2) return;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (_chartInstances.has(canvasId)) {
    _chartInstances.get(canvasId).destroy();
    _chartInstances.delete(canvasId);
  }

  const labels = statements.map(s => new Date(s.date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }));

  let cumulative = 0;
  const data = statements.map(s => {
    cumulative += ((s.interest || 0) + (s.fees || 0)) / 100;
    return cumulative;
  });

  const color = OKABE_ITO.debt[1]; // Vermilion

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Cumulative Interest & Fees',
        data,
        borderColor: color,
        backgroundColor: color + '22',
        fill: true,
        tension: 0.2,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` Cumulative: £${ctx.parsed.y.toFixed(2)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: {
          beginAtZero: true,
          ticks: { font: { size: 10 }, callback: v => `£${v.toFixed(0)}` },
          grid: { color: 'rgba(148,163,184,0.15)' }
        }
      }
    }
  });

  _chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * Payment Behaviour — grouped bar chart comparing min due vs actual payment.
 * Only renders when statements.length >= 2.
 *
 * @param {string} canvasId
 * @param {Array} statements - sorted chronologically (oldest first)
 */
export function renderStatementPaymentChart(canvasId, statements) {
  if (!statements || statements.length < 2) return;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (_chartInstances.has(canvasId)) {
    _chartInstances.get(canvasId).destroy();
    _chartInstances.delete(canvasId);
  }

  const labels   = statements.map(s => new Date(s.date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }));
  const minDue   = statements.map(s => (s.minimumPayment || 0) / 100);
  const actual   = statements.map(s => s.actualPaymentAmount ? s.actualPaymentAmount / 100 : 0);

  const chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Min Due',
          data: minDue,
          backgroundColor: OKABE_ITO.debt[0] + 'BB', // Blue
          borderColor: OKABE_ITO.debt[0],
          borderWidth: 1,
        },
        {
          label: 'Paid',
          data: actual,
          backgroundColor: OKABE_ITO.debt[2] + 'BB', // Bluish-green
          borderColor: OKABE_ITO.debt[2],
          borderWidth: 1,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 10 }, usePointStyle: true, boxWidth: 8 }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: £${ctx.parsed.y.toFixed(2)}`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: {
          beginAtZero: true,
          ticks: { font: { size: 10 }, callback: v => `£${v.toFixed(0)}` },
          grid: { color: 'rgba(148,163,184,0.15)' }
        }
      }
    }
  });

  _chartInstances.set(canvasId, chart);
  return chart;
}

/**
 * Credit Utilisation % — line chart showing balance/limit ratio over time.
 * Only renders when statements.length >= 2 AND creditLimit > 0.
 *
 * @param {string} canvasId
 * @param {Array} statements - sorted chronologically (oldest first)
 * @param {number} creditLimit - in pence
 */
export function renderStatementUtilisationChart(canvasId, statements, creditLimit) {
  if (!statements || statements.length < 2 || !creditLimit || creditLimit <= 0) return;
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (_chartInstances.has(canvasId)) {
    _chartInstances.get(canvasId).destroy();
    _chartInstances.delete(canvasId);
  }

  const labels = statements.map(s => new Date(s.date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }));
  const data   = statements.map(s => parseFloat(((s.amount / creditLimit) * 100).toFixed(1)));

  const color = OKABE_ITO.debt[3]; // Reddish-purple

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Utilisation %',
        data,
        borderColor: color,
        backgroundColor: color + '22',
        fill: true,
        tension: 0.2,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` Utilisation: ${ctx.parsed.y.toFixed(1)}%`
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: {
          beginAtZero: true,
          max: 100,
          ticks: { font: { size: 10 }, callback: v => `${v}%` },
          grid: { color: 'rgba(148,163,184,0.15)' }
        }
      }
    }
  });

  _chartInstances.set(canvasId, chart);
  return chart;
}
