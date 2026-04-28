import React from "react";

const CrmPageHeader = ({ title, subtitle, actions = null }) => (
  <div className="crm-page-header">
    <div className="crm-page-header__content">
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
    {actions ? <div className="crm-page-header__actions">{actions}</div> : null}
  </div>
);

export default CrmPageHeader;
