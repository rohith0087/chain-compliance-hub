import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Building2, 
  MapPin, 
  Mail, 
  Phone, 
  Calendar,
  CheckCircle2,
  X,
  Clock,
  Users
} from 'lucide-react';
import { useSimulation } from '@/contexts/SimulationContext';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

export const SimulationConnectionCard = () => {
  const { 
    getConnectionRequest, 
    connectionStatus, 
    acceptConnection 
  } = useSimulation();

  const connectionRequest = getConnectionRequest();
  const buyer = connectionRequest.buyer;

  if (connectionStatus !== 'pending') {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="simulation-connection-card"
    >
      <Card className="border-2 border-primary/30 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 bg-primary/10">
                <AvatarFallback className="text-primary font-semibold">
                  {buyer.company_name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {buyer.company_name}
                  <Badge variant="secondary" className="text-xs">
                    DEMO
                  </Badge>
                </CardTitle>
                <CardDescription className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {buyer.industry}
                </CardDescription>
              </div>
            </div>
            <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
              <Clock className="h-3 w-3 mr-1" />
              Pending
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{buyer.city}, {buyer.state}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="truncate">{buyer.contact_email}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{buyer.phone}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{formatDistanceToNow(new Date(connectionRequest.requested_at), { addSuffix: true })}</span>
            </div>
          </div>

          {connectionRequest.notes && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground italic">
                "{connectionRequest.notes}"
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button 
              onClick={acceptConnection}
              className="flex-1 gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              Accept Connection
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 gap-2 text-destructive hover:text-destructive"
              disabled
            >
              <X className="h-4 w-4" />
              Decline
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            <Users className="h-3 w-3 inline mr-1" />
            Accepting will start the onboarding process
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
};
