import React from 'react';
import { ChevronDown, Building2, MapPin } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CompanyBranch } from '@/hooks/useCompanyBranches';

interface BranchSelectorProps {
  branches: CompanyBranch[];
  currentBranch: CompanyBranch | null;
  onBranchChange: (branch: CompanyBranch) => void;
  loading?: boolean;
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({
  branches,
  currentBranch,
  onBranchChange,
  loading = false
}) => {
  if (loading) {
    return (
      <div className="flex items-center space-x-2 animate-pulse">
        <div className="h-4 w-4 bg-muted rounded" />
        <div className="h-4 w-32 bg-muted rounded" />
      </div>
    );
  }

  if (branches.length <= 1) {
    return (
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>{currentBranch?.branch_name || 'Main Office'}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Building2 className="h-4 w-4 mr-2" />
          <span className="max-w-32 truncate">
            {currentBranch?.branch_name || 'Select Branch'}
          </span>
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {branches.map((branch) => (
          <DropdownMenuItem
            key={branch.id}
            onClick={() => onBranchChange(branch)}
            className="flex items-center justify-between p-3"
          >
            <div className="flex items-center space-x-3 flex-1">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-medium">{branch.branch_name}</div>
                {branch.location && (
                  <div className="text-xs text-muted-foreground flex items-center mt-1">
                    <MapPin className="h-3 w-3 mr-1" />
                    {branch.location}
                  </div>
                )}
              </div>
            </div>
            {currentBranch?.id === branch.id && (
              <Badge variant="secondary" className="text-xs">
                Current
              </Badge>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};