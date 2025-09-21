
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import AuthPage from "./components/auth/AuthPage";
import ResetPassword from "./pages/ResetPassword";
import InvitePage from "./pages/InvitePage";
import DynamicDashboard from "./components/dashboard/DynamicDashboard";
import ChatPage from "./pages/ChatPage";
import AdminDashboard from "./pages/AdminDashboard";
import PlatformAdminLogin from "./pages/PlatformAdminLogin";
import PlatformAdminDashboard from "./pages/PlatformAdminDashboard";
import PlatformAdminInvitationAccept from "./pages/PlatformAdminInvitationAccept";
import PlatformAdminBootstrap from "./pages/PlatformAdminBootstrap";
import SharedDocumentViewer from "./components/shared/SharedDocumentViewer";
import NotFound from "./pages/NotFound";
import "./i18n";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  if (!profile?.roles?.includes('admin')) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

const SuperAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, profile, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  if (!profile?.roles?.includes('super_admin')) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <Routes>
            <Route path="/" element={
              <PublicRoute>
                <Index />
              </PublicRoute>
            } />
            <Route path="/auth" element={
              <PublicRoute>
                <AuthPage />
              </PublicRoute>
            } />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/invite/:token" element={<InvitePage />} />
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
            <Route path="/admin" element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            } />
            <Route path="/platform-admin/login" element={<PlatformAdminLogin />} />
            <Route path="/platform-admin/dashboard" element={<PlatformAdminDashboard />} />
            <Route path="/platform-admin/accept-invitation" element={<PlatformAdminInvitationAccept />} />
            <Route path="/platform-admin/bootstrap" element={<PlatformAdminBootstrap />} />
            <Route path="/shared-document/:token" element={<SharedDocumentViewer />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
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
