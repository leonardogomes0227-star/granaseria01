// Áudio do WhatsApp vira texto. A API do Claude não recebe áudio, então usa um serviço de transcrição no padrão
// da OpenAI (/audio/transcriptions): Groq (GROQ_API_KEY, mais barato) ou OpenAI (OPENAI_API_KEY).
// TRANSCRIBE_URL e TRANSCRIBE_MODEL trocam o serviço/modelo se precisar. Sem chave nenhuma, o bot pede texto.

export function transcribeConfigured(): boolean {
  return Boolean(process.env.TRANSCRIBE_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
}

export async function transcribe(base64: string, mime: string): Promise<string> {
  const groq = !process.env.TRANSCRIBE_API_KEY && !process.env.OPENAI_API_KEY && Boolean(process.env.GROQ_API_KEY);
  const key = process.env.TRANSCRIBE_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
  if (!key) throw new Error('transcrição não configurada');
  const url = process.env.TRANSCRIBE_URL || (groq ? 'https://api.groq.com/openai/v1/audio/transcriptions' : 'https://api.openai.com/v1/audio/transcriptions');
  const model = process.env.TRANSCRIBE_MODEL || (groq ? 'whisper-large-v3-turbo' : 'gpt-4o-mini-transcribe');
  const ext = mime.includes('mpeg') ? 'mp3' : mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : mime.includes('wav') ? 'wav' : 'ogg';
  const form = new FormData();
  form.append('file', new Blob([Buffer.from(base64, 'base64')], { type: mime.split(';')[0] || 'audio/ogg' }), `audio.${ext}`);
  form.append('model', model);
  form.append('language', 'pt');
  form.append('response_format', 'json');
  // ajuda o modelo com o jeito de falar de quem anota gasto
  form.append('prompt', 'Gastei 35 reais no mercado no pix. Recebi 3000 de salário. Uber 18,50 no débito.');
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!res.ok) throw new Error(`transcrição ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { text?: string };
  return (data.text ?? '').trim();
}
