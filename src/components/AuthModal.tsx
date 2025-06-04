
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, ShoppingCart } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: {role: 'buyer' | 'supplier', name: string}) => void;
}

const AuthModal = ({ isOpen, onClose, onLogin }: AuthModalProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<'buyer' | 'supplier'>('buyer');

  const handleLogin = () => {
    // Mock login - in real app this would authenticate with backend
    const name = email.split('@')[0] || 'User';
    onLogin({ role: selectedRole, name });
    onClose();
  };

  const demoUsers = {
    buyer: { email: 'buyer@company.com', password: 'demo123' },
    supplier: { email: 'supplier@vendor.com', password: 'demo123' }
  };

  const handleDemoLogin = (role: 'buyer' | 'supplier') => {
    setSelectedRole(role);
    setEmail(demoUsers[role].email);
    setPassword(demoUsers[role].password);
    setTimeout(() => {
      onLogin({ role, name: `Demo ${role.charAt(0).toUpperCase() + role.slice(1)}` });
      onClose();
    }, 500);
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
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={selectedRole === 'buyer' ? 'default' : 'outline'}
                  onClick={() => setSelectedRole('buyer')}
                  className="flex items-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Buyer
                </Button>
                <Button
                  variant={selectedRole === 'supplier' ? 'default' : 'outline'}
                  onClick={() => setSelectedRole('supplier')}
                  className="flex items-center gap-2"
                >
                  <Building2 className="w-4 h-4" />
                  Supplier
                </Button>
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
              
              <Button onClick={handleLogin} className="w-full">
                Sign In as {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="demo" className="space-y-4">
            <div className="space-y-3">
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleDemoLogin('buyer')}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <ShoppingCart className="w-5 h-5 text-blue-600" />
                    Buyer Demo
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-gray-600 mb-2">Experience the buyer dashboard with:</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Document request management</li>
                    <li>• Supplier compliance tracking</li>
                    <li>• Real-time status monitoring</li>
                  </ul>
                </CardContent>
              </Card>
              
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleDemoLogin('supplier')}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="w-5 h-5 text-green-600" />
                    Supplier Demo
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-gray-600 mb-2">Experience the supplier dashboard with:</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Document upload interface</li>
                    <li>• Request status tracking</li>
                    <li>• Expiration management</li>
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
