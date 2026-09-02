import { motion } from "framer-motion";

export type DonutSegment = { label: string; value: number; color: string };

/** Animated SVG donut. Pass a single percentage, or segments for a breakdown. */
export function Donut({
  value,
  color,
  size = 132,
  thickness = 12,
  label,
  sub,
  segments,
}: {
  value?: number;
  color?: string;
  size?: number;
  thickness?: number;
  label?: string;
  sub?: string;
  segments?: DonutSegment[];
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = segments?.reduce((a, s) => a + s.value, 0) ?? 0;

  let offset = 0;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={thickness}
          className="stroke-surface2"
        />
        {segments && total > 0
          ? segments.map((s) => {
              const frac = s.value / total;
              const dash = frac * c;
              const el = (
                <motion.circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeLinecap="butt"
                  initial={{ strokeDasharray: `0 ${c}` }}
                  animate={{ strokeDasharray: `${Math.max(0, dash - 2)} ${c}` }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  style={{ strokeDashoffset: -offset }}
                />
              );
              offset += dash;
              return el;
            })
          : (
              <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={color}
                strokeWidth={thickness}
                strokeLinecap="round"
                initial={{ strokeDasharray: `0 ${c}` }}
                animate={{
                  strokeDasharray: `${(Math.min(100, Math.max(0, value ?? 0)) / 100) * c} ${c}`,
                }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
              />
            )}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        {label && (
          <motion.span
            key={label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-xl font-semibold leading-none"
            style={{ color }}
          >
            {label}
          </motion.span>
        )}
        {sub && (
          <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-faint">
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}
