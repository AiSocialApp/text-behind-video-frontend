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

export type RefreshResponse = {
  status: "ok";
  id_token: string;
  access_token: string;
  refresh_token: string;
  expires: number | null;
  refreshed: boolean;
  given_name: string | undefined;
  family_name: string | undefined;
  email: string;
  username: string;
  stripe_customer_id?: string;
  entitlement: string;
  allowances?: unknown;
  remaining?: unknown;
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
    refreshToken: `${AUTH_BASE}/refresh-token/`,
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

export async function _authFetch<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const headers: HeadersInit = {
    ...(init?.headers || {}),
    Authorization: `Bearer ${token}`,
  };
  return apiFetch<T>(url, { ...(init || {}), headers });
}

function nearExpiry(expires: number | null): boolean {
  if (!expires) return false;
  const now = Math.floor(Date.now() / 1000);
  // refresh if token is within 60 seconds of expiring
  return expires < (now + 60);
}

export async function authFetch<T>(
  url: string,
  tokens: {
    accessToken: string;
    refreshToken: string;
    expires: number | null;
    idToken?: string;
  },
  init?: RequestInit
): Promise<T> {
  if (nearExpiry(tokens.expires)) {
    const newTokens = await AuthApi.refreshToken(tokens.idToken || '', tokens.accessToken, tokens.refreshToken);
    tokens.idToken = newTokens.id_token;
    tokens.accessToken = newTokens.access_token;
    tokens.refreshToken = newTokens.refresh_token;
    tokens.expires = newTokens.expires;
  }
  return _authFetch<T>(url, tokens.accessToken, init);
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
  async refreshToken(
    id_token: string,
    access_token: string,
    refresh_token: string
  ): Promise<RefreshResponse> {
    return apiFetch<RefreshResponse>(endpoints.auth.refreshToken, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token, access_token, refresh_token }),
    });
  },
};

export const AppApi = {
  async me(
    tokens: { accessToken: string; refreshToken: string; expires: number | null; idToken?: string }
  ): Promise<MeResponse> {
    return authFetch<MeResponse>(endpoints.app.me, tokens);
  },

  async portal(
    tokens: { accessToken: string; refreshToken: string; expires: number | null; idToken?: string },
    account_id: string | undefined,
    return_url: string
  ): Promise<{ billing_portal_url: string }> {
    const url = new URL(endpoints.app.portal);
    if (account_id) url.searchParams.set('account_id', account_id);
    url.searchParams.set('return_url', return_url);
    return authFetch(url.toString(), tokens);
  },

  async startImageAsset(
    tokens: { accessToken: string; refreshToken: string; expires: number | null; idToken?: string },
    payload: { extension: string }
  ): Promise<{
    asset_id: string;
    image: { bucket: string; key: string; put_url: string };
  }> {
    return authFetch(endpoints.app.assetsImageStart, tokens, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extension: payload.extension.replace(/^\./, '') }),
    });
  },

  async listAssets(
    tokens: { accessToken: string; refreshToken: string; expires: number | null; idToken?: string },
    params?: { page?: number; limit?: number }
  ): Promise<{ assets: Record<string, any> }> {
    const url = new URL(endpoints.app.assets);
    if (params?.page) url.searchParams.set('page', String(params.page));
    if (params?.limit) url.searchParams.set('limit', String(params.limit));
    return authFetch(url.toString(), tokens);
  },

  async startAsset(
    tokens: { accessToken: string; refreshToken: string; expires: number | null; idToken?: string },
    payload: { extension: string; length: number }
  ): Promise<{
    asset_id: string;
    overlay: { bucket: string; key: string; put_url: string };
    video: { bucket: string; key: string; s3_upload_id: string };
  }> {
    return authFetch(endpoints.app.assetsStart, tokens, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extension: payload.extension.replace(/^\./, ''),
        length: Math.max(0, Math.floor(payload.length)),
      }),
    });
  },

  async signMultipartPart(
    tokens: { accessToken: string; refreshToken: string; expires: number | null; idToken?: string },
    params: { asset_id: string; s3_upload_id: string; part_number: number; key: string }
  ): Promise<{ url: string }> {
    const url = new URL(endpoints.app.uploadSign);
    url.searchParams.set('asset_id', params.asset_id);
    url.searchParams.set('s3_upload_id', params.s3_upload_id);
    url.searchParams.set('part_number', String(params.part_number));
    url.searchParams.set('key', params.key);
    return authFetch(url.toString(), tokens);
  },

  async completeMultipart(
    tokens: { accessToken: string; refreshToken: string; expires: number | null; idToken?: string },
    payload: { asset_id: string; s3_upload_id: string; key: string; parts: Array<{ ETag: string; PartNumber: number }> }
  ): Promise<{ status: string }> {
    return authFetch(endpoints.app.uploadComplete, tokens, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  async getAsset(
    tokens: { accessToken: string; refreshToken: string; expires: number | null; idToken?: string },
    asset_id: string
  ): Promise<{ asset: Record<string, unknown> }> {
    const url = `${endpoints.app.assets}${encodeURIComponent(asset_id)}/`;
    return authFetch(url, tokens);
  },
};


