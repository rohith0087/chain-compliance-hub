import { Dialog, DialogContent } from '@/components/ui/dialog';
import { SettingsWorkspace } from './SettingsWorkspace';

interface UnifiedSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
  companyId?: string;
  companyType?: 'buyer' | 'supplier';
  companyName?: string;
}

// Thin dialog wrapper around the Settings-04 style workspace so existing
// callers (e.g. the supplier dashboard) keep working with the new look.
// On the buyer side, Settings is now a full dashboard tab rendering
// SettingsWorkspace directly.
export function UnifiedSettingsModal({
  open,
  onOpenChange,
  defaultTab = 'account',
  companyId,
  companyType,
  companyName,
}: UnifiedSettingsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px] h-[85vh] p-0 gap-0 overflow-y-auto bg-card border-none shadow-2xl rounded-2xl">
        <SettingsWorkspace
          embedded
          defaultTab={defaultTab}
          companyId={companyId}
          companyType={companyType}
          companyName={companyName}
        />
      </DialogContent>
    </Dialog>
  );
}
