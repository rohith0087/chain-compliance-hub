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
        disableOverlayClose={false}
        callback={handleJoyrideCallback}
        spotlightPadding={8}
        styles={{
          options: {
            primaryColor: '#16a34a',
            backgroundColor: '#ffffff',
            textColor: '#1f2937',
            arrowColor: '#ffffff',
            overlayColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10000,
          },
          overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            mixBlendMode: 'normal' as const,
          },
          spotlight: {
            backgroundColor: 'transparent',
            borderRadius: '8px',
          },
          tooltip: {
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
          },
          tooltipContainer: {
            textAlign: 'left' as const,
          },
          tooltipContent: {
            fontSize: '15px',
            lineHeight: 1.6,
            padding: '8px 0',
          },
          buttonNext: {
            backgroundColor: '#16a34a',
            color: '#ffffff',
            borderRadius: '6px',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 500,
          },
          buttonBack: {
            color: '#6b7280',
            marginRight: '12px',
          },
          buttonSkip: {
            color: '#6b7280',
          },
          buttonClose: {
            color: '#6b7280',
            padding: '8px',
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
              filter: 'drop-shadow(0 8px 20px rgba(0, 0, 0, 0.15))',
            },
          },
        }}
      />
    </TourContext.Provider>
  );
};
