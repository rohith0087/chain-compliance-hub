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
  },
  {
    industry: 'Poultry',
    default_welcome_message: 'Welcome to our poultry supplier onboarding process. As a food safety-critical industry, we require comprehensive documentation and compliance verification to ensure the highest standards of quality and safety.',
    allow_branch_selection: true,
    require_branch_selection: false,
    auto_approve_standard_docs: false,
    require_all_documents: true,
    expires_days: 21,
    document_requirements: [
      ...COMMON_DOCUMENTS,
      {
        document_type: 'haccp_plan',
        document_name: 'HACCP Plan',
        description: 'Current Hazard Analysis Critical Control Points (HACCP) plan',
        is_required: true,
        display_order: 5
      },
      {
        document_type: 'fda_registration',
        document_name: 'FDA Facility Registration',
        description: 'FDA facility registration certificate',
        is_required: true,
        display_order: 6
      },
      {
        document_type: 'fsis_establishment',
        document_name: 'FSIS Establishment Number',
        description: 'FSIS establishment number (if applicable for processed products)',
        is_required: false,
        display_order: 7
      },
      {
        document_type: 'ssop_plan',
        document_name: 'SSOP Plan',
        description: 'Sanitation Standard Operating Procedures',
        is_required: true,
        display_order: 8
      },
      {
        document_type: 'food_defense_plan',
        document_name: 'Food Defense Plan',
        description: 'Food defense and security plan',
        is_required: true,
        display_order: 9
      },
      {
        document_type: 'recall_plan',
        document_name: 'Recall Plan and Procedures',
        description: 'Documented recall procedures and emergency response plan',
        is_required: true,
        display_order: 10
      },
      {
        document_type: 'food_safety_audit',
        document_name: 'Third-Party Food Safety Audit',
        description: 'Current third-party food safety audit (SQF, BRC, or similar)',
        is_required: true,
        display_order: 11
      },
      {
        document_type: 'npip_certificate',
        document_name: 'NPIP Certificate',
        description: 'National Poultry Improvement Plan (NPIP) certificate',
        is_required: true,
        display_order: 12
      },
      {
        document_type: 'organic_certification',
        document_name: 'Organic Certification',
        description: 'USDA Organic certification (if applicable)',
        is_required: false,
        display_order: 13
      },
      {
        document_type: 'supplier_agreement',
        document_name: 'Supplier Agreement',
        description: 'Signed supplier agreement with change notification requirements',
        is_required: true,
        display_order: 14
      },
      {
        document_type: 'animal_welfare_cert',
        document_name: 'Animal Welfare Certification',
        description: 'Animal welfare certification (GAA BAP, Animal Welfare Approved, etc.)',
        is_required: false,
        display_order: 15
      }
    ],
    form_fields: [
      ...COMMON_FORM_FIELDS,
      {
        field_type: 'text',
        field_label: 'Emergency Contact Name',
        field_description: 'Name of emergency contact person',
        is_required: true,
        field_order: 7
      },
      {
        field_type: 'text',
        field_label: 'Emergency Contact Phone',
        field_description: 'Emergency contact phone number',
        is_required: true,
        field_order: 8
      },
      {
        field_type: 'text',
        field_label: 'Emergency Contact Email',
        field_description: 'Emergency contact email address',
        is_required: true,
        field_order: 9
      },
      {
        field_type: 'text',
        field_label: 'Plant Manager Name',
        field_description: 'Name of plant manager',
        is_required: true,
        field_order: 10
      },
      {
        field_type: 'text',
        field_label: 'Plant Manager Phone',
        field_description: 'Plant manager phone number',
        is_required: true,
        field_order: 11
      },
      {
        field_type: 'text',
        field_label: 'Plant Manager Email',
        field_description: 'Plant manager email address',
        is_required: true,
        field_order: 12
      },
      {
        field_type: 'text',
        field_label: 'QC Manager Name',
        field_description: 'Name of Quality Control manager',
        is_required: true,
        field_order: 13
      },
      {
        field_type: 'text',
        field_label: 'QC Manager Phone',
        field_description: 'QC manager phone number',
        is_required: true,
        field_order: 14
      },
      {
        field_type: 'text',
        field_label: 'QC Manager Email',
        field_description: 'QC manager email address',
        is_required: true,
        field_order: 15
      },
      {
        field_type: 'text',
        field_label: 'Recall Coordinator Name',
        field_description: 'Name of recall coordinator',
        is_required: true,
        field_order: 16
      },
      {
        field_type: 'text',
        field_label: 'Recall Coordinator Phone',
        field_description: 'Recall coordinator phone number',
        is_required: true,
        field_order: 17
      },
      {
        field_type: 'text',
        field_label: 'Recall Coordinator Email',
        field_description: 'Recall coordinator email address',
        is_required: true,
        field_order: 18
      },
      {
        field_type: 'textarea',
        field_label: 'Manufacturing Locations',
        field_description: 'List each manufacturing location with complete address',
        is_required: true,
        field_order: 19
      },
      {
        field_type: 'checkbox',
        field_label: 'Products Supplied',
        field_description: 'Select all products that apply',
        is_required: false,
        field_order: 20,
        field_options: [
          'Whole Egg', 'Egg Whites', 'Egg Yolks', 'Cage Free', 'Organic', 
          'Nest Run', 'Conventional', 'Pasture Raised', 'Non-GMO', 
          'Free Range Organic', 'Free Range Cage Free', 'Prop 12 Compliant', 
          'State/Regional Compliant'
        ]
      },
      {
        field_type: 'textarea',
        field_label: 'Other Products',
        field_description: 'Describe any other products you supply',
        is_required: false,
        field_order: 21
      },
      {
        field_type: 'select',
        field_label: 'HPAI/ND Compliance',
        field_description: 'Products did not originate in quarantine control zone for HPAI or Newcastle disease',
        is_required: true,
        field_order: 22,
        field_options: ['Yes - Compliant', 'No - Non-compliant', 'Not Applicable']
      },
      {
        field_type: 'textarea',
        field_label: 'Packaging/Ingredients/Other',
        field_description: 'Describe packaging, ingredients, and other relevant information',
        is_required: false,
        field_order: 23
      },
      {
        field_type: 'text',
        field_label: 'FDA Registration Number',
        field_description: 'FDA facility registration number',
        is_required: true,
        field_order: 24
      },
      {
        field_type: 'select',
        field_label: 'FDA Registration',
        field_description: 'Do you have FDA Registration?',
        is_required: true,
        field_order: 25,
        field_options: ['Yes', 'No']
      },
      {
        field_type: 'select',
        field_label: 'Food Security/Defense Policy',
        field_description: 'Do you have a Food Security/Defense Policy in place?',
        is_required: true,
        field_order: 26,
        field_options: ['Yes', 'No']
      },
      {
        field_type: 'select',
        field_label: 'Risk Assessment Conducted',
        field_description: 'Have you conducted a Risk Assessment?',
        is_required: true,
        field_order: 27,
        field_options: ['Yes', 'No']
      },
      {
        field_type: 'text',
        field_label: 'Risk Assessment Date',
        field_description: 'Date of most recent risk assessment',
        is_required: false,
        field_order: 26
      },
      {
        field_type: 'text',
        field_label: 'Last Food Defense Audit Date',
        field_description: 'Date of last food defense audit',
        is_required: false,
        field_order: 27
      },
      {
        field_type: 'checkbox',
        field_label: 'Food Fraud Prevention',
        field_description: 'Check all that apply',
        is_required: false,
        field_order: 28,
        field_options: [
          'Vulnerability Assessment Conducted', 'Dilution Risk Mitigation', 
          'Mislabeling Risk Mitigation', 'Substitution Risk Mitigation', 
          'Counterfeit Risk Mitigation'
        ]
      },
      {
        field_type: 'checkbox',
        field_label: 'Allergen Controls',
        field_description: 'Check all that apply',
        is_required: false,
        field_order: 29,
        field_options: [
          'Allergen Control Program', 'Annual Employee Training', 
          'Allergen Testing Program', 'Cross-contamination Prevention', 
          'Rework Allergen Control'
        ]
      },
      {
        field_type: 'text',
        field_label: 'Third Party Certificates',
        field_description: 'List third party certificates (SQF, BRC, Other)',
        is_required: false,
        field_order: 47
      },
      {
        field_type: 'text',
        field_label: 'Last Inspection Date',
        field_description: 'Date of last third party inspection',
        is_required: false,
        field_order: 48
      },
      {
        field_type: 'text',
        field_label: 'Inspection Score',
        field_description: 'Score from last inspection',
        is_required: false,
        field_order: 49
      },
      {
        field_type: 'checkbox',
        field_label: 'Supplier Management',
        field_description: 'Check all that apply',
        is_required: false,
        field_order: 50,
        field_options: [
          'Supplier Approval Program', 'Supplier Fraud Assessment', 
          'FSVP Importer Status', 'FSVP Compliance'
        ]
      },
      {
        field_type: 'text',
        field_label: 'Supplier Information Maintenance',
        field_description: 'Method of maintaining supplier information',
        is_required: false,
        field_order: 51
      },
      {
        field_type: 'checkbox',
        field_label: 'Recall Procedures',
        field_description: 'Check all that apply',
        is_required: false,
        field_order: 52,
        field_options: ['Recall Policy in Place', 'Mock Recalls Conducted']
      },
      {
        field_type: 'text',
        field_label: 'Mock Recall Frequency',
        field_description: 'Frequency of mock recalls',
        is_required: false,
        field_order: 53
      },
      {
        field_type: 'text',
        field_label: 'Last Mock Recall Date',
        field_description: 'Date of last mock recall',
        is_required: false,
        field_order: 54
      },
      {
        field_type: 'text',
        field_label: 'Mock Recall Recovery Percentage',
        field_description: 'Percentage recovery from last mock recall',
        is_required: false,
        field_order: 55
      },
      {
        field_type: 'text',
        field_label: 'Mock Recall Conducted By',
        field_description: 'Who conducted the mock recall',
        is_required: false,
        field_order: 56
      }
    ]
  },
  // Auditor template
  {
    industry: 'Auditor',
    default_welcome_message: 'Welcome to our auditor onboarding process. Please provide the necessary compliance documents and professional credentials for verification.',
    allow_branch_selection: true,
    require_branch_selection: false,
    auto_approve_standard_docs: false,
    require_all_documents: true,
    expires_days: 14,
    document_requirements: [
      ...COMMON_DOCUMENTS,
      {
        document_type: 'professional_registration',
        document_name: 'Professional Registration Certificate',
        description: 'CA/CS/CMA registration from respective professional body',
        is_required: true,
        display_order: 6
      },
      {
        document_type: 'indemnity_insurance',
        document_name: 'Professional Indemnity Insurance',
        description: 'Valid professional indemnity insurance policy',
        is_required: true,
        display_order: 7
      },
      {
        document_type: 'audit_experience',
        document_name: 'Audit Experience Certificate',
        description: 'Experience certificate in auditing field',
        is_required: true,
        display_order: 8
      }
    ],
    form_fields: [
      ...COMMON_FORM_FIELDS,
      {
        field_type: 'select',
        field_label: 'Audit Specialization',
        field_description: 'Primary area of audit expertise',
        is_required: true,
        field_order: 7,
        field_options: ['Financial Audit', 'Food Safety Audit', 'Compliance Audit', 'Internal Audit', 'ISO Certification Audit']
      },
      {
        field_type: 'text',
        field_label: 'Professional Registration Number',
        field_description: 'Your CA/CS/CMA registration number',
        is_required: true,
        field_order: 8
      },
      {
        field_type: 'number',
        field_label: 'Years of Experience',
        field_description: 'Total years of auditing experience',
        is_required: true,
        field_order: 9
      }
    ]
  },
  {
    industry: 'Sushi & Japanese Cuisine',
    default_welcome_message: 'Welcome to our sushi supplier network! We are committed to the highest standards for raw fish safety, temperature control, and seafood traceability. Please complete the onboarding process to begin our partnership.',
    allow_branch_selection: true,
    require_branch_selection: false,
    auto_approve_standard_docs: false,
    require_all_documents: true,
    expires_days: 14,
    document_requirements: [
      ...COMMON_DOCUMENTS,
      {
        document_type: 'sashimi_grade_certification',
        document_name: 'Sashimi Grade Fish Certification',
        description: 'Required certification for raw fish handling',
        is_required: true,
        display_order: 6
      },
      {
        document_type: 'haccp_seafood',
        document_name: 'HACCP Plan for Seafood',
        description: 'FDA-compliant HACCP plan for seafood processing',
        is_required: true,
        display_order: 7
      },
      {
        document_type: 'seafood_traceability',
        document_name: 'Seafood Traceability Documentation',
        description: 'Full supply chain traceability for all seafood',
        is_required: true,
        display_order: 8
      },
      {
        document_type: 'cold_chain',
        document_name: 'Cold Chain Documentation',
        description: 'Temperature monitoring and control records',
        is_required: true,
        display_order: 9
      }
    ],
    form_fields: [
      ...COMMON_FORM_FIELDS,
      {
        field_type: 'text',
        field_label: 'Primary Fish Species',
        field_description: 'List main types of fish you supply (tuna, salmon, yellowtail, etc.)',
        is_required: true,
        field_order: 7
      },
      {
        field_type: 'select',
        field_label: 'Freezing Method for Parasite Destruction',
        field_description: 'How do you ensure parasite destruction in raw fish?',
        is_required: true,
        field_order: 8,
        field_options: ['-20°C for 7 days', '-35°C for 15 hours', 'Flash freezing at -40°C', 'Other FDA-approved method']
      },
      {
        field_type: 'text',
        field_label: 'Cold Storage Capacity',
        field_description: 'Total cold storage capacity (in cubic feet or cubic meters)',
        is_required: true,
        field_order: 9
      },
      {
        field_type: 'checkbox',
        field_label: 'Sushi-Specific Certifications',
        field_description: 'Select all certifications you hold',
        is_required: false,
        field_order: 10,
        field_options: ['FDA Seafood HACCP', 'MSC Certified', 'BAP Certified', 'ASC Certified', 'Organic Certified']
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