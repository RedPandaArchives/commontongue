// Thin client for the CommonTongue backend.
// All calls go to our own server — REST for auth/history/translation,
// a WebSocket for live messages. The JWT is kept in localStorage.

const TOKEN_KEY = "ct_token";
const USER_KEY = "ct_user";

export function saveAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function loadAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  const user = localStorage.getItem(USER_KEY);
  if (!token || !user) return null;
  try { return { token, user: JSON.parse(user) }; } catch { return null; }
}
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
function token() { return localStorage.getItem(TOKEN_KEY) || ""; }

async function req(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token() ? { Authorization: "Bearer " + token() } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export const api = {
  signup: (body) => req("/api/signup", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => req("/api/login", { method: "POST", body: JSON.stringify(body) }),
  messages: () => req("/api/messages").then((d) => d.messages || []),
  translate: (text, sourceLang, targetLang) =>
    req("/api/translate", { method: "POST", body: JSON.stringify({ text, sourceLang, targetLang }) }),
  openSocket() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    return new WebSocket(proto + "//" + location.host + "/ws?token=" + encodeURIComponent(token()));
  },
};
