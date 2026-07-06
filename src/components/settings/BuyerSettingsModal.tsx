import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Building2,
  Layers,
  Bell,
  User,
  Lock,
  Plug,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SafeSelect, SafeSelectItem } from '@/components/ui/SafeSelect';
import { VALID_INDUSTRIES } from '@/config/industries';
import { AccountSettingsForm } from './AccountSettingsForm';
import { PasswordChangeForm } from './PasswordChangeForm';
import { LogoUploadWidget } from './LogoUploadWidget';
import { DefaultOnboardingSettings } from './DefaultOnboardingSettings';
import { NotificationSettingsForm } from './NotificationSettingsForm';
import { AddressFields, AddressData, emptyAddressData } from '@/components/shared/AddressFields';
import { IntegrationsPanel } from './IntegrationsPanel';

interface BuyerSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsUpdated?: () => void;
}

type NavSection =
  | 'company'
  | 'onboarding'
  | 'notifications'
  | 'account'
  | 'password'
  | 'integrations';

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ElementType;
  ownerOnly?: boolean;
  adminAndOwner?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'company',       label: 'Company',       icon: Building2,  ownerOnly: true },
  { id: 'onboarding',    label: 'Onboarding',    icon: Layers,     adminAndOwner: true },
  { id: 'notifications', label: 'Notifications', icon: Bell,       ownerOnly: true },
  { id: 'account',       label: 'Account',       icon: User },
  { id: 'password',      label: 'Password',      icon: Lock },
  { id: 'integrations',  label: 'Integrations',  icon: Plug },
];

