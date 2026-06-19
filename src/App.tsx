
import React, { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import { ImpersonationBanner } from "@/components/super-admin/ImpersonationBanner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MFAGuard } from "@/components/auth/MFAGuard";
import { TourProvider } from "@/components/support/TourProvider";

import Index from "./pages/Index";
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
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SupplierSimulation from "./pages/SupplierSimulation";
import ProfileSettingsPage from "./pages/ProfileSettingsPage";
import MessagesPage from "./pages/MessagesPage";
import WhitePaperPage from "./pages/WhitePaperPage";
import "./i18n";
import { BranchProvider } from "@/contexts/BranchContext";
import RequirementEngineView from "@/components/buyer/RequirementEngineView";
import { useRequirementEngineFeature } from "@/hooks/useRequirementEngineFeature";
import EvidenceVerificationView from "@/components/buyer/EvidenceVerificationView";
import { useEvidenceVerificationFeature } from "@/hooks/useEvidenceVerificationFeature";
import ComplianceDecisionsView from "@/components/buyer/ComplianceDecisionsView";
import { useComplianceDecisionsFeature } from "@/hooks/useComplianceDecisionsFeature";

const REQUIREMENT_TEST_BUYER_ID = '00000000-0000-4000-8000-000000000001';

const RequirementEngineTestRoute = () => {
  const { enabled, loading } = useRequirementEngineFeature(REQUIREMENT_TEST_BUYER_ID);
  if (loading) return <div>Loading requirement feature…</div>;
  if (!enabled) return <div>Requirement engine disabled</div>;
  return <RequirementEngineView buyerId={REQUIREMENT_TEST_BUYER_ID} onNavigateToDocuments={() => undefined} />;
};

const EvidenceVerificationTestRoute = () => {
  const { enabled, loading } = useEvidenceVerificationFeature(REQUIREMENT_TEST_BUYER_ID);
  if (loading) return <div>Loading evidence verification feature…</div>;
  if (!enabled) return <div>Evidence verification disabled</div>;
  return <EvidenceVerificationView buyerId={REQUIREMENT_TEST_BUYER_ID} />;
};

const ComplianceDecisionsTestRoute = () => {
  const { enabled, loading } = useComplianceDecisionsFeature(REQUIREMENT_TEST_BUYER_ID);
  if (loading) return <div>Loading compliance decisions feature…</div>;
  if (!enabled) return <div>Compliance decisions disabled</div>;
  return <ComplianceDecisionsView buyerId={REQUIREMENT_TEST_BUYER_ID} />;
};

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
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  // Wrap with MFA guard to enforce mandatory 2FA
  return <MFAGuard>{children}</MFAGuard>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
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
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
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

const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    const checkSuperAdmin = async () => {
      if (!user) {
        setIsSuperAdmin(false);
        setCheckingAdmin(false);
        return;
      }

      try {
        // Check platform_administrators table for super_admin role
        const { data, error } = await supabase
          .from('platform_administrators')
          .select('platform_roles, is_active')
          .eq('auth_user_id', user.id)
          .eq('is_active', true)
          .single();

        if (error || !data) {
          setIsSuperAdmin(false);
        } else {
          setIsSuperAdmin(data.platform_roles?.includes('super_admin') ?? false);
        }
      } catch (error) {
        setIsSuperAdmin(false);
      }
      setCheckingAdmin(false);
    };

    checkSuperAdmin();
  }, [user]);

  if (authLoading || checkingAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isSuperAdmin) {
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
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={
                    <PublicRoute>
                      <AuthPage />
                    </PublicRoute>
                  } />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  {import.meta.env.MODE === 'test' && (
                    <>
                      <Route path="/__test/requirements" element={<RequirementEngineTestRoute />} />
                      <Route path="/__test/evidence" element={<EvidenceVerificationTestRoute />} />
                      <Route path="/__test/compliance-decisions" element={<ComplianceDecisionsTestRoute />} />
                    </>
                  )}
                  <Route path="/dashboard" element={
                    <ProtectedRoute>
                      <DynamicDashboard />
                    </ProtectedRoute>
                  } />
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
                  <Route path="/super-admin" element={
                    <SuperAdminRoute>
                      <SuperAdminDashboard />
                    </SuperAdminRoute>
                  } />
                  <Route path="/platform-admin/login" element={<PlatformAdminLogin />} />
                  <Route path="/platform-admin/dashboard" element={<PlatformAdminDashboard />} />
                  
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
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppRoutes />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
