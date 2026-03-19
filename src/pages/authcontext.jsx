import { createContext, useState, useEffect } from "react";
import axios from "axios";
import { auth } from "../firebase/firebase";
import { onAuthStateChanged } from "firebase/auth";

export const AuthContext = createContext();

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
    localStorage.setItem("username", userData.username);
    const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
    localStorage.setItem(tokenKey, token);
    localStorage.setItem("authToken", token);
    localStorage.setItem("token", token); // Legacy key used in some modules
    localStorage.setItem("user", JSON.stringify(userData));
    if (provider) localStorage.setItem("authProvider", provider);
    setUser(userData);
  };

  const logout = () => {
    const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
    localStorage.removeItem(tokenKey);
    localStorage.removeItem("authToken"); // Legacy key cleanup
    localStorage.removeItem("token"); // Legacy key cleanup
    localStorage.removeItem("user");
    localStorage.removeItem("username");
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

    const API_URL = import.meta.env.VITE_API_ADMIN_URL;
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

  useEffect(() => {
    const API_URL = import.meta.env.VITE_API_ADMIN_URL;
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
        login(nextUser, token, "firebase");
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

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshSession, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
};
