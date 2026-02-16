import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SupplierRiskProfile } from './riskData';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: SupplierRiskProfile;
}

const steps = ['Operations', 'Quality & Compliance', 'Risk & Resilience'];

export function RequestDetailsModal({ open, onOpenChange, supplier }: Props) {
  const [currentStep, setCurrentStep] = useState(0);

  const getStepData = () => {
    if (currentStep === 0) return supplier.operations;
    if (currentStep === 1) return supplier.quality;
    return supplier.riskResilience;
  };

  const handleSend = () => {
    toast({ title: 'Request sent', description: `Details request sent to ${supplier.name}.` });
    onOpenChange(false);
    setCurrentStep(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Request Supplier Details</DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1 mb-4">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <button
                onClick={() => setCurrentStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  i === currentStep
                    ? 'bg-primary text-primary-foreground'
                    : i < currentStep
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {i < currentStep ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                <span className="hidden sm:inline">{s}</span>
              </button>
              {i < steps.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Questions preview */}
        <div className="space-y-3 max-h-[380px] overflow-y-auto">
          {getStepData().map((qa, i) => (
            <div key={i} className="p-3 rounded-lg border border-border/50 bg-muted/20">
              <p className="text-sm font-medium mb-1">{qa.question}</p>
              <Badge variant="secondary" className="text-xs font-normal">{qa.answer}</Badge>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            Back
          </Button>
          {currentStep < steps.length - 1 ? (
            <Button size="sm" onClick={() => setCurrentStep(currentStep + 1)}>
              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSend}>Send Request</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
