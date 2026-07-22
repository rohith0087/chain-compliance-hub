import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard, LayoutGrid, ListChecks, Activity, Check } from 'lucide-react';
import { useBuyerDashboardView, type BuyerDashboardView } from '@/hooks/useBuyerDashboardView';

type View = BuyerDashboardView;

export function DashboardViewPreference() {
  const { view, setView } = useBuyerDashboardView();

  const update = (next: View) => {
    void setView(next);
  };

  const options: { id: View; label: string; desc: string; icon: typeof LayoutDashboard }[] = [
    {
      id: 'overview',
      label: 'Overview',
      desc: 'Sleek summary with charts, KPIs, and AI insights.',
      icon: LayoutDashboard,
    },
    {
      id: 'detailed',
      label: 'Detailed',
      desc: 'Full operational dashboard with all panels.',
      icon: LayoutGrid,
    },
    {
      id: 'focus',
      label: 'Focus',
      desc: 'Daily triage — a ranked list of what to do first.',
      icon: ListChecks,
    },
    {
      id: 'pulse',
      label: 'Pulse',
      desc: 'Compliance trends, graphs, and metrics.',
      icon: Activity,
    },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-4">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <LayoutDashboard className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-base">Dashboard View</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose how your buyer dashboard is rendered.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {options.map((opt) => {
            const Icon = opt.icon;
            const active = view === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => update(opt.id)}
                className={`relative text-left rounded-xl border p-4 transition-all ${
                  active
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm'
                    : 'border-border hover:border-foreground/20 hover:bg-muted/40'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-sm font-semibold ${
                          active ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {opt.label}
                      </p>
                      {active && (
                        <span className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-snug">{opt.desc}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default DashboardViewPreference;
