/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, KeyRound, Loader2, Sparkles, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Provider = 'openai' | 'anthropic' | 'xai';

interface AiIntegrationSectionProps {
  organizationId: string;
}

const PROVIDERS: Record<Provider, { name: string; models: string[]; keyHint: string }> = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1', 'o4-mini'],
    keyHint: 'sk-…',
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    models: ['claude-haiku-4-5', 'claude-sonnet-5', 'claude-opus-4-8'],
    keyHint: 'sk-ant-…',
  },
  xai: {
    name: 'xAI (Grok)',
    models: ['grok-3', 'grok-4', 'grok-2'],
    keyHint: 'xai-…',
  },
};

export function AiIntegrationSection({ organizationId }: AiIntegrationSectionProps) {
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<Provider>('openai');
  const [model, setModel] = useState('gpt-4o-mini');
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [hasOwnKey, setHasOwnKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [platformKeys, setPlatformKeys] = useState<Record<Provider, boolean>>({ openai: false, anthropic: false, xai: false });

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, keysRes] = await Promise.all([
      (supabase as any).from('organization_ai_settings')
        .select('provider, model, use_own_key, has_own_key').eq('buyer_id', organizationId).maybeSingle(),
      supabase.functions.invoke('ai-platform-keys-v1', { body: {} }),
    ]);
    if (data) {
      setProvider(data.provider);
      setModel(data.model);
      setUseOwnKey(data.use_own_key);
      setHasOwnKey(data.has_own_key);
    }
    if (keysRes?.data) setPlatformKeys(keysRes.data as Record<Provider, boolean>);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  // Keep model valid for the chosen provider.
  const onProviderChange = (next: Provider) => {
    setProvider(next);
    if (!PROVIDERS[next].models.includes(model)) setModel(PROVIDERS[next].models[0]);
    if (!platformKeys[next]) setUseOwnKey(true);
    setTestResult(null);
  };

  const save = async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const body: Record<string, unknown> = {
        p_buyer_id: organizationId,
        p_provider: provider,
        p_model: model,
        p_use_own_key: useOwnKey,
      };
      // Only send the key when the user typed one (null = leave untouched).
      if (apiKey.trim().length > 0) body.p_api_key = apiKey.trim();
      const { error } = await (supabase as any).rpc('set_org_ai_settings_v1', body);
      if (error) throw error;
      setApiKey('');
      toast.success('AI settings saved');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save AI settings');
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-ai-config-v1', {
        body: { buyer_id: organizationId },
      });
      if (error) throw error;
      const res = data as { ok: boolean; error?: string; provider?: string; model?: string; sample?: string };
      setTestResult({
        ok: res.ok,
        text: res.ok ? `Connected to ${res.provider} · ${res.model}` : (res.error ?? 'Test failed'),
      });
    } catch (e) {
      setTestResult({ ok: false, text: e instanceof Error ? e.message : 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const meta = PROVIDERS[provider];
  const platformAvailable = platformKeys[provider];

  return (
    <div className="space-y-2">
      <p className="text-micro font-semibold uppercase tracking-wide text-muted-foreground/70">Artificial Intelligence</p>
      <div className="rounded-[12px] border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-background">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-body font-semibold">AI provider</p>
            <p className="text-caption text-muted-foreground">
              Powers mapping analysis, requirement extraction, and the compliance assistant. Use our key or bring your own.
            </p>

            {loading ? (
              <div className="py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground/70" /></div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-caption">Provider</Label>
                    <Select value={provider} onValueChange={(v) => onProviderChange(v as Provider)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PROVIDERS) as Provider[]).map((p) => (
                          <SelectItem key={p} value={p}>{PROVIDERS[p].name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-caption">Model</Label>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {meta.models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-caption">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      checked={!useOwnKey}
                      disabled={!platformAvailable}
                      onChange={() => setUseOwnKey(false)}
                    />
                    <span className={platformAvailable ? '' : 'text-muted-foreground/60'}>
                      Use our key {platformAvailable ? '' : '(not available for this provider yet)'}
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="radio" checked={useOwnKey} onChange={() => setUseOwnKey(true)} />
                    <span>Bring your own key</span>
                  </label>
                </div>

                {useOwnKey && (
                  <div>
                    <Label className="flex items-center gap-1 text-caption">
                      <KeyRound className="h-3 w-3" /> API key
                      {hasOwnKey && <span className="ml-1 text-success">· a key is saved</span>}
                    </Label>
                    <Input
                      type="password"
                      placeholder={hasOwnKey ? '•••••••• (leave blank to keep current)' : meta.keyHint}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      autoComplete="off"
                    />
                    <p className="mt-1 text-micro text-muted-foreground">
                      Stored encrypted in our vault — never shown again after saving, never sent to the browser.
                    </p>
                  </div>
                )}

                {testResult && (
                  <div className={`flex items-center gap-2 text-caption ${testResult.ok ? 'text-success' : 'text-danger'}`}>
                    {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {testResult.text}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void save()} disabled={saving}>
                    {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void test()} disabled={testing}>
                    {testing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Test connection
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
