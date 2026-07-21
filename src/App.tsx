
import React, { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { ImpersonationBanner } from "@/components/super-admin/ImpersonationBanner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MFAGuard } from "@/components/auth/MFAGuard";
import { TourProvider } from "@/components/support/TourProvider";


import AuthPage from "./components/auth/AuthPage";
import ResetPassword from "./pages/ResetPassword";
import DynamicDashboard from "./components/dashboard/DynamicDashboard";
import ChatPage from "./pages/ChatPage";
import AuditAssistantPage from "./pages/AuditAssistantPage";
import AdminDashboard from "./pages/AdminDashboard";
import AgentManagementDashboard from "./components/agents/AgentManagementDashboard";
import PlatformAdminLogin from "./pages/PlatformAdminLogin";
import PlatformAdminDashboard from "./pages/PlatformAdminDashboard";

import SharedDocumentViewer from "./components/shared/SharedDocumentViewer";
import NotFound from "./pages/NotFound";
import HelpCenterPage from "./pages/HelpCenterPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import SupplierSimulation from "./pages/SupplierSimulation";
import ProfileSettingsPage from "./pages/ProfileSettingsPage";
import MessagesPage from "./pages/MessagesPage";
import WhitePaperPage from "./pages/WhitePaperPage";
import "./i18n";
import { BranchProvider } from "@/contexts/BranchContext";
import RequirementEngineView from "@/components/buyer/RequirementEngineView";
import { useRequirementEngineFeature } from "@/hooks/useRequirementEngineFeature";
import ComplianceDecisionsView from "@/components/buyer/ComplianceDecisionsView";
import { useComplianceDecisionsFeature } from "@/hooks/useComplianceDecisionsFeature";
import EvidenceSharingView from "@/components/supplier/EvidenceSharingView";
import { useEvidenceSharingFeature } from "@/hooks/useEvidenceSharingFeature";
import DossierGeneratorView from "@/components/buyer/DossierGeneratorView";
import { useDossiersFeature } from "@/hooks/useDossiersFeature";
import BuyerDocumentsManager from "@/components/documents/BuyerDocumentsManager";
import CustomTemplateManager from "@/components/buyer/CustomTemplateManager";
import SampleTemplateManager from "@/components/buyer/SampleTemplateManager";
import { DocumentSetManager } from "@/components/buyer/DocumentSetManager";
import BuyerComplianceDashboard from "@/components/dashboard/BuyerComplianceDashboard";
import SupplierDiscovery from "@/components/buyer/SupplierDiscovery";
import { FloatingComplianceAssistant } from "@/components/chat/FloatingComplianceAssistant";

const REQUIREMENT_TEST_BUYER_ID = '00000000-0000-4000-8000-000000000001';
const EVIDENCE_SHARING_TEST_SUPPLIER_ID = '00000000-0000-4000-8000-000000000020';

const RequirementEngineTestRoute = () => {
  const { enabled, loading } = useRequirementEngineFeature(REQUIREMENT_TEST_BUYER_ID);
  if (loading) return <div>Loading requirement feature…</div>;
  if (!enabled) return <div>Requirement engine disabled</div>;
  return <RequirementEngineView buyerId={REQUIREMENT_TEST_BUYER_ID} onNavigateToDocuments={() => undefined} />;
};

const ComplianceDecisionsTestRoute = () => {
  const { enabled, loading } = useComplianceDecisionsFeature(REQUIREMENT_TEST_BUYER_ID);
  if (loading) return <div>Loading compliance decisions feature…</div>;
  if (!enabled) return <div>Compliance decisions disabled</div>;
  return <ComplianceDecisionsView buyerId={REQUIREMENT_TEST_BUYER_ID} />;
};

const EvidenceSharingTestRoute = () => {
  const { enabled, loading } = useEvidenceSharingFeature(EVIDENCE_SHARING_TEST_SUPPLIER_ID);
  if (loading) return <div>Loading evidence sharing feature…</div>;
  if (!enabled) return <div>Evidence sharing disabled</div>;
  return <EvidenceSharingView supplierId={EVIDENCE_SHARING_TEST_SUPPLIER_ID} />;
};

const DossiersTestRoute = () => {
  const { enabled, loading } = useDossiersFeature(REQUIREMENT_TEST_BUYER_ID);
  if (loading) return <div>Loading dossiers feature…</div>;
  if (!enabled) return <div>Dossiers disabled</div>;
  return <DossierGeneratorView buyerId={REQUIREMENT_TEST_BUYER_ID} />;
};

// CustomTemplateManager and BuyerComplianceDashboard self-resolve their
// buyer id from the authenticated session (useAuth) rather than accepting
// it as a prop, so these test routes render the components directly against
// whatever buyer session is active in the browser.
const CustomTemplatesTestRoute = () => <CustomTemplateManager />;

const SampleTemplatesTestRoute = () => <SampleTemplateManager buyerId={REQUIREMENT_TEST_BUYER_ID} />;

const DocumentSetsTestRoute = () => <DocumentSetManager buyerId={REQUIREMENT_TEST_BUYER_ID} />;

const ComplianceOverviewTestRoute = () => <BuyerComplianceDashboard />;

// SupplierDiscovery also self-resolves its buyer id from useAuth -- same
// session-dependent limitation as the two routes above.
const SupplierDiscoveryTestRoute = () => <SupplierDiscovery />;

const MOCK_BUYER_DOCUMENTS = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    title: 'HACCP Certification',
    document_type: 'certificate',
    category: 'safety',
    status: 'submitted',
    created_at: '2026-06-16T10:24:00Z',
    supplier_id: 'aaaaaaaa-0000-4000-8000-000000000001',
    suppliers: { company_name: 'Test Supplier' },
    document_uploads: [{
      id: 'u1', file_name: 'haccp-cert.pdf', file_path: 'mock/haccp-cert.pdf', file_size: 136000,
      status: 'submitted', created_at: '2026-06-16T10:24:00Z', expiration_date: '2026-09-01',
      uploader: { full_name: 'Amit Buyer' },
    }],
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    title: 'ISO 14001 Environmental Certificate',
    document_type: 'certificate',
    category: 'compliance',
    status: 'submitted',
    created_at: '2026-06-17T09:12:00Z',
    supplier_id: 'aaaaaaaa-0000-4000-8000-000000000002',
    suppliers: { company_name: 'GreenFuture Ltd.' },
    document_uploads: [{
      id: 'u2', file_name: 'iso14001.pdf', file_path: 'mock/iso14001.pdf', file_size: 220000,
      status: 'submitted', created_at: '2026-06-17T09:12:00Z', expiration_date: '2026-07-10',
      uploader: { full_name: 'Amit Buyer' },
    }],
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    title: 'HACCP Certification',
    document_type: 'certificate',
    category: 'quality',
    status: 'approved',
    created_at: '2026-06-18T08:45:00Z',
    supplier_id: 'aaaaaaaa-0000-4000-8000-000000000001',
    suppliers: { company_name: 'Test Supplier' },
    document_uploads: [
      {
        id: 'u3', file_name: 'haccp-cert-v2.pdf', file_path: 'mock/haccp-cert-v2.pdf', file_size: 82000,
        status: 'approved', created_at: '2026-06-18T08:45:00Z', expiration_date: '2027-06-18',
        uploader: { full_name: 'Amit Buyer' }, version: 2,
      },
      {
        id: 'u3-v1', file_name: 'haccp-cert-v1.pdf', file_path: 'mock/haccp-cert-v1.pdf', file_size: 80000,
        status: 'approved', created_at: '2025-06-18T08:45:00Z', expiration_date: '2026-06-18',
        uploader: { full_name: 'Amit Buyer' }, version: 1,
      },
    ],
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    title: 'Supplier Questionnaire',
    document_type: 'report',
    category: 'compliance',
    status: 'rejected',
    notes: 'Missing signature on page 3.',
    created_at: '2026-06-15T14:15:00Z',
    supplier_id: 'aaaaaaaa-0000-4000-8000-000000000003',
    suppliers: { company_name: 'SupplyCo Inc.' },
    document_uploads: [{
      id: 'u4', file_name: 'questionnaire.pdf', file_path: 'mock/questionnaire.pdf', file_size: 178000,
      status: 'rejected', created_at: '2026-06-15T14:15:00Z',
      uploader: { full_name: 'Amit Buyer' },
    }],
  },
  {
    id: '10000000-0000-4000-8000-000000000005',
    title: 'Code of Conduct',
    document_type: 'policy',
    category: 'compliance',
    status: 'approved',
    created_at: '2026-06-12T11:03:00Z',
    supplier_id: 'aaaaaaaa-0000-4000-8000-000000000002',
    suppliers: { company_name: 'GreenFuture Ltd.' },
    document_uploads: [{
      id: 'u5', file_name: 'code-of-conduct.pdf', file_path: 'mock/code-of-conduct.pdf', file_size: 110000,
      status: 'approved', created_at: '2026-06-12T11:03:00Z',
      uploader: { full_name: 'Amit Buyer' },
    }],
  },
  {
    id: '10000000-0000-4000-8000-000000000006',
    title: 'Business License',
    document_type: 'license',
    category: 'financial',
    status: 'pending',
    created_at: '2026-06-10T09:00:00Z',
    supplier_id: 'aaaaaaaa-0000-4000-8000-000000000003',
    suppliers: { company_name: 'SupplyCo Inc.' },
    document_uploads: [],
  },
];

