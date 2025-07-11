
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Filter, Users, BarChart3, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

interface Buyer {
  id: string;
  company_name: string;
  industry: string;
}

interface AnalyticsFiltersProps {
  buyers: Buyer[];
  selectedBuyers: string[];
  onBuyersChange: (buyers: string[]) => void;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
  category: string;
  onCategoryChange: (category: string) => void;
  comparisonMode: boolean;
  onComparisonModeChange: (mode: boolean) => void;
}

const AnalyticsFilters = ({
  buyers,
  selectedBuyers,
  onBuyersChange,
  dateRange,
  onDateRangeChange,
  category,
  onCategoryChange,
  comparisonMode,
  onComparisonModeChange
}: AnalyticsFiltersProps) => {
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);

  const handleBuyerToggle = (buyerId: string) => {
    if (selectedBuyers.includes(buyerId)) {
      onBuyersChange(selectedBuyers.filter(id => id !== buyerId));
    } else {
      onBuyersChange([...selectedBuyers, buyerId]);
    }
  };

  const removeBuyer = (buyerId: string) => {
    onBuyersChange(selectedBuyers.filter(id => id !== buyerId));
  };

  const clearAllFilters = () => {
    onBuyersChange([]);
    onDateRangeChange('30d');
    onCategoryChange('all');
    onComparisonModeChange(false);
  };

  const selectedBuyerNames = buyers
    .filter(buyer => selectedBuyers.includes(buyer.id))
    .map(buyer => buyer.company_name);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="w-5 h-5" />
          Analytics Filters
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Buyer Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Buyers</label>
            <div className="relative">
              <Button
                variant="outline"
                onClick={() => setShowBuyerDropdown(!showBuyerDropdown)}
                className="w-full justify-between"
              >
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {selectedBuyers.length === 0 
                    ? 'All Buyers'
                    : `${selectedBuyers.length} Selected`
                  }
                </span>
              </Button>
              
              {showBuyerDropdown && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  <div className="p-2 space-y-2">
                    {buyers.map((buyer) => (
                      <div key={buyer.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={buyer.id}
                          checked={selectedBuyers.includes(buyer.id)}
                          onCheckedChange={() => handleBuyerToggle(buyer.id)}
                        />
                        <label
                          htmlFor={buyer.id}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {buyer.company_name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Selected Buyers Tags */}
            {selectedBuyers.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedBuyerNames.map((name, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {name}
                    <X 
                      className="w-3 h-3 ml-1 cursor-pointer" 
                      onClick={() => removeBuyer(selectedBuyers[index])}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Date Range</label>
            <Select value={dateRange} onValueChange={onDateRangeChange}>
              <SelectTrigger>
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
                <SelectItem value="180d">Last 180 Days</SelectItem>
                <SelectItem value="1y">Last Year</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Select value={category} onValueChange={onCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Insurance">Insurance</SelectItem>
                <SelectItem value="Certifications">Certifications</SelectItem>
                <SelectItem value="Financial">Financial</SelectItem>
                <SelectItem value="Safety">Safety</SelectItem>
                <SelectItem value="Quality">Quality</SelectItem>
                <SelectItem value="Environmental">Environmental</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Comparison Mode */}
          <div className="space-y-2">
            <label className="text-sm font-medium">View Mode</label>
            <Button
              variant={comparisonMode ? "default" : "outline"}
              onClick={() => onComparisonModeChange(!comparisonMode)}
              className="w-full"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              {comparisonMode ? 'Comparison View' : 'Standard View'}
            </Button>
          </div>
        </div>

        {/* Clear Filters */}
        <div className="flex justify-end mt-4">
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            Clear All Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AnalyticsFilters;
