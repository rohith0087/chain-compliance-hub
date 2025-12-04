import { useState, useMemo } from 'react';
import { differenceInDays } from 'date-fns';
import { FilterOptions } from '@/components/buyer/AdvancedFilters';
import { ExportData } from '@/utils/pipelineExport';

export const useOnboardingPipeline = (requests: any[]) => {
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<FilterOptions>({
    progressRange: 'all',
    timeInStage: 'all',
    branchId: 'all',
    documentStatus: 'all',
    priority: 'all',
  });
  
  // Calculate priority for a request
  const calculatePriority = (request: any): 'urgent' | 'high' | 'normal' => {
    // Completed statuses don't have priority concerns
    if (request.status === 'approved' || request.status === 'rejected') {
      return 'normal';
    }
    
    const daysSinceCreated = differenceInDays(new Date(), new Date(request.created_at));
    const daysSinceUpdated = request.responded_at 
      ? differenceInDays(new Date(), new Date(request.responded_at))
      : daysSinceCreated;
    
    if (daysSinceUpdated > 7) return 'urgent';
    if (daysSinceUpdated > 3 || request.status === 'under_review') return 'high';
    return 'normal';
  };
  
  // Calculate progress percentage
  const calculateProgress = (request: any): number => {
    // Simple calculation based on status
    const statusProgress: Record<string, number> = {
      'requested': 0,
      'pending': 10,
      'onboarding_initiated': 25,
      'under_review': 75,
      'approved': 100,
      'declined': 100,
    };
    return statusProgress[request.status] || 0;
  };
  
  // Get alert status for a request
  const getAlertStatus = (request: any) => {
    // Completed statuses should show success, not stalled alerts
    if (request.status === 'approved') {
      return { level: 'success', icon: '✅', message: 'Complete' };
    }
    if (request.status === 'rejected') {
      return { level: 'ended', icon: '❌', message: 'Declined' };
    }
    
    const daysSinceCreated = differenceInDays(new Date(), new Date(request.created_at));
    const daysSinceUpdated = request.responded_at 
      ? differenceInDays(new Date(), new Date(request.responded_at))
      : daysSinceCreated;
    
    if (daysSinceUpdated > 7) return { level: 'critical', icon: '🔴', message: 'Stalled > 7 days' };
    if (daysSinceUpdated > 3) return { level: 'warning', icon: '🟡', message: 'Pending > 3 days' };
    if (request.status === 'under_review') return { level: 'action', icon: '⚡', message: 'Needs review' };
    return { level: 'normal', icon: '🟢', message: 'On track' };
  };
  
  // Apply filters
  const filteredRequests = useMemo(() => {
    return requests.filter(request => {
      // Date range
      if (filters.dateFrom && new Date(request.created_at) < filters.dateFrom) return false;
      if (filters.dateTo && new Date(request.created_at) > filters.dateTo) return false;
      
      // Progress range
      if (filters.progressRange !== 'all') {
        const progress = calculateProgress(request);
        const [min, max] = filters.progressRange.split('-').map(Number);
        if (progress < min || progress > max) return false;
      }
      
      // Time in stage
      if (filters.timeInStage !== 'all') {
        const days = differenceInDays(new Date(), new Date(request.created_at));
        if (filters.timeInStage === '<1d' && days >= 1) return false;
        if (filters.timeInStage === '1-3d' && (days < 1 || days > 3)) return false;
        if (filters.timeInStage === '3-7d' && (days < 3 || days > 7)) return false;
        if (filters.timeInStage === '>7d' && days <= 7) return false;
      }
      
      // Branch
      if (filters.branchId !== 'all' && request.branch_id !== filters.branchId) return false;
      
      // Priority
      if (filters.priority !== 'all') {
        const requestPriority = calculatePriority(request);
        if (requestPriority !== filters.priority) return false;
      }
      
      return true;
    });
  }, [requests, filters]);
  
  // Selection handlers
  const toggleSelection = (requestId: string) => {
    setSelectedRequests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
  };
  
  const selectAll = () => {
    setSelectedRequests(new Set(filteredRequests.map(r => r.id)));
  };
  
  const clearSelection = () => {
    setSelectedRequests(new Set());
  };
  
  const isSelected = (requestId: string) => {
    return selectedRequests.has(requestId);
  };
  
  // Export data preparation
  const prepareExportData = (): ExportData[] => {
    const dataToExport = selectedRequests.size > 0 
      ? requests.filter(r => selectedRequests.has(r.id))
      : filteredRequests;
    
    return dataToExport.map(request => ({
      supplier_company_name: request.supplier_company_name || 'N/A',
      supplier_email: request.supplier_email,
      status: request.status,
      created_at: request.created_at,
      responded_at: request.responded_at,
      progress: calculateProgress(request),
      documents_submitted: 0, // Would need to fetch from onboarding_document_submissions
      documents_required: 0, // Would need to fetch from onboarding_document_requirements
      time_in_stage_days: differenceInDays(new Date(), new Date(request.created_at)),
      branch_name: request.branch?.branch_name,
    }));
  };
  
  return {
    filters,
    setFilters,
    filteredRequests,
    selectedRequests,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    calculatePriority,
    calculateProgress,
    getAlertStatus,
    prepareExportData,
  };
};
