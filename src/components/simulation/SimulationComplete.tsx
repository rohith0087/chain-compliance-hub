import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  PartyPopper, 
  CheckCircle2, 
  ArrowRight, 
  RotateCcw,
  Sparkles,
  Trophy
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useSimulation } from '@/contexts/SimulationContext';

export const SimulationComplete = () => {
  const navigate = useNavigate();
  const { resetSimulation, exitSimulation } = useSimulation();

  const achievements = [
    'Connected with a buyer',
    'Completed onboarding documents',
    'Filled company information',
    'Submitted a document request',
    'Received buyer approval',
  ];

  const handleGoToDashboard = () => {
    exitSimulation();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-emerald-500/10 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <Card className="border-2 border-emerald-500/30 shadow-xl overflow-hidden">
          <CardHeader className="text-center pb-4 bg-gradient-to-r from-emerald-500/10 to-emerald-500/5">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="flex justify-center mb-4"
            >
              <div className="relative">
                <div className="p-6 rounded-full bg-emerald-500/20">
                  <Trophy className="h-12 w-12 text-emerald-500" />
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="absolute -top-2 -right-2"
                >
                  <PartyPopper className="h-8 w-8 text-amber-500" />
                </motion.div>
              </div>
            </motion.div>
            
            <Badge variant="secondary" className="mx-auto mb-2 bg-emerald-500/20 text-emerald-600">
              <Sparkles className="h-3 w-3 mr-1" />
              Simulation Complete
            </Badge>
            
            <CardTitle className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
              Congratulations!
            </CardTitle>
            <p className="text-muted-foreground mt-2 text-lg">
              You've successfully completed the supplier simulation
            </p>
          </CardHeader>
          
          <CardContent className="pt-6">
            <div className="mb-8">
              <h3 className="font-semibold text-lg mb-4 text-center">
                What you learned:
              </h3>
              <div className="space-y-3">
                {achievements.map((achievement, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
                    <span>{achievement}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
              <p className="text-sm text-center">
                You're now ready to use the platform with real buyers! 
                Your actual dashboard awaits with real connections and documents.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                onClick={handleGoToDashboard}
                className="gap-2 min-w-[200px] bg-emerald-600 hover:bg-emerald-700"
              >
                Go to Real Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={resetSimulation}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Replay Simulation
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
