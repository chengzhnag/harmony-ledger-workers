import { ApiResponse } from "../../shared/types"

export interface ApiError {
  message: string;
  errorCode?: string;
}

export function createApiError(message: string, errorCode?: string): ApiError {
  const error = new Error(message) as any;
  error.errorCode = errorCode;
  return error;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const fullPath = path.startsWith('https://') ? path : path

  // 从 localStorage 获取 token
  const stored = localStorage.getItem('harmony_user');
  let token: string | undefined;
  try {
    if (stored) {
      const user = JSON.parse(stored);
      token = user?.token;
    }
  } catch {
    // ignore
  }

  // 合并 headers，确保 Authorization 不被 init 覆盖
  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(fullPath, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> || {}),
      ...authHeaders, // ← 放在最后，确保 Authorization 始终有效
    },
  });

  // 401 未授权，清除用户信息并跳转登录
  if (res.status === 401) {
    localStorage.removeItem('harmony_user');
    window.location.href = '/login';
    throw createApiError('UNAUTHORIZED');
  }

  const json = (await res.json()) as ApiResponse<T> & { errorCode?: string };
  if (!res.ok || !json.success || json.data === undefined) {
    const errMsg = (json as any).error || 'Request failed';
    const errCode = (json as any).errorCode;
    throw createApiError(errMsg, errCode);
  }
  return json.data;
}
