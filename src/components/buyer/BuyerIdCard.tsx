import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Eye, EyeOff, Info, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { InviteSupplierModal } from './InviteSupplierModal';
import { useTranslation } from 'react-i18next';

interface BuyerIdCardProps {
  buyerId: string;
  buyerProfile?: {
    company_name: string;
    contact_email: string;
    industry?: string;
  };
  userProfile?: {
    full_name: string;
  };
}

export const BuyerIdCard = ({ buyerId, buyerProfile, userProfile }: BuyerIdCardProps) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showId, setShowId] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buyerId);
      setCopied(true);
      toast.success(t('dashboard:buyer.copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const maskedId = buyerId.replace(/(.{4})(.*)(.{4})/, '$1****$3');

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">ID</span>
            </div>
            {t('dashboard:buyer.yourBuyerId')}
          </CardTitle>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            {t('dashboard:buyer.uniqueIdentifier')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-card rounded-lg border border-blue-200">
          <div className="flex items-center gap-3">
            <code className="font-mono text-lg font-semibold text-blue-900 tracking-wider">
              {showId ? buyerId : maskedId}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowId(!showId)}
              className="h-6 w-6 p-0"
            >
              {showId ? (
                <EyeOff className="h-3 w-3" />
              ) : (
                <Eye className="h-3 w-3" />
              )}
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-2"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                {t('dashboard:buyer.copied')}
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                {t('dashboard:buyer.copy')}
              </>
            )}
          </Button>
        </div>
        
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">{t('dashboard:buyer.shareWithSuppliers')}</p>
              <p className="text-blue-700">
                Suppliers can use this unique ID to send you connection requests directly. 
                This makes it easier for trusted suppliers to connect with your company.
              </p>
            </div>
          </div>
        </div>

        <Button 
          onClick={() => setShowInviteModal(true)} 
          size="sm"
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          {t('dashboard:buyer.inviteSuppliers')}
        </Button>

        {buyerProfile && userProfile && (
          <InviteSupplierModal
            isOpen={showInviteModal}
            onClose={() => setShowInviteModal(false)}
            buyerId={buyerId}
            buyerProfile={buyerProfile}
            userProfile={userProfile}
          />
        )}
      </CardContent>
    </Card>
  );
};