/**
 * Renders a spending heatmap for a specific year on a canvas.
 * 
 * @param {string} containerId - ID of the container element
 * @param {number|string} year - The year to display
 * @param {Object} dailyData - Map of date (YYYY-MM-DD) to {total, topCategory, topCategoryAmount}
 * @param {Object} options - Rendering options (colors, cellSize, gap)
 */
export function renderSpendingHeatmap(containerId, year, dailyData, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const {
    cellSize = 12,
    cellGap = 3,
    labelHeight = 25,
    labelWidth = 35,
    colors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']
  } = options;

  const yearNum = parseInt(year);

  // Clear container and create canvas
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  // Calculate dimensions: 53 weeks (approx) + labels
  const width = labelWidth + (53 * (cellSize + cellGap));
  const height = labelHeight + (7 * (cellSize + cellGap));
  
  // Handle HiDPI
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(dpr, dpr);
  
  container.appendChild(canvas);

  // Helper: Get color based on intensity (in pence)
  const getColor = (amount) => {
    if (amount <= 0) return colors[0];
    if (amount < 2000) return colors[1]; // < £20
    if (amount < 5000) return colors[2]; // < £50
    if (amount < 15000) return colors[3]; // < £150
    return colors[4];
  };

  // Draw Day Labels (Mon, Wed, Fri)
  ctx.font = '10px sans-serif';
  ctx.fillStyle = 'var(--text-dim, #666)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  [1, 3, 5].forEach(i => {
    ctx.fillText(days[i], labelWidth - 8, labelHeight + i * (cellSize + cellGap) + cellSize / 2);
  });

  // Draw Months Labels
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Start drawing cells
  const startDate = new Date(yearNum, 0, 1);
  const startDay = startDate.getDay(); // 0 = Sun
  
  // Move to the first Sunday on or before Jan 1st
  const firstSunday = new Date(startDate);
  firstSunday.setDate(startDate.getDate() - startDay);

  let currentMonth = -1;

  for (let week = 0; week < 54; week++) {
    for (let day = 0; day < 7; day++) {
      const date = new Date(firstSunday);
      date.setDate(firstSunday.getDate() + (week * 7) + day);
      
      // Skip days from prev/next year
      if (date.getFullYear() < yearNum) continue;
      if (date.getFullYear() > yearNum) break;

      // Draw Month Label if it changes and we are at the top row or it's a fresh start
      if (date.getDate() <= 7 && date.getMonth() !== currentMonth) {
        currentMonth = date.getMonth();
        ctx.fillText(monthNames[currentMonth], labelWidth + week * (cellSize + cellGap), labelHeight - 8);
      }

      // Get data for this date
      const dateStr = date.toISOString().split('T')[0];
      const data = dailyData[dateStr] || { total: 0 };
      
      // Draw Cell
      const x = labelWidth + week * (cellSize + cellGap);
      const y = labelHeight + day * (cellSize + cellGap);
      
      ctx.fillStyle = getColor(data.total);
      
      // Rect with slight radius
      const radius = 2;
      ctx.beginPath();
      ctx.roundRect(x, y, cellSize, cellSize, radius);
      ctx.fill();
    }
  }
}
