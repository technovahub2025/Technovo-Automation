import React from "react";

const metricItems = Array.from({ length: 4 }, (_, index) => index);
const boardColumns = Array.from({ length: 4 }, (_, index) => index);
const tableRows = Array.from({ length: 5 }, (_, index) => index);

const CrmPageSkeleton = ({ variant = "board" }) => {
  const isHome = variant === "home";
  const isBoard = variant === "board" || variant === "calendar";
  const isOps = variant === "ops";

  if (isHome) {
    return (
      <div className="crm-skeleton crm-skeleton--home">
        <div className="crm-skeleton-row crm-skeleton-row--top">
          <div className="crm-skeleton-line crm-skeleton-line--wide" />
          <div className="crm-skeleton-line crm-skeleton-line--badge" />
          <div className="crm-skeleton-line crm-skeleton-line--badge" />
        </div>
        <div className="crm-skeleton-grid crm-skeleton-grid--home-kpis">
          {metricItems.map((item) => (
            <div key={`home-metric-${item}`} className="crm-skeleton-card crm-skeleton-card--home-kpi">
              <div className="crm-skeleton-line crm-skeleton-line--medium" />
              <div className="crm-skeleton-line crm-skeleton-line--short" />
            </div>
          ))}
        </div>
        <div className="crm-skeleton-grid crm-skeleton-grid--home-main">
          <div className="crm-skeleton-card crm-skeleton-card--home-focus">
            <div className="crm-skeleton-line crm-skeleton-line--medium" />
            <div className="crm-skeleton-grid crm-skeleton-grid--home-mini">
              {metricItems.map((item) => (
                <div key={`home-mini-${item}`} className="crm-skeleton-card crm-skeleton-card--compact">
                  <div className="crm-skeleton-line crm-skeleton-line--short" />
                  <div className="crm-skeleton-line crm-skeleton-line--tiny" />
                </div>
              ))}
            </div>
            <div className="crm-skeleton-stack crm-skeleton-stack--actions">
              <div className="crm-skeleton-line crm-skeleton-line--action" />
              <div className="crm-skeleton-line crm-skeleton-line--action" />
              <div className="crm-skeleton-line crm-skeleton-line--action" />
            </div>
          </div>
          <div className="crm-skeleton-card crm-skeleton-card--home-next">
            <div className="crm-skeleton-line crm-skeleton-line--badge" />
            <div className="crm-skeleton-line crm-skeleton-line--medium" />
            <div className="crm-skeleton-line crm-skeleton-line--short" />
            <div className="crm-skeleton-line crm-skeleton-line--action" />
          </div>
          <div className="crm-skeleton-card crm-skeleton-card--home-activity">
            <div className="crm-skeleton-line crm-skeleton-line--medium" />
            <div className="crm-skeleton-stack">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={`home-activity-${index}`} className="crm-skeleton-line crm-skeleton-line--activity" />
              ))}
            </div>
          </div>
          <div className="crm-skeleton-card crm-skeleton-card--home-shortcuts">
            <div className="crm-skeleton-line crm-skeleton-line--medium" />
            <div className="crm-skeleton-stack">
              {Array.from({ length: 5 }, (_, index) => (
                <div key={`home-shortcut-${index}`} className="crm-skeleton-line crm-skeleton-line--shortcut" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

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
