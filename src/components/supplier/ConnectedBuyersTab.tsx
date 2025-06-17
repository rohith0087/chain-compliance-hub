
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, Mail, MapPin, Phone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface ConnectedBuyersTabProps {
  connectedBuyers: any[];
}

const ConnectedBuyersTab = ({ connectedBuyers }: ConnectedBuyersTabProps) => {
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
          {connectedBuyers.map((connection) => (
            <div key={connection.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{connection.buyers?.company_name || 'Unknown Company'}</h3>
                    <p className="text-sm text-gray-600">Industry: {connection.buyers?.industry || 'Not specified'}</p>
                    <p className="text-sm text-gray-500">Email: {connection.buyers?.contact_email || 'Not available'}</p>
                    <p className="text-xs text-gray-400">
                      Connected: {connection.responded_at 
                        ? new Date(connection.responded_at).toLocaleDateString()
                        : 'Date not available'
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <Badge variant="outline" className="text-green-600 border-green-200">
                    Active
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
                          {connection.buyers?.company_name || 'Company Details'}
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
                                <p className="text-sm text-gray-600">{connection.buyers?.company_name || 'Not provided'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-gray-500" />
                              <div>
                                <p className="text-sm font-medium">Industry</p>
                                <p className="text-sm text-gray-600">{connection.buyers?.industry || 'Not specified'}</p>
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
                                <p className="text-sm text-gray-600">{connection.buyers?.contact_email || 'Not provided'}</p>
                              </div>
                            </div>
                            {connection.buyers?.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-gray-500" />
                                <div>
                                  <p className="text-sm font-medium">Phone</p>
                                  <p className="text-sm text-gray-600">{connection.buyers.phone}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Address */}
                        {connection.buyers?.address && (
                          <div>
                            <h4 className="font-semibold mb-3 text-gray-900">Address</h4>
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                              <p className="text-sm text-gray-600">{connection.buyers.address}</p>
                            </div>
                          </div>
                        )}

                        {/* Connection Details */}
                        <div>
                          <h4 className="font-semibold mb-3 text-gray-900">Connection Details</h4>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm font-medium">Status</p>
                              <Badge variant="outline" className="text-green-600 border-green-200 mt-1">
                                Connected
                              </Badge>
                            </div>
                            <div>
                              <p className="text-sm font-medium">Connected Date</p>
                              <p className="text-sm text-gray-600">
                                {connection.responded_at 
                                  ? new Date(connection.responded_at).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })
                                  : 'Date not available'
                                }
                              </p>
                            </div>
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
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ConnectedBuyersTab;
