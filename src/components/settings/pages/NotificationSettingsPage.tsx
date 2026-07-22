import { motion } from 'framer-motion';
import { NotificationSettingsForm } from '@/components/settings/NotificationSettingsForm';
import { pageTitleClass, sectionLabelClass, mutedBodyClass } from '@/design/system';

// Buyer notifications page: what updates you receive and how.
export function NotificationSettingsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-3xl space-y-6 pb-16"
    >
      <div className="space-y-1.5">
        <p className={sectionLabelClass}>Settings</p>
        <h1 className={pageTitleClass}>Notifications</h1>
        <p className={mutedBodyClass}>
          Choose what updates you receive and how you receive them.
        </p>
      </div>

      <NotificationSettingsForm />
    </motion.div>
  );
}
