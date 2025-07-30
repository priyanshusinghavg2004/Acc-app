import React from 'react';

const PaginationControls = ({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  pageSize,
  hasNextPage,
  hasPrevPage,
  goToPage,
  goToNextPage,
  goToPrevPage,
  goToFirstPage,
  goToLastPage,
  handlePageSizeChange,
  getPageNumbers,
  pageSizeOptions
}) => {
  if (totalItems === 0) {
    return null;
  }

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-white border-t border-gray-200">
      {/* Page Size Selector and Info */}
      <div className="flex items-center gap-4 text-sm text-gray-700">
        <div className="flex items-center gap-2">
          <span>Show:</span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span>entries</span>
        </div>
        <div>
          Showing {startIndex} to {endIndex} of {totalItems} entries
        </div>
      </div>

      {/* Pagination Navigation */}
      <div className="flex items-center gap-1">
        {/* First Page */}
        <button
          onClick={goToFirstPage}
          disabled={!hasPrevPage}
          className="px-3 py-1 text-sm border border-gray-300 rounded-l hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Go to first page"
        >
          First
        </button>

        {/* Previous Page */}
        <button
          onClick={goToPrevPage}
          disabled={!hasPrevPage}
          className="px-3 py-1 text-sm border-t border-b border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Go to previous page"
        >
          Prev
        </button>

        {/* Page Numbers */}
        {getPageNumbers().map((page, index) => (
          <React.Fragment key={index}>
            {page === '...' ? (
              <span className="px-3 py-1 text-sm border-t border-b border-gray-300 text-gray-500">
                ...
              </span>
            ) : (
              <button
                onClick={() => goToPage(page)}
                className={`px-3 py-1 text-sm border-t border-b border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  page === currentPage
                    ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600'
                    : 'text-gray-700'
                }`}
                aria-label={`Go to page ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </button>
            )}
          </React.Fragment>
        ))}

        {/* Next Page */}
        <button
          onClick={goToNextPage}
          disabled={!hasNextPage}
          className="px-3 py-1 text-sm border-t border-b border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Go to next page"
        >
          Next
        </button>

        {/* Last Page */}
        <button
          onClick={goToLastPage}
          disabled={!hasNextPage}
          className="px-3 py-1 text-sm border border-gray-300 rounded-r hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Go to last page"
        >
          Last
        </button>
      </div>
    </div>
  );
};

export default PaginationControls; 