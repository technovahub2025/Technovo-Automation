import React from "react";

const CrmToast = ({ toast }) => {
  if (!toast?.message) return null;

  return (
    <div
      className={`crm-toast crm-toast--${String(toast.type || "info").toLowerCase()}`}
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </div>
  );
};

export default CrmToast;
