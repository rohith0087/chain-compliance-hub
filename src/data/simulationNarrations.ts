// Narration scripts for each step of the supplier simulation
// These are played via ElevenLabs TTS when the user reaches each step

export type SimulationStep = 
  | 'intro'
  | 'request-connection'
  | 'wait-approval'
  | 'receive-documents'
  | 'upload-documents'
  | 'submit-documents'
  | 'wait-review'
  | 'handle-rejection'
  | 'resubmit'
  | 'complete-onboarding'
  | 'manage-renewals'
  | 'view-compliance'
  | 'explore-library'
  | 'complete';

export const simulationNarrations: Record<SimulationStep, string> = {
  intro: "Welcome to TraceR2C Compliance Flow! This is your demo simulation where all data is for demonstration purposes only. Let me guide you through the supplier experience step by step.",
  
  'request-connection': "Let's start by connecting with a buyer. In the Connections tab, you can send a connection request by entering the buyer's unique ID. This is how you establish your business relationship on the platform.",
  
  'wait-approval': "Great job! Your connection request has been sent. In a real scenario, the buyer would review and approve your request. For this demo, let's simulate their approval so we can continue.",
  
  'receive-documents': "Excellent! The buyer has approved your connection and sent you document requests. These are the compliance documents they need from you. Let's head to the Requests tab to see what's required.",
  
  'upload-documents': "Now you can see the document requests from your buyer. Click on a request to upload the required document. You can upload files from your computer or select from your document library.",
  
  'submit-documents': "Perfect! Your document has been uploaded. Now let's submit it for the buyer's review. Once submitted, the buyer will be notified and can start their review process.",
  
  'wait-review': "Your document is now pending review. The buyer will examine it to ensure it meets their compliance requirements. Let's simulate their review process.",
  
  'handle-rejection': "Sometimes documents get rejected if they don't meet requirements. Don't worry, this is normal! You'll receive feedback explaining what needs to be fixed.",
  
  'resubmit': "Now you can address the feedback and resubmit your document. Upload a corrected version and submit it again for review.",
  
  'complete-onboarding': "Congratulations! Your document has been approved. You've successfully completed the onboarding process with this buyer. Your compliance status is now active.",
  
  'manage-renewals': "Documents often have expiration dates. The platform will notify you when renewals are needed. Let's explore how to manage document renewals.",
  
  'view-compliance': "The Compliance tab gives you an overview of your compliance status across all buyers. You can track which documents are current, expiring soon, or need attention.",
  
  'explore-library': "Your Document Library stores all your uploaded documents. You can reuse documents across multiple buyer requests, saving time and effort.",
  
  complete: "Congratulations! You've completed the TraceR2C supplier simulation. You now understand how to connect with buyers, submit compliance documents, handle feedback, and manage renewals. Thank you for exploring the platform. You're ready to work with real buyers!"
};

// Get narration for the current step
export const getNarration = (step: string): string | null => {
  return simulationNarrations[step as SimulationStep] || null;
};
