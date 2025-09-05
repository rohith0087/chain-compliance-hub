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
          color: 'bg-yellow-100 text-yellow-800',
          icon: <Clock className="w-3 h-3" />
        };
      case 'approved':
        return {
          label: t('connectionStatus.approved'),
          color: 'bg-blue-100 text-blue-800',
          icon: <AlertTriangle className="w-3 h-3" />
        };
      case 'onboardingPending':
        return {
          label: t('connectionStatus.onboardingPending'),
          color: 'bg-orange-100 text-orange-800',
          icon: <Clock className="w-3 h-3" />
        };
      case 'fullyConnected':
        return {
          label: t('connectionStatus.fullyConnected'),
          color: 'bg-green-100 text-green-800',
          icon: <CheckCircle className="w-3 h-3" />
        };
      case 'rejected':
        return {
          label: t('connectionStatus.rejected'),
          color: 'bg-red-100 text-red-800',
          icon: <AlertTriangle className="w-3 h-3" />
        };
      default:
        return {
          label: status,
          color: 'bg-gray-100 text-gray-800',
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