// Tipagem mínima do process.env no runtime Node da Vercel (evita instalar @types/node só pra isso).
declare const process: { env: Record<string, string | undefined> };
