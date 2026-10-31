import { Fragment, type ReactNode } from 'react';
import { isTeamEmblem, type TeamEmblemKey } from '@odi/shared';

/**
 * ODİ resimli ikon seti (kabuk). Oyun içi boyamayla aynı dil: üstten ışık alan degrade, sıcak koyu kontur,
 * alt-sağa düşen yumuşak gölge, sol üstte beyaz parlama. Altın jeton = oyundaki jetonun aynısı (ses dalgası amblemi),
 * nota ve koklea da oyundaki altın nota / koklea çizimlerinin karşılığı. 24×24 ızgara.
 * Degradeler bir kez <ArtDefs/> içinde tanımlanır (App kökünde), her ikon bunlara başvurur.
 * Emoji yalnızca kullanıcı içeriğinde kalır; arayüzde emoji yerine <Art> ya da metin içinde <Rich> kullanılır.
 */
export type ArtName =
  | 'coin' | 'crystal' | 'shield' | 'flame' | 'chest' | 'gift' | 'medal1' | 'medal2' | 'medal3' | 'medal' | 'trophy' | 'star' | 'xp'
  | 'note' | 'shell' | 'heart' | 'bolt' | 'target' | 'flag' | 'finish' | 'swords' | 'monster' | 'hourglass' | 'timer' | 'calendar'
  | 'check' | 'cross' | 'lock' | 'unlock' | 'crown' | 'hat' | 'palette' | 'card' | 'clover' | 'booster' | 'ticket' | 'help' | 'users'
  | 'ear' | 'map' | 'compass' | 'hammer' | 'tent' | 'bigtop' | 'mail' | 'chat' | 'megaphone' | 'signal' | 'bulb' | 'flask' | 'search'
  | 'party' | 'baton' | 'door' | 'sprout' | 'wave' | 'spark' | 'bell' | 'sound' | 'mute' | 'up' | 'down' | 'question' | 'key' | 'link'
  | 'sun' | 'moon' | 'pencil' | 'trash' | 'copy' | 'gear' | 'refresh' | 'plus' | 'play' | 'heal' | 'boom' | 'wind' | 'online' | 'tag' | 'empty'
  /** YN-041: Kurucu Yolcu rozeti (defne halkasında altın yol yıldızı), Hata Avcısı unvanı (büyüteçte böcek) */
  | 'founder' | 'bughunt'
  /** YN-044: Kulak Kartları (diyapazon, davul, cetvel, uçak, beyin, timpanogram/odyogram) ve takım amblemleri (kulaklık, baykuş, yunus, işitme cihazı) */
  | 'fork' | 'drum' | 'ruler' | 'plane' | 'brain' | 'chart' | 'headphones' | 'owl' | 'dolphin' | 'hearingaid';

