// Retrato de cada conselheiro: um busto em estilo babilônico, com a cidade ao fundo e o objeto da história dele.
// SVG feito à mão (leve, sem arquivo de imagem). "cover" é a cena do cartão; "avatar" recorta só o rosto.

type Hat = 'turban' | 'cap' | 'crown' | 'band';
type Beard = 'long' | 'short' | 'none';
type Prop = 'camel' | 'wheel' | 'coins' | 'lens' | 'scale' | 'spear' | 'sprout';

interface Look {
  skin: string;
  hair: string;
  beard: Beard;
  hat: Hat;
  hatColor: string;
  robe: string;
  prop: Prop;
}

const LOOKS: Record<string, Look> = {
  dabasir: { skin: '#B07A52', hair: '#2B1D14', beard: 'short', hat: 'turban', hatColor: '#E9E2D0', robe: '#6B3A2A', prop: 'camel' },
  bansir: { skin: '#C8956B', hair: '#4A3426', beard: 'short', hat: 'band', hatColor: '#8C5A2B', robe: '#4E5B3A', prop: 'wheel' },
  arkad: { skin: '#C8956B', hair: '#E4DED3', beard: 'long', hat: 'crown', hatColor: '#D3962F', robe: '#5B2A6E', prop: 'coins' },
  nomasir: { skin: '#D9A77E', hair: '#2B1D14', beard: 'none', hat: 'band', hatColor: '#2E5E8C', robe: '#23384F', prop: 'lens' },
  mathon: { skin: '#9C6A45', hair: '#CFC7BA', beard: 'long', hat: 'cap', hatColor: '#3B2F5E', robe: '#2D2440', prop: 'scale' },
  rodan: { skin: '#B07A52', hair: '#3A2A1E', beard: 'short', hat: 'band', hatColor: '#7A2E22', robe: '#3E4A2A', prop: 'spear' },
  sharru: { skin: '#C8956B', hair: '#2B1D14', beard: 'long', hat: 'turban', hatColor: '#1F6F64', robe: '#1C4A44', prop: 'sprout' },
};

const INK = '#2A1A10';
const PROP = 'rgba(255, 238, 205, 0.92)';

function HatShape({ hat, color, hair }: { hat: Hat; color: string; hair: string }) {
  if (hat === 'turban')
    return (
      <g>
        <path d="M81 57 C76 34 124 34 119 57 C113 51 87 51 81 57 Z" fill={color} />
        <path d="M84 50 C92 44 108 44 116 50" stroke="rgba(0,0,0,0.18)" strokeWidth="2" fill="none" />
        <circle cx="100" cy="46" r="3" fill="#D3962F" />
      </g>
    );
  if (hat === 'cap')
    return (
      <g>
        <path d="M83 55 L86 33 L114 33 L117 55 Z" fill={color} />
        <rect x="83" y="49" width="34" height="5" fill="#D3962F" opacity="0.85" />
      </g>
    );
  if (hat === 'crown')
    return (
      <g>
        <path d="M82 55 L84 29 L116 29 L118 55 Z" fill={color} />
        <path d="M83.5 36 H116.5 M83 43 H117 M82.5 50 H117.5" stroke="#8A5A14" strokeWidth="2" />
        <circle cx="100" cy="32" r="2.4" fill="#F3EEE5" />
      </g>
    );
  return (
    <g>
      <path d="M83 62 C81 40 119 40 117 62 C112 53 88 53 83 62 Z" fill={hair} />
      <rect x="82" y="51" width="36" height="5" rx="2" fill={color} />
    </g>
  );
}

function BeardShape({ beard, hair }: { beard: Beard; hair: string }) {
  if (beard === 'long')
    return (
      <g>
        <path d="M83 66 C83 90 92 101 100 103 C108 101 117 90 117 66 C112 76 106 79 100 79 C94 79 88 76 83 66 Z" fill={hair} />
        <path d="M94 84 V96 M100 85 V100 M106 84 V96" stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" />
      </g>
    );
  if (beard === 'short')
    return <path d="M84 68 C86 83 94 88 100 88 C106 88 114 83 116 68 C111 76 106 78 100 78 C94 78 89 76 84 68 Z" fill={hair} />;
  return <path d="M95 75 Q100 78 105 75" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" />;
}

