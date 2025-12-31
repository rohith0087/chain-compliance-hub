import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSimulation } from '@/contexts/SimulationContext';
import { useSimulationNarration } from '@/hooks/useSimulationNarration';
import { SimulationNarrationControls } from './SimulationNarrationControls';

export const SimulationComplete = () => {
  const navigate = useNavigate();
  const { resetSimulation, exitSimulation, setActiveTab, goToStep } = useSimulation();
  const narration = useSimulationNarration();
  const [hasPlayedComplete, setHasPlayedComplete] = useState(false);

  // Auto-play completion narration
  useEffect(() => {
    if (!hasPlayedComplete && !narration.isMuted) {
      const timer = setTimeout(() => {
        narration.playNarration('complete');
        setHasPlayedComplete(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasPlayedComplete, narration.isMuted]);

  const handleExploreApplication = () => {
    narration.stopNarration();
    // Go back to intro step (which renders the dashboard) and set overview tab
    goToStep('intro');
    setActiveTab('overview');
  };

  const handleGoToDashboard = () => {
    narration.stopNarration();
    exitSimulation();
    navigate('/dashboard');
  };

  const handleRestart = () => {
    narration.stopNarration();
    resetSimulation();
  };

  const handlePlayPause = () => {
    if (narration.isPlaying) {
      narration.pauseNarration();
    } else {
      narration.resumeNarration();
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border">
        <CardHeader className="text-center pb-4">
          <CardTitle className="text-xl font-semibold">
            Simulation Complete
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <p className="text-center text-muted-foreground">
            You've finished the guided simulation. Feel free to continue exploring the application.
          </p>

          {/* Voice guidance indicator */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            {narration.isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4 text-primary" />
            )}
            <span>
              {narration.isPlaying ? 'Playing completion message...' : 
               narration.isMuted ? 'Voice guidance disabled' : 'Voice guidance enabled'}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={handleExploreApplication}
              className="w-full gap-2"
            >
              Explore Application
              <ArrowRight className="h-4 w-4" />
            </Button>
            
            <Button
              variant="outline"
              onClick={handleRestart}
              className="w-full gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Restart Simulation
            </Button>
            
            <Button
              variant="ghost"
              onClick={handleGoToDashboard}
              className="w-full"
            >
              Exit to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Narration Controls */}
      <SimulationNarrationControls
        isPlaying={narration.isPlaying}
        isLoading={narration.isLoading}
        isMuted={narration.isMuted}
        onToggleMute={narration.toggleMute}
        onPlayPause={handlePlayPause}
        onReplay={narration.replayCurrentNarration}
      />
    </div>
  );
};
