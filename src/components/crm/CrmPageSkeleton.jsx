import React from "react";

const metricItems = Array.from({ length: 4 }, (_, index) => index);
const boardColumns = Array.from({ length: 4 }, (_, index) => index);
const tableRows = Array.from({ length: 5 }, (_, index) => index);

const CrmPageSkeleton = ({ variant = "board" }) => {
  const isBoard = variant === "board" || variant === "calendar";
  const isOps = variant === "ops";

  return (
    <div className="crm-skeleton">
      <div className="crm-skeleton-grid crm-skeleton-grid--metrics">
        {metricItems.map((item) => (
          <div key={`metric-${item}`} className="crm-skeleton-card">
            <div className="crm-skeleton-line crm-skeleton-line--short" />
            <div className="crm-skeleton-line crm-skeleton-line--tiny" />
          </div>
        ))}
      </div>

      {isBoard ? (
        <div className="crm-skeleton-grid crm-skeleton-grid--board">
          {boardColumns.map((column) => (
            <div key={`column-${column}`} className="crm-skeleton-card crm-skeleton-card--tall">
              <div className="crm-skeleton-line crm-skeleton-line--medium" />
              <div className="crm-skeleton-stack">
                <div className="crm-skeleton-block" />
                <div className="crm-skeleton-block" />
                <div className="crm-skeleton-block" />
              </div>
            </div>
          ))}
        </div>
      ) : isOps ? (
        <div className="crm-skeleton-grid crm-skeleton-grid--ops">
          <div className="crm-skeleton-card crm-skeleton-card--tall">
            <div className="crm-skeleton-line crm-skeleton-line--medium" />
            <div className="crm-skeleton-table">
              {tableRows.map((row) => (
                <div key={`ops-row-${row}`} className="crm-skeleton-table-row" />
              ))}
            </div>
          </div>
          <div className="crm-skeleton-card crm-skeleton-card--tall">
            <div className="crm-skeleton-line crm-skeleton-line--medium" />
            <div className="crm-skeleton-stack">
              <div className="crm-skeleton-block" />
              <div className="crm-skeleton-block" />
              <div className="crm-skeleton-block" />
            </div>
          </div>
        </div>
      ) : (
        <div className="crm-skeleton-card crm-skeleton-card--tall">
          <div className="crm-skeleton-line crm-skeleton-line--medium" />
          <div className="crm-skeleton-table">
            {tableRows.map((row) => (
              <div key={`row-${row}`} className="crm-skeleton-table-row" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CrmPageSkeleton;
