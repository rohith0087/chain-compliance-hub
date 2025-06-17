
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, AlertCircle, Building2, ShoppingCart, Users } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

const AuthPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<('buyer' | 'supplier')[]>(['supplier']);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: "Sign In Failed",
        description: error.message,
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedRoles.length === 0) {
      toast({
        title: "Role Selection Required",
        description: "Please select at least one role (Buyer or Supplier).",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    const { error } = await signUp(email, password, fullName, selectedRoles);
    
    if (error) {
      toast({
        title: "Sign Up Failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Account Created",
        description: "Please check your email to verify your account.",
      });
    }
    setLoading(false);
  };

  const handleDemoLogin = async (demoUser: {email: string, password: string, name: string}) => {
    setLoading(true);
    
    const { error } = await signIn(demoUser.email, demoUser.password);
    
    if (error) {
      toast({
        title: "Demo Login Failed",
        description: "Demo account not found. Please use the sign up form to create an account.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Demo Login Successful",
        description: `Welcome, ${demoUser.name}!`,
      });
    }
    setLoading(false);
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

  const demoUsers = [
    {
      email: 'sonic@franchise.com',
      password: 'demo123',
      name: 'Sonic Franchisee',
      description: 'Buyer & Supplier dashboard',
      details: [
        'Buy: Request docs from suppliers (buns, chicken, oil)',
        'Supply: Provide docs to delivery services',
        'Switch between roles seamlessly'
      ],
      icon: Users,
      color: 'text-purple-600'
    },
    {
      email: 'processor@chicken.com',
      password: 'demo123',
      name: 'Chicken Processor Co',
      description: 'Middle of supply chain',
      details: [
        'Buy: Request docs from farms',
        'Supply: Provide docs to restaurants',
        'Complete supply chain visibility'
      ],
      icon: Users,
      color: 'text-orange-600'
    },
    {
      email: 'farm@organic.com',
      password: 'demo123',
      name: 'Organic Farm',
      description: 'Pure supplier role',
      details: [
        'Provide compliance docs to processors',
        'Track document status and expiry',
        'Single role focused interface'
      ],
      icon: Building2,
      color: 'text-green-600'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">ComplianceFlow</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
              <TabsTrigger value="demo">Demo</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing In..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="signupEmail">Email</Label>
                  <Input
                    id="signupEmail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="signupPassword">Password</Label>
                  <Input
                    id="signupPassword"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-3">
                  <Label>Select your role(s):</Label>
                  <div className="flex flex-col space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="buyer-role-signup"
                        checked={selectedRoles.includes('buyer')}
                        onCheckedChange={() => toggleRole('buyer')}
                      />
                      <Label htmlFor="buyer-role-signup" className="flex items-center gap-2 cursor-pointer">
                        <ShoppingCart className="w-4 h-4" />
                        Buyer (Request documents from suppliers)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="supplier-role-signup"
                        checked={selectedRoles.includes('supplier')}
                        onCheckedChange={() => toggleRole('supplier')}
                      />
                      <Label htmlFor="supplier-role-signup" className="flex items-center gap-2 cursor-pointer">
                        <Building2 className="w-4 h-4" />
                        Supplier (Provide documents to buyers)
                      </Label>
                    </div>
                  </div>
                  {selectedRoles.length === 0 && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      Please select at least one role
                    </div>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading || selectedRoles.length === 0}
                >
                  {loading ? "Creating Account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="demo" className="space-y-4">
              <div className="space-y-3">
                {demoUsers.map((user, index) => {
                  const IconComponent = user.icon;
                  return (
                    <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleDemoLogin(user)}>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <IconComponent className={`w-5 h-5 ${user.color}`} />
                          {user.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-gray-600 mb-2">{user.description}:</p>
                        <ul className="text-xs text-gray-500 space-y-1">
                          {user.details.map((detail, idx) => (
                            <li key={idx}>• {detail}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <div className="text-center text-sm text-gray-500 mt-4">
                Click any demo account above to sign in
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
