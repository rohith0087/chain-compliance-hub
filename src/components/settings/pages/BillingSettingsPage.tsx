import { motion } from 'framer-motion';
import SubscriptionPage from '@/pages/SubscriptionPage';
import { pageTitleClass, sectionLabelClass, mutedBodyClass } from '@/design/system';

// Buyer billing page: SubscriptionPage in embedded mode (no full-screen wrapper
// or duplicate header — the page provides those).
export function BillingSettingsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-5xl space-y-6 pb-16"
    >
      <div className="space-y-1.5">
        <p className={sectionLabelClass}>Settings</p>
        <h1 className={pageTitleClass}>Plan & billing</h1>
        <p className={mutedBodyClass}>
          Manage your subscription, invoices, and credit add-ons.
        </p>
      </div>

      <SubscriptionPage embedded />
    </motion.div>
  );
}
