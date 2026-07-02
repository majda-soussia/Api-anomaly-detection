const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });

  let body;
  try {
    body = await res.json();
  } catch {
    throw new ApiError('Invalid response from server.', res.status, 'INVALID_RESPONSE');
  }

  if (!res.ok || body.success === false) {
    throw new ApiError(body?.error?.message || 'Request failed.', res.status, body?.error?.code);
  }

  return { data: body.data, meta: body.meta };
}

function toQueryString(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.append(key, value);
  });
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export const api = {
  getAlerts: (params) => request(`/api/alerts${toQueryString(params)}`),
  getMttr: (params) => request(`/api/alerts/mttr${toQueryString(params)}`),
  acknowledgeAlert: (id, acknowledgedBy) =>
    request(`/api/alerts/${id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ acknowledged_by: acknowledgedBy }),
    }),
  getHealth: () => request('/api/health'),
};

export { ApiError, API_URL };
