import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { FileStack, FileCheck } from "lucide-react";

interface BulkDownloadOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  multiVersionCount: number;
  totalSelected: number;
  downloadMode: 'current' | 'all';
  onDownloadModeChange: (mode: 'current' | 'all') => void;
  onConfirm: () => void;
}

export function BulkDownloadOptionsDialog({
  open,
  onOpenChange,
  multiVersionCount,
  totalSelected,
  downloadMode,
  onDownloadModeChange,
  onConfirm
}: BulkDownloadOptionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download Options</DialogTitle>
          <DialogDescription>
            {multiVersionCount} of {totalSelected} selected documents have multiple versions.
          </DialogDescription>
        </DialogHeader>
        
        <RadioGroup
          value={downloadMode}
          onValueChange={(value) => onDownloadModeChange(value as 'current' | 'all')}
          className="gap-4 py-4"
        >
          <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer">
            <RadioGroupItem value="current" id="current" className="mt-0.5" />
            <Label htmlFor="current" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2 font-medium">
                <FileCheck className="h-4 w-4 text-primary" />
                Latest versions only
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Download only the most recent version of each document (recommended)
              </p>
            </Label>
          </div>
          
          <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors cursor-pointer">
            <RadioGroupItem value="all" id="all" className="mt-0.5" />
            <Label htmlFor="all" className="flex-1 cursor-pointer">
              <div className="flex items-center gap-2 font-medium">
                <FileStack className="h-4 w-4 text-primary" />
                All versions
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Download complete version history for all documents
              </p>
            </Label>
          </div>
        </RadioGroup>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
