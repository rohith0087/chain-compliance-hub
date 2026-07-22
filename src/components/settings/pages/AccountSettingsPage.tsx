import { motion } from 'framer-motion';
import { AccountSettingsForm } from '@/components/settings/AccountSettingsForm';
import { pageTitleClass, sectionLabelClass, mutedBodyClass } from '@/design/system';

// Buyer settings landing: personal details (photo, name, email).
// Two-factor settings live on the Security page.
export function AccountSettingsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-3xl space-y-6 pb-16"
    >
      <div className="space-y-1.5">
        <p className={sectionLabelClass}>Settings</p>
        <h1 className={pageTitleClass}>Account</h1>
        <p className={mutedBodyClass}>
          Update your personal details and how you appear across the workspace.
        </p>
      </div>

      <AccountSettingsForm />
    </motion.div>
  );
}
