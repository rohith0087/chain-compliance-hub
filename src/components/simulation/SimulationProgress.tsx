import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  Circle, 
  Loader2,
  ListChecks
} from 'lucide-react';
import { useSimulation } from '@/contexts/SimulationContext';
import { motion, AnimatePresence } from 'framer-motion';

export const SimulationProgress = () => {
  const [isExpanded, setIsExpanded] = useState(true);
  const { getSteps, currentStep, completedSteps } = useSimulation();
  
  const steps = getSteps();
  const completedCount = completedSteps.length;
  const totalSteps = steps.length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  const getStepIcon = (step: { id: string; completed: boolean }) => {
    if (step.completed) {
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    }
    if (currentStep === step.id) {
      return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
    }
    return <Circle className="h-4 w-4 text-muted-foreground/50" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className="simulation-progress fixed right-4 top-20 z-40 w-72"
    >
      <Card className="shadow-lg border-primary/20">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-medium">Simulation Progress</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{completedCount} of {totalSteps} steps</span>
              <span>{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        </CardHeader>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="py-2 px-4 border-t">
                <div className="space-y-2">
                  {steps.map((step, index) => (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-start gap-2 p-2 rounded-md transition-colors ${
                        currentStep === step.id 
                          ? 'bg-primary/10' 
                          : step.completed 
                            ? 'bg-emerald-500/5' 
                            : ''
                      }`}
                    >
                      <div className="mt-0.5">
                        {getStepIcon(step)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${
                          step.completed ? 'text-emerald-600 dark:text-emerald-400' : ''
                        }`}>
                          {step.title}
                        </p>
                        {currentStep === step.id && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            Current Step
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
};
