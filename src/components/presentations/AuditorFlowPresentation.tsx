import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, FileSearch, Send, FileCheck2, Cpu, CheckCircle2, RotateCcw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PresentationProps {
  onClose: () => void;
}

const SLIDES = [
  {
    id: 'intro',
    title: 'TraceR2C Chain Compliance Hub',
    subtitle: 'What We Do & What We Offer',
    content: () => (
      <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-accent to-blue-600 flex items-center justify-center shadow-2xl shadow-accent/20 mb-4">
          <FileCheck2 className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-5xl md:text-7xl font-display font-semibold tracking-tight text-foreground">
          Streamlining the <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-500">Audit Process</span>
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-3xl">
          We empower auditing firms with intelligent tools to seamlessly handle desk audits, document collection, and AI-driven insights before you ever step foot on-site.
        </p>
      </div>
    )
  },
  {
    id: 'flow-diagram',
    title: 'End-to-End Workflow',
    subtitle: 'The Big Picture',
    content: () => (
      <div className="flex flex-col items-center w-full max-w-6xl mx-auto">
        <h2 className="text-4xl font-display font-semibold mb-16 text-center">Seamless Audit Journey</h2>
        <div className="flex flex-col md:flex-row items-center justify-between w-full gap-4 md:gap-0 relative">
          {/* Connector Line (visible on md+) */}
          <div className="hidden md:block absolute top-1/2 left-10 right-10 h-1 bg-border -z-10 -translate-y-1/2" />
          
          {[
            { step: '1', title: 'Desk Audit', desc: 'Initiate Request' },
            { step: '2', title: 'Collection', desc: 'Client Submits Docs' },
            { step: '3', title: 'Review Loop', desc: 'Approve / Reject' },
            { step: '4', title: 'AI Assistant', desc: 'Correlate Data' },
            { step: '5', title: 'On-Site', desc: 'Physical Audit' }
          ].map((item, i, arr) => (
            <React.Fragment key={i}>
              <div className="relative group bg-card border border-border shadow-lg rounded-2xl p-6 flex flex-col items-center w-48 text-center hover:-translate-y-2 transition-transform duration-300 z-10">
                <div className="w-10 h-10 rounded-full bg-accent/10 text-accent font-bold flex items-center justify-center mb-4 border border-accent/20">
                  {item.step}
                </div>
                <div className="font-semibold text-foreground mb-1">{item.title}</div>
                <div className="text-sm text-muted-foreground">{item.desc}</div>
              </div>
              {i < arr.length - 1 && (
                <div className="md:hidden py-2">
                  <ArrowRight className="w-6 h-6 text-muted-foreground rotate-90" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    )
  },
  {
    id: 'desk-audit',
    title: 'It\'s Audit Time',
    subtitle: 'Step 1: The Desk Audit',
    content: () => (
      <div className="flex flex-col items-center w-full max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <Badge variant="outline" className="border-accent text-accent px-3 py-1 text-sm uppercase tracking-widest font-semibold">Initiate</Badge>
            <h2 className="text-4xl font-display font-semibold">Start with a Desk Audit</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              When it's audit time, everything begins remotely. You need to collect critical documents—GMP manuals, SOPs, and hygiene records—from your clients.
            </p>
            <ul className="space-y-4 pt-4">
              {[
                "Request specific document sets from suppliers",
                "Track submission status in real-time",
                "Automated reminders for missing documents"
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-foreground/80">
                  <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  <span className="text-lg">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-accent/5 rounded-3xl blur-3xl" />
            <div className="relative bg-card border border-border shadow-2xl rounded-3xl p-8 flex flex-col items-center text-center gap-6">
              <div className="p-4 bg-accent/10 rounded-full">
                <FileSearch className="w-10 h-10 text-accent" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Document Collection</h3>
                <p className="text-muted-foreground">Suppliers receive your request and securely upload their manuals and records directly to the hub.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'review-loop',
    title: 'Send, Review, Approve',
    subtitle: 'Step 2: The Document Loop',
    content: () => (
      <div className="flex flex-col items-center w-full max-w-5xl mx-auto">
        <div className="w-full flex flex-col items-center gap-12">
          <p className="text-xl text-muted-foreground text-center max-w-2xl">
            Clients send their documents for review. You can instantly approve them or reject them with specific notes, prompting the client to resend.
          </p>
          
          <div className="flex flex-col md:flex-row items-center gap-8 w-full justify-center mt-8">
            {/* Client Side */}
            <div className="bg-card border border-border shadow-lg rounded-2xl p-6 flex flex-col items-center w-64 text-center">
              <Send className="w-8 h-8 text-blue-500 mb-4" />
              <div className="font-medium text-lg">Client Sends Docs</div>
            </div>

            {/* Arrows */}
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="h-px w-16 bg-border" />
                <span className="uppercase text-xs font-semibold tracking-widest">Review</span>
                <span className="h-px w-16 bg-border" />
              </div>
              <RotateCcw className="w-5 h-5 text-orange-500/50" />
            </div>

            {/* Auditor Side */}
            <div className="bg-card border border-border shadow-lg rounded-2xl p-6 flex flex-col items-center w-64 text-center">
              <FileSearch className="w-8 h-8 text-accent mb-4" />
              <div className="font-medium text-lg mb-4">Auditor Review</div>
              <div className="flex gap-2 w-full">
                <div className="flex-1 bg-green-500/10 text-green-600 rounded p-2 text-sm font-medium border border-green-500/20">Approve</div>
                <div className="flex-1 bg-red-500/10 text-red-600 rounded p-2 text-sm font-medium border border-red-500/20">Reject</div>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground font-medium italic mt-4">
            * If rejected, the client is notified to fix and resend the document.
          </p>
        </div>
      </div>
    )
  },
  {
    id: 'audit-assistant',
    title: 'Audit Assistant',
    subtitle: 'Step 3: Seamless Correlation',
    content: () => (
      <div className="flex flex-col items-center w-full max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="relative order-2 md:order-1">
            <div className="absolute inset-0 bg-purple-500/5 rounded-3xl blur-3xl" />
            <div className="relative bg-card border border-border shadow-2xl rounded-3xl p-8 flex flex-col gap-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 rounded-xl">
                  <Cpu className="w-6 h-6 text-purple-500" />
                </div>
                <div className="font-semibold text-lg">AI Contextual Analysis</div>
              </div>
              <div className="space-y-3">
                <div className="h-2 w-3/4 bg-muted rounded-full" />
                <div className="h-2 w-full bg-muted rounded-full" />
                <div className="h-2 w-5/6 bg-muted rounded-full" />
              </div>
              <div className="bg-accent/10 border border-accent/20 text-accent p-4 rounded-xl text-sm font-medium">
                "Noticed a gap in pest control SOP vs last year's records. Recommend checking station #4 during physical audit."
              </div>
            </div>
          </div>
          <div className="space-y-6 order-1 md:order-2">
            <Badge variant="outline" className="border-purple-500 text-purple-500 px-3 py-1 text-sm uppercase tracking-widest font-semibold">The Edge</Badge>
            <h2 className="text-4xl font-display font-semibold">Correlate Corner Cases</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Use our AI-powered Audit Assistant to seamlessly analyze all collected documents before the physical audit. 
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed">
              It identifies missing information, cross-references records year-over-year, and highlights corner cases so you can focus on what matters most on-site for the best results.
            </p>
          </div>
        </div>
      </div>
    )
  }
];

import { createPortal } from 'react-dom';

export function AuditorFlowPresentation({ onClose }: PresentationProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  const nextSlide = () => {
    if (currentIndex < SLIDES.length - 1) {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.95
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: "spring" as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.4 },
        scale: { duration: 0.4 }
      }
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? 1000 : -1000,
      opacity: 0,
      scale: 0.95,
      transition: {
        x: { type: "spring" as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.4 },
        scale: { duration: 0.4 }
      }
    })
  };

  const currentSlide = SLIDES[currentIndex];

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-xl flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between p-6 md:p-8 relative z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <FileCheck2 className="w-5 h-5 text-accent" />
          </div>
          <span className="font-display font-semibold text-lg tracking-tight">TraceR2C</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex gap-1.5 mr-4">
            {SLIDES.map((_, i) => (
              <div 
                key={i} 
                className={`h-1.5 rounded-full transition-all duration-500 ${i === currentIndex ? 'w-8 bg-accent' : 'w-2 bg-muted'}`} 
              />
            ))}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-muted">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative flex items-center justify-center px-6 md:px-16 pb-24">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full h-full flex flex-col justify-center items-center absolute inset-0"
          >
            {/* Optional Slide Header */}
            {currentIndex > 0 && (
              <div className="text-center mb-12">
                <h3 className="text-accent font-semibold tracking-widest uppercase text-sm mb-2">
                  {currentSlide.subtitle}
                </h3>
              </div>
            )}
            
            {currentSlide.content()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer Navigation */}
      <footer className="absolute bottom-0 inset-x-0 p-6 md:p-10 flex justify-between items-center bg-gradient-to-t from-background via-background to-transparent z-50">
        <Button 
          variant="outline" 
          size="lg"
          onClick={prevSlide} 
          disabled={currentIndex === 0}
          className="rounded-full px-6 shadow-sm disabled:opacity-30"
        >
          <ChevronLeft className="w-5 h-5 mr-2" />
          Previous
        </Button>
        
        <div className="text-sm font-medium text-muted-foreground hidden sm:block">
          {currentIndex + 1} / {SLIDES.length}
        </div>

        <Button 
          variant="default" 
          size="lg"
          onClick={nextSlide} 
          disabled={currentIndex === SLIDES.length - 1}
          className="rounded-full px-6 shadow-md disabled:opacity-30"
        >
          Next
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </footer>
    </div>,
    document.body
  );
}
