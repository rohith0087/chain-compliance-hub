import { motion } from 'framer-motion';
import { IntegrationsPanel } from '@/components/settings/IntegrationsPanel';
import { pageTitleClass, sectionLabelClass, mutedBodyClass } from '@/design/system';

interface IntegrationSettingsPageProps {
  /** Buyer org id — used for the org-scoped AI-provider section. */
  companyId?: string;
}

// Buyer integrations page: personal tool connections + org AI provider.
// Composio OAuth returns to /?open=integrations; BuyerDashboard routes that here.
export function IntegrationSettingsPage({ companyId }: IntegrationSettingsPageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-3xl space-y-6 pb-16"
    >
      <div className="space-y-1.5">
        <p className={sectionLabelClass}>Settings</p>
        <h1 className={pageTitleClass}>Integrations</h1>
        <p className={mutedBodyClass}>
          Connect the tools your assistant can act through. Your connections are personal; the AI provider is shared by your organization.
        </p>
      </div>

      <IntegrationsPanel organizationId={companyId ?? null} />
    </motion.div>
  );
}
