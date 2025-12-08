import { useState } from 'react';
import { HelpCircle, MessageCircle, Ticket, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TicketSubmissionModal } from './TicketSubmissionModal';
import { useTour } from './TourProvider';
import { supportTours, findTourByKeywords } from '@/config/supportTours';

export interface HelpButtonUser {
  id?: string;
  email?: string;
  name?: string;
  companyId?: string;
  companyName?: string;
  userType?: 'buyer' | 'supplier' | 'guest';
}

interface HelpButtonProps {
  source: 'buyer_portal' | 'supplier_portal' | 'login_page';
  user?: HelpButtonUser;
}

export const HelpButton = ({ source, user }: HelpButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const { startTour, isRunning } = useTour();

  const handleStartTour = (tourId: string) => {
    setIsOpen(false);
    // Small delay to allow sheet to close
    setTimeout(() => {
      startTour(tourId);
    }, 300);
  };

  // Don't show button during tour
  if (isRunning) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        size="icon"
        variant="outline"
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 border-0"
        aria-label="Get Help"
      >
        <HelpCircle className="h-6 w-6" />
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] p-0">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Help Center
            </SheetTitle>
          </SheetHeader>
          
          <Tabs defaultValue="guides" className="flex flex-col h-[calc(100%-80px)]">
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

            <TabsContent value="guides" className="flex-1 mt-0">
              <ScrollArea className="h-[calc(100vh-220px)] px-6 py-4">
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-4">
                    Select a guided tour to learn how to use different features of the platform.
                  </p>
                  {supportTours.map((tour) => (
                    <div
                      key={tour.id}
                      className="p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors group"
                      onClick={() => handleStartTour(tour.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{tour.name}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {tour.description}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Start
                        </Button>
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="bg-muted px-2 py-0.5 rounded">
                          {tour.steps.length} steps
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="ticket" className="flex-1 mt-0 px-6 py-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Can't find what you're looking for? Submit a support ticket and our team will get back to you.
                </p>
                <Button
                  onClick={() => {
                    setIsOpen(false);
                    setIsTicketOpen(true);
                  }}
                  className="w-full"
                >
                  <Ticket className="h-4 w-4 mr-2" />
                  Open Ticket Form
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <TicketSubmissionModal
        isOpen={isTicketOpen}
        onClose={() => setIsTicketOpen(false)}
        source={source}
        user={user}
      />
    </>
  );
};
