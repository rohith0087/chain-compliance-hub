import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSupplierPerformance } from '@/hooks/useSupplierPerformance';
import { SupplierPerformanceService } from '@/services/SupplierPerformanceService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle, Shield, AlertCircle, Info } from 'lucide-react';

export function SupplierRiskManagement() {
  const { performance, loading, refresh } = useSupplierPerformance();
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [newRiskLevel, setNewRiskLevel] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');
  const [overrideReason, setOverrideReason] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  const handleOverrideRisk = async () => {
    if (!selectedSupplier || !user) return;

    const success = await SupplierPerformanceService.overrideRiskLevel(
      selectedSupplier.supplier_id,
      selectedSupplier.buyer_id,
      newRiskLevel,
      overrideReason,
      user.id
    );

    if (success) {
      toast({
        title: 'Success',
        description: 'Risk level updated successfully'
      });
      setOverrideDialogOpen(false);
      setSelectedSupplier(null);
      setOverrideReason('');
      refresh();
    } else {
      toast({
        title: 'Error',
        description: 'Failed to update risk level',
        variant: 'destructive'
      });
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'critical': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'high': return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'medium': return <Info className="w-5 h-5 text-yellow-500" />;
      case 'low': return <Shield className="w-5 h-5 text-green-500" />;
      default: return null;
    }
  };

  const getRiskBadgeVariant = (level: string) => {
    switch (level) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const riskCategories = [
    { level: 'critical', count: performance.filter(p => p.risk_level === 'critical').length, color: 'bg-red-600' },
    { level: 'high', count: performance.filter(p => p.risk_level === 'high').length, color: 'bg-orange-500' },
    { level: 'medium', count: performance.filter(p => p.risk_level === 'medium').length, color: 'bg-yellow-500' },
    { level: 'low', count: performance.filter(p => p.risk_level === 'low').length, color: 'bg-green-500' },
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading risk data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Risk Management Dashboard</CardTitle>
          <CardDescription>Monitor and manage supplier risk levels</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {riskCategories.map((category) => (
              <div key={category.level} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  {getRiskIcon(category.level)}
                  <span className="text-2xl font-bold">{category.count}</span>
                </div>
                <Badge variant={getRiskBadgeVariant(category.level)} className="w-full justify-center">
                  {category.level.toUpperCase()}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supplier Risk Table</CardTitle>
          <CardDescription>Override risk levels when necessary</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-center">Risk Level</TableHead>
                <TableHead className="text-center">Risk Score</TableHead>
                <TableHead>Risk Factors</TableHead>
                <TableHead className="text-center">Override Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {performance.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell>
                    <div className="font-medium">{supplier.supplier?.company_name || 'Unknown'}</div>
                    <div className="text-sm text-muted-foreground">{supplier.supplier?.industry}</div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={getRiskBadgeVariant(supplier.risk_level)}>
                      {supplier.risk_level.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="font-semibold">{supplier.risk_score}/100</div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {supplier.risk_factors?.slice(0, 2).map((factor: any, idx: number) => (
                        <div key={idx} className="text-sm">
                          <span className="font-medium">{factor.factor}:</span>
                          <span className="text-muted-foreground ml-1">{factor.description}</span>
                        </div>
                      ))}
                      {supplier.risk_factors?.length > 2 && (
                        <div className="text-sm text-muted-foreground">
                          +{supplier.risk_factors.length - 2} more
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {/* @ts-ignore */}
                    {supplier.manual_risk_override ? (
                      <Badge variant="outline">Manual Override</Badge>
                    ) : (
                      <Badge variant="secondary">Auto-Calculated</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedSupplier(supplier);
                        setNewRiskLevel(supplier.risk_level);
                        setOverrideDialogOpen(true);
                      }}
                    >
                      Override Risk
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Override Dialog */}
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Risk Level</DialogTitle>
            <DialogDescription>
              Manually set the risk level for {selectedSupplier?.supplier?.company_name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Risk Level</Label>
              <div className="flex items-center gap-2">
                {getRiskIcon(selectedSupplier?.risk_level)}
                <Badge variant={getRiskBadgeVariant(selectedSupplier?.risk_level)}>
                  {selectedSupplier?.risk_level?.toUpperCase()}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  (Score: {selectedSupplier?.risk_score}/100)
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-risk">New Risk Level</Label>
              <Select value={newRiskLevel} onValueChange={(value: any) => setNewRiskLevel(value)}>
                <SelectTrigger id="new-risk">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Override *</Label>
              <Textarea
                id="reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why you're overriding the risk level..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleOverrideRisk}
              disabled={!overrideReason.trim()}
            >
              Save Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
