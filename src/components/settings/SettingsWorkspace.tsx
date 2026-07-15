import { useState } from 'react';
import { AccountSettingsForm } from './AccountSettingsForm';
import { PasswordChangeForm } from './PasswordChangeForm';
import { NotificationSettingsForm } from './NotificationSettingsForm';
import { IntegrationsPanel } from './IntegrationsPanel';
import { CompanyManagementDashboard } from '@/components/company/CompanyManagementDashboard';
import SubscriptionPage from '@/pages/SubscriptionPage';

export interface SettingsWorkspaceProps {
  companyId?: string;
  companyType?: 'buyer' | 'supplier';
  companyName?: string;
  defaultTab?: string;
  /** Rendered inside the settings modal (tighter paddings) vs as a full page. */
  embedded?: boolean;
}

interface TabDef {
  id: string;
  label: string;
  title: string;
  description: string;
}

// Untitled-UI "Settings 04" texture: page title, one joined horizontal tab bar,
// then a section header row (title + helper text) over a divider, content below.
// The child forms are untouched — the shell provides the look.
export function SettingsWorkspace({
  companyId,
  companyType,
  companyName,
  defaultTab = 'account',
  embedded = false,
}: SettingsWorkspaceProps) {
  const tabs: TabDef[] = [
    { id: 'account', label: 'My details', title: 'Personal info', description: 'Update your personal details and preferences here.' },
    { id: 'general', label: 'Company', title: 'Company profile', description: 'Update your company photo and details here.' },
    { id: 'security', label: 'Password', title: 'Password', description: 'Please enter your current password to change your password.' },
    { id: 'notifications', label: 'Notifications', title: 'Notifications', description: 'Choose what updates you receive and how.' },
    { id: 'users', label: 'Team', title: 'Team members', description: 'Manage your team and their account permissions here.' },
    { id: 'branches', label: 'Branches', title: 'Branches', description: 'Manage your locations and per-branch access.' },
    { id: 'integrations', label: 'Integrations', title: 'Integrations', description: 'Connect AI providers and tools your team already uses.' },
    { id: 'billing', label: 'Plan & Billing', title: 'Plan & billing', description: 'Manage your subscription, invoices and payment method.' },
  ];

  const [active, setActive] = useState(tabs.some((t) => t.id === defaultTab) ? defaultTab : 'account');
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  const needsCompany = new Set(['general', 'users', 'branches']);
  const companyReady = Boolean(companyId && companyType);

  return (
    <div className={embedded ? 'px-8 py-6' : 'mx-auto max-w-5xl px-2 py-2'}>
      {/* Page title */}
      <h1 className="text-2xl font-semibold text-foreground">Settings</h1>

      {/* Joined horizontal tab bar */}
      <div className="mt-4 inline-flex max-w-full overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`whitespace-nowrap px-4 py-2 text-sm transition-colors ${i > 0 ? 'border-l border-border' : ''} ${
              active === tab.id
                ? 'bg-muted/70 font-semibold text-foreground'
                : 'font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Section header */}
      <div className="mt-7 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{current.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{current.description}</p>
        </div>
      </div>

      {/* Content */}
      <div className="pt-6 pb-16 animate-in fade-in slide-in-from-bottom-2 duration-300" key={active}>
        {active === 'account' && <AccountSettingsForm />}
        {active === 'security' && <div className="max-w-xl"><PasswordChangeForm /></div>}
        {active === 'notifications' && <NotificationSettingsForm />}
        {active === 'integrations' && <IntegrationsPanel organizationId={companyId ?? null} />}
        {active === 'billing' && (
          <div className="[&_.min-h-screen]:min-h-0 [&_.bg-gradient-subtle]:bg-transparent">
            <SubscriptionPage />
          </div>
        )}
        {needsCompany.has(active) && (companyReady ? (
          <CompanyManagementDashboard
            companyId={companyId!}
            companyType={companyType!}
            companyName={companyName || 'Company'}
            defaultTab={active === 'general' ? 'overview' : active === 'users' ? 'users' : 'branches'}
            embedded
          />
        ) : (
          <p className="text-sm text-muted-foreground">Company management requires an active company context.</p>
        ))}
      </div>
    </div>
  );
}
