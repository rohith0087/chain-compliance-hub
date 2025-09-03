import { 
  FileText, 
  Shield, 
  Truck, 
  Building2, 
  Users, 
  ClipboardCheck,
  AlertTriangle,
  Factory,
  Leaf,
  Zap,
  Globe,
  Heart,
  Lock,
  Award,
  CheckCircle,
  Settings,
  MapPin,
  ClipboardList,
  CheckSquare
} from 'lucide-react';

export interface ComplianceDocument {
  id: string;
  title: string;
  category: string;
  description: string;
  icon: typeof Shield;
  required: boolean;
  regulatoryBody: string;
  template: {
    sections: Array<{ name: string; required: boolean }>;
  };
}

export const getComplianceDocuments = (userType: string): ComplianceDocument[] => {
  if (userType === 'Chicken Processor Co') {
    return [
      {
        id: 'haccp-plan',
        title: 'HACCP Plan',
        category: 'FDA Compliance',
        description: 'Hazard Analysis and Critical Control Points plan for food safety',
        icon: Shield,
        required: true,
        regulatoryBody: 'FDA',
        template: {
          sections: [
            { name: 'Hazard Analysis', required: true },
            { name: 'Critical Control Points', required: true },
            { name: 'Critical Limits', required: true },
            { name: 'Monitoring Procedures', required: true },
            { name: 'Corrective Actions', required: true },
            { name: 'Verification Procedures', required: true },
            { name: 'Record Keeping', required: true }
          ]
        }
      },
      {
        id: 'ssop',
        title: 'Sanitation SOPs',
        category: 'USDA/FSIS',
        description: 'Sanitation Standard Operating Procedures',
        icon: ClipboardCheck,
        required: true,
        regulatoryBody: 'USDA/FSIS',
        template: {
          sections: [
            { name: 'Pre-operational Sanitation', required: true },
            { name: 'Operational Sanitation', required: true },
            { name: 'Cleaning Procedures', required: true },
            { name: 'Sanitizing Procedures', required: true }
          ]
        }
      },
      {
        id: 'supplier-verification',
        title: 'Supplier Verification Program',
        category: 'FSMA',
        description: 'Supplier verification and approval documentation',
        icon: Users,
        required: true,
        regulatoryBody: 'FDA/FSMA',
        template: {
          sections: [
            { name: 'Supplier Approval Process', required: true },
            { name: 'Risk Assessment', required: true },
            { name: 'Verification Activities', required: true },
            { name: 'Corrective Actions', required: true }
          ]
        }
      },
      {
        id: 'pathogen-testing',
        title: 'Pathogen Testing Records',
        category: 'FSIS',
        description: 'Salmonella and other pathogen testing documentation',
        icon: AlertTriangle,
        required: true,
        regulatoryBody: 'FSIS',
        template: {
          sections: [
            { name: 'Testing Schedule', required: true },
            { name: 'Sample Collection Procedures', required: true },
            { name: 'Test Results', required: true },
            { name: 'Corrective Actions', required: true }
          ]
        }
      },
      {
        id: 'transport-temp',
        title: 'Temperature Control Records',
        category: 'Transportation',
        description: 'Cold chain maintenance and temperature monitoring',
        icon: Truck,
        required: true,
        regulatoryBody: 'FDA',
        template: {
          sections: [
            { name: 'Temperature Monitoring Plan', required: true },
            { name: 'Equipment Calibration', required: true },
            { name: 'Transport Records', required: true },
            { name: 'Deviation Reports', required: true }
          ]
        }
      },
      {
        id: 'facility-registration',
        title: 'FDA Facility Registration',
        category: 'FDA Registration',
        description: 'Current FDA facility registration certificate',
        icon: Building2,
        required: true,
        regulatoryBody: 'FDA',
        template: {
          sections: [
            { name: 'Registration Number', required: true },
            { name: 'Facility Information', required: true },
            { name: 'Process Categories', required: true },
            { name: 'Renewal Date', required: true }
          ]
        }
      }
    ];
  }
  
  // Comprehensive document library for all industries
  return [
    // Quality Management
    {
      id: 'iso-9001',
      title: 'ISO 9001 Certificate',
      category: 'Quality Management',
      description: 'Current ISO 9001 quality management system certification',
      icon: Award,
      required: true,
      regulatoryBody: 'ISO',
      template: {
        sections: [
          { name: 'Certificate Details', required: true },
          { name: 'Scope of Certification', required: true },
          { name: 'Validity Period', required: true },
          { name: 'Audit Reports', required: false }
        ]
      }
    },
    {
      id: 'iso-14001',
      title: 'ISO 14001 Environmental Certificate',
      category: 'Environmental Management',
      description: 'Environmental management system certification',
      icon: Leaf,
      required: false,
      regulatoryBody: 'ISO',
      template: {
        sections: [
          { name: 'Environmental Policy', required: true },
          { name: 'Environmental Aspects', required: true },
          { name: 'Legal Compliance', required: true },
          { name: 'Performance Monitoring', required: true }
        ]
      }
    },
    // Insurance & Liability
    {
      id: 'general-liability',
      title: 'General Liability Insurance',
      category: 'Insurance',
      description: 'General and product liability insurance coverage',
      icon: Shield,
      required: true,
      regulatoryBody: 'Insurance Provider',
      template: {
        sections: [
          { name: 'Policy Number', required: true },
          { name: 'Coverage Amount', required: true },
          { name: 'Effective Dates', required: true },
          { name: 'Beneficiaries', required: true }
        ]
      }
    },
    {
      id: 'professional-indemnity',
      title: 'Professional Indemnity Insurance',
      category: 'Insurance',
      description: 'Professional liability and errors & omissions coverage',
      icon: FileText,
      required: false,
      regulatoryBody: 'Insurance Provider',
      template: {
        sections: [
          { name: 'Coverage Scope', required: true },
          { name: 'Policy Limits', required: true },
          { name: 'Exclusions', required: true },
          { name: 'Claims History', required: false }
        ]
      }
    },
    // Health & Safety
    {
      id: 'ohsas-18001',
      title: 'OHSAS 18001 Certificate',
      category: 'Health & Safety',
      description: 'Occupational health and safety management system',
      icon: Heart,
      required: true,
      regulatoryBody: 'OHSAS',
      template: {
        sections: [
          { name: 'Safety Policy', required: true },
          { name: 'Risk Assessment', required: true },
          { name: 'Training Records', required: true },
          { name: 'Incident Reports', required: true }
        ]
      }
    },
    {
      id: 'safety-data-sheets',
      title: 'Safety Data Sheets (SDS)',
      category: 'Health & Safety',
      description: 'Material safety data sheets for all chemicals and hazardous materials',
      icon: AlertTriangle,
      required: true,
      regulatoryBody: 'OSHA',
      template: {
        sections: [
          { name: 'Chemical Identification', required: true },
          { name: 'Hazard Information', required: true },
          { name: 'First Aid Measures', required: true },
          { name: 'Handling & Storage', required: true }
        ]
      }
    },
    // Information Security
    {
      id: 'iso-27001',
      title: 'ISO 27001 Information Security',
      category: 'Information Security',
      description: 'Information security management system certification',
      icon: Lock,
      required: false,
      regulatoryBody: 'ISO',
      template: {
        sections: [
          { name: 'Security Policy', required: true },
          { name: 'Risk Assessment', required: true },
          { name: 'Access Controls', required: true },
          { name: 'Incident Management', required: true }
        ]
      }
    },
    {
      id: 'data-protection',
      title: 'Data Protection Compliance',
      category: 'Information Security',
      description: 'GDPR and data protection compliance documentation',
      icon: Globe,
      required: true,
      regulatoryBody: 'Data Protection Authority',
      template: {
        sections: [
          { name: 'Privacy Policy', required: true },
          { name: 'Data Processing Records', required: true },
          { name: 'Consent Management', required: true },
          { name: 'Breach Response Plan', required: true }
        ]
      }
    },
    // Manufacturing & Industrial
    {
      id: 'manufacturing-license',
      title: 'Manufacturing License',
      category: 'Manufacturing',
      description: 'Valid manufacturing or production facility license',
      icon: Factory,
      required: true,
      regulatoryBody: 'Industry Authority',
      template: {
        sections: [
          { name: 'License Number', required: true },
          { name: 'Permitted Activities', required: true },
          { name: 'Facility Details', required: true },
          { name: 'Renewal Date', required: true }
        ]
      }
    },
    {
      id: 'equipment-calibration',
      title: 'Equipment Calibration Records',
      category: 'Manufacturing',
      description: 'Calibration certificates for critical equipment and instruments',
      icon: CheckCircle,
      required: true,
      regulatoryBody: 'Calibration Authority',
      template: {
        sections: [
          { name: 'Equipment Inventory', required: true },
          { name: 'Calibration Schedule', required: true },
          { name: 'Calibration Certificates', required: true },
          { name: 'Maintenance Records', required: true }
        ]
      }
    },
    // Energy & Utilities
    {
      id: 'energy-efficiency',
      title: 'Energy Efficiency Certificate',
      category: 'Energy Management',
      description: 'Energy management and efficiency compliance documentation',
      icon: Zap,
      required: false,
      regulatoryBody: 'Energy Authority',
      template: {
        sections: [
          { name: 'Energy Audit', required: true },
          { name: 'Efficiency Measures', required: true },
          { name: 'Consumption Data', required: true },
          { name: 'Improvement Plan', required: false }
        ]
      }
    },
    // Financial & Tax
    {
      id: 'tax-compliance',
      title: 'Tax Compliance Certificate',
      category: 'Financial Compliance',
      description: 'Current tax compliance and clearance certificates',
      icon: FileText,
      required: true,
      regulatoryBody: 'Tax Authority',
      template: {
        sections: [
          { name: 'Tax Registration', required: true },
          { name: 'Compliance Status', required: true },
          { name: 'Payment History', required: true },
          { name: 'Outstanding Liabilities', required: true }
        ]
      }
    },
    {
      id: 'financial-statements',
      title: 'Audited Financial Statements',
      category: 'Financial Compliance',
      description: 'Latest audited financial statements and reports',
      icon: Building2,
      required: true,
      regulatoryBody: 'Accounting Standards Board',
      template: {
        sections: [
          { name: 'Balance Sheet', required: true },
          { name: 'Income Statement', required: true },
          { name: 'Cash Flow Statement', required: true },
          { name: 'Auditor Report', required: true }
        ]
      }
    },
    // Transportation & Logistics
    {
      id: 'transport-license',
      title: 'Transportation License',
      category: 'Transportation',
      description: 'Valid commercial transportation and logistics permits',
      icon: Truck,
      required: false,
      regulatoryBody: 'Transport Authority',
      template: {
        sections: [
          { name: 'License Details', required: true },
          { name: 'Vehicle Fleet', required: true },
          { name: 'Driver Qualifications', required: true },
          { name: 'Insurance Coverage', required: true }
        ]
      }
    },
    
    // Risk Control
    {
      id: 'allergen-survey',
      title: 'Allergen Survey',
      category: 'Risk Control',
      description: 'Comprehensive allergen control and management survey',
      icon: AlertTriangle,
      required: true,
      regulatoryBody: 'FDA',
      template: {
        sections: [
          { name: 'Allergen Identification', required: true },
          { name: 'Control Measures', required: true },
          { name: 'Cross-contamination Prevention', required: true },
          { name: 'Testing Protocols', required: true },
          { name: 'Staff Training Records', required: true }
        ]
      }
    },
    {
      id: 'process-change-agreement',
      title: 'Process Change Agreement',
      category: 'Risk Control',
      description: 'Agreement for manufacturing process modifications and risk assessment',
      icon: Settings,
      required: true,
      regulatoryBody: 'FDA',
      template: {
        sections: [
          { name: 'Current Process Description', required: true },
          { name: 'Proposed Changes', required: true },
          { name: 'Risk Assessment', required: true },
          { name: 'Approval Signatures', required: true },
          { name: 'Implementation Timeline', required: true }
        ]
      }
    },
    
    // Traceability
    {
      id: 'approved-supplier-locations',
      title: 'Approved Supplier Locations',
      category: 'Traceability',
      description: 'Documentation of approved supplier facilities and locations',
      icon: MapPin,
      required: true,
      regulatoryBody: 'FDA',
      template: {
        sections: [
          { name: 'Facility Information', required: true },
          { name: 'Location Details', required: true },
          { name: 'Approval Status', required: true },
          { name: 'Audit History', required: true },
          { name: 'Contact Information', required: true }
        ]
      }
    },
    
    // Onboarding/Approval
    {
      id: 'supplier-questionnaire',
      title: 'Supplier Questionnaire',
      category: 'Onboarding/Approval',
      description: 'Comprehensive supplier onboarding and approval questionnaire',
      icon: ClipboardList,
      required: true,
      regulatoryBody: 'Internal',
      template: {
        sections: [
          { name: 'Company Information', required: true },
          { name: 'Quality Management System', required: true },
          { name: 'Certifications and Accreditations', required: true },
          { name: 'Financial Information', required: true },
          { name: 'References', required: true }
        ]
      }
    },
    
    // Ethical Sourcing
    {
      id: 'code-of-conduct',
      title: 'Code of Conduct',
      category: 'Ethical Sourcing',
      description: 'Supplier code of conduct agreement and compliance documentation',
      icon: Users,
      required: true,
      regulatoryBody: 'Internal',
      template: {
        sections: [
          { name: 'Labor Practices', required: true },
          { name: 'Environmental Responsibility', required: true },
          { name: 'Business Ethics', required: true },
          { name: 'Human Rights', required: true },
          { name: 'Compliance Acknowledgment', required: true }
        ]
      }
    },
    
    // Audit Readiness
    {
      id: 'supplier-checklist',
      title: 'Supplier Checklist',
      category: 'Audit Readiness',
      description: 'Pre-audit checklist and readiness assessment for suppliers',
      icon: CheckSquare,
      required: false,
      regulatoryBody: 'Internal',
      template: {
        sections: [
          { name: 'Documentation Review', required: true },
          { name: 'Facility Preparation', required: true },
          { name: 'Personnel Availability', required: true },
          { name: 'System Access', required: true },
          { name: 'Corrective Actions', required: false }
        ]
      }
    }
  ];
};
