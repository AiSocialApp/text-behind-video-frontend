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
    paymentLink: `${APP_BASE}/payment/link/`,
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

function isExpired(expires: number | null): boolean {
  if (expires === null) return true;
  const now = Math.floor(Date.now() / 1000);
  return expires <= now;
}

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expires: number | null;
  idToken?: string;
};

let onTokensRefreshed: ((tokens: {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expires: number | null;
}) => void) | null = null;

let onRemainingUpdated: ((remaining: { video: number | null; image: number | null }) => void) | null = null;

export function setOnTokensRefreshed(handler?: (tokens: {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expires: number | null;
}) => void) {
  onTokensRefreshed = handler || null;
}

export function setOnRemainingUpdated(handler?: (remaining: { video: number | null; image: number | null }) => void) {
  onRemainingUpdated = handler || null;
}

async function refreshIfExpired(tokens: AuthTokens): Promise<boolean> {
  if (!isExpired(tokens.expires)) return false;
  const newTokens = await AuthApi.refreshToken(tokens.idToken || '', tokens.accessToken, tokens.refreshToken);

  tokens.idToken = newTokens.id_token;
  tokens.accessToken = newTokens.access_token;
  tokens.refreshToken = newTokens.refresh_token;

  if (newTokens.refreshed) {
    tokens.expires = newTokens.expires;
  }

  if (onTokensRefreshed) {
    onTokensRefreshed({
      idToken: newTokens.id_token,
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token,
      expires: newTokens.refreshed ? newTokens.expires : tokens.expires,
    });
  }

  return newTokens.refreshed;
}

export async function authFetch<T>(
  url: string,
  tokens: AuthTokens,
  init?: RequestInit
): Promise<T> {
  await refreshIfExpired(tokens);
  try {
    return await _authFetch<T>(url, tokens.accessToken, init);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      await refreshIfExpired(tokens);
      return _authFetch<T>(url, tokens.accessToken, init);
    }
    throw err;
  }
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
    tokens: { accessToken: string; refreshToken: string; expires: number | null; idToken?: string }
  ): Promise<{ billing_portal_url: string }> {
    return authFetch(endpoints.app.portal, tokens);
  },

  async checkout(
    tokens: { accessToken: string; refreshToken: string; expires: number | null; idToken?: string },
    params: { plan: 'starter' | 'pro'; period: 'monthly' | 'annual' }
  ): Promise<{ checkout_url: string }> {
    const url = new URL(endpoints.app.paymentLink);
    url.searchParams.set('plan', params.plan);
    url.searchParams.set('period', params.period);
    return authFetch(url.toString(), tokens);
  },

  async startImageAsset(
    tokens: { accessToken: string; refreshToken: string; expires: number | null; idToken?: string },
    payload: { extension: string }
  ): Promise<{
    asset_id: string;
    image: { bucket: string; key: string; put_url: string };
    remaining?: MeResponse['remaining'];
  }> {
    const res = await authFetch<{
      asset_id: string;
      image: { bucket: string; key: string; put_url: string };
      remaining?: MeResponse['remaining'];
    }>(endpoints.app.assetsImageStart, tokens, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ extension: payload.extension.replace(/^\./, '') }),
    });
    if (res.remaining && onRemainingUpdated) onRemainingUpdated(res.remaining as NonNullable<MeResponse['remaining']>);
    return res;
  },

  async listAssets(
    tokens: { accessToken: string; refreshToken: string; expires: number | null; idToken?: string },
    params?: { page?: number; limit?: number }
  ): Promise<{ assets: Record<string, any>; remaining?: MeResponse['remaining'] }> {
    const url = new URL(endpoints.app.assets);
    if (params?.page) url.searchParams.set('page', String(params.page));
    if (params?.limit) url.searchParams.set('limit', String(params.limit));
    const res = await authFetch<{ assets: Record<string, any>; remaining?: MeResponse['remaining'] }>(url.toString(), tokens);
    if (res.remaining && onRemainingUpdated) onRemainingUpdated(res.remaining as NonNullable<MeResponse['remaining']>);
    return res;
  },

  async startAsset(
    tokens: { accessToken: string; refreshToken: string; expires: number | null; idToken?: string },
    payload: { extension: string; length: number; resolution?: number }
  ): Promise<{
    asset_id: string;
    overlay: { bucket: string; key: string; put_url: string };
    video: { bucket: string; key: string; s3_upload_id: string };
    remaining?: MeResponse['remaining'];
  }> {
    const res = await authFetch<{
      asset_id: string;
      overlay: { bucket: string; key: string; put_url: string };
      video: { bucket: string; key: string; s3_upload_id: string };
      remaining?: MeResponse['remaining'];
    }>(endpoints.app.assetsStart, tokens, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extension: payload.extension.replace(/^\./, ''),
        length: Math.max(0, Math.floor(payload.length)),
        resolution: payload.resolution ?? 720,
      }),
    });
    if (res.remaining && onRemainingUpdated) onRemainingUpdated(res.remaining as NonNullable<MeResponse['remaining']>);
    return res;
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


