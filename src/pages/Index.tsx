
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, FileCheck, Users, BarChart3, AlertTriangle, Clock, CheckCircle, Building2, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import RegionSelector from '@/components/RegionSelector';

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['home', 'common']);
  const { user, profile } = useAuth();
  
  const isAdmin = profile?.roles?.includes('admin');

  const features = [
    {
      icon: FileCheck,
      title: t('home:features.documentManagement.title'),
      description: t('home:features.documentManagement.description')
    },
    {
      icon: Shield,
      title: t('home:features.complianceTracking.title'),
      description: t('home:features.complianceTracking.description')
    },
    {
      icon: Users,
      title: t('home:features.roleBasedAccess.title'),
      description: t('home:features.roleBasedAccess.description')
    },
    {
      icon: BarChart3,
      title: t('home:features.analytics.title'),
      description: t('home:features.analytics.description')
    },
    {
      icon: AlertTriangle,
      title: t('home:features.smartAlerts.title'),
      description: t('home:features.smartAlerts.description')
    },
    {
      icon: Clock,
      title: t('home:features.auditTrail.title'),
      description: t('home:features.auditTrail.description')
    }
  ];

  const industries = [
    { name: t('home:industries.foodService'), icon: "🍽️" },
    { name: t('home:industries.pharmaceuticals'), icon: "💊" },
    { name: t('home:industries.manufacturing'), icon: "🏭" },
    { name: t('home:industries.retail'), icon: "🛍️" },
    { name: t('home:industries.logistics'), icon: "🚛" },
    { name: t('home:industries.construction'), icon: "🏗️" }
  ];

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
            <div className="flex items-center space-x-3">
              {user && isAdmin && (
                <Button 
                  onClick={() => navigate('/admin')} 
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Admin Panel
                </Button>
              )}
              {user ? (
                <Button onClick={() => navigate('/dashboard')} className="bg-blue-600 hover:bg-blue-700">
                  Dashboard
                </Button>
              ) : (
                <Button onClick={() => navigate('/auth')} className="bg-blue-600 hover:bg-blue-700">
                  {t('common:navigation.signIn')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            {t('home:hero.title')}
            <span className="text-blue-600 block">{t('home:hero.subtitle')}</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            {t('home:hero.description')}
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <Badge variant="secondary" className="px-4 py-2 text-sm">
              <CheckCircle className="w-4 h-4 mr-2" />
              {t('home:hero.badges.realTimeTracking')}
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm">
              <Shield className="w-4 h-4 mr-2" />
              {t('home:hero.badges.auditReady')}
            </Badge>
            <Badge variant="secondary" className="px-4 py-2 text-sm">
              <Building2 className="w-4 h-4 mr-2" />
              {t('home:hero.badges.multiIndustry')}
            </Badge>
          </div>
          <Button 
            onClick={() => navigate('/auth')} 
            size="lg" 
            className="bg-blue-600 hover:bg-blue-700 px-8 py-3 text-lg"
          >
            {t('common:navigation.getStarted')}
          </Button>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">
            {t('home:features.title')}
          </h3>
          <p className="text-lg text-gray-600">
            {t('home:features.subtitle')}
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
              {t('home:industries.title')}
            </h3>
            <p className="text-lg text-gray-600">
              {t('home:industries.subtitle')}
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
            {t('home:cta.title')}
          </h3>
          <p className="text-xl text-blue-100 mb-8">
            {t('home:cta.subtitle')}
          </p>
          <Button 
            onClick={() => navigate('/auth')}
            size="lg" 
            variant="secondary" 
            className="px-8 py-3 text-lg"
          >
            {t('common:navigation.startFreeTrial')}
          </Button>
        </div>
      </section>

      {/* Region Selector */}
      <RegionSelector />
    </div>
  );
};

export default Index;
