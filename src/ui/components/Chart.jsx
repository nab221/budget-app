import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  Filler,
} from 'chart.js';

// Register only what the dashboard uses (bar + line) — keeps the bundle lean
// vs 'chart.js/auto'.
ChartJS.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  Filler
);

/**
 * Thin chart.js wrapper: owns the canvas lifecycle; callers pass plain
 * `type`/`data`/`options` built from `chartTokens()` (canvas can't read CSS
 * variables). The chart is recreated when config changes — at this app's data
 * sizes that is simpler and safe.
 *
 * Environments without a 2D canvas (jsdom tests) render nothing — panels
 * always pair a chart with an accessible table view, which is also the
 * required fallback for the palette's light-mode contrast WARN.
 */
export default function Chart({ type, data, options, height = 220, ariaLabel }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext?.('2d');
    if (!ctx) return undefined;
    const chart = new ChartJS(ctx, { type, data, options });
    return () => chart.destroy();
  }, [type, data, options]);

  return (
    <div className="chart" style={{ height }}>
      <canvas ref={canvasRef} role="img" aria-label={ariaLabel} />
    </div>
  );
}
