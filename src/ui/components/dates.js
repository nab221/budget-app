import { format, parseISO } from 'date-fns';

/** 'yyyy-MM-dd' → a friendly '15 Jul 2026' for display. */
export function formatDay(iso) {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'd MMM yyyy');
  } catch {
    return iso;
  }
}

/** 'yyyy-MM-dd' → 'July 2026'. */
export function formatMonth(iso) {
  if (!iso) return '—';
  try {
    return format(parseISO(iso), 'MMMM yyyy');
  } catch {
    return iso;
  }
}

/** 'yyyy-MM' (a pay month) → a compact 'Jul 2026'. */
export function formatPayMonth(yyyyMM) {
  if (!yyyyMM) return '—';
  try {
    return format(parseISO(`${yyyyMM}-01`), 'MMM yyyy');
  } catch {
    return yyyyMM;
  }
}