function PropShape({ prop }: { prop: Prop }) {
  switch (prop) {
    case 'camel':
      return (
        <g transform="translate(146 82)" fill={PROP} stroke={PROP} strokeLinecap="round">
          <path d="M0 22 C0 10 8 5 14 11 C18 1 26 1 30 11 C34 13 35 20 33 23 L0 23 Z" stroke="none" />
          <path d="M30 15 L38 1 L45 1 L45 5 L41 5 L35 19 Z" stroke="none" />
          <path d="M4 22 V36 M10 22 V36 M24 22 V36 M30 22 V36" strokeWidth="2.6" fill="none" />
        </g>
      );
    case 'wheel':
      return (
        <g transform="translate(166 102)" stroke={PROP} fill="none" strokeWidth="3">
          <circle r="17" />
          <circle r="3.5" fill={PROP} />
          {[0, 30, 60, 90, 120, 150].map((a) => (
            <line key={a} x1={-17 * Math.cos((a * Math.PI) / 180)} y1={-17 * Math.sin((a * Math.PI) / 180)} x2={17 * Math.cos((a * Math.PI) / 180)} y2={17 * Math.sin((a * Math.PI) / 180)} strokeWidth="2" />
          ))}
        </g>
      );
    case 'coins':
      return (
        <g fill="#E9B04C" stroke="#8A5A14" strokeWidth="1.2">
          {[0, 1, 2, 3].map((i) => (
            <ellipse key={`a${i}`} cx="158" cy={118 - i * 6} rx="12" ry="4.5" />
          ))}
          {[0, 1].map((i) => (
            <ellipse key={`b${i}`} cx="180" cy={120 - i * 6} rx="12" ry="4.5" />
          ))}
          <circle cx="172" cy="84" r="8" />
          <circle cx="172" cy="84" r="4" fill="none" />
        </g>
      );
    case 'lens':
      return (
        <g transform="translate(164 94)" stroke={PROP} strokeWidth="3.4" fill="rgba(255,238,205,0.12)" strokeLinecap="round">
          <circle r="13" />
          <line x1="9.5" y1="9.5" x2="22" y2="22" strokeWidth="5" />
          <circle cx="0" cy="0" r="3" fill="#E9B04C" stroke="none" />
        </g>
      );
    case 'scale':
      return (
        <g transform="translate(168 76)" stroke={PROP} strokeWidth="2.4" fill="none" strokeLinecap="round">
          <line x1="0" y1="0" x2="0" y2="44" />
          <line x1="-12" y1="44" x2="12" y2="44" strokeWidth="3.4" />
          <line x1="-20" y1="6" x2="20" y2="6" />
          <path d="M-20 6 L-27 22 M-20 6 L-13 22 M20 6 L13 22 M20 6 L27 22" strokeWidth="1.4" />
          <path d="M-28 22 Q-20 30 -12 22 Z M12 22 Q20 30 28 22 Z" fill={PROP} />
          <circle cx="0" cy="0" r="2.5" fill={PROP} />
        </g>
      );
    case 'spear':
      return (
        <g stroke={PROP} strokeLinecap="round">
          <line x1="152" y1="128" x2="182" y2="68" strokeWidth="3" />
          <path d="M182 68 L178 78 L187 76 Z M184 64 L190 52 L177 60 Z" fill={PROP} strokeWidth="1" />
        </g>
      );
    case 'sprout':
      return (
        <g>
          <ellipse cx="168" cy="120" rx="16" ry="5.5" fill="#E9B04C" stroke="#8A5A14" strokeWidth="1.2" />
          <ellipse cx="168" cy="114" rx="16" ry="5.5" fill="#E9B04C" stroke="#8A5A14" strokeWidth="1.2" />
          <path d="M168 110 C168 98 168 90 168 80" stroke="#7FCB8F" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M168 92 C156 92 152 84 152 78 C162 78 168 84 168 92 Z" fill="#7FCB8F" />
          <path d="M168 86 C180 86 186 78 186 70 C174 70 168 78 168 86 Z" fill="#9EDCAA" />
        </g>
      );
  }
}

export function AgentArt({ id, hue, variant = 'cover' }: { id: string; hue: number; variant?: 'cover' | 'avatar' }) {
  const look = LOOKS[id];
  if (!look) return null;
  const gid = `ag-${id}-${variant}`;
  const avatar = variant === 'avatar';
  return (
    <svg
      className={avatar ? 'agent-art avatar' : 'agent-art'}
      viewBox={avatar ? '62 24 76 76' : '0 0 200 130'}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`Retrato de ${id}`}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor={`hsl(${hue} 55% 42%)`} />
          <stop offset="1" stopColor={`hsl(${(hue + 30) % 360} 40% 14%)`} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="200" height="130" fill={`url(#${gid})`} />
      {!avatar && (
        <g>
          <circle cx="40" cy="30" r="14" fill="rgba(255, 220, 150, 0.28)" />
          <path d="M6 130 V110 H18 V98 H30 V86 H42 V74 H54 V86 H66 V98 H78 V110 H90 V130 Z" fill="rgba(0, 0, 0, 0.22)" />
          <path d="M0 123 Q100 114 200 123 V130 H0 Z" fill="rgba(0, 0, 0, 0.25)" />
          <g transform="translate(-14 0)">
            <PropShape prop={look.prop} />
          </g>
        </g>
      )}
      {/* busto */}
      <path d="M52 130 C56 101 74 93 100 93 C126 93 144 101 148 130 Z" fill={look.robe} />
      <path d="M87 94 L100 114 L113 94" stroke="#D3962F" strokeWidth="2.4" fill="none" />
      <rect x="93" y="78" width="14" height="16" fill={look.skin} />
      <rect x="93" y="78" width="14" height="16" fill="rgba(0,0,0,0.15)" />
      <ellipse cx="100" cy="64" rx="17" ry="19" fill={look.skin} />
      <ellipse cx="82.5" cy="66" rx="2.6" ry="4" fill={look.skin} />
      <ellipse cx="117.5" cy="66" rx="2.6" ry="4" fill={look.skin} />
      <BeardShape beard={look.beard} hair={look.hair} />
      <path d="M90 58 H97 M103 58 H110" stroke={look.hair === '#E4DED3' || look.hair === '#CFC7BA' ? '#9C948A' : look.hair} strokeWidth="2" strokeLinecap="round" />
      <circle cx="94" cy="63" r="1.7" fill={INK} />
      <circle cx="106" cy="63" r="1.7" fill={INK} />
      <path d="M100 64 L98 71 L101 71" stroke="rgba(0,0,0,0.25)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <HatShape hat={look.hat} color={look.hatColor} hair={look.hair} />
    </svg>
  );
}

export const hasAgentArt = (id: string) => id in LOOKS;
