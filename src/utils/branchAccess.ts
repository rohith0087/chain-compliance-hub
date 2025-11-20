import { CompanyBranch } from '@/hooks/useCompanyBranches';

/**
 * Filters items based on current branch context
 * @param items - Array of items to filter
 * @param currentBranch - Current selected branch
 * @param allBranchesView - Whether viewing all branches (company admin view)
 * @param branchIdKey - The property name for branch_id in the items (default: 'branch_id')
 * @returns Filtered array of items
 */
export const applyBranchFilter = <T extends Record<string, any>>(
  items: T[],
  currentBranch: CompanyBranch | null,
  allBranchesView: boolean,
  branchIdKey: string = 'branch_id'
): T[] => {
  if (allBranchesView || !currentBranch) {
    return items;
  }
  
  return items.filter(item => item[branchIdKey] === currentBranch.id);
};

/**
 * Gets the branch ID to filter by, or null if showing all branches
 * @param currentBranch - Current selected branch
 * @param allBranchesView - Whether viewing all branches
 * @returns Branch ID string or null
 */
export const getBranchFilterQuery = (
  currentBranch: CompanyBranch | null,
  allBranchesView: boolean
): string | null => {
  if (allBranchesView || !currentBranch) {
    return null;
  }
  
  return currentBranch.id;
};
