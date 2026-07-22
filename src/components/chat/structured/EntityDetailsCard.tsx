import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, AlertTriangle, CheckCircle2, Clock, Info } from 'lucide-react';

interface Field {
  label: string;
  value: string;
  status?: string;
}

interface EntityDetailsCardProps {
  fields: Field[];
}

const getStatusIcon = (status?: string) => {
  switch (status?.toLowerCase()) {
    case 'success':
    case 'good':
    case 'approved':
      return <CheckCircle2 className="w-4 h-4 text-success" />;
    case 'warning':
    case 'action_required':
      return <AlertTriangle className="w-4 h-4 text-warning" />;
    case 'error':
    case 'high':
    case 'critical':
      return <AlertTriangle className="w-4 h-4 text-danger" />;
    case 'pending':
      return <Clock className="w-4 h-4 text-warning" />;
    default:
      return <Info className="w-4 h-4 text-muted-foreground" />;
  }
};

const getStatusClass = (status?: string) => {
  switch (status?.toLowerCase()) {
    case 'success':
    case 'good':
    case 'approved':
      return 'text-success';
    case 'warning':
    case 'action_required':
      return 'text-warning';
    case 'error':
    case 'high':
    case 'critical':
      return 'text-danger';
    default:
      return 'text-foreground';
  }
};

export const EntityDetailsCard: React.FC<EntityDetailsCardProps> = ({ fields }) => {
  return (
    <Card className="p-4 border-l-4 border-l-primary bg-card">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-lg text-foreground">Entity Details</h3>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((field, index) => (
          <div 
            key={index} 
            className="flex flex-col space-y-1 p-3 rounded-lg bg-muted/50"
          >
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {field.label}
            </span>
            <div className="flex items-center gap-2">
              {field.status && getStatusIcon(field.status)}
              <span className={`font-medium ${getStatusClass(field.status)}`}>
                {field.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default EntityDetailsCard;
