import { SKILL_TREE } from '@odi/content';
import { ownsSkill, useStore } from '../store';

export function SkillsScreen({ onBack }: { onBack: () => void }) {
  const s = useStore();
  return (
    <div className="screen fade-in">
      <div className="topbar"><button className="btn ghost small" onClick={onBack} aria-label="Geri">← Profil</button><div className="pill">🪙 {s.coins}</div></div>
      <h1>Yetenekler</h1><div className="muted">Jetonlarla kalıcı yetenek al. Hepsi oyun içinden kazanılır.</div>
      {SKILL_TREE.map((n) => { const owned = ownsSkill(s.skills, n.id); const locked = n.requires ? !ownsSkill(s.skills, n.requires) : false; return (
        <div className={`card skill${owned ? ' owned' : ''}`} key={n.id}>
          <div><h2>{n.name}</h2><div className="muted">{n.desc}{locked ? ` · önce: ${SKILL_TREE.find((x) => x.id === n.requires)?.name}` : ''}</div></div>
          <button className="btn small" disabled={owned || locked || s.coins < n.cost} onClick={() => s.buySkill(n.id)}>{owned ? 'Alındı' : `🪙 ${n.cost}`}</button>
        </div>); })}
    </div>
  );
}
