import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Send, AlertCircle, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

interface OnboardingPipelineTableViewProps {
  requests: any[];
  selectedRequests: Set<string>;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  getAlertStatus: (request: any) => { level: string; icon: string; message: string };
  calculateProgress: (request: any) => number;
  requirementCounts: Record<string, number>;
  onCardClick: (request: any) => void;
  onSendReminder: (request: any, e: React.MouseEvent) => void;
  onPopulateRequirements: (requestId: string, e: React.MouseEvent) => void;
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  requested: { label: 'Requested', variant: 'outline' },
  invited: { label: 'Invited', variant: 'secondary' },
  pending: { label: 'Pending', variant: 'secondary' },
  onboarding_initiated: { label: 'Started', variant: 'default' },
  under_review: { label: 'Under Review', variant: 'default' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Declined', variant: 'destructive' },
};

export const OnboardingPipelineTableView = ({
  requests,
  selectedRequests,
  toggleSelection,
  selectAll,
  clearSelection,
  getAlertStatus,
  calculateProgress,
  requirementCounts,
  onCardClick,
  onSendReminder,
  onPopulateRequirements,
}: OnboardingPipelineTableViewProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<string>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Sort requests
  const sortedRequests = [...requests].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    
    if (sortField === 'created_at' || sortField === 'updated_at') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    }
    
    if (sortDir === 'asc') return aVal > bVal ? 1 : -1;
    return aVal < bVal ? 1 : -1;
  });

  // Pagination
  const totalPages = Math.ceil(sortedRequests.length / pageSize);
  const startIdx = (page - 1) * pageSize;
  const paginatedRequests = sortedRequests.slice(startIdx, startIdx + pageSize);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const allOnPageSelected = paginatedRequests.every(r => selectedRequests.has(r.id));

  const togglePageSelection = () => {
    if (allOnPageSelected) {
      paginatedRequests.forEach(r => {
        if (selectedRequests.has(r.id)) toggleSelection(r.id);
      });
    } else {
      paginatedRequests.forEach(r => {
        if (!selectedRequests.has(r.id)) toggleSelection(r.id);
      });
    }
  };

  const getStatusDotColor = (alertStatus: { level: string }) => {
    if (alertStatus.level === 'critical') return 'bg-destructive';
    if (alertStatus.level === 'warning') return 'bg-yellow-500';
    if (alertStatus.level === 'success') return 'bg-green-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-4">
      {/* Table Controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {startIdx + 1}-{Math.min(startIdx + pageSize, requests.length)} of {requests.length}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Per page:</span>
          <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-10">
                <Checkbox
                  checked={allOnPageSelected && paginatedRequests.length > 0}
                  onCheckedChange={togglePageSelection}
                />
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="h-8 -ml-3" onClick={() => handleSort('supplier_email')}>
                  Supplier
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="h-8 -ml-3" onClick={() => handleSort('status')}>
                  Status
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-32">Progress</TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" className="h-8 -ml-3" onClick={() => handleSort('created_at')}>
                  Created
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-20">Alert</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRequests.map((request) => {
              const alertStatus = getAlertStatus(request);
              const progress = calculateProgress(request);
              const statusInfo = STATUS_LABELS[request.status] || { label: request.status, variant: 'outline' as const };
              
              return (
                <TableRow 
                  key={request.id} 
                  className={`cursor-pointer hover:bg-muted/50 ${selectedRequests.has(request.id) ? 'bg-primary/5' : ''}`}
                  onClick={() => onCardClick(request)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedRequests.has(request.id)}
                      onCheckedChange={() => toggleSelection(request.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm truncate max-w-[200px]">
                        {request.supplier_company_name || request.supplier_email}
                      </p>
                      {request.supplier_company_name && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {request.supplier_email}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                  </TableCell>
                  <TableCell>
                    {request.status !== 'approved' && request.status !== 'rejected' ? (
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-1.5 w-16" />
                        <span className="text-xs text-muted-foreground">{progress}%</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className={`inline-block h-2.5 w-2.5 rounded-full ${getStatusDotColor(alertStatus)}`} />
                        </TooltipTrigger>
                        <TooltipContent>{alertStatus.message}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onCardClick(request)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>View</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {(request.status === 'pending' || request.status === 'onboarding_initiated' || request.status === 'invited') && (
                        <>
                          {requirementCounts[request.id] === 0 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => onPopulateRequirements(request.id, e)}>
                                    <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Populate Requirements</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => onSendReminder(request, e)}>
                                  <Send className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Send Reminder</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setPage(Math.max(1, page - 1))}
                  className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => setPage(pageNum)}
                      isActive={page === pageNum}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
};
