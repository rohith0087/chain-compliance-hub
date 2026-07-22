import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Link, Eye, Calendar, Trash2, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface DocumentLink {
  id: string;
  access_token: string;
  permission_level: string; // Changed from union type to string to match DB
  created_at: string;
  expires_at?: string;
  is_active: boolean;
  view_count: number;
  last_accessed_at?: string;
  created_by: string;
  profiles?: {
    full_name: string;
  };
}

interface DocumentLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentUpload: any;
}

export const DocumentLinkModal: React.FC<DocumentLinkModalProps> = ({
  isOpen,
  onClose,
  documentUpload,
}) => {
  const { toast } = useToast();
  const [permissionLevel, setPermissionLevel] = useState<'public' | 'organization' | 'admin_only'>('organization');
  const [expiresAt, setExpiresAt] = useState('');
  const [existingLinks, setExistingLinks] = useState<DocumentLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingLinks, setFetchingLinks] = useState(false);

  useEffect(() => {
    if (isOpen && documentUpload?.id) {
      fetchExistingLinks();
    }
  }, [isOpen, documentUpload?.id]);

  const fetchExistingLinks = async () => {
    setFetchingLinks(true);
    try {
      const { data, error } = await supabase
        .from('document_shared_links')
        .select(`
          *,
          profiles:created_by(full_name)
        `)
        .eq('document_upload_id', documentUpload.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExistingLinks((data || []) as DocumentLink[]);
    } catch (error) {
      console.error('Error fetching links:', error);
      toast({
        title: "Error",
        description: "Failed to fetch existing links",
        variant: "destructive",
      });
    } finally {
      setFetchingLinks(false);
    }
  };

  const createLink = async () => {
    setLoading(true);
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('document_shared_links')
        .insert([{
          document_upload_id: documentUpload.id,
          permission_level: permissionLevel,
          expires_at: expiresAt || null,
          created_by: user.data.user.id,
        }])
        .select(`
          *,
          profiles:created_by(full_name)
        `)
        .single();

      if (error) throw error;

      // Log the activity
      await supabase.rpc('log_document_activity', {
        p_document_upload_id: documentUpload.id,
        p_user_id: user.data.user.id,
        p_action_type: 'link_created',
        p_metadata: {
          permission_level: permissionLevel,
          expires_at: expiresAt || null,
        },
        p_notes: `Created ${permissionLevel} link for document`,
      });

      setExistingLinks([data as DocumentLink, ...existingLinks]);
      setPermissionLevel('organization');
      setExpiresAt('');
      
      toast({
        title: "Success",
        description: "Document link created successfully",
      });
    } catch (error) {
      console.error('Error creating link:', error);
      toast({
        title: "Error",
        description: "Failed to create document link",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (token: string) => {
    // URL encode the token to handle special characters like / and +
    const encodedToken = encodeURIComponent(token);
    const link = `${window.location.origin}/shared-document/${encodedToken}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: "Copied",
        description: "Link copied to clipboard",
      });
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toast({
        title: "Copied",
        description: "Link copied to clipboard",
      });
    }
  };

  const deactivateLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('document_shared_links')
        .update({ is_active: false })
        .eq('id', linkId);

      if (error) throw error;

      setExistingLinks(existingLinks.filter(link => link.id !== linkId));
      toast({
        title: "Success",
        description: "Link deactivated successfully",
      });
    } catch (error) {
      console.error('Error deactivating link:', error);
      toast({
        title: "Error",
        description: "Failed to deactivate link",
        variant: "destructive",
      });
    }
  };

  const getPermissionBadgeColor = (level: string) => {
    switch (level) {
      case 'public': return 'bg-danger/15 text-danger';
      case 'organization': return 'bg-primary/15 text-primary';
      case 'admin_only': return 'bg-primary/15 text-primary';
      default: return 'bg-muted text-foreground';
    }
  };

  const formatPermissionLevel = (level: string) => {
    switch (level) {
      case 'public': return 'Public';
      case 'organization': return 'Organization';
      case 'admin_only': return 'Admin Only';
      default: return level;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Manage Document Links - {documentUpload?.file_name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Create New Link */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Create New Link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="permission-level">Permission Level</Label>
                <Select value={permissionLevel} onValueChange={(value: any) => setPermissionLevel(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">
                      <div className="flex flex-col">
                        <span>Public</span>
                        <span className="text-xs text-muted-foreground">Anyone with the link</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="organization">
                      <div className="flex flex-col">
                        <span>Organization</span>
                        <span className="text-xs text-muted-foreground">Authenticated users only</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="admin_only">
                      <div className="flex flex-col">
                        <span>Admin Only</span>
                        <span className="text-xs text-muted-foreground">Admin users only</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="expires-at">Expiration Date (Optional)</Label>
                <Input
                  id="expires-at"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>

              <Button 
                onClick={createLink} 
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Creating...' : 'Create Link'}
              </Button>
            </CardContent>
          </Card>

          {/* Existing Links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Existing Links</CardTitle>
            </CardHeader>
            <CardContent>
              {fetchingLinks ? (
                <div className="text-center py-4">Loading...</div>
              ) : existingLinks.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No links created yet
                </div>
              ) : (
                <div className="space-y-3">
                  {existingLinks.map((link) => (
                    <div key={link.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge className={getPermissionBadgeColor(link.permission_level)}>
                          {formatPermissionLevel(link.permission_level)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deactivateLink(link.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        Created by {link.profiles?.full_name} on {format(new Date(link.created_at), 'MMM dd, yyyy')}
                      </div>
                      
                      {link.expires_at && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Expires: {format(new Date(link.expires_at), 'MMM dd, yyyy HH:mm')}
                        </div>
                      )}
                      
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        Views: {link.view_count}
                        {link.last_accessed_at && (
                          <span className="ml-2">
                            Last: {format(new Date(link.last_accessed_at), 'MMM dd, yyyy')}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(link.access_token)}
                          className="flex-1"
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy Link
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const encodedToken = encodeURIComponent(link.access_token);
                            window.open(`/shared-document/${encodedToken}`, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
