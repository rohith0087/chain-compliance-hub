import React from 'react';
import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RELEASE_NOTES } from '@/config/version';
import { AuditorFlowPresentation } from '@/components/presentations/AuditorFlowPresentation';

interface WhatsNewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhatsNewDialog({ open, onOpenChange }: WhatsNewDialogProps) {
  const [showPresentation, setShowPresentation] = React.useState(false);

  if (showPresentation) {
    return <AuditorFlowPresentation onClose={() => setShowPresentation(false)} />;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            What's New
          </DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {RELEASE_NOTES.map((release, index) => (
              <div 
                key={release.version}
                className="relative rounded-lg border bg-card p-4"
              >
                {/* Version Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={index === 0 ? "default" : "secondary"}
                      className={index === 0 ? "bg-primary" : ""}
                    >
                      v{release.version}
                    </Badge>
                    {index === 0 && (
                      <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                        Latest
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {release.date}
                  </span>
                </div>

                {/* Title */}
                <h4 className="font-medium text-sm mb-3">
                  {release.title}
                </h4>

                {/* Highlights */}
                <ul className="space-y-1.5 mb-4">
                  {release.highlights.map((highlight, i) => (
                    <li 
                      key={i}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-primary/60 flex-shrink-0" />
                      {highlight}
                    </li>
                  ))}
                </ul>

                {/* Presentation Button for v1.3 */}
                {release.version === "1.3" && (
                  <Button 
                    onClick={() => setShowPresentation(true)}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-0"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    View Interactive Workflow
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
