import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal = ({ isOpen, onClose }: KeyboardShortcutsModalProps) => {
  const shortcuts = [
    { category: 'Navigation', items: [
      { keys: ['R'], description: 'Refresh pipeline' },
      { keys: ['F'], description: 'Focus search bar' },
      { keys: ['S'], description: 'Toggle activity sidebar' },
      { keys: ['A'], description: 'Toggle analytics' },
      { keys: ['Esc'], description: 'Close drawer/modal' },
    ]},
    { category: 'Actions', items: [
      { keys: ['N'], description: 'New invitation' },
      { keys: ['E'], description: 'Export data' },
      { keys: ['?', '/'], description: 'Show this help' },
    ]},
    { category: 'Selection', items: [
      { keys: ['Shift', 'A'], description: 'Select all visible' },
      { keys: ['Shift', 'C'], description: 'Clear selection' },
    ]},
  ];
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {shortcuts.map((section) => (
            <div key={section.category}>
              <h3 className="font-semibold mb-3 text-sm text-muted-foreground">{section.category}</h3>
              <div className="space-y-2">
                {section.items.map((shortcut, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <Badge key={keyIdx} variant="outline" className="font-mono">
                          {key}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