const SH = 'rgba(14,6,40,.38)';
/** gölge + dolgu + kontur (aynı yol) */
function S({ d, g, o, w = 1.25 }: { d: string; g: string; o: string; w?: number }) {
  return <><path d={d} fill={SH} transform="translate(.5 1.2)" /><path d={d} fill={`url(#oa-${g})`} stroke={o} strokeWidth={w} strokeLinejoin="round" /></>;
}
function C({ cx, cy, r, g, o, w = 1.25 }: { cx: number; cy: number; r: number; g: string; o: string; w?: number }) {
  return <><circle cx={cx + 0.5} cy={cy + 1.2} r={r} fill={SH} /><circle cx={cx} cy={cy} r={r} fill={`url(#oa-${g})`} stroke={o} strokeWidth={w} /></>;
}
const gloss = (cx: number, cy: number, rx = 2.4, ry = 1.2, rot = -30, op = 0.85) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${rot} ${cx} ${cy})`} fill="#fff" opacity={op} />;
const line = (d: string, color: string, w = 1.6) => <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;

const STAR = 'M12 2.6l2.75 5.6 6.15.9-4.45 4.33 1.05 6.12L12 16.65 6.5 19.55l1.05-6.12L3.1 9.1l6.15-.9z';
const medal = (g: string, o: string, ink: string) => <>
  <path d="M7.6 2.4h3.5l2.2 7H9.8z" fill="url(#oa-coral)" stroke="#8f1740" strokeWidth="1" strokeLinejoin="round" />
  <path d="M16.4 2.4h-3.5l-2.2 7h3.5z" fill="url(#oa-violet)" stroke="#2d1a85" strokeWidth="1" strokeLinejoin="round" />
  <C cx={12} cy={15} r={6.4} g={g} o={o} />
  <circle cx="12" cy="15" r="4.3" fill="none" stroke={ink} strokeOpacity=".45" strokeWidth=".9" />
  <path d="M12 11.9l.95 1.95 2.15.31-1.55 1.51.37 2.13L12 16.79l-1.92 1.01.37-2.13-1.55-1.51 2.15-.31z" fill={ink} fillOpacity=".55" />
  {gloss(9.6, 12.3, 1.7, 0.9)}
</>;

const ART: Record<ArtName, ReactNode> = {
  coin: <>
    <circle cx="12.4" cy="13.4" r="9" fill="#9a4f00" />
    <C cx={12} cy={12} r={9} g="gold" o="#a35a00" w={1.3} />
    <circle cx="12" cy="12" r="6.5" fill="none" stroke="#a35a00" strokeOpacity=".55" strokeWidth="1" />
    <circle cx="9.7" cy="12" r="1.25" fill="#b86a00" />
    {line('M11.9 9.95a3 3 0 0 1 0 4.1M13.5 8.4a5.2 5.2 0 0 1 0 7.2', '#b86a00', 1.35)}
    {gloss(8.6, 7.4, 2.6, 1.25)}
  </>,
  crystal: <>
    <S d="M7 4h10l4.4 5.4L12 20.8 2.6 9.4z" g="gem" o="#2b1a7a" />
    {line('M2.6 9.4h18.8M7 4l2.4 5.4L12 20.8l2.6-11.4L17 4', '#fff', 0.8)}
    <path d="M7.6 5.1h3.1L9.4 8.5H5.4z" fill="#fff" opacity=".75" />
  </>,
  shield: <>
    <S d="M12 2.6l7.8 2.9v5.7c0 4.9-3.3 8.6-7.8 10.4-4.5-1.8-7.8-5.5-7.8-10.4V5.5z" g="teal" o="#0b5f5a" />
    <path d="M12 5.4l5.2 1.9v3.9c0 3.3-2.1 5.9-5.2 7.3-3.1-1.4-5.2-4-5.2-7.3V7.3z" fill="url(#oa-gold)" stroke="#a35a00" strokeWidth=".9" opacity=".95" />
    {line('M9.6 11.6l1.7 1.8 3.2-3.6', '#7a4300', 1.5)}
    {gloss(8.4, 6.4, 1.9, 0.9)}
  </>,
  flame: <>
    <S d="M12 2.4c1 3.3 6 5.6 6 11.2a6 6 0 0 1-12 0c0-2.8 1.4-4.6 2.7-5.8.2 1.9 1 3 2.1 3.5-.3-3.3.6-6.3 1.2-8.9z" g="flame" o="#a32a00" />
    <path d="M12 11.2c1.7 1.9 3.1 3.3 3.1 5.3a3.1 3.1 0 0 1-6.2 0c0-1.7 1.3-3.1 3.1-5.3z" fill="#fff6c4" opacity=".95" />
  </>,
  chest: <>
    <S d="M3.4 11h17.2v7.6a1.6 1.6 0 0 1-1.6 1.6H5a1.6 1.6 0 0 1-1.6-1.6z" g="violet" o="#2d1a85" />
    <S d="M3.4 11V8.6A4.6 4.6 0 0 1 8 4h8a4.6 4.6 0 0 1 4.6 4.6V11z" g="violet" o="#2d1a85" />
    <path d="M6 4.6v15.6M18 4.6v15.6" stroke="url(#oa-gold)" strokeWidth="2.1" />
    <path d="M3.4 11h17.2" stroke="#ffc93c" strokeWidth="1.3" />
    <rect x="10.2" y="9" width="3.6" height="4.6" rx=".9" fill="url(#oa-gold)" stroke="#a35a00" strokeWidth=".9" />
    <circle cx="12" cy="11" r=".7" fill="#7a4300" />
    {gloss(8, 6.4, 2.2, 0.9, -12, 0.55)}
  </>,
  gift: <>
    <S d="M4.4 11h15.2v8.2a1.4 1.4 0 0 1-1.4 1.4H5.8a1.4 1.4 0 0 1-1.4-1.4z" g="coral" o="#8f1740" />
    <S d="M3.2 8.2a1 1 0 0 1 1-1h15.6a1 1 0 0 1 1 1V11a.6.6 0 0 1-.6.6H3.8a.6.6 0 0 1-.6-.6z" g="coral" o="#8f1740" />
    <path d="M12 7.3v13.2" stroke="url(#oa-gold)" strokeWidth="2.6" />
    <path d="M12 7.3c-1.5-3.4-5.6-4-5.8-1.7-.2 1.9 3.3 1.9 5.8 1.7zM12 7.3c1.5-3.4 5.6-4 5.8-1.7.2 1.9-3.3 1.9-5.8 1.7z" fill="url(#oa-gold)" stroke="#a35a00" strokeWidth=".9" strokeLinejoin="round" />
    {gloss(7, 8.6, 1.8, 0.7, -8, 0.7)}
  </>,
  medal1: medal('gold', '#a35a00', '#8a4500'),
  medal2: medal('silver', '#4f5875', '#4f5875'),
  medal3: medal('bronze', '#6b3815', '#6b3815'),
  medal: medal('gold', '#a35a00', '#8a4500'),
  trophy: <>
    {line('M7 6.2H4.4v1.4a3.6 3.6 0 0 0 3.4 3.6M17 6.2h2.6v1.4a3.6 3.6 0 0 1-3.4 3.6', '#c47a00', 1.6)}
    <S d="M7 3.8h10v5.6a5 5 0 0 1-10 0z" g="gold" o="#a35a00" />
    <path d="M11 14.2h2v3h-2z" fill="url(#oa-gold-deep)" />
    <S d="M7.6 17.2h8.8a1 1 0 0 1 1 1v2.2H6.6v-2.2a1 1 0 0 1 1-1z" g="violet" o="#2d1a85" />
    <path d="M12 6.1l.7 1.4 1.6.25-1.15 1.1.27 1.6L12 9.7l-1.42.75.27-1.6-1.15-1.1 1.6-.25z" fill="#fff6c4" />
    {gloss(9, 5.6, 1.4, 0.8)}
  </>,
  star: <><S d={STAR} g="gold" o="#a35a00" />{gloss(9.4, 8.6, 1.7, 0.85)}</>,
  xp: <>
    <S d="M10 2.6c.6 3.8 2.5 5.7 6.3 6.3-3.8.6-5.7 2.5-6.3 6.3-.6-3.8-2.5-5.7-6.3-6.3 3.8-.6 5.7-2.5 6.3-6.3z" g="violet" o="#2d1a85" w={1.1} />
    <S d="M17.6 13.2c.35 2.1 1.4 3.2 3.5 3.5-2.1.35-3.15 1.4-3.5 3.5-.35-2.1-1.4-3.15-3.5-3.5 2.1-.35 3.15-1.4 3.5-3.5z" g="gold" o="#a35a00" w={1} />
    <circle cx="8.6" cy="7.6" r="1" fill="#fff" opacity=".9" />
  </>,
  note: <>
    <S d="M11.4 4.2c0-.6.5-.9 1-.7 2.6 1 5.9 2.3 6.2 5.6.1.6-.6.9-1 .4-1-1.2-2.4-1.9-4-2.1v9.5a3.9 3.1 -20 1 1-2.2-2.8z" g="gold" o="#8a4500" />
    {gloss(7.4, 15.4, 1.3, 0.75, -40)}
  </>,
  shell: <>
    <C cx={12} cy={12} r={8.8} g="gold" o="#8a4500" />
    {line('M12.6 12.4a1.5 1.5 0 1 1-1.9-1.8 3.1 3.1 0 1 1-.4 6.1 4.7 4.7 0 1 1 6.2-6.3 6.3 6.3 0 0 1-.5 6.6', '#8a4500', 1.5)}
    {line('M12.2 12a1.5 1.5 0 1 1-1.9-1.8 3.1 3.1 0 1 1-.4 6.1 4.7 4.7 0 1 1 6.2-6.3', '#fffbe0', 0.6)}
    {gloss(7.8, 7, 1.8, 0.9, -40)}
  </>,
  heart: <><S d="M12 20.4S3.4 15.2 3.4 9.3A4.5 4.5 0 0 1 12 7.1a4.5 4.5 0 0 1 8.6 2.2C20.6 15.2 12 20.4 12 20.4z" g="coral" o="#8f1740" />{gloss(7.4, 8.4, 1.8, 1)}</>,
  bolt: <><S d="M13.6 2.4 4.8 13.8h6.4l-1.5 7.8 9.5-12h-6.6z" g="gold" o="#a35a00" />{gloss(11.2, 6.6, 1.2, 0.6, -50)}</>,
  target: <>
    <C cx={12} cy={12} r={9} g="coral" o="#8f1740" />
    <circle cx="12" cy="12" r="6.1" fill="url(#oa-cream)" />
    <circle cx="12" cy="12" r="3.4" fill="url(#oa-coral)" />
    <circle cx="12" cy="12" r="1.1" fill="#fff6e5" />
    {gloss(7.6, 6.9, 1.9, 0.9)}
  </>,
  flag: <>
    <rect x="4.4" y="2.6" width="2.1" height="18.8" rx="1.05" fill="url(#oa-silver)" stroke="#4f5875" strokeWidth=".6" />
    <S d="M6.6 4.4c3-1.3 5.5 1.3 8.6 0 1.3-.5 2.4-.6 3.5-.3v8.6c-1.1-.3-2.2-.2-3.5.3-3.1 1.3-5.6-1.3-8.6 0z" g="coral" o="#8f1740" />
    {gloss(9, 6, 1.6, 0.6, -6, 0.6)}
  </>,
  finish: <>
    <rect x="4.4" y="2.6" width="2.1" height="18.8" rx="1.05" fill="url(#oa-silver)" stroke="#4f5875" strokeWidth=".6" />
    <S d="M6.6 4.4c3-1.3 5.5 1.3 8.6 0 1.3-.5 2.4-.6 3.5-.3v8.6c-1.1-.3-2.2-.2-3.5.3-3.1 1.3-5.6-1.3-8.6 0z" g="cream" o="#2d1a85" />
    <path d="M6.6 4.4c1.4-.6 2.6-.3 3.8.2v4.3c-1.2-.5-2.4-.8-3.8-.2zM10.4 8.9c1.4.5 2.8.9 4.8.3v4.3c-2 .6-3.4.2-4.8-.3zM15.2 4.4c1.3-.5 2.4-.6 3.5-.3v4.3c-1.1-.3-2.2-.2-3.5.3z" fill="#3a2788" />
  </>,
  swords: <>
    {line('M5.2 4.2l10 10', 'url(#oa-silver)', 2.8)}{line('M18.8 4.2l-10 10', 'url(#oa-silver)', 2.8)}
    {line('M5.6 4.6l9.2 9.2M18.4 4.6l-9.2 9.2', '#fff', 0.7)}
    {line('M12.6 17.6l4.6-4.6M6.8 13l4.6 4.6', '#ffc93c', 2.2)}
    {line('M16.6 16.6l2.6 2.6M7.4 16.6l-2.6 2.6', '#ff5c8a', 2.6)}
  </>,
  monster: <>
    <path d="M6.6 7.4 4.6 2.8l4.4 2.6zM17.4 7.4l2-4.6-4.4 2.6z" fill="url(#oa-gold)" stroke="#a35a00" strokeWidth=".9" strokeLinejoin="round" />
    <S d="M12 4.6c4.9 0 8.2 3.5 8.2 8.4 0 4.1-2.8 7.5-8.2 7.5s-8.2-3.4-8.2-7.5c0-4.9 3.3-8.4 8.2-8.4z" g="coral" o="#8f1740" />
    <circle cx="9" cy="11.4" r="2.1" fill="#fff" /><circle cx="15" cy="11.4" r="2.1" fill="#fff" />
    <circle cx="9.4" cy="11.8" r="1" fill="#22153f" /><circle cx="14.6" cy="11.8" r="1" fill="#22153f" />
    {line('M6.8 8.6l3.6 1.2M17.2 8.6l-3.6 1.2', '#5a0f2c', 1.3)}
    <path d="M8.4 15.4h7.2a3.6 2.6 0 0 1-7.2 0z" fill="#3b0b20" /><path d="M9.6 15.4l.7 1.2.7-1.2M13 15.4l.7 1.2.7-1.2" fill="#fff" />
  </>,
  hourglass: <>
    <S d="M7.6 4.6h8.8c0 4.2-3.2 5.6-3.2 7.4s3.2 3.2 3.2 7.4H7.6c0-4.2 3.2-5.6 3.2-7.4S7.6 8.8 7.6 4.6z" g="cream" o="#b98a3e" w={1} />
    <path d="M9.4 7.6h5.2c-.6 1.8-2.6 2.6-2.6 4.4 0-1.8-2-2.6-2.6-4.4zM8.8 18.6c.4-2.4 3.2-3.2 3.2-4.4 0 1.2 2.8 2 3.2 4.4z" fill="url(#oa-gold)" />
    <rect x="5.6" y="2.6" width="12.8" height="2.4" rx="1.1" fill="url(#oa-violet)" stroke="#2d1a85" strokeWidth=".9" />
    <rect x="5.6" y="19" width="12.8" height="2.4" rx="1.1" fill="url(#oa-violet)" stroke="#2d1a85" strokeWidth=".9" />
  </>,
  timer: <>
    <rect x="10.4" y="1.8" width="3.2" height="2.6" rx=".8" fill="url(#oa-gold)" stroke="#a35a00" strokeWidth=".8" />
    <path d="M17.6 5.2l1.6 1.6" stroke="#a35a00" strokeWidth="1.8" strokeLinecap="round" />
    <C cx={12} cy={13.2} r={8.2} g="violet" o="#2d1a85" />
    <circle cx="12" cy="13.2" r="6.1" fill="url(#oa-cream)" />
    {line('M12 13.2V9.3M12 13.2l2.6 1.6', '#22153f', 1.5)}
    <circle cx="12" cy="13.2" r=".9" fill="#ff5c8a" />
  </>,
  calendar: <>
    <S d="M4.4 6.4a1.8 1.8 0 0 1 1.8-1.8h11.6a1.8 1.8 0 0 1 1.8 1.8v12.2a1.8 1.8 0 0 1-1.8 1.8H6.2a1.8 1.8 0 0 1-1.8-1.8z" g="cream" o="#b98a3e" w={1} />
    <path d="M4.4 6.4a1.8 1.8 0 0 1 1.8-1.8h11.6a1.8 1.8 0 0 1 1.8 1.8V9.4H4.4z" fill="url(#oa-coral)" />
    <path d="M8.4 3v3M15.6 3v3" stroke="#3a2788" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M7.6 12.4h1.8M11.1 12.4h1.8M14.6 12.4h1.8M7.6 15.8h1.8M11.1 15.8h1.8" stroke="#8b6bff" strokeWidth="1.6" strokeLinecap="round" />
    <rect x="14.2" y="14.6" width="2.6" height="2.4" rx=".6" fill="url(#oa-gold)" />
  </>,
  check: <><C cx={12} cy={12} r={9} g="green" o="#11663a" />{line('M7.6 12.4l3 3 5.8-6.4', '#fff', 2.4)}{gloss(8, 7.2, 1.8, 0.9)}</>,
  cross: <><C cx={12} cy={12} r={9} g="coral" o="#8f1740" />{line('M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8', '#fff', 2.4)}</>,
  lock: <>
    {line('M8 11V8a4 4 0 0 1 8 0v3', 'url(#oa-silver)', 2.4)}
    <S d="M5.6 11.2a1.4 1.4 0 0 1 1.4-1.4h10a1.4 1.4 0 0 1 1.4 1.4v7.4a1.8 1.8 0 0 1-1.8 1.8H7.4a1.8 1.8 0 0 1-1.8-1.8z" g="gold" o="#a35a00" />
    <path d="M12 13.2a1.4 1.4 0 0 1 .7 2.6v1.6h-1.4v-1.6a1.4 1.4 0 0 1 .7-2.6z" fill="#7a4300" />
  </>,
  unlock: <>
    {line('M8 10V8a4 4 0 0 1 7.6-1.8', 'url(#oa-silver)', 2.4)}
    <S d="M5.6 11.2a1.4 1.4 0 0 1 1.4-1.4h10a1.4 1.4 0 0 1 1.4 1.4v7.4a1.8 1.8 0 0 1-1.8 1.8H7.4a1.8 1.8 0 0 1-1.8-1.8z" g="teal" o="#0b5f5a" />
    <path d="M12 13.2a1.4 1.4 0 0 1 .7 2.6v1.6h-1.4v-1.6a1.4 1.4 0 0 1 .7-2.6z" fill="#064a45" />
  </>,
  crown: <>
    <S d="M3.6 8l4.2 3.6L12 5l4.2 6.6L20.4 8l-1.6 10.4H5.2z" g="gold" o="#a35a00" />
    <path d="M5.4 16.4h13.2" stroke="#a35a00" strokeOpacity=".5" strokeWidth="1" />
    <circle cx="12" cy="13.6" r="1.5" fill="url(#oa-coral)" /><circle cx="8" cy="14.4" r="1" fill="url(#oa-teal)" /><circle cx="16" cy="14.4" r="1" fill="url(#oa-teal)" />
    <circle cx="3.6" cy="8" r="1.2" fill="#ffc93c" /><circle cx="12" cy="5" r="1.2" fill="#ffc93c" /><circle cx="20.4" cy="8" r="1.2" fill="#ffc93c" />
  </>,
  hat: <>
    <S d="M7.6 5.4c0-.8.6-1.4 1.4-1.4h6c.8 0 1.4.6 1.4 1.4V15H7.6z" g="violet" o="#2d1a85" />
    <path d="M7.6 11h8.8v2.4H7.6z" fill="url(#oa-gold)" />
    <S d="M3.2 16.6c0-1.3 3.9-2.3 8.8-2.3s8.8 1 8.8 2.3-3.9 2.5-8.8 2.5-8.8-1.2-8.8-2.5z" g="violet" o="#2d1a85" />
    {gloss(9.6, 6.8, 0.9, 1.6, 0, 0.55)}
  </>,
  palette: <>
    <S d="M12 3.4c5 0 8.8 3.4 8.8 7.6 0 2.6-2 3.6-3.8 3.4-1.4-.1-2.2.9-1.6 2.2.7 1.6-.5 3.2-3.4 3.2-5 0-8.8-3.6-8.8-8.2S7 3.4 12 3.4z" g="cream" o="#b98a3e" />
    <circle cx="8" cy="10" r="1.6" fill="#ff5c8a" /><circle cx="11.6" cy="7.2" r="1.6" fill="#ffc93c" /><circle cx="15.6" cy="8.4" r="1.6" fill="#2ee6d6" /><circle cx="8.6" cy="14.4" r="1.6" fill="#8b6bff" />
  </>,
  card: <>
    <g transform="rotate(-12 9 13)"><S d="M4.2 6.6a1.6 1.6 0 0 1 1.6-1.6h6.4a1.6 1.6 0 0 1 1.6 1.6v10.8a1.6 1.6 0 0 1-1.6 1.6H5.8a1.6 1.6 0 0 1-1.6-1.6z" g="violet" o="#2d1a85" w={1} /></g>
    <g transform="rotate(8 15 12)"><S d="M10 5.4A1.6 1.6 0 0 1 11.6 3.8h6.8A1.6 1.6 0 0 1 20 5.4v11.2a1.6 1.6 0 0 1-1.6 1.6h-6.8a1.6 1.6 0 0 1-1.6-1.6z" g="cream" o="#b98a3e" w={1} />
      <path d="M15 7.6l.9 1.8 2 .3-1.45 1.4.34 2L15 12.2l-1.8.94.34-2L12.1 9.7l2-.3z" fill="url(#oa-gold)" stroke="#a35a00" strokeWidth=".6" /></g>
  </>,
  clover: <>
    <path d="M12 13.4c.4 3 1.6 5.4 3.4 7" stroke="#11663a" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    {[0, 90, 180, 270].map((a) => <g key={a} transform={`rotate(${a} 12 11.6)`}><S d="M12 11.6C9.6 9.8 8.8 6.4 10.4 5.6c.8-.4 1.4.2 1.6.8.2-.6.8-1.2 1.6-.8 1.6.8.8 4.2-1.6 6z" g="green" o="#11663a" w={1} /></g>)}
  </>,
  booster: <>
    <C cx={12} cy={12} r={9} g="teal" o="#0b5f5a" />
    <path d="M7 8.2l5 3.8-5 3.8zM12 8.2l5 3.8-5 3.8z" fill="#fff" stroke="#0b5f5a" strokeWidth=".6" strokeLinejoin="round" />
    {gloss(8, 7, 1.8, 0.8)}
  </>,
  ticket: <>
    <S d="M3.4 7.6a1.4 1.4 0 0 1 1.4-1.4h14.4a1.4 1.4 0 0 1 1.4 1.4v2.2a2.2 2.2 0 0 0 0 4.4v2.2a1.4 1.4 0 0 1-1.4 1.4H4.8a1.4 1.4 0 0 1-1.4-1.4v-2.2a2.2 2.2 0 0 0 0-4.4z" g="gold" o="#a35a00" />
    <path d="M15.4 6.6v10.8" stroke="#a35a00" strokeDasharray="1.4 1.2" strokeWidth="1" />
    <path d="M9.4 9l.8 1.6 1.8.26-1.3 1.27.3 1.8-1.6-.84-1.6.84.3-1.8-1.3-1.27 1.8-.26z" fill="#fff6e5" />
  </>,
  help: <>
    <C cx={12} cy={12} r={9} g="teal" o="#0b5f5a" />
    <path d="M12 17.4s-4.6-2.8-4.6-6a2.4 2.4 0 0 1 4.6-1.2 2.4 2.4 0 0 1 4.6 1.2c0 3.2-4.6 6-4.6 6z" fill="url(#oa-coral)" stroke="#fff" strokeWidth="1.1" />
    {gloss(8, 7, 1.8, 0.8)}
  </>,
  users: <>
    <circle cx="16.4" cy="8.6" r="2.8" fill="url(#oa-teal)" stroke="#0b5f5a" strokeWidth="1" />
    <path d="M12.2 19.2c.4-3.4 2-5.2 4.2-5.2s3.8 1.8 4.2 5.2z" fill="url(#oa-teal)" stroke="#0b5f5a" strokeWidth="1" strokeLinejoin="round" />
    <C cx={9} cy={8} r={3.4} g="violet" o="#2d1a85" w={1.1} />
    <S d="M3.4 20c.4-4.2 2.6-6.4 5.6-6.4s5.2 2.2 5.6 6.4z" g="violet" o="#2d1a85" w={1.1} />
    {gloss(7.8, 6.6, 1.1, 0.6)}
  </>,
  ear: <>
    <S d="M15.2 3.3c-4.6-.5-8.6 2.7-8.9 7.2-.2 2.4.7 4.1 1.9 5.5.9 1.1 1.2 2 1.2 3.1 0 1.6 1.3 2.7 2.9 2.5 1.6-.2 2.4-1.4 2.7-2.9.4-1.7 1.3-2.6 2.6-3.8 1.4-1.3 2.4-3.1 2.4-5.5 0-3.4-2.2-5.7-4.8-6.1z" g="coral" o="#8f1740" />
    <path d="M12.9 16.2c-.6-1.2-1.9-1.8-1.9-3.6 0-2.4 1.6-4 3.6-4 1.8 0 3 1.2 3 2.8" fill="#c23663" opacity=".55" />
    {line('M9.6 11c-.1-2.9 2-5 4.7-5 2.4 0 4.1 1.7 4.1 3.9', '#8f1740', 1.3)}
    {line('M12.6 15.6c.2-1.5 1.5-2.2 1.8-3.4.2-1-.5-1.9-1.5-1.8', '#ffe3ea', 1.2)}
    {gloss(10.2, 6, 1.6, 0.8)}
  </>,
  map: <>
    <S d="M3.4 6.4 9 4.2l6 2.3 5.6-2.2v13.4L15 19.9l-6-2.3-5.6 2.2z" g="cream" o="#b98a3e" w={1.1} />
    <path d="M9 4.2v13.4M15 6.5v13.4" stroke="#b98a3e" strokeOpacity=".6" strokeWidth=".9" />
    <path d="M5.4 15.6c2-1.4 3.6-.4 5.2-2s2.6-3.6 5-3.4 2.4-1.4 2.8-2.4" fill="none" stroke="#ff5c8a" strokeWidth="1.4" strokeDasharray="1.6 1.4" strokeLinecap="round" />
    <circle cx="18.4" cy="7.8" r="1.4" fill="url(#oa-teal)" stroke="#0b5f5a" strokeWidth=".7" />
  </>,
  compass: <>
    <C cx={12} cy={12} r={9} g="violet" o="#2d1a85" />
    <circle cx="12" cy="12" r="6.6" fill="url(#oa-cream)" />
    <path d="M12 6.4l2 5.6h-4z" fill="#ff5c8a" /><path d="M12 17.6l-2-5.6h4z" fill="#2ee6d6" />
    <circle cx="12" cy="12" r="1" fill="#22153f" />
  </>,
  founder: <>
    <C cx={12} cy={12} r={9.4} g="violet" o="#2d1a85" />
    {line('M6.1 15.6a7 7 0 0 0 4.4 3.5M17.9 15.6a7 7 0 0 1-4.4 3.5', '#8ef0b0', 1.5)}
    <path d="M6.6 13.6l-1.3.6M7.6 16.1l-1.1 1M16.4 13.6l1.3.6M16.4 16.1l1.1 1" stroke="#8ef0b0" strokeWidth="1.2" strokeLinecap="round" />
    <S d="M12 3.6l1.9 5.4 5.4 1.9-5.4 1.9L12 18.2l-1.9-5.4-5.4-1.9 5.4-1.9z" g="gold" o="#a35a00" w={1.1} />
    <circle cx="12" cy="10.9" r="1.35" fill="#fff6e5" stroke="#a35a00" strokeWidth=".7" />
    {gloss(10.4, 7.6, 1.2, 0.6)}
  </>,
  bughunt: <>
    <path d="M15.6 15.6l4.8 4.8" stroke="url(#oa-gold)" strokeWidth="3.2" strokeLinecap="round" />
    <path d="M15.6 15.6l4.8 4.8" stroke="#a35a00" strokeWidth=".8" strokeLinecap="round" opacity=".6" />
    <C cx={10.4} cy={10.4} r={7} g="gold" o="#a35a00" />
    <circle cx="10.4" cy="10.4" r="5.2" fill="url(#oa-cream)" />
    <path d="M8.2 8.6l-1.3-1.1M12.6 8.6l1.3-1.1M7.6 10.8H6.2M13.2 10.8h1.4M8 12.9l-1.2 1M12.8 12.9l1.2 1" stroke="#22153f" strokeWidth=".9" strokeLinecap="round" />
    <ellipse cx="10.4" cy="11.2" rx="2.4" ry="3" fill="url(#oa-coral)" stroke="#8f1740" strokeWidth=".8" />
    <circle cx="10.4" cy="7.9" r="1.2" fill="#22153f" />
    <path d="M10.4 8.6v5.4" stroke="#8f1740" strokeWidth=".6" />
    {gloss(8.4, 6.6, 1.3, 0.6)}
  </>,
  hammer: <>
    <path d="M6.2 20.2l7.2-7.2" stroke="url(#oa-bronze)" strokeWidth="2.8" strokeLinecap="round" />
    <S d="M11.2 6.6l3-3a1.2 1.2 0 0 1 1.6 0l4.6 4.6a1.2 1.2 0 0 1 0 1.6l-1.4 1.4-2.4-2.4-2.4 2.4z" g="silver" o="#4f5875" />
    {gloss(14.6, 5.4, 1.3, 0.6, 45)}
  </>,
  tent: <>
    <S d="M12 3.6 2.8 19.6h18.4z" g="coral" o="#8f1740" />
    <path d="M12 9.8l-3.8 9.8h7.6z" fill="#3a1030" />
    <path d="M12 3.6 8.2 19.6" stroke="#ffd3df" strokeOpacity=".6" strokeWidth="1" />
    <path d="M12 3.6V1.8l3 .8-3 .8" fill="url(#oa-gold)" stroke="#a35a00" strokeWidth=".7" />
  </>,
  bigtop: <>
    <S d="M3.4 11.4 12 4.4l8.6 7v8.4H3.4z" g="cream" o="#8f1740" />
    <path d="M6.2 9.1v10.7M9.1 6.8v13M14.9 6.8v13M17.8 9.1v10.7" stroke="#ff5c8a" strokeWidth="2" />
    <path d="M9.4 19.8a2.6 3.4 0 0 1 5.2 0z" fill="#3a1030" />
    <path d="M12 4.4V1.6l3.2 1-3.2 1" fill="url(#oa-gold)" stroke="#a35a00" strokeWidth=".7" />
  </>,
  mail: <>
    <S d="M3.2 7a1.6 1.6 0 0 1 1.6-1.6h14.4A1.6 1.6 0 0 1 20.8 7v10a1.6 1.6 0 0 1-1.6 1.6H4.8A1.6 1.6 0 0 1 3.2 17z" g="cream" o="#b98a3e" />
    <path d="M3.8 6.4 12 12.6l8.2-6.2" fill="none" stroke="#8b6bff" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="12" cy="12.4" r="2" fill="url(#oa-coral)" stroke="#8f1740" strokeWidth=".7" />
  </>,
  chat: <>
    <S d="M5 4.2h14a2 2 0 0 1 2 2v8.6a2 2 0 0 1-2 2h-7.4l-5 3.9v-3.9H5a2 2 0 0 1-2-2V6.2a2 2 0 0 1 2-2z" g="violet" o="#2d1a85" />
    <circle cx="8.2" cy="10.6" r="1.2" fill="#fff" /><circle cx="12" cy="10.6" r="1.2" fill="#fff" /><circle cx="15.8" cy="10.6" r="1.2" fill="#fff" />
    {gloss(7, 6.4, 1.8, 0.7, -8, 0.6)}
  </>,
  megaphone: <>
    <S d="M3.4 10.2v3.6c0 .7.5 1.2 1.2 1.2H7l7.2 4.2V4.8L7 9H4.6c-.7 0-1.2.5-1.2 1.2z" g="coral" o="#8f1740" />
    <path d="M7.2 15l1.2 4.6h2.2L9.8 15.4" fill="url(#oa-cream)" stroke="#8f1740" strokeWidth=".9" strokeLinejoin="round" />
    {line('M17 9.2a4 4 0 0 1 0 5.6M19.6 6.8a7.4 7.4 0 0 1 0 10.4', '#ffc93c', 1.7)}
  </>,
  signal: <>
    {line('M7.4 13.4a6.4 6.4 0 0 1 9.2 0M4.6 10.6a10.4 10.4 0 0 1 14.8 0', '#2ee6d6', 1.9)}
    <path d="M12 15.4l3 5.4H9z" fill="url(#oa-violet)" stroke="#2d1a85" strokeWidth=".9" strokeLinejoin="round" />
    <C cx={12} cy={15.6} r={1.8} g="gold" o="#a35a00" w={0.9} />
  </>,
  bulb: <>
    <S d="M12 2.8a6.4 6.4 0 0 1 3.8 11.5c-.7.5-1 1.3-1 2.1v.6H9.2v-.6c0-.8-.3-1.6-1-2.1A6.4 6.4 0 0 1 12 2.8z" g="gold" o="#a35a00" />
    <rect x="9.2" y="17.6" width="5.6" height="3.4" rx="1" fill="url(#oa-silver)" stroke="#4f5875" strokeWidth=".8" />
    {line('M10.4 13.6l1.6-3 1.6 3', '#a35a00', 1.1)}
    {gloss(9.6, 6.2, 1.5, 0.8)}
  </>,
  flask: <>
    <S d="M9.4 3.4h5.2M10.2 3.4v5.4l-5.2 9.4a1.8 1.8 0 0 0 1.6 2.6h10.8a1.8 1.8 0 0 0 1.6-2.6l-5.2-9.4V3.4z" g="cream" o="#0b5f5a" w={1.1} />
    <path d="M7.4 14.6h9.2l2.1 3.8a1 1 0 0 1-.9 1.4H6.2a1 1 0 0 1-.9-1.4z" fill="url(#oa-teal)" />
    <circle cx="10.6" cy="16.8" r=".9" fill="#fff" /><circle cx="13.6" cy="15.8" r=".6" fill="#fff" />
  </>,
  search: <>
    <path d="M15.4 15.4l5 5" stroke="url(#oa-violet)" strokeWidth="3" strokeLinecap="round" />
    <C cx={10.4} cy={10.4} r={6.4} g="silver" o="#4f5875" />
    <circle cx="10.4" cy="10.4" r="4.4" fill="url(#oa-teal)" opacity=".85" />
    {gloss(8.6, 8.4, 1.5, 0.8)}
  </>,
  party: <>
    <S d="M3.6 20.4l4.4-11.8 7.4 7.4z" g="gold" o="#a35a00" />
    <path d="M5.4 15.6l3.2 3.2M6.8 11.8l5.6 5.6" stroke="#ff5c8a" strokeWidth="1.4" />
    <circle cx="15.6" cy="5" r="1.2" fill="#2ee6d6" /><circle cx="19.4" cy="9.6" r="1.1" fill="#ff5c8a" /><circle cx="12.4" cy="3.6" r=".9" fill="#ffc93c" />
    {line('M13.6 9.4c1-2.4 2.8-3.4 5.2-3.2M14.8 11.6c1.6-.6 3.4-.2 4.8 1.2', '#8b6bff', 1.4)}
  </>,
  baton: <>
    {line('M3 9h4M2.4 12.6h3.6M3.4 16.2h3.4', '#2ee6d6', 1.6)}
    <g transform="rotate(-30 14 12)"><S d="M8.4 9.6h11.2a2.4 2.4 0 0 1 0 4.8H8.4a2.4 2.4 0 0 1 0-4.8z" g="gold" o="#a35a00" /><path d="M10.6 9.6v4.8M17.4 9.6v4.8" stroke="#ff5c8a" strokeWidth="1.6" /></g>
  </>,
  door: <>
    <S d="M6 3.6h12v16.8H6z" g="violet" o="#2d1a85" />
    <path d="M8.2 5.8h7.6v6.2H8.2zM8.2 13.6h7.6v4.8H8.2z" fill="none" stroke="#c9c1ff" strokeOpacity=".55" strokeWidth=".9" />
    <circle cx="15" cy="12.8" r="1" fill="#ffc93c" />
  </>,
  sprout: <>
    <path d="M12 20.4v-8" stroke="#1f9c58" strokeWidth="1.8" strokeLinecap="round" />
    <S d="M12 12.6C11.6 8 8.6 5.6 4.2 5.8c.2 4.6 3.4 7.2 7.8 6.8z" g="green" o="#11663a" w={1} />
    <S d="M12 10.4c.4-3.8 3-6 7.4-5.8-.2 3.8-2.8 6.2-7.4 5.8z" g="green" o="#11663a" w={1} />
    <path d="M7.6 20.4h8.8" stroke="#a35d26" strokeWidth="1.8" strokeLinecap="round" />
  </>,
  wave: <>
    <C cx={12} cy={12} r={9} g="gold" o="#a35a00" />
    <path d="M8.2 13.4c0-2.4.9-3.4 1.6-3.4M10.4 12V8.2a.9.9 0 0 1 1.8 0V11.6M12.2 11V7.4a.9.9 0 0 1 1.8 0v4M14 11.4V8.6a.9.9 0 0 1 1.8 0v4.6c0 2.6-1.8 4.4-4 4.4-2 0-3.2-1.2-3.6-3" fill="none" stroke="#7a4300" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </>,
  spark: <>
    <S d="M12 2.4c.8 4.6 3 6.8 7.6 7.6-4.6.8-6.8 3-7.6 7.6-.8-4.6-3-6.8-7.6-7.6 4.6-.8 6.8-3 7.6-7.6z" g="gold" o="#a35a00" w={1.1} />
    <circle cx="18.6" cy="17.6" r="1.4" fill="url(#oa-teal)" /><circle cx="5.4" cy="18.4" r="1" fill="url(#oa-coral)" />
  </>,
  bell: <>
    <S d="M12 3.4a5.6 5.6 0 0 1 5.6 5.6v4.4l1.8 2.8H4.6l1.8-2.8V9A5.6 5.6 0 0 1 12 3.4z" g="gold" o="#a35a00" />
    <circle cx="12" cy="18.8" r="1.8" fill="url(#oa-coral)" stroke="#8f1740" strokeWidth=".8" />
    {gloss(9.4, 7.4, 1.2, 0.7)}
  </>,
  sound: <>
    <S d="M3.6 9.4v5.2h3.6l5 4.2V5.2l-5 4.2z" g="violet" o="#2d1a85" />
    {line('M15.4 9.2a4 4 0 0 1 0 5.6M18 6.8a7.4 7.4 0 0 1 0 10.4', '#2ee6d6', 1.7)}
  </>,
  mute: <>
    <S d="M3.6 9.4v5.2h3.6l5 4.2V5.2l-5 4.2z" g="violet" o="#2d1a85" />
    {line('M15.4 9.4l5 5M20.4 9.4l-5 5', '#ff5c8a', 1.8)}
  </>,
  up: <><C cx={12} cy={12} r={9} g="green" o="#11663a" />{line('M12 16.8V7.6M8 11.4l4-4 4 4', '#fff', 2.2)}</>,
  down: <><C cx={12} cy={12} r={9} g="coral" o="#8f1740" />{line('M12 7.2v9.2M8 12.6l4 4 4-4', '#fff', 2.2)}</>,
  question: <><C cx={12} cy={12} r={9} g="violet" o="#2d1a85" />{line('M9.4 9.4a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1 .8-1 1.6v.6', '#fff', 1.9)}<circle cx="12" cy="16.6" r="1.1" fill="#fff" /></>,
  key: <>
    {line('M11.4 12.6l8 8M17 18.2l2-2M15.2 16.4l1.6-1.6', 'url(#oa-gold-deep)', 2.2)}
    <C cx={8.4} cy={9.6} r={5} g="gold" o="#a35a00" />
    <circle cx="7.4" cy="8.6" r="1.6" fill="#7a4300" />
  </>,
  link: <>{line('M10.2 13.8a3.6 3.6 0 0 0 5.1 0l3-3a3.6 3.6 0 0 0-5.1-5.1l-1 1M13.8 10.2a3.6 3.6 0 0 0-5.1 0l-3 3a3.6 3.6 0 0 0 5.1 5.1l1-1', '#2ee6d6', 2.2)}</>,
  sun: <>
    {line('M12 1.8v2.4M12 19.8v2.4M1.8 12h2.4M19.8 12h2.4M4.8 4.8l1.7 1.7M17.5 17.5l1.7 1.7M4.8 19.2l1.7-1.7M17.5 6.5l1.7-1.7', '#ffc93c', 1.7)}
    <C cx={12} cy={12} r={5.4} g="gold" o="#a35a00" />{gloss(10.2, 10, 1.3, 0.7)}
  </>,
  moon: <><S d="M15.6 3.6a8.6 8.6 0 1 0 4.8 13.6A7 7 0 0 1 15.6 3.6z" g="gold" o="#a35a00" />{gloss(8, 8.4, 1.4, 0.8, -50)}</>,
  pencil: <><S d="M4 20l1-4.6L15.4 5a2.1 2.1 0 0 1 3 0l.6.6a2.1 2.1 0 0 1 0 3L8.6 19z" g="gold" o="#a35a00" /><path d="M4 20l1-4.6 3.6 3.6z" fill="url(#oa-cream)" /><path d="M14 6.4l3.6 3.6" stroke="#a35a00" strokeWidth="1" /></>,
  trash: <><S d="M6 7.4h12l-1 12a1.6 1.6 0 0 1-1.6 1.4H8.6A1.6 1.6 0 0 1 7 19.4z" g="coral" o="#8f1740" />{line('M4.4 7.4h15.2M9.6 7.4V5.2h4.8v2.2M10 10.6v6.6M14 10.6v6.6', '#fff6e5', 1.4)}</>,
  copy: <><S d="M8.4 8.4h10.4a1.4 1.4 0 0 1 1.4 1.4v9.6a1.4 1.4 0 0 1-1.4 1.4H9.8a1.4 1.4 0 0 1-1.4-1.4z" g="cream" o="#b98a3e" w={1.1} /><path d="M15.6 8.4V5a1.4 1.4 0 0 0-1.4-1.4H5.2A1.4 1.4 0 0 0 3.8 5v9.6A1.4 1.4 0 0 0 5.2 16h3.2" fill="none" stroke="#2ee6d6" strokeWidth="1.6" strokeLinejoin="round" /></>,
  gear: <>
    <S d="M10.4 2.8h3.2l.5 2.4 1.7.7 2-1.4 2.3 2.3-1.4 2 .7 1.7 2.4.5v3.2l-2.4.5-.7 1.7 1.4 2-2.3 2.3-2-1.4-1.7.7-.5 2.4h-3.2l-.5-2.4-1.7-.7-2 1.4-2.3-2.3 1.4-2-.7-1.7-2.4-.5v-3.2l2.4-.5.7-1.7-1.4-2L6.3 4.5l2 1.4 1.7-.7z" g="silver" o="#4f5875" w={1} />
    <circle cx="12" cy="12" r="3" fill="url(#oa-violet)" stroke="#2d1a85" strokeWidth=".9" />
  </>,
  refresh: <>{line('M19.4 12a7.4 7.4 0 0 1-12.6 5.2M4.6 12a7.4 7.4 0 0 1 12.6-5.2', '#2ee6d6', 2)}{line('M17.8 2.8v4.6h-4.6M6.2 21.2v-4.6h4.6', '#2ee6d6', 2)}</>,
  plus: <><C cx={12} cy={12} r={9} g="teal" o="#0b5f5a" />{line('M12 7.6v8.8M7.6 12h8.8', '#fff', 2.4)}</>,
  play: <><C cx={12} cy={12} r={9} g="gold" o="#a35a00" /><path d="M10 8.2v7.6a.6.6 0 0 0 .9.5l5.8-3.8a.6.6 0 0 0 0-1l-5.8-3.8a.6.6 0 0 0-.9.5z" fill="#5a2a00" />{gloss(8, 7, 1.8, 0.8)}</>,
  heal: <><g transform="rotate(-40 12 12)"><S d="M5.6 8.8h12.8a3.2 3.2 0 0 1 0 6.4H5.6a3.2 3.2 0 0 1 0-6.4z" g="cream" o="#b98a3e" /><rect x="9.4" y="8.8" width="5.2" height="6.4" fill="url(#oa-coral)" /></g></>,
  boom: <><S d="M12 2.6l2.2 5 5.2-1.6-2.4 4.8 4.4 2.8-5.2.8.6 5.4-4.8-3.2-4.2 3.6.2-5.4-5.2-1.4 4.6-2.6-2.2-5z" g="flame" o="#a32a00" w={1} /><circle cx="12" cy="11.6" r="2.2" fill="#fff6c4" /></>,
  wind: <>{line('M3.4 9.2h10.8a2.6 2.6 0 1 0-2.6-2.6M3.4 13.2h14.4a2.8 2.8 0 1 1-2.8 2.8M3.4 17h6.4', '#2ee6d6', 1.9)}</>,
  online: <><circle cx="12" cy="12" r="5.6" fill="url(#oa-green)" stroke="#11663a" strokeWidth="1.2" /><circle cx="10.6" cy="10.4" r="1.4" fill="#fff" opacity=".8" /></>,
  tag: <><S d="M3.6 4.8a1.2 1.2 0 0 1 1.2-1.2h6.6l9 9a1.4 1.4 0 0 1 0 2l-5.6 5.6a1.4 1.4 0 0 1-2 0l-9-9z" g="gold" o="#a35a00" /><circle cx="8" cy="8" r="1.6" fill="#7a4300" /></>,
  fork: <>
    <S d="M7.8 2.8h2.6v8.4a1.6 1.6 0 0 0 3.2 0V2.8h2.6v8.4a4.2 4.2 0 0 1-2.9 4v4.2h-2.6v-4.2a4.2 4.2 0 0 1-2.9-4z" g="silver" o="#4f5875" />
    <C cx={12} cy={20.2} r={1.7} g="silver" o="#4f5875" w={1} />
    {line('M4.8 4.6c-.9 1.2-.9 2.8 0 4M19.2 4.6c.9 1.2.9 2.8 0 4', '#2ee6d6', 1.4)}
    {gloss(9.1, 5, 0.45, 1.5, 0, 0.8)}
  </>,
  drum: <>
    {line('M9.4 8.2 4.6 2.8M14.6 8.2l4.8-5.4', '#a35d26', 1.5)}
    <S d="M3.8 9.2v7.2c0 2 3.7 3.6 8.2 3.6s8.2-1.6 8.2-3.6V9.2z" g="coral" o="#8f1740" />
    {line('M5 11.8l2.4 5.4 2.4-5.8 2.2 6 2.2-6 2.4 5.8 2.4-5.4', '#fff3b0', 1)}
    <ellipse cx="12" cy="9.2" rx="8.2" ry="3.1" fill="url(#oa-cream)" stroke="#8f1740" strokeWidth="1.25" />
    {gloss(8.6, 8.6, 2, 0.7, -6, 0.8)}
  </>,
  ruler: <><g transform="rotate(-35 12 12)">
    <S d="M2.6 9h18.8a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H2.6a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z" g="gold" o="#a35a00" />
    {line('M5 9.4v2.6M8 9.4v1.6M11 9.4v2.6M14 9.4v1.6M17 9.4v2.6M20 9.4v1.6', '#7a4300', 1)}
  </g></>,
  plane: <>
    <S d="M12 2.4c.9 0 1.5 1 1.5 2.4v4.6l7.4 4.2v2.1l-7.4-2.2v4l2.3 1.7v1.6L12 20l-3.8.8v-1.6l2.3-1.7v-4l-7.4 2.2v-2.1l7.4-4.2V4.8c0-1.4.6-2.4 1.5-2.4z" g="silver" o="#4f5875" />
    {gloss(11.5, 6, 0.5, 1.6, 0, 0.85)}
  </>,
  brain: <>
    <S d="M7.6 5.2c1-1.6 3.4-2 4.8-.8 1.4-1.2 3.8-1 4.8.6 2 .2 3.4 2 3 4 1.2 1 1.4 3 .4 4.2.2 2-1.6 3.6-3.6 3.4-.8 1.4-2.6 2-4 1.2l-.4 2.6h-2.4l.2-3c-1.6.4-3.4-.4-4-2-2 0-3.4-1.8-3-3.8-1.2-1.2-1-3.2.4-4.2 0-1.6 1.6-2.6 3.8-2.2z" g="coral" o="#8f1740" />
    {line('M12.4 4.6v4M9 8.4c1 .2 2 1 2.4 2M15.8 8c-1 .4-1.6 1.2-1.8 2.2M7.2 12.4c1.2-.4 2.6 0 3.2 1M17 12.4c-1.4-.2-2.6.4-3.2 1.6', '#b8254f', 1)}
    {gloss(8.4, 6.4, 1.4, 0.7)}
  </>,
  chart: <>
    <S d="M4 3.4h16a1 1 0 0 1 1 1v15.2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4.4a1 1 0 0 1 1-1z" g="cream" o="#b98a3e" />
    {line('M5.6 5.8v12.4h13.6', '#b98a3e', 0.9)}
    {line('M6.6 16.8c2.8 0 3.2-9.8 5.6-9.8s2.8 9.8 5.6 9.8', '#ff5c8a', 1.7)}
  </>,
  headphones: <>
    {line('M5.2 14.4v-2.6a6.8 6.8 0 0 1 13.6 0v2.6', '#2d1a85', 2.8)}
    {line('M5.2 14.4v-2.6a6.8 6.8 0 0 1 13.6 0v2.6', '#8b6bff', 1.2)}
    <S d="M3.4 14.2a1.8 1.8 0 0 1 1.8-1.8h1.6a1 1 0 0 1 1 1v6.2a1 1 0 0 1-1 1H5.2a1.8 1.8 0 0 1-1.8-1.8z" g="teal" o="#0b5f5a" />
    <S d="M20.6 14.2a1.8 1.8 0 0 0-1.8-1.8h-1.6a1 1 0 0 0-1 1v6.2a1 1 0 0 0 1 1h1.6a1.8 1.8 0 0 0 1.8-1.8z" g="teal" o="#0b5f5a" />
    {gloss(5.4, 14.4, 0.6, 1.3, 0, 0.8)}
  </>,
  owl: <>
    <S d="M5.6 4.4l2.9 2.1a7.6 7.6 0 0 1 7 0l2.9-2.1-.5 4.2c1 1.3 1.7 3 1.7 4.8 0 4.4-3.4 7.2-7.6 7.2s-7.6-2.8-7.6-7.2c0-1.8.7-3.5 1.7-4.8z" g="bronze" o="#6b3815" />
    <path d="M8.6 16.4c1-.6 2.2-.9 3.4-.9s2.4.3 3.4.9c-.4 1.9-1.8 3-3.4 3s-3-1.1-3.4-3z" fill="url(#oa-cream)" opacity=".85" />
    <circle cx="9.2" cy="11.4" r="2.7" fill="url(#oa-cream)" stroke="#6b3815" strokeWidth=".9" />
    <circle cx="14.8" cy="11.4" r="2.7" fill="url(#oa-cream)" stroke="#6b3815" strokeWidth=".9" />
    <circle cx="9.5" cy="11.6" r="1.2" fill="#22153f" /><circle cx="14.5" cy="11.6" r="1.2" fill="#22153f" />
    <circle cx="9.9" cy="11.1" r=".4" fill="#fff" /><circle cx="14.9" cy="11.1" r=".4" fill="#fff" />
    <path d="M12 13.2l1.1 1.5L12 15.9l-1.1-1.2z" fill="url(#oa-gold)" stroke="#a35a00" strokeWidth=".6" strokeLinejoin="round" />
    {gloss(8.4, 7.6, 1.2, 0.55)}
  </>,
  dolphin: <>
    {line('M3.2 20.2c1.4-1 2.8-1 4.2 0s2.8 1 4.2 0 2.8-1 4.2 0 2.8 1 4.2 0', '#2ee6d6', 1.4)}
    <S d="M3.6 16.4c2.4-5.8 7.2-9 12.4-8.8l1.6-2.6.7 3.2c1.7.7 2.8 1.9 3.4 3.3l-2.4.4c-.6-.6-1.4-1-2.5-1.1-3.4-.2-6.4 1.6-8.6 4.4l1.6 2.9-3.1-1.3-2.7 1.5z" g="teal" o="#0b5f5a" />
    <circle cx="17.4" cy="9.6" r=".7" fill="#0b4f4a" />
    {line('M7.6 15.4c1.8-1.7 3.9-2.7 6.3-2.9', '#f2fffe', 0.9)}
  </>,
  hearingaid: <>
    <S d="M12.6 2.8c4 0 6.8 2.8 6.8 6.4 0 2.8-1.6 5.2-4 6.2l-1.4-2.2c1.5-.8 2.5-2.3 2.5-4 0-2.2-1.6-3.9-3.9-4z" g="violet" o="#2d1a85" />
    {line('M14.6 14.4c-.9 2.7-2.9 4.4-5.4 4.6', '#4f5875', 1.6)}
    <C cx={8.4} cy={18.8} r={2.3} g="silver" o="#4f5875" w={1} />
    <circle cx="16.8" cy="6.2" r=".9" fill="url(#oa-gold)" stroke="#a35a00" strokeWidth=".5" />
    {gloss(13.4, 4.4, 1.2, 0.5, -10)}
  </>,
  empty: <><rect x="4.4" y="4.4" width="15.2" height="15.2" rx="4" fill="rgba(5,2,20,.35)" stroke="rgba(201,193,255,.45)" strokeWidth="1.4" strokeDasharray="2.4 2" /></>,
};

/** Bir kez App köküne konur: bütün ikonların paylaştığı degradeler. */
export function ArtDefs() {
  const lin = (id: string, stops: [number, string][], diag = false) => (
    <linearGradient id={`oa-${id}`} x1="0" y1="0" x2={diag ? 1 : 0} y2="1">{stops.map(([o, c]) => <stop key={o} offset={o} stopColor={c} />)}</linearGradient>
  );
  return (
    <svg width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden focusable="false">
      <defs>
        {lin('gold', [[0, '#fff3b0'], [0.5, '#ffc93c'], [1, '#ff9f1c']])}
        {lin('gold-deep', [[0, '#ffd76a'], [1, '#d07a00']])}
        {lin('teal', [[0, '#dffffb'], [0.5, '#2ee6d6'], [1, '#12a89e']])}
        {lin('gem', [[0, '#f2fffe'], [0.35, '#6ff3e6'], [0.78, '#8b6bff'], [1, '#5a36e0']], true)}
        {lin('coral', [[0, '#ffd3df'], [0.5, '#ff5c8a'], [1, '#d42a62']])}
        {lin('violet', [[0, '#e4dcff'], [0.5, '#8b6bff'], [1, '#5634d9']])}
        {lin('green', [[0, '#dcffe9'], [0.5, '#5fe39a'], [1, '#1f9c58']])}
        {lin('silver', [[0, '#ffffff'], [0.5, '#d5daea'], [1, '#8d96b4']])}
        {lin('bronze', [[0, '#ffe3c8'], [0.5, '#e0a06a'], [1, '#a35d26']])}
        {lin('cream', [[0, '#fffdf6'], [0.6, '#fff1d6'], [1, '#f0d4a0']])}
        {lin('flame', [[0, '#fff7c2'], [0.3, '#ffd34d'], [0.65, '#ff8a1c'], [1, '#ff3d6e']])}
      </defs>
    </svg>
  );
}

/** Emoji → resimli ikon. Arayüzde emoji görünmesin diye veri/metin içindeki simgeler bununla çizilir. */
export const EMOJI_ART: Record<string, ArtName> = {
  '🪙': 'coin', '💰': 'coin', '💎': 'crystal', '🛡️': 'shield', '🛡': 'shield', '🔥': 'flame', '📦': 'chest', '🎁': 'gift',
  '🥇': 'medal1', '🥈': 'medal2', '🥉': 'medal3', '🏅': 'medal', '🏆': 'trophy', '⭐': 'star', '🌟': 'star', '★': 'star', '✨': 'xp',
  '🎵': 'note', '🎶': 'note', '🎼': 'note', '♪': 'note', '♫': 'note', '♩': 'note', '♬': 'note', '🐚': 'shell', '❤️': 'heart', '❤': 'heart',
  '💚': 'heart', '💜': 'heart', '🫶': 'help', '⚡': 'bolt', '🎯': 'target', '🚩': 'flag', '🏳️': 'flag', '🏁': 'finish', '⚔️': 'swords', '⚔': 'swords',
  '🥊': 'swords', '👹': 'monster', '👾': 'monster', '😵': 'monster', '⏳': 'hourglass', '⌛': 'hourglass', '⏱': 'timer', '⏱️': 'timer', '⏰': 'timer',
  '📅': 'calendar', '✅': 'check', '✔️': 'check', '❌': 'cross', '🚫': 'cross', '🔒': 'lock', '🔓': 'unlock', '👑': 'crown', '🎩': 'hat',
  '🎨': 'palette', '🃏': 'card', '🍀': 'clover', '⏩': 'booster', '🎫': 'ticket', '🙋': 'help', '🤝': 'help', '👥': 'users', '🫂': 'users',
  '👤': 'users', '👂': 'ear', '🦻': 'ear', '🗺️': 'map', '🗺': 'map', '🧭': 'compass', '🏗️': 'hammer', '🔨': 'hammer', '🛠️': 'hammer', '👷': 'hammer',
  '🧰': 'hammer', '🏕️': 'tent', '🎪': 'bigtop', '✉️': 'mail', '📨': 'mail', '💌': 'mail', '📬': 'mail', '📭': 'mail', '💬': 'chat',
  '📣': 'megaphone', '📢': 'megaphone', '📯': 'megaphone', '📡': 'signal', '📶': 'signal', '🧠': 'bulb', '💡': 'bulb', '🔬': 'flask', '🧪': 'flask',
  '🔎': 'search', '🔍': 'search', '🎉': 'party', '🏃': 'baton', '🤸': 'baton', '🏊': 'baton', '🚪': 'door', '🌱': 'sprout', '👋': 'users',
  '🆕': 'spark', '🔔': 'bell', '🔊': 'sound', '🎧': 'sound', '🔇': 'mute', '⬆️': 'up', '⬇️': 'down', '❔': 'question', '❓': 'question',
  '🔑': 'key', '🔗': 'link', '☀️': 'sun', '🌙': 'moon', '✏️': 'pencil', '🗑️': 'trash', '📋': 'copy', '⚙️': 'gear', '🔁': 'refresh',
  '➕': 'plus', '▶': 'play', '▶️': 'play', '🩹': 'heal', '💥': 'boom', '💨': 'wind', '🌬️': 'wind', '🟢': 'online', '🏷️': 'tag', '⬜': 'empty',
  '🙈': 'cross', '😴': 'moon', '🎭': 'spark', '↩️': 'refresh', '🏰': 'flag', '👏': 'party', '💪': 'bolt', '🙏': 'heart', '👍': 'check',
  '🌍': 'compass', '🎚️': 'gear', '🎛️': 'gear', '🎺': 'megaphone', '🥁': 'note', '🫧': 'spark', '🌊': 'wind', '🪶': 'wind', '🛤️': 'map', '🧹': 'spark', '🗼': 'signal', '🧞': 'monster', '👻': 'monster', '🟤': 'monster', '◻️': 'empty', '◻': 'empty',
  // kamp bölge binaları (docs/14-kamp.md §10)
  '👶': 'sprout', '🌳': 'clover', '🌀': 'compass', '📚': 'card',
};

/** Emoji ve ardından gelen değişken seçicileri / ZWJ dizilerini bütün olarak yakalar */
const EMOJI_RE = /(?:\p{Extended_Pictographic}|[▶★])(?:️|‍(?:\p{Extended_Pictographic})️?)*/gu;
const NOT_ICON = new Set(['©', '®', '™', '©️', '®️', '™️', '↔️', '↔']);

export function artFor(emoji: string): ArtName | undefined {
  return EMOJI_ART[emoji] ?? EMOJI_ART[emoji.replace(/️/g, '')] ?? EMOJI_ART[`${emoji.replace(/️/g, '')}️`];
}

/** Resimli ikon. `name` ya da `e` (emoji → eşleşen ikon). */
export function Art({ name, e, size = 22, className, title }: { name?: ArtName; e?: string; size?: number | string; className?: string; title?: string }) {
  const n = name ?? (e ? artFor(e) : undefined);
  if (!n) return null;
  return (
    <svg className={`art art-${n}${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} aria-label={title} focusable="false">
      {ART[n]}
    </svg>
  );
}

