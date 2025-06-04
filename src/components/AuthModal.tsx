
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, ShoppingCart, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: {roles: ('buyer' | 'supplier')[], name: string, currentRole: 'buyer' | 'supplier'}) => void;
}

const AuthModal = ({ isOpen, onClose, onLogin }: AuthModalProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<('buyer' | 'supplier')[]>(['buyer']);

  const handleLogin = () => {
    // Mock login - in real app this would authenticate with backend
    const name = email.split('@')[0] || 'User';
    onLogin({ 
      roles: selectedRoles, 
      name, 
      currentRole: selectedRoles[0] // Default to first selected role
    });
    onClose();
  };

  const demoUsers = {
    sonicFranchise: { 
      email: 'sonic@franchise.com', 
      password: 'demo123',
      roles: ['buyer', 'supplier'] as ('buyer' | 'supplier')[],
      name: 'Sonic Franchisee'
    },
    chickenProcessor: { 
      email: 'processor@chicken.com', 
      password: 'demo123',
      roles: ['buyer', 'supplier'] as ('buyer' | 'supplier')[],
      name: 'Chicken Processor Co'
    },
    farm: { 
      email: 'farm@organic.com', 
      password: 'demo123',
      roles: ['supplier'] as ('buyer' | 'supplier')[],
      name: 'Organic Farm'
    }
  };

  const handleDemoLogin = (userType: keyof typeof demoUsers) => {
    const user = demoUsers[userType];
    setTimeout(() => {
      onLogin({ 
        roles: user.roles, 
        name: user.name,
        currentRole: user.roles[0]
      });
      onClose();
    }, 500);
  };

  const toggleRole = (role: 'buyer' | 'supplier') => {
    setSelectedRoles(prev => {
      if (prev.includes(role)) {
        return prev.filter(r => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">Welcome to ComplianceFlow</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Sign In</TabsTrigger>
            <TabsTrigger value="demo">Demo Access</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-3">
                <Label>Select your role(s):</Label>
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="buyer-role"
                      checked={selectedRoles.includes('buyer')}
                      onCheckedChange={() => toggleRole('buyer')}
                    />
                    <Label htmlFor="buyer-role" className="flex items-center gap-2 cursor-pointer">
                      <ShoppingCart className="w-4 h-4" />
                      Buyer (Request documents from suppliers)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="supplier-role"
                      checked={selectedRoles.includes('supplier')}
                      onCheckedChange={() => toggleRole('supplier')}
                    />
                    <Label htmlFor="supplier-role" className="flex items-center gap-2 cursor-pointer">
                      <Building2 className="w-4 h-4" />
                      Supplier (Provide documents to buyers)
                    </Label>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
              
              <Button 
                onClick={handleLogin} 
                className="w-full"
                disabled={selectedRoles.length === 0}
              >
                Sign In
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="demo" className="space-y-4">
            <div className="space-y-3">
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleDemoLogin('sonicFranchise')}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="w-5 h-5 text-purple-600" />
                    Sonic Franchisee (Dual Role)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-gray-600 mb-2">Buyer & Supplier dashboard:</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Buy: Request docs from suppliers (buns, chicken, oil)</li>
                    <li>• Supply: Provide docs to delivery services</li>
                    <li>• Switch between roles seamlessly</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleDemoLogin('chickenProcessor')}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Users className="w-5 h-5 text-orange-600" />
                    Chicken Processor (Dual Role)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-gray-600 mb-2">Middle of supply chain:</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Buy: Request docs from farms</li>
                    <li>• Supply: Provide docs to restaurants</li>
                    <li>• Complete supply chain visibility</li>
                  </ul>
                </CardContent>
              </Card>
              
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleDemoLogin('farm')}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="w-5 h-5 text-green-600" />
                    Organic Farm (Supplier Only)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-gray-600 mb-2">Pure supplier role:</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Provide compliance docs to processors</li>
                    <li>• Track document status and expiry</li>
                    <li>• Single role focused interface</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
