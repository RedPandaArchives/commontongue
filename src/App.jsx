import React, { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient.js";

const LANGS = [
  { code: "DE", name: "German" }, { code: "FR", name: "French" },
  { code: "EN", name: "English" }, { code: "ES", name: "Spanish" },
  { code: "IT", name: "Italian" }, { code: "PT", name: "Portuguese" },
  { code: "NL", name: "Dutch" }, { code: "PL", name: "Polish" },
  { code: "JA", name: "Japanese" }, { code: "ZH", name: "Chinese" },
  { code: "AR", name: "Arabic" }, { code: "XH", name: "Xhosa" },
];
const nameOf = (c) => (LANGS.find((l) => l.code === c) || {}).name || c;
const ACCENT = "#4fd1c5";
const ROOM = "lobby";

async function translate(text, sourceCode, targetCode) {
  if (sourceCode === targetCode) return text;
  const res = await fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, sourceLang: sourceCode, targetLang: targetCode }),
  });
  if (!res.ok) throw new Error("translate failed");
  const data = await res.json();
  const out = (data.translation || "").trim();
  if (!out) throw new Error("empty");
  return out;
}

// Cache-aware translation. Content-keyed so the same (source, target, text)
// is translated ONCE across every viewer and every repeat — not per person.
//   1. session cache (instant, no network)   2. shared DB cache (one round-trip)
//   3. miss -> pay for the API once, then write it back for everyone else.
const memCache = new Map();
const cacheKey = (text, s, t) => s + "|" + t + "|" + text;

async function translateCached(text, sourceCode, targetCode) {
  if (sourceCode === targetCode) return text;
  const key = cacheKey(text, sourceCode, targetCode);

  if (memCache.has(key)) return memCache.get(key);

  const { data: hit } = await supabase
    .from("translations").select("text").eq("cache_key", key).maybeSingle();
  if (hit && hit.text) {
    memCache.set(key, hit.text);
    return hit.text;
  }

  const out = await translate(text, sourceCode, targetCode);
  memCache.set(key, out);
  // write-back for everyone else; ignore if another client won the race
  await supabase.from("translations")
    .upsert({ cache_key: key, text: out }, { onConflict: "cache_key", ignoreDuplicates: true });
  return out;
}

function Auth() {
  const [mode, setMode] = useState("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [lang, setLang] = useState("EN");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async () => {
    setMsg(null);
    if (!email.trim() || !password) return setMsg({ t: "err", m: "Email and password required." });
    if (mode === "signup" && !name.trim()) return setMsg({ t: "err", m: "Pick a display name." });
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { display_name: name.trim(), lang } },
        });
        if (error) throw error;
        if (!data.session) setMsg({ t: "ok", m: "Account made. Check your email to confirm, then log in." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (e) {
      setMsg({ t: "err", m: e.message || "Something went wrong." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: 340, maxWidth: "90vw" }}>
        <div style={mono.brand}>
          <span style={{ color: ACCENT }}>COMMON</span><span style={{ color: "#f0a860" }}>TONGUE</span>
        </div>
        <p style={{ color: "#8ba0b4", fontSize: 13, margin: "8px 0 22px" }}>
          {mode === "signup" ? "Create an account to join the room." : "Log in to your account."}
        </p>
        {mode === "signup" && (
          <>
            <label style={lbl}>Display name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mac" style={field} />
            <label style={{ ...lbl, marginTop: 16 }}>You read and write in</label>
            <select value={lang} onChange={(e) => setLang(e.target.value)} style={field}>
              {LANGS.map((l) => <option key={l.code} value={l.code} style={{ background: "#16212e" }}>{l.code} · {l.name}</option>)}
            </select>
            <div style={{ height: 16 }} />
          </>
        )}
        <label style={lbl}>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" style={field} />
        <label style={{ ...lbl, marginTop: 16 }}>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} type="password" placeholder="password" style={field} />
        {msg && <p style={{ fontSize: 12.5, marginTop: 14, color: msg.t === "err" ? "#f0a860" : ACCENT }}>{msg.m}</p>}
        <button onClick={submit} disabled={busy} style={{ ...btn, width: "100%", marginTop: 20, opacity: busy ? 0.5 : 1 }}>
          {busy ? "..." : mode === "signup" ? "Create account" : "Log in"}
        </button>
        <p style={{ color: "#6f869a", fontSize: 12.5, marginTop: 18, textAlign: "center" }}>
          {mode === "signup" ? "Already have an account? " : "Need an account? "}
          <button onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setMsg(null); }} style={{ ...linkBtn, fontSize: 12.5, fontFamily: "inherit", color: ACCENT }}>
            {mode === "signup" ? "Log in" : "Sign up"}
          </button>
        </p>
      </div>
    </div>
  );
}

