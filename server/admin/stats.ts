// Painel do dono: transforma os eventos do WhatsApp (tabela wa_events) em números.
// Função pura, sem acesso a banco: recebe as linhas e devolve o resumo. Não há telefone aqui, só o hash de cada pessoa.

export interface EventRow {
  person: string;
  event: string;
  note: string | null;
  created_at: string;
}

export interface AdminStats {
  generatedAt: string;
  totals: { people: number; messages: number; activeToday: number; active7d: number; active30d: number };
  daily: { day: string; newPeople: number; activePeople: number; messages: number }[];
  usage: {
    avgActiveDays: number;
    avgSpanDays: number;
    returned: number; // pessoas que voltaram em outro dia
    returnedPct: number;
    buckets: { label: string; people: number }[];
  };
  funnel: { key: string; label: string; people: number }[];
  tools: { tool: string; people: number; times: number }[];
  feedback: { up: number; down: number; asked: number; answeredAsk: number; recent: { at: string; kind: 'up' | 'down'; tool: string; note: string | null }[] };
}

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Dia (AAAA-MM-DD) no horário de Brasília. */
export const dayKey = (iso: string | number): string => new Date(new Date(iso).getTime() - BRT_OFFSET_MS).toISOString().slice(0, 10);

const FUNNEL: [string, string][] = [
  ['greeting', 'Disse oi'],
  ['quick_start', 'Começou o começo rápido'],
  ['quick_done', 'Terminou o começo rápido'],
  ['diag_start', 'Começou o diagnóstico'],
  ['diag_done', 'Terminou o diagnóstico'],
  ['plan_follow', 'Passou a seguir o plano'],
];

const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildStats(rows: EventRow[], now = Date.now(), days = 14): AdminStats {
  interface Person {
    first: number;
    last: number;
    days: Set<string>;
  }
  const people = new Map<string, Person>();
  const perDay = new Map<string, { active: Set<string>; messages: number }>();
  const funnel = new Map<string, Set<string>>();
  const tools = new Map<string, { people: Set<string>; times: number }>();
  const feedback: AdminStats['feedback'] = { up: 0, down: 0, asked: 0, answeredAsk: 0, recent: [] };
  const answeredGeral = new Set<string>();
  let messages = 0;

  for (const r of rows) {
    const t = new Date(r.created_at).getTime();
    const day = dayKey(t);
    const p = people.get(r.person) ?? { first: t, last: t, days: new Set<string>() };
    p.first = Math.min(p.first, t);
    p.last = Math.max(p.last, t);
    p.days.add(day);
    people.set(r.person, p);

    const d = perDay.get(day) ?? { active: new Set<string>(), messages: 0 };
    d.active.add(r.person);
    if (r.event === 'msg') {
      d.messages++;
      messages++;
    }
    perDay.set(day, d);

    if (!funnel.has(r.event)) funnel.set(r.event, new Set());
    funnel.get(r.event)!.add(r.person);

    if (r.event.startsWith('tool:')) {
      const name = r.event.slice(5);
      const tl = tools.get(name) ?? { people: new Set<string>(), times: 0 };
      tl.people.add(r.person);
      tl.times++;
      tools.set(name, tl);
    }

    if (r.event === 'fb_ask') feedback.asked++;
    const fb = /^feedback:(up|down):(.+)$/.exec(r.event);
    if (fb) {
      feedback[fb[1] as 'up' | 'down']++;
      if (fb[2] === 'geral') answeredGeral.add(r.person);
      feedback.recent.push({ at: r.created_at, kind: fb[1] as 'up' | 'down', tool: fb[2], note: r.note });
    }
  }
  feedback.answeredAsk = answeredGeral.size;
  feedback.recent = feedback.recent.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);

  const list = [...people.values()];
  const activeSince = (ms: number) => list.filter((p) => p.last >= now - ms).length;
  const today = dayKey(now);

  const dailyRows: AdminStats['daily'] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayKey(now - i * DAY_MS);
    const d = perDay.get(day);
    dailyRows.push({
      day,
      newPeople: list.filter((p) => dayKey(p.first) === day).length,
      activePeople: d?.active.size ?? 0,
      messages: d?.messages ?? 0,
    });
  }

  const returned = list.filter((p) => p.days.size > 1).length;
  const bucket = (min: number, max: number) => list.filter((p) => p.days.size >= min && p.days.size <= max).length;

  return {
    generatedAt: new Date(now).toISOString(),
    totals: {
      people: list.length,
      messages,
      activeToday: list.filter((p) => p.days.has(today)).length,
      active7d: activeSince(7 * DAY_MS),
      active30d: activeSince(30 * DAY_MS),
    },
    daily: dailyRows,
    usage: {
      avgActiveDays: list.length ? round1(list.reduce((s, p) => s + p.days.size, 0) / list.length) : 0,
      avgSpanDays: list.length ? round1(list.reduce((s, p) => s + (p.last - p.first) / DAY_MS, 0) / list.length) : 0,
      returned,
      returnedPct: list.length ? Math.round((returned / list.length) * 100) : 0,
      buckets: [
        { label: '1 dia', people: bucket(1, 1) },
        { label: '2 a 3 dias', people: bucket(2, 3) },
        { label: '4 a 7 dias', people: bucket(4, 7) },
        { label: '8 dias ou mais', people: bucket(8, Infinity) },
      ],
    },
    funnel: FUNNEL.map(([key, label]) => ({ key, label, people: funnel.get(key)?.size ?? 0 })),
    tools: [...tools.entries()]
      .map(([tool, v]) => ({ tool, people: v.people.size, times: v.times }))
      .sort((a, b) => b.people - a.people || b.times - a.times),
    feedback,
  };
}
