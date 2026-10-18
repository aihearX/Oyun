import { Icon, type IconName } from './icons';

export type Tab = 'map' | 'today' | 'camp' | 'team' | 'profile';
const TABS: { id: Tab; icon: IconName; label: string }[] = [
  { id: 'map', icon: 'map', label: 'Harita' }, { id: 'today', icon: 'sun', label: 'Bugün' }, { id: 'camp', icon: 'tent', label: 'Kamp' }, { id: 'team', icon: 'team', label: 'Takım' }, { id: 'profile', icon: 'user', label: 'Profil' },
];
/** Alt sekme çubuğu: Harita · Bugün · Kamp · Takım · Profil. Rozet: bekleyen ödül / okunmamış sayısı. */
export function TabBar({ active, onTab, badges = {} }: { active: Tab; onTab: (t: Tab) => void; badges?: Partial<Record<Tab, number>> }) {
  return (
    <nav className="tabbar" aria-label="Ana menü">
      {TABS.map((t) => (
        <button key={t.id} className={`tab${active === t.id ? ' on' : ''}`} onClick={() => onTab(t.id)} aria-current={active === t.id ? 'page' : undefined}>
          <span className="ti"><Icon name={t.icon} size={26} />{(badges[t.id] ?? 0) > 0 && <span className="dot">{(badges[t.id] ?? 0) > 99 ? '99+' : badges[t.id]}</span>}</span><span className="tl">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
