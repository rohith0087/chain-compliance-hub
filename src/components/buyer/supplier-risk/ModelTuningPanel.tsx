import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal, RefreshCw } from 'lucide-react';

interface Props {
  onRecalculate: () => void;
}

const factors = [
  { label: 'Trade/Tariff sensitivity', max: 20, default: 10 },
  { label: 'Recall history weighting', max: 20, default: 12 },
  { label: 'Regulatory actions weighting', max: 15, default: 8 },
  { label: 'Document completeness weighting', max: 15, default: 10 },
  { label: 'Geo concentration weighting', max: 10, default: 6 },
];

export function ModelTuningPanel({ onRecalculate }: Props) {
  const [useDefaults, setUseDefaults] = useState(true);
  const [values, setValues] = useState(factors.map(f => f.default));
  const [isRecalculating, setIsRecalculating] = useState(false);

  const handleRecalculate = () => {
    setIsRecalculating(true);
    setTimeout(() => {
      onRecalculate();
      setIsRecalculating(false);
    }, 1500);
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary" /> Risk Model Tuning
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Use default industry weights</span>
            <Switch checked={useDefaults} onCheckedChange={setUseDefaults} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!useDefaults && (
          <div className="space-y-4">
            {factors.map((f, i) => (
              <div key={f.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span>{f.label}</span>
                  <span className="font-medium text-xs text-muted-foreground">{values[i]}/{f.max}</span>
                </div>
                <Slider
                  value={[values[i]]}
                  max={f.max}
                  step={1}
                  onValueChange={([v]) => {
                    const next = [...values];
                    next[i] = v;
                    setValues(next);
                  }}
                />
              </div>
            ))}
            <Button onClick={handleRecalculate} disabled={isRecalculating} size="sm" className="w-full">
              {isRecalculating ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Recalculating…</> : 'Recalculate Score'}
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground italic">
          Weights influence model output; final score computed by ML model (not static rules).
        </p>
      </CardContent>
    </Card>
  );
}