function Profile({ onDone }) {
  const [name, setName] = useState("");
  const [lang, setLang] = useState("EN");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    await supabase.auth.updateUser({ data: { display_name: name.trim(), lang } });
    setBusy(false);
    onDone();
  };
  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: 320, maxWidth: "90vw" }}>
        <div style={mono.brand}><span style={{ color: ACCENT }}>SET UP</span></div>
        <label style={{ ...lbl, marginTop: 18 }}>Display name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={field} />
        <label style={{ ...lbl, marginTop: 16 }}>Language</label>
        <select value={lang} onChange={(e) => setLang(e.target.value)} style={field}>
          {LANGS.map((l) => <option key={l.code} value={l.code} style={{ background: "#16212e" }}>{l.code} · {l.name}</option>)}
        </select>
        <button onClick={save} disabled={busy} style={{ ...btn, width: "100%", marginTop: 20 }}>Continue</button>
      </div>
    </div>
  );
}

function Bubble({ m, me }) {
  const own = m.sender_id === me.id;
  const [showOriginal, setShowOriginal] = useState(false);
  let body;
  if (own || m.source_lang === me.lang) body = m.text;
  else if (m.status === "error") body = m.text;
  else if (m.status === "done") body = showOriginal ? m.text : m.translated;
  else body = null;
  return (
    <div style={{ display: "flex", justifyContent: own ? "flex-end" : "flex-start", marginBottom: 14 }}>
      <div style={{ maxWidth: "78%" }}>
        <div style={{ background: own ? "#22303f" : "#1a2735", border: "1px solid " + (own ? ACCENT + "44" : "#28394a"), borderRadius: 14, borderTopRightRadius: own ? 4 : 14, borderTopLeftRadius: own ? 14 : 4, padding: "10px 13px", fontSize: 14.5, lineHeight: 1.5, color: "#e8eef4" }}>
          {body === null ? <span className="ib-shimmer" style={{ color: "#8ba0b4", fontSize: 13 }}>interpreting...</span> : <span>{body}</span>}
          {m.status === "error" && !own && m.source_lang !== me.lang && <span style={{ color: "#f0a860", fontSize: 11.5, marginLeft: 8 }}>· untranslated</span>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, padding: "0 4px", justifyContent: own ? "flex-end" : "flex-start" }}>
          <span style={{ ...mono.meta, color: own ? ACCENT : "#f0a860" }}>{m.sender_name} · {m.source_lang}</span>
          {!own && m.status === "done" && m.source_lang !== me.lang && (
            <button onClick={() => setShowOriginal((s) => !s)} style={linkBtn}>{showOriginal ? "show " + me.lang : "show " + m.source_lang}</button>
          )}
        </div>
      </div>
    </div>
  );
}

