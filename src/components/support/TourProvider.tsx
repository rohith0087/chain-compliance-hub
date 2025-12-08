import React, { createContext, useContext, useState, useCallback } from 'react';
import Joyride, { CallBackProps, STATUS, Step, ACTIONS, EVENTS } from 'react-joyride';
import { useNavigate, useLocation } from 'react-router-dom';
import { supportTours, SupportTour, getTourById } from '@/config/supportTours';

interface TourContextType {
  startTour: (tourId: string) => void;
  stopTour: () => void;
  isRunning: boolean;
  currentTourId: string | null;
  availableTours: SupportTour[];
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export const useTour = () => {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
};

interface TourProviderProps {
  children: React.ReactNode;
}

export const TourProvider: React.FC<TourProviderProps> = ({ children }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentTourId, setCurrentTourId] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  const startTour = useCallback((tourId: string) => {
    const tour = getTourById(tourId);
    if (!tour) {
      return;
    }

    // Check if we need to navigate to a different route
    if (tour.requiredRoute && !location.pathname.startsWith(tour.requiredRoute)) {
      navigate(tour.requiredRoute);
      // Small delay to allow navigation to complete
      setTimeout(() => {
        setSteps(tour.steps);
        setCurrentTourId(tourId);
        setStepIndex(0);
        setIsRunning(true);
      }, 500);
    } else {
      setSteps(tour.steps);
      setCurrentTourId(tourId);
      setStepIndex(0);
      setIsRunning(true);
    }
  }, [location.pathname, navigate]);

  const stopTour = useCallback(() => {
    setIsRunning(false);
    setCurrentTourId(null);
    setSteps([]);
    setStepIndex(0);
  }, []);

  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { status, action, index, type } = data;

    // Handle tour completion or skip
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      stopTour();
      return;
    }

    // Handle step navigation
    if (type === EVENTS.STEP_AFTER) {
      if (action === ACTIONS.NEXT) {
        setStepIndex(index + 1);
      } else if (action === ACTIONS.PREV) {
        setStepIndex(index - 1);
      }
    }

    // Handle close button
    if (action === ACTIONS.CLOSE) {
      stopTour();
    }
  }, [stopTour]);

  const value: TourContextType = {
    startTour,
    stopTour,
    isRunning,
    currentTourId,
    availableTours: supportTours,
  };

  return (
    <TourContext.Provider value={value}>
      {children}
      <Joyride
        steps={steps}
        run={isRunning}
        stepIndex={stepIndex}
        continuous
        showProgress
        showSkipButton
        scrollToFirstStep
        spotlightClicks
        disableOverlayClose
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: 'hsl(var(--primary))',
            backgroundColor: 'hsl(var(--card))',
            textColor: 'hsl(var(--card-foreground))',
            overlayColor: 'rgba(0, 0, 0, 0.6)',
            spotlightShadow: '0 0 20px rgba(0, 0, 0, 0.5)',
            zIndex: 10000,
          },
          tooltip: {
            borderRadius: 'var(--radius)',
            padding: '16px',
          },
          tooltipContainer: {
            textAlign: 'left',
          },
          tooltipTitle: {
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '8px',
          },
          tooltipContent: {
            fontSize: '14px',
            lineHeight: 1.5,
          },
          buttonNext: {
            backgroundColor: 'hsl(var(--primary))',
            color: 'hsl(var(--primary-foreground))',
            borderRadius: 'var(--radius)',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 500,
          },
          buttonBack: {
            color: 'hsl(var(--muted-foreground))',
            marginRight: '8px',
          },
          buttonSkip: {
            color: 'hsl(var(--muted-foreground))',
          },
          buttonClose: {
            color: 'hsl(var(--muted-foreground))',
          },
          spotlight: {
            borderRadius: 'var(--radius)',
          },
          overlay: {
            mixBlendMode: 'normal',
          },
        }}
        locale={{
          back: 'Back',
          close: 'Close',
          last: 'Done',
          next: 'Next',
          skip: 'Skip Tour',
        }}
        floaterProps={{
          disableAnimation: false,
          styles: {
            floater: {
              filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))',
            },
          },
        }}
      />
    </TourContext.Provider>
  );
};
