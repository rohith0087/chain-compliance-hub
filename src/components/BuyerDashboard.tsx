import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyPermissions } from '@/hooks/useCompanyPermissions';
import { useTranslation } from 'react-i18next';
import RequestsList from '@/components/requests/RequestsList';
import SupplierDiscovery from '@/components/buyer/SupplierDiscovery';
import NewRequestModal from '@/components/NewRequestModal';
import BuyerComplianceDashboard from '@/components/dashboard/BuyerComplianceDashboard';
import { Building2, Users, ListChecks, Plus, BarChart3, FileCheck, UserCheck, Settings, Calendar, AlertTriangle, Clock, MessageSquare, Compass, FileText, Send, CheckCircle, TrendingUp, MapPin } from 'lucide-react';
import AgentManagementDashboard from '@/components/agents/AgentManagementDashboard';
import BuyerDocumentsDashboard from '@/components/documents/BuyerDocumentsDashboard';
import BuyerConnectionRequests from '@/components/buyer/BuyerConnectionRequests';
import { BuyerSettingsModal } from '@/components/settings/BuyerSettingsModal';
import { CompanyManagementDashboard } from '@/components/company/CompanyManagementDashboard';
import ChatAgentPanel from '@/components/chat/ChatAgentPanel';
import CustomTemplateManager from '@/components/buyer/CustomTemplateManager';
import { BulkInviteModal } from '@/components/buyer/BulkInviteModal';
import BuyerSidebarLayout from '@/components/buyer/BuyerSidebarLayout';
import { BuyerDocumentPrePopulator } from '@/components/buyer/BuyerDocumentPrePopulator';
import { SidebarProvider } from '@/components/ui/sidebar';
import SubscriptionPage from '@/pages/SubscriptionPage';
import { useBranchContext } from '@/contexts/BranchContext';
import ItemComplianceView from '@/components/buyer/ItemComplianceView';
import { AllSuppliersPerformanceDashboard } from '@/components/buyer/AllSuppliersPerformanceDashboard';
import { SupplierRiskManagement } from '@/components/buyer/SupplierRiskManagement';
import { DocumentAssignmentManager } from '@/components/buyer/DocumentAssignmentManager';
import { OnboardingPipelineView } from '@/components/buyer/OnboardingPipelineView';
import { MyAssignments } from '@/components/shared/MyAssignments';
import { TimelineItemSkeleton } from '@/components/ui/skeleton-card';
import { UrgencyBadge } from '@/components/ui/priority-badge';
import { DocumentSetManager } from '@/components/buyer/DocumentSetManager';
import { BuyerSupplierFacilityMatrix } from '@/components/buyer/BuyerSupplierFacilityMatrix';
import { SupplierMap } from '@/components/buyer/SupplierMap';
import { ComplianceRing } from '@/components/dashboard/ComplianceRing';
import { MetricChip } from '@/components/dashboard/MetricChip';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

import { supabase } from '@/integrations/supabase/client';

interface BuyerDashboardProps {
  user: {
    roles: ('buyer' | 'supplier')[];
    name: string;
    currentRole: 'buyer' | 'supplier';
  };
  onLogout: () => void;
  onRoleSwitch: (role: 'buyer' | 'supplier') => void;
}