function Room({ me }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("connecting");
  const scrollRef = useRef(null);
  const meRef = useRef(me);
  meRef.current = me;

  const interpret = useCallback(async (row) => {
    const v = meRef.current;
    if (row.sender_id === v.id || row.source_lang === v.lang) return;
    try {
      const t = await translateCached(row.text, row.source_lang, v.lang);
      setMessages((ms) => ms.map((x) => (x.id === row.id ? { ...x, translated: t, status: "done" } : x)));
    } catch {
      setMessages((ms) => ms.map((x) => (x.id === row.id ? { ...x, status: "error" } : x)));
    }
  }, []);

  const ingest = useCallback((row) => {
    const needs = row.sender_id !== meRef.current.id && row.source_lang !== meRef.current.lang;
    setMessages((ms) => {
      if (ms.some((x) => x.id === row.id)) return ms;
      return [...ms, { ...row, translated: "", status: needs ? "sending" : "done" }];
    });
    if (needs) interpret(row);
  }, [interpret]);

  useEffect(() => {
    let channel;
    (async () => {
      const { data } = await supabase.from("messages").select("*").eq("room", ROOM).order("created_at", { ascending: true }).limit(100);
      (data || []).forEach(ingest);
      channel = supabase.channel("room:" + ROOM)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: "room=eq." + ROOM }, ({ new: row }) => ingest(row))
        .subscribe((s) => setStatus(s === "SUBSCRIBED" ? "live" : "connecting"));
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [ingest]);

  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages]);

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    const { error } = await supabase.from("messages").insert({ room: ROOM, sender_id: me.id, sender_name: me.name, source_lang: me.lang, text });
    if (error) console.error(error);
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={hdr}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, minWidth: 0 }}>
          <span style={mono.brand}><span style={{ color: ACCENT }}>COMMON</span><span style={{ color: "#54697c" }}>·</span><span style={{ color: "#f0a860" }}>TONGUE</span></span>
          <span style={{ color: "#54697c", fontSize: 12, whiteSpace: "nowrap" }}>{me.name} · reading {me.lang}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ ...mono.meta, color: status === "live" ? ACCENT : "#8ba0b4" }}>{status === "live" ? "● live" : "○ connecting"}</span>
          <button onClick={() => supabase.auth.signOut()} style={linkBtn}>sign out</button>
        </div>
      </header>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "18px 16px 8px", maxWidth: 760, width: "100%", margin: "0 auto" }}>
        {messages.length === 0 && (
          <div style={{ color: "#4a6076", fontSize: 13, textAlign: "center", marginTop: 48, lineHeight: 1.6 }}>
            No messages yet. Say something in {nameOf(me.lang)} —<br />anyone who joins in another language reads it in theirs.
          </div>
        )}
        {messages.map((m) => <Bubble key={m.id} m={m} me={me} />)}
      </div>
      <div style={{ maxWidth: 760, width: "100%", margin: "0 auto" }}>
        <div style={{ padding: 12, borderTop: "1px solid #1f2e3c", display: "flex", gap: 8 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={"Message in " + nameOf(me.lang) + "..."} style={{ ...field, flex: 1, marginTop: 0 }} />
          <button onClick={send} style={btn}>Send</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileDone, setProfileDone] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  let content;
  if (loading) {
    content = <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#54697c", fontFamily: "ui-monospace, monospace", fontSize: 13 }}>loading...</div>;
  } else if (!session) {
    content = <Auth />;
  } else {
    const md = session.user.user_metadata || {};
    if (!md.display_name || !md.lang) {
      content = <Profile onDone={() => setProfileDone((n) => n + 1)} />;
    } else {
      content = <Room key={profileDone} me={{ id: session.user.id, name: md.display_name, lang: md.lang }} />;
    }
  }

  return (
    <div style={{ height: "100vh", background: "#0b131b", color: "#e8eef4", fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
      <style>{`
        @keyframes ib-pulse { 0%,100%{opacity:.45} 50%{opacity:1} }
        .ib-shimmer { animation: ib-pulse 1.1s ease-in-out infinite; }
        *::-webkit-scrollbar { width: 8px; } *::-webkit-scrollbar-thumb { background:#22333f; border-radius:8px; }
        input:focus, select:focus, button:focus-visible { outline: 2px solid #4fd1c5; outline-offset: 1px; }
      `}</style>
      {content}
    </div>
  );
}

const mono = {
  brand: { fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 700, letterSpacing: "0.14em", fontSize: 15 },
  meta: { fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5, letterSpacing: "0.08em" },
};
const lbl = { display: "block", fontSize: 12, color: "#8ba0b4", marginBottom: 6, letterSpacing: "0.02em" };
const field = { width: "100%", boxSizing: "border-box", background: "#0c141c", border: "1px solid #223343", borderRadius: 10, padding: "10px 12px", color: "#e8eef4", fontSize: 14, outline: "none" };
const btn = { background: ACCENT, color: "#0c141c", border: "none", borderRadius: 10, padding: "0 18px", height: 42, fontWeight: 700, fontSize: 13, cursor: "pointer", letterSpacing: "0.02em" };
const linkBtn = { background: "transparent", border: "none", cursor: "pointer", color: "#6f869a", fontSize: 10, fontFamily: "ui-monospace, Menlo, monospace", letterSpacing: "0.06em", textDecoration: "underline", padding: 0 };
const hdr = { padding: "13px 20px", borderBottom: "1px solid #1c2a37", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };
