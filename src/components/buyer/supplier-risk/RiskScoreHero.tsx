import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, LineChart, Line, ResponsiveContainer } from 'recharts';
import { ChevronDown, ChevronUp, Cpu, TrendingUp, TrendingDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SupplierRiskProfile } from './riskData';
import { motion } from 'framer-motion';

interface Props {
  supplier: SupplierRiskProfile;
  animatedScore: number;
}

const scoreColor = (level: string) => {
  if (level === 'High') return 'hsl(0, 72%, 51%)';
  if (level === 'Medium') return 'hsl(38, 92%, 50%)';
  return 'hsl(142, 71%, 45%)';
};

const scoreBg = (level: string) => {
  if (level === 'High') return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
  if (level === 'Medium') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
};

export function RiskScoreHero({ supplier, animatedScore }: Props) {
  const [explainOpen, setExplainOpen] = useState(false);

  const donutData = [
    { name: 'Score', value: animatedScore },
    { name: 'Remaining', value: 100 - animatedScore },
  ];

  const trendData = supplier.trendData.map((v, i) => ({ day: i + 1, score: v }));
  const color = scoreColor(supplier.scoreLevel);
  const TrendIcon = supplier.trend > 0 ? TrendingUp : TrendingDown;

  return (
    <Card className="border-border/50 shadow-sm">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Donut */}
          <div className="flex-shrink-0 flex flex-col items-center gap-2">
            <div className="relative w-[140px] h-[140px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={donutData}
                    innerRadius={48}
                    outerRadius={65}
                    startAngle={90}
                    endAngle={-270}
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell fill={color} />
                    <Cell fill="hsl(var(--muted))" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                  key={animatedScore}
                  className="text-3xl font-bold"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                >
                  {animatedScore}
                </motion.span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
            </div>
            <Badge className={`${scoreBg(supplier.scoreLevel)} border-0 font-semibold`}>
              {supplier.scoreLevel} Risk
            </Badge>
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm">
                <TrendIcon className={`h-4 w-4 ${supplier.trend > 0 ? 'text-red-500' : 'text-green-500'}`} />
                <span className={supplier.trend > 0 ? 'text-red-600' : 'text-green-600'}>
                  {supplier.trend > 0 ? '+' : ''}{supplier.trend} pts
                </span>
                <span className="text-muted-foreground">last 7 days</span>
              </div>
              <div className="w-[100px] h-[32px]">
                <ResponsiveContainer>
                  <LineChart data={trendData}>
                    <Line type="monotone" dataKey="score" stroke={color} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Breakdown chips */}
            <div className="flex flex-wrap gap-2">
              {supplier.breakdown.map((b) => (
                <Badge key={b.label} variant="outline" className="text-xs font-normal gap-1">
                  {b.label}: <span className="font-semibold">{b.value}</span>
                </Badge>
              ))}
            </div>

            {/* Model label + Industry */}
            <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Cpu className="h-3 w-3" /> ML model + industry tuned factors</span>
              <Badge variant="secondary" className="text-xs">
                {supplier.industry} ({supplier.industryDetail})
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground italic">Factors and thresholds vary by industry — no one-size-fits-all.</p>

            {/* Explain score */}
            <Collapsible open={explainOpen} onOpenChange={setExplainOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium text-primary hover:underline cursor-pointer">
                Explain score {explainOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <ul className="space-y-1 text-sm text-muted-foreground list-disc ml-4">
                  {supplier.scoreExplanation.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
