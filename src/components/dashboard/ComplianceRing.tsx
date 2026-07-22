import { motion } from 'framer-motion';
import { AnimatedNumber } from './AnimatedNumber';
import { cn } from '@/lib/utils';

interface ComplianceRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  subtitle?: string;
  showLabel?: boolean;
}

export function ComplianceRing({ score, size = 140, strokeWidth = 10, label, subtitle, showLabel = true }: ComplianceRingProps) {

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const getColor = (score: number) => {
    if (score >= 80) return 'stroke-green-500';
    if (score >= 60) return 'stroke-amber-500';
    return 'stroke-[hsl(var(--danger))]';
  };

  const getGlowColor = (score: number) => {
    if (score >= 80) return 'drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]';
    if (score >= 60) return 'drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]';
    return 'drop-shadow-[0_0_8px_rgba(244,123,116,0.5)]';
  };

  const ring = (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg 
        className={cn('-rotate-90', getGlowColor(score))} 
        width={size} 
        height={size}
      >
        {/* Background circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          className="stroke-muted"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Animated progress circle */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          className={cn(getColor(score))}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - (circumference * score / 100) }}
          transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      {/* Center text */}
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatedNumber 
            value={score} 
            suffix="%" 
            className={cn(
              "font-bold text-foreground",
              size <= 80 ? "text-lg" : size <= 120 ? "text-2xl" : "text-3xl"
            )}
          />
          {size > 80 && !label && (
            <span className="text-xs text-muted-foreground">Completed</span>
          )}
        </div>
      )}

    </div>
  );

  if (label) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex flex-col text-right">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          {subtitle && (
            <span className="text-micro text-muted-foreground/70 mt-0.5">{subtitle}</span>
          )}
        </div>
        {ring}
      </div>
    );
  }

  return ring;
}

