
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, Mail, MapPin, Phone, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface ConnectedBuyersTabProps {
  connectedBuyers: any[];
}

const ConnectedBuyersTab = ({ connectedBuyers }: ConnectedBuyersTabProps) => {
  console.log('ConnectedBuyersTab received data:', connectedBuyers);

  if (connectedBuyers.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Connected Buyers</CardTitle>
          <Badge variant="outline">0 Connected</Badge>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Connected Buyers</h3>
            <p className="text-gray-500 mb-6">You haven't connected with any buyers yet.</p>
            <p className="text-sm text-gray-400">
              Buyers will appear here once they send connection requests and you approve them.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Connected Buyers</CardTitle>
        <Badge variant="outline">{connectedBuyers.length} Connected</Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {connectedBuyers.map((connection) => {
            const buyerInfo = connection.buyers;
            const companyName = buyerInfo?.company_name || 'Unknown Company';
            const industry = buyerInfo?.industry || 'Industry not specified';
            const contactEmail = buyerInfo?.contact_email || 'Email not provided';
            const phone = buyerInfo?.phone;
            const address = buyerInfo?.address;
            const connectedDate = connection.responded_at || connection.requested_at;

            console.log('Rendering connection:', connection.id, 'with buyer:', buyerInfo);

            return (
              <div key={connection.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg text-gray-900 mb-1">{companyName}</h3>
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-600">
                          <Users className="w-4 h-4 mr-2 text-gray-400" />
                          <span>{industry}</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Mail className="w-4 h-4 mr-2 text-gray-400" />
                          <span className="truncate">{contactEmail}</span>
                        </div>
                        {phone && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Phone className="w-4 h-4 mr-2 text-gray-400" />
                            <span>{phone}</span>
                          </div>
                        )}
                        {connectedDate && (
                          <p className="text-xs text-gray-400">
                            Connected: {new Date(connectedDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 flex-shrink-0">
                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                      Connected
                    </Badge>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <Building2 className="w-5 h-5" />
                            {companyName}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-6">
                          {/* Company Information */}
                          <div>
                            <h4 className="font-semibold mb-3 text-gray-900">Company Information</h4>
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-gray-500" />
                                <div>
                                  <p className="text-sm font-medium">Company Name</p>
                                  <p className="text-sm text-gray-600">{companyName}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-gray-500" />
                                <div>
                                  <p className="text-sm font-medium">Industry</p>
                                  <p className="text-sm text-gray-600">{industry}</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Contact Information */}
                          <div>
                            <h4 className="font-semibold mb-3 text-gray-900">Contact Information</h4>
                            <div className="grid md:grid-cols-2 gap-4">
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-gray-500" />
                                <div>
                                  <p className="text-sm font-medium">Email</p>
                                  <p className="text-sm text-gray-600">{contactEmail}</p>
                                </div>
                              </div>
                              {phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-gray-500" />
                                  <div>
                                    <p className="text-sm font-medium">Phone</p>
                                    <p className="text-sm text-gray-600">{phone}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Address */}
                          {address && (
                            <div>
                              <h4 className="font-semibold mb-3 text-gray-900">Address</h4>
                              <div className="flex items-start gap-2">
                                <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                                <p className="text-sm text-gray-600">{address}</p>
                              </div>
                            </div>
                          )}

                          {/* Connection Details */}
                          <div>
                            <h4 className="font-semibold mb-3 text-gray-900">Connection Details</h4>
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-sm font-medium">Status</p>
                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 mt-1">
                                  Connected
                                </Badge>
                              </div>
                              {connectedDate && (
                                <div>
                                  <p className="text-sm font-medium">Connected Date</p>
                                  <p className="text-sm text-gray-600">
                                    {new Date(connectedDate).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Connection Notes */}
                          {connection.notes && (
                            <div>
                              <h4 className="font-semibold mb-3 text-gray-900">Connection Notes</h4>
                              <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-700">{connection.notes}</p>
                              </div>
                            </div>
                          )}

                          {/* Data Debug Info (only in development) */}
                          {process.env.NODE_ENV === 'development' && !buyerInfo && (
                            <div className="border-t pt-4">
                              <div className="flex items-center gap-2 text-amber-600 mb-2">
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-sm font-medium">Debug Info</span>
                              </div>
                              <p className="text-xs text-gray-500">
                                Buyer data is missing or incomplete for this connection.
                              </p>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default ConnectedBuyersTab;
