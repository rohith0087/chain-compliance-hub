import { Step } from 'react-joyride';

export interface SupportTour {
  id: string;
  name: string;
  description: string;
  requiredRoute?: string;
  keywords: string[];
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
        content: 'Click on "Requests & Documents" to access document management, then select "Document Sets" from the submenu to create and manage your saved document collections.',
        placement: 'right',
        disableBeacon: true,
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
        target: '[data-guide-id="quick-new-request"]',
        content: 'Click the "New Request" button to create a new document request from your suppliers.',
        placement: 'right',
        disableBeacon: true,
      },
    ],
  },
  {
    id: 'invite-supplier',
    name: 'Invite Supplier',
    description: 'Learn how to invite new suppliers to the platform',
    requiredRoute: '/dashboard',
    keywords: ['invite supplier', 'add supplier', 'new supplier', 'onboard supplier', 'supplier invitation', 'bulk invite'],
    steps: [
      {
        target: '[data-guide-id="quick-bulk-invite"]',
        content: 'Click "Bulk Invite" to invite multiple suppliers at once. You can also use "Quick Onboarding" from the Onboarding Pipeline for single invites.',
        placement: 'right',
        disableBeacon: true,
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
        content: 'Click on "Requests & Documents" to access the Templates section, then select "Templates" from the submenu to upload and manage document templates.',
        placement: 'right',
        disableBeacon: true,
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
  {
    id: 'assign-supplier-branch',
    name: 'Assign Supplier to Branch',
    description: 'Learn how to assign suppliers to specific branches',
    requiredRoute: '/dashboard',
    keywords: ['assign supplier', 'branch supplier', 'supplier branch', 'add supplier to branch', 'branch assignment'],
    steps: [
      {
        target: '[data-guide-id="nav-suppliers"]',
        content: 'First, click on "Suppliers" to access supplier management.',
        placement: 'right',
        disableBeacon: true,
      },
      {
        target: '[data-guide-id="suppliers-branches-tab"]',
        content: 'Click on "Branch Suppliers" to manage suppliers per branch. Select a branch and add suppliers to assign them.',
        placement: 'bottom',
      },
    ],
  },
  {
    id: 'add-new-user',
    name: 'Add New User',
    description: 'Learn how to add new users to your company',
    requiredRoute: '/dashboard',
    keywords: ['add user', 'new user', 'invite user', 'team member', 'create user', 'user management'],
    steps: [
      {
        target: '[data-guide-id="nav-company"]',
        content: 'Click on "Company Management" to access user settings (requires admin access). Then go to the Users section and click "Add User" to invite a new team member.',
        placement: 'right',
        disableBeacon: true,
      },
    ],
  },
  {
    id: 'manage-mfa',
    name: 'Manage MFA/DUO',
    description: 'Learn how to manage your two-factor authentication settings',
    requiredRoute: '/dashboard',
    keywords: ['mfa', 'duo', '2fa', 'two factor', 'authenticator', 'security', 'authentication'],
    steps: [
      {
        target: '[data-guide-id="profile-dropdown"]',
        content: 'Click on your profile button in the sidebar footer to access account options.',
        placement: 'top',
        disableBeacon: true,
      },
      {
        target: '[data-guide-id="settings-menu-item"]',
        content: 'Click "Settings" to open your account settings, then navigate to the Account tab to manage your MFA/DUO authentication.',
        placement: 'right',
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
