import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, FileCheck, Users, BarChart3, AlertTriangle, Clock, CheckCircle, Building2 } from 'lucide-react';
import AuthModal from '@/components/AuthModal';
import BuyerDashboard from '@/components/BuyerDashboard';
import SupplierDashboard from '@/components/SupplierDashboard';

const Index = () => {
  const [currentUser, setCurrentUser] = useState<{
    roles: ('buyer' | 'supplier')[], 
    name: string, 
    currentRole: 'buyer' | 'supplier'
  } | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  const handleRoleSwitch = (newRole: 'buyer' | 'supplier') => {
    if (currentUser && currentUser.roles.includes(newRole)) {
      setCurrentUser({
        ...currentUser,
        currentRole: newRole
      });
    }
  };

  const features = [
    {
      icon: FileCheck,
      title: "Document Management",
      description: "Streamlined document requests, uploads, and validation with automated metadata capture"
    },
    {
      icon: Shield,
      title: "Compliance Tracking",
      description: "Real-time monitoring of compliance status across your entire supply chain"
    },
    {
      icon: Users,
      title: "Role-Based Access",
      description: "Separate dashboards for buyers, suppliers, and internal reviewers with granular permissions"
    },
    {
      icon: BarChart3,
      title: "Analytics & Reporting",
      description: "Comprehensive reports and dashboards with exportable compliance data"
    },
    {
      icon: AlertTriangle,
      title: "Smart Alerts",
      description: "Automated reminders for expiring documents and missing critical compliance items"
    },
    {
      icon: Clock,
      title: "Audit Trail",
      description: "Complete version control and audit logs for all document activities"
    }
  ];

  const industries = [
    { name: "Food Service", icon: "🍽️" },
    { name: "Pharmaceuticals", icon: "💊" },
    { name: "Manufacturing", icon: "🏭" },
    { name: "Retail", icon: "🛍️" },
    { name: "Logistics", icon: "🚛" },
    { name: "Construction", icon: "🏗️" }
  ];

  if (currentUser) {
    return currentUser.currentRole === 'buyer' ? 
      <BuyerDashboard 
        user={currentUser} 
        onLogout={() => setCurrentUser(null)}
        onRoleSwitch={handleRoleSwitch}
      /> :
      <SupplierDashboard 
        user={currentUser} 
        onLogout={() => setCurrentUser(null)}
        onRoleSwitch={handleRoleSwitch}
      />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">ComplianceFlow</h1>
            </div>
            <Button onClick={() => setShowAuth(true)} className="bg-blue-600 hover:bg-blue-700">
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Streamline Supply Chain
            <span className="text-blue-600 block">Compliance Management</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            End-to-end document management platform for buyers and suppliers. 
            Track compliance, automate workflows, and maintain audit-ready documentation across your entire supply chain.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <Badge variant="secondary" className="px-4 py-2 text-sm">
              <CheckCircle className="w-4 h-4 mr-2" />
              Real-time Tracking
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm">
              <Shield className="w-4 h-4 mr-2" />
              Audit-Ready
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm">
              <Building2 className="w-4 h-4 mr-2" />
              Multi-Industry
            </Badge>
          </div>
          <Button 
            onClick={() => setShowAuth(true)} 
            size="lg" 
            className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-lg"
          >
            Get Started Today
          </Button>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">
            Everything You Need for Compliance Management
          </h3>
          <p className="text-lg text-gray-600">
            Comprehensive tools designed for modern supply chain compliance
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-8 h-8 text-blue-600" />
                </div>
                <CardTitle className="text-xl font-semibold">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-center">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Industries Section */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">
              Trusted Across Industries
            </h3>
            <p className="text-lg text-gray-600">
              Scalable compliance solutions for diverse industry requirements
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
            {industries.map((industry, index) => (
              <div key={index} className="text-center">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                  {industry.icon}
                </div>
                <p className="font-medium text-gray-900">{industry.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 py-20">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your Compliance Management?
          </h3>
          <p className="text-xl text-blue-100 mb-8">
            Join leading organizations that trust ComplianceFlow for their supply chain documentation
          </p>
          <Button 
            onClick={() => setShowAuth(true)}
            size="lg" 
            variant="secondary" 
            className="px-8 py-3 text-lg"
          >
            Start Your Free Trial
          </Button>
        </div>
      </section>

      <AuthModal 
        isOpen={showAuth} 
        onClose={() => setShowAuth(false)} 
        onLogin={setCurrentUser}
      />
    </div>
  );
};

export default Index;
