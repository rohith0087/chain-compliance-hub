// Supplier Simulation Mock Data
// This file contains all fake data for the supplier simulation/training environment

export const simulationBuyer = {
  id: 'sim-buyer-001',
  company_name: 'Acme Fresh Foods Inc.',
  industry: 'Food Distribution',
  contact_email: 'procurement@acmefreshfoods.com',
  phone: '+1 (555) 123-4567',
  address: '123 Commerce Boulevard, Suite 500',
  city: 'San Francisco',
  state: 'CA',
  country: 'United States',
  postal_code: '94102',
  company_logo_url: null,
  created_at: new Date().toISOString(),
};

export const simulationConnectionRequest = {
  id: 'sim-connection-001',
  buyer_id: 'sim-buyer-001',
  supplier_id: 'sim-supplier-001',
  status: 'pending',
  initiated_by: 'buyer',
  requested_at: new Date().toISOString(),
  notes: 'We would like to establish a supplier relationship with your company for our west coast distribution network.',
  buyer: simulationBuyer,
};

export const simulationOnboardingRequest = {
  id: 'sim-onboarding-001',
  buyer_id: 'sim-buyer-001',
  supplier_id: 'sim-supplier-001',
  status: 'pending',
  can_choose_branches: true,
  welcome_message: 'Welcome to Acme Fresh Foods! Please complete the following onboarding requirements to get started as our supplier.',
  expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
  created_at: new Date().toISOString(),
  buyer: simulationBuyer,
};

export const simulationDocumentRequirements = [
  {
    id: 'sim-doc-req-001',
    onboarding_request_id: 'sim-onboarding-001',
    document_type: 'business_license',
    document_name: 'Business License',
    description: 'Current and valid business license for your company',
    is_required: true,
    display_order: 1,
    status: 'pending',
  },
  {
    id: 'sim-doc-req-002',
    onboarding_request_id: 'sim-onboarding-001',
    document_type: 'insurance_certificate',
    document_name: 'Certificate of Insurance',
    description: 'Liability insurance certificate with minimum $1M coverage',
    is_required: true,
    display_order: 2,
    status: 'pending',
  },
  {
    id: 'sim-doc-req-003',
    onboarding_request_id: 'sim-onboarding-001',
    document_type: 'food_safety_cert',
    document_name: 'Food Safety Certification',
    description: 'HACCP or equivalent food safety certification',
    is_required: true,
    display_order: 3,
    status: 'pending',
  },
];

export const simulationFormFields = [
  {
    id: 'sim-form-001',
    onboarding_request_id: 'sim-onboarding-001',
    field_label: 'Primary Contact Name',
    field_type: 'text',
    field_order: 1,
    is_required: true,
    field_description: 'Name of the primary contact person for orders',
  },
  {
    id: 'sim-form-002',
    onboarding_request_id: 'sim-onboarding-001',
    field_label: 'Annual Revenue Range',
    field_type: 'select',
    field_order: 2,
    is_required: true,
    field_options: ['Under $500K', '$500K - $1M', '$1M - $5M', '$5M - $10M', 'Over $10M'],
    field_description: 'Approximate annual revenue of your company',
  },
];

export const simulationDocumentRequests = [
  {
    id: 'sim-request-001',
    title: 'Food Handler Certificate',
    document_type: 'food_handler_cert',
    category: 'Compliance',
    description: 'Current food handler certification for staff handling products',
    status: 'pending',
    priority: 'high',
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    buyer_id: 'sim-buyer-001',
    supplier_id: 'sim-supplier-001',
    buyer: simulationBuyer,
  },
  {
    id: 'sim-request-002',
    title: 'Product Liability Insurance',
    document_type: 'insurance',
    category: 'Insurance',
    description: 'Updated product liability insurance documentation',
    status: 'pending',
    priority: 'medium',
    due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    buyer_id: 'sim-buyer-001',
    supplier_id: 'sim-supplier-001',
    buyer: simulationBuyer,
  },
  {
    id: 'sim-request-003',
    title: 'Allergen Control Plan',
    document_type: 'allergen_control',
    category: 'Food Safety',
    description: 'Documentation of allergen control procedures',
    status: 'submitted',
    priority: 'medium',
    due_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    buyer_id: 'sim-buyer-001',
    supplier_id: 'sim-supplier-001',
    buyer: simulationBuyer,
  },
  {
    id: 'sim-request-004',
    title: 'Quality Assurance Certificate',
    document_type: 'qa_cert',
    category: 'Quality',
    description: 'ISO or equivalent quality assurance certification',
    status: 'approved',
    priority: 'low',
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    buyer_id: 'sim-buyer-001',
    supplier_id: 'sim-supplier-001',
    buyer: simulationBuyer,
  },
];

export const simulationSupplierProfile = {
  id: 'sim-supplier-001',
  company_name: 'Your Demo Company',
  contact_email: 'demo@yourcompany.com',
  phone: '+1 (555) 987-6543',
  industry: 'Food Manufacturing',
  address_line1: '456 Industrial Way',
  city: 'Los Angeles',
  state: 'CA',
  country: 'United States',
  postal_code: '90001',
};

export const simulationComplianceStats = {
  totalRequests: 4,
  pending: 2,
  approved: 1,
  submitted: 1,
  rejected: 0,
  complianceRate: 75,
  connectedBuyers: 1,
  totalUploads: 3,
};

export const simulationSteps = [
  {
    id: 'connect',
    title: 'Accept Connection',
    description: 'Accept the incoming connection request from Acme Fresh Foods',
    completed: false,
  },
  {
    id: 'onboarding-docs',
    title: 'Upload Onboarding Documents',
    description: 'Upload the required documents for onboarding',
    completed: false,
  },
  {
    id: 'onboarding-form',
    title: 'Complete Onboarding Form',
    description: 'Fill out the required information form',
    completed: false,
  },
  {
    id: 'submit-onboarding',
    title: 'Submit Onboarding',
    description: 'Submit your onboarding for buyer review',
    completed: false,
  },
  {
    id: 'view-requests',
    title: 'View Document Requests',
    description: 'Review incoming document requests from the buyer',
    completed: false,
  },
  {
    id: 'submit-document',
    title: 'Submit a Document',
    description: 'Upload and submit a document for one of the requests',
    completed: false,
  },
  {
    id: 'approval',
    title: 'Document Approved',
    description: 'See your document get approved by the buyer',
    completed: false,
  },
];
