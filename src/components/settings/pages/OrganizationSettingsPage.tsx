import { motion } from 'framer-motion';
import { CompanyManagementDashboard } from '@/components/company/CompanyManagementDashboard';
import { sectionLabelClass } from '@/design/system';

interface OrganizationSettingsPageProps {
  companyId: string;
  companyName: string;
}

// Buyer organization page: single non-embedded mount of CompanyManagementDashboard,
// which brings its own internal sub-nav (Overview, Branches, Users, Permissions,
// Company, Onboarding) and page header — so this page only adds the "Settings"
// eyebrow, not a duplicate H1.
//
// Known duplications (left in place because CompanyManagementDashboard is shared
// with the supplier side; revisit in Phase 3):
//  - Overview tab embeds DashboardViewPreference (also on the Preferences page).
//  - Non-embedded buyer mode shows a Notifications tab (also a settings page).
export function OrganizationSettingsPage({ companyId, companyName }: OrganizationSettingsPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="pb-16"
    >
      <p className={`${sectionLabelClass} mb-2`}>Settings</p>
      <CompanyManagementDashboard
        companyId={companyId}
        companyType="buyer"
        companyName={companyName}
      />
    </motion.div>
  );
}
