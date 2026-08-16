// Backend translation proxy — DeepL free tier.
const TARGET_FIX = { EN: "EN-US", PT: "PT-PT" };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST." });
  }
  const { text, sourceLang, targetLang } = req.body || {};
  if (!text || !targetLang) {
    return res.status(400).json({ error: "text and targetLang are required." });
  }
  if (sourceLang === targetLang) {
    return res.status(200).json({ translation: text });
  }
  try {
    const target = TARGET_FIX[targetLang] || targetLang;
    const r = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        "Authorization": "DeepL-Auth-Key " + process.env.DEEPL_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: [text],
        source_lang: sourceLang,
        target_lang: target,
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      console.error("deepl", r.status, detail);
      return res.status(502).json({ error: "Translation failed." });
    }
    const data = await r.json();
    const out = (data.translations && data.translations[0] && data.translations[0].text || "").trim();
    return res.status(200).json({ translation: out || text });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Translation failed." });
  }
}