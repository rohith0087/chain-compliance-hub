import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, FileCheck, Users, BarChart3, AlertTriangle, Clock, 
  CheckCircle, Building2, Settings, ArrowRight, Star, Globe, 
  Zap, Lock, TrendingUp, Mail, Phone, MapPin, Linkedin, 
  Twitter, Youtube, Bot, Network, Sparkles, Timer, Workflow, 
  Brain, Layers, MessageSquare, Calendar, Cpu, Database,
  Radar, Target, Gauge, Briefcase
} from 'lucide-react';

// Mock hooks for demo purposes
const useNavigate = () => (path: string) => console.log('Navigate to:', path);
const useTranslation = () => ({ t: (key: string) => key.split(':').pop() || key });
const useAuth = () => ({ user: null, profile: null });

// Mock RegionSelector component
const RegionSelector = () => (
  <div className="fixed bottom-4 right-4 z-50">
    <Button variant="outline" className="flex items-center gap-2 bg-card/80 backdrop-blur-sm border-border/50 hover:bg-accent/50 transition-all duration-300">
      <Globe className="w-4 h-4" />
      Global
    </Button>
  </div>
);

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, profile } = useAuth();

  const isAdmin = profile?.roles?.includes('admin');

  const heroFeatures = [
    {
      icon: Bot,
      title: "AI-Powered Intelligence",
      description: "24/7 intelligent document processing with 99.7% accuracy and automated compliance checks",
      gradient: "from-blue-500 to-cyan-500",
      delay: "delay-0"
    },
    {
      icon: Network,
      title: "Multi-Buyer Hub",
      description: "Seamlessly manage 100+ buyer relationships from one unified platform",
      gradient: "from-purple-500 to-pink-500",
      delay: "delay-200"
    },
    {
      icon: Timer,
      title: "Real-Time Processing",
      description: "Instant document requests and automated compliance monitoring around the clock",
      gradient: "from-green-500 to-emerald-500",
      delay: "delay-400"
    }
  ];

  const coreFeatures = [
    {
      icon: FileCheck,
      title: "Smart Document Management",
      description: "AI-powered document processing with intelligent categorization and version control",
      benefits: ['AI metadata capture', 'Smart version control', 'Digital signatures', 'Bulk operations'],
      color: "from-blue-500/20 to-blue-600/20",
      iconColor: "text-blue-600 dark:text-blue-400"
    },
    {
      icon: Shield,
      title: "Advanced Compliance Tracking",
      description: "Predictive monitoring with AI risk assessment and automated reporting",
      benefits: ['Predictive monitoring', 'AI risk assessment', 'Compliance scoring', 'Automated reporting'],
      color: "from-green-500/20 to-green-600/20",
      iconColor: "text-green-600 dark:text-green-400"
    },
    {
      icon: Users,
      title: "Role-Based Access Control",
      description: "Granular permissions with multi-tenant support and comprehensive audit trails",
      benefits: ['Granular permissions', 'Multi-tenant support', 'SSO integration', 'Audit logs'],
      color: "from-purple-500/20 to-purple-600/20",
      iconColor: "text-purple-600 dark:text-purple-400"
    },
    {
      icon: BarChart3,
      title: "AI-Driven Analytics",
      description: "Intelligent insights with exportable reports and trend analysis",
      benefits: ['AI-driven insights', 'Exportable reports', 'Trend analysis', 'Performance metrics'],
      color: "from-orange-500/20 to-orange-600/20",
      iconColor: "text-orange-600 dark:text-orange-400"
    },
    {
      icon: AlertTriangle,
      title: "Smart Alert System",
      description: "Predictive alerts with intelligent notifications and custom triggers",
      benefits: ['Predictive alerts', 'Smart notifications', 'Custom triggers', 'Multi-channel delivery'],
      color: "from-red-500/20 to-red-600/20",
      iconColor: "text-red-600 dark:text-red-400"
    },
    {
      icon: Clock,
      title: "Complete Audit Trail",
      description: "Immutable records with complete history for regulatory compliance",
      benefits: ['Complete history', 'Immutable records', 'Regulatory compliance', 'Digital evidence'],
      color: "from-indigo-500/20 to-indigo-600/20",
      iconColor: "text-indigo-600 dark:text-indigo-400"
    }
  ];

  const stats = [
    { 
      value: '500+', 
      label: 'Enterprise Clients', 
      icon: Building2,
      description: 'Leading organizations trust ComplianceFlow'
    },
    { 
      value: '99.9%', 
      label: 'Uptime SLA', 
      icon: Shield,
      description: 'Guaranteed availability and reliability'
    },
    { 
      value: '50M+', 
      label: 'Documents Processed', 
      icon: FileCheck,
      description: 'Seamlessly handled with AI precision'
    },
    { 
      value: '100K+', 
      label: 'Active Connections', 
      icon: Network,
      description: 'Supplier-buyer relationships managed'
    }
  ];

  const aiCapabilities = [
    {
      icon: Brain,
      title: "Intelligent Document Understanding",
      description: "Advanced AI reads, analyzes, and categorizes compliance documents automatically with industry-leading 99.7% accuracy.",
      features: ["Auto-classification", "Data extraction", "Risk assessment", "Quality scoring"],
      gradient: "from-blue-500 to-purple-600"
    },
    {
      icon: MessageSquare,
      title: "24/7 Supplier Assistant",
      description: "AI agent handles buyer requests, schedules submissions, and manages communications around the clock without human intervention.",
      features: ["Natural language queries", "Automated responses", "Smart scheduling", "Priority management"],
      gradient: "from-purple-500 to-pink-600"
    },
    {
      icon: Workflow,
      title: "Multi-Buyer Orchestration",
      description: "Coordinate with hundreds of buyers simultaneously while maintaining compliance consistency across all relationships.",
      features: ["Unified dashboard", "Bulk operations", "Relationship mapping", "Performance analytics"],
      gradient: "from-green-500 to-blue-600"
    }
  ];

  const industries = [
    { 
      name: "Food Service & Hospitality", 
      icon: "🍽️", 
      gradient: "from-orange-400 to-red-500",
      description: "HACCP compliance & food safety"
    },
    { 
      name: "Pharmaceuticals & Healthcare", 
      icon: "💊", 
      gradient: "from-blue-400 to-purple-500",
      description: "FDA regulations & quality standards"
    },
    { 
      name: "Manufacturing & Industrial", 
      icon: "🏭", 
      gradient: "from-gray-400 to-slate-600",
      description: "ISO certifications & safety protocols"
    },
    { 
      name: "Retail & E-commerce", 
      icon: "🛍️", 
      gradient: "from-pink-400 to-purple-500",
      description: "Product compliance & supplier verification"
    },
    { 
      name: "Logistics & Supply Chain", 
      icon: "🚛", 
      gradient: "from-green-400 to-blue-500",
      description: "Transportation regulations & tracking"
    },
    { 
      name: "Construction & Engineering", 
      icon: "🏗️", 
      gradient: "from-yellow-400 to-orange-500",
      description: "Safety standards & regulatory compliance"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3 animate-fade-in">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg animate-float">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  ComplianceFlow
                </h1>
                <p className="text-xs text-muted-foreground">by TraceR2C LLC</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 animate-fade-in delay-200">
              {user && isAdmin && (
                <Button
                  onClick={() => navigate('/admin')}
                  variant="outline"
                  className="flex items-center gap-2 border-border hover:bg-accent/50 transition-all duration-300"
                >
                  <Settings className="w-4 h-4" />
                  Admin Panel
                </Button>
              )}
              {user ? (
                <Button 
                  onClick={() => navigate('/dashboard')} 
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button 
                  onClick={() => navigate('/auth')} 
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  Sign In
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-32 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-purple-50/30 dark:from-blue-950/30 dark:to-purple-950/30"></div>
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-float"></div>
          <div className="absolute top-20 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float delay-1000"></div>
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl animate-float delay-500"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16">
            <Badge className="mb-8 px-6 py-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:shadow-lg transition-all duration-300 animate-scale-in">
              <Sparkles className="w-4 h-4 mr-2" />
              Powered by Advanced AI • Trusted by 500+ Organizations
            </Badge>
            
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-8 leading-tight animate-slide-up">
              <span className="bg-gradient-to-r from-foreground via-blue-600 to-purple-600 bg-clip-text text-transparent">
                Smart Compliance
              </span>
              <br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent">
                Never Sleeps
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-5xl mx-auto leading-relaxed font-light animate-fade-in delay-300">
              Your AI-powered compliance agent works 24/7 to manage supplier documentation, 
              coordinate with hundreds of buyers, and ensure seamless regulatory adherence across your entire supply chain.
            </p>

            {/* Hero Feature Pills */}
            <div className="grid md:grid-cols-3 gap-6 mb-16 max-w-5xl mx-auto">
              {heroFeatures.map((feature, index) => (
                <div key={index} className={`bg-card/60 backdrop-blur-xl rounded-2xl p-6 border border-border/50 hover:shadow-xl transition-all duration-500 group animate-scale-in ${feature.delay}`}>
                  <div className={`w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-6 justify-center mb-20 animate-fade-in delay-500">
              <Button 
                onClick={() => navigate('/auth')} 
                size="lg" 
                className="px-10 py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-2xl hover:shadow-3xl transition-all duration-300 rounded-2xl hover:scale-105"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button 
                variant="outline" 
                size="lg" 
                className="px-10 py-6 text-lg font-semibold border-2 border-border hover:bg-accent/50 rounded-2xl transition-all duration-300 hover:scale-105"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Watch Demo
                <Globe className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 animate-fade-in delay-700">
            {stats.map((stat, index) => (
              <div key={index} className="text-center group">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300 border border-border/20">
                  <stat.icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="text-foreground font-medium mb-1">{stat.label}</div>
                <div className="text-xs text-muted-foreground">{stat.description}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Capabilities Section */}
      <section id="ai-features" className="py-32 bg-gradient-to-br from-muted/30 to-background relative">
        <div className="absolute inset-0 bg-grid-slate-100/50 dark:bg-grid-slate-800/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-20">
            <Badge className="mb-8 px-6 py-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 animate-scale-in">
              <Bot className="w-4 h-4 mr-2" />
              AI-Powered Intelligence
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent animate-slide-up">
              Your Intelligent Compliance Partner
            </h2>
            <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed animate-fade-in delay-200">
              Advanced AI that understands your business, learns from your processes, and scales with your growth
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {aiCapabilities.map((capability, index) => (
              <Card key={index} className="p-8 border-0 shadow-2xl bg-card/80 backdrop-blur-xl hover:shadow-3xl transition-all duration-500 group rounded-3xl animate-scale-in" style={{animationDelay: `${index * 200}ms`}}>
                <div className={`w-20 h-20 bg-gradient-to-br ${capability.gradient} rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300`}>
                  <capability.icon className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-foreground">{capability.title}</h3>
                <p className="text-muted-foreground mb-8 leading-relaxed">{capability.description}</p>
                <div className="space-y-3">
                  {capability.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center text-sm">
                      <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mr-3"></div>
                      <span className="text-muted-foreground font-medium">{feature}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section id="features" className="py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent animate-slide-up">
              Enterprise-Grade Features
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto animate-fade-in delay-200">
              Built for scale, designed for compliance, powered by intelligence
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {coreFeatures.map((feature, index) => (
              <Card key={index} className="p-8 border-0 shadow-xl bg-card hover:shadow-2xl transition-all duration-500 group rounded-3xl animate-scale-in" style={{animationDelay: `${index * 100}ms`}}>
                <div className={`w-16 h-16 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-border/20`}>
                  <feature.icon className={`w-8 h-8 ${feature.iconColor}`} />
                </div>
                <h3 className="text-2xl font-semibold mb-4 text-foreground">{feature.title}</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">{feature.description}</p>
                <div className="space-y-3">
                  {feature.benefits.map((benefit, benefitIndex) => (
                    <div key={benefitIndex} className="flex items-center text-sm">
                      <CheckCircle className="w-4 h-4 mr-3 text-green-500 flex-shrink-0" />
                      <span className="text-muted-foreground">{benefit}</span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Industries Section */}
      <section className="py-32 bg-gradient-to-br from-muted/30 to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent animate-slide-up">
              Trusted Across Industries
            </h2>
            <p className="text-xl text-muted-foreground animate-fade-in delay-200">
              Specialized compliance solutions for every sector
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {industries.map((industry, index) => (
              <Card key={index} className="p-8 text-center border-0 shadow-lg hover:shadow-xl transition-all duration-500 bg-card rounded-2xl group animate-scale-in" style={{animationDelay: `${index * 100}ms`}}>
                <div className={`w-20 h-20 bg-gradient-to-br ${industry.gradient} rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  {industry.icon}
                </div>
                <h3 className="font-bold text-foreground text-lg mb-2">{industry.name}</h3>
                <p className="text-sm text-muted-foreground">{industry.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800"></div>
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl animate-float"></div>
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-300/20 rounded-full blur-3xl animate-float delay-1000"></div>
        </div>
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-8 animate-slide-up">
            Ready to Transform Your Compliance?
          </h2>
          <p className="text-xl text-blue-100 mb-12 leading-relaxed animate-fade-in delay-200">
            Join 500+ organizations already using ComplianceFlow to streamline their supplier management and ensure regulatory compliance.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center animate-fade-in delay-400">
            <Button 
              onClick={() => navigate('/auth')}
              size="lg" 
              className="px-10 py-6 text-lg font-semibold bg-white text-blue-600 hover:bg-gray-50 shadow-2xl hover:shadow-3xl transition-all duration-300 rounded-2xl hover:scale-105"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="px-10 py-6 text-lg font-semibold border-2 border-white/30 text-white hover:bg-white/10 backdrop-blur-sm rounded-2xl transition-all duration-300 hover:scale-105"
            >
              Schedule Demo
              <Calendar className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-muted/30 border-t border-border py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-8">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Shield className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground">ComplianceFlow</h3>
                  <p className="text-sm text-muted-foreground">by TraceR2C LLC</p>
                </div>
              </div>
              <p className="text-muted-foreground mb-8 leading-relaxed max-w-md">
                The world's most advanced AI-powered supply chain compliance platform. 
                Trusted by leading organizations to streamline documentation, ensure compliance, 
                and drive operational excellence.
              </p>
              <div className="flex space-x-4">
                <Button variant="ghost" size="sm" className="p-3 hover:bg-accent rounded-xl transition-colors duration-300">
                  <Linkedin className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="sm" className="p-3 hover:bg-accent rounded-xl transition-colors duration-300">
                  <Twitter className="w-5 h-5" />
                </Button>
                <Button variant="ghost" size="sm" className="p-3 hover:bg-accent rounded-xl transition-colors duration-300">
                  <Youtube className="w-5 h-5" />
                </Button>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-6">Product</h4>
              <ul className="space-y-4">
                <li><a href="#ai-features" className="text-muted-foreground hover:text-foreground transition-colors duration-300">AI Features</a></li>
                <li><a href="#features" className="text-muted-foreground hover:text-foreground transition-colors duration-300">Core Features</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors duration-300">Pricing</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors duration-300">Security</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors duration-300">API Documentation</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-foreground mb-6">Company</h4>
              <ul className="space-y-4">
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors duration-300">About TraceR2C</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors duration-300">Careers</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors duration-300">News & Press</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors duration-300">Contact</a></li>
                <li><a href="#" className="text-muted-foreground hover:text-foreground transition-colors duration-300">Partners</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-12">
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

              <div className="flex justify-end space-x-8 text-sm">
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors duration-300">Privacy Policy</a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors duration-300">Terms of Service</a>
                <a href="#" className="text-muted-foreground hover:text-foreground transition-colors duration-300">Cookies</a>
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