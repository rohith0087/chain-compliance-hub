import { Step } from 'react-joyride';

export const simulationTourSteps: Step[] = [
  {
    target: '.simulation-banner',
    content: 'Welcome to the simulation! This yellow banner indicates you\'re in simulation mode. All data here is fake and won\'t affect your real account.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '.simulation-progress',
    content: 'Track your progress here. Complete each step to learn how the platform works.',
    placement: 'left',
  },
  {
    target: '.simulation-connection-card',
    content: 'This is a connection request from a buyer. In real life, buyers will send you requests to become their supplier. Click "Accept" to proceed.',
    placement: 'bottom',
  },
  {
    target: '.simulation-sidebar-nav',
    content: 'Use the sidebar to navigate between different sections of your supplier dashboard.',
    placement: 'right',
  },
];

export const onboardingTourSteps: Step[] = [
  {
    target: '.simulation-onboarding-docs',
    content: 'Upload the required documents here. Each document type is specified by the buyer.',
    placement: 'right',
  },
  {
    target: '.simulation-onboarding-form',
    content: 'Fill out any required information fields. These help the buyer understand your business.',
    placement: 'right',
  },
  {
    target: '.simulation-submit-onboarding',
    content: 'Once everything is complete, submit your onboarding for the buyer to review.',
    placement: 'top',
  },
];

export const documentRequestsTourSteps: Step[] = [
  {
    target: '.simulation-requests-list',
    content: 'Here you\'ll see all document requests from your connected buyers. Each request has a due date and priority.',
    placement: 'top',
  },
  {
    target: '.simulation-request-card',
    content: 'Click on a request to view details and upload the required document.',
    placement: 'right',
  },
  {
    target: '.simulation-upload-button',
    content: 'Use this button to upload your document. The buyer will then review and approve it.',
    placement: 'top',
  },
];

export const getStepTourForPhase = (phase: string): Step[] => {
  switch (phase) {
    case 'connect':
      return simulationTourSteps;
    case 'onboarding':
      return onboardingTourSteps;
    case 'requests':
      return documentRequestsTourSteps;
    default:
      return [];
  }
};
