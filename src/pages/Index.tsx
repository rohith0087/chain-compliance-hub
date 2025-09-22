
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, FileCheck, Users, BarChart3, AlertTriangle, Clock, CheckCircle, Building2, Settings, ArrowRight, Star, Globe, Zap, Lock, TrendingUp, Mail, Phone, MapPin, Linkedin, Twitter, Youtube, Bot, Workflow, Database, Code, Gauge, Monitor, Award, ChevronRight, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import RegionSelector from '@/components/RegionSelector';

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['home', 'common']);
  const { user, profile } = useAuth();
  
  const isAdmin = profile?.roles?.includes('admin');

  const coreFeatures = [
    {
      icon: FileCheck,
      title: t('home:features.documentManagement.title'),
      description: t('home:features.documentManagement.description'),
      benefits: ['Automated metadata capture', 'Version control', 'Digital signatures', 'Bulk operations']
    },
    {
      icon: Shield,
      title: t('home:features.complianceTracking.title'),
      description: t('home:features.complianceTracking.description'),
      benefits: ['Real-time monitoring', 'Risk assessment', 'Compliance scoring', 'Automated reporting']
    },
    {
      icon: Users,
      title: t('home:features.roleBasedAccess.title'),
      description: t('home:features.roleBasedAccess.description'),
      benefits: ['Granular permissions', 'Multi-tenant support', 'Single sign-on', 'Audit logs']
    },
    {
      icon: BarChart3,
      title: t('home:features.analytics.title'),
      description: t('home:features.analytics.description'),
      benefits: ['Custom dashboards', 'Exportable reports', 'Trend analysis', 'Performance metrics']
    },
    {
      icon: AlertTriangle,
      title: t('home:features.smartAlerts.title'),
      description: t('home:features.smartAlerts.description'),
      benefits: ['Expiry notifications', 'Risk alerts', 'Custom triggers', 'Multi-channel delivery']
    },
    {
      icon: Clock,
      title: t('home:features.auditTrail.title'),
      description: t('home:features.auditTrail.description'),
      benefits: ['Complete history', 'Immutable records', 'Regulatory compliance', 'Digital evidence']
    }
  ];

  const advancedFeatures = [
    {
      icon: Bot,
      title: 'AI-Powered Document Analysis',
      description: 'Advanced AI engine analyzes documents for compliance risks, automates data extraction, and provides intelligent insights.',
      highlight: 'AI'
    },
    {
      icon: Building2,
      title: 'Multi-Tenant Branch Management',
      description: 'Comprehensive branch and subsidiary management with isolated data, permissions, and workflow customization.',
      highlight: 'Enterprise'
    },
    {
      icon: Workflow,
      title: 'Advanced Workflow Automation',
      description: 'Configurable approval workflows, automated document routing, and intelligent task assignment.',
      highlight: 'Automation'
    },
    {
      icon: Monitor,
      title: 'Real-Time Compliance Monitoring',
      description: 'Continuous monitoring with instant alerts, compliance scoring, and proactive risk management.',
      highlight: 'Real-Time'
    },
    {
      icon: Database,
      title: 'Bulk Processing Engine',
      description: 'Handle thousands of documents simultaneously with advanced batch processing and data validation.',
      highlight: 'Scale'
    },
    {
      icon: Code,
      title: 'Enterprise APIs & Integrations',
      description: 'RESTful APIs, webhooks, and pre-built integrations with leading ERP and document management systems.',
      highlight: 'Connect'
    }
  ];

  const stats = [
    { value: '500+', label: 'Enterprise Clients', icon: Building2 },
    { value: '99.99%', label: 'Uptime SLA', icon: Gauge },
    { value: '50M+', label: 'Documents Processed', icon: FileCheck },
    { value: '25+', label: 'Countries Served', icon: Globe }
  ];

  const enterpriseFeatures = [
    {
      category: 'Security & Compliance',
      features: [
        'SOC 2 Type II Certified',
        'ISO 27001 Compliant',
        'GDPR Ready',
        'End-to-End Encryption',
        'Zero-Trust Architecture',
        'Single Sign-On (SSO)'
      ]
    },
    {
      category: 'Platform Administration',
      features: [
        'Super Admin Controls',
        'Platform-wide Analytics',
        'Multi-Tenant Management',
        'Usage & Billing Reports',
        'System Health Monitoring',
        'Audit & Compliance Reports'
      ]
    },
    {
      category: 'Integration & APIs',
      features: [
        'RESTful APIs',
        'Webhook Support',
        'Bulk Operations',
        'Custom Workflows',
        'Third-party Integrations',
        'Developer Documentation'
      ]
    }
  ];

  const trustedBy = [
    { name: 'Fortune 500 Manufacturer', logo: '🏭' },
    { name: 'Global Logistics Leader', logo: '🚛' },
    { name: 'Pharmaceutical Giant', logo: '💊' },
    { name: 'Food Service Chain', logo: '🍽️' },
    { name: 'Construction Corp', logo: '🏗️' },
    { name: 'Retail Network', logo: '🛍️' }
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">ComplianceFlow</h1>
                <p className="text-xs text-muted-foreground">by TraceR2C LLC</p>
              </div>
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
                <Button onClick={() => navigate('/dashboard')} className="flex items-center gap-2">
                  Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button onClick={() => navigate('/auth')} className="flex items-center gap-2">
                  {t('common:navigation.signIn')}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-hero py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16">
            <Badge className="mb-6 px-6 py-3 bg-gradient-primary text-white border-0 shadow-elegant animate-pulse-glow">
              <Award className="w-5 h-5 mr-2" />
              Trusted by 500+ Enterprise Organizations Worldwide
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-8 leading-tight">
              Enterprise-Grade
              <span className="bg-gradient-primary bg-clip-text text-transparent block">
                Supply Chain Compliance
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-5xl mx-auto leading-relaxed">
              AI-powered compliance management platform that streamlines documentation, automates workflows, 
              and ensures regulatory adherence across your entire supply chain ecosystem.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center mb-16">
              <Button 
                onClick={() => navigate('/auth')} 
                size="lg" 
                className="px-10 py-5 text-lg font-semibold bg-gradient-primary text-white border-0 shadow-elegant hover:shadow-subtle transition-all duration-300 transform hover:scale-105"
              >
                Start Enterprise Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="px-10 py-5 text-lg font-semibold border-2 transition-all duration-300 hover:bg-muted/50"
              >
                <Play className="w-5 h-5 mr-2" />
                Watch Demo
              </Button>
              <Button 
                variant="ghost" 
                size="lg" 
                className="px-10 py-5 text-lg transition-all duration-300"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Learn More
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-6">
              <Badge className="px-4 py-2 text-sm bg-green-accent text-white border-0">
                <CheckCircle className="w-4 h-4 mr-2" />
                {t('home:hero.badges.realTimeTracking')}
              </Badge>
              <Badge variant="outline" className="px-4 py-2 text-sm">
                <Shield className="w-4 h-4 mr-2" />
                {t('home:hero.badges.auditReady')}
              </Badge>
              <Badge variant="outline" className="px-4 py-2 text-sm">
                <Building2 className="w-4 h-4 mr-2" />
                {t('home:hero.badges.multiIndustry')}
              </Badge>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-20">
            {stats.map((stat, index) => (
              <div key={index} className="text-center p-8 rounded-2xl bg-card/80 backdrop-blur-sm border border-border/50 hover:shadow-elegant transition-all duration-300 hover:scale-105">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="w-8 h-8 text-primary" />
                </div>
                <div className="text-4xl font-bold mb-2 text-primary">{stat.value}</div>
                <div className="text-muted-foreground font-medium">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Trusted By Section */}
          <div className="mt-24">
            <p className="text-center text-muted-foreground mb-8 text-lg">Trusted by Industry Leaders</p>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
              {trustedBy.map((company, index) => (
                <div key={index} className="text-center p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all duration-300">
                  <div className="text-3xl mb-2">{company.logo}</div>
                  <p className="text-xs text-muted-foreground font-medium">{company.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Features Section */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge className="mb-4 px-4 py-2" variant="outline">
              Enterprise Platform
            </Badge>
            <h2 className="text-5xl font-bold text-foreground mb-6">
              Advanced Compliance Technology
            </h2>
            <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
              Built for enterprise scale with AI-powered automation, comprehensive workflow management, 
              and enterprise-grade security that scales with your organization.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
            {advancedFeatures.map((feature, index) => {
              const colors = ['blue-accent', 'green-accent', 'purple-accent', 'orange-accent', 'teal-accent', 'pink-accent'];
              const colorClass = colors[index % colors.length];
              
              return (
                <Card key={index} className="relative p-8 shadow-lg hover:shadow-elegant transition-all duration-300 group hover:scale-105">
                  <Badge className="absolute top-6 right-6 text-xs font-medium" variant="secondary">
                    {feature.highlight}
                  </Badge>
                  <div className={`w-16 h-16 bg-${colorClass}/10 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300`}>
                    <feature.icon className={`w-8 h-8 text-${colorClass}`} />
                  </div>
                  <h3 className="text-xl font-semibold mb-4 text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm">{feature.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              {t('home:features.title')}
            </h2>
            <p className="text-xl text-muted-foreground">
              {t('home:features.subtitle')}
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {coreFeatures.map((feature, index) => {
              const colors = ['blue-accent', 'green-accent', 'purple-accent'];
              const colorClass = colors[index % colors.length];
              
              return (
                <Card key={index} className="p-8 shadow-lg hover:shadow-elegant transition-all duration-300 group">
                  <div className={`w-16 h-16 bg-${colorClass}/10 rounded-2xl flex items-center justify-center mb-6 transition-all duration-300`}>
                    <feature.icon className={`w-8 h-8 text-${colorClass}`} />
                  </div>
                  <h3 className="text-2xl font-semibold mb-4 text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground mb-6 leading-relaxed">{feature.description}</p>
                  <div className="space-y-2">
                    {feature.benefits.map((benefit, benefitIndex) => (
                      <div key={benefitIndex} className="flex items-center text-sm text-muted-foreground">
                        <CheckCircle className="w-4 h-4 mr-3 text-green-accent" />
                        {benefit}
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Enterprise Features Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-6">
              Enterprise-Ready Platform
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Comprehensive security, scalability, and integration capabilities designed for large organizations
            </p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-12">
            {enterpriseFeatures.map((category, index) => (
              <Card key={index} className="p-8 shadow-lg hover:shadow-elegant transition-all duration-300">
                <h3 className="text-2xl font-semibold mb-6 text-foreground">{category.category}</h3>
                <ul className="space-y-4">
                  {category.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center text-muted-foreground">
                      <CheckCircle className="w-5 h-5 mr-3 text-green-accent flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Industries Section */}
      <section className="py-24 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              {t('home:industries.title')}
            </h2>
            <p className="text-xl text-muted-foreground">
              {t('home:industries.subtitle')}
            </p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
            {industries.map((industry, index) => (
              <Card key={index} className="p-6 text-center shadow-md hover:shadow-elegant transition-all duration-300 transform hover:scale-105">
                <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl transition-all duration-300">
                  {industry.icon}
                </div>
                <p className="font-semibold text-foreground text-sm">{industry.name}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary to-primary-glow opacity-90"></div>
        <div className="max-w-6xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative">
          <Badge className="mb-6 px-6 py-3 bg-white/20 text-white border-0">
            <TrendingUp className="w-5 h-5 mr-2" />
            Ready for Enterprise Scale
          </Badge>
          <h2 className="text-5xl md:text-6xl font-bold text-white mb-8 leading-tight">
            Transform Your Supply Chain Today
          </h2>
          <p className="text-xl md:text-2xl text-white/90 mb-12 leading-relaxed max-w-4xl mx-auto">
            Join 500+ enterprise organizations that have revolutionized their compliance management. 
            Start your digital transformation journey with our industry-leading platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center mb-12">
            <Button 
              onClick={() => navigate('/auth')}
              size="lg" 
              className="px-10 py-5 text-lg font-semibold bg-white text-primary hover:bg-white/90 transition-all duration-300 transform hover:scale-105 border-0 shadow-2xl"
            >
              Start Enterprise Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="px-10 py-5 text-lg font-semibold border-2 border-white/80 text-white hover:bg-white/20 hover:border-white transition-all duration-300"
            >
              <Phone className="w-5 h-5 mr-2" />
              Schedule Demo
            </Button>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-2">30-Day</div>
              <div className="text-white/80">Free Trial</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-2">24/7</div>
              <div className="text-white/80">Enterprise Support</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white mb-2">99.99%</div>
              <div className="text-white/80">Uptime SLA</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background border-t py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground">ComplianceFlow</h3>
                  <p className="text-sm text-muted-foreground">by TraceR2C LLC</p>
                </div>
              </div>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                The world's most advanced supply chain compliance management platform. 
                Trusted by leading organizations to streamline documentation, ensure compliance, 
                and drive operational excellence.
              </p>
              <div className="flex space-x-4">
                <Button variant="ghost" size="sm" className="p-2">
                  <Linkedin className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="sm" className="p-2">
                  <Twitter className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="sm" className="p-2">
                  <Youtube className="w-5 h-5" />
                </Button>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-4">Product</h4>
              <ul className="space-y-3">
                <li><a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Security</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Integrations</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">API Documentation</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-3">
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">About TraceR2C</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Careers</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">News & Press</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Contact</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Partners</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t pt-8">
            <div className="grid md:grid-cols-3 gap-8 items-center">
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-2" />
                  Global HQ, USA
                </div>
              </div>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  © 2024 TraceR2C LLC. All rights reserved.
                </p>
              </div>
              
              <div className="flex justify-end space-x-6 text-sm">
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Cookies</a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Region Selector */}
      <RegionSelector />
    </div>
  );
};

export default Index;
