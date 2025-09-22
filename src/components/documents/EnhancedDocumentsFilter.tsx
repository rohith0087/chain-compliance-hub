import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X, Calendar, Download } from 'lucide-react';

interface EnhancedDocumentsFilterProps {
  filters: {
    search: string;
    status: string;
    category: string;
    documentType: string;
    supplier: string;
    expirationStatus: string;
    dateRange: string;
    uploadDateRange: string;
    specificYear: string;
  };
  onFiltersChange: (filters: any) => void;
  showExpirationFilter?: boolean;
  availableSuppliers?: { id: string; company_name: string; documentCount: number }[];
  selectedDocuments: Set<string>;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkDownload: () => void;
  filteredDocumentsCount: number;
  totalDocumentsCount: number;
}

const EnhancedDocumentsFilter = ({ 
  filters, 
  onFiltersChange, 
  showExpirationFilter = false, 
  availableSuppliers = [],
  selectedDocuments,
  onSelectAll,
  onClearSelection,
  onBulkDownload,
  filteredDocumentsCount,
  totalDocumentsCount
}: EnhancedDocumentsFilterProps) => {
  const [localSearchValue, setLocalSearchValue] = useState(filters.search);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  const updateFilter = useCallback((key: string, value: string) => {
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
      dateRange: '',
      uploadDateRange: '',
      specificYear: ''
    });
  };

  const getDisplayValue = (value: string) => value === '' ? 'all' : value;
  const activeFiltersCount = Object.values(filters).filter(value => value !== '').length;

  // Quick filter presets
  const applyQuickFilter = (filterType: string) => {
    switch (filterType) {
      case 'valid_2024_2025':
        onFiltersChange({
          ...filters,
          expirationStatus: 'valid',
          specificYear: '2024-2025'
        });
        break;
      case 'expiring_soon':
        onFiltersChange({
          ...filters,
          expirationStatus: 'expiring_soon'
        });
        break;
      case 'last_30_days':
        onFiltersChange({
          ...filters,
          uploadDateRange: 'last_30_days'
        });
        break;
      case 'current_year':
        onFiltersChange({
          ...filters,
          specificYear: '2025'
        });
        break;
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Quick Filters</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => applyQuickFilter('valid_2024_2025')}
            >
              2024-2025 Valid
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => applyQuickFilter('expiring_soon')}
            >
              Expiring Soon
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => applyQuickFilter('last_30_days')}
            >
              Last 30 Days
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => applyQuickFilter('current_year')}
            >
              Current Year
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Filters */}
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

            {/* Status Filter */}
            <Select value={getDisplayValue(filters.status)} onValueChange={(value) => updateFilter('status', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="approved">Valid Documents</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>

            {/* Expiration Status Filter */}
            {showExpirationFilter && (
              <Select value={getDisplayValue(filters.expirationStatus)} onValueChange={(value) => updateFilter('expirationStatus', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Validity Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Documents</SelectItem>
                  <SelectItem value="valid">Valid Documents</SelectItem>
                  <SelectItem value="expiring_soon">Expiring Soon (30 days)</SelectItem>
                  <SelectItem value="expired">Expired Documents</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Specific Year/Range Filter */}
            <Select value={getDisplayValue(filters.specificYear)} onValueChange={(value) => updateFilter('specificYear', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Document Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
                <SelectItem value="2023">2023</SelectItem>
                <SelectItem value="2024-2025">2024-2025</SelectItem>
                <SelectItem value="2023-2024">2023-2024</SelectItem>
              </SelectContent>
            </Select>

            {/* Upload Date Range Filter */}
            <Select value={getDisplayValue(filters.uploadDateRange)} onValueChange={(value) => updateFilter('uploadDateRange', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Upload Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="last_7_days">Last 7 Days</SelectItem>
                <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
              </SelectContent>
            </Select>

            {/* Category Filter */}
            <Select value={getDisplayValue(filters.category)} onValueChange={(value) => updateFilter('category', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
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
                <SelectValue placeholder="Document Type" />
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
          </div>

          {/* Filter Summary */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {filteredDocumentsCount} of {totalDocumentsCount} documents
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Download className="w-5 h-5" />
            Bulk Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={onSelectAll}
                disabled={filteredDocumentsCount === 0}
              >
                Select All Filtered ({filteredDocumentsCount})
              </Button>
              {selectedDocuments.size > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onClearSelection}
                >
                  Clear Selection
                </Button>
              )}
              <Badge variant="secondary" className="ml-2">
                {selectedDocuments.size} selected
              </Badge>
            </div>
            <Button 
              onClick={onBulkDownload}
              disabled={selectedDocuments.size === 0}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download ZIP ({selectedDocuments.size})
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedDocumentsFilter;