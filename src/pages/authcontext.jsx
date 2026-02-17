import { createContext, useState, useEffect } from "react";

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

  const login = (userData, token) => {
    localStorage.setItem("username", userData.username);
    const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
    localStorage.setItem(tokenKey, token);
    localStorage.setItem("authToken", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    const tokenKey = import.meta.env.VITE_TOKEN_KEY || "authToken";
    localStorage.removeItem(tokenKey);
    localStorage.removeItem("authToken"); // Legacy key cleanup
    localStorage.removeItem("user");
    localStorage.removeItem("username");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading: false }}>
      {children}
    </AuthContext.Provider>
  );
};
