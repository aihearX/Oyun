import { Icon, type IconName } from './icons';
import { Art } from './art';

export type Tab = 'map' | 'today' | 'camp' | 'team' | 'profile';
const TABS: { id: Tab; icon: IconName; label: string }[] = [
  { id: 'map', icon: 'map', label: 'Harita' }, { id: 'today', icon: 'sun', label: 'Bugün' }, { id: 'camp', icon: 'tent', label: 'Kamp' }, { id: 'team', icon: 'team', label: 'Takım' }, { id: 'profile', icon: 'user', label: 'Profil' },
];
/** Alt sekme çubuğu: Harita · Bugün · Kamp · Takım · Profil. Rozet: bekleyen ödül / okunmamış sayısı.
 *  Kilitli sekme (ilk deneyim): soluk + kilit; dokununca "Bölüm N'de açılır" (App gösterir). */
export function TabBar({ active, onTab, badges = {}, locked = {} }: { active: Tab; onTab: (t: Tab) => void; badges?: Partial<Record<Tab, number>>; locked?: Partial<Record<Tab, string | undefined>> }) {
  return (
    <nav className="tabbar" aria-label="Ana menü">
      {TABS.map((t) => { const lk = locked[t.id]; return (
        <button key={t.id} data-tab={t.id} className={`tab${active === t.id ? ' on' : ''}${lk ? ' locked' : ''}`} onClick={() => onTab(t.id)} aria-current={active === t.id ? 'page' : undefined} aria-label={lk ? `${t.label}: ${lk}` : undefined} aria-disabled={lk ? true : undefined}>
          <span className="ti"><Icon name={t.icon} size={26} />{lk ? <span className="lock-b"><Art name="lock" size={14} /></span> : (badges[t.id] ?? 0) > 0 && <span className="dot">{(badges[t.id] ?? 0) > 99 ? '99+' : badges[t.id]}</span>}</span><span className="tl">{t.label}</span>
        </button>
      ); })}
    </nav>
  );
}
