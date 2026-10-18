export type Tab = 'map' | 'today' | 'team' | 'profile';
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'map', icon: '🗺️', label: 'Harita' }, { id: 'today', icon: '☀️', label: 'Bugün' }, { id: 'team', icon: '👥', label: 'Takım' }, { id: 'profile', icon: '🙂', label: 'Profil' },
];
/** Alt sekme çubuğu: Harita · Bugün · Takım · Profil. Rozet: bekleyen ödül sayısı. */
export function TabBar({ active, onTab, badges = {} }: { active: Tab; onTab: (t: Tab) => void; badges?: Partial<Record<Tab, number>> }) {
  return (
    <nav className="tabbar" aria-label="Ana menü">
      {TABS.map((t) => (
        <button key={t.id} className={`tab${active === t.id ? ' on' : ''}`} onClick={() => onTab(t.id)} aria-current={active === t.id ? 'page' : undefined}>
          <span className="ti">{t.icon}{(badges[t.id] ?? 0) > 0 && <span className="dot">{badges[t.id]}</span>}</span><span className="tl">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
