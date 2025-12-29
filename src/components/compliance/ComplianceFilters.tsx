import React from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface ComplianceFiltersProps {
  filters: {
    searchQuery: string;
    industries: string[];
    itemCategories: string[];
    statuses: string[];
    riskLevels: string[];
  };
  onFiltersChange: (filters: any) => void;
  availableIndustries: string[];
  availableItemCategories: string[];
  availableStatuses: string[];
  supplierCount: number;
  totalSuppliers: number;
}

const RISK_LEVELS = [
  { value: 'high', label: 'High Risk (<70%)' },
  { value: 'medium', label: 'Medium Risk (70-85%)' },
  { value: 'good', label: 'Low Risk (>85%)' }
];

export function ComplianceFilters({
  filters,
  onFiltersChange,
  availableIndustries,
  availableItemCategories,
  availableStatuses,
  supplierCount,
  totalSuppliers
}: ComplianceFiltersProps) {
  const updateFilter = (key: string, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleMultiSelect = (key: string, value: string) => {
    const currentValues = filters[key as keyof typeof filters] as string[];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    updateFilter(key, newValues);
  };

  const clearAllFilters = () => {
    onFiltersChange({
      searchQuery: '',
      industries: [],
      itemCategories: [],
      statuses: [],
      riskLevels: []
    });
  };

  const removeFilter = (key: string, value?: string) => {
    if (value) {
      const currentValues = filters[key as keyof typeof filters] as string[];
      updateFilter(key, currentValues.filter(v => v !== value));
    } else {
      updateFilter(key, key === 'searchQuery' ? '' : []);
    }
  };

  const hasActiveFilters = filters.searchQuery || 
    filters.industries.length > 0 || 
    filters.itemCategories.length > 0 || 
    filters.statuses.length > 0 || 
    filters.riskLevels.length > 0;

  return (
    <div className="space-y-3 mb-4">
      {/* Search and Filters Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search suppliers..."
            value={filters.searchQuery}
            onChange={(e) => updateFilter('searchQuery', e.target.value)}
            className="pl-8 h-8 text-sm bg-background border-border"
          />
        </div>

        <div className="h-6 w-px bg-border mx-1" />

        {/* Industry Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-sm font-normal">
              Industry
              {filters.industries.length > 0 && (
                <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded">
                  {filters.industries.length}
                </span>
              )}
              <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 bg-popover z-50">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Filter by Industry</p>
              {availableIndustries.length > 0 ? (
                availableIndustries.map((industry) => (
                  <div key={industry} className="flex items-center space-x-2">
                    <Checkbox
                      id={`industry-${industry}`}
                      checked={filters.industries.includes(industry)}
                      onCheckedChange={() => toggleMultiSelect('industries', industry)}
                    />
                    <Label
                      htmlFor={`industry-${industry}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {industry}
                    </Label>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No industries available</p>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Category Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-sm font-normal">
              Category
              {filters.itemCategories.length > 0 && (
                <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded">
                  {filters.itemCategories.length}
                </span>
              )}
              <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 bg-popover z-50">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Filter by Category</p>
              {availableItemCategories.length > 0 ? (
                availableItemCategories.map((category) => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox
                      id={`category-${category}`}
                      checked={filters.itemCategories.includes(category)}
                      onCheckedChange={() => toggleMultiSelect('itemCategories', category)}
                    />
                    <Label
                      htmlFor={`category-${category}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {category}
                    </Label>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No categories available</p>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Status Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-sm font-normal">
              Status
              {filters.statuses.length > 0 && (
                <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded">
                  {filters.statuses.length}
                </span>
              )}
              <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 bg-popover z-50">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Filter by Status</p>
              {availableStatuses.map((status) => (
                <div key={status} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${status}`}
                    checked={filters.statuses.includes(status)}
                    onCheckedChange={() => toggleMultiSelect('statuses', status)}
                  />
                  <Label
                    htmlFor={`status-${status}`}
                    className="text-sm font-normal cursor-pointer capitalize"
                  >
                    {status}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Risk Level Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-sm font-normal">
              Risk Level
              {filters.riskLevels.length > 0 && (
                <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded">
                  {filters.riskLevels.length}
                </span>
              )}
              <ChevronDown className="ml-1 h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3 bg-popover z-50">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Filter by Risk</p>
              {RISK_LEVELS.map((risk) => (
                <div key={risk.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`risk-${risk.value}`}
                    checked={filters.riskLevels.includes(risk.value)}
                    onCheckedChange={() => toggleMultiSelect('riskLevels', risk.value)}
                  />
                  <Label
                    htmlFor={`risk-${risk.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {risk.label}
                  </Label>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Clear All */}
        {hasActiveFilters && (
          <>
            <div className="h-6 w-px bg-border mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 text-sm text-muted-foreground hover:text-foreground"
            >
              Clear all
            </Button>
          </>
        )}
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 items-center">
          {filters.searchQuery && (
            <Badge variant="secondary" className="gap-1 text-xs font-normal px-2 py-0.5">
              "{filters.searchQuery}"
              <X
                className="h-3 w-3 cursor-pointer opacity-60 hover:opacity-100"
                onClick={() => removeFilter('searchQuery')}
              />
            </Badge>
          )}
          
          {filters.industries.map((industry) => (
            <Badge key={industry} variant="secondary" className="gap-1 text-xs font-normal px-2 py-0.5">
              {industry}
              <X
                className="h-3 w-3 cursor-pointer opacity-60 hover:opacity-100"
                onClick={() => removeFilter('industries', industry)}
              />
            </Badge>
          ))}
          
          {filters.itemCategories.map((category) => (
            <Badge key={category} variant="secondary" className="gap-1 text-xs font-normal px-2 py-0.5">
              {category}
              <X
                className="h-3 w-3 cursor-pointer opacity-60 hover:opacity-100"
                onClick={() => removeFilter('itemCategories', category)}
              />
            </Badge>
          ))}
          
          {filters.statuses.map((status) => (
            <Badge key={status} variant="secondary" className="gap-1 text-xs font-normal px-2 py-0.5 capitalize">
              {status}
              <X
                className="h-3 w-3 cursor-pointer opacity-60 hover:opacity-100"
                onClick={() => removeFilter('statuses', status)}
              />
            </Badge>
          ))}
          
          {filters.riskLevels.map((risk) => (
            <Badge key={risk} variant="secondary" className="gap-1 text-xs font-normal px-2 py-0.5 capitalize">
              {risk} risk
              <X
                className="h-3 w-3 cursor-pointer opacity-60 hover:opacity-100"
                onClick={() => removeFilter('riskLevels', risk)}
              />
            </Badge>
          ))}
        </div>
      )}

      {/* Results Count */}
      <div className="text-xs text-muted-foreground">
        Showing <span className="font-medium text-foreground">{supplierCount}</span> of{' '}
        <span className="font-medium text-foreground">{totalSuppliers}</span> suppliers
      </div>
    </div>
  );
}