import { motion } from 'framer-motion';
import { PasswordChangeForm } from '@/components/settings/PasswordChangeForm';
import { MFASettingsSection } from '@/components/settings/MFASettingsSection';
import { PasskeysSettingsSection } from '@/components/settings/PasskeysSettingsSection';
import { pageTitleClass, sectionLabelClass, mutedBodyClass } from '@/design/system';

// Buyer security page: password, two-factor authentication, and passkeys.
export function SecuritySettingsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-3xl space-y-6 pb-16"
    >
      <div className="space-y-1.5">
        <p className={sectionLabelClass}>Settings</p>
        <h1 className={pageTitleClass}>Security & sign-in</h1>
        <p className={mutedBodyClass}>
          Manage your password, two-factor authentication, and passkeys.
        </p>
      </div>

      <div className="space-y-6">
        <PasswordChangeForm />
        <MFASettingsSection />
        <PasskeysSettingsSection />
      </div>
    </motion.div>
  );
}
