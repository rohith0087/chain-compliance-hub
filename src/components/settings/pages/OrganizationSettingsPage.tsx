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
// Redundancies from the shared dashboard (still used as-is by the supplier side
// and the legacy SettingsWorkspace) are hidden here via props:
//  - 'notifications' tab: notification settings have their own dedicated
//    settings page (NotificationSettingsPage).
//  - Overview's DashboardViewPreference block: lives on PreferencesSettingsPage.
//  - The floating branch selector above the tab bar: duplicates the app-level
//    BranchSelector in the buyer sidebar layout header. Branch switching stays
//    available via the "Current Branch" card's compact selector.
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
        hideTabs={['notifications']}
        showDashboardViewPreference={false}
        showBranchSelector={false}
      />
    </motion.div>
  );
}
