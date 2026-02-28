import {
  Chart,
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
  variable: '#F0E442'  // Yellow
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
