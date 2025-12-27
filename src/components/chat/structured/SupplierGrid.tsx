import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building2, Mail, Phone, MapPin, Factory, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface Entity {
  id: string;
  name?: string;
  email?: string;
  industry?: string;
  status?: string;
  address?: string;
  phone?: string;
  compliance_score?: string;
}

interface SupplierGridProps {
  entities: Entity[];
  entityType: string;
  count: number;
  onEmailClick?: (entity: Entity) => void;
  onViewDetails?: (entity: Entity) => void;
}

const getStatusIcon = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'approved':
    case 'active':
      return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    case 'pending':
    case 'pending_review':
      return <Clock className="w-4 h-4 text-amber-500" />;
    case 'rejected':
    case 'inactive':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
};

const getStatusBadgeClass = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'approved':
    case 'active':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
    case 'pending':
    case 'pending_review':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-800';
    case 'rejected':
    case 'inactive':
      return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-800';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
};

export const SupplierGrid: React.FC<SupplierGridProps> = ({ entities, entityType, count, onEmailClick, onViewDetails }) => {
  const title = entityType === 'suppliers' ? 'Suppliers' : 
                entityType === 'buyers' ? 'Buyers' : 
                'Entities';
  
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-foreground">
        <Building2 className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-lg">
          Your {title} ({count} total)
        </h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entities.map((entity, index) => (
          <Card 
            key={entity.id || index} 
            className="p-4 hover:shadow-lg transition-all duration-200 border-l-4 border-l-primary/50 bg-card"
          >
            <div className="space-y-3">
              {/* Header with name and status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground line-clamp-1">
                      {entity.name || 'Unknown'}
                    </h4>
                    {entity.industry && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Factory className="w-3 h-3" />
                        <span>{entity.industry}</span>
                      </div>
                    )}
                  </div>
                </div>
                {entity.status && (
                  <Badge variant="outline" className={`${getStatusBadgeClass(entity.status)} capitalize shrink-0`}>
                    {getStatusIcon(entity.status)}
                    <span className="ml-1">{entity.status.replace('_', ' ')}</span>
                  </Badge>
                )}
              </div>
              
              {/* Contact info */}
              <div className="space-y-1.5 text-sm">
                {entity.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4 shrink-0" />
                    <span className="truncate">{entity.email}</span>
                  </div>
                )}
                {entity.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>{entity.phone}</span>
                  </div>
                )}
                {entity.address && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 shrink-0" />
                    <span className="line-clamp-1">{entity.address}</span>
                  </div>
                )}
              </div>
              
              {/* Compliance score if available */}
              {entity.compliance_score && (
                <div className="pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Compliance</span>
                    <span className="font-medium text-foreground">{entity.compliance_score}%</span>
                  </div>
                  <div className="mt-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(100, parseInt(entity.compliance_score) || 0)}%` }}
                    />
                  </div>
                </div>
              )}
              
              {/* Quick actions */}
              <div className="pt-2 flex gap-2">
                {entity.email && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 text-xs"
                    onClick={() => onEmailClick?.(entity)}
                  >
                    <Mail className="w-3 h-3 mr-1" />
                    Email
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="flex-1 text-xs"
                  onClick={() => onViewDetails?.(entity)}
                >
                  View Details
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SupplierGrid;
