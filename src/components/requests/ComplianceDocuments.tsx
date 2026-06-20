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
  CheckSquare,
  Clock
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
  isCustomTemplate?: boolean;
  customTemplateId?: string;
}

export const getComplianceDocuments = (userType: string): ComplianceDocument[] => {
  // Auditor-specific document sets for India
  if (userType === 'Auditor') {
    return [
      // Financial Compliance Documents
      {
        id: 'gst-certificate',
        title: 'GST Registration Certificate',
        category: 'Financial Compliance',
        description: 'Goods and Services Tax registration certificate',
        icon: FileText,
        required: true,
        regulatoryBody: 'GSTN',
        template: { sections: [{ name: 'GST Details', required: true }] }
      },
      {
        id: 'itr-returns',
        title: 'Income Tax Returns (ITR)',
        category: 'Financial Compliance',
        description: 'Latest 3 years Income Tax Returns filed',
        icon: FileText,
        required: true,
        regulatoryBody: 'Income Tax Department',
        template: { sections: [{ name: 'Tax Filing History', required: true }] }
      },
      {
        id: 'tds-certificate',
        title: 'TDS Certificates',
        category: 'Financial Compliance',
        description: 'Tax Deducted at Source certificates for current FY',
        icon: Award,
        required: true,
        regulatoryBody: 'Income Tax Department',
        template: { sections: [{ name: 'TDS Details', required: true }] }
      },
      {
        id: 'statutory-audit-report',
        title: 'Statutory Audit Report',
        category: 'Financial Compliance',
        description: 'Latest statutory audit report from chartered accountant',
        icon: CheckCircle,
        required: true,
        regulatoryBody: 'ICAI',
        template: { sections: [{ name: 'Audit Findings', required: true }] }
      },
      {
        id: 'bank-statements',
        title: 'Bank Statements',
        category: 'Financial Compliance',
        description: 'Latest 12 months bank statements',
        icon: Building2,
        required: true,
        regulatoryBody: 'RBI',
        template: { sections: [{ name: 'Financial Health', required: true }] }
      },
      // Food Safety (FSSAI) Documents
      {
        id: 'fssai-license',
        title: 'FSSAI License',
        category: 'Food Safety',
        description: 'Food Safety and Standards Authority of India license',
        icon: Shield,
        required: true,
        regulatoryBody: 'FSSAI',
        template: { sections: [{ name: 'Food Safety Compliance', required: true }] }
      },
      {
        id: 'haccp-certification',
        title: 'HACCP Certification',
        category: 'Food Safety',
        description: 'Hazard Analysis Critical Control Points certification',
        icon: Shield,
        required: true,
        regulatoryBody: 'FSSAI',
        template: { sections: [{ name: 'HACCP Implementation', required: true }] }
      },
      {
        id: 'water-quality-report',
        title: 'Water Quality Test Report',
        category: 'Food Safety',
        description: 'Laboratory water quality analysis report',
        icon: CheckSquare,
        required: true,
        regulatoryBody: 'BIS',
        template: { sections: [{ name: 'Water Analysis', required: true }] }
      },
      {
        id: 'pest-control-records',
        title: 'Pest Control Records',
        category: 'Food Safety',
        description: 'Monthly pest control treatment records',
        icon: AlertTriangle,
        required: true,
        regulatoryBody: 'FSSAI',
        template: { sections: [{ name: 'Pest Management', required: true }] }
      },
      {
        id: 'fostac-certificate',
        title: 'FoSTaC Training Certificate',
        category: 'Food Safety',
        description: 'Food Safety Training and Certification for supervisors',
        icon: Award,
        required: true,
        regulatoryBody: 'FSSAI',
        template: { sections: [{ name: 'Training Certificates', required: true }] }
      },
      {
        id: 'gmp-manual',
        title: 'GMP Manual',
        category: 'Food Safety',
        description: 'Good Manufacturing Practices documented procedures',
        icon: FileText,
        required: true,
        regulatoryBody: 'FSSAI',
        template: { sections: [{ name: 'GMP Guidelines', required: true }] }
      },
      {
        id: 'ghp-manual',
        title: 'GHP Manual',
        category: 'Food Safety',
        description: 'Good Hygiene Practices documented procedures',
        icon: FileText,
        required: true,
        regulatoryBody: 'FSSAI',
        template: { sections: [{ name: 'Hygiene Practices', required: true }] }
      },
      {
        id: 'medical-fitness',
        title: 'Medical Fitness Certificates',
        category: 'Food Safety',
        description: 'Annual medical fitness certificates for all food handlers',
        icon: CheckCircle,
        required: true,
        regulatoryBody: 'FSSAI',
        template: { sections: [{ name: 'Health Records', required: true }] }
      },
      {
        id: 'product-recall-plan',
        title: 'Product Recall Plan',
        category: 'Food Safety',
        description: 'Documented traceability and product recall procedure',
        icon: AlertTriangle,
        required: true,
        regulatoryBody: 'FSSAI',
        template: { sections: [{ name: 'Recall Procedure', required: true }] }
      },
      {
        id: 'cleaning-sanitation-records',
        title: 'Cleaning & Sanitation Records',
        category: 'Food Safety',
        description: 'Daily cleaning logs and sanitation SOP adherence',
        icon: CheckSquare,
        required: true,
        regulatoryBody: 'FSSAI',
        template: { sections: [{ name: 'Sanitation Logs', required: true }] }
      },
      {
        id: 'calibration-certificates',
        title: 'Calibration Certificates',
        category: 'Food Safety',
        description: 'Calibration records for weighing scales and thermometers',
        icon: CheckCircle,
        required: true,
        regulatoryBody: 'FSSAI / NABL',
        template: { sections: [{ name: 'Equipment Calibration', required: true }] }
      },
      {
        id: 'equipment-maintenance-logs',
        title: 'Equipment Maintenance Logs',
        category: 'Food Safety',
        description: 'Preventive maintenance schedule and records for food machinery',
        icon: FileText,
        required: true,
        regulatoryBody: 'FSSAI',
        template: { sections: [{ name: 'Maintenance Records', required: true }] }
      },
      {
        id: 'waste-disposal-records',
        title: 'Waste Disposal Records',
        category: 'Food Safety',
        description: 'Documentation for solid and liquid waste management',
        icon: CheckSquare,
        required: true,
        regulatoryBody: 'FSSAI / Pollution Control Board',
        template: { sections: [{ name: 'Waste Management', required: true }] }
      },
      // Regulatory Compliance Documents
      {
        id: 'factory-license',
        title: 'Factory License',
        category: 'Regulatory Compliance',
        description: 'State Factory License under Factories Act',
        icon: Factory,
        required: true,
        regulatoryBody: 'State Government',
        template: { sections: [{ name: 'Factory Registration', required: true }] }
      },
      {
        id: 'pollution-clearance',
        title: 'Pollution Control Clearance',
        category: 'Regulatory Compliance',
        description: 'State Pollution Control Board clearance certificate',
        icon: Leaf,
        required: true,
        regulatoryBody: 'SPCB',
        template: { sections: [{ name: 'Environmental Compliance', required: true }] }
      },
      {
        id: 'fire-safety-certificate',
        title: 'Fire Safety Certificate',
        category: 'Regulatory Compliance',
        description: 'Fire department NOC and safety certificate',
        icon: AlertTriangle,
        required: true,
        regulatoryBody: 'Fire Department',
        template: { sections: [{ name: 'Fire Safety Measures', required: true }] }
      },
      {
        id: 'labour-license',
        title: 'Labour License',
        category: 'Regulatory Compliance',
        description: 'Contract Labour License and registrations',
        icon: Users,
        required: true,
        regulatoryBody: 'Labour Department',
        template: { sections: [{ name: 'Labour Compliance', required: true }] }
      },
      // Quality Management Documents
      {
        id: 'iso-9001-certificate',
        title: 'ISO 9001:2015 Certificate',
        category: 'Quality Management',
        description: 'Quality Management System certification',
        icon: Award,
        required: false,
        regulatoryBody: 'ISO',
        template: { sections: [{ name: 'QMS Implementation', required: true }] }
      },
      {
        id: 'iso-22000-certificate',
        title: 'ISO 22000 Certificate',
        category: 'Quality Management',
        description: 'Food Safety Management System certification',
        icon: Award,
        required: false,
        regulatoryBody: 'ISO',
        template: { sections: [{ name: 'FSMS Implementation', required: true }] }
      },
      {
        id: 'calibration-certificates',
        title: 'Equipment Calibration Certificates',
        category: 'Quality Management',
        description: 'Calibration certificates for measuring instruments',
        icon: Settings,
        required: true,
        regulatoryBody: 'NABL',
        template: { sections: [{ name: 'Equipment Accuracy', required: true }] }
      },
      {
        id: 'testing-reports',
        title: 'Product Testing Reports',
        category: 'Quality Management',
        description: 'Third-party laboratory testing reports',
        icon: CheckSquare,
        required: true,
        regulatoryBody: 'NABL',
        template: { sections: [{ name: 'Product Quality', required: true }] }
      },
      // Legal & Corporate Documents
      {
        id: 'roc-filings',
        title: 'ROC Annual Filings',
        category: 'Legal & Corporate',
        description: 'Registrar of Companies annual return filings',
        icon: FileText,
        required: true,
        regulatoryBody: 'MCA',
        template: { sections: [{ name: 'Corporate Compliance', required: true }] }
      },
      {
        id: 'trade-license',
        title: 'Trade License',
        category: 'Legal & Corporate',
        description: 'Municipal Corporation trade license',
        icon: Building2,
        required: true,
        regulatoryBody: 'Municipal Corporation',
        template: { sections: [{ name: 'Trade Authorization', required: true }] }
      },
      {
        id: 'professional-registration',
        title: 'Professional Registration',
        category: 'Legal & Corporate',
        description: 'CA/CS/CMA registration certificates',
        icon: Award,
        required: true,
        regulatoryBody: 'ICAI/ICSI/ICMA',
        template: { sections: [{ name: 'Professional Credentials', required: true }] }
      },
      {
        id: 'indemnity-insurance',
        title: 'Professional Indemnity Insurance',
        category: 'Legal & Corporate',
        description: 'Professional indemnity insurance policy',
        icon: Shield,
        required: true,
        regulatoryBody: 'IRDAI',
        template: { sections: [{ name: 'Insurance Coverage', required: true }] }
      }
    ];
  }

  // Consolidated Egg Processing document set
  if (userType === 'Egg Processing') {
    return [
      // Core Documentation
      {
        id: 'supplier-questionnaire-egg',
        title: 'Completed Supplier Questionnaire',
        category: 'Egg Processing Documentation',
        description: 'Comprehensive supplier information and capabilities questionnaire',
        icon: ClipboardCheck,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Company Information', required: true }] }
      },
      {
        id: 'supplier-agreement-egg',
        title: 'Supplier Agreement',
        category: 'Egg Processing Legal',
        description: 'Contractual agreement between buyer and egg supplier',
        icon: FileText,
        required: true,
        regulatoryBody: 'Legal',
        template: { sections: [{ name: 'Terms and Conditions', required: true }] }
      },
      {
        id: 'letter-guarantee-egg',
        title: 'Dated Letter of Guarantee',
        category: 'Egg Processing Legal',
        description: 'Legal guarantee documentation with date verification',
        icon: Shield,
        required: true,
        regulatoryBody: 'Legal',
        template: { sections: [{ name: 'Guarantee Terms', required: true }] }
      },
      
      // Food Safety & Compliance
      {
        id: 'haccp-plan-egg',
        title: 'HACCP Plan with Flow Charts',
        category: 'Egg Processing Food Safety',
        description: 'Hazard Analysis Critical Control Points plan with visual flow charts',
        icon: Shield,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'HACCP Documentation', required: true }] }
      },
      {
        id: 'gfsi-certificate-egg',
        title: 'Current & Valid GFSI Certificate',
        category: 'Egg Processing Certification',
        description: 'Global Food Safety Initiative certification',
        icon: Award,
        required: true,
        regulatoryBody: 'GFSI',
        template: { sections: [{ name: 'Certification Details', required: true }] }
      },
      {
        id: 'allergen-survey-egg',
        title: 'Completed Allergen Survey',
        category: 'Egg Processing Food Safety',
        description: 'Allergen control and management assessment',
        icon: AlertTriangle,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Allergen Controls', required: true }] }
      },
      {
        id: 'bioterrorism-statement-egg',
        title: 'Bio-terrorism/Food Defense Program',
        category: 'Egg Processing Security',
        description: 'Bio-terrorism and food defense documentation',
        icon: Lock,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Security Measures', required: true }] }
      },
      {
        id: 'food-fraud-assessment-egg',
        title: 'Food Fraud Vulnerability Assessment',
        category: 'Egg Processing Risk',
        description: 'Assessment of food fraud vulnerabilities',
        icon: AlertTriangle,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Vulnerability Analysis', required: true }] }
      },
      
      // Quality & Testing
      {
        id: 'specification-sheet-egg',
        title: 'Specification Sheet with Nutritional Information',
        category: 'Egg Processing Quality',
        description: 'Product specifications including nutritional data',
        icon: FileText,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Nutritional Information', required: true }] }
      },
      {
        id: 'coa-example-egg',
        title: 'Example Certificate of Analysis',
        category: 'Egg Processing Quality',
        description: 'Sample certificate of analysis for egg products',
        icon: Award,
        required: true,
        regulatoryBody: 'Quality Control',
        template: { sections: [{ name: 'Analysis Results', required: true }] }
      },
      {
        id: 'pathogen-testing',
        title: 'Pathogen Testing Records',
        category: 'Egg Processing Testing',
        description: 'Salmonella and other pathogen testing documentation',
        icon: AlertTriangle,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Testing Schedule', required: true }] }
      },
      
      // Egg-Specific Requirements
      {
        id: 'shell-egg-questionnaire',
        title: 'Shell Egg Supplier Questionnaire',
        category: 'Egg Processing Documentation',
        description: 'Specific questionnaire for shell egg production and handling',
        icon: FileText,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Production Details', required: true }] }
      },
      {
        id: 'flock-certificate-egg',
        title: 'Flock Certificate',
        category: 'Egg Processing Health',
        description: 'Flock health and certification documentation',
        icon: Heart,
        required: true,
        regulatoryBody: 'USDA',
        template: { sections: [{ name: 'Flock Health Status', required: true }] }
      },
      {
        id: 'npip-certification',
        title: 'NPIP Certification',
        category: 'Egg Processing Certification',
        description: 'National Poultry Improvement Plan certification',
        icon: Award,
        required: true,
        regulatoryBody: 'USDA',
        template: { sections: [{ name: 'NPIP Status', required: true }] }
      },
      {
        id: 'cfr-118-letter-egg',
        title: '21 CFR 118 Compliance Letter',
        category: 'Egg Processing Compliance',
        description: '21 CFR 118 compliance letter for shell egg producers',
        icon: FileText,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'CFR 118 Compliance', required: true }] }
      },
      
      // Traceability & Logistics
      {
        id: 'lot-code-definitions-egg',
        title: 'Lot Code Definitions',
        category: 'Egg Processing Traceability',
        description: 'Definition and explanation of lot coding system',
        icon: MapPin,
        required: true,
        regulatoryBody: 'Traceability',
        template: { sections: [{ name: 'Coding System', required: true }] }
      },
      {
        id: 'transport-storage-egg',
        title: 'Transportation and Storage Requirements',
        category: 'Egg Processing Logistics',
        description: 'Transportation and storage requirement specifications',
        icon: Truck,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Transport Requirements', required: true }] }
      },
      {
        id: 'shelf-life-statement-egg',
        title: 'Product Shelf Life Statement',
        category: 'Egg Processing Quality',
        description: 'Product shelf life and storage requirements',
        icon: Clock,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Shelf Life Data', required: true }] }
      },
      
      // Ingredients & Feed
      {
        id: 'ingredient-specifications',
        title: 'Ingredient Specifications',
        category: 'Egg Processing Ingredients',
        description: 'Feed ingredient specifications and documentation',
        icon: FileText,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Ingredient Details', required: true }] }
      },
      {
        id: 'feed-safety-documentation',
        title: 'Feed Safety Documentation',
        category: 'Egg Processing Ingredients',
        description: 'Feed safety and quality documentation',
        icon: Shield,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Feed Safety', required: true }] }
      },
      
      // Packaging
      {
        id: 'packaging-specifications',
        title: 'Packaging Specifications',
        category: 'Egg Processing Packaging',
        description: 'Packaging material specifications and compliance',
        icon: FileText,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Packaging Details', required: true }] }
      },
      {
        id: 'food-contact-compliance',
        title: 'Food Contact Compliance',
        category: 'Egg Processing Packaging',
        description: 'Food contact material compliance documentation',
        icon: CheckCircle,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Compliance Documentation', required: true }] }
      },
      
      // Certifications (Optional)
      {
        id: 'cage-free-certification',
        title: 'Cage-Free Certification',
        category: 'Egg Processing Certification',
        description: 'Cage-free production certification',
        icon: Award,
        required: false,
        regulatoryBody: 'Certification Body',
        template: { sections: [{ name: 'Certification Details', required: true }] }
      },
      {
        id: 'organic-certification',
        title: 'Organic Certification',
        category: 'Egg Processing Certification',
        description: 'Organic production certification',
        icon: Leaf,
        required: false,
        regulatoryBody: 'USDA',
        template: { sections: [{ name: 'Organic Compliance', required: true }] }
      },
      {
        id: 'ca-prop12-egg',
        title: 'California Egg Prop 12 Certificate',
        category: 'Egg Processing Compliance',
        description: 'California Proposition 12 compliance certification',
        icon: MapPin,
        required: false,
        regulatoryBody: 'California',
        template: { sections: [{ name: 'Compliance Documentation', required: true }] }
      },
      {
        id: 'halal-certification-egg',
        title: 'Halal Certification',
        category: 'Egg Processing Religious',
        description: 'Halal certification or compliance documentation',
        icon: Award,
        required: false,
        regulatoryBody: 'Halal Authority',
        template: { sections: [{ name: 'Halal Compliance', required: true }] }
      },
      {
        id: 'kosher-certificate-egg',
        title: 'Kosher Certificate',
        category: 'Egg Processing Religious',
        description: 'Kosher certification or compliance documentation',
        icon: Award,
        required: false,
        regulatoryBody: 'Kosher Authority',
        template: { sections: [{ name: 'Kosher Compliance', required: true }] }
      },
      
      // Insurance & Ethics
      {
        id: 'insurance-certificate-egg',
        title: 'Current Certificate of Insurance',
        category: 'Egg Processing Insurance',
        description: 'Current and valid insurance coverage certificate',
        icon: Shield,
        required: true,
        regulatoryBody: 'Insurance Provider',
        template: { sections: [{ name: 'Coverage Details', required: true }] }
      },
      {
        id: 'ethical-conduct-egg',
        title: 'Ethical Code of Conduct Agreement',
        category: 'Egg Processing Ethics',
        description: 'Ethical Trading Initiative code of conduct agreement',
        icon: Users,
        required: true,
        regulatoryBody: 'ETI',
        template: { sections: [{ name: 'Ethical Standards', required: true }] }
      },
      {
        id: 'sds-sheet-egg',
        title: 'Current SDS Sheet or Letter of Exemption',
        category: 'Egg Processing Safety',
        description: 'Safety Data Sheet or exemption letter',
        icon: AlertTriangle,
        required: true,
        regulatoryBody: 'OSHA',
        template: { sections: [{ name: 'Safety Information', required: true }] }
      }
    ];
  }

  // Sushi Company-specific document set
  if (userType === 'Sushi Company') {
    return [
      // Food Safety - Raw Fish Handling
      {
        id: 'sashimi-grade-certification',
        title: 'Sashimi Grade Fish Certification',
        category: 'Seafood Safety',
        description: 'Certification for handling and serving raw fish products',
        icon: Shield,
        required: true,
        regulatoryBody: 'FDA / Local Health Department',
        template: {
          sections: [
            { name: 'Fish Source Documentation', required: true },
            { name: 'Temperature Control Logs', required: true },
            { name: 'Parasite Destruction Records', required: true },
            { name: 'Supplier Verification', required: true }
          ]
        }
      },
      {
        id: 'haccp-seafood-plan',
        title: 'HACCP Plan for Seafood',
        category: 'Food Safety',
        description: 'Hazard Analysis Critical Control Points plan specific to seafood',
        icon: ClipboardCheck,
        required: true,
        regulatoryBody: 'FDA',
        template: {
          sections: [
            { name: 'Hazard Analysis', required: true },
            { name: 'Critical Control Points', required: true },
            { name: 'Monitoring Procedures', required: true },
            { name: 'Corrective Actions', required: true },
            { name: 'Verification Procedures', required: true }
          ]
        }
      },
      {
        id: 'raw-fish-handling-sop',
        title: 'Raw Fish Handling SOP',
        category: 'Food Safety',
        description: 'Standard Operating Procedures for raw fish preparation',
        icon: FileText,
        required: true,
        regulatoryBody: 'FDA',
        template: {
          sections: [
            { name: 'Receiving Procedures', required: true },
            { name: 'Storage Requirements', required: true },
            { name: 'Preparation Guidelines', required: true },
            { name: 'Cross-contamination Prevention', required: true },
            { name: 'Staff Training Records', required: true }
          ]
        }
      },
      {
        id: 'seafood-traceability',
        title: 'Seafood Traceability Documentation',
        category: 'Traceability',
        description: 'Full supply chain traceability for seafood products',
        icon: MapPin,
        required: true,
        regulatoryBody: 'NOAA / FDA',
        template: {
          sections: [
            { name: 'Catch Information', required: true },
            { name: 'Processing Facilities', required: true },
            { name: 'Transportation Records', required: true },
            { name: 'Chain of Custody', required: true }
          ]
        }
      },
      // Allergen Management
      {
        id: 'shellfish-allergen-program',
        title: 'Shellfish Allergen Control Program',
        category: 'Allergen Management',
        description: 'Program for managing shellfish allergens',
        icon: AlertTriangle,
        required: true,
        regulatoryBody: 'FDA',
        template: {
          sections: [
            { name: 'Allergen Identification', required: true },
            { name: 'Segregation Procedures', required: true },
            { name: 'Cleaning Protocols', required: true },
            { name: 'Labeling Requirements', required: true }
          ]
        }
      },
      // Rice & Ingredients
      {
        id: 'rice-quality-specifications',
        title: 'Sushi Rice Quality Specifications',
        category: 'Quality Control',
        description: 'Quality standards for sushi rice and ingredients',
        icon: Award,
        required: false,
        regulatoryBody: 'Internal Standards',
        template: {
          sections: [
            { name: 'Rice Supplier Details', required: true },
            { name: 'Quality Parameters', required: true },
            { name: 'Testing Protocols', required: true },
            { name: 'Storage Conditions', required: true }
          ]
        }
      },
      // Temperature Control
      {
        id: 'cold-chain-documentation',
        title: 'Cold Chain Documentation',
        category: 'Food Safety',
        description: 'Complete temperature monitoring for cold chain',
        icon: Clock,
        required: true,
        regulatoryBody: 'FDA',
        template: {
          sections: [
            { name: 'Temperature Monitoring Logs', required: true },
            { name: 'Equipment Calibration', required: true },
            { name: 'Storage Temperature Records', required: true },
            { name: 'Transport Temperature Data', required: true }
          ]
        }
      },
      // Wasabi & Condiments
      {
        id: 'condiment-specifications',
        title: 'Condiment & Seasoning Specifications',
        category: 'Quality Control',
        description: 'Quality specs for wasabi, soy sauce, ginger, etc.',
        icon: Leaf,
        required: false,
        regulatoryBody: 'Internal Standards',
        template: {
          sections: [
            { name: 'Supplier Information', required: true },
            { name: 'Ingredient Lists', required: true },
            { name: 'Allergen Declarations', required: true },
            { name: 'Shelf Life Data', required: true }
          ]
        }
      },
      // Standard Compliance
      {
        id: 'business-license',
        title: 'Business License',
        category: 'Legal Compliance',
        description: 'Valid business operation license',
        icon: FileText,
        required: true,
        regulatoryBody: 'Local Government',
        template: {
          sections: [
            { name: 'License Details', required: true },
            { name: 'Validity Period', required: true }
          ]
        }
      },
      {
        id: 'food-handler-certifications',
        title: 'Food Handler Certifications',
        category: 'Food Safety',
        description: 'Certifications for all food handling staff',
        icon: Users,
        required: true,
        regulatoryBody: 'Local Health Department',
        template: {
          sections: [
            { name: 'Staff List', required: true },
            { name: 'Certification Details', required: true },
            { name: 'Training Records', required: true }
          ]
        }
      },
      {
        id: 'general-liability-insurance',
        title: 'General Liability Insurance',
        category: 'Insurance',
        description: 'Current general liability insurance coverage',
        icon: Shield,
        required: true,
        regulatoryBody: 'Insurance Commission',
        template: {
          sections: [
            { name: 'Policy Details', required: true },
            { name: 'Coverage Amount', required: true },
            { name: 'Expiration Date', required: true }
          ]
        }
      }
    ];
  }

  // Legacy support - Keep existing poultry types for backward compatibility
  if (userType === 'Poultry - Egg Supplier') {
    return [
      {
        id: 'supplier-questionnaire-egg',
        title: 'Completed Supplier Questionnaire',
        category: 'Egg Supplier Documentation',
        description: 'Comprehensive supplier information and capabilities questionnaire',
        icon: ClipboardCheck,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Company Information', required: true }] }
      },
      {
        id: 'allergen-survey-egg',
        title: 'Completed Allergen Survey',
        category: 'Egg Supplier Documentation',
        description: 'Allergen control and management assessment',
        icon: AlertTriangle,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Allergen Controls', required: true }] }
      },
      {
        id: 'shell-egg-questionnaire',
        title: 'Completed Shell Egg Supplier Questionnaire',
        category: 'Egg Supplier Documentation',
        description: 'Specific questionnaire for shell egg production and handling',
        icon: FileText,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Production Details', required: true }] }
      },
      {
        id: 'letter-guarantee-egg',
        title: 'Dated Letter of Guarantee',
        category: 'Egg Supplier Legal',
        description: 'Legal guarantee documentation with date verification',
        icon: Shield,
        required: true,
        regulatoryBody: 'Legal',
        template: { sections: [{ name: 'Guarantee Terms', required: true }] }
      },
      {
        id: 'supplier-agreement-egg',
        title: 'Supplier Agreement',
        category: 'Egg Supplier Legal',
        description: 'Contractual agreement between buyer and egg supplier',
        icon: FileText,
        required: true,
        regulatoryBody: 'Legal',
        template: { sections: [{ name: 'Terms and Conditions', required: true }] }
      },
      {
        id: 'coa-example-egg',
        title: 'Example Certificate of Analysis',
        category: 'Egg Supplier Quality',
        description: 'Sample certificate of analysis for egg products',
        icon: Award,
        required: true,
        regulatoryBody: 'Quality Control',
        template: { sections: [{ name: 'Analysis Results', required: true }] }
      },
      {
        id: 'lot-code-definitions-egg',
        title: 'Lot Code Definitions',
        category: 'Egg Supplier Traceability',
        description: 'Definition and explanation of lot coding system',
        icon: MapPin,
        required: true,
        regulatoryBody: 'Traceability',
        template: { sections: [{ name: 'Coding System', required: true }] }
      },
      {
        id: 'specification-sheet-egg',
        title: 'Specification Sheet (with nutritional information)',
        category: 'Egg Supplier Quality',
        description: 'Product specifications including nutritional data',
        icon: FileText,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Nutritional Information', required: true }] }
      },
      {
        id: 'gfsi-certificate-egg',
        title: 'Current & Valid GFSI Certificate',
        category: 'Egg Supplier Certification',
        description: 'Global Food Safety Initiative certification',
        icon: Award,
        required: true,
        regulatoryBody: 'GFSI',
        template: { sections: [{ name: 'Certification Details', required: true }] }
      },
      {
        id: 'haccp-plan-egg',
        title: 'Copy of HACCP Plan with flow charts',
        category: 'Egg Supplier Food Safety',
        description: 'Hazard Analysis Critical Control Points plan with visual flow charts',
        icon: Shield,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'HACCP Documentation', required: true }] }
      },
      {
        id: 'identity-preservation-egg',
        title: 'Identity Preservation Certificates',
        category: 'Egg Supplier Certification',
        description: 'Certificates ensuring product identity preservation',
        icon: CheckCircle,
        required: false,
        regulatoryBody: 'Certification Body',
        template: { sections: [{ name: 'Identity Verification', required: true }] }
      },
      {
        id: 'ca-prop12-egg',
        title: 'California Egg Prop 12 Certificate',
        category: 'Egg Supplier Compliance',
        description: 'California Proposition 12 compliance certification',
        icon: MapPin,
        required: false,
        regulatoryBody: 'California',
        template: { sections: [{ name: 'Compliance Documentation', required: true }] }
      },
      {
        id: 'colorado-compliance-egg',
        title: 'Colorado Certificate of Compliance',
        category: 'Egg Supplier Compliance',
        description: 'Colorado state compliance certification',
        icon: MapPin,
        required: false,
        regulatoryBody: 'Colorado',
        template: { sections: [{ name: 'State Compliance', required: true }] }
      },
      {
        id: 'arizona-cage-free-egg',
        title: 'Arizona Cage Free Compliance Certificate',
        category: 'Egg Supplier Compliance',
        description: 'Arizona cage-free compliance certification',
        icon: MapPin,
        required: false,
        regulatoryBody: 'Arizona',
        template: { sections: [{ name: 'Cage-Free Compliance', required: true }] }
      },
      {
        id: 'halal-certification-egg',
        title: 'Halal Certification or letter of compliance',
        category: 'Egg Supplier Religious',
        description: 'Halal certification or compliance documentation',
        icon: Award,
        required: false,
        regulatoryBody: 'Halal Authority',
        template: { sections: [{ name: 'Halal Compliance', required: true }] }
      },
      {
        id: 'kosher-certificate-egg',
        title: 'Kosher Certificate or letter of compliance',
        category: 'Egg Supplier Religious',
        description: 'Kosher certification or compliance documentation',
        icon: Award,
        required: false,
        regulatoryBody: 'Kosher Authority',
        template: { sections: [{ name: 'Kosher Compliance', required: true }] }
      },
      {
        id: 'kosher-passover-egg',
        title: 'Kosher for Passover Certificate',
        category: 'Egg Supplier Religious',
        description: 'Kosher for Passover certification',
        icon: Award,
        required: false,
        regulatoryBody: 'Kosher Authority',
        template: { sections: [{ name: 'Passover Compliance', required: true }] }
      },
      {
        id: 'country-origin-egg',
        title: 'Country of Origin (non-USA; FSVP Statement)',
        category: 'Egg Supplier Import',
        description: 'Country of origin documentation and FSVP statement for non-USA products',
        icon: Globe,
        required: false,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Origin Documentation', required: true }] }
      },
      {
        id: 'insurance-certificate-egg',
        title: 'Current Certificate of Insurance',
        category: 'Egg Supplier Insurance',
        description: 'Current and valid insurance coverage certificate',
        icon: Shield,
        required: true,
        regulatoryBody: 'Insurance Provider',
        template: { sections: [{ name: 'Coverage Details', required: true }] }
      },
      {
        id: 'non-gmo-statement-egg',
        title: 'Non-GMO Statement',
        category: 'Egg Supplier Quality',
        description: 'Non-genetically modified organism statement',
        icon: Leaf,
        required: false,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'GMO Status', required: true }] }
      },
      {
        id: 'bioterrorism-statement-egg',
        title: 'Bio-terrorism/ Food Defense Statement or Program',
        category: 'Egg Supplier Security',
        description: 'Bio-terrorism and food defense documentation',
        icon: Lock,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Security Measures', required: true }] }
      },
      {
        id: 'sds-sheet-egg',
        title: 'Current SDS Sheet or Letter of Exemption',
        category: 'Egg Supplier Safety',
        description: 'Safety Data Sheet or exemption letter',
        icon: AlertTriangle,
        required: true,
        regulatoryBody: 'OSHA',
        template: { sections: [{ name: 'Safety Information', required: true }] }
      },
      {
        id: 'food-fraud-assessment-egg',
        title: 'Food Fraud Vulnerability Assessment',
        category: 'Egg Supplier Risk',
        description: 'Assessment of food fraud vulnerabilities',
        icon: AlertTriangle,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Vulnerability Analysis', required: true }] }
      },
      {
        id: 'mitigation-strategies-egg',
        title: 'Mitigation Strategies/Statement',
        category: 'Egg Supplier Risk',
        description: 'Risk mitigation strategies and implementation statement',
        icon: Shield,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Mitigation Plans', required: true }] }
      },
      {
        id: 'ca-prop65-statement-egg',
        title: 'California Prop 65 Statement',
        category: 'Egg Supplier Compliance',
        description: 'California Proposition 65 compliance statement',
        icon: MapPin,
        required: false,
        regulatoryBody: 'California',
        template: { sections: [{ name: 'Prop 65 Compliance', required: true }] }
      },
      {
        id: 'flock-certificate-egg',
        title: 'Flock Certificate',
        category: 'Egg Supplier Health',
        description: 'Flock health and certification documentation',
        icon: Heart,
        required: true,
        regulatoryBody: 'USDA',
        template: { sections: [{ name: 'Flock Health Status', required: true }] }
      },
      {
        id: 'shelf-life-statement-egg',
        title: 'Product Shelf Life Statement',
        category: 'Egg Supplier Quality',
        description: 'Product shelf life and storage requirements',
        icon: Clock,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Shelf Life Data', required: true }] }
      },
      {
        id: 'transport-storage-egg',
        title: 'Transportation and Storage Requirements',
        category: 'Egg Supplier Logistics',
        description: 'Transportation and storage requirement specifications',
        icon: Truck,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Transport Requirements', required: true }] }
      },
      {
        id: 'cfr-118-letter-egg',
        title: '21 CFR 118 Letter',
        category: 'Egg Supplier Compliance',
        description: '21 CFR 118 compliance letter for shell egg producers',
        icon: FileText,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'CFR 118 Compliance', required: true }] }
      },
      {
        id: 'ethical-conduct-egg',
        title: 'Ethical Code of Conduct (ETI) Agreement',
        category: 'Egg Supplier Ethics',
        description: 'Ethical Trading Initiative code of conduct agreement',
        icon: Users,
        required: true,
        regulatoryBody: 'ETI',
        template: { sections: [{ name: 'Ethical Standards', required: true }] }
      }
    ];
  }

  if (userType === 'Poultry - Ingredient Supplier') {
    return [
      {
        id: 'supplier-questionnaire-ingredient',
        title: 'Completed Supplier Questionnaire',
        category: 'Ingredient Supplier Documentation',
        description: 'Comprehensive supplier information and capabilities questionnaire',
        icon: ClipboardCheck,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Company Information', required: true }] }
      },
      {
        id: 'allergen-survey-ingredient',
        title: 'Completed Allergen Survey',
        category: 'Ingredient Supplier Documentation',
        description: 'Allergen control and management assessment',
        icon: AlertTriangle,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Allergen Controls', required: true }] }
      },
      {
        id: 'ingredient-questionnaire',
        title: 'Completed Ingredient Supplier Questionnaire',
        category: 'Ingredient Supplier Documentation',
        description: 'Specific questionnaire for ingredient suppliers',
        icon: FileText,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Ingredient Details', required: true }] }
      },
      {
        id: 'letter-guarantee-ingredient',
        title: 'Dated Letter of Guarantee',
        category: 'Ingredient Supplier Legal',
        description: 'Legal guarantee documentation with date verification',
        icon: Shield,
        required: true,
        regulatoryBody: 'Legal',
        template: { sections: [{ name: 'Guarantee Terms', required: true }] }
      },
      {
        id: 'supplier-agreement-ingredient',
        title: 'Supplier Agreement',
        category: 'Ingredient Supplier Legal',
        description: 'Contractual agreement between buyer and ingredient supplier',
        icon: FileText,
        required: true,
        regulatoryBody: 'Legal',
        template: { sections: [{ name: 'Terms and Conditions', required: true }] }
      },
      {
        id: 'coa-example-ingredient',
        title: 'Example Certificate of Analysis',
        category: 'Ingredient Supplier Quality',
        description: 'Sample certificate of analysis for ingredients',
        icon: Award,
        required: true,
        regulatoryBody: 'Quality Control',
        template: { sections: [{ name: 'Analysis Results', required: true }] }
      },
      {
        id: 'lot-code-definitions-ingredient',
        title: 'Lot Code Definitions',
        category: 'Ingredient Supplier Traceability',
        description: 'Definition and explanation of lot coding system',
        icon: MapPin,
        required: true,
        regulatoryBody: 'Traceability',
        template: { sections: [{ name: 'Coding System', required: true }] }
      },
      {
        id: 'specification-sheet-ingredient',
        title: 'Specification Sheet (with nutritional information)',
        category: 'Ingredient Supplier Quality',
        description: 'Ingredient specifications including nutritional data',
        icon: FileText,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Nutritional Information', required: true }] }
      },
      {
        id: 'gfsi-certificate-ingredient',
        title: 'Current & Valid GFSI Certificate',
        category: 'Ingredient Supplier Certification',
        description: 'Global Food Safety Initiative certification',
        icon: Award,
        required: true,
        regulatoryBody: 'GFSI',
        template: { sections: [{ name: 'Certification Details', required: true }] }
      },
      {
        id: 'haccp-plan-ingredient',
        title: 'Copy of HACCP Plan with flow charts',
        category: 'Ingredient Supplier Food Safety',
        description: 'Hazard Analysis Critical Control Points plan with visual flow charts',
        icon: Shield,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'HACCP Documentation', required: true }] }
      },
      {
        id: 'identity-preservation-ingredient',
        title: 'Identity Preservation Certificates',
        category: 'Ingredient Supplier Certification',
        description: 'Certificates ensuring ingredient identity preservation',
        icon: CheckCircle,
        required: false,
        regulatoryBody: 'Certification Body',
        template: { sections: [{ name: 'Identity Verification', required: true }] }
      },
      {
        id: 'halal-certification-ingredient',
        title: 'Halal Certification or letter of compliance',
        category: 'Ingredient Supplier Religious',
        description: 'Halal certification or compliance documentation',
        icon: Award,
        required: false,
        regulatoryBody: 'Halal Authority',
        template: { sections: [{ name: 'Halal Compliance', required: true }] }
      },
      {
        id: 'kosher-certificate-ingredient',
        title: 'Kosher Certificate or letter of compliance',
        category: 'Ingredient Supplier Religious',
        description: 'Kosher certification or compliance documentation',
        icon: Award,
        required: false,
        regulatoryBody: 'Kosher Authority',
        template: { sections: [{ name: 'Kosher Compliance', required: true }] }
      },
      {
        id: 'kosher-passover-ingredient',
        title: 'Kosher for Passover Certificate',
        category: 'Ingredient Supplier Religious',
        description: 'Kosher for Passover certification',
        icon: Award,
        required: false,
        regulatoryBody: 'Kosher Authority',
        template: { sections: [{ name: 'Passover Compliance', required: true }] }
      },
      {
        id: 'country-origin-ingredient',
        title: 'Country of Origin (non-USA; FSVP Statement)',
        category: 'Ingredient Supplier Import',
        description: 'Country of origin documentation and FSVP statement for non-USA products',
        icon: Globe,
        required: false,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Origin Documentation', required: true }] }
      },
      {
        id: 'insurance-certificate-ingredient',
        title: 'Current Certificate of Insurance',
        category: 'Ingredient Supplier Insurance',
        description: 'Current and valid insurance coverage certificate',
        icon: Shield,
        required: true,
        regulatoryBody: 'Insurance Provider',
        template: { sections: [{ name: 'Coverage Details', required: true }] }
      },
      {
        id: 'non-gmo-statement-ingredient',
        title: 'Non-GMO Statement',
        category: 'Ingredient Supplier Quality',
        description: 'Non-genetically modified organism statement',
        icon: Leaf,
        required: false,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'GMO Status', required: true }] }
      },
      {
        id: 'bioterrorism-statement-ingredient',
        title: 'Bio-terrorism/ Food Defense Statement or Program',
        category: 'Ingredient Supplier Security',
        description: 'Bio-terrorism and food defense documentation',
        icon: Lock,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Security Measures', required: true }] }
      },
      {
        id: 'sds-sheet-ingredient',
        title: 'Current SDS Sheet or Letter of Exemption',
        category: 'Ingredient Supplier Safety',
        description: 'Safety Data Sheet or exemption letter',
        icon: AlertTriangle,
        required: true,
        regulatoryBody: 'OSHA',
        template: { sections: [{ name: 'Safety Information', required: true }] }
      },
      {
        id: 'food-fraud-assessment-ingredient',
        title: 'Food Fraud Vulnerability Assessment',
        category: 'Ingredient Supplier Risk',
        description: 'Assessment of food fraud vulnerabilities',
        icon: AlertTriangle,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Vulnerability Analysis', required: true }] }
      },
      {
        id: 'mitigation-strategies-ingredient',
        title: 'Mitigation Strategies/Statement',
        category: 'Ingredient Supplier Risk',
        description: 'Risk mitigation strategies and implementation statement',
        icon: Shield,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Mitigation Plans', required: true }] }
      },
      {
        id: 'ca-prop65-statement-ingredient',
        title: 'California Prop 65 Statement',
        category: 'Ingredient Supplier Compliance',
        description: 'California Proposition 65 compliance statement',
        icon: MapPin,
        required: false,
        regulatoryBody: 'California',
        template: { sections: [{ name: 'Prop 65 Compliance', required: true }] }
      },
      {
        id: 'shelf-life-statement-ingredient',
        title: 'Product Shelf Life Statement',
        category: 'Ingredient Supplier Quality',
        description: 'Ingredient shelf life and storage requirements',
        icon: Clock,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Shelf Life Data', required: true }] }
      },
      {
        id: 'transport-storage-ingredient',
        title: 'Transportation and Storage Requirements',
        category: 'Ingredient Supplier Logistics',
        description: 'Transportation and storage requirement specifications',
        icon: Truck,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Transport Requirements', required: true }] }
      },
      {
        id: 'cfr-118-letter-ingredient',
        title: '21 CFR 118 Letter',
        category: 'Ingredient Supplier Compliance',
        description: '21 CFR 118 compliance letter',
        icon: FileText,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'CFR 118 Compliance', required: true }] }
      },
      {
        id: 'ethical-conduct-ingredient',
        title: 'Ethical Code of Conduct (ETI) Agreement',
        category: 'Ingredient Supplier Ethics',
        description: 'Ethical Trading Initiative code of conduct agreement',
        icon: Users,
        required: true,
        regulatoryBody: 'ETI',
        template: { sections: [{ name: 'Ethical Standards', required: true }] }
      }
    ];
  }

  if (userType === 'Poultry - Packaging Supplier') {
    return [
      {
        id: 'country-origin-packaging',
        title: 'Country of Origin',
        category: 'Packaging Supplier Import',
        description: 'Country of origin documentation for packaging materials',
        icon: Globe,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Origin Documentation', required: true }] }
      },
      {
        id: 'haccp-flowchart-packaging',
        title: 'HACCP flow chart or CCPs',
        category: 'Packaging Supplier Food Safety',
        description: 'HACCP flow chart or Critical Control Points documentation',
        icon: Shield,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'HACCP Documentation', required: true }] }
      },
      {
        id: 'fsvp-compliance-packaging',
        title: 'FSVP Compliance',
        category: 'Packaging Supplier Compliance',
        description: 'Foreign Supplier Verification Program compliance',
        icon: CheckCircle,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'FSVP Documentation', required: true }] }
      },
      {
        id: 'insurance-certificate-packaging',
        title: 'Certificate of Insurance',
        category: 'Packaging Supplier Insurance',
        description: 'Current and valid insurance coverage certificate',
        icon: Shield,
        required: true,
        regulatoryBody: 'Insurance Provider',
        template: { sections: [{ name: 'Coverage Details', required: true }] }
      },
      {
        id: 'change-management-packaging',
        title: 'Management of Change',
        category: 'Packaging Supplier Quality',
        description: 'Change management procedures and documentation',
        icon: Settings,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Change Procedures', required: true }] }
      },
      {
        id: 'allergen-survey-packaging',
        title: 'Allergen Survey',
        category: 'Packaging Supplier Safety',
        description: 'Allergen control and management survey',
        icon: AlertTriangle,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Allergen Controls', required: true }] }
      },
      {
        id: 'approved-supplier-survey-packaging',
        title: 'Approved Supplier Survey',
        category: 'Packaging Supplier Documentation',
        description: 'Approved supplier assessment and survey',
        icon: ClipboardCheck,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Supplier Assessment', required: true }] }
      },
      {
        id: 'ethical-conduct-packaging',
        title: 'Ethical Code of Conduct',
        category: 'Packaging Supplier Ethics',
        description: 'Ethical code of conduct agreement',
        icon: Users,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Ethical Standards', required: true }] }
      },
      {
        id: 'letter-guarantee-packaging',
        title: 'Letter of Continuing Guarantee',
        category: 'Packaging Supplier Legal',
        description: 'Letter of continuing guarantee',
        icon: Shield,
        required: true,
        regulatoryBody: 'Legal',
        template: { sections: [{ name: 'Guarantee Terms', required: true }] }
      },
      {
        id: 'ca-prop65-packaging',
        title: 'California Prop 65',
        category: 'Packaging Supplier Compliance',
        description: 'California Proposition 65 compliance documentation',
        icon: MapPin,
        required: false,
        regulatoryBody: 'California',
        template: { sections: [{ name: 'Prop 65 Compliance', required: true }] }
      },
      {
        id: 'transport-storage-packaging',
        title: 'Transportation/Storage Requirements',
        category: 'Packaging Supplier Logistics',
        description: 'Transportation and storage requirement specifications',
        icon: Truck,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Transport Requirements', required: true }] }
      },
      {
        id: 'ca-transparency-packaging',
        title: 'California Transparency Act',
        category: 'Packaging Supplier Compliance',
        description: 'California Transparency in Supply Chains Act compliance',
        icon: MapPin,
        required: false,
        regulatoryBody: 'California',
        template: { sections: [{ name: 'Transparency Compliance', required: true }] }
      },
      {
        id: 'gfsi-certificate-packaging',
        title: 'GFSI Certificate',
        category: 'Packaging Supplier Certification',
        description: 'Global Food Safety Initiative certification',
        icon: Award,
        required: true,
        regulatoryBody: 'GFSI',
        template: { sections: [{ name: 'Certification Details', required: true }] }
      },
      {
        id: 'kosher-compliance-packaging',
        title: 'Kosher Certificate/Compliance',
        category: 'Packaging Supplier Religious',
        description: 'Kosher certification or compliance documentation',
        icon: Award,
        required: false,
        regulatoryBody: 'Kosher Authority',
        template: { sections: [{ name: 'Kosher Compliance', required: true }] }
      },
      {
        id: 'halal-compliance-packaging',
        title: 'Halal Certificate/Compliance',
        category: 'Packaging Supplier Religious',
        description: 'Halal certification or compliance documentation',
        icon: Award,
        required: false,
        regulatoryBody: 'Halal Authority',
        template: { sections: [{ name: 'Halal Compliance', required: true }] }
      },
      {
        id: 'specification-sheet-packaging',
        title: 'Specification Sheet',
        category: 'Packaging Supplier Quality',
        description: 'Packaging material specifications',
        icon: FileText,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Material Specifications', required: true }] }
      },
      {
        id: 'lot-code-definitions-packaging',
        title: 'Lot Code Definitions',
        category: 'Packaging Supplier Traceability',
        description: 'Definition and explanation of lot coding system',
        icon: MapPin,
        required: true,
        regulatoryBody: 'Traceability',
        template: { sections: [{ name: 'Coding System', required: true }] }
      },
      {
        id: 'coa-example-packaging',
        title: 'Example COA',
        category: 'Packaging Supplier Quality',
        description: 'Example Certificate of Analysis',
        icon: Award,
        required: true,
        regulatoryBody: 'Quality Control',
        template: { sections: [{ name: 'Analysis Results', required: true }] }
      },
      {
        id: 'shelf-life-packaging',
        title: 'Shelf Life',
        category: 'Packaging Supplier Quality',
        description: 'Packaging material shelf life documentation',
        icon: Clock,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Shelf Life Data', required: true }] }
      },
      {
        id: 'packaging-survey',
        title: 'Packaging Survey',
        category: 'Packaging Supplier Documentation',
        description: 'Comprehensive packaging supplier survey',
        icon: ClipboardCheck,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Packaging Assessment', required: true }] }
      },
      {
        id: 'sds-packaging',
        title: 'SDS',
        category: 'Packaging Supplier Safety',
        description: 'Safety Data Sheet for packaging materials',
        icon: AlertTriangle,
        required: true,
        regulatoryBody: 'OSHA',
        template: { sections: [{ name: 'Safety Information', required: true }] }
      }
    ];
  }

  if (userType === 'Poultry - Gas/Lube Supplier') {
    return [
      {
        id: 'country-origin-gas',
        title: 'Country of Origin',
        category: 'Gas/Lube Supplier Import',
        description: 'Country of origin documentation for gas/lube products',
        icon: Globe,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Origin Documentation', required: true }] }
      },
      {
        id: 'haccp-flowchart-gas',
        title: 'HACCP flow chart or CCPs',
        category: 'Gas/Lube Supplier Food Safety',
        description: 'HACCP flow chart or Critical Control Points documentation',
        icon: Shield,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'HACCP Documentation', required: true }] }
      },
      {
        id: 'fsvp-compliance-gas',
        title: 'FSVP Compliance',
        category: 'Gas/Lube Supplier Compliance',
        description: 'Foreign Supplier Verification Program compliance',
        icon: CheckCircle,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'FSVP Documentation', required: true }] }
      },
      {
        id: 'insurance-certificate-gas',
        title: 'Certificate of Insurance',
        category: 'Gas/Lube Supplier Insurance',
        description: 'Current and valid insurance coverage certificate',
        icon: Shield,
        required: true,
        regulatoryBody: 'Insurance Provider',
        template: { sections: [{ name: 'Coverage Details', required: true }] }
      },
      {
        id: 'change-management-gas',
        title: 'Management of Change',
        category: 'Gas/Lube Supplier Quality',
        description: 'Change management procedures and documentation',
        icon: Settings,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Change Procedures', required: true }] }
      },
      {
        id: 'allergen-survey-gas',
        title: 'Allergen Survey',
        category: 'Gas/Lube Supplier Safety',
        description: 'Allergen control and management survey',
        icon: AlertTriangle,
        required: true,
        regulatoryBody: 'FDA',
        template: { sections: [{ name: 'Allergen Controls', required: true }] }
      },
      {
        id: 'approved-supplier-survey-gas',
        title: 'Approved Supplier Survey',
        category: 'Gas/Lube Supplier Documentation',
        description: 'Approved supplier assessment and survey',
        icon: ClipboardCheck,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Supplier Assessment', required: true }] }
      },
      {
        id: 'ethical-conduct-gas',
        title: 'Ethical Code of Conduct',
        category: 'Gas/Lube Supplier Ethics',
        description: 'Ethical code of conduct agreement',
        icon: Users,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Ethical Standards', required: true }] }
      },
      {
        id: 'letter-guarantee-gas',
        title: 'Letter of Continuing Guarantee',
        category: 'Gas/Lube Supplier Legal',
        description: 'Letter of continuing guarantee',
        icon: Shield,
        required: true,
        regulatoryBody: 'Legal',
        template: { sections: [{ name: 'Guarantee Terms', required: true }] }
      },
      {
        id: 'ca-prop65-gas',
        title: 'California Prop 65',
        category: 'Gas/Lube Supplier Compliance',
        description: 'California Proposition 65 compliance documentation',
        icon: MapPin,
        required: false,
        regulatoryBody: 'California',
        template: { sections: [{ name: 'Prop 65 Compliance', required: true }] }
      },
      {
        id: 'transport-storage-gas',
        title: 'Transportation/Storage Requirements',
        category: 'Gas/Lube Supplier Logistics',
        description: 'Transportation and storage requirement specifications',
        icon: Truck,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Transport Requirements', required: true }] }
      },
      {
        id: 'ca-transparency-gas',
        title: 'California Transparency Act',
        category: 'Gas/Lube Supplier Compliance',
        description: 'California Transparency in Supply Chains Act compliance',
        icon: MapPin,
        required: false,
        regulatoryBody: 'California',
        template: { sections: [{ name: 'Transparency Compliance', required: true }] }
      },
      {
        id: 'gfsi-certificate-gas',
        title: 'GFSI Certificate',
        category: 'Gas/Lube Supplier Certification',
        description: 'Global Food Safety Initiative certification',
        icon: Award,
        required: true,
        regulatoryBody: 'GFSI',
        template: { sections: [{ name: 'Certification Details', required: true }] }
      },
      {
        id: 'kosher-compliance-gas',
        title: 'Kosher Certificate/Compliance',
        category: 'Gas/Lube Supplier Religious',
        description: 'Kosher certification or compliance documentation',
        icon: Award,
        required: false,
        regulatoryBody: 'Kosher Authority',
        template: { sections: [{ name: 'Kosher Compliance', required: true }] }
      },
      {
        id: 'halal-compliance-gas',
        title: 'Halal Certificate/Compliance',
        category: 'Gas/Lube Supplier Religious',
        description: 'Halal certification or compliance documentation',
        icon: Award,
        required: false,
        regulatoryBody: 'Halal Authority',
        template: { sections: [{ name: 'Halal Compliance', required: true }] }
      },
      {
        id: 'specification-sheet-gas',
        title: 'Specification Sheet',
        category: 'Gas/Lube Supplier Quality',
        description: 'Gas/lube product specifications',
        icon: FileText,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Product Specifications', required: true }] }
      },
      {
        id: 'lot-code-definitions-gas',
        title: 'Lot Code Definitions',
        category: 'Gas/Lube Supplier Traceability',
        description: 'Definition and explanation of lot coding system',
        icon: MapPin,
        required: true,
        regulatoryBody: 'Traceability',
        template: { sections: [{ name: 'Coding System', required: true }] }
      },
      {
        id: 'coa-example-gas',
        title: 'Example COA',
        category: 'Gas/Lube Supplier Quality',
        description: 'Example Certificate of Analysis',
        icon: Award,
        required: true,
        regulatoryBody: 'Quality Control',
        template: { sections: [{ name: 'Analysis Results', required: true }] }
      },
      {
        id: 'shelf-life-gas',
        title: 'Shelf Life',
        category: 'Gas/Lube Supplier Quality',
        description: 'Product shelf life documentation',
        icon: Clock,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Shelf Life Data', required: true }] }
      },
      {
        id: 'gas-lube-survey',
        title: 'Gas/Lube Supplier Survey',
        category: 'Gas/Lube Supplier Documentation',
        description: 'Comprehensive gas/lube supplier survey',
        icon: ClipboardCheck,
        required: true,
        regulatoryBody: 'Internal',
        template: { sections: [{ name: 'Supplier Assessment', required: true }] }
      },
      {
        id: 'sds-gas',
        title: 'SDS',
        category: 'Gas/Lube Supplier Safety',
        description: 'Safety Data Sheet for gas/lube products',
        icon: AlertTriangle,
        required: true,
        regulatoryBody: 'OSHA',
        template: { sections: [{ name: 'Safety Information', required: true }] }
      }
    ];
  }
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
