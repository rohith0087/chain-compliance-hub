import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getRoleDisplayName, UserRole } from '@/config/rolePermissions';

// Allow 'company_owner' as a special role for display purposes
type DisplayRole = UserRole | 'company_owner';

interface UnauthorizedAccessProps {
  requiredRoles: DisplayRole[];
  currentRole: string | null;
}

const UnauthorizedAccess: React.FC<UnauthorizedAccessProps> = ({ requiredRoles, currentRole }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <CardTitle className="text-2xl">Access Denied</CardTitle>
            <CardDescription className="mt-2">
              You don't have permission to access this page
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Your current role:</p>
            <Badge variant="secondary" className="text-sm">
              {currentRole ? getRoleDisplayName(currentRole as UserRole) : 'No Role Assigned'}
            </Badge>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Required role(s):</p>
            <div className="flex flex-wrap gap-2">
              {requiredRoles.map((role) => (
                <Badge key={role} variant="outline" className="text-sm">
                  {getRoleDisplayName(role)}
                </Badge>
              ))}
            </div>
          </div>

          <div className="pt-4">
            <Button 
              onClick={() => navigate('/')} 
              className="w-full"
              variant="default"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Dashboard
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            If you believe you should have access to this page, please contact your company administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnauthorizedAccess;
