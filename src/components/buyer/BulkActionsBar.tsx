import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Download, Archive, X } from "lucide-react";
import { toast } from "sonner";

interface BulkActionsBarProps {
  selectedCount: number;
  onSendReminders: () => void;
  onExport: () => void;
  onArchive: () => void;
  onClear: () => void;
}

export const BulkActionsBar = ({
  selectedCount,
  onSendReminders,
  onExport,
  onArchive,
  onClear
}: BulkActionsBarProps) => {
  if (selectedCount === 0) return null;
  
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5">
      <Card className="shadow-lg border-primary/20">
        <CardContent className="p-4 flex items-center gap-4">
          <span className="font-medium text-sm">
            {selectedCount} request{selectedCount > 1 ? 's' : ''} selected
          </span>
          
          <div className="h-6 w-px bg-border" />
          
          <Button 
            size="sm" 
            onClick={onSendReminders}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            Send Reminders
          </Button>
          
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onExport}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          
          <Button 
            size="sm" 
            variant="outline" 
            onClick={onArchive}
            className="gap-2"
          >
            <Archive className="h-4 w-4" />
            Archive
          </Button>
          
          <div className="h-6 w-px bg-border" />
          
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={onClear}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
