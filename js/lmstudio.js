const LMStudio = (() => {

  async function chat(messages, systemPrompt) {
    const cfg = Config.get();
    const resp = await fetch(`${cfg.lmUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.lmModel,
        temperature: cfg.lmTemp,
        max_tokens: 150,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          ...messages
        ]
      })
    });
    if (!resp.ok) throw new Error(`LM Studio error: ${resp.status}`);
    return (await resp.json()).choices[0].message.content.trim();
  }

  // ---- Expand a short prompt into a full torzev prompt ----
  async function expandPrompt(shortPrompt, mode) {
    const system = `FLUX.2 prompt engineer. Archigram style. LoRA trigger: "torzev" (always first word). Bold technical ink, flat primary colors, hand-drawn. Mode: ${mode}. Return ONLY the prompt text.`;

    const prompt = `Expand into a FLUX.2 prompt (60-80 words): "${shortPrompt}"
Start with "torzev". Include: architectural detail, ink illustration style, flat color fills, camera angle, specific colors. No explanation, only the prompt.`;

    return await chat([{ role: 'user', content: prompt }], system);
  }

  // ---- Generate a story arc for the magazine ----
  async function generateStoryArc(premise, panelCount) {
    const system = `Archigram comic narrative writer. Return EXACTLY ${panelCount} panels as JSON. No markdown, no preamble.`;

    const prompt = `${panelCount}-panel comic arc: "${premise}"
JSON: {"title":"...","panels":[{"panel":1,"scene":"...","dialogue":"..."}]}
Only valid JSON.`;

    const raw = await chat([{ role: 'user', content: prompt }], system);
    try { return JSON.parse(raw.replace(/```json|```/g, '').trim()); }
    catch { throw new Error('LLM returned invalid JSON. Try again.'); }
  }

  // ---- Ping LM Studio ----
  async function ping() {
    const cfg = Config.get();
    try {
      const resp = await fetch(`${cfg.lmUrl}/v1/models`, {
        signal: AbortSignal.timeout(3000)
      });
      return resp.ok;
    } catch { return false; }
  }

  return { expandPrompt, generateStoryArc, ping };
})();