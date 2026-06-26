import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  X, Search, Settings, User, Shield, 
  Bell, Users, Building2, Blocks, CreditCard, Laptop
} from 'lucide-react';
import { AccountSettingsForm } from './AccountSettingsForm';
import { PasswordChangeForm } from './PasswordChangeForm';
import { NotificationSettingsForm } from './NotificationSettingsForm';
import { IntegrationsPanel } from './IntegrationsPanel';
import { CompanyManagementDashboard } from '@/components/company/CompanyManagementDashboard';

interface UnifiedSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
  companyId?: string;
  companyType?: 'buyer' | 'supplier';
  companyName?: string;
}

export function UnifiedSettingsModal({ 
  open, 
  onOpenChange, 
  defaultTab = 'general',
  companyId,
  companyType,
  companyName
}: UnifiedSettingsModalProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [search, setSearch] = useState('');

  const navigation = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'account', label: 'Account', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'branches', label: 'Branches', icon: Building2 },
    { id: 'integrations', label: 'Integrations', icon: Blocks },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1100px] h-[85vh] p-0 gap-0 overflow-hidden bg-white flex flex-col border-none shadow-2xl rounded-2xl">
        
        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden h-full">
          
          {/* Sidebar */}
          <div className="w-[280px] shrink-0 border-r border-slate-200 bg-[#FAFAFA] flex flex-col relative z-10">
            {/* Header / Search */}
            <div className="p-4 flex flex-col gap-4">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input 
                  placeholder="Search settings..." 
                  className="pl-9 h-9 bg-white border-slate-200 shadow-sm rounded-lg focus-visible:ring-1 focus-visible:ring-slate-300 text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-1">
                Settings
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-3 w-full px-3 py-2 text-sm rounded-lg transition-colors ${
                      isActive 
                        ? 'font-semibold text-slate-900 bg-slate-200/60' 
                        : 'font-medium text-slate-600 hover:bg-slate-200/40 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-200 bg-[#FAFAFA] space-y-2">
              <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 cursor-not-allowed opacity-50">
                <CreditCard className="w-4 h-4" /> Billing (Soon)
              </div>
              <div className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 cursor-not-allowed opacity-50">
                <Laptop className="w-4 h-4" /> Desktop App (Soon)
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
            
            {/* Close button top right */}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onOpenChange(false)} 
              className="absolute top-4 right-4 rounded-full hover:bg-slate-100 w-8 h-8 z-50"
            >
              <X className="w-4 h-4" />
            </Button>

            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto p-10 pb-20">
                
                {/* Dynamic Content based on activeTab */}
                {activeTab === 'general' && companyId && companyType && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {companyType === 'buyer' && <DashboardViewPreference />}
                    <CompanyManagementDashboard 
                      companyId={companyId}
                      companyType={companyType}
                      companyName={companyName || 'Company'}
                      defaultTab="company"
                      embedded
                    />
                  </div>
                )}

                {activeTab === 'general' && (!companyId || !companyType) && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div>
                      <h2 className="text-xl font-bold font-serif text-slate-900 mb-1">General</h2>
                      <p className="text-sm text-slate-500">Company management requires an active company context.</p>
                    </div>
                  </div>
                )}

                {activeTab === 'account' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div>
                      <h2 className="text-xl font-bold font-serif text-slate-900 mb-1">Account</h2>
                      <p className="text-sm text-slate-500">Manage your personal profile and preferences.</p>
                    </div>
                    <AccountSettingsForm />
                  </div>
                )}

                {activeTab === 'security' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div>
                      <h2 className="text-xl font-bold font-serif text-slate-900 mb-1">Security</h2>
                      <p className="text-sm text-slate-500">Update your password and secure your account.</p>
                    </div>
                    <PasswordChangeForm />
                  </div>
                )}

                {activeTab === 'notifications' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div>
                      <h2 className="text-xl font-bold font-serif text-slate-900 mb-1">Notifications</h2>
                      <p className="text-sm text-slate-500">Choose what updates you want to receive and how.</p>
                    </div>
                    <NotificationSettingsForm />
                  </div>
                )}

                {activeTab === 'users' && companyId && companyType && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <CompanyManagementDashboard 
                      companyId={companyId}
                      companyType={companyType}
                      companyName={companyName || 'Company'}
                      defaultTab="users"
                      embedded
                    />
                  </div>
                )}

                {activeTab === 'branches' && companyId && companyType && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <CompanyManagementDashboard 
                      companyId={companyId}
                      companyType={companyType}
                      companyName={companyName || 'Company'}
                      defaultTab="branches"
                      embedded
                    />
                  </div>
                )}

              </div>
              
              {/* Integrations panel */}
              {activeTab === 'integrations' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto p-10 pb-20">
                  <IntegrationsPanel organizationId={companyId ?? null} />
                </div>
              )}
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
