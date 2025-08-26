import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, FileCheck, Users, BarChart3, AlertTriangle, Clock, CheckCircle, Building2, Settings, ArrowRight, Star, Globe, Zap, Lock, TrendingUp, Mail, Phone, MapPin, Linkedin, Twitter, Youtube, Bot, Network, Sparkles, Timer, Workflow, Brain, Layers, MessageSquare } from 'lucide-react';
// Mock hooks for demo purposes
const useNavigate = () => (path) => console.log('Navigate to:', path);
const useTranslation = () => ({ t: (key) => key.split(':').pop() || key });
const useAuth = () => ({ user: null, profile: null });

// Mock RegionSelector component
const Index = () => { h-4 mr-2" />
      Global
    </Button>
  </div>
);
const navigate = useNavigate();
const { t } = useTranslation(['home', 'common']);
const { user, profile } = useAuth();

const isAdmin = profile?.roles?.includes('admin');

const heroFeatures = [
  {
    icon: Bot,
    title: "AI-Powered Agent",
    description: "24/7 intelligent document processing and supplier coordination",
    gradient: "from-blue-500 to-cyan-500"
  },
  {
    icon: Network,
    title: "Multi-Buyer Hub",
    description: "Seamlessly manage 100+ buyer relationships from one platform",
    gradient: "from-purple-500 to-pink-500"
  },
  {
    icon: Timer,
    title: "Real-Time Processing",
    description: "Instant document requests and automated compliance checks",
    gradient: "from-green-500 to-emerald-500"
  }
];

const aiCapabilities = [
  {
    icon: Brain,
    title: "Intelligent Document Understanding",
    description: "AI reads, analyzes, and categorizes compliance documents automatically with 99.7% accuracy.",
    features: ["Auto-classification", "Data extraction", "Risk assessment", "Quality scoring"]
  },
  {
    icon: MessageSquare,
    title: "24/7 Supplier Assistant",
    description: "AI agent handles buyer requests, schedules submissions, and manages communications around the clock.",
    features: ["Natural language queries", "Automated responses", "Smart scheduling", "Priority management"]
  },
  {
    icon: Workflow,
    title: "Multi-Buyer Orchestration",
    description: "Coordinate with hundreds of buyers simultaneously while maintaining compliance consistency.",
    features: ["Unified dashboard", "Bulk operations", "Relationship mapping", "Performance analytics"]
  }
];

const coreFeatures = [
{
icon: FileCheck,
title: t('home:features.documentManagement.title'),
description: t('home:features.documentManagement.description'),
benefits: ['AI-powered metadata capture', 'Smart version control', 'Digital signatures', 'Bulk operations'],
color: "bg-blue-500/10 text-blue-600"
},
{
icon: Shield,
title: t('home:features.complianceTracking.title'),
description: t('home:features.complianceTracking.description'),
benefits: ['Predictive monitoring', 'AI risk assessment', 'Compliance scoring', 'Automated reporting'],
color: "bg-green-500/10 text-green-600"
},
{
icon: Users,
title: t('home:features.roleBasedAccess.title'),
description: t('home:features.roleBasedAccess.description'),
benefits: ['Granular permissions', 'Multi-tenant support', 'SSO integration', 'Audit logs'],
color: "bg-purple-500/10 text-purple-600"
},
{
icon: BarChart3,
title: t('home:features.analytics.title'),
description: t('home:features.analytics.description'),
benefits: ['AI-driven insights', 'Exportable reports', 'Trend analysis', 'Performance metrics'],
color: "bg-orange-500/10 text-orange-600"
},
{
icon: AlertTriangle,
title: t('home:features.smartAlerts.title'),
description: t('home:features.smartAlerts.description'),
benefits: ['Predictive alerts', 'Smart notifications', 'Custom triggers', 'Multi-channel delivery'],
color: "bg-red-500/10 text-red-600"
},
{
icon: Clock,
title: t('home:features.auditTrail.title'),
description: t('home:features.auditTrail.description'),
benefits: ['Complete history', 'Immutable records', 'Regulatory compliance', 'Digital evidence'],
color: "bg-indigo-500/10 text-indigo-600"
}
];

