import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, FlaskConical, Atom, Wheat, Beaker, Trash2, Loader2 } from 'lucide-react';
import { useCOASpecifications } from '@/hooks/useCOA';
import { demoSpecs, specTemplates, type COASpec } from './coaDemoData';
import { toast } from 'sonner';

const categoryIcons: Record<string, any> = {
  'Microbiological': FlaskConical,
  'Heavy Metals': Atom,
  'Allergens': Wheat,
  'Chemical': Beaker,
};

export function COASpecEditor() {
  const { data: liveSpecs, isLoading, addSpec, loadTemplate, deleteSpec, buyerId } = useCOASpecifications();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const specs: COASpec[] = liveSpecs && liveSpecs.length > 0
    ? liveSpecs.map((s: any) => ({
        id: s.id,
        analyte_name: s.analyte_name,
        analyte_code: s.analyte_code,
        category: s.category,
        spec_min: s.spec_min,
        spec_max: s.spec_max,
        unit: s.unit,
        method: s.method,
        acceptable_methods: s.acceptable_methods || [],
        action_on_exceed: s.action_on_exceed,
        basis: s.basis,
        is_active: s.is_active,
      }))
    : demoSpecs;

  const categories = ['all', ...new Set(specs.map(s => s.category))];
  const filtered = specs.filter(s => {
    const matchSearch = !search || s.analyte_name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'all' || s.category === activeCategory;
    return matchSearch && matchCat;
  });

  const handleLoadTemplate = (templateKey: string) => {
    const template = specTemplates[templateKey as keyof typeof specTemplates];
    if (!buyerId) {
      toast.success(`Loaded "${template.name}" template with ${template.specs.length} analytes`);
      return;
    }
    loadTemplate.mutate(template.specs);
  };

  const handleDelete = (id: string) => {
    if (!buyerId) return;
    deleteSpec.mutate(id);
  };

  return (
    <div className="space-y-4">
      {/* Template Loaders */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Start Templates</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.entries(specTemplates).map(([key, template]) => (
            <Button key={key} variant="outline" size="sm" onClick={() => handleLoadTemplate(key)} disabled={loadTemplate.isPending}>
              {loadTemplate.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
              {template.name}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Spec Table */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Analyte Specifications ({filtered.length})</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search analytes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-56 h-9" />
              </div>
              <Button size="sm">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Spec
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="mb-3">
              {categories.map(cat => (
                <TabsTrigger key={cat} value={cat} className="capitalize text-xs">
                  {cat === 'all' ? 'All' : cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="rounded-lg border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Analyte</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Spec Max</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  {buyerId && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Loading specifications...
                    </TableCell>
                  </TableRow>
                ) : filtered.map((spec) => {
                  const CatIcon = categoryIcons[spec.category] || FlaskConical;
                  return (
                    <TableRow key={spec.id}>
                      <TableCell className="font-medium">{spec.analyte_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <CatIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs">{spec.category}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {spec.spec_max !== null ? (spec.spec_max === 0 ? 'Negative' : spec.spec_max) : '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{spec.unit}</TableCell>
                      <TableCell className="text-xs font-mono">{spec.method || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">{spec.action_on_exceed}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={spec.is_active ? 'default' : 'secondary'} className="text-[10px]">
                          {spec.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      {buyerId && (
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(spec.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
