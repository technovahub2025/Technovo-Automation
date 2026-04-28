import React, { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  CalendarClock,
  ExternalLink,
  Target,
  Trash2,
  UserRound,
  X
} from "lucide-react";
import { crmService } from "../../services/crmService";
import { toDateTimeLocalInputValue, toIsoFromDateTimeLocalInput } from "../../pages/teamInbox/teamInboxUtils";

const DEAL_STAGE_OPTIONS = [
  { key: "discovery", label: "Discovery" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "negotiation", label: "Negotiation" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" }
];

const DEAL_STATUS_OPTIONS = [
  { key: "open", label: "Open" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" }
];

const formatCurrency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(parsed);
};

const toDealForm = (deal = {}) => ({
  title: String(deal?.title || "").trim(),
  stage: String(deal?.stage || "discovery").trim().toLowerCase() || "discovery",
  status: String(deal?.status || "open").trim().toLowerCase() || "open",
  value:
    Number.isFinite(Number(deal?.value)) && Number(deal?.value) > 0
      ? String(Number(deal.value))
      : "",
  probability:
    Number.isFinite(Number(deal?.probability)) && Number(deal?.probability) >= 0
      ? String(Number(deal.probability))
      : "0",
  expectedCloseAt: toDateTimeLocalInputValue(deal?.expectedCloseAt),
  ownerId: String(deal?.ownerId || "").trim(),
  productName: String(deal?.productName || "").trim(),
  source: String(deal?.source || "").trim(),
  notes: String(deal?.notes || "").trim(),
  lostReason: String(deal?.lostReason || "").trim()
});

const CrmDealDrawer = ({
  open,
  deal = null,
  currentUserId = "",
  onClose,
  onSaved,
  onDeleted,
  onOpenContact
}) => {
  const [form, setForm] = useState(() => toDealForm(deal));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("success");

  const dealId = String(deal?._id || deal?.id || "").trim();
  const contact = useMemo(() => {
    const rawContact = deal?.contactId;
    return rawContact && typeof rawContact === "object" ? rawContact : {};
  }, [deal]);

  useEffect(() => {
    setForm(toDealForm(deal));
    setMessage("");
    setMessageTone("success");
  }, [deal]);

  if (!open || !dealId) return null;

  const showMessage = (text, tone = "success") => {
    setMessage(String(text || "").trim());
    setMessageTone(tone);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage("");

      if (!String(form.title || "").trim()) {
        throw new Error("Deal title is required");
      }

      const payload = {
        title: form.title,
        stage: form.stage,
        status: form.status,
        value: form.value ? Number(form.value) : 0,
        probability: form.probability ? Number(form.probability) : 0,
        expectedCloseAt: form.expectedCloseAt
          ? toIsoFromDateTimeLocalInput(form.expectedCloseAt)
          : null,
        ownerId: form.ownerId || null,
        productName: form.productName,
        source: form.source,
        notes: form.notes,
        lostReason: form.lostReason
      };

      const result = await crmService.updateDeal(dealId, payload);
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to update deal");
      }

      showMessage("Deal updated.");
      onSaved?.(result?.data || payload);
    } catch (error) {
      showMessage(error?.message || "Failed to update deal", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      setMessage("");
      const result = await crmService.deleteDeal(dealId);
      if (result?.success === false) {
        throw new Error(result?.error || "Failed to delete deal");
      }
      onDeleted?.(dealId);
    } catch (error) {
      showMessage(error?.message || "Failed to delete deal", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="crm-drawer-shell" role="dialog" aria-modal="true">
      <button
        type="button"
        className="crm-drawer-backdrop"
        onClick={onClose}
        aria-label="Close CRM deal drawer"
      />
      <aside className="crm-contact-drawer">
        <div className="crm-contact-drawer-header">
          <div>
            <p className="crm-contact-drawer-kicker">Deal Details</p>
            <h2>{deal?.title || "Untitled Deal"}</h2>
            <div className="crm-contact-drawer-subtitle">
              <span>{formatCurrency(deal?.value)}</span>
              <span>{contact?.name || "Unknown contact"}</span>
              <span>{contact?.phone || "-"}</span>
            </div>
          </div>
          <button type="button" className="crm-icon-btn" onClick={onClose} aria-label="Close deal drawer">
            <X size={18} />
          </button>
        </div>

        {message && (
          <div className={`crm-alert ${messageTone === "error" ? "crm-alert-error" : "crm-alert-success"}`}>
            {message}
          </div>
        )}

        <div className="crm-contact-drawer-body">
          <section className="crm-contact-hero">
            <div className="crm-contact-hero-main">
              <div className="crm-contact-chip-row">
                <span className={`crm-status-badge status-${String(deal?.status || "open").toLowerCase()}`}>
                  {String(deal?.status || "open")}
                </span>
                <span className={`crm-temperature-badge crm-temperature-badge--${Number(deal?.probability || 0) >= 75 ? "hot" : Number(deal?.probability || 0) >= 40 ? "warm" : "cold"}`}>
                  <Target size={13} />
                  {Number(deal?.probability || 0)}%
                </span>
              </div>
              <div className="crm-contact-stats">
                <div>
                  <strong>{formatCurrency(deal?.value)}</strong>
                  <span>Deal Value</span>
                </div>
                <div>
                  <strong>{Number(deal?.probability || 0)}%</strong>
                  <span>Probability</span>
                </div>
                <div>
                  <strong>{deal?.ownerId || "-"}</strong>
                  <span>Owner</span>
                </div>
                <div>
                  <strong>{deal?.expectedCloseAt ? new Date(deal.expectedCloseAt).toLocaleDateString() : "-"}</strong>
                  <span>Expected Close</span>
                </div>
              </div>
            </div>

            <div className="crm-contact-action-grid">
              <button
                type="button"
                className="crm-contact-action-btn"
                onClick={() => onOpenContact?.(contact)}
              >
                <ExternalLink size={14} />
                Open Contact
              </button>
              <button
                type="button"
                className="crm-contact-action-btn crm-contact-action-btn--secondary"
                onClick={() => setForm((previous) => ({ ...previous, ownerId: currentUserId || previous.ownerId }))}
                disabled={!currentUserId}
              >
                <UserRound size={14} />
                Assign To Me
              </button>
              <button
                type="button"
                className="crm-contact-action-btn crm-contact-action-btn--secondary"
                onClick={() => setForm((previous) => ({ ...previous, status: "won", stage: "won" }))}
              >
                <BadgeDollarSign size={14} />
                Mark Won
              </button>
              <button
                type="button"
                className="crm-contact-action-btn crm-contact-action-btn--secondary"
                onClick={() => setForm((previous) => ({ ...previous, status: "lost", stage: "lost" }))}
              >
                <Trash2 size={14} />
                Mark Lost
              </button>
            </div>
          </section>

          <section className="crm-drawer-card">
            <div className="crm-drawer-card-header">
              <h3>
                <BadgeDollarSign size={16} />
                Deal Overview
              </h3>
            </div>

            <div className="crm-drawer-form-grid">
              <label className="crm-field crm-field--span-2">
                <span>Deal Title</span>
                <input
                  type="text"
                  className="crm-input"
                  value={form.title}
                  onChange={(event) => setForm((previous) => ({ ...previous, title: event.target.value }))}
                />
              </label>
              <label className="crm-field">
                <span>Stage</span>
                <select
                  className="crm-select"
                  value={form.stage}
                  onChange={(event) => setForm((previous) => ({ ...previous, stage: event.target.value }))}
                >
                  {DEAL_STAGE_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="crm-field">
                <span>Status</span>
                <select
                  className="crm-select"
                  value={form.status}
                  onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))}
                >
                  {DEAL_STATUS_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="crm-field">
                <span>Value</span>
                <input
                  type="number"
                  min="0"
                  className="crm-input"
                  value={form.value}
                  onChange={(event) => setForm((previous) => ({ ...previous, value: event.target.value }))}
                />
              </label>
              <label className="crm-field">
                <span>Probability</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="crm-input"
                  value={form.probability}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, probability: event.target.value }))
                  }
                />
              </label>
              <label className="crm-field">
                <span>Expected Close</span>
                <input
                  type="datetime-local"
                  className="crm-input"
                  value={form.expectedCloseAt}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, expectedCloseAt: event.target.value }))
                  }
                />
              </label>
              <label className="crm-field">
                <span>Owner ID</span>
                <input
                  type="text"
                  className="crm-input"
                  value={form.ownerId}
                  onChange={(event) => setForm((previous) => ({ ...previous, ownerId: event.target.value }))}
                />
              </label>
              <label className="crm-field">
                <span>Product / Service</span>
                <input
                  type="text"
                  className="crm-input"
                  value={form.productName}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, productName: event.target.value }))
                  }
                />
              </label>
              <label className="crm-field">
                <span>Source</span>
                <input
                  type="text"
                  className="crm-input"
                  value={form.source}
                  onChange={(event) => setForm((previous) => ({ ...previous, source: event.target.value }))}
                />
              </label>
            </div>

            <label className="crm-field">
              <span>Notes</span>
              <textarea
                className="crm-textarea"
                rows={4}
                value={form.notes}
                onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
              />
            </label>

            {form.status === "lost" && (
              <label className="crm-field">
                <span>Lost Reason</span>
                <textarea
                  className="crm-textarea"
                  rows={3}
                  value={form.lostReason}
                  onChange={(event) =>
                    setForm((previous) => ({ ...previous, lostReason: event.target.value }))
                  }
                />
              </label>
            )}

            <div className="crm-drawer-actions">
              <button type="button" className="crm-btn crm-btn-primary" onClick={handleSave} disabled={saving}>
                <CalendarClock size={15} />
                {saving ? "Saving..." : "Save Deal"}
              </button>
              <button type="button" className="crm-btn crm-btn-secondary" onClick={handleDelete} disabled={deleting}>
                <Trash2 size={15} />
                {deleting ? "Deleting..." : "Delete Deal"}
              </button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
};

export default CrmDealDrawer;