const BuyerDashboard = ({ user, onLogout, onRoleSwitch }: BuyerDashboardProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('buyerDashboard_activeTab') || 'dashboard';
  });
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBulkInvite, setShowBulkInvite] = useState(false);
  const [buyerProfile, setBuyerProfile] = useState<any>(null);
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([]);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState({
    connectedSuppliers: 0,
    activeRequests: 0,
    pendingReview: 0,
    approvedDocs: 0,
    expiringSoon: 0,
    onboardingCount: 0,
    rejectedDocs: 0,
    totalDocs: 0,
  });
  const [activityTrend, setActivityTrend] = useState<{ day: string; requests: number; completed: number }[]>([]);
  const { user: authUser, profile } = useAuth();
  const { t } = useTranslation(['dashboard', 'common']);
  const { currentBranch, allBranchesView } = useBranchContext();
  
  // Get permissions to check if user is company owner
  const { isOwner, loading: permissionsLoading } = useCompanyPermissions(companyId, 'buyer');
  
  // Reset activeTab if non-owner tries to access owner-only tabs
  useEffect(() => {
    const ownerOnlyTabs = ['company', 'subscription'];
    if (!permissionsLoading && ownerOnlyTabs.includes(activeTab) && !isOwner) {
      setActiveTab('dashboard');
    }
  }, [activeTab, permissionsLoading, isOwner]);

  // Refresh buyer profile function  
  const refreshBuyerProfile = async () => {
    if (!authUser) return;
    
    try {
      // Check if user is a team member first
      const { data: teamMember } = await supabase
        .from('company_users')
        .select('company_id, company_type')
        .eq('profile_id', authUser.id)
        .eq('company_type', 'buyer')
        .eq('status', 'active')
        .single();

      if (teamMember) {
        // Team member - fetch company data using company_id
        console.log('Refreshing profile for team member, company_id:', teamMember.company_id);
        const { data: buyer, error: buyerError } = await supabase
          .from('buyers')
          .select('*')
          .eq('id', teamMember.company_id)
          .single();

        if (buyerError && buyerError.code !== 'PGRST116') {
          console.error('Error fetching buyer profile:', buyerError);
          return;
        }

        setBuyerProfile(buyer);
        setCompanyId(teamMember.company_id);
      } else {
        // Company owner - fetch using profile_id
        console.log('Refreshing profile for company owner');
        const { data: buyer, error: buyerError } = await supabase
          .from('buyers')
          .select('*')
          .eq('profile_id', authUser.id)
          .single();

        if (buyerError && buyerError.code !== 'PGRST116') {
          console.error('Error fetching buyer profile:', buyerError);
          return;
        }

        setBuyerProfile(buyer);
        setCompanyId(buyer?.id);
      }
    } catch (error) {
      console.error('Error refreshing buyer profile:', error);
    }
  };

  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem('buyerDashboard_activeTab', activeTab);
  }, [activeTab]);

  // Fetch buyer profile data and dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!authUser) return;

      try {
        setDashboardLoading(true);

        // Check if user is a team member first
        const { data: teamMember, error: teamError } = await supabase
          .from('company_users')
          .select('company_id, company_type, role, status')
          .eq('profile_id', authUser.id)
          .eq('company_type', 'buyer')
          .in('status', ['active', 'pending'])
          .single();

        if (teamError && teamError.code !== 'PGRST116') {
          console.error('Error checking team membership:', teamError);
        }

        if (teamMember) {
          // User is a team member - fetch company data using company_id
          console.log('User is team member, fetching company data with company_id:', teamMember.company_id);
          setCompanyId(teamMember.company_id);
          
          // Fetch buyer profile for team members using company_id
          const { data: buyer, error: buyerError } = await supabase
            .from('buyers')
            .select('*')
            .eq('id', teamMember.company_id)
            .single();

          if (buyerError && buyerError.code !== 'PGRST116') {
            console.error('Error fetching buyer profile for team member:', buyerError);
          }
          
          setBuyerProfile(buyer);
        } else {
          // User is a company owner - fetch buyer profile
          const { data: buyer, error: buyerError } = await supabase
            .from('buyers')
            .select('*')
            .eq('profile_id', authUser.id)
            .single();

          if (buyerError && buyerError.code !== 'PGRST116') {
            console.error('Error fetching buyer profile:', buyerError);
            return;
          }

          console.log('User is company owner, using buyer profile:', buyer?.id);
          setCompanyId(buyer?.id);
          setBuyerProfile(buyer);
        }

        const effectiveBuyerId = teamMember?.company_id || buyerProfile?.id;

        if (effectiveBuyerId) {
          // Branch filter helper
          const branchFilter = !allBranchesView && currentBranch?.id ? currentBranch.id : null;

          // Connected suppliers - different query based on branch selection
          let connectedSuppliersCount = 0;
          if (branchFilter) {
            const { count } = await supabase
              .from('branch_supplier_connections')
              .select('id', { count: 'exact', head: true })
              .eq('branch_id', branchFilter)
              .eq('status', 'active');
            connectedSuppliersCount = count || 0;
          } else {
            const { count } = await supabase
              .from('buyer_supplier_connections')
              .select('id', { count: 'exact', head: true })
              .eq('buyer_id', effectiveBuyerId)
              .eq('status', 'approved');
            connectedSuppliersCount = count || 0;
          }

          // Active requests (pending status) with branch filter
          let activeRequestsQuery = supabase
            .from('document_requests')
            .select('id', { count: 'exact', head: true })
            .eq('buyer_id', effectiveBuyerId)
            .eq('status', 'pending');
          if (branchFilter) activeRequestsQuery = activeRequestsQuery.eq('branch_id', branchFilter);
          const { count: activeRequestsCount } = await activeRequestsQuery;

          // Pending review (submitted status) with branch filter
          let pendingReviewQuery = supabase
            .from('document_requests')
            .select('id', { count: 'exact', head: true })
            .eq('buyer_id', effectiveBuyerId)
            .eq('status', 'submitted');
          if (branchFilter) pendingReviewQuery = pendingReviewQuery.eq('branch_id', branchFilter);
          const { count: pendingReviewCount } = await pendingReviewQuery;

          // Approved documents with branch filter
          let approvedDocsQuery = supabase
            .from('document_requests')
            .select('id', { count: 'exact', head: true })
            .eq('buyer_id', effectiveBuyerId)
            .eq('status', 'approved');
          if (branchFilter) approvedDocsQuery = approvedDocsQuery.eq('branch_id', branchFilter);
          const { count: approvedDocsCount } = await approvedDocsQuery;

          // Expiring soon (within 30 days) with branch filter
          let expiringQuery = supabase
            .from('document_uploads')
            .select('id, document_requests!inner(buyer_id, branch_id)', { count: 'exact', head: true })
            .eq('document_requests.buyer_id', effectiveBuyerId)
            .eq('status', 'approved')
            .not('expiration_date', 'is', null)
            .gte('expiration_date', new Date().toISOString().split('T')[0])
            .lte('expiration_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
          if (branchFilter) expiringQuery = expiringQuery.eq('document_requests.branch_id', branchFilter);
          const { count: expiringCount } = await expiringQuery;

          // Onboarding count (no branch filter - company-level)
          const { count: onboardingCount } = await supabase
            .from('supplier_onboarding_requests')
            .select('id', { count: 'exact', head: true })
            .eq('buyer_id', effectiveBuyerId)
            .in('status', ['pending', 'invited', 'onboarding_initiated']);

          // Upcoming deadlines with branch filter
          let deadlinesQuery = supabase
            .from('document_requests')
            .select(`id, title, due_date, status, priority, suppliers (company_name)`)
            .eq('buyer_id', effectiveBuyerId)
            .not('due_date', 'is', null)
            .gte('due_date', new Date().toISOString().split('T')[0])
            .lte('due_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .order('due_date', { ascending: true })
            .limit(5);
          if (branchFilter) deadlinesQuery = deadlinesQuery.eq('branch_id', branchFilter);
          const { data: deadlinesData, error: deadlinesError } = await deadlinesQuery;

          // Pending action items with branch filter
          let actionItemsQuery = supabase
            .from('document_requests')
            .select(`id, title, created_at, due_date, status, priority, suppliers (company_name)`)
            .eq('buyer_id', effectiveBuyerId)
            .in('status', ['pending', 'submitted'])
            .order('created_at', { ascending: false })
            .limit(5);
          if (branchFilter) actionItemsQuery = actionItemsQuery.eq('branch_id', branchFilter);
          const { data: actionItemsData, error: actionItemsError } = await actionItemsQuery;

          // Update dashboard stats
          const totalDocs = (approvedDocsCount || 0) + (pendingReviewCount || 0) + (activeRequestsCount || 0);
          setDashboardStats({
            connectedSuppliers: connectedSuppliersCount,
            activeRequests: activeRequestsCount || 0,
            pendingReview: pendingReviewCount || 0,
            approvedDocs: approvedDocsCount || 0,
            expiringSoon: expiringCount || 0,
            onboardingCount: onboardingCount || 0,
            rejectedDocs: 0,
            totalDocs: totalDocs,
          });

          // Fetch real activity trend for last 7 days
          const last7Days: { day: string; requests: number; completed: number }[] = [];
          const today = new Date();
          today.setHours(23, 59, 59, 999);

          for (let i = 6; i >= 0; i--) {
            const dayStart = new Date(today);
            dayStart.setDate(today.getDate() - i);
            dayStart.setHours(0, 0, 0, 0);
            
            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);

            // Count requests created on this day
            let requestsQuery = supabase
              .from('document_requests')
              .select('id', { count: 'exact', head: true })
              .eq('buyer_id', effectiveBuyerId)
              .gte('created_at', dayStart.toISOString())
              .lte('created_at', dayEnd.toISOString());
            if (branchFilter) requestsQuery = requestsQuery.eq('branch_id', branchFilter);
            const { count: requestsCount } = await requestsQuery;

            // Count completed (approved) requests updated on this day
            let completedQuery = supabase
              .from('document_requests')
              .select('id', { count: 'exact', head: true })
              .eq('buyer_id', effectiveBuyerId)
              .eq('status', 'approved')
              .gte('updated_at', dayStart.toISOString())
              .lte('updated_at', dayEnd.toISOString());
            if (branchFilter) completedQuery = completedQuery.eq('branch_id', branchFilter);
            const { count: completedCount } = await completedQuery;

            last7Days.push({
              day: dayStart.toLocaleDateString('en-US', { weekday: 'short' }),
              requests: requestsCount || 0,
              completed: completedCount || 0,
            });
          }
          setActivityTrend(last7Days);

          // Set deadlines
          if (!deadlinesError) {
            setUpcomingDeadlines(deadlinesData || []);
          }

          // Set action items
          if (!actionItemsError) {
            const actionItems = (actionItemsData || []).map(req => {
              const isOverdue = req.due_date && new Date(req.due_date) < new Date();
              return {
                ...req,
                actionType: isOverdue ? 'overdue' : 'pending',
                actionText: isOverdue ? 'Overdue - Follow up required' : 'Awaiting supplier response'
              };
            });
            setActionItems(actionItems);
          }
        }
      } catch (error) {
        console.error('Error in fetchDashboardData:', error);
      } finally {
        setDashboardLoading(false);
      }
    };

    fetchDashboardData();
  }, [authUser, currentBranch?.id, allBranchesView]);

  const handleFindSuppliersClick = () => {
    console.log('Find Suppliers button clicked, switching to suppliers tab');
    setActiveTab('suppliers');
  };

  const handleLogoutClick = async () => {
    try {
      console.log('Buyer dashboard logout clicked');
      await onLogout();
    } catch (error) {
      console.error('Error in buyer dashboard logout:', error);
    }
  };

  const handleCreateRequest = (request: any) => {
    console.log('Request created:', request);
    // Handle the created request - could add to local state, refresh data, etc.
  };

  return (
    <SidebarProvider>
      <BuyerSidebarLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        user={user}
        onLogout={handleLogoutClick}
        onRoleSwitch={onRoleSwitch}
        onShowRequestForm={() => setShowRequestForm(true)}
        onShowSettings={() => setShowSettings(true)}
        onShowQuickOnboarding={() => setActiveTab('onboarding')}
        onShowBulkInvite={() => setShowBulkInvite(true)}
        buyerProfile={buyerProfile}
        companyId={companyId}
      >
        {/* Dashboard Content */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
            {/* Hero Section: Welcome + Compliance Ring */}
            <div className="grid md:grid-cols-3 gap-6">
              {/* Left: Welcome + Inline Metrics */}
              <motion.div 
                className="md:col-span-2 space-y-4"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    {t('dashboard:buyer.welcome', { name: user.name })}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Here's your compliance overview at a glance
                  </p>
                </div>

                {/* Inline Metric Chips */}
                <div className="flex flex-wrap items-center gap-4 p-5 rounded-2xl bg-gradient-to-br from-card to-muted/20 border border-border/40 shadow-sm">
                  <MetricChip 
                    label="Suppliers" 
                    value={dashboardStats.connectedSuppliers} 
                    color="blue" 
                    onClick={() => setActiveTab('suppliers')}
                  />
                  <div className="w-px h-14 bg-border/40" />
                  <MetricChip 
                    label="Active" 
                    value={dashboardStats.activeRequests} 
                    color="amber" 
                    onClick={() => {
                      sessionStorage.setItem('buyer_docs_filter_status', 'pending');
                      setActiveTab('documents');
                    }}
                  />
                  <div className="w-px h-14 bg-border/40" />
                  <MetricChip 
                    label="Pending" 
                    value={dashboardStats.pendingReview} 
                    color="teal" 
                    pulse={dashboardStats.pendingReview > 0}
                    onClick={() => {
                      sessionStorage.setItem('buyer_docs_filter_status', 'submitted');
                      setActiveTab('documents');
                    }}
                  />
                  <div className="w-px h-14 bg-border/40" />
                  <MetricChip 
                    label="Expiring" 
                    value={dashboardStats.expiringSoon} 
                    color="red" 
                    pulse={dashboardStats.expiringSoon > 0}
                    onClick={() => {
                      sessionStorage.setItem('buyer_docs_filter_expiration', 'expiring_soon');
                      setActiveTab('documents');
                    }}
                  />
                </div>

              </motion.div>

              {/* Right: Compliance Ring */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Card className="border-0 bg-gradient-card h-full flex flex-col items-center justify-center p-6">
                  <ComplianceRing 
                    score={dashboardStats.totalDocs > 0 
                      ? Math.round((dashboardStats.approvedDocs / dashboardStats.totalDocs) * 100) 
                      : 0
                    } 
                  />
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    {dashboardStats.approvedDocs} of {dashboardStats.totalDocs} documents approved
                  </p>
                </Card>
              </motion.div>
            </div>

            {/* Charts Row */}
            <div className="grid md:grid-cols-3 gap-6">
              {/* Donut Chart - Document Status */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <Card className="border-0 bg-gradient-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-primary" />
                      Document Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Approved', value: dashboardStats.approvedDocs, color: '#22c55e' },
                            { name: 'Pending', value: dashboardStats.pendingReview, color: '#14b8a6' },
                            { name: 'Active', value: dashboardStats.activeRequests, color: '#f59e0b' },
                          ].filter(d => d.value > 0)}
                          dataKey="value"
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={2}
                          animationBegin={0}
                          animationDuration={1000}
                        >
                          {[
                            { name: 'Approved', value: dashboardStats.approvedDocs, color: '#22c55e' },
                            { name: 'Pending', value: dashboardStats.pendingReview, color: '#14b8a6' },
                            { name: 'Active', value: dashboardStats.activeRequests, color: '#f59e0b' },
                          ].filter(d => d.value > 0).map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-4 mt-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        <span className="text-xs text-muted-foreground">Approved</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                        <span className="text-xs text-muted-foreground">Pending</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="text-xs text-muted-foreground">Active</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Area Chart - Activity Trend */}
              <motion.div 
                className="md:col-span-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <Card className="border-0 bg-gradient-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      7-Day Activity Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={180}>
                      <AreaChart data={activityTrend}>
                        <defs>
                          <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="requests" 
                          stroke="#3b82f6" 
                          fill="url(#colorRequests)"
                          strokeWidth={2}
                          animationDuration={1500}
                          name="Requests"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="completed" 
                          stroke="#22c55e" 
                          fill="url(#colorCompleted)"
                          strokeWidth={2}
                          animationDuration={1500}
                          name="Completed"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center gap-4 mt-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <span className="text-xs text-muted-foreground">Requests</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                        <span className="text-xs text-muted-foreground">Completed</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* Deadline Timeline - Horizontal Bar */}
            {upcomingDeadlines.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <Card className="border-0 bg-gradient-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      Upcoming Deadlines
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={Math.max(120, upcomingDeadlines.length * 35)}>
                      <BarChart 
                        data={upcomingDeadlines.map(d => ({
                          title: d.title?.substring(0, 20) + (d.title?.length > 20 ? '...' : ''),
                          daysLeft: Math.max(0, Math.ceil((new Date(d.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))),
                          supplier: d.suppliers?.company_name
                        }))}
                        layout="vertical"
                        margin={{ left: 10, right: 30 }}
                      >
                        <XAxis type="number" domain={[0, 30]} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis dataKey="title" type="category" width={150} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px'
                          }}
                          formatter={(value: number) => [`${value} days left`, 'Due in']}
                        />
                        <Bar dataKey="daysLeft" radius={[0, 4, 4, 0]} animationDuration={1000}>
                          {upcomingDeadlines.map((entry, i) => {
                            const daysLeft = Math.ceil((new Date(entry.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                            return (
                              <Cell 
                                key={i} 
                                fill={daysLeft < 7 ? '#ef4444' : daysLeft < 14 ? '#f59e0b' : '#22c55e'} 
                              />
                            );
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Action Items */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <Card className="border-0 bg-gradient-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Action Items
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardLoading ? (
                    <div className="space-y-3">
                      <TimelineItemSkeleton />
                      <TimelineItemSkeleton />
                    </div>
                  ) : actionItems.length > 0 ? (
                    <div className="space-y-2">
                      {actionItems.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className={`w-2 h-2 rounded-full ${
                            item.actionType === 'overdue' ? 'bg-red-500 animate-pulse' : 'bg-amber-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.title}</p>
                            <p className="text-xs text-muted-foreground">{item.suppliers?.company_name}</p>
                          </div>
                          <span className={`text-xs ${item.actionType === 'overdue' ? 'text-red-500' : 'text-amber-500'}`}>
                            {item.actionType === 'overdue' ? 'Overdue' : 'Pending'}
                          </span>
                        </div>
                      ))}
                      {actionItems.length > 3 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full mt-2"
                          onClick={() => setActiveTab('requests')}
                        >
                          View {actionItems.length - 3} more
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">All caught up!</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Compliance Content */}
        {activeTab === 'compliance' && (
          <BuyerComplianceDashboard />
        )}

        {/* Agents Content */}
        {activeTab === 'agents' && (
          <AgentManagementDashboard />
        )}

        {/* Requests Content */}
        {activeTab === 'requests' && (
          <RequestsList onNewRequest={() => setShowRequestForm(true)} />
        )}

        {/* Documents Content */}
        {activeTab === 'documents' && (
          <BuyerDocumentsDashboard />
        )}

        {/* Performance Dashboard */}
        {activeTab === 'performance' && (
          <AllSuppliersPerformanceDashboard />
        )}

        {/* Risk Management */}
        {activeTab === 'risk' && (
          <SupplierRiskManagement />
        )}

        {/* Document Assignments */}
        {activeTab === 'assignments' && (
          <DocumentAssignmentManager />
        )}

        {/* Item Compliance Content */}
        {activeTab === 'item-compliance' && companyId && (
          <ItemComplianceView buyerId={companyId} />
        )}

        {/* Facility Matrix Content */}
        {activeTab === 'facility-matrix' && (
          <BuyerSupplierFacilityMatrix />
        )}

        {/* Onboarding Content - Use Pipeline View */}
        {activeTab === 'onboarding' && (
          <OnboardingPipelineView />
        )}

        {/* Templates Content */}
        {activeTab === 'templates' && (
          <CustomTemplateManager />
        )}

        {/* Document Sets Content */}
        {activeTab === 'document-sets' && companyId && (
          <DocumentSetManager buyerId={companyId} />
        )}

        {/* Suppliers Content */}
        {activeTab === 'suppliers' && (
          <div className="space-y-6">
            <SupplierDiscovery />
          </div>
        )}

        {/* Supplier Map */}
        {activeTab === 'supplier-map' && (
          <SupplierMap />
        )}

        {/* Supplier Requests Content */}
        {activeTab === 'supplier-requests' && (
          <BuyerConnectionRequests />
        )}

        {/* Pre-populate Documents Content */}
        {activeTab === 'pre-populate' && buyerProfile && (
          <BuyerDocumentPrePopulator
            buyerId={buyerProfile.id}
            branchId={currentBranch?.id}
            onComplete={() => {
              // Optionally refresh data or show success message
            }}
          />
        )}

        {/* Company Content */}
        {activeTab === 'company' && companyId && (
          <CompanyManagementDashboard 
            companyId={companyId}
            companyType="buyer"
            companyName={buyerProfile?.company_name || 'Company'}
          />
        )}

        {/* Subscription & Billing */}
        {activeTab === 'subscription' && (
          <SubscriptionPage />
        )}

        {/* Modals */}
      <NewRequestModal
        isOpen={showRequestForm}
        onClose={() => setShowRequestForm(false)}
        onCreateRequest={handleCreateRequest}
        userType="buyer"
        currentBranch={currentBranch}
      />

      <BuyerSettingsModal
        open={showSettings}
        onOpenChange={setShowSettings}
        onSettingsUpdated={refreshBuyerProfile}
      />

      {companyId && profile && (
          <BulkInviteModal
            isOpen={showBulkInvite}
            onClose={() => setShowBulkInvite(false)}
            buyerId={companyId}
            buyerProfile={buyerProfile || { id: companyId, company_name: 'Your Company', contact_email: profile.email }}
          />
      )}
    </BuyerSidebarLayout>
  </SidebarProvider>
  );
};

export default BuyerDashboard;