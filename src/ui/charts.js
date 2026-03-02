import {
  Chart,
  LineController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';

// Register only the components needed for the stacked area chart
Chart.register(
  LineController,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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
  // Extended palette for multiple debt lines
  debt: [
    '#0072B2', // Blue
    '#D55E00', // Vermilion
    '#009E73', // Bluish green
    '#CC79A7', // Reddish purple
    '#56B4E9', // Sky blue
    '#E69F00', // Orange
    '#F0E442', // Yellow
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
  const incomeData   = data.map(d => d.income);
  const fixedData    = data.map(d => d.fixed);
  const variableData = data.map(d => d.variable);

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          borderColor: OKABE_ITO.income,
          backgroundColor: OKABE_ITO.income + '33', // 20% opacity
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
          order: 3
        },
        {
          label: 'Fixed',
          data: fixedData,
          borderColor: OKABE_ITO.fixed,
          backgroundColor: OKABE_ITO.fixed + '55', // 33% opacity
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
          order: 2
        },
        {
          label: 'Variable',
          data: variableData,
          borderColor: OKABE_ITO.variable,
          backgroundColor: OKABE_ITO.variable + '77', // 47% opacity
          fill: true,
          tension: 0.3,
          pointRadius: 3,
          pointHoverRadius: 5,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
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
          stacked: true,
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
      maintainAspectRatio: true,
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
      maintainAspectRatio: true,
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
      maintainAspectRatio: true,
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
