import React from "react";
import { Activity } from "lucide-react";

const normalizeRealtimeStatus = (status) => {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "connected") {
    return { key: "connected", label: "Live" };
  }
  if (normalized === "connecting") {
    return { key: "connecting", label: "Connecting" };
  }
  if (normalized === "reconnecting") {
    return { key: "reconnecting", label: "Reconnecting..." };
  }
  return { key: "offline", label: "Offline" };
};

const CrmRealtimeStatus = ({ status, className = "" }) => {
  const realtime = normalizeRealtimeStatus(status);
  const classes = ["crm-live-pill", `crm-live-pill--${realtime.key}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} title={`CRM realtime: ${realtime.label}`} role="status" aria-live="polite">
      <span className="crm-live-pill__dot" />
      <Activity size={15} />
      {realtime.label}
    </span>
  );
};

export default CrmRealtimeStatus;
