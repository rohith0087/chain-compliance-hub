import { useState } from 'react';
import { useSupplierContacts, CONTACT_ROLES, ContactRole } from '@/hooks/useSupplierContacts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { UserCog, Plus, Edit, Trash2, Search, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ContactRoleManagerProps {
  supplierId: string;
}

export const ContactRoleManager = ({ supplierId }: ContactRoleManagerProps) => {
  const { t } = useTranslation();
  const { contacts, loading, createContact, updateContact, deleteContact, setPrimaryContact, getContactCountByRole } = useSupplierContacts(supplierId);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  
  const [formData, setFormData] = useState({
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    roles: [] as ContactRole[],
    is_primary: false,
    status: 'active',
  });

  const handleOpenDialog = (contact?: any) => {
    if (contact) {
      setEditingContact(contact);
      setFormData({
        contact_name: contact.contact_name,
        contact_email: contact.contact_email,
        contact_phone: contact.contact_phone || '',
        roles: contact.roles,
        is_primary: contact.is_primary,
        status: contact.status,
      });
    } else {
      setEditingContact(null);
      setFormData({
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        roles: ['general'] as ContactRole[],
        is_primary: false,
        status: 'active',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingContact) {
        await updateContact(editingContact.id, formData);
      } else {
        await createContact(formData);
      }
      setIsDialogOpen(false);
      setFormData({ 
        contact_name: '', 
        contact_email: '', 
        contact_phone: '', 
        roles: [], 
        is_primary: false,
        status: 'active'
      });
    } catch (error) {
      console.error('Error saving contact:', error);
    }
  };

  const handleDelete = async (contactId: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      await deleteContact(contactId);
    }
  };

  const toggleRole = (role: ContactRole) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role]
    }));
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = 
      contact.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.contact_email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || contact.roles.includes(roleFilter as ContactRole);
    return matchesSearch && matchesRole;
  });

  const roleCounts = getContactCountByRole();

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading contacts...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Contact Management
          </CardTitle>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={roleFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRoleFilter('all')}
              >
                All
              </Button>
              {CONTACT_ROLES.map(role => (
                <Button
                  key={role.value}
                  variant={roleFilter === role.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setRoleFilter(role.value)}
                >
                  {role.label} ({roleCounts[role.value] || 0})
                </Button>
              ))}
            </div>
          </div>

          {filteredContacts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <UserCog className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No contacts found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredContacts.map(contact => (
                <div
                  key={contact.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{contact.contact_name}</h4>
                        {contact.is_primary && (
                          <Badge variant="default" className="gap-1">
                            <Star className="h-3 w-3" />
                            Primary
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>{contact.contact_email}</div>
                        {contact.contact_phone && <div>{contact.contact_phone}</div>}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {contact.roles.map(role => {
                          const roleInfo = CONTACT_ROLES.find(r => r.value === role);
                          return (
                            <Badge key={role} variant={roleInfo?.color as any || 'outline'}>
                              {roleInfo?.label || role}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!contact.is_primary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPrimaryContact(contact.id)}
                          title="Set as primary"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(contact)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(contact.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Edit Contact' : 'Add New Contact'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="contact_name">Name *</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                placeholder="John Smith"
              />
            </div>
            <div>
              <Label htmlFor="contact_email">Email *</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="john@company.com"
              />
            </div>
            <div>
              <Label htmlFor="contact_phone">Phone</Label>
              <Input
                id="contact_phone"
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                placeholder="+1-555-0100"
              />
            </div>
            <div>
              <Label>Roles * (select at least one)</Label>
              <div className="space-y-2 mt-2">
                {CONTACT_ROLES.map(role => (
                  <div key={role.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={role.value}
                      checked={formData.roles.includes(role.value as ContactRole)}
                      onCheckedChange={() => toggleRole(role.value as ContactRole)}
                    />
                    <Label htmlFor={role.value} className="cursor-pointer">
                      {role.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_primary"
                checked={formData.is_primary}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, is_primary: checked as boolean })
                }
              />
              <Label htmlFor="is_primary" className="cursor-pointer">
                Set as primary contact
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.contact_name || !formData.contact_email || formData.roles.length === 0}
            >
              {editingContact ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
