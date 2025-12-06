import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home,
  Users,
  FileCheck,
  BarChart3,
  Building2,
  CreditCard,
  Search,
  Plus,
  Send,
  Settings,
  Compass,
  ClipboardCheck,
  GitBranch,
  Upload,
  UserCheck,
  FileText,
  FolderKanban,
  Package,
  ListChecks
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

interface CommandPaletteSearchProps {
  onTabChange: (tab: string) => void;
  onShowRequestForm: () => void;
  onShowSettings: () => void;
  onShowQuickOnboarding: () => void;
  onShowBulkInvite: () => void;
}

const navigationItems = [
  { title: 'Dashboard', value: 'dashboard', icon: Home, keywords: ['home', 'overview'] },
  { title: 'Suppliers', value: 'suppliers', icon: Users, keywords: ['vendors', 'discovery'] },
  { title: 'Supplier Map', value: 'supplier-map', icon: Compass, keywords: ['location', 'geography'] },
  { title: 'Connection Requests', value: 'supplier-requests', icon: UserCheck, keywords: ['pending', 'approve'] },
  { title: 'Pre-populate Documents', value: 'pre-populate', icon: Upload, keywords: ['upload', 'bulk'] },
  { title: 'Document Requests', value: 'requests', icon: ListChecks, keywords: ['pending', 'new'] },
  { title: 'Documents', value: 'documents', icon: FileCheck, keywords: ['files', 'uploads'] },
  { title: 'Templates', value: 'templates', icon: FileText, keywords: ['forms', 'custom'] },
  { title: 'Document Sets', value: 'document-sets', icon: FolderKanban, keywords: ['groups', 'collections'] },
  { title: 'Compliance Overview', value: 'compliance', icon: BarChart3, keywords: ['analytics', 'status'] },
  { title: 'Item Compliance', value: 'item-compliance', icon: Package, keywords: ['products', 'items'] },
  { title: 'Facility Matrix', value: 'facility-matrix', icon: Building2, keywords: ['locations', 'branches'] },
  { title: 'Assignments', value: 'assignments', icon: ClipboardCheck, keywords: ['tasks', 'assigned'] },
  { title: 'Onboarding Pipeline', value: 'onboarding', icon: GitBranch, keywords: ['pipeline', 'progress'] },
  { title: 'Company Management', value: 'company', icon: Building2, keywords: ['team', 'users', 'branches'] },
  { title: 'Subscription & Billing', value: 'subscription', icon: CreditCard, keywords: ['plan', 'payment'] },
];

const quickActions = [
  { title: 'Create New Request', action: 'new-request', icon: Plus, keywords: ['add', 'document'] },
  { title: 'Open Compliance Compass', action: 'chat', icon: Compass, keywords: ['ai', 'assistant', 'help'] },
  { title: 'Bulk Invite Suppliers', action: 'bulk-invite', icon: Send, keywords: ['invite', 'email'] },
  { title: 'Open Settings', action: 'settings', icon: Settings, keywords: ['preferences', 'account'] },
];

export function CommandPaletteSearch({
  onTabChange,
  onShowRequestForm,
  onShowSettings,
  onShowQuickOnboarding,
  onShowBulkInvite
}: CommandPaletteSearchProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Keyboard shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleNavigation = (value: string) => {
    onTabChange(value);
    setOpen(false);
  };

  const handleAction = (action: string) => {
    setOpen(false);
    switch (action) {
      case 'new-request':
        onShowRequestForm();
        break;
      case 'chat':
        navigate('/chat');
        break;
      case 'bulk-invite':
        onShowBulkInvite();
        break;
      case 'settings':
        onShowSettings();
        break;
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start rounded-lg bg-muted/50 text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Search...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search navigation, actions..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          <CommandGroup heading="Quick Actions">
            {quickActions.map((item) => (
              <CommandItem
                key={item.action}
                value={`${item.title} ${item.keywords.join(' ')}`}
                onSelect={() => handleAction(item.action)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />
          
          <CommandGroup heading="Navigation">
            {navigationItems.map((item) => (
              <CommandItem
                key={item.value}
                value={`${item.title} ${item.keywords.join(' ')}`}
                onSelect={() => handleNavigation(item.value)}
              >
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
