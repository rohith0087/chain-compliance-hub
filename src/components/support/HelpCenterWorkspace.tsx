import { useState, useEffect } from 'react';
import { HelpCircle, Plus, Filter, Ticket, Play, X, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TicketSubmissionModal } from './TicketSubmissionModal';
import { TicketCard } from './TicketCard';
import { TicketDetailPanel } from './TicketDetailPanel';
import { useUserSupportTickets, type UserSupportTicket } from '@/hooks/useUserSupportTickets';
import { useTour } from './TourProvider';
import { getToursByUserType } from '@/config/supportTours';
import type { HelpButtonUser } from './HelpButton';
import { cn } from '@/lib/utils';

interface HelpCenterWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  source: 'buyer_portal' | 'supplier_portal' | 'login_page';
  user?: HelpButtonUser;
}

export const HelpCenterWorkspace = ({ isOpen, onClose, source, user }: HelpCenterWorkspaceProps) => {
  const [activeTab, setActiveTab] = useState<'tickets' | 'guides'>('tickets');
  const [showClosed, setShowClosed] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<UserSupportTicket | null>(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  
  const { tickets, loading, unreadCount, markTicketAsRead } = useUserSupportTickets(
    showClosed ? 'all' : 'active'
  );
  
  const { startTour } = useTour();
  
  const showGuidedTours = source !== 'login_page';
  const filteredTours = showGuidedTours 
    ? getToursByUserType(source === 'buyer_portal' ? 'buyer' : 'supplier')
    : [];

  // Handle ticket selection and mark as read
  const handleSelectTicket = async (ticket: UserSupportTicket) => {
    setSelectedTicket(ticket);
    if (ticket.has_unread_response) {
      await markTicketAsRead(ticket.id);
    }
  };

  const handleStartTour = (tourId: string) => {
    onClose();
    setTimeout(() => startTour(tourId), 300);
  };

  // Reset selected ticket when closing
  useEffect(() => {
    if (!isOpen) {
      setSelectedTicket(null);
    }
  }, [isOpen]);

  const activeTickets = tickets.filter(t => !['resolved', 'closed'].includes(t.status));
  const closedTickets = tickets.filter(t => ['resolved', 'closed'].includes(t.status));
  const displayTickets = showClosed ? tickets : activeTickets;

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent 
          className={cn(
            'p-0 flex flex-col [&>button.absolute]:hidden',
            selectedTicket ? 'sm:max-w-3xl' : 'sm:max-w-md'
          )}
          style={{ width: selectedTicket ? '48rem' : '28rem', maxWidth: '100vw' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-background">
            <div className="flex items-center gap-2">
              {selectedTicket && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 mr-1"
                  onClick={() => setSelectedTicket(null)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              <HelpCircle className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Help Center</h2>
              <Badge variant="outline" className="text-xs font-normal">
                {source === 'buyer_portal' ? 'Buyer' : source === 'supplier_portal' ? 'Supplier' : 'Guest'}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              {!selectedTicket && user?.id && (
                <Button
                  size="sm"
                  onClick={() => setIsTicketModalOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Ticket
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Left panel: Ticket list */}
            <div className={cn(
              'flex flex-col border-r transition-all duration-200 min-h-0',
              selectedTicket ? 'w-80 flex-shrink-0' : 'flex-1'
            )}>
              {showGuidedTours ? (
                <Tabs 
                  value={activeTab} 
                  onValueChange={(v) => setActiveTab(v as 'tickets' | 'guides')}
                  className="flex flex-col flex-1 min-h-0"
                >
                  <TabsList className="grid w-full grid-cols-2 mx-4 mt-3" style={{ width: 'calc(100% - 32px)' }}>
                    <TabsTrigger value="tickets" className="flex items-center gap-1.5 text-xs">
                      <Ticket className="h-3.5 w-3.5" />
                      My Tickets
                      {unreadCount > 0 && (
                        <Badge variant="default" className="h-4 min-w-4 px-1 text-[10px]">
                          {unreadCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="guides" className="flex items-center gap-1.5 text-xs">
                      <Play className="h-3.5 w-3.5" />
                      Guides
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="tickets" className="flex-1 flex flex-col mt-0 min-h-0">
                    <TicketListContent
                      tickets={displayTickets}
                      loading={loading}
                      showClosed={showClosed}
                      onToggleShowClosed={setShowClosed}
                      closedCount={closedTickets.length}
                      selectedTicketId={selectedTicket?.id}
                      onSelectTicket={handleSelectTicket}
                      onCreateNew={() => setIsTicketModalOpen(true)}
                      isLoggedIn={!!user?.id}
                    />
                  </TabsContent>

                  <TabsContent value="guides" className="flex-1 flex flex-col mt-0 min-h-0">
                    <GuidedToursContent
                      tours={filteredTours}
                      onStartTour={handleStartTour}
                    />
                  </TabsContent>
                </Tabs>
              ) : (
                <TicketListContent
                  tickets={displayTickets}
                  loading={loading}
                  showClosed={showClosed}
                  onToggleShowClosed={setShowClosed}
                  closedCount={closedTickets.length}
                  selectedTicketId={selectedTicket?.id}
                  onSelectTicket={handleSelectTicket}
                  onCreateNew={() => setIsTicketModalOpen(true)}
                  isLoggedIn={!!user?.id}
                />
              )}
            </div>

            {/* Right panel: Ticket detail */}
            {selectedTicket && (
              <div className="flex-1 min-w-0">
                <TicketDetailPanel ticket={selectedTicket} />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <TicketSubmissionModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        source={source}
        user={user}
      />
    </>
  );
};

// Ticket list content component
interface TicketListContentProps {
  tickets: UserSupportTicket[];
  loading: boolean;
  showClosed: boolean;
  onToggleShowClosed: (show: boolean) => void;
  closedCount: number;
  selectedTicketId?: string;
  onSelectTicket: (ticket: UserSupportTicket) => void;
  onCreateNew: () => void;
  isLoggedIn: boolean;
}

const TicketListContent = ({
  tickets,
  loading,
  showClosed,
  onToggleShowClosed,
  closedCount,
  selectedTicketId,
  onSelectTicket,
  onCreateNew,
  isLoggedIn,
}: TicketListContentProps) => (
  <div className="flex flex-col flex-1 min-h-0">
    {/* Filter row */}
    {isLoggedIn && (
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <Switch
            id="show-closed"
            checked={showClosed}
            onCheckedChange={onToggleShowClosed}
            className="scale-75"
          />
          <Label htmlFor="show-closed" className="text-xs text-muted-foreground cursor-pointer">
            Show closed ({closedCount})
          </Label>
        </div>
      </div>
    )}

    {/* Ticket list */}
    <ScrollArea className="flex-1">
      <div className="p-3 space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 rounded-lg border">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))
        ) : !isLoggedIn ? (
          <div className="text-center py-12 px-4">
            <Ticket className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              Sign in to view and manage your support tickets.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={onCreateNew}
            >
              Submit a Ticket
            </Button>
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Ticket className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              {showClosed ? 'No tickets found.' : 'No active tickets.'}
            </p>
            <p className="text-xs text-muted-foreground/70">
              {showClosed 
                ? "You haven't submitted any tickets yet." 
                : 'All your issues have been resolved!'}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={onCreateNew}
            >
              Create New Ticket
            </Button>
          </div>
        ) : (
          tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              isSelected={ticket.id === selectedTicketId}
              onClick={() => onSelectTicket(ticket)}
            />
          ))
        )}
      </div>
    </ScrollArea>
  </div>
);

// Guided tours content component
interface GuidedToursContentProps {
  tours: any[];
  onStartTour: (tourId: string) => void;
}

const GuidedToursContent = ({ tours, onStartTour }: GuidedToursContentProps) => (
  <div className="flex flex-col flex-1 min-h-0">
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-3">
        <p className="text-sm text-muted-foreground mb-4">
          Select a guided tour to learn how to use different features.
        </p>
        {tours.length > 0 ? (
          tours.map((tour) => (
            <div
              key={tour.id}
              className="p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors group"
              onClick={() => onStartTour(tour.id)}
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
          ))
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            No guided tours available for this section.
          </p>
        )}
      </div>
    </ScrollArea>
  </div>
);
