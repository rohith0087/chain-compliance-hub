import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, FileCheck, Users, BarChart3, AlertTriangle, Clock, CheckCircle, 
  Building2, Settings, ArrowRight, Star, Globe, Zap, Lock, Mail, Phone, 
  MapPin, Linkedin, Twitter, Youtube, Briefcase, Scale, Gavel, GitBranch, Database
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import RegionSelector from '@/components/RegionSelector';

// Helper component for the animated background grid in the hero
const AnimatedGridPattern = () => (
  <div className="absolute inset-0 z-0 h-full w-full bg-background bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_60%,transparent_100%)]"></div>
);

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['home', 'common']);
  const { user, profile } = useAuth();
  
  const isAdmin = profile?.roles?.includes('admin');

  const clientLogos = [
    { name: "GlobalFoods Inc.", src: "https://via.placeholder.com/150x50/cccccc/000000?text=GlobalFoods" },
    { name: "PharmaCore", src: "https://via.placeholder.com/150x50/cccccc/000000?text=PharmaCore" },
    { name: "BuildRight", src: "https://via.placeholder.com/150x50/cccccc/000000?text=BuildRight" },
    { name: "Quantum Retail", src: "https://via.placeholder.com/150x50/cccccc/000000?text=Quantum+Retail" },
    { name: "TransGlobal Logistics", src: "https://via.placeholder.com/150x50/cccccc/000000?text=TransGlobal" },
  ];

  const solutionsByRole = [
    {
      role: t('home:solutions.procurement.role'),
      icon: Briefcase,
      title: t('home:solutions.procurement.title'),
      description: t('home:solutions.procurement.description'),
      benefits: [
        'Automated supplier onboarding', 'Real-time vendor risk scoring', 
        'Centralized documentation repository', 'Contract expiry alerts'
      ]
    },
    {
      role: t('home:solutions.quality.role'),
      icon: CheckCircle,
      title: t('home:solutions.quality.title'),
      description: t('home:solutions.quality.description'),
      benefits: [
        'Track certifications (ISO, GMP, etc.)', 'Manage non-conformance reports',
        'Automate audit preparation', 'Ensure batch traceability'
      ]
    },
    {
      role: t('home:solutions.legal.role'),
      icon: Scale,
      title: t('home:solutions.legal.title'),
      description: t('home:solutions.legal.description'),
      benefits: [
        'Monitor regulatory changes', 'Maintain an immutable audit trail',
        'Enforce data residency policies', 'Streamline e-discovery'
      ]
    },
  ];

  const testimonials = [
    {
      quote: "ComplianceFlow transformed our supplier verification process, cutting onboarding time by 60%. It’s the single source of truth for our entire global supply chain.",
      name: "Jane Doe",
      title: "VP of Supply Chain",
      company: "GlobalFoods Inc.",
      avatar: "https://i.pravatar.cc/150?u=a042581f4e29026704d"
    },
    {
      quote: "The audit trail and real-time compliance dashboards are game-changers. We passed our last regulatory audit with flying colors, saving hundreds of hours in preparation.",
      name: "John Smith",
      title: "Chief Compliance Officer",
      company: "PharmaCore",
      avatar: "https://i.pravatar.cc/150?u=a042581f4e29026705d"
    },
     {
      quote: "As a CISO, I'm deeply impressed by the platform's security architecture. The granular access controls and end-to-end encryption give us complete peace of mind.",
      name: "Emily White",
      title: "Chief Information Security Officer",
      company: "Quantum Retail",
      avatar: "https://i.pravatar.cc/150?u=a042581f4e29026706d"
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold">ComplianceFlow</h1>
            </div>
            <div className="flex items-center space-x-3">
              {user ? (
                <>
                  {isAdmin && (
                    <Button onClick={() => navigate('/admin')} variant="ghost" size="sm">
                      <Settings className="w-4 h-4 mr-2" /> Admin
                    </Button>
                  )}
                  <Button onClick={() => navigate('/dashboard')}>
                    Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => navigate('/auth/login')}>
                    {t('common:navigation.signIn')}
                  </Button>
                  <Button onClick={() => navigate('/auth/register')}>
                    Start Free Trial <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative py-24 md:py-32 overflow-hidden">
          <AnimatedGridPattern />
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center">
              <Badge variant="secondary" className="mb-6 px-4 py-2 font-semibold">
                <Star className="w-4 h-4 mr-2 text-yellow-400" />
                The Command Center for Enterprise Compliance
              </Badge>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6">
                {t('home:hero.title')}
                <span className="block bg-gradient-to-r from-primary via-blue-500 to-secondary bg-clip-text text-transparent">
                  {t('home:hero.subtitle')}
                </span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-3xl mx-auto">
                {t('home:hero.description')} Unify documentation, automate verification, and mitigate risk across your entire supply chain with our AI-powered platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" className="px-8 py-4 text-lg" onClick={() => navigate('/auth/register')}>
                  Request a Demo <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button variant="outline" size="lg" className="px-8 py-4 text-lg">
                  Explore Platform
                </Button>
              </div>
            </div>
          </div>
          {/* Client Logos */}
          <div className="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 mt-24">
            <p className="text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-8">
              Trusted by industry leaders to ensure global compliance
            </p>
            <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-8">
              {clientLogos.map(logo => (
                <img key={logo.name} src={logo.src} alt={logo.name} className="h-8 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all" />
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-24 bg-muted/30">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold tracking-tight">From Ingestion to Insight in 4 Steps</h2>
              <p className="text-xl text-muted-foreground mt-4 max-w-2xl mx-auto">
                Our streamlined process turns complex compliance data into actionable intelligence.
              </p>
            </div>
            <div className="grid md:grid-cols-4 gap-8 relative">
              {/* Dashed line connector for desktop */}
              <div className="hidden md:block absolute top-1/2 left-0 w-full h-px -translate-y-1/2">
                <svg width="100%" height="2">
                  <line x1="0" y1="1" x2="100%" y2="1" strokeWidth="2" strokeDasharray="8 8" className="stroke-border" />
                </svg>
              </div>
              
              {[
                { icon: Database, title: "1. Ingest & Digitize", description: "Aggregate documents from any source—email, ERP, or direct upload." },
                { icon: Zap, title: "2. Automate & Verify", description: "AI extracts key data, verifies authenticity, and flags discrepancies." },
                { icon: Shield, title: "3. Monitor & Alert", description: "Continuously track compliance status with real-time risk alerts." },
                { icon: BarChart3, title: "4. Report & Analyze", description: "Generate audit-ready reports and gain insights from custom dashboards." }
              ].map((step, index) => (
                 <div key={index} className="relative z-10 text-center p-6 bg-background rounded-lg border shadow-sm">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-background">
                    <step.icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Solutions by Role Section */}
        <section id="solutions" className="py-24">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold tracking-tight">Unlock Value Across Your Organization</h2>
              <p className="text-xl text-muted-foreground mt-4 max-w-2xl mx-auto">
                ComplianceFlow is designed to meet the unique needs of every team involved in the supply chain.
              </p>
            </div>
            <Tabs defaultValue={solutionsByRole[0].role} className="w-full">
              <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 mb-8">
                {solutionsByRole.map((solution) => (
                  <TabsTrigger key={solution.role} value={solution.role}>
                    <solution.icon className="w-5 h-5 mr-2"/> {solution.role}
                  </TabsTrigger>
                ))}
              </TabsList>
              {solutionsByRole.map((solution) => (
                <TabsContent key={solution.role} value={solution.role}>
                  <Card className="border-0 bg-muted/30 shadow-none">
                    <CardContent className="p-10 grid md:grid-cols-2 gap-8 items-center">
                      <div>
                        <h3 className="text-3xl font-bold mb-4">{solution.title}</h3>
                        <p className="text-muted-foreground text-lg mb-6">{solution.description}</p>
                        <div className="space-y-3">
                          {solution.benefits.map((benefit, i) => (
                            <div key={i} className="flex items-center">
                              <CheckCircle className="w-5 h-5 mr-3 text-primary flex-shrink-0" />
                              <span className="text-foreground">{benefit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg p-8 h-full flex items-center justify-center">
                         {/* Placeholder for a relevant graphic */}
                         <solution.icon className="w-32 h-32 text-primary opacity-20" />
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </section>
        
        {/* Testimonials Section */}
        <section className="py-24 bg-muted/30">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold tracking-tight">Don't Just Take Our Word For It</h2>
              <p className="text-xl text-muted-foreground mt-4 max-w-2xl mx-auto">
                Hear how leading enterprises leverage ComplianceFlow to build resilient and transparent supply chains.
              </p>
            </div>
            <div className="grid lg:grid-cols-3 gap-8">
              {testimonials.map((testimonial, index) => (
                <Card key={index} className="p-8 flex flex-col bg-background border shadow-lg">
                  <Star className="w-6 h-6 text-yellow-400 mb-4" />
                  <blockquote className="text-lg text-foreground flex-grow">"{testimonial.quote}"</blockquote>
                  <div className="mt-8 flex items-center">
                    <Avatar>
                      <AvatarImage src={testimonial.avatar} alt={testimonial.name} />
                      <AvatarFallback>{testimonial.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="ml-4">
                      <p className="font-semibold">{testimonial.name}</p>
                      <p className="text-sm text-muted-foreground">{testimonial.title}, {testimonial.company}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 z-0 opacity-5 bg-[radial-gradient(#d1d5db_1px,transparent_1px)] [background-size:24px_24px]"></div>
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <Badge variant="outline" className="mb-4">Enterprise Grade</Badge>
                <h2 className="text-4xl font-bold tracking-tight">Fortress-Grade Security & Compliance</h2>
                <p className="text-xl text-muted-foreground mt-4 mb-8">
                  Your data's integrity and security are our top priority. Our platform is built on a zero-trust architecture and complies with the strictest global standards.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {['SOC 2 Type II Certified', 'GDPR & CCPA Ready', 'End-to-End Encryption', 'Regular Penetration Testing'].map(item => (
                    <div key={item} className="flex items-center">
                      <CheckCircle className="w-5 h-5 mr-2 text-green-500" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-center">
                <div className="p-8 bg-background border rounded-xl shadow-2xl">
                  <Lock className="w-16 h-16 text-primary mx-auto mb-4" />
                  <Globe className="w-24 h-24 text-primary/50 mx-auto" />
                  <Shield className="w-16 h-16 text-primary mx-auto mt-4" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-gradient-to-r from-primary to-secondary text-primary-foreground">
          <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
            <h2 className="text-4xl font-bold mb-6">Ready to Revolutionize Your Compliance?</h2>
            <p className="text-xl opacity-80 mb-12">
              Join hundreds of enterprises building more resilient, transparent, and compliant supply chains. Schedule a personalized demo today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" variant="secondary" className="px-8 py-4 text-lg font-semibold">
                Schedule a Demo <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button variant="outline" size="lg" className="px-8 py-4 text-lg border-primary-foreground/20 hover:bg-primary-foreground/10">
                Contact Sales
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-background border-t py-16">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-5 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-bold">ComplianceFlow</h3>
              </div>
              <p className="text-muted-foreground mb-6">The operating system for modern supply chain compliance.</p>
              <div className="flex space-x-4">
                {[Linkedin, Twitter, Youtube].map((Icon, i) => (
                  <Button key={i} variant="ghost" size="icon" asChild>
                    <a href="#" aria-label="Social Media"><Icon className="w-5 h-5 text-muted-foreground" /></a>
                  </Button>
                ))}
              </div>
            </div>
            
            {[{title: "Solutions", links: ['For Procurement', 'For Quality', 'For Legal']},
              {title: "Resources", links: ['Blog', 'Case Studies', 'API Docs']},
              {title: "Company", links: ['About Us', 'Careers', 'Contact']}].map(col => (
              <div key={col.title}>
                <h4 className="font-semibold text-foreground mb-4">{col.title}</h4>
                <ul className="space-y-3">
                  {col.links.map(link => (
                    <li key={link}><a href="#" className="text-muted-foreground hover:text-foreground transition-colors">{link}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} TraceR2C LLC. All rights reserved.</p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="#" className="hover:text-foreground">Privacy Policy</a>
              <a href="#" className="hover:text-foreground">Terms of Service</a>
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