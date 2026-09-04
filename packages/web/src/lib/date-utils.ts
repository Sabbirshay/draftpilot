/**
 * Dynamic Date Range Computation & Preset Engine for DraftPilot
 * Computes dynamic, current-date defaults relative to new Date() or a provided reference date.
 */

export interface DateRangeState {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;
  compareStartDate: string;
  compareEndDate: string;
  compareLabel: string;
  granularity: 'Hourly' | 'Daily' | 'Weekly' | 'Monthly';
}

export interface DatePreset {
  label: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  display: string;
  compStart: string; // YYYY-MM-DD
  compEnd: string;   // YYYY-MM-DD
  compDisplay: string;
  days: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_ABBRS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Format a Date object as YYYY-MM-DD using local calendar year, month, and day
 */
export function formatYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date object as "MMM DD" (e.g. "Aug 22")
 */
export function formatMonthDay(d: Date): string {
  return `${MONTH_ABBRS[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Parse a YYYY-MM-DD string into a local Date object (setting hours to 12:00 to avoid DST drift)
 */
export function parseYMD(str: string): Date {
  const [year, month, day] = str.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

/**
 * Calculates a matching previous duration comparison range
 */
export function calculateCustomComparison(
  startDateStr: string,
  endDateStr: string
): { compStart: string; compEnd: string; compLabel: string } {
  const start = parseYMD(startDateStr);
  const end = parseYMD(endDateStr);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

  const compEnd = new Date(start);
  compEnd.setDate(start.getDate() - 1);

  const compStart = new Date(compEnd);
  compStart.setDate(compEnd.getDate() - (diffDays - 1));

  const compDisplay = diffDays === 1
    ? formatMonthDay(compEnd)
    : `${formatMonthDay(compStart)} – ${formatMonthDay(compEnd)}`;

  return {
    compStart: formatYMD(compStart),
    compEnd: formatYMD(compEnd),
    compLabel: `Prev ${diffDays} day${diffDays > 1 ? 's' : ''}`,
  };
}

/**
 * Computes all dynamic presets relative to the reference date (defaults to new Date()).
 * Completely eliminates any hardcoded year or month strings.
 */
export function computeDatePresets(referenceDate?: Date): {
  presets: DatePreset[];
  initialRange: DateRangeState;
} {
  const ref = referenceDate ? new Date(referenceDate.getTime()) : new Date();
  // Anchor to noon to prevent DST boundary jump issues
  ref.setHours(12, 0, 0, 0);

  const currentYear = ref.getFullYear();
  const currentMonth = ref.getMonth();
  const curMonthName = MONTH_ABBRS[currentMonth];

  // 1. Today
  const todayStart = new Date(ref);
  const todayEnd = new Date(ref);
  const yesterday = new Date(ref);
  yesterday.setDate(ref.getDate() - 1);

  // 2. Last 7 Days (Today - 6 through Today = 7 days)
  const l7Start = new Date(ref);
  l7Start.setDate(ref.getDate() - 6);
  const l7CompEnd = new Date(l7Start);
  l7CompEnd.setDate(l7Start.getDate() - 1);
  const l7CompStart = new Date(l7CompEnd);
  l7CompStart.setDate(l7CompEnd.getDate() - 6);

  // 3. Last 30 Days (Today - 29 through Today = 30 days)
  const l30Start = new Date(ref);
  l30Start.setDate(ref.getDate() - 29);
  const l30CompEnd = new Date(l30Start);
  l30CompEnd.setDate(l30Start.getDate() - 1);
  const l30CompStart = new Date(l30CompEnd);
  l30CompStart.setDate(l30CompEnd.getDate() - 29);

  // 4. This Month (Full calendar month or MTD)
  const mtdStart = new Date(currentYear, currentMonth, 1, 12);
  const mtdEnd = new Date(currentYear, currentMonth + 1, 0, 12); // Last day of current month
  const prevMonthDate = new Date(currentYear, currentMonth - 1, 1, 12);
  const prevMonthName = MONTH_ABBRS[prevMonthDate.getMonth()];
  const prevMonthStart = new Date(currentYear, currentMonth - 1, 1, 12);
  const prevMonthEnd = new Date(currentYear, currentMonth, 0, 12); // Last day of prev month

  // 5. Last Month
  const twoMonthsAgoStart = new Date(currentYear, currentMonth - 2, 1, 12);
  const twoMonthsAgoEnd = new Date(currentYear, currentMonth - 1, 0, 12);

  // 6. Year to Date (YTD)
  const ytdStart = new Date(currentYear, 0, 1, 12);
  const ytdCompStart = new Date(currentYear - 1, 0, 1, 12);
  const ytdCompEnd = new Date(currentYear - 1, ref.getMonth(), ref.getDate(), 12);
  const diffYtdDays = Math.max(1, Math.round((ref.getTime() - ytdStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  const presets: DatePreset[] = [
    {
      label: 'Today',
      days: 1,
      startDate: formatYMD(todayStart),
      endDate: formatYMD(todayEnd),
      display: `${formatMonthDay(todayStart)}, ${todayStart.getFullYear()}`,
      compStart: formatYMD(yesterday),
      compEnd: formatYMD(yesterday),
      compDisplay: `${formatMonthDay(yesterday)}, ${yesterday.getFullYear()}`,
    },
    {
      label: 'Last 7 Days',
      days: 7,
      startDate: formatYMD(l7Start),
      endDate: formatYMD(todayEnd),
      display: `${formatMonthDay(l7Start)} – ${formatMonthDay(todayEnd)}`,
      compStart: formatYMD(l7CompStart),
      compEnd: formatYMD(l7CompEnd),
      compDisplay: `${formatMonthDay(l7CompStart)} – ${formatMonthDay(l7CompEnd)}`,
    },
    {
      label: 'Last 30 Days',
      days: 30,
      startDate: formatYMD(l30Start),
      endDate: formatYMD(todayEnd),
      display: `${formatMonthDay(l30Start)} – ${formatMonthDay(todayEnd)}`,
      compStart: formatYMD(l30CompStart),
      compEnd: formatYMD(l30CompEnd),
      compDisplay: `${formatMonthDay(l30CompStart)} – ${formatMonthDay(l30CompEnd)}`,
    },
    {
      label: `This Month (${curMonthName})`,
      days: mtdEnd.getDate(),
      startDate: formatYMD(mtdStart),
      endDate: formatYMD(mtdEnd),
      display: `${formatMonthDay(mtdStart)} – ${formatMonthDay(mtdEnd)}`,
      compStart: formatYMD(prevMonthStart),
      compEnd: formatYMD(prevMonthEnd),
      compDisplay: `${formatMonthDay(prevMonthStart)} – ${formatMonthDay(prevMonthEnd)}`,
    },
    {
      label: `Last Month (${prevMonthName})`,
      days: prevMonthEnd.getDate(),
      startDate: formatYMD(prevMonthStart),
      endDate: formatYMD(prevMonthEnd),
      display: `${formatMonthDay(prevMonthStart)} – ${formatMonthDay(prevMonthEnd)}`,
      compStart: formatYMD(twoMonthsAgoStart),
      compEnd: formatYMD(twoMonthsAgoEnd),
      compDisplay: `${formatMonthDay(twoMonthsAgoStart)} – ${formatMonthDay(twoMonthsAgoEnd)}`,
    },
    {
      label: 'Year to Date (YTD)',
      days: diffYtdDays,
      startDate: formatYMD(ytdStart),
      endDate: formatYMD(todayEnd),
      display: `${formatMonthDay(ytdStart)} – ${formatMonthDay(todayEnd)}`,
      compStart: formatYMD(ytdCompStart),
      compEnd: formatYMD(ytdCompEnd),
      compDisplay: `${formatMonthDay(ytdCompStart)} – ${formatMonthDay(ytdCompEnd)}, ${currentYear - 1}`,
    },
  ];

  // Default initial range uses "Last 30 Days" (index 2) or "This Month"
  const defaultPreset = presets[2]; // Last 30 Days
  const initialRange: DateRangeState = {
    startDate: defaultPreset.startDate,
    endDate: defaultPreset.endDate,
    label: defaultPreset.display,
    compareStartDate: defaultPreset.compStart,
    compareEndDate: defaultPreset.compEnd,
    compareLabel: defaultPreset.compDisplay,
    granularity: 'Daily',
  };

  return { presets, initialRange };
}

/**
 * Returns a dynamically computed initial DateRangeState for the dashboard
 */
export function getInitialDateRange(referenceDate?: Date): DateRangeState {
  return computeDatePresets(referenceDate).initialRange;
}