/** İkon alanı: emoji dizesi → resimli ikon; başka bir düğüm olduğu gibi */
export function Glyph({ e, size = 22 }: { e: ReactNode; size?: number | string }) {
  if (typeof e === 'string') { const n = artFor(e.trim()); return n ? <Art name={n} size={size} className={typeof size === 'string' ? 'art-inline' : undefined} /> : <>{rich(e, size)}</>; }
  return <>{e}</>;
}

/** Metin içindeki emojileri resimli ikona çevirir (eşleşmeyenler olduğu gibi kalır). Kullanıcı içeriği (sohbet, takma ad) buradan GEÇMEZ; takım amblemi TeamEmblem ile çizilir. */
export function Rich({ text, size = '1.15em' }: { text: string | number | null | undefined; size?: number | string }) {
  return <>{rich(text, size)}</>;
}
export function rich(text: string | number | null | undefined, size: number | string = '1.15em'): ReactNode {
  if (text === null || text === undefined) return null;
  const s = String(text);
  const ms = [...s.matchAll(EMOJI_RE)].filter((m) => !NOT_ICON.has(m[0]));
  if (!ms.length) return s;
  const out: ReactNode[] = []; let buf = ''; let last = 0;
  ms.forEach((m, i) => {
    const at = m.index ?? 0; buf += s.slice(last, at); last = at + m[0].length;
    const n = artFor(m[0]);
    if (!n) { buf += m[0]; return; } // eşleşmeyen (ör. kullanıcının yazdığı) emoji olduğu gibi kalır
    if (buf) out.push(<Fragment key={`t${i}`}>{buf}</Fragment>);
    buf = '';
    out.push(<Art key={`a${i}`} name={n} size={size} className="art-inline" />);
  });
  buf += s.slice(last);
  if (buf) out.push(<Fragment key="end">{buf}</Fragment>);
  return out;
}
/** Düz metin gereken yerler (aria-label, paylaşım değil, başlık özellikleri): emojileri ayıklar */
export function stripEmoji(s: string): string {
  return s.replace(EMOJI_RE, '').replace(/\s{2,}/g, ' ').trim();
}

