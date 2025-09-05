import { INDUSTRIES } from './industries';

export interface DefaultDocumentRequirement {
  document_type: string;
  document_name: string;
  description: string;
  is_required: boolean;
  display_order: number;
  template_file_path?: string;
  template_file_name?: string;
}

export interface DefaultFormField {
  field_type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'number' | 'date' | 'file';
  field_label: string;
  field_description?: string;
  is_required: boolean;
  field_order: number;
  field_options?: string[];
}

export interface DefaultOnboardingTemplate {
  industry: string;
  default_welcome_message: string;
  allow_branch_selection: boolean;
  require_branch_selection: boolean;
  auto_approve_standard_docs: boolean;
  require_all_documents: boolean;
  expires_days: number;
  document_requirements: DefaultDocumentRequirement[];
  form_fields: DefaultFormField[];
}

// Common document types across all industries
const COMMON_DOCUMENTS: DefaultDocumentRequirement[] = [
  {
    document_type: 'business_license',
    document_name: 'Business License',
    description: 'Valid business registration or operating license',
    is_required: true,
    display_order: 1
  },
  {
    document_type: 'insurance_certificate',
    document_name: 'Insurance Certificate',
    description: 'General liability insurance certificate',
    is_required: true,
    display_order: 2
  },
  {
    document_type: 'tax_certificate',
    document_name: 'Tax Certificate',
    description: 'Tax identification or exemption certificate',
    is_required: true,
    display_order: 3
  },
  {
    document_type: 'bank_verification',
    document_name: 'Bank Account Verification',
    description: 'Banking information for payment processing',
    is_required: false,
    display_order: 4
  }
];

// Common form fields across all industries
const COMMON_FORM_FIELDS: DefaultFormField[] = [
  {
    field_type: 'text',
    field_label: 'Primary Contact Person',
    field_description: 'Name of the main contact for business matters',
    is_required: true,
    field_order: 1
  },
  {
    field_type: 'email',
    field_label: 'Business Email',
    field_description: 'Primary business email address',
    is_required: true,
    field_order: 2
  },
  {
    field_type: 'phone',
    field_label: 'Business Phone',
    field_description: 'Primary business phone number',
    is_required: true,
    field_order: 3
  },
  {
    field_type: 'select',
    field_label: 'Years in Business',
    field_description: 'How long has your company been operating?',
    is_required: true,
    field_order: 4,
    field_options: ['Less than 1 year', '1-3 years', '3-5 years', '5-10 years', '10+ years']
  },
  {
    field_type: 'select',
    field_label: 'Annual Revenue Range',
    field_description: 'Approximate annual revenue (optional)',
    is_required: false,
    field_order: 5,
    field_options: ['Under $100K', '$100K - $500K', '$500K - $1M', '$1M - $5M', '$5M - $10M', '$10M+', 'Prefer not to say']
  },
  {
    field_type: 'textarea',
    field_label: 'Company Capabilities',
    field_description: 'Brief description of your products/services and key capabilities',
    is_required: true,
    field_order: 6
  }
];

