// Workspace Profile: terminology pack + feature flags driven by the buyer's industry.
// An "Auditor" is a buyer whose clients are stored as suppliers — no schema fork.
// An "Auditee" is a supplier whose connected buyers are auditing firms / customers.

export type WorkspaceProfileId = 'default' | 'auditor' | 'auditee';

export interface WorkspaceTerms {
  // Buyer-side (how a buyer refers to its connected suppliers)
  supplier: string;
  suppliers: string;
  supplier_profile: string;
  supplier_risk: string;
  supplier_risk_report: string;
  connected_suppliers: string;
  onboarding: string;
  onboarding_pipeline: string;
  document_request: string;
  document_requests: string;
  compliance_compass: string;
  workspace_label: string;

  // Supplier-side (how a supplier refers to its connected buyers)
  buyer: string;
  buyers: string;
  connected_buyers: string;
  buyer_connections: string;
  supplier_compliance: string;
}

export interface WorkspaceFlags {
  showAuditFindings: boolean;
  showEngagementDocs: boolean;
  hideCOAAnalysis: boolean;
  hideItemCompliance: boolean;
  hideFacilityMatrix: boolean;
  hidePrePopulate: boolean;
  hideBuyerSamples: boolean;
  hideSupplierMap: boolean;
  hideQuickActions?: boolean;
  defaultEntityType?: string;
  lockEntityType?: boolean;
  showEvidenceLibrary?: boolean;
}

export interface WorkspaceProfile {
  id: WorkspaceProfileId;
  terms: WorkspaceTerms;
  flags: WorkspaceFlags;
}

const DEFAULT_TERMS: WorkspaceTerms = {
  supplier: 'Supplier',
  suppliers: 'Suppliers',
  supplier_profile: 'Supplier Profile',
  supplier_risk: 'Supplier Risk',
  supplier_risk_report: 'Supplier Risk Report',
  connected_suppliers: 'Connected Suppliers',
  onboarding: 'Onboarding',
  onboarding_pipeline: 'Onboarding Pipeline',
  document_request: 'Document Request',
  document_requests: 'Document Requests',
  compliance_compass: 'Compliance Compass',
  workspace_label: 'Buyer Workspace',
  buyer: 'Buyer',
  buyers: 'Buyers',
  connected_buyers: 'Connected Buyers',
  buyer_connections: 'Buyer Connections',
  supplier_compliance: 'Compliance',
};

export const DEFAULT_PROFILE: WorkspaceProfile = {
  id: 'default',
  terms: DEFAULT_TERMS,
  flags: {
    showAuditFindings: false,
    showEngagementDocs: false,
    hideCOAAnalysis: false,
    hideItemCompliance: false,
    hideFacilityMatrix: false,
    hidePrePopulate: false,
    hideBuyerSamples: false,
    hideSupplierMap: false,
    hideQuickActions: false,
  },
};

export const AUDITOR_PROFILE: WorkspaceProfile = {
  id: 'auditor',
  terms: {
    ...DEFAULT_TERMS,
    supplier: 'Client',
    suppliers: 'Clients',
    supplier_profile: 'Client Profile',
    supplier_risk: 'Audit Risk',
    supplier_risk_report: 'Client Audit Risk Report',
    connected_suppliers: 'Active Clients',
    onboarding: 'Engagement',
    onboarding_pipeline: 'Engagement Pipeline',
    document_request: 'Evidence Request',
    document_requests: 'Evidence Requests',
    compliance_compass: 'Audit Assistant',
    workspace_label: 'Auditor Workspace',
  },
  flags: {
    showAuditFindings: true,
    showEngagementDocs: true,
    hideCOAAnalysis: true,
    hideItemCompliance: true,
    hideFacilityMatrix: true,
    hidePrePopulate: true,
    hideBuyerSamples: true,
    hideSupplierMap: true,
    defaultEntityType: 'Auditor',
    lockEntityType: true,
  },
};

export const AUDITEE_PROFILE: WorkspaceProfile = {
  id: 'auditee',
  terms: {
    ...DEFAULT_TERMS,
    // Supplier-side relabels: connected buyers are auditing firms / customers
    buyer: 'Customer',
    buyers: 'Customers',
    connected_buyers: 'Active Customers',
    buyer_connections: 'Customer Connections',
    document_request: 'Evidence Request',
    document_requests: 'Evidence Requests',
    supplier_compliance: 'Audit Readiness',
    workspace_label: 'Auditee Workspace',
  },
  flags: {
    showAuditFindings: false,
    showEngagementDocs: true,
    hideCOAAnalysis: true,
    hideItemCompliance: true,
    hideFacilityMatrix: true,
    hidePrePopulate: true,
    hideBuyerSamples: true,
    hideSupplierMap: true,
    showEvidenceLibrary: true,
  },
};

export function getWorkspaceProfileForIndustry(industry?: string | null): WorkspaceProfile {
  if (industry === 'Auditor') return AUDITOR_PROFILE;
  if (industry === 'Auditee') return AUDITEE_PROFILE;
  return DEFAULT_PROFILE;
}
