import React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  { value: 'high', label: 'High Risk (<70%)', color: 'destructive' },
  { value: 'medium', label: 'Medium Risk (70-85%)', color: 'warning' },
  { value: 'good', label: 'Good (>85%)', color: 'success' }
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
    <div className="space-y-4 mb-6">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search suppliers or documents..."
          value={filters.searchQuery}
          onChange={(e) => updateFilter('searchQuery', e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Industry Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              🏭 Industry
              {filters.industries.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {filters.industries.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-4 bg-popover z-50">
            <div className="space-y-2">
              <h4 className="font-medium text-sm mb-3">Filter by Industry</h4>
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

        {/* Item Category Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              📦 Item Category
              {filters.itemCategories.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {filters.itemCategories.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-4 bg-popover z-50">
            <div className="space-y-2">
              <h4 className="font-medium text-sm mb-3">Filter by Item Category</h4>
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
            <Button variant="outline" size="sm" className="h-9">
              📊 Status
              {filters.statuses.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {filters.statuses.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-4 bg-popover z-50">
            <div className="space-y-2">
              <h4 className="font-medium text-sm mb-3">Filter by Status</h4>
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
            <Button variant="outline" size="sm" className="h-9">
              🎯 Risk Level
              {filters.riskLevels.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                  {filters.riskLevels.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-4 bg-popover z-50">
            <div className="space-y-2">
              <h4 className="font-medium text-sm mb-3">Filter by Risk Level</h4>
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

        {/* Clear All Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-9"
          >
            🔄 Clear All
          </Button>
        )}
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Active filters:</span>
          
          {filters.searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: {filters.searchQuery}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => removeFilter('searchQuery')}
              />
            </Badge>
          )}
          
          {filters.industries.map((industry) => (
            <Badge key={industry} variant="secondary" className="gap-1">
              {industry}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => removeFilter('industries', industry)}
              />
            </Badge>
          ))}
          
          {filters.itemCategories.map((category) => (
            <Badge key={category} variant="secondary" className="gap-1">
              {category}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => removeFilter('itemCategories', category)}
              />
            </Badge>
          ))}
          
          {filters.statuses.map((status) => (
            <Badge key={status} variant="secondary" className="gap-1 capitalize">
              {status}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => removeFilter('statuses', status)}
              />
            </Badge>
          ))}
          
          {filters.riskLevels.map((risk) => (
            <Badge key={risk} variant="secondary" className="gap-1 capitalize">
              {risk} risk
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => removeFilter('riskLevels', risk)}
              />
            </Badge>
          ))}
        </div>
      )}

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-foreground">{supplierCount}</span> of{' '}
        <span className="font-medium text-foreground">{totalSuppliers}</span> suppliers
      </div>
    </div>
  );
}