export const BuyerSettingsModal: React.FC<BuyerSettingsModalProps> = ({
  open,
  onOpenChange,
  onSettingsUpdated,
}) => {
  const [buyerData, setBuyerData] = useState({
    company_name: '',
    industry: '',
    contact_email: '',
    phone: '',
    company_logo_url: '',
    ...emptyAddressData(),
  });
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [activeSection, setActiveSection] = useState<NavSection>('company');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (open && user) {
      void loadBuyerData();
    }
  }, [open, user]);

  // Reset to default section when modal opens
  useEffect(() => {
    if (open) setActiveSection(isOwner ? 'company' : isAdmin ? 'onboarding' : 'account');
  }, [open, isOwner, isAdmin]);

  const loadBuyerData = async () => {
    if (!user) return;
    try {
      const { data: teamMember } = await supabase
        .from('company_users')
        .select('company_id, company_type, role')
        .eq('profile_id', user.id)
        .eq('company_type', 'buyer')
        .eq('status', 'active')
        .single();

      let buyerId: string;

      if (teamMember) {
        buyerId = teamMember.company_id;
        const { data: ownerCheck } = await supabase
          .from('buyers')
          .select('id')
          .eq('profile_id', user.id)
          .eq('id', teamMember.company_id)
          .maybeSingle();
        const userIsOwner = !!ownerCheck;
        const userIsAdmin = teamMember.role === 'company_admin';
        setIsOwner(userIsOwner);
        setIsAdmin(userIsAdmin);
        setCanEdit(userIsOwner || userIsAdmin);
      } else {
        const { data: buyer } = await supabase
          .from('buyers')
          .select('id')
          .eq('profile_id', user.id)
          .single();
        if (!buyer) throw new Error('No buyer profile found');
        buyerId = buyer.id;
        setIsOwner(true);
        setCanEdit(true);
      }

      setCompanyId(buyerId);

      const { data: bd, error } = await supabase
        .from('buyers')
        .select('*')
        .eq('id', buyerId)
        .single();
      if (error) throw error;
      if (bd) {
        setBuyerData({
          company_name: bd.company_name || '',
          industry: bd.industry || '',
          contact_email: bd.contact_email || '',
          phone: bd.phone || '',
          company_logo_url: bd.company_logo_url || '',
          address_line1: bd.address_line1 || '',
          address_line2: bd.address_line2 || '',
          city: bd.city || '',
          state: bd.state || '',
          postal_code: bd.postal_code || '',
          country: bd.country || '',
        });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to load company information', variant: 'destructive' });
    }
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !companyId || !canEdit) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('buyers')
        .update({
          company_name: buyerData.company_name,
          industry: buyerData.industry,
          contact_email: buyerData.contact_email,
          phone: buyerData.phone,
          company_logo_url: buyerData.company_logo_url,
          address_line1: buyerData.address_line1,
          address_line2: buyerData.address_line2,
          city: buyerData.city,
          state: buyerData.state,
          postal_code: buyerData.postal_code,
          country: buyerData.country,
        })
        .eq('id', companyId);
      if (error) throw error;
      toast({ title: 'Success', description: 'Company settings updated successfully' });
      onSettingsUpdated?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update company settings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpdate = async (url: string | null) => {
    if (!canEdit) {
      toast({ title: 'Permission Denied', description: 'Only company admins can update the logo', variant: 'destructive' });
      return;
    }
    setBuyerData((prev) => ({ ...prev, company_logo_url: url || '' }));
    if (!user || !companyId) return;
    try {
      const { error } = await supabase
        .from('buyers')
        .update({ company_logo_url: url || '' })
        .eq('id', companyId);
      if (error) throw error;
      toast({ title: 'Success', description: 'Logo updated and saved successfully' });
      onSettingsUpdated?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save logo', variant: 'destructive' });
    }
  };

  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.ownerOnly) return isOwner;
    if (item.adminAndOwner) return isOwner || isAdmin;
    return true;
  });

  // Ensure activeSection is valid for this user
  const resolvedSection: NavSection =
    visibleNav.some((n) => n.id === activeSection) ? activeSection : (visibleNav[0]?.id ?? 'account');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[860px] h-[88vh] p-0 gap-0 overflow-hidden rounded-[20px] border border-border shadow-2xl flex flex-col">
        {/* Header bar */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 flex-shrink-0">
          <h1 className="text-[15px] font-bold text-foreground">Settings</h1>
          <button
            onClick={() => onOpenChange(false)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-[176px] flex-shrink-0 border-r border-border bg-muted py-4 px-3">
            {/* Workspace group */}
            {visibleNav.some((n) => n.ownerOnly || n.adminAndOwner) && (
              <>
                <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Workspace</p>
                {visibleNav
                  .filter((n) => n.ownerOnly || n.adminAndOwner)
                  .map((item) => (
                    <NavBtn
                      key={item.id}
                      item={item}
                      active={resolvedSection === item.id}
                      onClick={() => setActiveSection(item.id)}
                    />
                  ))}
                <div className="my-3 border-t border-border" />
              </>
            )}

            {/* Personal group */}
            <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Personal</p>
            {visibleNav
              .filter((n) => !n.ownerOnly && !n.adminAndOwner && n.id !== 'integrations')
              .map((item) => (
                <NavBtn
                  key={item.id}
                  item={item}
                  active={resolvedSection === item.id}
                  onClick={() => setActiveSection(item.id)}
                />
              ))}

            <div className="my-3 border-t border-border" />

            {/* Platform group */}
            <p className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Platform</p>
            <NavBtn
              item={{ id: 'integrations', label: 'Integrations', icon: Plug }}
              active={resolvedSection === 'integrations'}
              onClick={() => setActiveSection('integrations')}
            />
          </aside>

          {/* Content pane */}
          <main className="flex-1 overflow-y-auto px-8 py-6">
            {resolvedSection === 'company' && isOwner && (
              <CompanyPanel
                buyerData={buyerData}
                setBuyerData={setBuyerData}
                canEdit={canEdit}
                loading={loading}
                handleLogoUpdate={handleLogoUpdate}
                handleCompanySubmit={handleCompanySubmit}
              />
            )}
            {resolvedSection === 'onboarding' && (isOwner || isAdmin) && (
              <DefaultOnboardingSettings />
            )}
            {resolvedSection === 'notifications' && isOwner && (
              <NotificationSettingsForm />
            )}
            {resolvedSection === 'account' && (
              <AccountSettingsForm />
            )}
            {resolvedSection === 'password' && (
              <PasswordChangeForm />
            )}
            {resolvedSection === 'integrations' && (
              <IntegrationsPanel organizationId={companyId} />
            )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── NavBtn ─────────────────────────────────────────────────────────────────────

interface NavBtnProps {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}

function NavBtn({ item, active, onClick }: NavBtnProps) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={[
        'flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[13px] font-medium transition-colors mb-0.5',
        active
          ? 'bg-card text-foreground shadow-sm border border-border'
          : 'text-muted-foreground hover:bg-card/60 hover:text-foreground/80',
      ].join(' ')}
    >
      <Icon className={['h-4 w-4 flex-shrink-0', active ? 'text-[#2563EB]' : 'text-muted-foreground/70'].join(' ')} />
      {item.label}
    </button>
  );
}

// ── CompanyPanel ───────────────────────────────────────────────────────────────

interface CompanyPanelProps {
  buyerData: {
    company_name: string; industry: string; contact_email: string; phone: string;
    company_logo_url: string;
  } & AddressData;
  setBuyerData: React.Dispatch<React.SetStateAction<any>>;
  canEdit: boolean;
  loading: boolean;
  handleLogoUpdate: (url: string | null) => void;
  handleCompanySubmit: (e: React.FormEvent) => void;
}

function CompanyPanel({
  buyerData, setBuyerData, canEdit, loading, handleLogoUpdate, handleCompanySubmit,
}: CompanyPanelProps) {
  return (
    <div className="space-y-6 max-w-[560px]">
      <div>
        <h2 className="text-[16px] font-bold text-foreground">Company</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">Manage your organization's profile and address.</p>
      </div>

      <div className="rounded-[14px] border border-border bg-card p-5 space-y-5">
        <div>
          <Label className="text-[13px] font-semibold text-foreground/80">Company Logo</Label>
          <div className="mt-2">
            <LogoUploadWidget
              currentLogoUrl={buyerData.company_logo_url}
              onLogoUpdate={canEdit ? handleLogoUpdate : () => {}}
              embedded
            />
          </div>
        </div>

        <div className="border-t border-border" />

        <form onSubmit={handleCompanySubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[13px] font-medium text-foreground/80">Company Name</Label>
              <Input
                className="mt-1 h-9 text-[13px]"
                value={buyerData.company_name}
                onChange={(e) => setBuyerData((p: any) => ({ ...p, company_name: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label className="text-[13px] font-medium text-foreground/80">Industry</Label>
              <SafeSelect
                value={buyerData.industry}
                onValueChange={(v) => setBuyerData((p: any) => ({ ...p, industry: v }))}
                placeholder="Select industry"
              >
                {VALID_INDUSTRIES.map((ind) => (
                  <SafeSelectItem key={ind} value={ind}>{ind}</SafeSelectItem>
                ))}
              </SafeSelect>
              {buyerData.industry === 'Auditor' && (
                <p className="mt-1 text-[11px] text-blue-600 bg-blue-50 border border-blue-100 rounded-[6px] px-2 py-1.5">
                  Auditor workspace enabled — dashboard shows audit terminology.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[13px] font-medium text-foreground/80">Contact Email</Label>
              <Input
                className="mt-1 h-9 text-[13px]"
                type="email"
                value={buyerData.contact_email}
                onChange={(e) => setBuyerData((p: any) => ({ ...p, contact_email: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label className="text-[13px] font-medium text-foreground/80">Phone</Label>
              <Input
                className="mt-1 h-9 text-[13px]"
                value={buyerData.phone}
                onChange={(e) => setBuyerData((p: any) => ({ ...p, phone: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label className="text-[13px] font-semibold text-foreground/80 mb-1 block">Address</Label>
            <AddressFields
              data={{
                address_line1: buyerData.address_line1,
                address_line2: buyerData.address_line2,
                city: buyerData.city,
                state: buyerData.state,
                postal_code: buyerData.postal_code,
                country: buyerData.country,
              }}
              onChange={(field, value) => setBuyerData((p: any) => ({ ...p, [field]: value }))}
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="h-9 w-full rounded-[10px] bg-primary text-[13px] font-semibold text-white hover:bg-primary-hover"
          >
            {loading ? 'Saving…' : 'Save Company Information'}
          </Button>
        </form>
      </div>
    </div>
  );
}
