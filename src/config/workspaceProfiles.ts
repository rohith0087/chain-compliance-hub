// Workspace Profile: terminology pack + feature flags driven by the buyer's industry.
// An "Auditor" is a buyer whose clients are stored as suppliers — no schema fork.

export type WorkspaceProfileId = 'default' | 'auditor';

export interface WorkspaceTerms {
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
}

export interface WorkspaceFlags {
  showAuditFindings: boolean;
  showEngagementDocs: boolean;
}

export interface WorkspaceProfile {
  id: WorkspaceProfileId;
  terms: WorkspaceTerms;
  flags: WorkspaceFlags;
}

export const DEFAULT_PROFILE: WorkspaceProfile = {
  id: 'default',
  terms: {
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
  },
  flags: {
    showAuditFindings: false,
    showEngagementDocs: false,
  },
};

export const AUDITOR_PROFILE: WorkspaceProfile = {
  id: 'auditor',
  terms: {
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
  },
};

export function getWorkspaceProfileForIndustry(industry?: string | null): WorkspaceProfile {
  if (industry === 'Auditor') return AUDITOR_PROFILE;
  return DEFAULT_PROFILE;
}