/** Takım amblemi anahtarı (TEAM_EMBLEMS, @odi/shared) → çizim ve adı (YN-044). Amblem hiçbir yerde emoji glifi olarak basılmaz. */
export const TEAM_EMBLEM_ART: Record<TeamEmblemKey, { art: ArtName; name: string }> = {
  '👂': { art: 'ear', name: 'Kulak' }, '🦻': { art: 'hearingaid', name: 'İşitme cihazı' }, '🐚': { art: 'shell', name: 'Koklea' }, '🎵': { art: 'note', name: 'Nota' },
  '🔊': { art: 'sound', name: 'Ses' }, '🎧': { art: 'headphones', name: 'Kulaklık' }, '🦉': { art: 'owl', name: 'Baykuş' }, '🐬': { art: 'dolphin', name: 'Yunus' },
  '⭐': { art: 'star', name: 'Yıldız' }, '🔥': { art: 'flame', name: 'Alev' }, '🌙': { art: 'moon', name: 'Ay' }, '☀️': { art: 'sun', name: 'Güneş' },
  '⚡': { art: 'bolt', name: 'Şimşek' }, '🛡️': { art: 'shield', name: 'Kalkan' }, '🍀': { art: 'clover', name: 'Yonca' }, '🌱': { art: 'sprout', name: 'Fidan' },
  '👑': { art: 'crown', name: 'Taç' }, '🎯': { art: 'target', name: 'Hedef' }, '🧭': { art: 'compass', name: 'Pusula' }, '🔔': { art: 'bell', name: 'Zil' },
};
/** Eski kayıtlardaki (listeden önceki) emoji amblem: genel eşleme tablosu (EMOJI_ART), eşleşmezse varsayılan kalkan. Göç gerekmez. */
export function emblemArt(e: string | null | undefined): ArtName {
  if (!e) return 'shield';
  return isTeamEmblem(e) ? TEAM_EMBLEM_ART[e].art : artFor(e) ?? 'shield';
}
/** Takım amblemi (çizim). Boyut verilmezse çevredeki yazı boyunda (1em) çizilir; kutular (.th-emblem, .tr-emblem…) font-size ile ölçekler. */
export function TeamEmblem({ e, size = '1em', className }: { e: string | null | undefined; size?: number | string; className?: string }) {
  return <Art name={emblemArt(e)} size={size} className={className} />;
}

/** Geliştirme önizlemesi (`?demo=ikonlar`): bütün resimli ikonlar, büyük ve küçük boyda, koyu ve krem zeminde */
export function ArtGallery() {
  const names = Object.keys(ART) as ArtName[];
  return (
    <div className="screen art-gallery">
      <h1>İkonlar</h1>
      <div className="ag-grid">{names.map((n) => <div key={n} className="ag-cell"><Art name={n} size={56} /><span className="ag-row"><Art name={n} size={22} /><Art name={n} size={16} /></span><small>{n}</small></div>)}</div>
      <div className="ag-grid cream">{names.map((n) => <div key={n} className="ag-cell"><Art name={n} size={40} /></div>)}</div>
    </div>
  );
}
