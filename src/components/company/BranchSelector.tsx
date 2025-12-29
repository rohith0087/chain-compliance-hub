import React from 'react';
import { ChevronDown, Building2, MapPin, Globe, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CompanyBranch } from '@/hooks/useCompanyBranches';
import { useBranchContext } from '@/contexts/BranchContext';

interface BranchSelectorProps {
  branches: CompanyBranch[];
  currentBranch: CompanyBranch | null;
  onBranchChange: (branch: CompanyBranch | null) => void;
  loading?: boolean;
  showAllBranchesOption?: boolean;
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({ 
  branches, 
  currentBranch, 
  onBranchChange, 
  loading = false,
  showAllBranchesOption = false
}) => {
  const { allBranchesView, setAllBranchesView } = useBranchContext();

  if (loading) {
    return (
      <div className="flex items-center space-x-2 animate-pulse">
        <div className="h-4 w-4 bg-muted rounded" />
        <div className="h-4 w-32 bg-muted rounded" />
      </div>
    );
  }

  // If only one branch and no all-branches option, show static display
  if (branches.length <= 1 && !showAllBranchesOption) {
    return (
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>{currentBranch?.branch_name || 'Main Office'}</span>
      </div>
    );
  }

  const handleAllBranchesToggle = () => {
    setAllBranchesView(true);
    onBranchChange(null); // Notify parent that "All Branches" was selected
  };

  const handleBranchSelect = (branch: CompanyBranch) => {
    setAllBranchesView(false);
    onBranchChange(branch);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          {allBranchesView ? (
            <>
              <Globe className="h-4 w-4 mr-2" />
              <span className="max-w-32 truncate">All Branches</span>
            </>
          ) : (
            <>
              <Building2 className="h-4 w-4 mr-2" />
              <span className="max-w-32 truncate">
                {currentBranch?.branch_name || 'Select Branch'}
              </span>
            </>
          )}
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {showAllBranchesOption && (
          <>
            <DropdownMenuItem
              onClick={handleAllBranchesToggle}
              className="flex items-center justify-between p-3 hover:bg-muted focus:bg-muted"
            >
              <div className="flex items-center space-x-3">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">All Branches</span>
              </div>
              {allBranchesView && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        {branches.map((branch) => (
          <DropdownMenuItem
            key={branch.id}
            onClick={() => handleBranchSelect(branch)}
            className="flex items-center justify-between p-3 hover:bg-muted focus:bg-muted"
          >
            <div className="flex items-center space-x-3 flex-1">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <div className="font-medium text-foreground">{branch.branch_name}</div>
                {branch.location && (
                  <div className="text-xs text-muted-foreground flex items-center mt-1">
                    <MapPin className="h-3 w-3 mr-1" />
                    {branch.location}
                  </div>
                )}
              </div>
            </div>
            {!allBranchesView && currentBranch?.id === branch.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};