"use client";

export type LoginResponse = {
  status: "ok";
  id_token: string;
  access_token: string;
  refresh_token: string;
  expires: number; // epoch seconds
  given_name: string;
  family_name: string;
  email: string;
  username: string;
  stripe_customer_id?: string;
  entitlement: string;
  assets?: Record<string, unknown>;
};

export type MeResponse = {
  status: "ok";
  given_name: string;
  family_name: string;
  email: string;
  username: string;
  stripe_customer_id?: string;
  entitlement: string;
  assets?: Record<string, unknown>;
  allowances?: { video: number | null; image: number | null; rolling?: boolean; "4k"?: boolean };
  remaining?: { video: number | null; image: number | null };
};

const AUTH_BASE = process.env.NEXT_PUBLIC_AUTH_API_BASE || "https://auth.api.textbehindvideo.io";
const APP_BASE = process.env.NEXT_PUBLIC_APP_API_BASE || "https://api.textbehindvideo.io";

export const endpoints = {
  auth: {
    login: `${AUTH_BASE}/login/`,
    register: `${AUTH_BASE}/register/`,
    confirmEmail: `${AUTH_BASE}/confirm-email/`,
    resendCode: `${AUTH_BASE}/resend-confirmation-code/`,
    forgotPassword: `${AUTH_BASE}/forgot-password/`,
    resetPassword: `${AUTH_BASE}/reset-password/`,
  },
  app: {
    me: `${APP_BASE}/me/`,
    assets: `${APP_BASE}/assets/`,
    assetsStart: `${APP_BASE}/assets/start/`,
    assetsImageStart: `${APP_BASE}/assets/image/start/`,
    uploadSign: `${APP_BASE}/uploads/multipart/sign/`,
    uploadComplete: `${APP_BASE}/uploads/multipart/complete/`,
    portal: `${APP_BASE}/portal/`,
  },
};

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown) {
    const message = typeof detail === "string" ? detail : JSON.stringify(detail);
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let detail: unknown = null;
    try {
      detail = await res.json();
    } catch {
      try {
        detail = await res.text();
      } catch {
        detail = null;
      }
    }
    throw new ApiError(res.status, (detail as any)?.detail ?? detail);
  }
  return (await res.json()) as T;
}

export async function authFetch<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const headers: HeadersInit = {
    ...(init?.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  return apiFetch<T>(url, { ...(init || {}), headers });
}

export const AuthApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    return apiFetch<LoginResponse>(endpoints.auth.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  },
  async register(payload: { email: string; given_name: string; family_name: string; password: string }) {
    return apiFetch(endpoints.auth.register, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
  async confirmEmail(email: string, confirmation_code: string, password?: string) {
    return apiFetch(endpoints.auth.confirmEmail, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, confirmation_code, password }),
    });
  },
  async resendCode(email: string) {
    return apiFetch(endpoints.auth.resendCode, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  },
  async forgotPassword(email: string) {
    return apiFetch(endpoints.auth.forgotPassword, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
  },
  async resetPassword(email: string, reset_code: string, new_password: string) {
    return apiFetch(endpoints.auth.resetPassword, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, reset_code, new_password }),
    });
  },
};

export const AppApi = {
  async me(accessToken: string): Promise<MeResponse> {
    return authFetch<MeResponse>(endpoints.app.me, accessToken);
  },
  async portal(accessToken: string, account_id: string | undefined, return_url: string): Promise<{ billing_portal_url: string }> {
    const url = new URL(endpoints.app.portal);
    if (account_id) url.searchParams.set("account_id", account_id);
    url.searchParams.set("return_url", return_url);
    return authFetch(url.toString(), accessToken);
  },
};


