import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import apiService from "../../services/api";
import socketService from "../../services/socketService";
import "../admin.css";
import "../../styles/theme.css";

const PLAN_LABELS = {
  basic: "Basic",
  growth: "Growth",
  enterprise: "Enterprise"
};

const normalizePricingRows = (rows = []) =>
  rows.map((row) => ({
    planCode: String(row?.planCode || "").toLowerCase(),
    monthlyPrice: String(Number(row?.monthlyPrice || 0)),
    yearlyPrice: String(Number(row?.yearlyPrice || 0)),
    currency: String(row?.currency || "INR").toUpperCase()
  }));

const buildPricingMap = (rows = []) =>
  rows.reduce((acc, row) => {
    acc[row.planCode] = row;
    return acc;
  }, {});

const validatePricingRows = (rows = []) => {
  const errors = {};

  rows.forEach((row) => {
    const monthly = Number(row.monthlyPrice);
    const yearly = Number(row.yearlyPrice);
    const rowErrors = {};

    if (row.monthlyPrice === "" || Number.isNaN(monthly) || monthly < 0) {
      rowErrors.monthlyPrice = "Enter a valid monthly price";
    }

    if (row.yearlyPrice === "" || Number.isNaN(yearly) || yearly < 0) {
      rowErrors.yearlyPrice = "Enter a valid yearly price";
    }

    if (!String(row.currency || "").trim()) {
      rowErrors.currency = "Currency is required";
    }

    if (Object.keys(rowErrors).length > 0) {
      errors[row.planCode] = rowErrors;
    }
  });

  return errors;
};

