'use client';

import { forwardRef } from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { PngIcon } from './png-icon';
import { useI18n } from '@/lib/i18n/useI18n';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  showPageNumbers?: boolean;
  maxVisiblePages?: number;
}

export const Pagination = forwardRef<HTMLDivElement, PaginationProps>(
  (
    {
      currentPage,
      totalPages,
      onPageChange,
      className,
      showPageNumbers = true,
      maxVisiblePages = 5,
    },
    ref
  ) => {
    const getVisiblePages = () => {
      if (totalPages <= maxVisiblePages) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }

      const pages: (number | 'ellipsis')[] = [];
      const halfVisible = Math.floor(maxVisiblePages / 2);

      let start = Math.max(1, currentPage - halfVisible);
      let end = Math.min(totalPages, start + maxVisiblePages - 1);

      if (end - start < maxVisiblePages - 1) {
        start = Math.max(1, end - maxVisiblePages + 1);
      }

      if (start > 1) {
        pages.push(1);
        if (start > 2) pages.push('ellipsis');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages) {
        if (end < totalPages - 1) pages.push('ellipsis');
        pages.push(totalPages);
      }

      return pages;
    };

    if (totalPages <= 1) return null;

    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-center gap-1', className)}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {showPageNumbers &&
          getVisiblePages().map((page, index) =>
            page === 'ellipsis' ? (
              <span
                key={`ellipsis-${index}`}
                className="flex items-center justify-center w-8 h-8"
              >
                <PngIcon
                  name="MoreHorizontal"
                  size={16}
                  className="h-4 w-4"
                  fallback={<MoreHorizontal className="h-4 w-4 text-soft-text-tertiary" />}
                />
              </span>
            ) : (
              <Button
                key={page}
                variant={page === currentPage ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => onPageChange(page)}
                className={cn(
                  'w-8 h-8 p-0',
                  page === currentPage && 'pointer-events-none'
                )}
              >
                {page}
              </Button>
            )
          )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }
);
Pagination.displayName = 'Pagination';

interface PaginationInfoProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  className?: string;
}

export function PaginationInfo({
  currentPage,
  pageSize,
  totalItems,
  className,
}: PaginationInfoProps) {
  const { t } = useI18n('common');
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <p className={cn('text-sm text-soft-text-secondary', className)}>
      {t('pagination_showing', { start, end, total: totalItems })}
    </p>
  );
}
