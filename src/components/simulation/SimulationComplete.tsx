import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSimulation } from '@/contexts/SimulationContext';

export const SimulationComplete = () => {
  const navigate = useNavigate();
  const { resetSimulation, exitSimulation, setActiveTab, goToStep } = useSimulation();

  const handleExploreApplication = () => {
    // Go back to intro step (which renders the dashboard) and set overview tab
    goToStep('intro');
    setActiveTab('overview');
  };

  const handleGoToDashboard = () => {
    exitSimulation();
    navigate('/dashboard');
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
              onClick={resetSimulation}
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
    </div>
  );
};
