import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  FileCheck, 
  Building2,
  TrendingUp,
  FileText,
  Play,
  X,
  RotateCcw,
  ArrowRight,
  Users,
  Home,
  ListChecks,
  BarChart3,
  Bell
} from 'lucide-react';
import { ComplianceRing } from '@/components/dashboard/ComplianceRing';
import { MetricChip } from '@/components/dashboard/MetricChip';
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useSimulation, SimulationTab } from '@/contexts/SimulationContext';
import { SimulationBanner } from './SimulationBanner';
import { SimulationProgress } from './SimulationProgress';
import { SimulationOverviewPage } from './pages/SimulationOverviewPage';
import { SimulationRequestsPage } from './pages/SimulationRequestsPage';
import { SimulationDocumentsPage } from './pages/SimulationDocumentsPage';
import { SimulationLibraryPage } from './pages/SimulationLibraryPage';
import { SimulationConnectionsPage } from './pages/SimulationConnectionsPage';
import { SimulationCompliancePage } from './pages/SimulationCompliancePage';
import { Shield } from 'lucide-react';

interface NavigationItem {
  title: string;
  icon: React.ElementType;
  value: SimulationTab;
  badge?: number;
}

export const SupplierSimulationDashboard = () => {
  const navigate = useNavigate();
  const { 
    currentTab, 
    setActiveTab, 
    exitSimulation, 
    resetSimulation,
    getSupplierProfile,
    getComplianceStats,
    documentRequests,
    connectedBuyers,
    pendingConnectionRequest,
  } = useSimulation();
  
  const supplierProfile = getSupplierProfile();
  const stats = getComplianceStats();
  
  const pendingRequests = documentRequests.filter(r => r.status === 'pending').length;
  const pendingConnections = pendingConnectionRequest ? 1 : 0;

  const navigationItems: NavigationItem[] = [
    { title: 'Overview', icon: Home, value: 'overview' },
    { title: 'Requests', icon: ListChecks, value: 'requests', badge: pendingRequests > 0 ? pendingRequests : undefined },
    { title: 'Documents', icon: FileCheck, value: 'documents' },
    { title: 'Document Library', icon: FileText, value: 'library' },
    { title: 'Buyer Connections', icon: Users, value: 'connections', badge: pendingConnections > 0 ? pendingConnections : undefined },
    { title: 'Compliance', icon: BarChart3, value: 'compliance' },
  ];

  const handleExitSimulation = () => {
    exitSimulation();
    navigate('/dashboard');
  };

  const renderTabContent = () => {
    switch (currentTab) {
      case 'overview':
        return <SimulationOverviewPage onTabChange={setActiveTab} />;
      case 'requests':
        return <SimulationRequestsPage />;
      case 'documents':
        return <SimulationDocumentsPage />;
      case 'library':
        return <SimulationLibraryPage />;
      case 'connections':
        return <SimulationConnectionsPage />;
      case 'compliance':
        return <SimulationCompliancePage />;
      default:
        return <SimulationOverviewPage onTabChange={setActiveTab} />;
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        {/* Sidebar - Matches real SupplierSidebarLayout */}
        <Sidebar className="border-r bg-white/80 backdrop-blur-sm">
          <SidebarHeader className="border-b border-gray-200/50 px-3 py-4 bg-white/50">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 overflow-hidden">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">
                  {supplierProfile.company_name}
                </span>
                <span className="text-xs text-muted-foreground">
                  Demo User
                </span>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            {/* Simulation Controls */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-amber-700">Simulation Mode</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      onClick={resetSimulation}
                      className="text-amber-600 hover:text-amber-600 hover:bg-amber-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>Restart Simulation</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      onClick={handleExitSimulation}
                      className="text-red-600 hover:text-red-600 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                      <span>Exit Simulation</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Main Navigation */}
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.value}>
                      <SidebarMenuButton
                        isActive={currentTab === item.value}
                        onClick={() => setActiveTab(item.value)}
                        className="group"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="ml-auto">
                            {item.badge}
                          </Badge>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-gray-200/50 p-3 bg-white/50">
            <div className="flex items-center gap-3">
              <Avatar className="h-6 w-6">
                <AvatarFallback>D</AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start flex-1">
                <span className="text-sm font-medium truncate">
                  Demo User
                </span>
                <span className="text-xs text-muted-foreground">
                  Simulation Mode
                </span>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Top Header */}
          <header className="h-14 border-b border-gray-200/50 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 sticky top-0 z-50">
            <div className="flex h-full items-center justify-between px-4">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="-ml-1" />
                <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700">
                  <Play className="h-3 w-3 mr-1" />
                  Simulation Mode
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {pendingConnections > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">
                      {pendingConnections}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </header>

          {/* Simulation Banner */}
          <SimulationBanner />

          {/* Main Content Area */}
          <main className="flex-1 p-6 bg-gradient-to-br from-background via-background to-muted/20">
            <div className="flex gap-6">
              {/* Page Content */}
              <div className="flex-1">
                {renderTabContent()}
              </div>
              
              {/* Simulation Progress Sidebar */}
              <div className="w-80 shrink-0">
                <SimulationProgress />
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
