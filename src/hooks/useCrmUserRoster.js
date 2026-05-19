import { useEffect, useState } from "react";
import { getCrmUserRoster, subscribeCrmUserRoster } from "../services/crmService";

const normalizeRosterMeta = (meta = {}) => ({
  source: String(meta?.source || "").trim() || "websocket",
  updatedAt: Number(meta?.updatedAt || 0) || Date.now(),
  fallback: Boolean(meta?.fallback)
});

const useCrmUserRoster = ({ enabled = true } = {}) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState("");
  const [source, setSource] = useState("websocket");
  const [updatedAt, setUpdatedAt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setUsers([]);
      setLoading(false);
      setError("");
      setSource("disabled");
      setUpdatedAt(0);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError("");

    const unsubscribe = subscribeCrmUserRoster((nextPayload = {}) => {
      if (!active) return;

      const nextUsers = Array.isArray(nextPayload?.users) ? nextPayload.users : [];
      const nextMeta = normalizeRosterMeta(nextPayload);
      setUsers(nextUsers);
      setSource(nextMeta.source);
      setUpdatedAt(nextMeta.updatedAt);
      setLoading(false);
    });

    getCrmUserRoster()
      .then((result) => {
        if (!active) return;

        const nextUsers = Array.isArray(result?.data) ? result.data : [];
        setUsers(nextUsers);
        setSource(String(result?.source || "fallback").trim() || "fallback");
        setUpdatedAt(Number(result?.updatedAt || Date.now()) || Date.now());
        setError(result?.success === false ? result?.error || "Failed to load CRM users" : "");
        setLoading(false);
      })
      .catch((fetchError) => {
        if (!active) return;
        setUsers([]);
        setError(fetchError?.message || "Failed to load CRM users");
        setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [enabled]);

  return {
    users,
    loading,
    error,
    source,
    updatedAt
  };
};

export default useCrmUserRoster;
