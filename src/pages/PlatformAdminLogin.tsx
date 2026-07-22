import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Lock } from 'lucide-react';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { TurnstileWidget } from '@/components/auth/TurnstileWidget';
import { AdminBrand } from '@/components/platform-admin/AdminBrand';
import { AdminCard } from '@/components/platform-admin/ui';

const isTurnstileEnabled = import.meta.env.VITE_TURNSTILE_ENABLED === 'true';

export default function PlatformAdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const navigate = useNavigate();
  const { signInPlatformAdmin } = usePlatformAdmin();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await signInPlatformAdmin(email, password, turnstileToken || undefined);

    if (error) {
      setError(error.message);
      setLoading(false);
      setTurnstileToken(null);
      return;
    }
    navigate('/platform-admin/dashboard');
  };

  const isSubmitDisabled = loading || (isTurnstileEnabled && !turnstileToken);

  return (
    <div className="admin-portal flex min-h-screen items-center justify-center p-4"
      style={{ background: 'hsl(var(--admin-background))' }}>
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <AdminBrand size="lg" />
          <p className="mt-3 text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
            Secure access for platform administrators
          </p>
        </div>

        <AdminCard>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" style={{ color: 'hsl(var(--admin-text))' }}>Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@tracer2c.com" required disabled={loading}
                style={{ background: 'hsl(var(--admin-card))', borderColor: 'hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" style={{ color: 'hsl(var(--admin-text))' }}>Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required disabled={loading}
                style={{ background: 'hsl(var(--admin-card))', borderColor: 'hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }} />
            </div>

            {isTurnstileEnabled && (
              <div className="flex justify-center">
                <TurnstileWidget
                  siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || ''}
                  onSuccess={setTurnstileToken}
                  onError={() => setTurnstileToken(null)}
                  onExpire={() => setTurnstileToken(null)}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitDisabled}
              style={{ background: 'hsl(var(--admin-accent-blue))', color: 'white' }}>
              {loading ? 'Authenticating…' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-1.5 text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>
            <Lock className="h-3 w-3" />
            <span>Access is restricted and audited.</span>
          </div>
        </AdminCard>

        <div className="mt-6 text-center">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} style={{ color: 'hsl(var(--admin-text-muted))' }}>
            ← Back to main site
          </Button>
        </div>
      </div>
    </div>
  );
}
