import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SimulationProvider, useSimulation } from '@/contexts/SimulationContext';
import { SimulationIntro } from '@/components/simulation/SimulationIntro';
import { SimulationBanner } from '@/components/simulation/SimulationBanner';
import { SimulationProgress } from '@/components/simulation/SimulationProgress';
import { SimulationComplete } from '@/components/simulation/SimulationComplete';
import { SimulationConnectionCard } from '@/components/simulation/SimulationConnectionCard';
import { SimulationOnboarding } from '@/components/simulation/SimulationOnboarding';
import { SimulationDocumentRequests } from '@/components/simulation/SimulationDocumentRequests';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutDashboard, FileText, Link, BarChart3 } from 'lucide-react';

const SimulationDashboardContent = () => {
  const { isActive, currentStep, connectionStatus } = useSimulation();
  const navigate = useNavigate();

  if (!isActive) {
    return (
      <SimulationIntro
        onStart={() => {
          // This will be handled by context
        }}
        onSkip={() => navigate('/dashboard')}
      />
    );
  }

  if (currentStep === 'complete') {
    return <SimulationComplete />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SimulationBanner />
      <SimulationProgress />
      
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="simulation-sidebar-nav">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-2">
              <FileText className="h-4 w-4" />
              Requests
            </TabsTrigger>
            <TabsTrigger value="connections" className="gap-2">
              <Link className="h-4 w-4" />
              Connections
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {connectionStatus === 'pending' && <SimulationConnectionCard />}
            {(connectionStatus === 'onboarding') && <SimulationOnboarding />}
            {connectionStatus === 'active' && <SimulationDocumentRequests />}
          </TabsContent>

          <TabsContent value="requests">
            <SimulationDocumentRequests />
          </TabsContent>

          <TabsContent value="connections">
            <Card>
              <CardHeader>
                <CardTitle>Buyer Connections</CardTitle>
              </CardHeader>
              <CardContent>
                <SimulationConnectionCard />
                {connectionStatus !== 'pending' && (
                  <div className="p-4 bg-emerald-500/10 rounded-lg text-center">
                    <p className="text-emerald-600 font-medium">
                      Connected with Acme Fresh Foods Inc.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const SupplierSimulationPage = () => {
  const navigate = useNavigate();

  return (
    <SimulationProvider>
      <SimulationPageWrapper onSkip={() => navigate('/dashboard')} />
    </SimulationProvider>
  );
};

const SimulationPageWrapper = ({ onSkip }: { onSkip: () => void }) => {
  const { isActive, startSimulation } = useSimulation();

  if (!isActive) {
    return (
      <SimulationIntro
        onStart={startSimulation}
        onSkip={onSkip}
      />
    );
  }

  return <SimulationDashboardContent />;
};

export default SupplierSimulationPage;
