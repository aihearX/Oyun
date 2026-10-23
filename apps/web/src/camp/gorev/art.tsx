/**
 * Kamp Görevleri resimli simgeleri (emoji değil): ODİ ikon dilinde (üstten ışık alan degrade, sıcak koyu kontur, yumuşak gölge,
 * beyaz parlama; degradeler ui/art.tsx ArtDefs içinde). Var olan ikonlar (çekiç, çadır, harita…) yeniden kullanılır.
 */
import type { ReactNode } from 'react';
import type { KgArt } from '@odi/content';
import { Art, type ArtName } from '../../ui/art';

const SH = 'rgba(14,6,40,.38)';
const S = ({ d, g, o, w = 1.25 }: { d: string; g: string; o: string; w?: number }) => <><path d={d} fill={SH} transform="translate(.5 1.2)" /><path d={d} fill={`url(#oa-${g})`} stroke={o} strokeWidth={w} strokeLinejoin="round" /></>;
const gloss = (cx: number, cy: number, rx = 2, ry = 1, rot = -30) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} transform={`rotate(${rot} ${cx} ${cy})`} fill="#fff" opacity=".8" />;
const ln = (d: string, c: string, w = 1.6) => <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;

const OWN: Partial<Record<KgArt | 'otoskop' | 'konsult' | 'salon', ReactNode>> = {
  klinik: <>
    <S d="M4 9.5 12 3.6l8 5.9v9.6a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 19.1z" g="cream" o="#b98a3e" />
    <rect x="9.2" y="10.6" width="5.6" height="5.6" rx="1" fill="url(#oa-green)" stroke="#11663a" strokeWidth="1" />
    {ln('M12 11.8v3.2M10.4 13.4h3.2', '#fff', 1.5)}
    {gloss(7.6, 9.6, 1.6, 0.7)}
  </>,
  defter: <>
    <S d="M5 3.6h11.6a2 2 0 0 1 2 2v14.8H6.6A1.6 1.6 0 0 1 5 18.8z" g="violet" o="#2d1a85" />
    <path d="M7.6 3.6v16.8" stroke="#fff" strokeOpacity=".45" strokeWidth="1" />
    <rect x="9.4" y="6.6" width="7" height="3.4" rx=".8" fill="url(#oa-cream)" stroke="#b98a3e" strokeWidth=".8" />
    {ln('M10 13.2h6M10 15.6h4.4', '#e4dcff', 1.2)}
    <path d="M16.4 17.2l1.2 2.4 2.6.4-1.9 1.8.5 2.6-2.4-1.3-2.3 1.3.4-2.6-1.9-1.8 2.6-.4z" transform="translate(-1.4 -4.6) scale(.82)" fill="url(#oa-gold)" stroke="#a35a00" strokeWidth=".7" />
  </>,
  ton: <>
    <S d="M8.6 3.2h2.4v8.6a3 3 0 1 1-2.4 0zM13 3.2h2.4v8.6a3 3 0 1 1-2.4 0z" g="silver" o="#4f5875" w={1} />
    <path d="M10 13.4h4.4v2.4a2.2 2.2 0 0 1-4.4 0z" fill="url(#oa-silver)" stroke="#4f5875" strokeWidth="1" />
    <path d="M12.2 18v3.2" stroke="#4f5875" strokeWidth="1.6" strokeLinecap="round" />
    {ln('M4.4 7.2a6 6 0 0 0 0 6.4M2.6 5.6a9 9 0 0 0 0 9.6M19.6 7.2a6 6 0 0 1 0 6.4M21.4 5.6a9 9 0 0 1 0 9.6', '#2ee6d6', 1.4)}
  </>,
  timpano: <>
    <S d="M3.4 5.4h17.2a1.4 1.4 0 0 1 1.4 1.4v11.4a1.4 1.4 0 0 1-1.4 1.4H3.4A1.4 1.4 0 0 1 2 18.2V6.8a1.4 1.4 0 0 1 1.4-1.4z" g="teal" o="#0b5f5a" />
    <rect x="3.6" y="7" width="16.8" height="10.8" rx=".8" fill="#122a3a" />
    {ln('M4.6 16.4c4 0 4.6-.2 6-3.4.8-1.9 1.2-4.6 1.6-4.6s.8 2.7 1.6 4.6c1.4 3.2 2 3.4 6 3.4', '#8ef0b0', 1.5)}
    {gloss(5.4, 6.2, 1.4, 0.5, 0)}
  </>,
  gorev: <>
    <S d="M6 3.4h10.4l3 3v13.2a1.4 1.4 0 0 1-1.4 1.4H6a1.4 1.4 0 0 1-1.4-1.4V4.8A1.4 1.4 0 0 1 6 3.4z" g="cream" o="#b98a3e" />
    <path d="M16.4 3.4v3h3" fill="none" stroke="#b98a3e" strokeWidth="1" />
    <circle cx="8.4" cy="9.4" r="1.3" fill="url(#oa-green)" stroke="#11663a" strokeWidth=".7" />
    <circle cx="8.4" cy="13.4" r="1.3" fill="url(#oa-green)" stroke="#11663a" strokeWidth=".7" />
    <circle cx="8.4" cy="17.4" r="1.3" fill="none" stroke="#b98a3e" strokeWidth=".9" />
    {ln('M11 9.4h5.4M11 13.4h5.4M11 17.4h3.6', '#8a6a3a', 1.3)}
  </>,
  dekor: <>
    <S d="M7.4 14.4h9.2l-1.2 6.2H8.6z" g="coral" o="#8f1740" />
    <path d="M12 14.4V8.8" stroke="#11663a" strokeWidth="1.6" />
    <S d="M12 9.6c-3.6 0-5.4-2.2-5.2-4.6 2.6-.4 5 1.2 5.2 4.6zM12 9.6c3.6 0 5.4-2.2 5.2-4.6-2.6-.4-5 1.2-5.2 4.6z" g="green" o="#11663a" w={1} />
    <circle cx="12" cy="6.4" r="2.2" fill="url(#oa-gold)" stroke="#a35a00" strokeWidth=".9" />
  </>,
  otoskop: <>
    <S d="M3.4 14.6 13 8.2l2.6 3.8-9.6 6.4a2.3 2.3 0 0 1-2.6-3.8z" g="silver" o="#4f5875" />
    <S d="M13 8.2l4.6-3.1 2.6 3.8-4.6 3.1z" g="gold" o="#a35a00" />
    <circle cx="19.6" cy="6.4" r="1.4" fill="#fffbe6" />
    {ln('M20.6 3.2l1.4-1M21.8 6.2h1.6', '#ffd66b', 1.2)}
  </>,
  konsult: <>
    <S d="M3.4 5h10.4a1.6 1.6 0 0 1 1.6 1.6v5.8a1.6 1.6 0 0 1-1.6 1.6H8.2l-3.4 2.8v-2.8H3.4a1.6 1.6 0 0 1-1.6-1.6V6.6A1.6 1.6 0 0 1 3.4 5z" g="violet" o="#2d1a85" w={1.1} />
    <S d="M10.6 10.4h10a1.6 1.6 0 0 1 1.6 1.6v5.4a1.6 1.6 0 0 1-1.6 1.6h-1.2v2.6l-3.2-2.6h-5.6A1.6 1.6 0 0 1 9 17.4V12a1.6 1.6 0 0 1 1.6-1.6z" g="teal" o="#0b5f5a" w={1.1} />
    {ln('M12.4 14.6h6.4', '#fff', 1.4)}
    <circle cx="6.6" cy="9.4" r="1" fill="#fff" /><circle cx="9.6" cy="9.4" r="1" fill="#fff" />
  </>,
  salon: <>
    <S d="M3.4 12.4h17.2v3.4H3.4z" g="coral" o="#8f1740" />
    <S d="M4.6 8.4h14.8a1.2 1.2 0 0 1 1.2 1.2v2.8H3.4V9.6a1.2 1.2 0 0 1 1.2-1.2z" g="coral" o="#8f1740" w={1} />
    {ln('M5.4 15.8v4.2M18.6 15.8v4.2', '#5a2a30', 1.8)}
    {gloss(7, 10, 1.6, 0.6, 0)}
  </>,
};
const MAP: Record<KgArt, ArtName> = {
  depo: 'chest', insaat: 'hammer', klinik: 'heal', defter: 'card', ton: 'sound', timpano: 'signal', malzeme: 'heal', takim: 'users', harita: 'map',
  yildiz: 'star', dekor: 'sprout', ziyaret: 'door', kamp: 'tent', gorev: 'check', bolum: 'flag',
};
export type KgIconName = KgArt | 'otoskop' | 'konsult' | 'salon';
export function KgIcon({ name, size = 24, className }: { name: KgIconName | string; size?: number | string; className?: string }) {
  const own = OWN[name as KgIconName];
  if (own) return <svg className={`art kg-art${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">{own}</svg>;
  return <Art name={MAP[name as KgArt] ?? 'spark'} size={size} className={className} />;
}

/** test simgeleri (otoskop, odyogram, timpanogram, refleks, OAE, ABR, konuşma, işlemleme) */
export function TestIcon({ id, size = 26 }: { id: string; size?: number }) {
  const m: Record<string, KgIconName | ArtName> = { otoskopi: 'otoskop', odyometri: 'ton', timpanometri: 'timpano', refleks: 'bolt', oae: 'wave', abr: 'signal', konusma: 'chat', islemleme: 'bulb' };
  const n = m[id] ?? 'search';
  return OWN[n as KgIconName] ? <KgIcon name={n} size={size} /> : <Art name={n as ArtName} size={size} />;
}
