
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileCheck, 
  AlertTriangle, 
  Clock, 
  Search,
  Download,
  Upload,
  Eye,
  Calendar,
  Building2,
  Users
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DocumentManagementProps {
  userType: 'sonicFranchise' | 'chickenProcessor' | 'farm';
  currentRole: 'buyer' | 'supplier';
}

const DocumentManagement = ({ userType, currentRole }: DocumentManagementProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Industry-specific document data
  const getDocumentsByUserType = () => {
    switch (userType) {
      case 'sonicFranchise':
        return currentRole === 'buyer' ? {
          // Documents requested from suppliers (buns, chicken, oil)
          documents: [
            {
              id: 1,
              name: 'Organic Certification - Sesame Buns',
              supplier: 'Premium Bakery Co',
              category: 'Food Safety',
              status: 'approved',
              expiryDate: '2024-12-15',
              lastUpdated: '2024-01-15',
              type: 'Certificate'
            },
            {
              id: 2,
              name: 'HACCP Plan - Chicken Processing',
              supplier: 'Fresh Poultry Inc',
              category: 'Food Safety',
              status: 'pending',
              expiryDate: '2024-08-30',
              lastUpdated: '2024-01-10',
              type: 'Plan'
            },
            {
              id: 3,
              name: 'Nutritional Analysis - Frying Oil',
              supplier: 'Golden Oil Supply',
              category: 'Quality Assurance',
              status: 'approved',
              expiryDate: '2024-09-20',
              lastUpdated: '2024-01-12',
              type: 'Report'
            },
            {
              id: 4,
              name: 'Allergen Statement - Bun Ingredients',
              supplier: 'Premium Bakery Co',
              category: 'Food Safety',
              status: 'expires_soon',
              expiryDate: '2024-02-28',
              lastUpdated: '2023-11-20',
              type: 'Statement'
            },
            {
              id: 5,
              name: 'Temperature Control Certificate',
              supplier: 'Fresh Poultry Inc',
              category: 'Cold Chain',
              status: 'approved',
              expiryDate: '2024-10-15',
              lastUpdated: '2024-01-08',
              type: 'Certificate'
            }
          ],
          title: 'Supplier Documents - Food Service Requirements'
        } : {
          // Documents provided to delivery services
          documents: [
            {
              id: 1,
              name: 'Food Handler Certification',
              buyer: 'DoorDash Delivery',
              category: 'Food Safety',
              status: 'approved',
              expiryDate: '2024-11-30',
              lastUpdated: '2024-01-20',
              type: 'Certificate'
            },
            {
              id: 2,
              name: 'Kitchen Sanitation Report',
              buyer: 'Uber Eats',
              category: 'Hygiene',
              status: 'approved',
              expiryDate: '2024-06-15',
              lastUpdated: '2024-01-18',
              type: 'Report'
            },
            {
              id: 3,
              name: 'Franchise License',
              buyer: 'GrubHub Partners',
              category: 'Legal',
              status: 'pending',
              expiryDate: '2025-01-01',
              lastUpdated: '2024-01-15',
              type: 'License'
            }
          ],
          title: 'Customer Documents - Delivery Platform Requirements'
        };

      case 'chickenProcessor':
        return currentRole === 'buyer' ? {
          // Documents requested from farms
          documents: [
            {
              id: 1,
              name: 'Organic Farm Certification',
              supplier: 'Green Valley Farms',
              category: 'Organic Compliance',
              status: 'approved',
              expiryDate: '2024-12-31',
              lastUpdated: '2024-01-10',
              type: 'Certificate'
            },
            {
              id: 2,
              name: 'Animal Welfare Standards',
              supplier: 'Happy Chicken Farm',
              category: 'Animal Welfare',
              status: 'approved',
              expiryDate: '2024-09-15',
              lastUpdated: '2024-01-05',
              type: 'Certification'
            },
            {
              id: 3,
              name: 'Feed Composition Report',
              supplier: 'Natural Feed Co',
              category: 'Feed Safety',
              status: 'expires_soon',
              expiryDate: '2024-03-01',
              lastUpdated: '2023-12-15',
              type: 'Report'
            },
            {
              id: 4,
              name: 'Veterinary Health Certificate',
              supplier: 'Green Valley Farms',
              category: 'Animal Health',
              status: 'pending',
              expiryDate: '2024-07-20',
              lastUpdated: '2024-01-12',
              type: 'Certificate'
            }
          ],
          title: 'Farm Documents - Raw Material Compliance'
        } : {
          // Documents provided to restaurants
          documents: [
            {
              id: 1,
              name: 'USDA Inspection Certificate',
              buyer: 'Sonic Drive-In',
              category: 'Food Safety',
              status: 'approved',
              expiryDate: '2024-08-15',
              lastUpdated: '2024-01-20',
              type: 'Certificate'
            },
            {
              id: 2,
              name: 'Processing Plant License',
              buyer: 'McDonald\'s Corp',
              category: 'Legal',
              status: 'approved',
              expiryDate: '2024-12-31',
              lastUpdated: '2024-01-15',
              type: 'License'
            },
            {
              id: 3,
              name: 'Cold Chain Documentation',
              buyer: 'KFC Regional',
              category: 'Temperature Control',
              status: 'pending',
              expiryDate: '2024-06-30',
              lastUpdated: '2024-01-18',
              type: 'Report'
            }
          ],
          title: 'Restaurant Documents - Processed Chicken Compliance'
        };

      case 'farm':
        return {
          // Farm only supplies, doesn't buy
          documents: [
            {
              id: 1,
              name: 'Organic Certification - USDA',
              buyer: 'Premium Processors Inc',
              category: 'Organic Compliance',
              status: 'approved',
              expiryDate: '2024-12-31',
              lastUpdated: '2024-01-15',
              type: 'Certificate'
            },
            {
              id: 2,
              name: 'Soil Health Report',
              buyer: 'Natural Foods Co',
              category: 'Environmental',
              status: 'approved',
              expiryDate: '2024-09-30',
              lastUpdated: '2024-01-10',
              type: 'Report'
            },
            {
              id: 3,
              name: 'Pesticide-Free Declaration',
              buyer: 'Premium Processors Inc',
              category: 'Chemical Safety',
              status: 'expires_soon',
              expiryDate: '2024-02-28',
              lastUpdated: '2023-11-15',
              type: 'Declaration'
            },
            {
              id: 4,
              name: 'Animal Welfare Audit',
              buyer: 'Ethical Foods Ltd',
              category: 'Animal Welfare',
              status: 'pending',
              expiryDate: '2024-06-15',
              lastUpdated: '2024-01-12',
              type: 'Audit Report'
            },
            {
              id: 5,
              name: 'Water Quality Test Results',
              buyer: 'Clean Meat Co',
              category: 'Environmental',
              status: 'approved',
              expiryDate: '2024-05-20',
              lastUpdated: '2024-01-08',
              type: 'Test Results'
            }
          ],
          title: 'Farm Compliance Documents'
        };

      default:
        return { documents: [], title: 'Documents' };
    }
  };

  const { documents, title } = getDocumentsByUserType();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'expires_soon':
        return 'bg-orange-100 text-orange-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <FileCheck className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'expires_soon':
      case 'expired':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <FileCheck className="w-4 h-4" />;
    }
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || doc.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getPartnerLabel = () => {
    if (userType === 'farm') return 'Buyer';
    return currentRole === 'buyer' ? 'Supplier' : 'Buyer';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <p className="text-gray-600">
            {currentRole === 'buyer' ? 'Documents from your suppliers' : 'Documents provided to your customers'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Upload className="w-4 h-4 mr-2" />
            Upload Document
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="expires_soon">Expires Soon</option>
          <option value="expired">Expired</option>
        </select>
      </div>

      {/* Documents Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document Name</TableHead>
                <TableHead>{getPartnerLabel()}</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.name}</TableCell>
                  <TableCell>
                    {'supplier' in doc ? doc.supplier : doc.buyer}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{doc.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(doc.status)}>
                      {getStatusIcon(doc.status)}
                      <span className="ml-1 capitalize">{doc.status.replace('_', ' ')}</span>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {doc.expiryDate}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {filteredDocuments.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <FileCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
            <p className="text-gray-500">
              {searchTerm || filterStatus !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Upload your first document to get started.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DocumentManagement;
