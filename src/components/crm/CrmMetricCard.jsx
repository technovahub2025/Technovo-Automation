import React from "react";

const CrmMetricCard = ({ icon: Icon, value, label }) => (
  <div className="crm-metric-card">
    {Icon ? <Icon size={18} /> : null}
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  </div>
);

export default CrmMetricCard;
