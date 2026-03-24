/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { AuthApi, setAuthToken } from "../lib/api";
import type { User } from "../types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "csms_token";
const USER_KEY = "csms_user";

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  });
  const [isLoading, setIsLoading] = useState(() => Boolean(token && !user));

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setAuthToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await AuthApi.login(email, password);
    const nextToken = response.token.access_token;
    setToken(nextToken);
    setUser(response.user);
    setAuthToken(nextToken);
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
  }, []);

  useEffect(() => {
    async function hydrate() {
      if (!token) {
        setIsLoading(false);
        return;
      }

      const hasLocalUser = Boolean(localStorage.getItem(USER_KEY));
      try {
        setAuthToken(token);
        if (hasLocalUser) {
          setIsLoading(false);
        }
        const me = await AuthApi.me();
        setUser(me);
        localStorage.setItem(USER_KEY, JSON.stringify(me));
      } catch {
        logout();
      } finally {
        if (!hasLocalUser) {
          setIsLoading(false);
        }
      }
    }

    void hydrate();
  }, [token, logout]);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      login,
      logout,
    }),
    [user, token, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
