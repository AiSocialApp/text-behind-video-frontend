"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AuthApi, AppApi, LoginResponse, MeResponse, setOnTokensRefreshed, setOnRemainingUpdated } from "@/lib/api";

type AuthContextType = {
  isLoading: boolean;
  isAuthenticated: boolean;
  tokens: {
    idToken: string | null;
    accessToken: string | null;
    refreshToken: string | null;
    expires: number | null; // epoch seconds
  };
  profile: MeResponse | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { email: string; given_name: string; family_name: string; password: string }) => Promise<void>;
  logout: () => void;
  updateRemaining: (remaining: { video: number | null; image: number | null }) => void;
  refreshProfile: () => Promise<MeResponse | null>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [tokens, setTokens] = useState<AuthContextType["tokens"]>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("tbv.auth");
        if (raw) {
          const saved = JSON.parse(raw) as { tokens: AuthContextType["tokens"]; profile: MeResponse | null };
          return saved.tokens || { idToken: null, accessToken: null, refreshToken: null, expires: null };
        }
      } catch {
        // ignore
      }
    }
    return { idToken: null, accessToken: null, refreshToken: null, expires: null };
  });
  const [profile, setProfile] = useState<MeResponse | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("tbv.auth");
        if (raw) {
          const saved = JSON.parse(raw) as { tokens: AuthContextType["tokens"]; profile: MeResponse | null };
          return saved.profile || null;
        }
      } catch {
        // ignore
      }
    }
    return null;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("tbv.auth", JSON.stringify({ tokens, profile }));
    }
  }, [tokens, profile]);

  // Persist refreshed tokens coming from api layer
  useEffect(() => {
    setOnTokensRefreshed((t) => {
      setTokens({
        idToken: t.idToken,
        accessToken: t.accessToken,
        refreshToken: t.refreshToken,
        expires: t.expires,
      });
    });
    setOnRemainingUpdated((remaining) => {
      setProfile((prev) => {
        const next = { ...(prev || {} as any) } as MeResponse;
        next.remaining = remaining;
        return next;
      });
    });
    return () => {
      setOnTokensRefreshed(undefined);
      setOnRemainingUpdated(undefined);
    };
  }, []);

  const isAuthenticated = Boolean(tokens.accessToken);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res: LoginResponse = await AuthApi.login(email, password);
      setTokens({
        idToken: res.id_token,
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
        expires: res.expires,
      });
      const me = await AppApi.me({
        accessToken: res.access_token,
        refreshToken: res.refresh_token,
        expires: res.expires,
        idToken: res.id_token,
      });
      setProfile(me);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "tbv.auth",
          JSON.stringify({ tokens: {
            idToken: res.id_token,
            accessToken: res.access_token,
            refreshToken: res.refresh_token,
            expires: res.expires,
          }, profile: me })
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (payload: { email: string; given_name: string; family_name: string; password: string }) => {
    setIsLoading(true);
    try {
      await AuthApi.register(payload);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setTokens({ idToken: null, accessToken: null, refreshToken: null, expires: null });
    setProfile(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("tbv.auth");
    }
  };

  const updateRemaining: AuthContextType["updateRemaining"] = (remaining) => {
    setProfile((prev) => {
      if (!prev) return prev;
      return { ...prev, remaining };
    });
  };

  const refreshProfile: AuthContextType["refreshProfile"] = async () => {
    if (!tokens.accessToken) return null;
    try {
      const me = await AppApi.me({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || null,
        expires: tokens.expires,
        idToken: tokens.idToken || undefined,
      } as any);
      setProfile(me);
      return me;
    } catch {
      return null;
    }
  };

  const value: AuthContextType = useMemo(
    () => ({ isLoading, isAuthenticated, tokens, profile, login, register, logout, updateRemaining, refreshProfile }),
    [isLoading, isAuthenticated, tokens, profile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}


