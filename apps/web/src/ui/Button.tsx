import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from './icons';
import './buttons.css';

type Base = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

/**
 * Ortak eylem düğmesi.
 *  tone="primary": ekranın tek ana eylemi (altın degrade, ikon madalyonu, ışıltı)
 *  tone="gold" | "teal" | "coral" | "plain": koyu cam ikincil (renkli kenar + aynı renkte ikon)
 *  tile: ikon üstte, etiket altta (yan yana üç ikincil eylem için)
 */
export function ActionButton({ tone = 'primary', icon, tile, block, children, className, ...rest }: Base & { tone?: 'primary' | 'gold' | 'teal' | 'coral' | 'plain'; icon?: IconName; tile?: boolean; block?: boolean; children: ReactNode }) {
  const cls = ['abtn', tone === 'primary' ? 'primary' : `glass ${tone}`, tile ? 'tile' : '', block ? 'block' : '', className ?? ''].filter(Boolean).join(' ');
  return (
    <button type="button" {...rest} className={cls}>
      {icon && (tone === 'primary' && !tile ? <span className="ic-medal"><Icon name={icon} /></span> : <Icon name={icon} />)}
      <span className="lbl">{children}</span>
    </button>
  );
}

/** Kare ikon düğmesi (geri, kapat, menü, gönder…): erişilebilir ad zorunlu. */
export function IconButton({ icon, label, tone, small, className, children, ...rest }: Base & { icon: IconName; label: string; tone?: 'gold' | 'teal' | 'coral' | 'solid'; small?: boolean; children?: ReactNode }) {
  const cls = ['ibtn', tone ?? '', small ? 'sm' : '', className ?? ''].filter(Boolean).join(' ');
  return <button type="button" aria-label={label} {...rest} className={cls}><Icon name={icon} size={small ? 18 : 22} />{children}</button>;
}
