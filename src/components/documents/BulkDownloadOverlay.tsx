import { Loader2, Download } from "lucide-react";
import { Card } from "@/components/ui/card";

interface BulkDownloadOverlayProps {
  documentCount: number;
}

export function BulkDownloadOverlay({ documentCount }: BulkDownloadOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm animate-fade-in">
      <Card className="p-8 flex flex-col items-center gap-4 shadow-2xl border-primary/20">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
          <div className="relative bg-primary/10 p-4 rounded-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
        
        <div className="text-center space-y-1">
          <p className="text-lg font-medium">Preparing your download...</p>
          <p className="text-sm text-muted-foreground">
            Packaging {documentCount} document{documentCount !== 1 ? 's' : ''} into ZIP
          </p>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Download className="h-3 w-3" />
          <span>This may take a few seconds</span>
        </div>
      </Card>
    </div>
  );
}
