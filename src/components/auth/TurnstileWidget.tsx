import { forwardRef, useEffect, useImperativeHandle, useRef, useCallback, useState } from 'react';
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

export const TurnstileWidget = forwardRef<{ reset: () => void }, TurnstileWidgetProps>(function TurnstileWidget({
  siteKey,
  onSuccess,
  onExpire,
  onError,
  theme = 'auto',
  size = 'normal',
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const callbacks = useRef({ onSuccess, onExpire, onError });
  useEffect(() => { callbacks.current = { onSuccess, onExpire, onError }; }, [onSuccess, onExpire, onError]);

  const reportError = useCallback((code: string) => {
    setIsLoading(false);
    setError(code === '110200'
      ? 'Security verification is not configured for this address. Contact your administrator.'
      : `Security verification could not load (${code}). Retry, or open this page in Chrome or Edge.`);
    callbacks.current.onError?.(code);
  }, []);

  const renderWidget = useCallback(() => {
    if (!containerRef.current || !window.turnstile || widgetIdRef.current) {
      return;
    }

    try {
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token) => {
          setIsLoading(false);
          setError(null);
          callbacks.current.onSuccess(token);
        },
        'expired-callback': () => callbacks.current.onExpire?.(),
        'error-callback': reportError,
        theme,
        size,
      });
      setIsLoading(false);
    } catch (error) {
      console.error('Error rendering Turnstile widget:', error);
      reportError('render-failed');
    }
  }, [siteKey, reportError, theme, size]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    let script = document.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com/turnstile/v0/api.js"]');
    if (script?.dataset.failed === 'true') {
      script.remove();
      script = null;
    }
    const needsScript = !script && !window.turnstile;
    if (needsScript) {
      script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
    }
    const onLoadError = () => {
      if (script) script.dataset.failed = 'true';
      reportError('network-error');
    };
    script?.addEventListener('load', renderWidget);
    script?.addEventListener('error', onLoadError);
    if (window.turnstile) renderWidget();
    else if (needsScript && script) document.head.appendChild(script);
    const timeout = window.setTimeout(() => {
      if (!widgetIdRef.current) reportError('load-timeout');
    }, 15000);

    return () => {
      window.clearTimeout(timeout);
      script?.removeEventListener('load', renderWidget);
      script?.removeEventListener('error', onLoadError);
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
  }, [renderWidget, reportError, attempt]);

  // Reset function exposed via ref if needed
  const reset = useCallback(() => {
    callbacks.current.onExpire?.();
    setAttempt((value) => value + 1);
  }, []);
  useImperativeHandle(ref, () => ({ reset }), [reset]);

  return (
    <div className="relative min-h-[65px] space-y-2">
      {isLoading && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          Loading security verification…
        </div>
      )}
      <div 
        ref={containerRef} 
        className="flex justify-center [&>iframe]:rounded-lg [&>iframe]:shadow-sm [&>*]:!bg-transparent"
      />
      {error && (
        <div role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-muted-foreground">
          <p>{error}</p>
          <button type="button" onClick={reset} className="mt-2 font-medium text-foreground underline">Retry verification</button>
        </div>
      )}
    </div>
  );
});

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
