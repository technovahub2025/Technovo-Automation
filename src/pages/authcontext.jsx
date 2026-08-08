import { createContext, useState, useEffect } from "react";
import axios from "axios";
import { auth } from "../firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { buildAgentAccessPayload } from "../utils/agentAccess";
import resolveAdminApiUrl from "../services/adminApiUrl";

export const AuthContext = createContext();
const DEBUG_AUTH = String(import.meta.env.VITE_DEBUG_IVR || localStorage.getItem('debugIvr') || '').toLowerCase() === 'true' || localStorage.getItem('debugIvr') === '1';

const debugAuthLog = (...args) => {
  if (!DEBUG_AUTH) return;
  console.debug('[AUTH]', ...args);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem("user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  const login = (userData, token, provider) => {
    const nextUser = {
      ...userData,
      ...buildAgentAccessPayload(userData)
    };
    localStorage.setItem("username", userData.username);
    localStorage.setItem("userId", String(nextUser.id || nextUser.userId || ""));
    const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
    localStorage.setItem(tokenKey, token);
    localStorage.setItem("authToken", token);
    localStorage.setItem("token", token); // Legacy key used in some modules
    localStorage.setItem("user", JSON.stringify(nextUser));
    if (provider) localStorage.setItem("authProvider", provider);
    debugAuthLog('login()', {
      provider,
      id: nextUser.id,
      userId: nextUser.userId,
      username: nextUser.username,
      role: nextUser.role,
      companyRole: nextUser.companyRole
    });
    setUser(nextUser);
  };

  const logout = () => {
    const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
    localStorage.removeItem(tokenKey);
    localStorage.removeItem("authToken"); // Legacy key cleanup
    localStorage.removeItem("token"); // Legacy key cleanup
    localStorage.removeItem("user");
    localStorage.removeItem("username");
    localStorage.removeItem("userId");
    localStorage.removeItem("authProvider");
    setUser(null);
  };

  const refreshSession = async () => {
    const provider = localStorage.getItem("authProvider");
    if (provider !== "firebase") {
      return { ok: false, message: "Firebase session not active" };
    }

    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      return { ok: false, message: "No Firebase user found" };
    }

    const API_URL = resolveAdminApiUrl();
    const idToken = await firebaseUser.getIdToken(true);
    const res = await axios.post(`${API_URL}/api/auth/firebase`, { idToken });
    const token = res.data.token;
    const nextUser = res.data.user;
    if (token && nextUser) {
      login(nextUser, token, "firebase");
      return { ok: true, message: "Session refreshed" };
    }

    return { ok: false, message: "Refresh failed" };
  };

  const refreshFromBackend = async () => {
    const API_URL = resolveAdminApiUrl();
    const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
    const token =
      localStorage.getItem(tokenKey) ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("token");
    if (!token) return { ok: false, message: "No token found" };
    try {
      const res = await axios.get(`${API_URL}/api/user/credentials`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = res?.data?.data;
      if (data) {
        const resolvedUserId =
          data?.userId ||
          data?.id ||
          user?.userId ||
          user?.id ||
          user?._id ||
          user?.userId ||
          "";
        const nextUser = {
          ...(user || {}),
          ...data,
          ...buildAgentAccessPayload(data),
          id: resolvedUserId,
          userId: data?.userId || data?.id || user?.userId || resolvedUserId
        };
        debugAuthLog('refreshFromBackend()', {
          resolvedUserId,
          payloadUserId: data?.userId,
          payloadId: data?.id,
          currentUserId: user?.id,
          currentUserUserId: user?.userId
        });
        login(nextUser, token, localStorage.getItem("authProvider") || "local");
        return { ok: true, message: "Session refreshed" };
      }
      return { ok: false, message: "No user data" };
    } catch (err) {
      return { ok: false, message: err?.response?.data?.message || "Refresh failed" };
    }
  };

  useEffect(() => {
    const API_URL = resolveAdminApiUrl();
    let refreshTimer = null;

    const clearRefresh = () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
        refreshTimer = null;
      }
    };

    const refreshBackendToken = async (firebaseUser) => {
      const idToken = await firebaseUser.getIdToken(true);
      const res = await axios.post(`${API_URL}/api/auth/firebase`, { idToken });
      const token = res.data.token;
      const nextUser = res.data.user;
      if (token && nextUser) {
        login({
          ...nextUser,
          ...buildAgentAccessPayload(nextUser)
        }, token, "firebase");
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      clearRefresh();
      const provider = localStorage.getItem("authProvider");
      if (!firebaseUser || provider !== "firebase") return;

      refreshBackendToken(firebaseUser).catch((err) => {
        console.warn("Firebase token refresh failed:", err?.message || err);
      });

      refreshTimer = setInterval(() => {
        refreshBackendToken(firebaseUser).catch((err) => {
          console.warn("Firebase token refresh failed:", err?.message || err);
        });
      }, 45 * 60 * 1000);
    });

    return () => {
      clearRefresh();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
    const token =
      localStorage.getItem(tokenKey) ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("token");
    const provider = localStorage.getItem("authProvider");
    if (!token || provider === "firebase") return;
    refreshFromBackend();
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshSession, refreshFromBackend, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
};
