import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  PlayCircle, 
  Link, 
  FileText, 
  ClipboardCheck, 
  CheckCircle2,
  ArrowRight,
  Info,
  Volume2,
  VolumeX
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useSimulationNarration } from '@/hooks/useSimulationNarration';
import { SimulationNarrationControls } from './SimulationNarrationControls';

interface SimulationIntroProps {
  onStart: () => void;
  onSkip: () => void;
}

export const SimulationIntro = ({ onStart, onSkip }: SimulationIntroProps) => {
  const narration = useSimulationNarration();
  const [hasPlayedIntro, setHasPlayedIntro] = useState(false);

  const steps = [
    {
      icon: Link,
      title: 'Connect with Buyer',
      description: 'Accept a connection request from a buyer company',
      number: '01',
    },
    {
      icon: FileText,
      title: 'Complete Onboarding',
      description: 'Upload required documents and fill in company info',
      number: '02',
    },
    {
      icon: ClipboardCheck,
      title: 'Handle Requests',
      description: 'View and respond to document requests',
      number: '03',
    },
    {
      icon: CheckCircle2,
      title: 'Get Approved',
      description: 'Submit documents and see them approved',
      number: '04',
    },
  ];

  // Auto-play intro narration when component mounts
  useEffect(() => {
    if (!hasPlayedIntro && !narration.isMuted) {
      const timer = setTimeout(() => {
        narration.playNarration('intro');
        setHasPlayedIntro(true);
      }, 800); // Small delay for smoother experience
      return () => clearTimeout(timer);
    }
  }, [hasPlayedIntro, narration.isMuted]);

  const handleStart = () => {
    narration.stopNarration();
    onStart();
  };

  const handlePlayPause = () => {
    if (narration.isPlaying) {
      narration.pauseNarration();
    } else {
      narration.resumeNarration();
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <div className="text-center mb-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6"
          >
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Interactive Training
          </motion.div>
          
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-4">
            Learn the Platform
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            A guided walkthrough to help you understand how everything works
          </p>

          {/* Voice guidance indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground"
          >
            {narration.isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4 text-primary" />
            )}
            <span>
              {narration.isMuted ? 'Voice guidance disabled' : 'Voice guidance enabled'}
            </span>
          </motion.div>
        </div>

        <div className="space-y-3 mb-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.08 + 0.2 }}
              className="group flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary/30 transition-all duration-200"
            >
              <span className="text-xs font-mono text-muted-foreground/60 w-6">
                {step.number}
              </span>
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <step.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{step.title}</p>
                <p className="text-sm text-muted-foreground truncate">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border mb-8"
        >
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            This simulation uses sample data. Nothing here will affect your real account.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <Button
            size="lg"
            onClick={handleStart}
            className="flex-1 gap-2 h-12 text-base"
          >
            <PlayCircle className="h-5 w-5" />
            Start Simulation
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
          <Button
            variant="ghost"
            size="lg"
            onClick={onSkip}
            className="flex-1 h-12 text-muted-foreground hover:text-foreground"
          >
            Skip to Dashboard
          </Button>
        </motion.div>

        <p className="text-xs text-center text-muted-foreground/60 mt-6">
          Takes about 5-10 minutes
        </p>
      </motion.div>

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
