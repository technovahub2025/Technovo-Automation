import React from "react";
import { ChevronRight, Search, Users, X } from "lucide-react";

import "./Modal.css";

const GroupAudiencePickerModal = ({
  open = false,
  groups = [],
  loading = false,
  error = "",
  search = "",
  onSearchChange,
  onClose,
  onSelectGroup,
}) => {
  if (!open) return null;

  const normalizedSearch = String(search || "")
    .trim()
    .toLowerCase();
  const filteredGroups = Array.isArray(groups)
    ? groups.filter((group) => {
        if (!normalizedSearch) return true;
        const haystack = [
          group?.name,
          group?.description,
          group?.sourceType,
        ]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");
        return haystack.includes(normalizedSearch);
      })
    : [];

  return (
    <div className="contact-audience-modal-overlay">
      <div className="modal-content segment-picker-modal">
        <div className="modal-header">
          <h3>
            <Users size={18} />
            Saved Groups
          </h3>
          <button type="button" className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="segment-picker-toolbar">
          <div className="segment-picker-search-wrap">
            <Search size={16} />
            <input
              type="search"
              value={search}
              onChange={(event) => onSearchChange?.(event.target.value)}
              placeholder="Search saved groups"
              className="segment-picker-search"
            />
          </div>
          <p className="segment-picker-hint">
            Pick a saved group and it will append to the current audience.
          </p>
        </div>

        {error ? <div className="segment-picker-error">{error}</div> : null}

        <div className="segment-picker-panel">
          {loading ? (
            <div className="segment-picker-empty">Loading groups...</div>
          ) : filteredGroups.length > 0 ? (
            <div className="segment-picker-grid">
              {filteredGroups.map((group) => {
                const memberCount = Number(
                  group?.recipientCount || group?.contacts?.length || 0,
                );
                return (
                  <button
                    key={group?._id || group?.id || group?.name}
                    type="button"
                    className="segment-picker-card"
                    onClick={() => onSelectGroup?.(group)}
                  >
                    <div className="segment-picker-card__header">
                      <div>
                        <strong>{group?.name || "Unnamed group"}</strong>
                        <span>{group?.sourceType || "manual"} group</span>
                      </div>
                      <ChevronRight size={16} />
                    </div>
                    <p>{group?.description || "No description provided."}</p>
                    <div className="segment-picker-card__meta">
                      <span>{memberCount.toLocaleString()} contacts</span>
                      <span>
                        {Array.isArray(group?.contacts) &&
                        group.contacts.length > 0
                          ? "Ready to use"
                          : "Empty"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="segment-picker-empty">No saved groups found.</div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupAudiencePickerModal;
