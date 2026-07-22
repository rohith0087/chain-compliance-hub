interface AdminBrandProps {
  /** sm = sidebar, md = default, lg = login hero */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// TraceR2C Admin brand mark: monogram (public/logo.png) + wordmark + "Admin" pill.
// Used in the platform-admin sidebar header and the login hero.
export function AdminBrand({ size = 'md', className = '' }: AdminBrandProps) {
  const mark = size === 'lg' ? 'h-10 w-10' : size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  const word = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/logo.png"
        alt="TraceR2C"
        className={`${mark} rounded-lg object-contain`}
        style={{ background: 'hsl(var(--admin-accent-weak))', padding: 2 }}
      />
      <div className="flex items-center gap-2">
        <span className={`${word} font-semibold tracking-tight`} style={{ color: 'hsl(var(--admin-text))' }}>
          TraceR2C
        </span>
        <span
          className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            background: 'hsl(var(--admin-accent-blue))',
            color: 'white',
          }}
        >
          Admin
        </span>
      </div>
    </div>
  );
}
