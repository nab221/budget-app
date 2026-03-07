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
 * Plugin to draw dashed borders for forecast bars.
 */
const barForecastPlugin = {
  id: 'barForecast',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      if (dataset.type === 'bar') {
        const meta = chart.getDatasetMeta(datasetIndex);
        meta.data.forEach((bar, index) => {
          const raw = dataset.data[index];
          if (raw && typeof raw === 'object' && raw.isForecast) {
            ctx.save();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = dataset.borderColor;
            ctx.lineWidth = 1;
            const { x, y, base, width } = bar;
            ctx.strokeRect(x - width / 2, y, width, base - y);
            ctx.restore();
          }
        });
      }
    });
  }
};

Chart.register(barForecastPlugin);

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
