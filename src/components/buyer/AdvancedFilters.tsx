import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Filter, X, ChevronDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface FilterOptions {
  progressRange: string;
  timeInStage: string;
  branchId: string;
  documentStatus: string;
  priority: string;
  status: string;
  dateFrom?: Date;
  dateTo?: Date;
}

interface AdvancedFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  branches?: Array<{ id: string; branch_name: string }>;
}

export const AdvancedFilters = ({ filters, onFiltersChange, branches = [] }: AdvancedFiltersProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'dateFrom' || key === 'dateTo') return value !== undefined;
    return value !== 'all';
  }).length;
  
  const clearFilters = () => {
    onFiltersChange({
      progressRange: 'all',
      timeInStage: 'all',
      branchId: 'all',
      documentStatus: 'all',
      priority: 'all',
      status: 'all',
      dateFrom: undefined,
      dateTo: undefined,
    });
  };
  
  const removeFilter = (key: keyof FilterOptions) => {
    if (key === 'dateFrom' || key === 'dateTo') {
      onFiltersChange({ ...filters, [key]: undefined });
    } else {
      onFiltersChange({ ...filters, [key]: 'all' });
    }
  };
  
  const getActiveFilterBadges = () => {
    const badges = [];
    if (filters.progressRange !== 'all') badges.push({ key: 'progressRange', label: `Progress: ${filters.progressRange}` });
    if (filters.timeInStage !== 'all') badges.push({ key: 'timeInStage', label: `Time: ${filters.timeInStage}` });
    if (filters.branchId !== 'all') {
      const branch = branches.find(b => b.id === filters.branchId);
      badges.push({ key: 'branchId', label: `Branch: ${branch?.branch_name || 'Unknown'}` });
    }
    if (filters.documentStatus !== 'all') badges.push({ key: 'documentStatus', label: `Docs: ${filters.documentStatus}` });
    if (filters.priority !== 'all') badges.push({ key: 'priority', label: `Priority: ${filters.priority}` });
    if (filters.status !== 'all') {
      const statusLabels: Record<string, string> = {
        'requested': 'Requested',
        'invited': 'Invited',
        'pending': 'Pending',
        'onboarding_initiated': 'Started',
        'under_review': 'Under Review',
        'approved': 'Approved',
        'rejected': 'Declined'
      };
      badges.push({ key: 'status', label: `Status: ${statusLabels[filters.status] || filters.status}` });
    }
    if (filters.dateFrom) badges.push({ key: 'dateFrom', label: `From: ${format(filters.dateFrom, 'PP')}` });
    if (filters.dateTo) badges.push({ key: 'dateTo', label: `To: ${format(filters.dateTo, 'PP')}` });
    return badges;
  };
  
  return (
    <div className="space-y-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Advanced Filters
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1">{activeFiltersCount}</Badge>
              )}
              <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear All
            </Button>
          )}
        </div>
        
        <CollapsibleContent className="mt-4">
          <div className="grid grid-cols-3 gap-4 p-4 border rounded-lg">
            {/* Date Range */}
            <div className="space-y-2">
              <Label>Date From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    {filters.dateFrom ? format(filters.dateFrom, 'PP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateFrom}
                    onSelect={(date) => onFiltersChange({ ...filters, dateFrom: date })}
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label>Date To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    {filters.dateTo ? format(filters.dateTo, 'PP') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.dateTo}
                    onSelect={(date) => onFiltersChange({ ...filters, dateTo: date })}
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            {/* Document Progress */}
            <div className="space-y-2">
              <Label>Document Progress</Label>
              <Select value={filters.progressRange} onValueChange={(value) => onFiltersChange({ ...filters, progressRange: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="0-25">0-25%</SelectItem>
                  <SelectItem value="25-50">25-50%</SelectItem>
                  <SelectItem value="50-75">50-75%</SelectItem>
                  <SelectItem value="75-100">75-100%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Time in Stage */}
            <div className="space-y-2">
              <Label>Time in Current Stage</Label>
              <Select value={filters.timeInStage} onValueChange={(value) => onFiltersChange({ ...filters, timeInStage: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="<1d">Less than 1 day</SelectItem>
                  <SelectItem value="1-3d">1-3 days</SelectItem>
                  <SelectItem value="3-7d">3-7 days</SelectItem>
                  <SelectItem value=">7d">More than 7 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Branch Filter */}
            {branches.length > 0 && (
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select value={filters.branchId} onValueChange={(value) => onFiltersChange({ ...filters, branchId: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.branch_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Document Status */}
            <div className="space-y-2">
              <Label>Document Status</Label>
              <Select value={filters.documentStatus} onValueChange={(value) => onFiltersChange({ ...filters, documentStatus: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                  <SelectItem value="incomplete">Incomplete</SelectItem>
                  <SelectItem value="missing">Missing Documents</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Priority */}
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={filters.priority} onValueChange={(value) => onFiltersChange({ ...filters, priority: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Onboarding Status */}
            <div className="space-y-2">
              <Label>Onboarding Status</Label>
              <Select value={filters.status} onValueChange={(value) => onFiltersChange({ ...filters, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="requested">Requested</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="onboarding_initiated">Started</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
      
      {/* Active Filter Badges */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {getActiveFilterBadges().map((badge) => (
            <Badge key={badge.key} variant="secondary" className="gap-1">
              {badge.label}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => removeFilter(badge.key as keyof FilterOptions)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};
