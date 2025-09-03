
import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X } from 'lucide-react';

interface DocumentsFilterProps {
  filters: {
    search: string;
    status: string;
    category: string;
    documentType: string;
    supplier: string;
    expirationStatus: string;
    dateRange: string;
  };
  onFiltersChange: (filters: any) => void;
  showExpirationFilter?: boolean;
  availableSuppliers?: { id: string; company_name: string; documentCount: number }[];
}

const DocumentsFilter = ({ filters, onFiltersChange, showExpirationFilter = false, availableSuppliers = [] }: DocumentsFilterProps) => {
  const [localSearchValue, setLocalSearchValue] = useState(filters.search);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  const updateFilter = useCallback((key: string, value: string) => {
    // Convert "all" values back to empty strings for the filter logic
    const actualValue = value === 'all' ? '' : value;
    onFiltersChange({ ...filters, [key]: actualValue });
  }, [filters, onFiltersChange]);

  const debouncedSearchUpdate = useCallback((searchValue: string) => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      updateFilter('search', searchValue);
    }, 300);
  }, [updateFilter]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearchValue(value);
    debouncedSearchUpdate(value);
  }, [debouncedSearchUpdate]);

  const clearFilters = () => {
    setLocalSearchValue('');
    onFiltersChange({
      search: '',
      status: '',
      category: '',
      documentType: '',
      supplier: '',
      expirationStatus: '',
      dateRange: ''
    });
  };

  // Convert empty strings to "all" for display purposes
  const getDisplayValue = (value: string) => value === '' ? 'all' : value;

  const activeFiltersCount = Object.values(filters).filter(value => value !== '').length;

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Document Filters
            {activeFiltersCount > 0 && (
              <Badge variant="secondary">{activeFiltersCount} active</Badge>
            )}
          </CardTitle>
          {activeFiltersCount > 0 && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search documents..."
              value={localSearchValue}
              onChange={handleSearchChange}
              className="pl-10"
              autoComplete="off"
            />
          </div>

          {/* Status Filter */}
          <Select value={getDisplayValue(filters.status)} onValueChange={(value) => updateFilter('status', value)}>
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select value={getDisplayValue(filters.category)} onValueChange={(value) => updateFilter('category', value)}>
            <SelectTrigger>
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="compliance">Compliance</SelectItem>
              <SelectItem value="certification">Certification</SelectItem>
              <SelectItem value="insurance">Insurance</SelectItem>
              <SelectItem value="quality">Quality</SelectItem>
              <SelectItem value="safety">Safety</SelectItem>
              <SelectItem value="financial">Financial</SelectItem>
            </SelectContent>
          </Select>

          {/* Document Type Filter */}
          <Select value={getDisplayValue(filters.documentType)} onValueChange={(value) => updateFilter('documentType', value)}>
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="certificate">Certificate</SelectItem>
              <SelectItem value="license">License</SelectItem>
              <SelectItem value="permit">Permit</SelectItem>
              <SelectItem value="policy">Policy</SelectItem>
              <SelectItem value="report">Report</SelectItem>
              <SelectItem value="invoice">Invoice</SelectItem>
            </SelectContent>
          </Select>

          {/* Supplier Filter */}
          <Select value={getDisplayValue(filters.supplier)} onValueChange={(value) => updateFilter('supplier', value)}>
            <SelectTrigger>
              <SelectValue placeholder="All Suppliers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Suppliers</SelectItem>
              {availableSuppliers.map((supplier) => (
                <SelectItem key={supplier.id} value={supplier.id}>
                  {supplier.company_name} ({supplier.documentCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Expiration Status Filter (for suppliers) */}
          {showExpirationFilter && (
            <Select value={getDisplayValue(filters.expirationStatus)} onValueChange={(value) => updateFilter('expirationStatus', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Expiration Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Documents</SelectItem>
                <SelectItem value="expiring_soon">Expiring Soon (30 days)</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="valid">Valid</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Date Range Filter */}
          <Select value={getDisplayValue(filters.dateRange)} onValueChange={(value) => updateFilter('dateRange', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="last_7_days">Last 7 Days</SelectItem>
              <SelectItem value="last_30_days">Last 30 Days</SelectItem>
              <SelectItem value="last_90_days">Last 90 Days</SelectItem>
              <SelectItem value="this_year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

export default DocumentsFilter;
