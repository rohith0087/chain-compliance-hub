import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronUp } from 'lucide-react';

interface ReviewPaginationProps {
  currentPage: number;
  totalPages: number;
  pageStart: number;
  pageSize: number;
  totalCount: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: readonly number[];
}

export default function ReviewPagination({
  currentPage,
  totalPages,
  pageStart,
  pageSize,
  totalCount,
  itemLabel,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 25, 50],
}: ReviewPaginationProps) {
  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxButtons = 5;
    let start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);
    for (let p = start; p <= end; p += 1) pages.push(p);
    return pages;
  }, [currentPage, totalPages]);

  if (totalCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        Showing {pageStart + 1} to {Math.min(pageStart + pageSize, totalCount)} of {totalCount} {itemLabel}
      </p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => onPageChange(currentPage - 1)}>
            <ChevronUp className="w-4 h-4 -rotate-90" />
          </Button>
          {pageNumbers.map((p) => (
            <Button
              key={p}
              size="icon"
              variant={p === currentPage ? 'default' : 'outline'}
              className="h-8 w-8"
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          ))}
          <Button size="icon" variant="outline" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
            <ChevronUp className="w-4 h-4 rotate-90" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Rows per page:</span>
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
            <SelectTrigger className="h-8 w-[70px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
