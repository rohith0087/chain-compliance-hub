import React, { useState } from 'react';
import { HelpCircle, Play, Ticket, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useSimulation } from '@/contexts/SimulationContext';
import { motion } from 'framer-motion';

export const SimulationHelpButton = () => {
  const [activeTab, setActiveTab] = useState('guides');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');
  const { showHelpCenter, setShowHelpCenter, currentStep, completeHelpExploration } = useSimulation();

  const isHelpStep = currentStep === 'explore-help';

  const simulatedTours = [
    { id: 'getting-started', name: 'Getting Started', description: 'Learn the basics of the supplier portal', steps: 5 },
    { id: 'document-management', name: 'Document Management', description: 'How to upload and manage documents', steps: 4 },
    { id: 'buyer-connections', name: 'Buyer Connections', description: 'Connect and communicate with buyers', steps: 3 },
  ];

  const handleSubmitTicket = () => {
    if (!ticketSubject.trim()) return;
    
    setTicketSubject('');
    setTicketDescription('');
    
    if (isHelpStep) {
      completeHelpExploration();
    } else {
      setShowHelpCenter(false);
    }
  };

  return (
    <>
      <motion.div
        animate={isHelpStep ? { scale: [1, 1.1, 1] } : {}}
        transition={{ repeat: isHelpStep ? Infinity : 0, duration: 1.5 }}
      >
        <Button
          onClick={() => setShowHelpCenter(true)}
          size="icon"
          className={`fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg border-0 ${
            isHelpStep 
              ? 'bg-green-500 hover:bg-green-600 ring-4 ring-green-300 animate-pulse' 
              : 'bg-primary hover:bg-primary/90'
          }`}
        >
          <HelpCircle className="h-6 w-6 text-white" />
        </Button>
      </motion.div>

      {isHelpStep && !showHelpCenter && (
        <div className="fixed bottom-20 right-6 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg animate-bounce">
          <p className="text-sm font-medium">👆 Click here to explore!</p>
        </div>
      )}

      <Sheet open={showHelpCenter} onOpenChange={setShowHelpCenter}>
        <SheetContent className="w-[400px] sm:w-[540px] p-0">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Help Center
              <Badge variant="outline" className="text-xs">Simulation</Badge>
            </SheetTitle>
          </SheetHeader>

          {isHelpStep && (
            <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 font-medium">
                🎯 Final Step: Explore the Help Center and submit a demo ticket to complete the simulation!
              </p>
            </div>
          )}
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-[calc(100%-80px)]">
            <TabsList className="grid w-full grid-cols-2 mx-6 mt-4" style={{ width: 'calc(100% - 48px)' }}>
              <TabsTrigger value="guides" className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Guided Tours
              </TabsTrigger>
              <TabsTrigger value="ticket" className="flex items-center gap-2">
                <Ticket className="h-4 w-4" />
                Submit Ticket
              </TabsTrigger>
            </TabsList>

            <TabsContent value="guides" className="flex-1 mt-0 px-6 py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Select a guided tour to learn how to use different features.
              </p>
              <div className="space-y-3">
                {simulatedTours.map((tour) => (
                  <div
                    key={tour.id}
                    className="p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => {
                      setShowHelpCenter(false);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-sm">{tour.name}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{tour.description}</p>
                      </div>
                      <Button size="sm" variant="ghost">
                        <Play className="h-4 w-4 mr-1" />
                        Start
                      </Button>
                    </div>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {tour.steps} steps
                    </Badge>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="ticket" className="flex-1 mt-0 px-6 py-4">
              <p className="text-sm text-muted-foreground mb-4">
                Need help? Submit a support ticket and our team will respond.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Subject</label>
                  <Input
                    placeholder="What do you need help with?"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Describe your issue or question..."
                    value={ticketDescription}
                    onChange={(e) => setTicketDescription(e.target.value)}
                    className="mt-1"
                    rows={4}
                  />
                </div>
                <Button 
                  onClick={handleSubmitTicket} 
                  className="w-full gap-2"
                  disabled={!ticketSubject.trim()}
                >
                  <Ticket className="h-4 w-4" />
                  {isHelpStep ? 'Submit & Complete Simulation' : 'Submit Ticket (Demo)'}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  This is a simulation - no actual ticket will be created.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
};
