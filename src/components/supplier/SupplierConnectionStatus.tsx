import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertTriangle, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SupplierConnectionStatusProps {
  status: string;
  showIcon?: boolean;
}

export const SupplierConnectionStatus: React.FC<SupplierConnectionStatusProps> = ({ 
  status, 
  showIcon = true 
}) => {
  const { t } = useTranslation('supplier');

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: t('connectionStatus.pending'),
          color: 'bg-warning/15 text-warning',
          icon: <Clock className="w-3 h-3" />
        };
      case 'approved':
        return {
          label: t('connectionStatus.approved'),
          color: 'bg-primary/15 text-primary',
          icon: <AlertTriangle className="w-3 h-3" />
        };
      case 'onboardingPending':
        return {
          label: t('connectionStatus.onboardingPending'),
          color: 'bg-warning/15 text-warning',
          icon: <Clock className="w-3 h-3" />
        };
      case 'fullyConnected':
        return {
          label: t('connectionStatus.fullyConnected'),
          color: 'bg-success/15 text-success',
          icon: <CheckCircle className="w-3 h-3" />
        };
      case 'rejected':
        return {
          label: t('connectionStatus.rejected'),
          color: 'bg-danger/15 text-danger',
          icon: <AlertTriangle className="w-3 h-3" />
        };
      default:
        return {
          label: status,
          color: 'bg-muted text-foreground',
          icon: <Users className="w-3 h-3" />
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <Badge variant="secondary" className={config.color}>
      {showIcon && config.icon}
      <span className={showIcon ? 'ml-1' : ''}>{config.label}</span>
    </Badge>
  );
};