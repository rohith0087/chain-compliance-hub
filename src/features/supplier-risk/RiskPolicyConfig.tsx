import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSupplierRiskFeature } from '@/hooks/useSupplierRiskFeature';
import { useBuyerRiskPolicy } from './useBuyerRiskPolicy';
import {
  RISK_DIMENSIONS,
  RISK_DIMENSION_LABELS,
  RISK_TEMPLATES,
  dimensionsSum,
  templateByKey,
  type RiskDimension,
} from './templates';

type Weights = Record<RiskDimension, number>;

const EMPTY_WEIGHTS = Object.fromEntries(RISK_DIMENSIONS.map((d) => [d, 0])) as Weights;

export function RiskPolicyConfig() {
  const { buyerId, policy, loading, saving, save } = useBuyerRiskPolicy();
  const { enabled, loading: flagLoading } = useSupplierRiskFeature(buyerId ?? undefined);

  const [industry, setIndustry] = useState('footwear');
  const [weights, setWeights] = useState<Weights>({ ...EMPTY_WEIGHTS });
  const [criticalTopics, setCriticalTopics] = useState('');
  const [isPublished, setIsPublished] = useState(false);

  // Seed the form from the saved policy, or the footwear template if none.
  useEffect(() => {
    if (policy) {
      setIndustry(policy.industry ?? 'footwear');
      setWeights({ ...EMPTY_WEIGHTS, ...policy.dimensions });
      setCriticalTopics((policy.critical_topics ?? []).join(', '));
      setIsPublished(policy.is_published);
    } else if (!loading) {
      const t = RISK_TEMPLATES[0];
      setIndustry(t.industry);
      setWeights({ ...t.dimensions });
      setCriticalTopics(t.critical_topics.join(', '));
    }
  }, [policy, loading]);

  const total = useMemo(() => dimensionsSum(weights), [weights]);
  const balanced = Math.abs(total - 1) < 0.001;

  const applyTemplate = (key: string) => {
    const t = templateByKey(key);
    if (!t) return;
    setIndustry(t.industry);
    setWeights({ ...t.dimensions });
    setCriticalTopics(t.critical_topics.join(', '));
  };

  const onSave = () => {
    void save({
      industry,
      dimensions: weights,
      critical_topics: criticalTopics
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      is_published: isPublished,
    });
  };

  if (loading || flagLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }
  if (!buyerId) {
    return <p className="text-sm text-muted-foreground">No buyer account found for this user.</p>;
  }
  if (!enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Supplier Risk</CardTitle>
          <CardDescription>
            This feature is not enabled for your organization yet.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Supplier risk policy</h1>
        <p className="text-sm text-muted-foreground">
          Set how external risk signals (sanctions, recalls, ESG, geopolitical…) are weighted for
          your suppliers. Start from an industry template and tune.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk policy</CardTitle>
          <CardDescription>Dimension weights should sum to ~1.0.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start from template</Label>
              <Select onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template…" />
                </SelectTrigger>
                <SelectContent>
                  {RISK_TEMPLATES.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Dimension weights</Label>
              <Badge variant={balanced ? 'secondary' : 'destructive'}>sum {total.toFixed(2)}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {RISK_DIMENSIONS.map((dim) => (
                <div key={dim} className="flex items-center justify-between gap-2">
                  <span className="text-sm">{RISK_DIMENSION_LABELS[dim]}</span>
                  <Input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={weights[dim]}
                    onChange={(e) =>
                      setWeights((w) => ({ ...w, [dim]: Number(e.target.value) }))
                    }
                    className="w-24"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="critical">Critical topics (comma-separated)</Label>
            <Input
              id="critical"
              value={criticalTopics}
              onChange={(e) => setCriticalTopics(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch id="published" checked={isPublished} onCheckedChange={setIsPublished} />
            <Label htmlFor="published">Published (used for scoring)</Label>
          </div>

          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save policy'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
