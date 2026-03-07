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
    colors = ['var(--bg-alt, #ebedf0)', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
    clear = true,
    allYearsData = null
  } = options;

  const yearNum = parseInt(year);

  // Clear container if requested
  if (clear) container.innerHTML = '';
  
  // Calculate Quartiles for Color Scaling
  const dataForScale = allYearsData || dailyData;
  const nonZeroTotals = Object.values(dataForScale)
    .map(d => typeof d === 'number' ? d : d.total) // Handle if data is just numbers or objects
    .filter(t => t > 0)
    .sort((a, b) => a - b);

  let q1 = 2000, q2 = 5000, q3 = 15000; // Defaults
  if (nonZeroTotals.length > 0) {
    q1 = nonZeroTotals[Math.floor(nonZeroTotals.length * 0.25)] || q1;
    q2 = nonZeroTotals[Math.floor(nonZeroTotals.length * 0.50)] || q2;
    q3 = nonZeroTotals[Math.floor(nonZeroTotals.length * 0.75)] || q3;
    
    // Ensure distinct values
    if (q1 <= 0) q1 = 1;
    if (q2 <= q1) q2 = q1 + 1;
    if (q3 <= q2) q3 = q2 + 1;
  }

  // Helper: Get color based on intensity (quartiles)
  const getColor = (amount) => {
    if (amount <= 0) return colors[0];
    if (amount <= q1) return colors[1];
    if (amount <= q2) return colors[2];
    if (amount <= q3) return colors[3];
    return colors[4];
  };

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
  canvas.style.display = 'block';
  canvas.style.margin = '0 auto';
  ctx.scale(dpr, dpr);
  
  container.appendChild(canvas);

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

  // --- INTERACTIVE TOOLTIPS ---
  
  let tooltip = document.querySelector('.heatmap-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'heatmap-tooltip';
    document.body.appendChild(tooltip);
  }

  const getCellAt = (mouseX, mouseY) => {
    const x = mouseX - labelWidth;
    const y = mouseY - labelHeight;
    
    if (x < 0 || y < 0) return null;
    
    const week = Math.floor(x / (cellSize + cellGap));
    const day = Math.floor(y / (cellSize + cellGap));
    
    if (week < 0 || week >= 54 || day < 0 || day >= 7) return null;
    
    // Check if within the actual cell (not in the gap)
    const cellX = week * (cellSize + cellGap);
    const cellY = day * (cellSize + cellGap);
    if (x < cellX || x > cellX + cellSize || y < cellY || y > cellY + cellSize) return null;

    const date = new Date(firstSunday);
    date.setDate(firstSunday.getDate() + (week * 7) + day);
    
    if (date.getFullYear() !== yearNum) return null;
    
    return date;
  };

  const showTooltip = (e, date, data) => {
    const { total, topCategory } = data;
    const dateStr = date.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const amountStr = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(total / 100);
    
    tooltip.innerHTML = `
      <div class="date">${dateStr}</div>
      <div class="amount">${amountStr}</div>
      ${topCategory ? `<div class="category">${topCategory}</div>` : ''}
    `;
    
    tooltip.style.display = 'block';
    
    // Position tooltip
    const x = e.clientX + 10;
    const y = e.clientY + 10;
    
    // Keep within viewport
    const tooltipRect = tooltip.getBoundingClientRect();
    let finalX = x;
    let finalY = y;

    if (finalX + tooltipRect.width > window.innerWidth) {
      finalX = e.clientX - tooltipRect.width - 10;
    }
    
    if (finalY + tooltipRect.height > window.innerHeight) {
      finalY = e.clientY - tooltipRect.height - 10;
    }

    tooltip.style.left = `${finalX}px`;
    tooltip.style.top = `${finalY}px`;
  };

  const hideTooltip = () => {
    tooltip.style.display = 'none';
  };

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const date = getCellAt(mouseX, mouseY);
    if (date) {
      const dateStr = date.toISOString().split('T')[0];
      const data = dailyData[dateStr] || { total: 0 };
      showTooltip(e, date, data);
      canvas.style.cursor = 'pointer';
    } else {
      hideTooltip();
      canvas.style.cursor = 'default';
    }
  });

  canvas.addEventListener('mouseleave', hideTooltip);
  
  // Touch support
  canvas.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const mouseX = touch.clientX - rect.left;
    const mouseY = touch.clientY - rect.top;
    
    const date = getCellAt(mouseX, mouseY);
    if (date) {
      e.preventDefault(); // Only prevent if we hit a cell
      const dateStr = date.toISOString().split('T')[0];
      const data = dailyData[dateStr] || { total: 0 };
      showTooltip(touch, date, data);
    } else {
      hideTooltip();
    }
  }, { passive: false });

  // Hide tooltip when scrolling
  window.addEventListener('scroll', hideTooltip, { passive: true });
}