const PaymentsDetailsPage = () => {
  const navigate = useNavigate();
  const backendUrl = import.meta.env.VITE_API_ADMIN_URL || import.meta.env.VITE_API_URL || "";
  const refreshTimerRef = useRef(null);

  const [planPricing, setPlanPricing] = useState([]);
  const [originalPlanPricing, setOriginalPlanPricing] = useState([]);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingErrors, setPricingErrors] = useState({});
  const [pricingMessage, setPricingMessage] = useState("");
  const [pricingMessageTone, setPricingMessageTone] = useState("info");
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [paymentFilters, setPaymentFilters] = useState({
    status: "all",
    planCode: "all",
    query: ""
  });
  const [selectedPaymentIds, setSelectedPaymentIds] = useState([]);
  const [plansTab, setPlansTab] = useState("pricing");
  const [showPaymentFilters, setShowPaymentFilters] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const markUpdated = () => setLastUpdated(new Date());

  const fetchPlanPricing = async () => {
    setPricingLoading(true);
    try {
      const res = await apiService.get(`${backendUrl}/api/admin/plan-pricing`);
      const normalized = normalizePricingRows(res?.data?.data || []);
      setPlanPricing(normalized);
      setOriginalPlanPricing(normalized);
      setPricingErrors({});
      markUpdated();
    } catch (err) {
      console.error("Failed to fetch plan pricing:", err);
      setPricingMessage(err?.response?.data?.message || "Failed to load pricing");
      setPricingMessageTone("error");
    } finally {
      setPricingLoading(false);
    }
  };

  const fetchPayments = async () => {
    setPaymentsLoading(true);
    try {
      const res = await apiService.get(`${backendUrl}/api/admin/payments`);
      setPayments(res?.data?.data || []);
      markUpdated();
    } catch (err) {
      console.error("Failed to fetch payments:", err);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const scheduleRefresh = (target) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = setTimeout(() => {
      if (target === "pricing") return fetchPlanPricing();
      if (target === "payments") return fetchPayments();
      fetchPlanPricing();
      fetchPayments();
    }, 1200);
  };

  useEffect(() => {
    fetchPlanPricing();
    fetchPayments();
  }, []);

  useEffect(() => {
    const socket = socketService.connect(import.meta.env.VITE_API_ADMIN_URL || import.meta.env.VITE_SOCKET_URL);
    setSocketConnected(Boolean(socket?.connected));
    const syncSocketStatus = () => setSocketConnected(Boolean(socketService.getSocket()?.connected));
    const handlePaymentUpdated = () => scheduleRefresh("payments");
    const handlePricingUpdated = () => scheduleRefresh("pricing");
    socket?.on("connect", syncSocketStatus);
    socket?.on("disconnect", syncSocketStatus);
    socketService.on("payment.updated", handlePaymentUpdated);
    socketService.on("plan.pricing.updated", handlePricingUpdated);
    return () => {
      socket?.off("connect", syncSocketStatus);
      socket?.off("disconnect", syncSocketStatus);
      socketService.off("payment.updated", handlePaymentUpdated);
      socketService.off("plan.pricing.updated", handlePricingUpdated);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      socketService.disconnect();
    };
  }, []);

  const originalMap = useMemo(() => buildPricingMap(originalPlanPricing), [originalPlanPricing]);
  const currentValidation = useMemo(() => validatePricingRows(planPricing), [planPricing]);
  const hasValidationErrors = Object.keys(currentValidation).length > 0;

  const isDirty = useMemo(
    () =>
      planPricing.some((row) => {
        const original = originalMap[row.planCode];
        if (!original) return true;
        return (
          String(original.monthlyPrice) !== String(row.monthlyPrice) ||
          String(original.yearlyPrice) !== String(row.yearlyPrice) ||
          String(original.currency) !== String(row.currency)
        );
      }),
    [planPricing, originalMap]
  );

  useEffect(() => {
    setPricingErrors(currentValidation);
  }, [currentValidation]);

  const handlePricingChange = (planCode, field, value) => {
    setPricingMessage("");
    setPlanPricing((prev) =>
      prev.map((row) =>
        row.planCode === planCode
          ? {
              ...row,
              [field]:
                field === "currency"
                  ? String(value || "").toUpperCase()
                  : value.replace(/[^\d]/g, "")
            }
          : row
      )
    );
  };

  const handleSavePricing = async () => {
    const nextErrors = validatePricingRows(planPricing);
    setPricingErrors(nextErrors);
    setPricingMessage("");

    if (Object.keys(nextErrors).length > 0) {
      setPricingMessage("Please fix invalid pricing values before saving.");
      setPricingMessageTone("error");
      return;
    }

    setPricingSaving(true);
    try {
      const payload = {
        items: planPricing.map((row) => ({
          planCode: row.planCode,
          monthlyPrice: Number(row.monthlyPrice || 0),
          yearlyPrice: Number(row.yearlyPrice || 0),
          currency: row.currency || "INR"
        }))
      };

      const res = await apiService.put(`${backendUrl}/api/admin/plan-pricing`, payload);
      const normalized = normalizePricingRows(res?.data?.data || planPricing);
      setPlanPricing(normalized);
      setOriginalPlanPricing(normalized);
      setPricingErrors({});
      setPricingMessage(res?.data?.message || "Pricing updated successfully.");
      setPricingMessageTone("success");
      markUpdated();
    } catch (err) {
      setPricingMessage(err?.response?.data?.message || "Failed to update pricing");
      setPricingMessageTone("error");
    } finally {
      setPricingSaving(false);
    }
  };

  const filteredPayments = payments
    .filter((payment) => paymentFilters.status === "all" || payment.status === paymentFilters.status)
    .filter((payment) => paymentFilters.planCode === "all" || payment.planCode === paymentFilters.planCode)
    .filter((payment) => {
      const term = paymentFilters.query.trim().toLowerCase();
      if (!term) return true;
      return (
        String(payment.orderId || "").toLowerCase().includes(term) ||
        String(payment.paymentId || "").toLowerCase().includes(term) ||
        String(payment.planCode || "").toLowerCase().includes(term) ||
        String(payment.username || "").toLowerCase().includes(term) ||
        String(payment.companyName || "").toLowerCase().includes(term)
      );
    });

  const allVisiblePaymentsSelected =
    filteredPayments.length > 0 && filteredPayments.every((payment) => selectedPaymentIds.includes(payment._id));

  const togglePaymentSelection = (paymentId) => {
    setSelectedPaymentIds((prev) =>
      prev.includes(paymentId) ? prev.filter((id) => id !== paymentId) : [...prev, paymentId]
    );
  };

  const toggleSelectAllVisiblePayments = () => {
    if (allVisiblePaymentsSelected) {
      setSelectedPaymentIds((prev) => prev.filter((id) => !filteredPayments.some((payment) => payment._id === id)));
      return;
    }

    setSelectedPaymentIds((prev) => {
      const visibleIds = filteredPayments.map((payment) => payment._id);
      return Array.from(new Set([...prev, ...visibleIds]));
    });
  };

  return (
    <div className="superadmin-shell">
      <header className="superadmin-header">
        <div className="superadmin-hero superadmin-hero--page">
          <div className="superadmin-hero__heading">
            <div>
              <button
                type="button"
                className="btn-link superadmin-back-link"
                onClick={() => window.history.back()}
                aria-label="Back to Control Center"
              >
                <ArrowLeft size={20} /> Back to Control Center
              </button>
              <h1 className="nx-title">Payments Details</h1>
              <p className="superadmin-subtitle">
                Manage plan pricing and review the realtime payment ledger from one focused billing workspace.
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="superadmin-panel superadmin-panel--page">
        <div className="panel-header">
          <div>
            <h2>Price Plan & Payments</h2>
            <span className="panel-meta">
              {lastUpdated ? `Realtime synced at ${new Date(lastUpdated).toLocaleTimeString()}` : "Realtime updates enabled"}
            </span>
          </div>
        </div>

        <div className="plans-tabs" role="tablist" aria-label="Pricing and payments">
          <button type="button" className={`tab-btn ${plansTab === "pricing" ? "active" : ""}`} onClick={() => setPlansTab("pricing")}>
            Pricing
          </button>
          <button type="button" className={`tab-btn ${plansTab === "payments" ? "active" : ""}`} onClick={() => setPlansTab("payments")}>
            Payments
          </button>
        </div>

        {plansTab === "pricing" && (
          <div className="plans-tab-content">
            <div className="pricing-intro-card">
              <div>
                <h3>Global plan pricing</h3>
                <p>Update Basic, Growth, and Enterprise pricing here. New checkouts will use the saved values immediately.</p>
              </div>
              <div className="pricing-status-stack">
                <span className={`status-chip ${isDirty ? "status-chip--warning" : "status-chip--neutral"}`}>
                  {isDirty ? "Unsaved changes" : "Saved"}
                </span>
                <span className="status-chip status-chip--neutral">Currency: INR</span>
              </div>
            </div>

            {pricingMessage && <div className={`pricing-feedback pricing-feedback--${pricingMessageTone}`}>{pricingMessage}</div>}

            {pricingLoading ? (
              <div className="pricing-empty-state">Loading pricing configuration...</div>
            ) : (
              <>
                <div className="pricing-table pricing-table--card">
                  <div className="pricing-row pricing-header pricing-row--admin">
                    <span>Plan</span>
                    <span>Monthly</span>
                    <span>Yearly</span>
                    <span>Currency</span>
                    <span>Status</span>
                  </div>

                  {planPricing.map((row) => {
                    const rowErrors = pricingErrors[row.planCode] || {};
                    const original = originalMap[row.planCode];
                    const rowDirty =
                      !original ||
                      original.monthlyPrice !== row.monthlyPrice ||
                      original.yearlyPrice !== row.yearlyPrice ||
                      original.currency !== row.currency;

                    return (
                      <div className="pricing-card-row" key={row.planCode}>
                        <div className="pricing-row pricing-row--admin">
                          <div className="pricing-plan-block">
                            <strong className="pricing-plan">{PLAN_LABELS[row.planCode] || row.planCode}</strong>
                            <span className="pricing-plan-meta">{row.planCode}</span>
                          </div>
                          <div className="pricing-field">
                            <span className="pricing-field-prefix">INR</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={row.monthlyPrice}
                              onChange={(e) => handlePricingChange(row.planCode, "monthlyPrice", e.target.value)}
                              aria-invalid={Boolean(rowErrors.monthlyPrice)}
                            />
                            {rowErrors.monthlyPrice && <span className="pricing-field-error">{rowErrors.monthlyPrice}</span>}
                          </div>
                          <div className="pricing-field">
                            <span className="pricing-field-prefix">INR</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={row.yearlyPrice}
                              onChange={(e) => handlePricingChange(row.planCode, "yearlyPrice", e.target.value)}
                              aria-invalid={Boolean(rowErrors.yearlyPrice)}
                            />
                            {rowErrors.yearlyPrice && <span className="pricing-field-error">{rowErrors.yearlyPrice}</span>}
                          </div>
                          <div className="pricing-field">
                            <input
                              type="text"
                              maxLength={3}
                              value={row.currency}
                              onChange={(e) => handlePricingChange(row.planCode, "currency", e.target.value)}
                              aria-invalid={Boolean(rowErrors.currency)}
                            />
                            {rowErrors.currency && <span className="pricing-field-error">{rowErrors.currency}</span>}
                          </div>
                          <div className="pricing-row-status">
                            <span className={`status-chip ${rowDirty ? "status-chip--warning" : "status-chip--success"}`}>
                              {rowDirty ? "Changed" : "Synced"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pricing-actions pricing-actions--space-between">
                  <p className="pricing-footnote">Existing payment orders remain unchanged after a price update.</p>
                  <button
                    className="primary-btn"
                    onClick={handleSavePricing}
                    disabled={pricingSaving || !isDirty || hasValidationErrors || planPricing.length === 0}
                  >
                    {pricingSaving ? "Saving..." : "Save Pricing"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {plansTab === "payments" && (
          <div className="plans-tab-content">
            <div className="users-toolbar-surface payments-toolbar-surface">
              <div className="page-toolbar users-page-toolbar">
                <div className="users-toolbar-control">
                  <label className="page-search users-page-search">
                    <Search size={16} />
                    <input
                      type="text"
                      placeholder="Search order id, payment id, username, company, plan"
                      value={paymentFilters.query}
                      onChange={(e) => setPaymentFilters((prev) => ({ ...prev, query: e.target.value }))}
                    />
                  </label>
                  <button
                    type="button"
                    className={`users-filter-toggle ${showPaymentFilters ? "users-filter-toggle--active" : ""}`}
                    onClick={() => setShowPaymentFilters((prev) => !prev)}
                    aria-expanded={showPaymentFilters}
                  >
                    <SlidersHorizontal size={15} />
                    <span>Filters</span>
                    <ChevronDown size={15} />
                  </button>
                </div>
              </div>

              {showPaymentFilters && (
                <div className="page-filters users-page-filters users-page-filters--expand payments-page-filters">
                  <div className="users-bulk-select">
                    <span className="users-bulk-select__label">Select</span>
                    <button type="button" className="users-select-all-btn" onClick={toggleSelectAllVisiblePayments}>
                      {allVisiblePaymentsSelected ? "Clear All Visible" : "Select All Visible"}
                    </button>
                    <button
                      type="button"
                      className="users-bulk-delete-btn"
                      disabled
                      aria-label="Delete selected payments unavailable"
                      title="Payment delete API is not available yet"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <select
                    value={paymentFilters.status}
                    onChange={(e) => setPaymentFilters((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="all">All Status</option>
                    <option value="created">Created</option>
                    <option value="captured">Captured</option>
                    <option value="failed">Failed</option>
                  </select>
                  <select
                    value={paymentFilters.planCode}
                    onChange={(e) => setPaymentFilters((prev) => ({ ...prev, planCode: e.target.value }))}
                  >
                    <option value="all">All Plans</option>
                    <option value="trial">Trial</option>
                    <option value="basic">Basic</option>
                    <option value="growth">Growth</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              )}
            </div>

            <div className="page-stats-row">
              <span className="status-chip status-chip--neutral">Showing {filteredPayments.length} payments</span>
              <span className="status-chip status-chip--success">
                {payments.filter((payment) => payment.status === "captured").length} captured
              </span>
              <span className="status-chip status-chip--warning">
                {payments.filter((payment) => payment.status === "created").length} pending
              </span>
            </div>

            {paymentsLoading ? (
              <div className="pricing-empty-state">Loading payments ledger...</div>
            ) : filteredPayments.length === 0 ? (
              <div className="pricing-empty-state">No payments matched the current filters.</div>
            ) : (
              <div className="payments-table-shell">
                <div className="payments-table payments-table--page">
                <div className={`payment-row header ${showPaymentFilters ? "payment-row--selecting" : ""}`}>
                  {showPaymentFilters ? <span>Select</span> : null}
                  <span>Status</span>
                  <span>Amount</span>
                  <span>Plan</span>
                  <span>Order ID</span>
                  <span>Payment ID</span>
                  <span>User</span>
                  <span>Company</span>
                  <span>Date</span>
                </div>
                {filteredPayments.map((payment) => (
                  <div className={`payment-row ${showPaymentFilters ? "payment-row--selecting" : ""}`} key={payment._id}>
                    {showPaymentFilters ? (
                      <span className="payment-select-cell">
                        <button
                          type="button"
                          className={`users-row-checkbox ${selectedPaymentIds.includes(payment._id) ? "users-row-checkbox--active" : ""}`}
                          onClick={() => togglePaymentSelection(payment._id)}
                          aria-pressed={selectedPaymentIds.includes(payment._id)}
                          aria-label={`Select payment ${payment.orderId || payment._id}`}
                        >
                          {selectedPaymentIds.includes(payment._id) ? <Check size={13} /> : null}
                        </button>
                      </span>
                    ) : null}
                    <span>{payment.status}</span>
                    <span>INR {Number(payment.amount || 0).toLocaleString("en-IN")}</span>
                    <span>{payment.planCode || "-"}</span>
                    <span className="mono">{payment.orderId || "-"}</span>
                    <span className="mono">{payment.paymentId || "-"}</span>
                    <span>{payment.username || payment.email || "-"}</span>
                    <span>{payment.companyName || "-"}</span>
                    <span>{payment.createdAt ? new Date(payment.createdAt).toLocaleString() : "-"}</span>
                  </div>
                ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default PaymentsDetailsPage;
