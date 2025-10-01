import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CompanyBranch } from '@/hooks/useCompanyBranches';

interface BranchContextType {
  currentBranch: CompanyBranch | null;
  setCurrentBranch: (branch: CompanyBranch | null) => void;
  allBranchesView: boolean;
  setAllBranchesView: (value: boolean) => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export const BranchProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentBranch, setCurrentBranch] = useState<CompanyBranch | null>(null);
  const [allBranchesView, setAllBranchesView] = useState(false);

  // Persist branch selection in localStorage
  useEffect(() => {
    if (currentBranch) {
      localStorage.setItem('selectedBranchId', currentBranch.id);
    }
  }, [currentBranch]);

  return (
    <BranchContext.Provider 
      value={{ 
        currentBranch, 
        setCurrentBranch, 
        allBranchesView, 
        setAllBranchesView 
      }}
    >
      {children}
    </BranchContext.Provider>
  );
};

export const useBranchContext = () => {
  const context = useContext(BranchContext);
  if (context === undefined) {
    // Fallback to prevent runtime crashes if provider hasn't mounted yet
    console.warn('useBranchContext used outside BranchProvider. Falling back to defaults.');
    const noop = () => {};
    return {
      currentBranch: null,
      setCurrentBranch: noop,
      allBranchesView: false,
      setAllBranchesView: noop,
    } as BranchContextType;
  }
  return context;
};
