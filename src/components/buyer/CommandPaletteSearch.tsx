import { useState, useEffect, useMemo, useCallback } from 'react';
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
  ListChecks,
  Clock,
  ArrowRight,
  Loader2
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
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface CommandPaletteSearchProps {
  onTabChange: (tab: string) => void;
  onShowRequestForm: () => void;
  onShowSettings: () => void;
  onShowQuickOnboarding: () => void;
  onShowBulkInvite: () => void;
  buyerId?: string;
  onSelectSupplier?: (supplierId: string, supplierName: string) => void;
  onSelectDocument?: (documentId: string) => void;
  onSelectOnboarding?: (requestId: string) => void;
}

interface SupplierResult {
  id: string;
  company_name: string;
  status: string;
}

interface DocumentResult {
  id: string;
  title: string;
  document_type: string;
  status: string;
  supplier_name?: string;
}

interface OnboardingResult {
  id: string;
  supplier_company_name: string | null;
  supplier_email: string;
  status: string;
}

interface RecentItem {
  type: 'supplier' | 'document' | 'navigation';
  id: string;
  title: string;
  timestamp: number;
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

const RECENT_ITEMS_KEY = 'command_palette_recent';
const MAX_RECENT_ITEMS = 5;

export function CommandPaletteSearch({
  onTabChange,
  onShowRequestForm,
  onShowSettings,
  onShowQuickOnboarding,
  onShowBulkInvite,
  buyerId,
  onSelectSupplier,
  onSelectDocument,
  onSelectOnboarding
}: CommandPaletteSearchProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  // Dynamic search results
  const [suppliers, setSuppliers] = useState<SupplierResult[]>([]);
  const [documents, setDocuments] = useState<DocumentResult[]>([]);
  const [onboardingRequests, setOnboardingRequests] = useState<OnboardingResult[]>([]);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  // Load recent items from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(RECENT_ITEMS_KEY);
    if (stored) {
      try {
        setRecentItems(JSON.parse(stored));
      } catch {
        setRecentItems([]);
      }
    }
  }, [open]);

  // Save recent item
  const addRecentItem = useCallback((item: Omit<RecentItem, 'timestamp'>) => {
    setRecentItems(prev => {
      const filtered = prev.filter(r => !(r.type === item.type && r.id === item.id));
      const newItems = [{ ...item, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT_ITEMS);
      localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(newItems));
      return newItems;
    });
  }, []);

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

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2 || !buyerId) {
      setSuppliers([]);
      setDocuments([]);
      setOnboardingRequests([]);
      return;
    }

    const searchTimer = setTimeout(async () => {
      setIsSearching(true);
      const query = searchQuery.toLowerCase();

      try {
        // Search suppliers
        const { data: connectionData } = await supabase
          .from('buyer_supplier_connections')
          .select(`
            id,
            status,
            supplier:suppliers(id, company_name)
          `)
          .eq('buyer_id', buyerId)
          .limit(5);

        if (connectionData) {
          const filteredSuppliers = connectionData
            .filter(c => c.supplier?.company_name?.toLowerCase().includes(query))
            .map(c => ({
              id: c.supplier?.id || '',
              company_name: c.supplier?.company_name || '',
              status: c.status
            }));
          setSuppliers(filteredSuppliers);
        }

        // Search documents
        const { data: documentData } = await supabase
          .from('document_requests')
          .select(`
            id,
            title,
            document_type,
            status,
            supplier:suppliers(company_name)
          `)
          .eq('buyer_id', buyerId)
          .ilike('title', `%${query}%`)
          .limit(5);

        if (documentData) {
          setDocuments(documentData.map(d => ({
            id: d.id,
            title: d.title,
            document_type: d.document_type,
            status: d.status || 'pending',
            supplier_name: d.supplier?.company_name
          })));
        }

        // Search onboarding requests
        const { data: onboardingData } = await supabase
          .from('supplier_onboarding_requests')
          .select('id, supplier_company_name, supplier_email, status')
          .eq('buyer_id', buyerId)
          .or(`supplier_company_name.ilike.%${query}%,supplier_email.ilike.%${query}%`)
          .limit(5);

        if (onboardingData) {
          setOnboardingRequests(onboardingData);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(searchTimer);
  }, [searchQuery, buyerId]);

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSuppliers([]);
      setDocuments([]);
      setOnboardingRequests([]);
    }
  }, [open]);

  const handleNavigation = (value: string, title: string) => {
    addRecentItem({ type: 'navigation', id: value, title });
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

  const handleSupplierSelect = (supplier: SupplierResult) => {
    addRecentItem({ type: 'supplier', id: supplier.id, title: supplier.company_name });
    if (onSelectSupplier) {
      onSelectSupplier(supplier.id, supplier.company_name);
    } else {
      onTabChange('suppliers');
    }
    setOpen(false);
  };

  const handleDocumentSelect = (doc: DocumentResult) => {
    addRecentItem({ type: 'document', id: doc.id, title: doc.title });
    if (onSelectDocument) {
      onSelectDocument(doc.id);
    } else {
      onTabChange('documents');
    }
    setOpen(false);
  };

  const handleOnboardingSelect = (request: OnboardingResult) => {
    if (onSelectOnboarding) {
      onSelectOnboarding(request.id);
    } else {
      onTabChange('onboarding');
    }
    setOpen(false);
  };

  const handleRecentSelect = (item: RecentItem) => {
    if (item.type === 'navigation') {
      onTabChange(item.id);
    } else if (item.type === 'supplier' && onSelectSupplier) {
      onSelectSupplier(item.id, item.title);
    } else if (item.type === 'document' && onSelectDocument) {
      onSelectDocument(item.id);
    }
    setOpen(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
      case 'completed':
        return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/60 dark:text-green-300 dark:border-green-700';
      case 'pending':
      case 'invited':
        return 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/60 dark:text-amber-300 dark:border-amber-700';
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/60 dark:text-red-300 dark:border-red-700';
      case 'in_review':
      case 'under_review':
        return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/60 dark:text-blue-300 dark:border-blue-700';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const hasSearchResults = suppliers.length > 0 || documents.length > 0 || onboardingRequests.length > 0;
  const isTyping = searchQuery.length >= 2;

  return (
    <>
      <Button
        variant="outline"
        className="relative h-9 w-full justify-start rounded-lg bg-muted/50 text-sm font-normal text-muted-foreground shadow-none sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Search everything...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Search suppliers, documents, actions..." 
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          {isSearching && (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </div>
          )}

          {!isSearching && isTyping && !hasSearchResults && (
            <CommandEmpty>
              No results found for "{searchQuery}"
            </CommandEmpty>
          )}

          {/* Dynamic Search Results - Suppliers */}
          {suppliers.length > 0 && (
            <>
              <CommandGroup heading="Suppliers">
                {suppliers.map((supplier) => (
                  <CommandItem
                    key={supplier.id}
                    value={`supplier-${supplier.id}-${supplier.company_name}`}
                    onSelect={() => handleSupplierSelect(supplier)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span>{supplier.company_name}</span>
                    </div>
                    <Badge variant="outline" className={`font-medium text-xs ${getStatusColor(supplier.status)}`}>
                      {supplier.status}
                    </Badge>
                  </CommandItem>
                ))}
                <CommandItem
                  value="view-all-suppliers"
                  onSelect={() => handleNavigation('suppliers', 'Suppliers')}
                  className="text-muted-foreground"
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  View all suppliers
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Dynamic Search Results - Documents */}
          {documents.length > 0 && (
            <>
              <CommandGroup heading="Documents">
                {documents.map((doc) => (
                  <CommandItem
                    key={doc.id}
                    value={`document-${doc.id}-${doc.title}`}
                    onSelect={() => handleDocumentSelect(doc)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <FileCheck className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-sm">{doc.title}</span>
                        {doc.supplier_name && (
                          <span className="text-xs text-muted-foreground">{doc.supplier_name}</span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className={`font-medium text-xs ${getStatusColor(doc.status)}`}>
                      {doc.status}
                    </Badge>
                  </CommandItem>
                ))}
                <CommandItem
                  value="view-all-documents"
                  onSelect={() => handleNavigation('documents', 'Documents')}
                  className="text-muted-foreground"
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  View all documents
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Dynamic Search Results - Onboarding */}
          {onboardingRequests.length > 0 && (
            <>
              <CommandGroup heading="Onboarding Pipeline">
                {onboardingRequests.map((request) => (
                  <CommandItem
                    key={request.id}
                    value={`onboarding-${request.id}-${request.supplier_email}`}
                    onSelect={() => handleOnboardingSelect(request)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-sm">{request.supplier_company_name || 'Unnamed Supplier'}</span>
                        <span className="text-xs text-muted-foreground">{request.supplier_email}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className={`font-medium text-xs ${getStatusColor(request.status)}`}>
                      {request.status}
                    </Badge>
                  </CommandItem>
                ))}
                <CommandItem
                  value="view-all-onboarding"
                  onSelect={() => handleNavigation('onboarding', 'Onboarding Pipeline')}
                  className="text-muted-foreground"
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  View onboarding pipeline
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Recent Items - Show when not typing */}
          {!isTyping && recentItems.length > 0 && (
            <>
              <CommandGroup heading="Recent">
                {recentItems.map((item) => (
                  <CommandItem
                    key={`${item.type}-${item.id}`}
                    value={`recent-${item.title}`}
                    onSelect={() => handleRecentSelect(item)}
                  >
                    <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{item.title}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {item.type}
                    </Badge>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}
          
          {/* Quick Actions - Always visible */}
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
          
          {/* Navigation - Always visible */}
          <CommandGroup heading="Navigation">
            {navigationItems.map((item) => (
              <CommandItem
                key={item.value}
                value={`${item.title} ${item.keywords.join(' ')}`}
                onSelect={() => handleNavigation(item.value, item.title)}
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
