import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, X, Calendar, Download, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

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
    facilityLocation: string;
  };
  onFiltersChange: (filters: any) => void;
  showExpirationFilter?: boolean;
  availableSuppliers?: { id: string; company_name: string; documentCount: number }[];
  availableFacilities?: { id: string; name: string; location: string; documentCount: number }[];
  selectedDocuments: Set<string>;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkDownload: () => void;
  filteredDocumentsCount: number;
  totalDocumentsCount: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const EnhancedDocumentsFilter = ({ 
  filters, 
  onFiltersChange, 
  showExpirationFilter = false, 
  availableSuppliers = [],
  availableFacilities = [],
  selectedDocuments,
  onSelectAll,
  onClearSelection,
  onBulkDownload,
  filteredDocumentsCount,
  totalDocumentsCount,
  onRefresh,
  isRefreshing = false
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
      specificYear: '',
      facilityLocation: ''
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

            {/* Facility Location Filter */}
            <Select value={getDisplayValue(filters.facilityLocation)} onValueChange={(value) => updateFilter('facilityLocation', value)}>
              <SelectTrigger>
                <SelectValue placeholder="All Facilities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Facilities</SelectItem>
                {availableFacilities.map((facility) => (
                  <SelectItem key={facility.id} value={facility.id}>
                    <div className="flex items-center gap-2">
                      <span>{facility.name}</span>
                      {facility.location && (
                        <span className="text-xs text-muted-foreground">
                          ({facility.location})
                        </span>
                      )}
                    </div>
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
      <Card className="bg-gradient-to-br from-[hsl(var(--pink-accent))]/5 to-purple-500/5 border-[hsl(var(--pink-accent))]/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--pink-accent))] to-purple-500 flex items-center justify-center">
              <Download className="w-4 h-4 text-white" />
            </div>
            Bulk Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <Button 
                variant="outline" 
                size="sm"
                onClick={onSelectAll}
                disabled={filteredDocumentsCount === 0}
                className="border-[hsl(var(--blue-accent))]/30 hover:bg-[hsl(var(--blue-accent))]/10"
              >
                Select All Filtered ({filteredDocumentsCount})
              </Button>
              {selectedDocuments.size > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={onClearSelection}
                  className="border-destructive/30 hover:bg-destructive/10"
                >
                  <X className="w-3 h-3 mr-1" />
                  Clear Selection
                </Button>
              )}
              <Badge className="bg-gradient-to-r from-[hsl(var(--pink-accent))] to-purple-500 text-white border-0">
                {selectedDocuments.size} selected
              </Badge>
            </div>
            <Button 
              onClick={onBulkDownload}
              disabled={selectedDocuments.size === 0}
              className="flex items-center gap-2 bg-gradient-to-r from-[hsl(var(--blue-accent))] to-[hsl(var(--accent))] hover:opacity-90 text-white border-0 shadow-[0_4px_12px_hsl(var(--blue-accent)/0.3)]"
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