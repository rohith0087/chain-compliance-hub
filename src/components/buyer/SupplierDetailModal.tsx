import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Mail, Phone, MapPin, Calendar, FileText, Package } from 'lucide-react';
import { format } from 'date-fns';
import { SupplierItemFacilityView } from './SupplierItemFacilityView';

interface SupplierDetailModalProps {
  supplier: any;
  isOpen: boolean;
  onClose: () => void;
  connectionStatus?: string;
  connectionDate?: string;
}

export const SupplierDetailModal: React.FC<SupplierDetailModalProps> = ({
  supplier,
  isOpen,
  onClose,
  connectionStatus,
  connectionDate
}) => {
  if (!supplier) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'rejected':
        return 'bg-red-50 text-red-700 border-red-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-primary" />
            {supplier.company_name}
          </DialogTitle>
          <DialogDescription>
            Detailed supplier information and connection status
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Connection Status */}
          {connectionStatus && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Connection Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge 
                    variant="outline" 
                    className={getStatusColor(connectionStatus)}
                  >
                    {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
                  </Badge>
                  {connectionDate && (
                    <span className="text-sm text-muted-foreground">
                      Connected {format(new Date(connectionDate), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Company Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Industry</p>
                    <p className="text-sm text-muted-foreground">
                      {supplier.industry || 'Not specified'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Joined</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(supplier.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
              </div>

              {supplier.description && (
                <div>
                  <p className="font-medium mb-2">Description</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {supplier.description}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{supplier.contact_email}</p>
                </div>
              </div>

              {supplier.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Phone</p>
                    <p className="text-sm text-muted-foreground">{supplier.phone}</p>
                  </div>
                </div>
              )}

              {supplier.address && (
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Address</p>
                    <p className="text-sm text-muted-foreground">{supplier.address}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Item-Facility Matrix Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Item-Facility Matrix
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SupplierItemFacilityView supplierId={supplier.id} />
            </CardContent>
          </Card>

          {/* Additional Information */}
          {supplier.auto_approve_connections !== undefined && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Supplier Preferences</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Auto-approve Connections</p>
                    <p className="text-sm text-muted-foreground">
                      {supplier.auto_approve_connections ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};