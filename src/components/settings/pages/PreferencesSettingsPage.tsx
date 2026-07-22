import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardViewPreference } from '@/components/settings/DashboardViewPreference';
import {
  pageTitleClass,
  sectionLabelClass,
  mutedBodyClass,
  cardClass,
  cardPadClass,
  inlineIconClass,
} from '@/design/system';

// Buyer preferences page: dashboard layout + appearance (light/dark).
export function PreferencesSettingsPage() {
  const { resolvedTheme, setTheme } = useTheme();
  // next-themes returns undefined for resolvedTheme until mounted; acting on
  // that stale value makes the toggle no-op on the first click. Gate on mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-3xl space-y-6 pb-16"
    >
      <div className="space-y-1.5">
        <p className={sectionLabelClass}>Settings</p>
        <h1 className={pageTitleClass}>Preferences</h1>
        <p className={mutedBodyClass}>
          Tailor how your dashboard looks and which view it opens with.
        </p>
      </div>

      <DashboardViewPreference />

      <div className={`${cardClass} ${cardPadClass}`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-body font-semibold text-foreground">Appearance</p>
            <p className="text-small text-muted-foreground">
              Switch between the light and dark surface. Your choice is remembered on this device.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            disabled={!mounted}
          >
            {isDark ? <Sun className={inlineIconClass} /> : <Moon className={inlineIconClass} />}
            {isDark ? 'Light' : 'Dark'}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
