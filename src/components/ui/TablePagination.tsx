'use client';

import styles from './TablePagination.module.css';

type TablePaginationProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  itemLabel?: string;
};

export default function TablePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  pageSizeOptions = [5, 10, 20, 50],
  onPageSizeChange,
  itemLabel = 'rows',
}: TablePaginationProps) {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  const visiblePages = [];
  const windowStart = Math.max(1, currentPage - 1);
  const windowEnd = Math.min(totalPages, windowStart + 2);

  for (let pageNumber = windowStart; pageNumber <= windowEnd; pageNumber += 1) {
    visiblePages.push(pageNumber);
  }

  if (!visiblePages.includes(1)) {
    visiblePages.unshift(1);
  }

  if (!visiblePages.includes(totalPages)) {
    visiblePages.push(totalPages);
  }

  const dedupedPages = visiblePages.filter((pageNumber, index) => visiblePages.indexOf(pageNumber) === index);

  return (
    <div className={styles.pagination}>
      <div className={styles.summary}>
        Showing {start}-{end} of {totalItems} {itemLabel}
      </div>

      <div className={styles.controls}>
        {onPageSizeChange ? (
          <label className={styles.pageSize}>
            <span>Rows per page</span>
            <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className={styles.buttons}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>

          {dedupedPages.map((pageNumber, index) => {
            const previousPage = dedupedPages[index - 1];
            const showGap = previousPage && pageNumber - previousPage > 1;

            return (
              <div key={pageNumber} className={styles.pageGroup}>
                {showGap ? <span className={styles.ellipsis}>...</span> : null}
                <button
                  type="button"
                  className={pageNumber === currentPage ? styles.pageButtonActive : styles.pageButton}
                  onClick={() => onPageChange(pageNumber)}
                >
                  {pageNumber}
                </button>
              </div>
            );
          })}

          <button
            type="button"
            className={styles.navButton}
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
