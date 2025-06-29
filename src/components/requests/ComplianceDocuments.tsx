
import { 
  FileText, 
  Shield, 
  Truck, 
  Building2, 
  Users, 
  ClipboardCheck,
  AlertTriangle
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
  
  // Default templates for other industries
  return [
    {
      id: 'iso-certificate',
      title: 'ISO 9001 Certificate',
      category: 'Quality Management',
      description: 'Current ISO 9001 quality management certification',
      icon: Shield,
      required: true,
      regulatoryBody: 'ISO',
      template: {
        sections: [
          { name: 'Certificate Details', required: true },
          { name: 'Scope of Certification', required: true },
          { name: 'Validity Period', required: true }
        ]
      }
    },
    {
      id: 'insurance',
      title: 'Liability Insurance',
      category: 'Insurance',
      description: 'General and product liability insurance coverage',
      icon: FileText,
      required: true,
      regulatoryBody: 'Insurance Provider',
      template: {
        sections: [
          { name: 'Policy Number', required: true },
          { name: 'Coverage Amount', required: true },
          { name: 'Effective Dates', required: true }
        ]
      }
    }
  ];
};

export const suppliers = [
  'Premium Farms LLC',
  'FreshSource Distributors',
  'Quality Feed Solutions',
  'Organic Valley Suppliers',
  'Regional Transport Co.'
];
