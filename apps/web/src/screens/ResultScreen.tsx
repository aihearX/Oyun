import type { LevelSpec, RunResult } from '@odi/shared';
import { HUMAN_JOURNEY } from '@odi/content';
import { useState } from 'react';
import { platform } from '../platform';
import { inviteUrl, type Invite } from '../invite';

export function ResultScreen({ spec, result, onRetry, onNext, onMap, challenge }: { spec: LevelSpec; result: RunResult; onRetry: () => void; onNext: () => void; onMap: () => void; challenge?: Invite | null }) {
  const [toast, setToast] = useState('');
  const last = spec.number >= HUMAN_JOURNEY.levels.length;
  const share = async () => {
    const link = inviteUrl({ level: spec.number, score: result.completed ? result.score : 0, stars: result.stars });
    const text = result.completed ? `ODİ: ${spec.number}. bölümü ${'⭐'.repeat(result.stars)} ile ${result.score} puanla geçtim. Beni geçebilir misin? ${link}` : `ODİ'de ${spec.number}. bölümde takıldım. Sen geçebilir misin? ${link}`;
    const r = await platform().share(text); if (r === 'copied') { setToast('Kopyalandı'); setTimeout(() => setToast(''), 1500); }
  };
  return (
    <div className="screen fade-in"><div className="result">
      <div className="muted">{spec.number}. {spec.name}</div>
      <h1>{result.completed ? (result.stars === 3 ? 'Mükemmel!' : result.stars === 2 ? 'Harika!' : 'Geçtin!') : 'Bu sefer olmadı'}</h1>
      <div className="stars">{'⭐'.repeat(result.stars)}{'☆'.repeat(3 - result.stars)}</div>
      <div className="score">{result.score.toLocaleString('tr-TR')}</div>
      <div className="stats">
        <div className="card"><div className="v">🪙 {result.coins}</div><div className="k">jeton{spec.coinsTotal ? ` / ${spec.coinsTotal}` : ''}</div></div>
        <div className="card"><div className="v">⏱ {result.timeSec}s</div><div className="k">süre · par {spec.parTimeSec}s</div></div>
        <div className="card"><div className="v">{result.objectiveMet ? '✅' : '❌'}</div><div className="k">{spec.objective.label}</div></div>
      </div>
      {challenge && challenge.level === spec.number && challenge.score > 0 && (
        <div className="card" style={{ width: '100%' }}>
          <div className="muted">Meydan okuma</div>
          <h2>{result.completed && result.score > challenge.score ? `Arkadaşını ${(result.score - challenge.score).toLocaleString('tr-TR')} puan geçtin!` : result.completed ? `Arkadaşına ${(challenge.score - result.score).toLocaleString('tr-TR')} puan kaldı` : 'Arkadaşın bu bölümü geçti; bir daha dene'}</h2>
          <div className="muted">Arkadaşın: {challenge.score.toLocaleString('tr-TR')} · Sen: {result.score.toLocaleString('tr-TR')}</div>
        </div>
      )}
      {result.secretFound && <div className="pill">🐚 Altın koklea bulundu</div>}
      {!result.completed && result.extra?.reason === 'fall' && <div className="muted">İpucu: boşluklarda bir an önce zıpla; basılı tutarsan daha uzağa gidersin.</div>}
      <div className="row" style={{ width: '100%' }}>
        <button className="btn ghost grow" onClick={onRetry}>↻ Tekrar</button>
        {result.completed && !last && <button className="btn grow" onClick={onNext}>Sonraki ▶</button>}
      </div>
      <button className="btn coral" onClick={share}>Paylaş</button>
      <button className="btn ghost small" onClick={onMap}>Harita</button>
      {toast && <div className="toast">{toast}</div>}
    </div></div>
  );
}
