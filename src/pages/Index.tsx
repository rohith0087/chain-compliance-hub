import React, { useRef } from 'react';
import { motion, useScroll, useSpring } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, Users, BarChart3, CheckCircle, Settings, ArrowRight, Star, Globe, 
  Zap, Lock, Linkedin, Twitter, Youtube, Briefcase, Scale, Database, Quote
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import RegionSelector from '@/components/RegionSelector';

// --- Animation Variants ---
const fadeIn = (direction = 'up', delay = 0) => ({
  hidden: { y: direction === 'up' ? 20 : -20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.6, delay, ease: "easeOut" } }
});

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.2, delayChildren: 0.1 } }
};

// --- Reusable Animated Components ---
const AnimatedTitle = ({ text }) => (
  <motion.h1 variants={staggerContainer} initial="hidden" animate="visible" className="text-5xl md:text-7xl font-bold tracking-tighter mb-6">
    {text.split('\n').map((line, i) => (
      <span className="block" key={i}>
        {line.split(' ').map((word, j) => (
          <motion.span variants={fadeIn()} className="inline-block mr-4" key={j}>
            {word}
          </motion.span>
        ))}
      </span>
    ))}
  </motion.h1>
);

const AnimatedGridPattern = () => (
    <div className="absolute inset-0 z-0 h-full w-full bg-background bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:36px_36px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_60%,transparent_100%)]"></div>
);

const InfiniteLogos = () => {
    const clientLogos = ["GlobalFoods", "PharmaCore", "BuildRight", "Quantum Retail", "TransGlobal", "EcoProduce", "MedSupply"];
    const logos = [...clientLogos, ...clientLogos]; // Duplicate for seamless scroll
    return (
        <div className="w-full inline-flex flex-nowrap overflow-hidden [mask-image:_linear-gradient(to_right,transparent_0,_black_128px,_black_calc(100%-128px),transparent_100%)] mt-12">
            <ul className="flex items-center justify-center md:justify-start [&_li]:mx-8 [&_img]:max-w-none animate-infinite-scroll">
                {logos.map((logo, i) => (
                    <li key={i} className="text-muted-foreground text-xl font-medium">{logo}</li>
                ))}
            </ul>
        </div>
    );
};

// --- Workflow Step Component ---
const WorkflowStep = ({ icon: Icon, title, description, isLast }) => {
    const { ref, inView } = useInView({ threshold: 0.5, triggerOnce: true });
    return (
        <div ref={ref} className="flex gap-6 relative">
            <div className="flex flex-col items-center">
                <motion.div 
                    className="w-16 h-16 rounded-full border-2 border-primary/20 flex items-center justify-center bg-background z-10"
                    animate={{ scale: inView ? 1 : 0.5, opacity: inView ? 1 : 0 }}
                    transition={{ duration: 0.5, type: 'spring' }}
                >
                    <Icon className="w-8 h-8 text-primary"/>
                </motion.div>
                {!isLast && <div className="w-0.5 flex-1 bg-border/50"></div>}
            </div>
            <motion.div 
                className="pt-2 pb-16"
                variants={fadeIn('up', 0.2)}
                initial="hidden"
                animate={inView ? 'visible' : 'hidden'}
            >
                <h3 className="text-xl font-semibold mb-2">{title}</h3>
                <p className="text-muted-foreground">{description}</p>
            </motion.div>
        </div>
    );
}

