import React from 'react';
import { ChevronDown, Check } from 'lucide-react';
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
  compact?: boolean;
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({ 
  branches, 
  currentBranch, 
  onBranchChange, 
  loading = false,
  showAllBranchesOption = false,
  compact = false
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
      <div className="text-sm text-muted-foreground">
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
        <Button variant={compact ? "ghost" : "outline"} size="sm" className={compact ? "h-7 text-xs text-primary px-2" : "h-8"}>
          <span className="max-w-32 truncate">
            {allBranchesView ? 'All Branches' : currentBranch?.branch_name || 'Select Branch'}
          </span>
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
              <span className="font-medium">All Branches</span>
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
            <div className="flex-1">
              <div className="font-medium text-foreground">{branch.branch_name}</div>
              {branch.location && (
                // Mono for location, per the brand system's "captions and record
                // values are mono" rule -- reads more deliberate than a pin glyph.
                <div className="mt-0.5 font-mono text-micro tracking-[0.02em] text-muted-foreground">
                  {branch.location}
                </div>
              )}
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