// Industry-specific templates
export const DEFAULT_ONBOARDING_TEMPLATES: DefaultOnboardingTemplate[] = [
  {
    industry: 'Technology',
    default_welcome_message: 'Welcome to our technology supplier network! We\'re excited to explore how your innovative solutions can support our digital transformation initiatives. Please complete the onboarding process to begin our partnership.',
    allow_branch_selection: true,
    require_branch_selection: false,
    auto_approve_standard_docs: false,
    require_all_documents: true,
    expires_days: 14,
    document_requirements: [
      ...COMMON_DOCUMENTS,
      {
        document_type: 'security_certification',
        document_name: 'Security Certification',
        description: 'SOC 2, ISO 27001, or equivalent security certification',
        is_required: true,
        display_order: 5
      },
      {
        document_type: 'data_protection',
        document_name: 'Data Protection Agreement',
        description: 'GDPR compliance and data protection policies',
        is_required: true,
        display_order: 6
      }
    ],
    form_fields: [
      ...COMMON_FORM_FIELDS,
      {
        field_type: 'select',
        field_label: 'Technology Stack',
        field_description: 'Primary technology platforms you work with',
        is_required: true,
        field_order: 7,
        field_options: ['Cloud/AWS/Azure', 'On-Premise Solutions', 'Hybrid Infrastructure', 'SaaS Applications', 'Mobile Development', 'AI/ML Solutions']
      },
      {
        field_type: 'checkbox',
        field_label: 'Security Certifications',
        field_description: 'Check all that apply',
        is_required: false,
        field_order: 8,
        field_options: ['SOC 2 Type II', 'ISO 27001', 'HIPAA', 'FedRAMP', 'PCI DSS']
      }
    ]
  },
  {
    industry: 'Manufacturing',
    default_welcome_message: 'Welcome to our manufacturing supplier network! We value quality, reliability, and operational excellence. Please complete the onboarding process to demonstrate your capabilities and compliance standards.',
    allow_branch_selection: true,
    require_branch_selection: true,
    auto_approve_standard_docs: false,
    require_all_documents: true,
    expires_days: 21,
    document_requirements: [
      ...COMMON_DOCUMENTS,
      {
        document_type: 'iso_certification',
        document_name: 'ISO 9001 Certification',
        description: 'Quality management system certification',
        is_required: true,
        display_order: 5
      },
      {
        document_type: 'safety_certificate',
        document_name: 'Safety Compliance Certificate',
        description: 'OSHA compliance and safety management documentation',
        is_required: true,
        display_order: 6
      },
      {
        document_type: 'environmental_cert',
        document_name: 'Environmental Certification',
        description: 'ISO 14001 or equivalent environmental management',
        is_required: false,
        display_order: 7
      }
    ],
    form_fields: [
      ...COMMON_FORM_FIELDS,
      {
        field_type: 'select',
        field_label: 'Manufacturing Capabilities',
        field_description: 'Primary manufacturing processes',
        is_required: true,
        field_order: 7,
        field_options: ['Machining/CNC', 'Assembly', 'Injection Molding', 'Metal Fabrication', 'Electronics', 'Textiles', 'Chemical Processing']
      },
      {
        field_type: 'number',
        field_label: 'Production Capacity per Month',
        field_description: 'Units per month (if applicable)',
        is_required: false,
        field_order: 8
      },
      {
        field_type: 'checkbox',
        field_label: 'Quality Certifications',
        field_description: 'Check all that apply',
        is_required: false,
        field_order: 9,
        field_options: ['ISO 9001', 'ISO 14001', 'AS9100', 'TS 16949', 'Six Sigma']
      }
    ]
  },
  {
    industry: 'Healthcare',
    default_welcome_message: 'Welcome to our healthcare supplier network! Patient safety and regulatory compliance are our top priorities. Please complete the comprehensive onboarding process to ensure all requirements are met.',
    allow_branch_selection: true,
    require_branch_selection: false,
    auto_approve_standard_docs: false,
    require_all_documents: true,
    expires_days: 30,
    document_requirements: [
      ...COMMON_DOCUMENTS,
      {
        document_type: 'fda_registration',
        document_name: 'FDA Registration',
        description: 'FDA facility registration or device listing (if applicable)',
        is_required: true,
        display_order: 5
      },
      {
        document_type: 'hipaa_compliance',
        document_name: 'HIPAA Compliance Certificate',
        description: 'Healthcare data privacy and security compliance',
        is_required: true,
        display_order: 6
      },
      {
        document_type: 'clinical_quality',
        document_name: 'Clinical Quality Certification',
        description: 'ISO 13485 or equivalent medical device quality system',
        is_required: false,
        display_order: 7
      }
    ],
    form_fields: [
      ...COMMON_FORM_FIELDS,
      {
        field_type: 'select',
        field_label: 'Healthcare Specialty',
        field_description: 'Primary area of healthcare focus',
        is_required: true,
        field_order: 7,
        field_options: ['Medical Devices', 'Pharmaceuticals', 'Healthcare IT', 'Clinical Services', 'Laboratory Services', 'Facilities Management']
      },
      {
        field_type: 'checkbox',
        field_label: 'Regulatory Compliance',
        field_description: 'Check all that apply',
        is_required: true,
        field_order: 8,
        field_options: ['FDA Registered', 'HIPAA Compliant', 'ISO 13485', 'Good Manufacturing Practice (GMP)', 'Clinical Laboratory Improvement (CLIA)']
      }
    ]
  },
  {
    industry: 'Construction',
    default_welcome_message: 'Welcome to our construction supplier network! Safety, quality, and timely delivery are essential to our projects. Please complete the onboarding process to demonstrate your capabilities and safety standards.',
    allow_branch_selection: true,
    require_branch_selection: true,
    auto_approve_standard_docs: false,
    require_all_documents: true,
    expires_days: 14,
    document_requirements: [
      ...COMMON_DOCUMENTS,
      {
        document_type: 'contractor_license',
        document_name: 'Contractor License',
        description: 'Valid contractor license for relevant trade/specialty',
        is_required: true,
        display_order: 5
      },
      {
        document_type: 'safety_certificate',
        document_name: 'Safety Program Certificate',
        description: 'OSHA 30-hour certification and safety management plan',
        is_required: true,
        display_order: 6
      },
      {
        document_type: 'bonding_capacity',
        document_name: 'Bonding Capacity Letter',
        description: 'Surety bonding capacity documentation',
        is_required: false,
        display_order: 7
      }
    ],
    form_fields: [
      ...COMMON_FORM_FIELDS,
      {
        field_type: 'select',
        field_label: 'Construction Specialty',
        field_description: 'Primary construction services',
        is_required: true,
        field_order: 7,
        field_options: ['General Contracting', 'Electrical', 'Plumbing', 'HVAC', 'Concrete/Masonry', 'Roofing', 'Flooring', 'Painting', 'Landscaping']
      },
      {
        field_type: 'select',
        field_label: 'Project Size Capacity',
        field_description: 'Maximum project value you can handle',
        is_required: true,
        field_order: 8,
        field_options: ['Under $50K', '$50K - $250K', '$250K - $1M', '$1M - $5M', '$5M+']
      },
      {
        field_type: 'checkbox',
        field_label: 'Safety Certifications',
        field_description: 'Check all that apply',
        is_required: false,
        field_order: 9,
        field_options: ['OSHA 30-Hour', 'OSHA 10-Hour', 'First Aid/CPR', 'Confined Space', 'Fall Protection', 'Hazmat']
      }
    ]
  }
];

// Add templates for remaining industries with common settings
const GENERIC_INDUSTRIES = INDUSTRIES.filter(industry => 
  !DEFAULT_ONBOARDING_TEMPLATES.find(template => template.industry === industry)
);

GENERIC_INDUSTRIES.forEach(industry => {
  DEFAULT_ONBOARDING_TEMPLATES.push({
    industry,
    default_welcome_message: `Welcome to our ${industry.toLowerCase()} supplier network! We look forward to building a successful partnership. Please complete the onboarding process to get started.`,
    allow_branch_selection: true,
    require_branch_selection: false,
    auto_approve_standard_docs: false,
    require_all_documents: true,
    expires_days: 14,
    document_requirements: COMMON_DOCUMENTS,
    form_fields: COMMON_FORM_FIELDS
  });
});

export const getTemplateForIndustry = (industry: string): DefaultOnboardingTemplate | null => {
  return DEFAULT_ONBOARDING_TEMPLATES.find(template => template.industry === industry) || null;
};

export const getWelcomeMessageForIndustry = (industry: string): string => {
  const template = getTemplateForIndustry(industry);
  return template?.default_welcome_message || 
    'Welcome to our supplier network! We look forward to building a successful partnership. Please complete the onboarding process to get started.';
};