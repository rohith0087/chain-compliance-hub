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
    description: 'Learn how to create and manage document sets',
    requiredRoute: '/dashboard',
    keywords: ['document set', 'document sets', 'add document set', 'create document set', 'save documents', 'group documents'],
    steps: [
      {
        target: '[data-guide-id="nav-requests"]',
        content: 'Click on "Requests & Documents" in the sidebar to access document management features.',
        placement: 'right',
        disableBeacon: true,
      },
      {
        target: '[data-guide-id="nav-requests"]',
        content: 'Once expanded, click on "Document Sets" to view and manage your saved document collections.',
        placement: 'right',
      },
    ],
  },
  {
    id: 'create-document-request',
    name: 'Create Document Request',
    description: 'Learn how to request documents from suppliers',
    requiredRoute: '/dashboard',
    keywords: ['document request', 'request document', 'create request', 'new request', 'ask supplier', 'request from supplier'],
    steps: [
      {
        target: '[data-guide-id="nav-requests"]',
        content: 'Click on "Requests & Documents" to access the document request features.',
        placement: 'right',
        disableBeacon: true,
      },
      {
        target: '[data-guide-id="nav-requests"]',
        content: 'Then click on "Requests" in the submenu, and use the "New Request" button in Quick Actions to create a document request.',
        placement: 'right',
      },
    ],
  },
  {
    id: 'invite-supplier',
    name: 'Invite Supplier',
    description: 'Learn how to invite new suppliers to the platform',
    requiredRoute: '/dashboard',
    keywords: ['invite supplier', 'add supplier', 'new supplier', 'onboard supplier', 'supplier invitation'],
    steps: [
      {
        target: '[data-guide-id="nav-onboarding"]',
        content: 'Click on "Onboarding Pipeline" to manage supplier invitations and track their progress.',
        placement: 'right',
        disableBeacon: true,
      },
      {
        target: '[data-guide-id="nav-onboarding"]',
        content: 'Use the "Quick Onboarding" or "Bulk Invite" buttons in Quick Actions to invite new suppliers.',
        placement: 'right',
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
        content: 'Click on "Compliance" to view your supplier compliance dashboard with overview, item compliance, and facility matrix.',
        placement: 'right',
        disableBeacon: true,
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
        target: '[data-guide-id="nav-requests"]',
        content: 'Click on "Requests & Documents" to access the Templates section.',
        placement: 'right',
        disableBeacon: true,
      },
      {
        target: '[data-guide-id="nav-requests"]',
        content: 'Click on "Templates" in the submenu to upload and manage document templates that suppliers can use.',
        placement: 'right',
      },
    ],
  },
  {
    id: 'find-suppliers',
    name: 'Find & Connect Suppliers',
    description: 'Learn how to discover and connect with suppliers',
    requiredRoute: '/dashboard',
    keywords: ['find supplier', 'discover supplier', 'search supplier', 'connect supplier', 'supplier discovery'],
    steps: [
      {
        target: '[data-guide-id="nav-suppliers"]',
        content: 'Click on "Suppliers" to access supplier discovery, map view, and connection requests.',
        placement: 'right',
        disableBeacon: true,
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
