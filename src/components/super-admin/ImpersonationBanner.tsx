import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Button } from '@/components/ui/button';
import { Eye, X, Building2, User } from 'lucide-react';

export const ImpersonationBanner: React.FC = () => {
  const navigate = useNavigate();
  const { isImpersonating, impersonatedUser, impersonatedCompany, endImpersonation } = useImpersonation();

  if (!isImpersonating || !impersonatedUser || !impersonatedCompany) {
    return null;
  }

  const handleExit = async () => {
    await endImpersonation();
    navigate('/super-admin');
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 animate-pulse" />
              <span className="font-semibold">Impersonation Mode</span>
            </div>
            
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1">
                <User className="h-4 w-4" />
                <span>{impersonatedUser.fullName || impersonatedUser.email}</span>
              </div>
              
              <div className="flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1">
                <Building2 className="h-4 w-4" />
                <span>{impersonatedCompany.name}</span>
                <span className="text-white/70">({impersonatedCompany.type})</span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleExit}
            variant="secondary"
            size="sm"
            className="bg-white text-orange-600 hover:bg-white/90 font-medium"
          >
            <X className="h-4 w-4 mr-1" />
            Exit Impersonation
          </Button>
        </div>
        
        {/* Mobile view - show details on second row */}
        <div className="sm:hidden flex items-center gap-2 mt-2 text-xs">
          <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5">
            <User className="h-3 w-3" />
            <span className="truncate max-w-[120px]">{impersonatedUser.email}</span>
          </div>
          <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5">
            <Building2 className="h-3 w-3" />
            <span className="truncate max-w-[100px]">{impersonatedCompany.name}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
