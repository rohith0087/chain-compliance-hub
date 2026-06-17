import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Download, FileText, Search, Building2, Loader2, Users, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

interface Supplier {
  id: string;
  company_name: string;
  industry?: string;
  company_logo_url?: string;
  complianceScore: number;
  totalRequests: number;
  approvedRequests: number;
  pendingRequests: number;
  rejectedRequests: number;
}

interface SupplierComplianceExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  onExport: (selectedSuppliers: string[], reportType: string, dateRange: DateRange, options: ExportOptions) => Promise<void>;
}

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface ExportOptions {
  includeCharts: boolean;
  includeRiskAssessment: boolean;
  includeRecommendations: boolean;
  includeDocumentHistory: boolean;
  includeComparison: boolean;
}

const SupplierComplianceExportModal: React.FC<SupplierComplianceExportModalProps> = ({
  isOpen,
  onClose,
  suppliers,
  onExport
}) => {
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [reportType, setReportType] = useState<string>('detailed');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
    to: new Date()
  });
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeCharts: true,
    includeRiskAssessment: true,
    includeRecommendations: true,
    includeDocumentHistory: true,
    includeComparison: false
  });
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.industry?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSupplierSelect = (supplierId: string) => {
    setSelectedSuppliers(prev => {
      if (prev.includes(supplierId)) {
        return prev.filter(id => id !== supplierId);
      } else {
        return [...prev, supplierId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedSuppliers.length === filteredSuppliers.length) {
      setSelectedSuppliers([]);
    } else {
      setSelectedSuppliers(filteredSuppliers.map(s => s.id));
    }
  };

  useEffect(() => {
    // Auto-enable comparison when multiple suppliers are selected
    setExportOptions(prev => ({
      ...prev,
      includeComparison: selectedSuppliers.length > 1
    }));
  }, [selectedSuppliers.length]);


  const handleExport = async () => {
    if (selectedSuppliers.length === 0) {
      toast({
        title: "Selection Required",
        description: "Please select at least one supplier to export.",
        variant: "destructive"
      });
      return;
    }

    setIsExporting(true);
    
    // Show progress toast
    const progressToast = toast({
      title: "Generating Report",
      description: "Collecting compliance data...",
      duration: 10000
    });

    try {
      // Update progress
      setTimeout(() => {
        toast({
          title: "Generating Report",
          description: selectedSuppliers.length > 1 
            ? "Generating AI comparison insights..." 
            : "Generating AI risk assessment...",
          duration: 15000
        });
      }, 2000);

      // Update progress again
      setTimeout(() => {
        toast({
          title: "Generating Report",
          description: "Creating PDF document with charts and analytics...",
          duration: 10000
        });
      }, 8000);

      await onExport(selectedSuppliers, reportType, dateRange, exportOptions);
      
      toast({
        title: "Export Successful",
        description: `Generated professional ${selectedSuppliers.length > 1 ? 'comparison' : 'detailed'} report for ${selectedSuppliers.length} supplier(s).`
      });
      onClose();
    } catch (error: any) {
      console.error('Export failed:', error);
      const msg = error?.message || '';
      const isCredits = /credit|insufficient/i.test(msg);
      toast({
        title: isCredits ? "Not enough credits" : "Export Failed",
        description: isCredits
          ? `${msg}. Top up your credits to generate this report.`
          : (msg || "There was an error generating the report. Please try again."),
        variant: "destructive",
        action: isCredits ? (
          <ToastAction altText="Buy credits" onClick={() => { window.location.href = '/subscription'; }}>
            Buy credits
          </ToastAction>
        ) : undefined,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const getRiskBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  const getRiskLevel = (score: number) => {
    if (score >= 80) return 'Low';
    if (score >= 60) return 'Medium';
    return 'High';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Export Supplier Compliance Reports
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4 pb-4">
          {/* Left Column - Supplier Selection */}
          <div className="lg:col-span-2 space-y-4 h-full flex flex-col">
            <Card className="flex-1 flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Select Suppliers ({selectedSuppliers.length} of {filteredSuppliers.length})
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    {selectedSuppliers.length === filteredSuppliers.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 flex flex-col">
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search suppliers by name or industry..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <ScrollArea className="flex-1">
                  <div className="space-y-2">
                    {filteredSuppliers.map((supplier) => (
                      <div
                        key={supplier.id}
                        className={cn(
                          "flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors",
                          selectedSuppliers.includes(supplier.id) 
                            ? "bg-primary/5 border-primary" 
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => handleSupplierSelect(supplier.id)}
                      >
                        <Checkbox
                          checked={selectedSuppliers.includes(supplier.id)}
                          onChange={() => {}} // Handled by parent click
                        />
                        
                        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                          {supplier.company_logo_url ? (
                            <img 
                              src={supplier.company_logo_url} 
                              alt={`${supplier.company_name} logo`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Building2 className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{supplier.company_name}</p>
                          <p className="text-sm text-muted-foreground">{supplier.industry || 'Not specified'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress value={supplier.complianceScore} className="w-16 h-2" />
                            <span className="text-xs font-medium">{supplier.complianceScore}%</span>
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", getRiskBadgeColor(supplier.complianceScore))}
                            >
                              {getRiskLevel(supplier.complianceScore)} Risk
                            </Badge>
                          </div>
                        </div>

                        <div className="text-right text-sm text-muted-foreground">
                          <p>{supplier.totalRequests} requests</p>
                          <p>{supplier.approvedRequests} approved</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Export Configuration */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Report Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Report Type</Label>
                  <Select value={reportType} onValueChange={setReportType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="summary">Executive Summary</SelectItem>
                      <SelectItem value="detailed">Detailed Analysis</SelectItem>
                      <SelectItem value="comparison">Comparison Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Date Range</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "justify-start text-left font-normal",
                            !dateRange.from && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange.from ? format(dateRange.from, "MMM dd") : "From"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange.from}
                          onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "justify-start text-left font-normal",
                            !dateRange.to && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange.to ? format(dateRange.to, "MMM dd") : "To"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRange.to}
                          onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Include in Report</Label>
                  {[
                    { key: 'includeCharts', label: 'Visual Charts & Analytics' },
                    { key: 'includeRiskAssessment', label: 'AI Risk Assessment' },
                    { key: 'includeRecommendations', label: 'AI Recommendations' },
                    { key: 'includeDocumentHistory', label: 'Document History' },
                    { key: 'includeComparison', label: 'Supplier Comparison', disabled: selectedSuppliers.length <= 1 }
                  ].map((option) => (
                    <div key={option.key} className="flex items-center space-x-2">
                      <Checkbox
                        id={option.key}
                        checked={exportOptions[option.key as keyof ExportOptions]}
                        onCheckedChange={(checked) => 
                          setExportOptions(prev => ({ 
                            ...prev, 
                            [option.key]: checked 
                          }))
                        }
                        disabled={option.disabled}
                      />
                      <Label 
                        htmlFor={option.key} 
                        className={cn(
                          "text-sm",
                          option.disabled && "text-muted-foreground"
                        )}
                      >
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {selectedSuppliers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Export Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <p><strong>Suppliers:</strong> {selectedSuppliers.length}</p>
                    <p><strong>Type:</strong> {selectedSuppliers.length > 1 ? 'Comparison Report' : 'Individual Report'}</p>
                    <p><strong>Features:</strong> {Object.values(exportOptions).filter(Boolean).length} enabled</p>
                    {dateRange.from && dateRange.to && (
                      <p><strong>Period:</strong> {format(dateRange.from, "MMM dd")} - {format(dateRange.to, "MMM dd, yyyy")}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isExporting}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleExport}
                disabled={selectedSuppliers.length === 0 || isExporting}
                className="flex-1"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default SupplierComplianceExportModal;