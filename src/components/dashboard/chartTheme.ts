/**
 * Shared Recharts styling for the buyer dashboard.
 *
 * The old dashboard styled every chart inline with hardcoded hex (#10b981,
 * #f59e0b, #64748b), which is why it read as a multi-colored "analytics toy"
 * and why it survived the brand retheme unchanged. The rule here follows the
 * brand system: ONE accent, expressed as shades. A second hue is only allowed
 * when it carries meaning (overdue, expiring) -- never for decoration.
 */

/** Accent ramp, darkest -> lightest. Use in series order. */
export const SERIES = {
  accent: 'hsl(var(--chart-1))',
  accentMid: 'hsl(var(--chart-2))',
  accentSoft: 'hsl(var(--primary) / 0.45)',
  neutral: 'hsl(var(--chart-5))',
} as const;

/** Semantic colors -- only where the color IS the information. */
export const SEMANTIC = {
  warn: 'hsl(var(--warning))',
  danger: 'hsl(var(--danger))',
  ok: 'hsl(var(--success))',
} as const;

export const AXIS_TICK = {
  fontSize: 10,
  fill: 'hsl(var(--muted-foreground))',
  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
} as const;

/** Spread onto <XAxis>/<YAxis>: hairline, no chrome. */
export const axisProps = {
  tick: AXIS_TICK,
  axisLine: false,
  tickLine: false,
} as const;

/** Spread onto <CartesianGrid>: horizontal hairlines only. */
export const gridProps = {
  stroke: 'hsl(var(--border))',
  strokeDasharray: '2 4',
  vertical: false,
} as const;

/** Spread onto <Tooltip>. */
export const tooltipProps = {
  cursor: { stroke: 'hsl(var(--border))', fill: 'hsl(var(--muted) / 0.6)' },
  contentStyle: {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    color: 'hsl(var(--foreground))',
    borderRadius: 12,
    fontSize: 12,
    boxShadow: '0 8px 24px -12px hsl(199 40% 12% / 0.25)',
    padding: '8px 10px',
  },
  labelStyle: {
    color: 'hsl(var(--muted-foreground))',
    fontSize: 11,
    marginBottom: 4,
  },
  // Recharts defaults each tooltip entry's text to its series fill -- dark
  // series (chart-5 neutral, accentSoft) become unreadable on the dark card.
  // Pin entry text to the foreground token so hover readouts stay legible.
  itemStyle: {
    color: 'hsl(var(--foreground))',
    fontSize: 12,
  },
} as const;

/** Top-rounded bar corners, matching the card radius language. */
export const BAR_RADIUS: [number, number, number, number] = [5, 5, 0, 0];
