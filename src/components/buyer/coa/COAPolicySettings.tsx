import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Settings2, ArrowLeftRight, Trash2, Loader2 } from 'lucide-react';
import { useCOAPolicySettings, useCOAMethodEquivalencies } from '@/hooks/useCOA';
import { demoPolicySettings, demoMethodEquivalencies, type COAPolicySettings as PolicyType } from './coaDemoData';

export function COAPolicySettings() {
  const { data: livePolicy, isLoading: loadingPolicy, upsertPolicy, buyerId } = useCOAPolicySettings();
  const { data: liveEquivalencies, isLoading: loadingEq, toggleEquivalency, deleteEquivalency } = useCOAMethodEquivalencies();

  const policy: PolicyType = livePolicy || demoPolicySettings;
  const equivalencies = liveEquivalencies && liveEquivalencies.length > 0 ? liveEquivalencies : demoMethodEquivalencies;

  const togglePolicy = (key: keyof PolicyType) => {
    const updated = { ...policy, [key]: !policy[key] };
    if (buyerId) {
      upsertPolicy.mutate(updated);
    }
  };

  const policyItems = [
    { key: 'within_spec_is_match' as const, label: 'Within spec = match', description: 'If both values are within spec limits, treat as a match' },
    { key: 'censored_equivalent_is_match' as const, label: 'Censored equivalent = match', description: 'If both are ND/<LOD with same threshold, treat as match' },
    { key: 'require_basis_conversion' as const, label: 'Require basis conversion', description: 'Only convert basis (dry/as-is) when moisture data is present' },
    { key: 'flag_non_convertible_units' as const, label: 'Flag non-convertible units', description: 'Mark units that cannot be auto-converted for manual review' },
    { key: 'auto_flag_unknown_analytes' as const, label: 'Auto-flag unknown analytes', description: 'Flag analytes found in COA but not in your specifications' },
  ];

  return (
    <div className="space-y-4">
      {/* Policy Toggles */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Comparison Policies</CardTitle>
              <CardDescription className="text-xs">Configure how COA values are compared against your specifications</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingPolicy ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading policies...
            </div>
          ) : policyItems.map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
              <Switch checked={policy[item.key]} onCheckedChange={() => togglePolicy(item.key)} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Method Equivalencies */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-base">Method Equivalencies</CardTitle>
                <CardDescription className="text-xs">Define when two testing methods are considered equivalent</CardDescription>
              </div>
            </div>
            <Button size="sm" variant="outline">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Rule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Analyte</TableHead>
                  <TableHead>Method A</TableHead>
                  <TableHead>Method B</TableHead>
                  <TableHead>Authority</TableHead>
                  <TableHead>Status</TableHead>
                  {buyerId && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingEq ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Loading equivalencies...
                    </TableCell>
                  </TableRow>
                ) : equivalencies.map((eq) => (
                  <TableRow key={eq.id}>
                    <TableCell className="font-medium text-sm">{eq.rule_name}</TableCell>
                    <TableCell className="text-xs font-mono">{eq.analyte_code}</TableCell>
                    <TableCell className="text-xs font-mono">{eq.method_a}</TableCell>
                    <TableCell className="text-xs font-mono">{eq.method_b}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{eq.authority || '—'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={eq.is_active ? 'default' : 'secondary'}
                        className="text-[10px] cursor-pointer"
                        onClick={() => buyerId && toggleEquivalency.mutate({ id: eq.id, is_active: !eq.is_active })}
                      >
                        {eq.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    {buyerId && (
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteEquivalency.mutate(eq.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
