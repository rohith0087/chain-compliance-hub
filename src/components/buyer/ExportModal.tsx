import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { exportToCSV, exportToExcel, exportToPDF, ExportData } from "@/utils/pipelineExport";
import { toast } from "sonner";
import { Download } from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ExportData[];
  analytics: any;
}

export const ExportModal = ({ isOpen, onClose, data, analytics }: ExportModalProps) => {
  const [format, setFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');
  const [dateRange, setDateRange] = useState('all');
  
  const handleExport = async () => {
    try {
      const filename = `onboarding-pipeline-${new Date().toISOString().split('T')[0]}`;
      
      switch (format) {
        case 'csv':
          exportToCSV(data, filename);
          break;
        case 'excel':
          await exportToExcel(data, analytics, filename);
          break;
        case 'pdf':
          exportToPDF(data, analytics, filename);
          break;
      }
      
      toast.success(`Exported ${data.length} requests as ${format.toUpperCase()}`);
      onClose();
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export data');
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export Onboarding Pipeline</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Export Format</Label>
            <RadioGroup value={format} onValueChange={(value: any) => setFormat(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="font-normal cursor-pointer">
                  CSV (Excel compatible)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="excel" id="excel" />
                <Label htmlFor="excel" className="font-normal cursor-pointer">
                  Excel with analytics
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pdf" id="pdf" />
                <Label htmlFor="pdf" className="font-normal cursor-pointer">
                  PDF Report
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-3">
            <Label>Date Range</Label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {data.length} request{data.length !== 1 ? 's' : ''} will be exported
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
