import React from 'react';
import './AppToast.css';

const AppToast = ({ toast, className = '' }) => {
  if (!toast?.message) return null;

  return (
    <div
      className={`app-toast app-toast--${String(toast.type || 'info').toLowerCase()} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      {toast.message}
    </div>
  );
};

export default AppToast;
