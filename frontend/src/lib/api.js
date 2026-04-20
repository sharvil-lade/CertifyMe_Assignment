const API_URL = import.meta.env.VITE_API_URL || "/api";

export async function apiRequest(url, options = {}) {
  const config = { method: "GET", credentials: "include", ...options };
  const headers = { ...(config.headers || {}) };

  if (config.body !== undefined && !(config.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(config.body);
  }
  config.headers = headers;

  const fullUrl = url.startsWith("http") ? url : `${API_URL}${url}`;
  const response = await fetch(fullUrl, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || "Request failed");
    error.status = response.status;
    error.errors = data.errors || {};
    throw error;
  }

  return data;
}
