import { Step } from 'react-joyride';

export interface SupportTour {
  id: string;
  name: string;
  description: string;
  requiredRoute?: string; // Route where tour should start
  keywords: string[]; // Keywords to match user questions
  steps: Step[];
}

export const supportTours: SupportTour[] = [
  {
    id: 'add-document-sets',
    name: 'Add Document Sets',
    description: 'Learn how to create and manage document sets for quick document selection',
    requiredRoute: '/dashboard',
    keywords: ['document set', 'document sets', 'add document set', 'create document set', 'save documents', 'group documents'],
    steps: [
      {
        target: '[data-guide-id="nav-documents"]',
        content: 'First, click on the Documents tab in the navigation to access document management.',
        placement: 'right',
        disableBeacon: true,
      },
      {
        target: '[data-guide-id="documents-tab-sets"]',
        content: 'Click on the "Document Sets" tab to view and manage your saved document collections.',
        placement: 'bottom',
      },
      {
        target: '[data-guide-id="create-document-set"]',
        content: 'Click here to create a new document set. You can name it and select which documents to include.',
        placement: 'bottom',
      },
      {
        target: '[data-guide-id="document-set-list"]',
        content: 'Your saved document sets will appear here. You can edit, duplicate, or delete them as needed.',
        placement: 'top',
      },
    ],
  },
  {
    id: 'create-document-request',
    name: 'Create Document Request',
    description: 'Learn how to create a new document request for suppliers',
    requiredRoute: '/dashboard',
    keywords: ['document request', 'request document', 'create request', 'new request', 'ask supplier', 'request from supplier'],
    steps: [
      {
        target: '[data-guide-id="nav-requests"]',
        content: 'Navigate to the Requests section to manage document requests.',
        placement: 'right',
        disableBeacon: true,
      },
      {
        target: '[data-guide-id="create-request-button"]',
        content: 'Click this button to create a new document request.',
        placement: 'bottom',
      },
      {
        target: '[data-guide-id="request-supplier-select"]',
        content: 'Select the supplier you want to request documents from.',
        placement: 'bottom',
      },
      {
        target: '[data-guide-id="request-document-type"]',
        content: 'Choose the type of document you need from the supplier.',
        placement: 'bottom',
      },
      {
        target: '[data-guide-id="request-submit"]',
        content: 'Review your request and click submit to send it to the supplier.',
        placement: 'top',
      },
    ],
  },
  {
    id: 'invite-supplier',
    name: 'Invite Supplier',
    description: 'Learn how to invite a new supplier to the platform',
    requiredRoute: '/dashboard',
    keywords: ['invite supplier', 'add supplier', 'new supplier', 'onboard supplier', 'supplier invitation'],
    steps: [
      {
        target: '[data-guide-id="nav-onboarding"]',
        content: 'Go to the Onboarding section to manage supplier invitations.',
        placement: 'right',
        disableBeacon: true,
      },
      {
        target: '[data-guide-id="invite-supplier-button"]',
        content: 'Click here to invite a new supplier to the platform.',
        placement: 'bottom',
      },
      {
        target: '[data-guide-id="supplier-email-input"]',
        content: 'Enter the supplier\'s email address and company details.',
        placement: 'bottom',
      },
      {
        target: '[data-guide-id="supplier-documents-select"]',
        content: 'Select which documents you want to request from this supplier.',
        placement: 'bottom',
      },
      {
        target: '[data-guide-id="send-invitation-button"]',
        content: 'Click to send the invitation. The supplier will receive an email with instructions.',
        placement: 'top',
      },
    ],
  },
  {
    id: 'view-compliance',
    name: 'View Compliance Dashboard',
    description: 'Learn how to check supplier compliance status',
    requiredRoute: '/dashboard',
    keywords: ['compliance', 'compliance dashboard', 'supplier compliance', 'check compliance', 'compliance status'],
    steps: [
      {
        target: '[data-guide-id="nav-compliance"]',
        content: 'Click on Compliance to view your supplier compliance dashboard.',
        placement: 'right',
        disableBeacon: true,
      },
      {
        target: '[data-guide-id="compliance-overview"]',
        content: 'Here you can see an overview of compliance across all your suppliers.',
        placement: 'bottom',
      },
      {
        target: '[data-guide-id="compliance-filters"]',
        content: 'Use filters to narrow down by supplier, document type, or status.',
        placement: 'bottom',
      },
    ],
  },
  {
    id: 'manage-templates',
    name: 'Manage Document Templates',
    description: 'Learn how to create and manage document templates',
    requiredRoute: '/dashboard',
    keywords: ['template', 'templates', 'document template', 'create template', 'manage templates', 'custom template'],
    steps: [
      {
        target: '[data-guide-id="nav-documents"]',
        content: 'Go to the Documents section first.',
        placement: 'right',
        disableBeacon: true,
      },
      {
        target: '[data-guide-id="documents-tab-templates"]',
        content: 'Click on the Templates tab to manage your document templates.',
        placement: 'bottom',
      },
      {
        target: '[data-guide-id="upload-template-button"]',
        content: 'Click here to upload a new document template that suppliers can use.',
        placement: 'bottom',
      },
    ],
  },
];

// Helper function to find a tour by keywords
export const findTourByKeywords = (query: string): SupportTour | null => {
  const lowerQuery = query.toLowerCase();
  
  for (const tour of supportTours) {
    for (const keyword of tour.keywords) {
      if (lowerQuery.includes(keyword.toLowerCase())) {
        return tour;
      }
    }
  }
  
  return null;
};

// Helper function to get tour by ID
export const getTourById = (id: string): SupportTour | null => {
  return supportTours.find(tour => tour.id === id) || null;
};
