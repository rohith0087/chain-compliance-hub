import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Search, FlaskConical, Atom, Wheat, Beaker } from 'lucide-react';
import { demoSpecs, specTemplates, type COASpec } from './coaDemoData';
import { toast } from 'sonner';

const categoryIcons: Record<string, any> = {
  'Microbiological': FlaskConical,
  'Heavy Metals': Atom,
  'Allergens': Wheat,
  'Chemical': Beaker,
};

export function COASpecEditor() {
  const [specs] = useState<COASpec[]>(demoSpecs);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = ['all', ...new Set(specs.map(s => s.category))];
  const filtered = specs.filter(s => {
    const matchSearch = !search || s.analyte_name.toLowerCase().includes(search.toLowerCase());
    const matchCat = activeCategory === 'all' || s.category === activeCategory;
    return matchSearch && matchCat;
  });

  const handleLoadTemplate = (templateKey: string) => {
    const template = specTemplates[templateKey as keyof typeof specTemplates];
    toast.success(`Loaded "${template.name}" template with ${template.specs.length} analytes`);
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
            <Button key={key} variant="outline" size="sm" onClick={() => handleLoadTemplate(key)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((spec) => {
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
