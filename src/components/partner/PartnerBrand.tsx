interface PartnerBrandProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// TraceR2C Partner brand mark — reuses the admin logo but a violet "Partner"
// pill to visually distinguish the reseller portal from the platform-admin one.
export function PartnerBrand({ size = 'md', className = '' }: PartnerBrandProps) {
  const mark = size === 'lg' ? 'h-10 w-10' : size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  const word = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img src="/logo.png" alt="TraceR2C" className={`${mark} rounded-lg object-contain`}
        style={{ background: 'hsl(250 76% 96%)', padding: 2 }} />
      <div className="flex items-center gap-2">
        <span className={`${word} font-semibold tracking-tight`} style={{ color: 'hsl(var(--admin-text))' }}>
          TraceR2C
        </span>
        <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{ background: 'hsl(250 76% 60%)', color: 'white' }}>
          Partner
        </span>
      </div>
    </div>
  );
}
