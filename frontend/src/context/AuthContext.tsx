import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface User {
  id: number;
  email: string;
  role: "ADMIN" | "ME" | "SUPPORT";
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Decode the JWT payload WITHOUT verifying the signature (verification is done by the backend). */
function decodeJwtPayload(token: string): User | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const payload = JSON.parse(json);
    // Expect claims: id (or sub), email, role
    return {
      id: payload.id ?? payload.sub,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");

    if (storedToken) {
      const decoded = decodeJwtPayload(storedToken);
      if (decoded) {
        setToken(storedToken);
        setUser(decoded);
      } else {
        localStorage.removeItem("token");
      }
    }
    setLoading(false);
  }, []);

  const login = (newToken: string) => {
    const decoded = decodeJwtPayload(newToken);
    if (!decoded) return;
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(decoded);
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
