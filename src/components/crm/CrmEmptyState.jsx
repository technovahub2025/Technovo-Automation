import React from "react";

const CrmEmptyState = ({ title, description }) => (
  <div className="crm-empty-state">
    <strong>{title}</strong>
    {description ? <span>{description}</span> : null}
  </div>
);

export default CrmEmptyState;
