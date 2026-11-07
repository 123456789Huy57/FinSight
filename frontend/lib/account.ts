export const ACCESS_TOKEN_KEY = 'finsight_access_token'

export async function accountFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = (token: string | null) => fetch(path, {
    ...init,
    headers: {
      ...Object.fromEntries(new Headers(init.headers).entries()),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'same-origin',
    cache: 'no-store',
  })

  const token = sessionStorage.getItem(ACCESS_TOKEN_KEY)
  const response = await send(token)
  if (response.status !== 401 || !token) return response

  try {
    const refreshed = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
    if (!refreshed.ok) {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY)
      return response
    }
    const payload = await refreshed.json() as { accessToken: string }
    sessionStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken)
    return send(payload.accessToken)
  } catch {
    return response
  }
}