const stats = [
{ value: '500+', label: 'Enterprise Clients', icon: Building2 },
{ value: '99.9%', label: 'Uptime SLA', icon: Shield },
{ value: '50M+', label: 'Documents Processed', icon: FileCheck },
{ value: '100K+', label: 'Supplier-Buyer Connections', icon: Network }
];

const industries = [
{ name: t('home:industries.foodService'), icon: "🍽️", gradient: "from-orange-400 to-red-500" },
{ name: t('home:industries.pharmaceuticals'), icon: "💊", gradient: "from-blue-400 to-purple-500" },
{ name: t('home:industries.manufacturing'), icon: "🏭", gradient: "from-gray-400 to-slate-600" },
{ name: t('home:industries.retail'), icon: "🛍️", gradient: "from-pink-400 to-purple-500" },
{ name: t('home:industries.logistics'), icon: "🚛", gradient: "from-green-400 to-blue-500" },
{ name: t('home:industries.construction'), icon: "🏗️", gradient: "from-yellow-400 to-orange-500" }
];

return (
<div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
{/* Header */}
<header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
<div className="flex justify-between items-center h-16">
<div className="flex items-center space-x-3">
<div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
<Shield className="w-6 h-6 text-white" />
</div>
<div>
<h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">ComplianceFlow</h1>
<p className="text-xs text-slate-500">by TraceR2C LLC</p>
</div>
</div>
<div className="flex items-center space-x-3">
{user && isAdmin && (
<Button
onClick={() => navigate('/admin')}
variant="outline"
className="flex items-center gap-2 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
>
<Settings className="w-4 h-4" />
Admin Panel
</Button>
)}
{user ? (
<Button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all">
Dashboard
<ArrowRight className="w-4 h-4" />
</Button>
) : (
<Button onClick={() => navigate('/auth')} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all">
{t('common:navigation.signIn')}
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
<div className="absolute inset-0">
<div className="absolute top-0 left-1/4 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl"></div>
<div className="absolute top-20 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
<div className="absolute bottom-0 left-1/3 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl"></div>
</div>

<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
<div className="text-center mb-16">
<Badge className="mb-8 px-6 py-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:shadow-lg transition-all">
<Sparkles className="w-4 h-4 mr-2" />
Powered by Advanced AI • Trusted by 500+ Organizations
</Badge>
<h1 className="text-7xl md:text-8xl font-bold mb-8 leading-tight">
<span className="bg-gradient-to-r from-slate-900 via-blue-800 to-purple-800 dark:from-white dark:via-blue-200 dark:to-purple-200 bg-clip-text text-transparent">
Smart Compliance
</span>
<br />
<span className="bg-gradient-to-r from-blue-600 via-purple-600 to-cyan-600 bg-clip-text text-transparent">
Never Sleeps
</span>
</h1>
<p className="text-2xl text-slate-600 dark:text-slate-300 mb-12 max-w-5xl mx-auto leading-relaxed font-light">
Your AI-powered compliance agent works 24/7 to manage supplier documentation, 
coordinate with hundreds of buyers, and ensure seamless regulatory adherence across your entire supply chain.
</p>

{/* Hero Feature Pills */}
<div className="grid md:grid-cols-3 gap-6 mb-16 max-w-5xl mx-auto">
{heroFeatures.map((feature, index) => (
<div key={index} className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/50 hover:shadow-xl transition-all duration-300 group">
<div className={`w-14 h-14 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
<feature.icon className="w-7 h-7 text-white" />
</div>
<h3 className="font-semibold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
<p className="text-slate-600 dark:text-slate-300 text-sm">{feature.description}</p>
</div>
))}
</div>

<div className="flex flex-col sm:flex-row gap-6 justify-center mb-20">
<Button 
onClick={() => navigate('/auth')} 
size="lg" 
className="px-10 py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-2xl hover:shadow-3xl transition-all rounded-2xl"
>
Start Free Trial
<ArrowRight className="w-5 h-5 ml-2" />
</Button>
<Button 
variant="outline" 
size="lg" 
className="px-10 py-6 text-lg font-semibold border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl"
onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
>
Watch Demo
<Globe className="w-5 h-5 ml-2" />
</Button>
</div>
</div>

{/* Stats Grid */}
<div className="grid grid-cols-2 md:grid-cols-4 gap-8">
{stats.map((stat, index) => (
<div key={index} className="text-center group">
<div className="w-16 h-16 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
<stat.icon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
</div>
<div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">{stat.value}</div>
<div className="text-slate-600 dark:text-slate-400 font-medium">{stat.label}</div>
</div>
))}
</div>
</div>
</section>

{/* AI Capabilities Section */}
<section id="ai-features" className="py-32 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50 relative">
<div className="absolute inset-0 bg-grid-slate-100/50 dark:bg-grid-slate-800/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
<div className="text-center mb-20">
<Badge className="mb-8 px-6 py-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300">
<Bot className="w-4 h-4 mr-2" />
AI-Powered Intelligence
</Badge>
<h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
Your Intelligent Compliance Partner
</h2>
<p className="text-xl text-slate-600 dark:text-slate-300 max-w-4xl mx-auto leading-relaxed">
Advanced AI that understands your business, learns from your processes, and scales with your growth
</p>
</div>

<div className="grid lg:grid-cols-3 gap-8">
{aiCapabilities.map((capability, index) => (
<Card key={index} className="p-8 border-0 shadow-2xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl hover:shadow-3xl transition-all duration-500 group rounded-3xl">
<div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
<capability.icon className="w-10 h-10 text-white" />
</div>
<h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">{capability.title}</h3>
<p className="text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">{capability.description}</p>
<div className="space-y-3">
{capability.features.map((feature, featureIndex) => (
<div key={featureIndex} className="flex items-center text-sm">
<div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mr-3"></div>
<span className="text-slate-700 dark:text-slate-300 font-medium">{feature}</span>
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
<h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
{t('home:features.title')}
</h2>
<p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto">
{t('home:features.subtitle')}
</p>
</div>

<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
{coreFeatures.map((feature, index) => (
<Card key={index} className="p-8 border-0 shadow-xl bg-white dark:bg-slate-800 hover:shadow-2xl transition-all duration-300 group rounded-3xl">
<div className={`w-16 h-16 ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
<feature.icon className="w-8 h-8" />
</div>
<h3 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">{feature.title}</h3>
<p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">{feature.description}</p>
<div className="space-y-3">
{feature.benefits.map((benefit, benefitIndex) => (
<div key={benefitIndex} className="flex items-center text-sm">
<CheckCircle className="w-4 h-4 mr-3 text-green-500" />
<span className="text-slate-700 dark:text-slate-300">{benefit}</span>
</div>
))}
</div>
</Card>
))}
</div>
</div>
</section>

{/* Industries Section */}
<section className="py-32 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
<div className="text-center mb-20">
<h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
{t('home:industries.title')}
</h2>
<p className="text-xl text-slate-600 dark:text-slate-300">
{t('home:industries.subtitle')}
</p>
</div>

<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
{industries.map((industry, index) => (
<Card key={index} className="p-6 text-center border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white dark:bg-slate-800 rounded-2xl group">
<div className={`w-16 h-16 bg-gradient-to-br ${industry.gradient} rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl group-hover:scale-110 transition-transform shadow-lg`}>
{industry.icon}
</div>
<p className="font-semibold text-slate-900 dark:text-white text-sm">{industry.name}</p>
</Card>
))}
</div>
</div>
</section>

{/* CTA Section */}
<section className="py-32 relative overflow-hidden">
<div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800"></div>
<div className="absolute inset-0">
<div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
<div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-300/20 rounded-full blur-3xl"></div>
</div>
<div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative">
<h2 className="text-5xl font-bold text-white mb-8">
{t('home:cta.title')}
</h2>
<p className="text-xl text-blue-100 mb-12 leading-relaxed">
{t('home:cta.subtitle')}
</p>
<div className="flex flex-col sm:flex-row gap-6 justify-center">
<Button 
onClick={() => navigate('/auth')}
size="lg" 
className="px-10 py-6 text-lg font-semibold bg-white text-blue-600 hover:bg-gray-50 shadow-2xl hover:shadow-3xl transition-all rounded-2xl"
>
{t('common:navigation.startFreeTrial')}
<ArrowRight className="w-5 h-5 ml-2" />
</Button>
<Button 
variant="outline" 
size="lg" 
className="px-10 py-6 text-lg font-semibold border-2 border-white/30 text-white hover:bg-white/10 backdrop-blur-sm rounded-2xl"
>
Schedule Demo
<Calendar className="w-5 h-5 ml-2" />
</Button>
</div>
</div>
</section>

{/* Footer */}
<footer className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-20">
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
<div className="grid md:grid-cols-4 gap-12 mb-16">
<div className="md:col-span-2">
<div className="flex items-center space-x-3 mb-8">
<div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
<Shield className="w-7 h-7 text-white" />
</div>
<div>
<h3 className="text-2xl font-bold text-slate-900 dark:text-white">ComplianceFlow</h3>
<p className="text-sm text-slate-500">by TraceR2C LLC</p>
</div>
</div>
<p className="text-slate-600 dark:text-slate-300 mb-8 leading-relaxed max-w-md">
The world's most advanced AI-powered supply chain compliance platform. 
Trusted by leading organizations to streamline documentation, ensure compliance, 
and drive operational excellence.
</p>
<div className="flex space-x-4">
<Button variant="ghost" size="sm" className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
<Linkedin className="w-5 h-5" />
</Button>
<Button variant="ghost" size="sm" className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
<Twitter className="w-5 h-5" />
</Button>
<Button variant="ghost" size="sm" className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
<Youtube className="w-5 h-5" />
</Button>
</div>
</div>

<div>
<h4 className="font-semibold text-slate-900 dark:text-white mb-6">Product</h4>
<ul className="space-y-4">
<li><a href="#features" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">AI Features</a></li>
<li><a href="#" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Pricing</a></li>
<li><a href="#" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Security</a></li>
<li><a href="#" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Integrations</a></li>
<li><a href="#" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">API Documentation</a></li>
</ul>
</div>

<div>
<h4 className="font-semibold text-slate-900 dark:text-white mb-6">Company</h4>
<ul className="space-y-4">
<li><a href="#" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">About TraceR2C</a></li>
<li><a href="#" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Careers</a></li>
<li><a href="#" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">News & Press</a></li>
<li><a href="#" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Contact</a></li>
<li><a href="#" className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Partners</a></li>
</ul>
</div>
</div>

<div className="border-t border-slate-200 dark:border-slate-800 pt-12">
<div className="grid md:grid-cols-3 gap-8 items-center">
<div className="flex items-center space-x-4 text-sm text-slate-500">
<div className="flex items-center">
<MapPin className="w-4 h-4 mr-2" />
Global HQ, USA
</div>
</div>

<div className="text-center">
<p className="text-sm text-slate-500">
© 2024 TraceR2C LLC. All rights reserved.
</p>
</div>

<div className="flex justify-end space-x-8 text-sm">
<a href="#" className="text-slate-500 hover:text-blue-600 transition-colors">Privacy Policy</a>
<a href="#" className="text-slate-500 hover:text-blue-600 transition-colors">Terms of Service</a>
<a href="#" className="text-slate-500 hover:text-blue-600 transition-colors">Cookies</a>
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