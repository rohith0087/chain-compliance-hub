import AdvancedComplianceInsightsDashboard from './AdvancedComplianceInsightsDashboard';

interface ComplianceInsightsDashboardProps {
  companyId: string;
  companyType: string;
  className?: string;
}

const ComplianceInsightsDashboard: React.FC<ComplianceInsightsDashboardProps> = (props) => {
  return <AdvancedComplianceInsightsDashboard {...props} />;
};

export default ComplianceInsightsDashboard;