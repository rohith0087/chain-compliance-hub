import { useEffect, useRef, useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface TurnstileWidgetProps {
  siteKey: string;
  onSuccess: (token: string) => void;
  onExpire?: () => void;
  onError?: (error: string) => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact';
}

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        'expired-callback'?: () => void;
        'error-callback'?: (error: string) => void;
        theme?: 'light' | 'dark' | 'auto';
        size?: 'normal' | 'compact';
      }) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

export function TurnstileWidget({
  siteKey,
  onSuccess,
  onExpire,
  onError,
  theme = 'auto',
  size = 'normal',
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const scriptLoadedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetIdRef.current) {
      return;
    }

    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => {
          setIsLoading(false);
          onSuccess(token);
        },
        'expired-callback': onExpire,
        'error-callback': (error) => {
          setIsLoading(false);
          onError?.(error);
        },
        theme,
        size,
      });
      // Widget rendered, hide loading after a short delay
      setTimeout(() => setIsLoading(false), 500);
    } catch (error) {
      console.error('Error rendering Turnstile widget:', error);
      setIsLoading(false);
    }
  }, [siteKey, onSuccess, onExpire, onError, theme, size]);

  useEffect(() => {
    // Check if script is already loaded
    if (window.turnstile) {
      renderWidget();
      return;
    }

    // Check if script tag already exists
    const existingScript = document.querySelector('script[src*="turnstile"]');
    if (existingScript) {
      window.onTurnstileLoad = renderWidget;
      return;
    }

    // Load Turnstile script
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad';
    script.async = true;
    script.defer = true;

    window.onTurnstileLoad = () => {
      scriptLoadedRef.current = true;
      renderWidget();
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup widget on unmount
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (e) {
          // Ignore cleanup errors
        }
        widgetIdRef.current = null;
      }
    };
  }, [renderWidget]);

  // Reset function exposed via ref if needed
  const reset = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      setIsLoading(true);
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  return (
    <div className="relative min-h-[65px]">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30 rounded-lg">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <div 
        ref={containerRef} 
        className="flex justify-center [&>iframe]:rounded-lg [&>iframe]:shadow-sm [&>*]:!bg-transparent"
        data-reset={reset}
      />
    </div>
  );
}

// Hook to manage Turnstile state
export function useTurnstile() {
  const widgetRef = useRef<HTMLDivElement | null>(null);

  const reset = useCallback(() => {
    if (widgetRef.current) {
      const resetFn = widgetRef.current.dataset.reset;
      if (resetFn && window.turnstile) {
        // Find widget id and reset
        const widgetId = widgetRef.current.querySelector('[data-turnstile-widget-id]')?.getAttribute('data-turnstile-widget-id');
        if (widgetId) {
          window.turnstile.reset(widgetId);
        }
      }
    }
  }, []);

  return { widgetRef, reset };
}
