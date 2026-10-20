// Conversa livre com um conselheiro (src/agents.ts). O site manda a pergunta, as últimas mensagens e os números da
// pessoa; a resposta volta em texto curto, na voz do personagem. Login pelo token do painel e limite por dia.
//
// Exige ANTHROPIC_API_KEY na Vercel. Sem ela, responde 503 e o site mostra o aviso.

import Anthropic from '@anthropic-ai/sdk';
import { bumpUsage, phoneFromWebLink } from '../server/whatsapp/hubdb.js';

const DAILY_LIMIT = Number(process.env.CONSELHEIRO_DAILY_LIMIT || 30);
const MAX_BYTES = 12_000;

const PERSONAS: Record<string, string> = {
  dabasir: 'Dabasir, o vendedor de camelos que saiu das dívidas vivendo com 70% do que ganhava, guardando 10% e pagando 20% aos credores. Você ajuda a pessoa a sair das dívidas, uma por uma.',
  bansir: 'Bansir, o fazedor de carruagens que trabalhava muito e nunca sobrava nada, até anotar cada conta e cada vencimento. Você ajuda a organizar as contas do mês e a não pagar multa.',
  arkad: 'Arkad, o homem mais rico da Babilônia, que começou guardando uma moeda de cada dez. Você ensina a pagar a si mesmo primeiro, mesmo ganhando pouco.',
  nomasir: 'Nomasir, filho de Arkad, que perdeu tudo por descuido e aprendeu a vigiar cada moeda. Você ajuda a achar assinaturas, tarifas e gastos que escapam.',
  mathon: 'Mathon, o emprestador de ouro da Babilônia. Você ajuda a pessoa a decidir se um empréstimo cabe no mês dela e a olhar o custo total antes de assinar.',
  rodan: 'Rodan, o fazedor de lanças que ganhou ouro de uma vez e quase perdeu tudo. Você ajuda a dar destino ao 13º, à restituição e a qualquer dinheiro extra.',
  sharru: 'Sharru Nada, o mercador que fez o ouro trabalhar por ele. Com as ideias de Pai Rico, Pai Pobre (ativos colocam dinheiro no bolso, passivos tiram), você mostra o caminho pra viver de renda, depois de sair das dívidas.',
};

const RULES = [
  'Fale em português do Brasil, simples, como um amigo que entende de dinheiro. Nada de termos difíceis.',
  'Responda em no máximo 5 frases curtas. Sem emojis, sem listas longas, sem markdown.',
  'O foco é sair das dívidas e organizar a vida financeira, usando as lições de O Homem Mais Rico da Babilônia e de Pai Rico, Pai Pobre.',
  'Use os números da pessoa quando ajudar, e faça as contas com cuidado. Não invente valores que ela não deu.',
  'Não indique banco, corretora, produto ou investimento específico, e não prometa resultado. Isto é educação financeira, não recomendação de investimento.',
  'Se fizer sentido, termine com um próximo passo concreto que ela consegue fazer esta semana.',
  'Se a pergunta não tem nada a ver com dinheiro, traga a conversa de volta com gentileza.',
].join('\n');

type Line = { from?: string; text?: string };
type Body = { agent?: string; question?: string; history?: Line[]; context?: Record<string, unknown> };

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: 'A conversa livre ainda não foi ativada. O seu plano e os próximos passos já estão salvos.' }, 503);

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() ?? '';
  const phone = token ? await phoneFromWebLink(token).catch(() => null) : null;
  if (!phone) return json({ error: 'Entre pelo link do WhatsApp pra conversar com o conselheiro.' }, 401);

  const raw = await request.text();
  if (raw.length > MAX_BYTES) return json({ error: 'Mensagem grande demais.' }, 413);
  let body: Body;
  try {
    body = JSON.parse(raw) as Body;
  } catch {
    return json({ error: 'Mensagem inválida.' }, 400);
  }
  const persona = PERSONAS[body.agent ?? ''] ?? 'um conselheiro financeiro da Grana Séria. Você ajuda a pessoa a cumprir o objetivo que ela mesma criou.';
  const question = (body.question ?? '').trim().slice(0, 400);
  if (!question) return json({ error: 'Escreva sua pergunta.' }, 400);

  const day = new Date().toISOString().slice(0, 10);
  if (!(await bumpUsage(phone, `conselheiro:${day}`, DAILY_LIMIT).catch(() => true))) {
    return json({ error: 'Por hoje chega de conversa. Amanhã a gente continua, e seus próximos passos já estão no painel.' }, 429);
  }

  // as últimas mensagens, alternando quem fala (a API pede começar pela pessoa e terminar na pergunta)
  const past = (Array.isArray(body.history) ? body.history : [])
    .slice(-7, -1)
    .filter((m) => typeof m?.text === 'string' && m.text.trim())
    .map((m) => ({ role: m.from === 'me' ? ('user' as const) : ('assistant' as const), content: String(m.text).slice(0, 800) }));
  while (past.length && past[0].role !== 'user') past.shift();
  const messages: Anthropic.MessageParam[] = [];
  for (const m of past) {
    const last = messages[messages.length - 1];
    if (last && last.role === m.role) last.content = `${String(last.content)}\n${m.content}`;
    else messages.push(m);
  }
  if (messages.length && messages[messages.length - 1].role === 'user') messages.pop();
  messages.push({ role: 'user', content: question });

  const system = `Você é ${persona}\n\n${RULES}\n\nOs números da pessoa (R$ por mês; dívidas com saldo e parcela): ${JSON.stringify(body.context ?? {}).slice(0, 4000)}`;

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: process.env.CONSELHEIRO_AI_MODEL || 'claude-opus-5-5',
      max_tokens: 1200,
      output_config: { effort: 'low' },
      system,
      messages,
    });
    if (response.stop_reason === 'refusal') return json({ reply: 'Sobre isso eu não consigo te ajudar. Me pergunta algo sobre o seu dinheiro e o seu plano.' });
    const reply = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    return json({ reply: reply || 'Não consegui responder agora. Tenta de novo daqui a pouco.' });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'Muita gente conversando agora. Tenta de novo em um minuto.' }, 503);
    console.error('Conselheiro: erro na API', err);
    return json({ error: 'Não consegui responder agora. Tenta de novo daqui a pouco.' }, 502);
  }
}
