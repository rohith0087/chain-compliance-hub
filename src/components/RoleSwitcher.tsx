
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Building2, ArrowLeftRight } from 'lucide-react';

interface RoleSwitcherProps {
  currentRole: 'buyer' | 'supplier';
  availableRoles: ('buyer' | 'supplier')[];
  onRoleSwitch: (role: 'buyer' | 'supplier') => void;
}

const RoleSwitcher = ({ currentRole, availableRoles, onRoleSwitch }: RoleSwitcherProps) => {
  if (availableRoles.length <= 1) {
    return null; // Don't show switcher if user only has one role
  }

  const otherRole = availableRoles.find(role => role !== currentRole);
  if (!otherRole) return null;

  return (
    <div className="flex items-center space-x-2">
      <Badge variant="secondary" className="flex items-center gap-1">
        {currentRole === 'buyer' ? (
          <>
            <ShoppingCart className="w-3 h-3" />
            Buyer Mode
          </>
        ) : (
          <>
            <Building2 className="w-3 h-3" />
            Supplier Mode
          </>
        )}
      </Badge>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => onRoleSwitch(otherRole)}
        className="flex items-center gap-2"
      >
        <ArrowLeftRight className="w-3 h-3" />
        Switch to {otherRole === 'buyer' ? 'Buyer' : 'Supplier'}
      </Button>
    </div>
  );
};

export default RoleSwitcher;
