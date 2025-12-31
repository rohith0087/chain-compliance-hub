import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSimulation } from '@/contexts/SimulationContext';

interface SimulationBannerProps {
  onExit?: () => void;
}

export const SimulationBanner = ({ onExit }: SimulationBannerProps) => {
  const { exitSimulation, resetSimulation } = useSimulation();

  const handleExit = () => {
    if (onExit) {
      onExit();
    } else {
      exitSimulation();
    }
  };

  return (
    <div className="simulation-banner bg-amber-500/90 text-amber-950 px-4 py-2 flex items-center justify-between z-50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-amber-600/30 px-3 py-1 rounded-full">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-semibold text-sm uppercase tracking-wide">Simulation Mode</span>
        </div>
        <span className="text-sm hidden sm:inline">
          This is a practice environment with fake data. No real actions will be taken.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={resetSimulation}
          className="text-amber-950 hover:bg-amber-600/30 text-xs"
        >
          Restart
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExit}
          className="text-amber-950 hover:bg-amber-600/30"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
