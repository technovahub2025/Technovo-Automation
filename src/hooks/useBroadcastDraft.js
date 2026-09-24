import { useEffect, useRef, useState } from "react";

// Persist parsed CSV rows, not the browser File object (which cannot be JSON encoded).
export default function useBroadcastDraft({ enabled, userId, type, fields }) {
  const key = enabled && userId && userId !== "anonymous"
    ? `broadcast-draft:v1:${encodeURIComponent(userId)}:${type || "template"}`
    : null;
  const [readyKey, setReadyKey] = useState(null);
  const [status, setStatus] = useState("Drafts save automatically in this browser");
  const lastSaved = useRef("");
  const values = Object.fromEntries(Object.entries(fields).map(([name, [value]]) => [name, value]));
  const serialized = JSON.stringify(values);
  const hasContent = Boolean(
    values.broadcastName || values.templateName || values.customMessage ||
    values.scheduledTime || values.recipients?.length || values.uploadedFile ||
    values.selectedCampaignAudience?.campaignBroadcastId || values.suppressionListRaw
  );

  useEffect(() => {
    if (!key) return;
    lastSaved.current = "";
    try {
      const saved = JSON.parse(window.localStorage.getItem(key) || "null");
      if (saved?.version === 1 && saved.values && typeof saved.values === "object") {
        for (const [name, [initialValue, setter]] of Object.entries(fields)) {
          const value = saved.values[name];
          if (value === undefined) continue;
          const valid = initialValue === null
            ? value === null || (typeof value === "object" && !Array.isArray(value))
            : Array.isArray(initialValue)
              ? Array.isArray(value)
              : typeof value === typeof initialValue && value !== null;
          if (valid) setter(value);
        }
        lastSaved.current = JSON.stringify(saved.values);
        setStatus("Draft restored · Saved in this browser");
      } else {
        setStatus("Drafts save automatically in this browser");
      }
    } catch {
      setStatus("Draft could not be restored. Browser storage may be unavailable.");
    }
    setReadyKey(key);
    // Restore only when entering a user's composer, never over their ongoing edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const save = () => {
    if (!key || readyKey !== key) return;
    try {
      if (hasContent) {
        window.localStorage.setItem(key, JSON.stringify({ version: 1, values, savedAt: Date.now() }));
        setStatus("Draft saved · " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } else {
        window.localStorage.removeItem(key);
        setStatus("Drafts save automatically in this browser");
      }
      lastSaved.current = serialized;
    } catch {
      setStatus("Draft not saved. Browser storage is full or unavailable.");
    }
  };

  useEffect(() => {
    if (lastSaved.current !== serialized) save();
    // Save immediately on form changes, including before navigation/unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, readyKey, serialized]);

  const clear = () => {
    if (!key) return;
    try {
      window.localStorage.removeItem(key);
      lastSaved.current = serialized;
      setStatus("Drafts save automatically in this browser");
    } catch {
      setStatus("Draft could not be removed. Browser storage is unavailable.");
    }
  };

  return {
    status: key ? status : "Draft saving requires a signed-in account",
    save,
    clear,
    canSave: Boolean(key && hasContent),
  };
}
