import React from 'react';
import { 
  ReportHeader, 
  SummaryCards, 
  ReportTable, 
  LoadingSpinner, 
  InfoBox,
  formatCurrency,
  formatDate,
  handleRowClick
} from './CommonComponents';
import { useReportTable } from './useReportData';

// Base Report Component that other reports can extend
const BaseReport = ({
  title,
  subtitle,
  summaryCards = [],
  tableColumns = [],
  data = [],
  loading = false,
  error = null,
  onRowClick = handleRowClick,
  defaultSortKey = 'date',
  defaultSortDirection = 'desc',
  pageSize = 25,
  emptyMessage = "No data found",
  emptySubMessage = "Try adjusting your filters or date range",
  infoBox = null,
  children = null
}) => {
  // Use table utilities
  const { sortedData, sortConfig, handleSort, pagination } = useReportTable(
    data, 
    defaultSortKey, 
    defaultSortDirection, 
    pageSize
  );

  // Show loading state
  if (loading) {
    return <LoadingSpinner />;
  }

  // Show error state
  if (error) {
    return (
      <div className="p-6">
        <InfoBox type="error" title="Error Loading Report">
          <p>{error}</p>
        </InfoBox>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Report Header */}
      <ReportHeader title={title} subtitle={subtitle} />

      {/* Summary Cards */}
      {summaryCards.length > 0 && (
        <SummaryCards cards={summaryCards} />
      )}

      {/* Custom Children Content */}
      {children}

      {/* Report Table */}
      <ReportTable
        data={sortedData}
        columns={tableColumns}
        sortConfig={sortConfig}
        onSort={handleSort}
        onRowClick={onRowClick}
        pagination={pagination}
        emptyMessage={emptyMessage}
        emptySubMessage={emptySubMessage}
      />

      {/* Info Box */}
      {infoBox && (
        <InfoBox {...infoBox} />
      )}
    </div>
  );
};

export default BaseReport; 