import React from 'react';
import { Building2 } from 'lucide-react';

interface CompanyLogoProps {
  logoUrl?: string | null;
  companyName?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  fallbackIcon?: React.ReactNode;
}

export const CompanyLogo: React.FC<CompanyLogoProps> = ({
  logoUrl,
  companyName = 'Company',
  size = 'md',
  className = '',
  fallbackIcon
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16'
  };

  const iconSizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${companyName} logo`}
        className={`${sizeClasses[size]} object-contain rounded border ${className}`}
        onError={(e) => {
          // Fallback to icon if image fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const parent = target.parentElement;
          if (parent) {
            const fallback = document.createElement('div');
            fallback.className = `${sizeClasses[size]} flex items-center justify-center rounded border border-dashed border-muted-foreground/25 bg-muted/50`;
            fallback.innerHTML = `<svg class="${iconSizeClasses[size]} text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>`;
            parent.appendChild(fallback);
          }
        }}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} flex items-center justify-center rounded border border-dashed border-muted-foreground/25 bg-muted/50 ${className}`}>
      {fallbackIcon || <Building2 className={`${iconSizeClasses[size]} text-muted-foreground`} />}
    </div>
  );
};