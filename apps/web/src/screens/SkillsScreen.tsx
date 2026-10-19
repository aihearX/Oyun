import { SKILL_TREE } from '@odi/content';
import { ownsSkill, useStore } from '../store';
import { buySkill } from '../net';
import { ScreenHead } from '../ui/bits';
import { Art } from '../ui/art';

export function SkillsScreen({ onBack }: { onBack: () => void }) {
  const s = useStore();
  return (
    <div className="screen fade-in">
      <ScreenHead title="Yetenekler" onBack={onBack} right={<span className="pill"><Art name="coin" size={18} className="art-inline" />{s.coins}</span>} />
      <div className="muted">Jetonlarla kalıcı yetenek al. Hepsi oyun içinden kazanılır.</div>
      {SKILL_TREE.map((n) => { const owned = ownsSkill(s.skills, n.id); const locked = n.requires ? !ownsSkill(s.skills, n.requires) : false; return (
        <div className={`card skill${owned ? ' owned' : ''}`} key={n.id}>
          <div><h2>{n.name}</h2><div className="muted">{n.desc}{locked ? ` · önce: ${SKILL_TREE.find((x) => x.id === n.requires)?.name}` : ''}</div></div>
          <button className="btn small" disabled={owned || locked || s.coins < n.cost} onClick={() => void buySkill(n.id)}>{owned ? 'Alındı' : <><Art name="coin" size="1.15em" className="art-inline" />{n.cost}</>}</button>
        </div>); })}
    </div>
  );
}
