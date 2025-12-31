// Narration scripts for each step of the supplier simulation
// These are played via OpenAI TTS when the user reaches each step

export type SimulationStep = 
  | 'intro'
  | 'request-connection'
  | 'wait-approval'
  | 'onboarding-docs'
  | 'onboarding-form'
  | 'submit-onboarding'
  | 'check-request-notification'
  | 'upload-document'
  | 'document-approved'
  | 'check-expiry-notification'
  | 'renew-document'
  | 'explore-help'
  | 'complete';

export const simulationNarrations: Record<SimulationStep, string> = {
  intro: "Welcome to TraceR2C Compliance Flow. This is your demo simulation where all data is for demonstration purposes only. Let's learn how to manage supplier compliance together.",
  
  'request-connection': "First, let's connect with a buyer. Enter the Buyer ID shown on screen to send a connection request. This is how suppliers establish business relationships on the platform.",
  
  'wait-approval': "Great! Your connection request has been sent. In the real world, the buyer would review your request. For this demo, approval will happen automatically in a few seconds.",
  
  'onboarding-docs': "Your connection is approved! Now you need to complete onboarding. Upload the required documents by clicking on each document card and selecting a file.",
  
  'onboarding-form': "Documents uploaded! Now complete the information form. Fill in each field with your company details.",
  
  'submit-onboarding': "All requirements are complete. Click the submit button to send your onboarding for buyer review.",
  
  'check-request-notification': "Excellent! Your onboarding is approved. Check your notifications - you have a new document request from your buyer.",
  
  'upload-document': "Open the document request and upload the required file. You can view the sample document for reference.",
  
  'document-approved': "Your document has been submitted and is now approved! This is how the compliance cycle works.",
  
  'check-expiry-notification': "Notice the notification about an expiring document. Keeping documents up to date is essential for compliance.",
  
  'renew-document': "Click on the expired document and upload a renewed version. The system will track this as version 2.",
  
  'explore-help': "Finally, explore the Help Center. You can access guided tours and submit support tickets anytime.",
  
  complete: "Congratulations! You've completed the simulation. You now understand how to connect with buyers, complete onboarding, handle document requests, and maintain compliance. Thank you for being a TraceR2C supplier!"
};

// Get narration for the current step
export const getNarration = (step: string): string | null => {
  return simulationNarrations[step as SimulationStep] || null;
};
