// Server-side translation via DeepL (free tier), with a shared cache.
// Ported from the original serverless proxy: the API key stays on the server,
// and each (source, target, text) is translated once and reused for everyone.
const db = require("./db");

const TARGET_FIX = { EN: "EN-US", PT: "PT-PT" }; // DeepL wants regional variants

// DeepL has two endpoints. Free-tier keys end in ":fx" and use api-free;
// Pro keys use api.deepl.com. Pick automatically so either key type works.
function deeplEndpoint() {
  const k = process.env.DEEPL_API_KEY || "";
  return k.endsWith(":fx")
    ? "https://api-free.deepl.com/v2/translate"
    : "https://api.deepl.com/v2/translate";
}

async function translate(text, sourceLang, targetLang) {
  if (!text || !targetLang) throw new Error("text and targetLang required");
  if (sourceLang === targetLang) return text;

  const key = sourceLang + "|" + targetLang + "|" + text;
  const cached = db.getCachedTranslation(key);
  if (cached) return cached;

  const target = TARGET_FIX[targetLang] || targetLang;
  const r = await fetch(deeplEndpoint(), {
    method: "POST",
    headers: {
      Authorization: "DeepL-Auth-Key " + process.env.DEEPL_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: [text], source_lang: sourceLang, target_lang: target }),
  });
  if (!r.ok) {
    const detail = await r.text();
    console.error("deepl", r.status, detail);
    throw new Error("translation failed");
  }
  const data = await r.json();
  const out = ((data.translations && data.translations[0] && data.translations[0].text) || "").trim() || text;
  db.putCachedTranslation(key, out);
  return out;
}

module.exports = { translate };