const BuyerDocumentsManagerTestRoute = () => (
  <div className="p-6">
    <BuyerDocumentsManager
      documents={MOCK_BUYER_DOCUMENTS}
      onApprove={async () => undefined}
      onDecline={() => undefined}
      onWithdraw={() => undefined}
      onRefresh={async () => undefined}
    />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent refetch on tab switch
      staleTime: 5 * 60 * 1000,    // Data fresh for 5 minutes
      retry: 1,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/auth" replace state={{ returnTo }} />;
  }
  
  // Wrap with MFA guard to enforce mandatory 2FA
  return (
    <MFAGuard>
      {children}
      <FloatingComplianceAssistant />
    </MFAGuard>
  );
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [mfaCheckComplete, setMfaCheckComplete] = useState(false);
  const [canRedirect, setCanRedirect] = useState(false);

  useEffect(() => {
    const checkMFAStatus = async () => {
      if (!user) {
        setMfaCheckComplete(true);
        setCanRedirect(false);
        return;
      }

      try {
        // Check if user has MFA enrolled
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        const hasVerifiedTOTP = factorsData?.totp?.some(f => f.status === 'verified');

        if (!hasVerifiedTOTP) {
          // No MFA enrolled - safe to redirect
          setCanRedirect(true);
        } else {
          // MFA enrolled - check AAL level
          const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          const isMFAVerified = aalData?.currentLevel === 'aal2';
          
          // Only redirect if MFA is verified
          setCanRedirect(isMFAVerified);
        }
      } catch (error) {
        console.error('Error checking MFA status in PublicRoute:', error);
        // On error, let the user stay on auth page
        setCanRedirect(false);
      }
      setMfaCheckComplete(true);
    };

    checkMFAStatus();
  }, [user]);

  if (loading || (user && !mfaCheckComplete)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Only redirect if MFA check passed
  if (user && canRedirect) {
    const candidate = (location.state as { returnTo?: unknown } | null)?.returnTo;
    const returnTo = typeof candidate === 'string' && candidate.startsWith('/') && !candidate.startsWith('//')
      ? candidate : '/dashboard';
    return <Navigate to={returnTo} replace />;
  }

  return <>{children}</>;
};

// Old standalone supplier-risk pages → the dashboard's Supplier Risk tab.
const SupplierRiskTabRedirect = () => {
  localStorage.setItem('buyerDashboard_activeTab', 'supplier-risk');
  return <Navigate to="/dashboard" replace />;
};

const SupplierRequestRoute = () => {
  const { requestId } = useParams<{ requestId: string }>();
  if (!requestId) return <Navigate to="/dashboard?tab=documents" replace />;
  return <Navigate to={`/dashboard?tab=documents&highlightDoc=${encodeURIComponent(requestId)}&action=upload`} replace />;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { hasRole, loading: rolesLoading } = useUserRoles();
  
  if (authLoading || rolesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  if (!hasRole('admin')) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

// Guards the platform-admin portal. Authoritative source of truth is the
// platform_administrators table (any active platform role), matching
// usePlatformAdmin + the SECURITY DEFINER RPCs. Unauthenticated users go to the
// dedicated admin login; authenticated non-admins are sent to the app dashboard.
const PlatformAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    const checkPlatformAdmin = async () => {
      if (!user) {
        setIsPlatformAdmin(false);
        setCheckingAdmin(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('platform_administrators')
          .select('platform_roles, is_active')
          .eq('auth_user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        setIsPlatformAdmin(!error && !!data && (data.platform_roles ?? []).length > 0);
      } catch (error) {
        setIsPlatformAdmin(false);
      }
      setCheckingAdmin(false);
    };

    checkPlatformAdmin();
  }, [user]);

  if (authLoading || checkingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/platform-admin/login" replace />;
  }

  if (!isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <ImpersonationProvider>
            <BranchProvider>
              <TourProvider>
                <ImpersonationBanner />
                <Routes>
                  <Route path="/" element={
                    <PublicRoute>
                      <AuthPage />
                    </PublicRoute>
                  } />
                  <Route path="/auth" element={<Navigate to="/" replace />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  {import.meta.env.MODE === 'test' && (
                    <>
                      <Route path="/__test/requirements" element={<RequirementEngineTestRoute />} />
                      <Route path="/__test/compliance-decisions" element={<ComplianceDecisionsTestRoute />} />
                      <Route path="/__test/evidence-sharing" element={<EvidenceSharingTestRoute />} />
                      <Route path="/__test/dossiers" element={<DossiersTestRoute />} />
                      <Route path="/__test/buyer-documents" element={<BuyerDocumentsManagerTestRoute />} />
                      <Route path="/__test/custom-templates" element={<CustomTemplatesTestRoute />} />
                      <Route path="/__test/sample-templates" element={<SampleTemplatesTestRoute />} />
                      <Route path="/__test/document-sets" element={<DocumentSetsTestRoute />} />
                      <Route path="/__test/compliance-overview" element={<ComplianceOverviewTestRoute />} />
                      <Route path="/__test/supplier-discovery" element={<SupplierDiscoveryTestRoute />} />
                    </>
                  )}
                  <Route path="/dashboard" element={
                    <ProtectedRoute>
                      <DynamicDashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/supplier/requests/:requestId" element={
                    <ProtectedRoute>
                      <SupplierRequestRoute />
                    </ProtectedRoute>
                  } />
                  {/* Supplier risk now lives inside the dashboard (Compliance →
                      Supplier Risk) on the templated page; old standalone routes
                      redirect there. Policy editing is embedded on that page. */}
                  <Route path="/supplier-risk" element={<SupplierRiskTabRedirect />} />
                  <Route path="/supplier-risk/policy" element={<SupplierRiskTabRedirect />} />
                  <Route path="/chat" element={
                    <ProtectedRoute>
                      <ChatPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/audit-assistant" element={
                    <ProtectedRoute>
                      <AuditAssistantPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/agents" element={
                    <ProtectedRoute>
                      <AgentManagementDashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/subscription" element={
                    <ProtectedRoute>
                      <SubscriptionPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/messages" element={
                    <ProtectedRoute>
                      <MessagesPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/profile-settings" element={
                    <ProtectedRoute>
                      <ProfileSettingsPage />
                    </ProtectedRoute>
                  } />
                  <Route path="/admin" element={
                    <AdminRoute>
                      <AdminDashboard />
                    </AdminRoute>
                  } />
                  {/* Legacy /super-admin retired — the platform-admin portal is now the sole super-admin surface. */}
                  <Route path="/super-admin" element={<Navigate to="/platform-admin/login" replace />} />
                  <Route path="/platform-admin/login" element={<PlatformAdminLogin />} />
                  <Route path="/platform-admin/dashboard" element={
                    <PlatformAdminRoute>
                      <PlatformAdminDashboard />
                    </PlatformAdminRoute>
                  } />
                  
                  <Route path="/shared-document/:token" element={<SharedDocumentViewer />} />
                  <Route path="/supplier-simulation" element={<SupplierSimulation />} />
                  <Route path="/white-paper" element={<WhitePaperPage />} />
                  <Route path="/help" element={<HelpCenterPage />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </TourProvider>
            </BranchProvider>
          </ImpersonationProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
};

const App = () => {
  // Dark is the default surface (the brand's "ledger" palette); the toggle
  // still switches to light and the choice persists under storageKey.
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="tracer2c-theme" disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppRoutes />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default App;