// --- Main Index Component ---
const Index = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const isAdmin = profile?.roles?.includes('admin');
  
  const workflowRef = useRef(null);
  const { scrollYProgress } = useScroll({
      target: workflowRef,
      offset: ["start center", "end end"]
  });
  const scaleY = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  
  const { ref: sectionRef, inView } = useInView({ threshold: 0.1, triggerOnce: true });

  return (
    <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        {/* Header content remains the same */}
        </header>

      <main className="overflow-x-hidden">
        {/* --- Hero Section --- */}
        <section className="relative py-24 md:py-32 overflow-hidden">
          <AnimatedGridPattern />
          <motion.div 
            variants={staggerContainer} 
            initial="hidden" 
            animate="visible"
            className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center"
          >
            <motion.div variants={fadeIn()}>
              <Badge variant="secondary" className="mb-6 px-4 py-2 font-semibold">
                <Star className="w-4 h-4 mr-2 text-yellow-400" /> The Operating System for Enterprise Compliance
              </Badge>
            </motion.div>
            <AnimatedTitle text={`Automate Compliance,\nMitigate Supply Chain Risk`} />
            <motion.p variants={fadeIn('up', 0.4)} className="text-lg md:text-xl text-muted-foreground mb-12 max-w-3xl mx-auto">
              Unify documentation, automate verification, and gain real-time visibility across your entire supply chain with our AI-powered platform.
            </motion.p>
            <motion.div variants={fadeIn('up', 0.6)} className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="px-8 py-4 text-lg">
                Request a Demo <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
            <motion.div variants={fadeIn('up', 0.8)}>
                <p className="text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-24 mb-4">
                  TRUSTED BY FORWARD-THINKING ENTERPRISES
                </p>
                <InfiniteLogos />
            </motion.div>
          </motion.div>
        </section>

        {/* --- Animated Workflow Section --- */}
        <section className="py-24" ref={workflowRef}>
            <div className="max-w-screen-md mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-4xl font-bold tracking-tight">Your Journey From Chaos to Clarity</h2>
                    <p className="text-xl text-muted-foreground mt-4">Follow the path of your data as it's transformed into actionable compliance intelligence.</p>
                </div>
                <div className="relative">
                    <div className="absolute top-0 left-[31px] w-0.5 h-full bg-border/50 origin-top" >
                         <motion.div className="w-full h-full bg-primary" style={{ scaleY }}/>
                    </div>
                    <div className="space-y-4">
                        <WorkflowStep icon={Database} title="1. Unified Ingestion" description="Connect disparate data sources. Our platform ingests documents in any format—PDF, email, API calls—creating a single, structured foundation." />
                        <WorkflowStep icon={Zap} title="2. AI-Powered Validation" description="Our ComplianceAI™ engine digitizes, classifies, and verifies documents instantly, flagging risks and discrepancies before they become liabilities." />
                        <WorkflowStep icon={Shield} title="3. Continuous Monitoring" description="Go beyond static checks. Our system provides a live 360-degree view of your compliance posture, with real-time risk scoring and proactive alerts." />
                        <WorkflowStep icon={BarChart3} title="4. Actionable Intelligence" description="Generate audit-ready reports on demand. Empower stakeholders with customizable dashboards that turn complex compliance data into strategic insights." isLast />
                    </div>
                </div>
            </div>
        </section>
        
        {/* Other sections with entry animations */}
        <section ref={ref} className="py-24 bg-muted/30">
            {/* The rest of the sections (Solutions, Testimonials, Security, CTA, Footer) should be wrapped in motion.div similar to this one to trigger animations on view */}
            <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate={inView ? 'visible' : 'hidden'}
            >
              {/* For example, the Testimonials Section: */}
                <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
                    <motion.div variants={fadeIn()} className="text-center mb-16">
                      <h2 className="text-4xl font-bold tracking-tight">The Clear Choice for Industry Leaders</h2>
                      <p className="text-xl text-muted-foreground mt-4 max-w-2xl mx-auto">Hear how enterprises leverage ComplianceFlow to build resilient supply chains.</p>
                    </motion.div>
                    <div className="grid lg:grid-cols-3 gap-8">
                        {/* Map over testimonials, each card wrapped in motion.div */}
                        {[/* ...testimonials array */].map((testimonial, i) => (
                           <motion.div key={i} variants={fadeIn('up', i * 0.1)}>
                                <Card>...</Card>
                           </motion.div>
                        ))}
                    </div>
                </div>
            </motion.div>
        </section>

        {/* --- Animated Security Section --- */}
        <section className="py-24 relative overflow-hidden">
             <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                    <div>
                       {/* Text content */}
                    </div>
                    <div className="flex items-center justify-center p-8 h-80">
                        <div className="relative w-72 h-72">
                            <motion.div className="absolute top-1/2 left-1/2">
                                <Shield className="w-32 h-32 text-primary/20 -translate-x-1/2 -translate-y-1/2" />
                            </motion.div>
                            <motion.div
                                className="absolute w-16 h-16 flex items-center justify-center bg-background border rounded-full shadow-lg"
                                animate={{ rotate: 360, x: [0, 140, 0, -140, 0], y: [140, 0, -140, 0, 140] }}
                                transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                            ><Lock className="w-8 h-8 text-primary" /></motion.div>
                            <motion.div
                                className="absolute w-16 h-16 flex items-center justify-center bg-background border rounded-full shadow-lg"
                                animate={{ rotate: -360, x: [0, -100, 0, 100, 0], y: [-100, 0, 100, 0, -100] }}
                                transition={{ duration: 12, repeat: Infinity, ease: 'linear', delay: 3 }}
                            ><Globe className="w-8 h-8 text-primary" /></motion.div>
                             <motion.div
                                className="absolute w-16 h-16 flex items-center justify-center bg-background border rounded-full shadow-lg"
                                animate={{ rotate: 360, x: [60, -60, 60], y: [-60, 60, -60] }}
                                transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                            ><CheckCircle className="w-8 h-8 text-green-500" /></motion.div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
        {/* ... CTA, Footer */}
      </main>

      <RegionSelector />
    </div>
  );
};

export default Index;