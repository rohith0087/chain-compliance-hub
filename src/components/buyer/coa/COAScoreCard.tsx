import { useMemo } from 'react';

interface COAScoreCardProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export function COAScoreCard({ score, size = 80, strokeWidth = 6, label }: COAScoreCardProps) {
  const { color, bgColor } = useMemo(() => {
    if (score >= 80) return { color: 'hsl(var(--chart-2))', bgColor: 'hsl(var(--chart-2) / 0.1)' };
    if (score >= 50) return { color: 'hsl(var(--chart-4))', bgColor: 'hsl(var(--chart-4) / 0.1)' };
    return { color: 'hsl(var(--destructive))', bgColor: 'hsl(var(--destructive) / 0.1)' };
  }, [score]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold" style={{ color }}>{score}</span>
        </div>
      </div>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}
