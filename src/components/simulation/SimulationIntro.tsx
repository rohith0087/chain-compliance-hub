import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  PlayCircle, 
  Link, 
  FileText, 
  ClipboardCheck, 
  CheckCircle2,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';

interface SimulationIntroProps {
  onStart: () => void;
  onSkip: () => void;
}

export const SimulationIntro = ({ onStart, onSkip }: SimulationIntroProps) => {
  const steps = [
    {
      icon: Link,
      title: 'Connect with Buyer',
      description: 'Accept a connection request from a buyer company',
      color: 'text-blue-500',
    },
    {
      icon: FileText,
      title: 'Complete Onboarding',
      description: 'Upload required documents and fill in company info',
      color: 'text-emerald-500',
    },
    {
      icon: ClipboardCheck,
      title: 'Handle Requests',
      description: 'View and respond to document requests',
      color: 'text-amber-500',
    },
    {
      icon: CheckCircle2,
      title: 'Get Approved',
      description: 'Submit documents and see them approved',
      color: 'text-purple-500',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-3xl"
      >
        <Card className="border-2 border-primary/20 shadow-xl overflow-hidden">
          <CardHeader className="text-center pb-2 bg-gradient-to-r from-primary/10 to-primary/5">
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-full bg-primary/10">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
            </div>
            <Badge variant="secondary" className="mx-auto mb-2">
              Interactive Training
            </Badge>
            <CardTitle className="text-3xl font-bold">
              Welcome to Supplier Simulation
            </CardTitle>
            <p className="text-muted-foreground mt-2 text-lg">
              Learn how the platform works with a hands-on, guided experience
            </p>
          </CardHeader>
          
          <CardContent className="pt-6">
            <div className="mb-8">
              <h3 className="font-semibold text-lg mb-4 text-center">
                What you'll learn:
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {steps.map((step, index) => (
                  <motion.div
                    key={step.title}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 + 0.3 }}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
                  >
                    <div className={`p-2 rounded-lg bg-background ${step.color}`}>
                      <step.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{step.title}</p>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-amber-700 dark:text-amber-300 text-center">
                <strong>Note:</strong> This simulation uses fake data. Nothing you do here will affect your real account.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                onClick={onStart}
                className="gap-2 min-w-[200px]"
              >
                <PlayCircle className="h-5 w-5" />
                Start Simulation
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={onSkip}
                className="text-muted-foreground"
              >
                Skip to Real Dashboard
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground mt-4">
              Estimated time: 5-10 minutes
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};
