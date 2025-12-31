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
  company_logo_url: null,
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
  expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
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
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    buyer_id: 'sim-buyer-001',
    supplier_id: 'sim-supplier-001',
    buyers: simulationBuyer,
  },
  {
    id: 'sim-request-002',
    title: 'Product Liability Insurance',
    document_type: 'insurance',
    category: 'Insurance',
    description: 'Updated product liability insurance documentation',
    status: 'pending',
    priority: 'medium',
    due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    buyer_id: 'sim-buyer-001',
    supplier_id: 'sim-supplier-001',
    buyers: simulationBuyer,
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
    buyers: simulationBuyer,
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
    buyers: simulationBuyer,
  },
];

// Document uploads for the Documents tab
export const simulationDocumentUploads = [
  {
    id: 'sim-upload-001',
    request_id: 'sim-request-003',
    file_name: 'allergen_control_plan_2024.pdf',
    file_path: '/uploads/sim/allergen_control_plan_2024.pdf',
    file_size: 245000,
    mime_type: 'application/pdf',
    status: 'submitted',
    expiration_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    document_requests: {
      id: 'sim-request-003',
      title: 'Allergen Control Plan',
      document_type: 'allergen_control',
      category: 'Food Safety',
      buyers: simulationBuyer,
    },
  },
  {
    id: 'sim-upload-002',
    request_id: 'sim-request-004',
    file_name: 'iso_22000_certificate.pdf',
    file_path: '/uploads/sim/iso_22000_certificate.pdf',
    file_size: 189000,
    mime_type: 'application/pdf',
    status: 'approved',
    expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    approved_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    document_requests: {
      id: 'sim-request-004',
      title: 'Quality Assurance Certificate',
      document_type: 'qa_cert',
      category: 'Quality',
      buyers: simulationBuyer,
    },
  },
];

// Document library items
export const simulationLibraryDocuments = [
  {
    id: 'sim-lib-001',
    document_name: 'Company Business License 2024',
    document_type: 'business_license',
    category: 'Legal',
    file_path: '/library/sim/business_license_2024.pdf',
    file_size: 156000,
    mime_type: 'application/pdf',
    expiration_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    version: 1,
    is_current_version: true,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['legal', 'annual'],
  },
  {
    id: 'sim-lib-002',
    document_name: 'General Liability Insurance',
    document_type: 'insurance_certificate',
    category: 'Insurance',
    file_path: '/library/sim/liability_insurance.pdf',
    file_size: 234000,
    mime_type: 'application/pdf',
    expiration_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    version: 2,
    is_current_version: true,
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['insurance', 'liability'],
  },
  {
    id: 'sim-lib-003',
    document_name: 'HACCP Certification',
    document_type: 'food_safety_cert',
    category: 'Food Safety',
    file_path: '/library/sim/haccp_cert.pdf',
    file_size: 178000,
    mime_type: 'application/pdf',
    expiration_date: new Date(Date.now() + 270 * 24 * 60 * 60 * 1000).toISOString(),
    version: 1,
    is_current_version: true,
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['food-safety', 'haccp', 'certification'],
  },
  {
    id: 'sim-lib-004',
    document_name: 'Product Specification Sheet',
    document_type: 'product_spec',
    category: 'Product',
    file_path: '/library/sim/product_specs.pdf',
    file_size: 456000,
    mime_type: 'application/pdf',
    expiration_date: null,
    version: 3,
    is_current_version: true,
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    tags: ['product', 'specifications'],
  },
];

// Connected buyers for the Connections tab
export const simulationConnectedBuyers = [
  {
    id: 'sim-connection-active-001',
    buyer_id: 'sim-buyer-001',
    supplier_id: 'sim-supplier-001',
    status: 'approved',
    requested_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    responded_at: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString(),
    buyers: simulationBuyer,
    unifiedStatus: 'fullyConnected',
    supplier_onboarding_requests: [{
      id: 'sim-onboarding-001',
      status: 'approved',
      approved_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
    }],
  },
];

// Expiring documents for the overview
export const simulationExpiringDocuments = [
  {
    id: 'sim-expiring-001',
    title: 'Workers Compensation Insurance',
    buyer_name: 'Acme Fresh Foods Inc.',
    expiration_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    days_until_expiry: -2,
    is_expired: true,
    request_id: 'sim-request-expired-001',
  },
  {
    id: 'sim-expiring-002',
    title: 'Health Department Permit',
    buyer_name: 'Acme Fresh Foods Inc.',
    expiration_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    days_until_expiry: 5,
    is_expired: false,
    request_id: 'sim-request-expiring-002',
  },
  {
    id: 'sim-expiring-003',
    title: 'Organic Certification',
    buyer_name: 'Acme Fresh Foods Inc.',
    expiration_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
    days_until_expiry: 15,
    is_expired: false,
    request_id: 'sim-request-expiring-003',
  },
];

// Activity trend for charts
export const simulationActivityTrend = [
  { day: 'Thu', requests: 2, completed: 1 },
  { day: 'Fri', requests: 1, completed: 1 },
  { day: 'Sat', requests: 0, completed: 0 },
  { day: 'Sun', requests: 0, completed: 0 },
  { day: 'Mon', requests: 3, completed: 2 },
  { day: 'Tue', requests: 1, completed: 0 },
  { day: 'Wed', requests: 2, completed: 1 },
];

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
