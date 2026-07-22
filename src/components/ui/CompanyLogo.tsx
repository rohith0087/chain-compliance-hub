import React from 'react';

interface CompanyLogoProps {
  logoUrl?: string | null;
  companyName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fallbackIcon?: React.ReactNode;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
} as const;

const monogramTextClasses = {
  sm: 'text-[11px]',
  md: 'text-[15px]',
  lg: 'text-[19px]',
} as const;

/**
 * Initials from the company name -- "Logic Foods" -> "LF", "Test" -> "TE".
 * Skips legal-form noise so "Acme Foods Inc." reads AF, not AI.
 */
const STOPWORDS = new Set(['inc', 'inc.', 'llc', 'ltd', 'ltd.', 'co', 'co.', 'corp', 'corp.', 'gmbh', 'sa', 'bv', 'plc', 'the', 'and', '&']);

function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/[\s\-_]+/)
    .filter((w) => w && !STOPWORDS.has(w.toLowerCase()));
  if (words.length === 0) return name.slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Monogram fallback. This used to be a dashed-border box with a generic
 * `Building2` glyph -- identical for every company, and dashed borders read as
 * "placeholder / unfinished". Initials on a solid accent tint give each
 * supplier a distinct mark and match the brand system's mono-for-records rule.
 */
const Monogram: React.FC<{ companyName: string; size: keyof typeof sizeClasses; className?: string }> = ({
  companyName,
  size,
  className = '',
}) => (
  <div
    aria-hidden="true"
    className={`${sizeClasses[size]} flex shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary ring-1 ring-primary/15 ${className}`}
  >
    <span className={`font-mono font-semibold leading-none tracking-[0.02em] ${monogramTextClasses[size]}`}>
      {getInitials(companyName)}
    </span>
  </div>
);

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  logoUrl,
  companyName = 'Company',
  size = 'md',
  className = '',
  fallbackIcon,
}) => {
  // Track load failure in React rather than mutating the DOM by hand, so the
  // fallback is the same element in both paths.
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [logoUrl]);

  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={`${companyName} logo`}
        className={`${sizeClasses[size]} shrink-0 rounded-[10px] border border-border object-contain ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }

  if (fallbackIcon) {
    return (
      <div
        className={`${sizeClasses[size]} flex shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary ring-1 ring-primary/15 ${className}`}
      >
        {fallbackIcon}
      </div>
    );
  }

  return <Monogram companyName={companyName} size={size} className={className} />;
};
