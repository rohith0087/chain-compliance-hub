import { useState, useEffect } from 'react';
import { CONTACT_ROLES, ContactRole } from '@/hooks/useSupplierContacts';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ContactRoleSelectorProps {
  selectedRoles: ContactRole[];
  onChange: (roles: ContactRole[]) => void;
  contactCounts?: { [key: string]: number };
}

export const ContactRoleSelector = ({ 
  selectedRoles, 
  onChange, 
  contactCounts = {} 
}: ContactRoleSelectorProps) => {
  const [sendToAll, setSendToAll] = useState(selectedRoles.length === 0);

  useEffect(() => {
    if (sendToAll) {
      onChange([]);
    }
  }, [sendToAll]);

  const toggleRole = (role: ContactRole) => {
    if (sendToAll) return;
    
    const newRoles = selectedRoles.includes(role)
      ? selectedRoles.filter(r => r !== role)
      : [...selectedRoles, role];
    onChange(newRoles);
  };

  const handleSendToAllChange = (checked: boolean) => {
    setSendToAll(checked);
    if (checked) {
      onChange([]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Send Request To</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="send_to_all"
            checked={sendToAll}
            onCheckedChange={handleSendToAllChange}
          />
          <Label htmlFor="send_to_all" className="cursor-pointer font-medium">
            All Contacts (default)
          </Label>
        </div>

        {!sendToAll && (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Or select specific contact roles:
            </p>
            <div className="space-y-2">
              {CONTACT_ROLES.map(role => (
                <div key={role.value} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`role_${role.value}`}
                      checked={selectedRoles.includes(role.value as ContactRole)}
                      onCheckedChange={() => toggleRole(role.value as ContactRole)}
                    />
                    <Label htmlFor={`role_${role.value}`} className="cursor-pointer">
                      {role.label}
                    </Label>
                  </div>
                  <Badge variant="outline">
                    {contactCounts[role.value] || 0} contact{contactCounts[role.value] !== 1 ? 's' : ''}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {!sendToAll && selectedRoles.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-sm font-medium mb-2">Selected roles:</p>
            <div className="flex flex-wrap gap-1">
              {selectedRoles.map(role => {
                const roleInfo = CONTACT_ROLES.find(r => r.value === role);
                return (
                  <Badge key={role} variant={roleInfo?.color as any || 'default'}>
                    {roleInfo?.label || role}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
