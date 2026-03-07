# Phase 7 Research: Rolling Overview - Daily Balance & Binned Bars

This research outlines the implementation strategy for a mixed-resolution chart in Chart.js, combining high-resolution daily lines with aggregated weekly/monthly bars.

## Standard Stack
- **Chart.js v4.x**: Core visualization engine.
- **date-fns**: Used for binning logic (Monday-anchored weeks, month starts).
- **Vanilla CSS**: Used for UI refinements (segmented control).

## Architecture Patterns

### 1. Mixed Resolution via Granular X-Axis (Repeat Strategy)
The most robust way to handle mixed resolution in Chart.js without external adapters is to use the **Granular X-Axis Labels** (Daily) as the base and **distribute** aggregated data across those labels.

- **The X-Axis Labels**: Always stay daily (`YYYY-MM-DD`).
- **The Line (Balance)**: Mapped 1:1 to daily labels.
- **The Bars (Income/Expenses)**: 
    - Aggregate daily values into bins (Weekly/Monthly).
    - **Distribute** the bin total to *every* day within that bin in a new dataset.
    - Set `barPercentage: 1.0` and `categoryPercentage: 1.0` to eliminate gaps between daily sub-bars.
    - Result: 7 daily bars of the same height touch perfectly to form a single "wide" weekly bar.

### 2. Dual-Scale Logic (Stacked X-Axis)
To ensure Income and Expenses bars stay aligned and don't overlap or leave gaps when distributed:
- Set `stacked: true` on the X-axis.
- Income = Positive values (renders above 0).
- Expenses = Negative values (renders below 0).
- This ensures that for any given day, both bars occupy the full width of the "day slot", forming solid blocks of color.

### 3. Forecasting Logic (Bin-Level Styling)
Styling must be consistent across an entire bin if it contains future data.
- **Forecast Check**: A bin is a forecast if its `end_date` is after `today`.
- **Scriptable Properties**: Use functions for `backgroundColor` and `borderColor` that check the `isForecast` status of the data point.
- **Custom Plugin**: Since `BarElement` doesn't natively support `borderDash`, a small Chart.js plugin can be used to apply `ctx.setLineDash` during the `afterDatasetsDraw` hook for forecast points.

## Don't Hand-Roll

### 1. Date Binning
Use `date-fns` exclusively:
- **Weekly**: `startOfWeek(date, { weekStartsOn: 1 })` for Monday anchoring.
- **Monthly**: `startOfMonth(date)`.
- **Forecast Boundary**: `isAfter(endOfBin, today)`.

### 2. Tick Filtering
Don't use `maxTicksLimit` for sparse labels; manually filter in `ticks.callback`:
- Weekly: Return label only if `getDay() === 1` (Monday).
- Monthly: Return label only if `getDate() === 1` (1st of month).

## Common Pitfalls

### 1. Tooltip Confusion
**Problem**: Hovering a weekly bar shows 7 identical values.
**Solution**: Custom tooltip callback must show both the **Daily Activity** (specific to the hovered day) and the **Bin Total**.
- Data structure: `data: binnedArray.map((val, i) => ({ y: val, daily: dailyArray[i] }))`
- Callback: `` `Total: ${val}, Daily: ${context.raw.daily}` ``

### 2. Bar Gaps
**Problem**: Default Chart.js settings leave small gaps between daily "segments" of a weekly bar.
**Solution**: Force `barPercentage: 1.0` and `categoryPercentage: 1.0` on the bar datasets.

### 3. Today Alignment
**Problem**: The "Today" line or segment might appear in the middle of a bar.
**Solution**: This is desired behavior for a daily line. The bars correctly show that the *current week* is partially actual and partially forecast.

## Code Examples

### 1. Mixed Resolution Data Mapping
```javascript
function mapToMixedResolution(dailyData, binning) {
  const { labels, income, expenses } = dailyData;
  const binnedIncome = new Array(labels.length);
  
  // 1. Group indices by bin (Weekly/Monthly)
  const bins = groupIndicesByBin(labels, binning); 
  
  // 2. Distribute totals
  for (const indices of Object.values(bins)) {
    const total = indices.reduce((sum, i) => sum + income[i], 0);
    const endOfBin = parseISO(labels[indices[indices.length - 1]]);
    const isForecast = isAfter(endOfBin, today);
    
    for (const i of indices) {
      binnedIncome[i] = { 
        y: total, 
        daily: income[i], 
        isForecast 
      };
    }
  }
  return binnedIncome;
}
```

### 2. Forecast Bar Border Plugin
```javascript
const barForecastPlugin = {
  id: 'barForecastPlugin',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((ds, i) => {
      if (ds.type !== 'bar') return;
      const meta = chart.getDatasetMeta(i);
      meta.data.forEach((bar, idx) => {
        if (ds.data[idx]?.isForecast) {
          ctx.save();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = ds.borderColor;
          ctx.strokeRect(bar.x - bar.width/2, bar.y, bar.width, bar.base - bar.y);
          ctx.restore();
        }
      });
    });
  }
};
```

## Strategy: Tooltips & Interaction
Use `interaction: { mode: 'index', intersect: false }`. This ensures that hovering anywhere on the chart vertical slices through all datasets (Balance Line, Income Bar, Expense Bar) and provides a unified view of that specific day's status within its period.
