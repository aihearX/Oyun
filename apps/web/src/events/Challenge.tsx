import { useEffect, useState } from 'react';
import type { RankRow } from '@odi/shared';
import { useNet } from '@odi/net/store';
import { OdiAvatar } from '../ui/OdiAvatar';
import { SubTabs, fmtNum } from '../ui/social';
import { refreshEvents, useEvents } from './store';
import { Countdown, Rewards, eventSpec, levelName } from './common';
import type { PlayFn } from './EventsScreen';
import { Art } from '../ui/art';

/** Günün Meydan Okuması: herkes için aynı tuzlu zorlu bölüm, 3 deneme, en iyi skor; genel + arkadaş sıralaması */
export function ChallengeView({ onPlay }: { onPlay: PlayFn }) {
  const c = useEvents((s) => s.challenge); const me = useNet((s) => s.me);
  const [tab, setTab] = useState<'genel' | 'arkadas'>('genel');
  // sıralama başkalarının skorlarıyla değişir: açıkken arada bir tazele
  useEffect(() => { const h = setInterval(() => void refreshEvents(), 20_000); return () => clearInterval(h); }, []);
  if (!c) return <div className="card muted">Yükleniyor…</div>;
  const left = c.maxTries - c.tries;
  return (
    <div className="stack ev-challenge" data-testid="meydan" data-best={c.best ?? 0} data-rank={c.rank ?? 0}>
      <div className="ev-ch-hero" data-tone="coral">
        <div className="row between"><span className="ev-tag">Bugünün bölümü · tohum #{c.salt}</span><Countdown to={c.endsAt} /></div>
        <b className="ev-ch-level">{c.level}. {levelName(c.level)}</b>
        <div className="ev-tries" aria-label={`${left} deneme kaldı`}>{Array.from({ length: c.maxTries }, (_, i) => <i key={i} className={i < c.tries ? 'used' : ''}><Art e="🎯" size="1.15em" className="art-inline" /></i>)}</div>
        <div className="ev-stat-row"><span><small>En iyi skorun</small><b>{c.best != null ? fmtNum(c.best) : '—'}</b></span><span><small>Sıran</small><b data-testid="meydan-sira">{c.rank ? `${c.rank}.` : '—'}</b></span><span><small>Katılan</small><b>{fmtNum(c.total)}</b></span></div>
        <button className="btn ev-big" data-testid="meydan-oyna" disabled={left <= 0} onClick={() => onPlay(eventSpec(c.level, c.salt), { kind: 'meydan' })}>{left > 0 ? <><Art name="play" size="1.15em" className="art-inline" /> Meydan oku ({left} deneme)</> : 'Yarın yeni meydan okuma!'}</button>
        <small className="muted">Herkes aynı bölümü aynı tohumla, yeteneksiz (eşit şartlarda) oynar. En iyi skorun geçerli.</small>
      </div>
      {c.last && (
        <div className="card ev-last" data-testid="meydan-dun" data-prize={c.last.prize?.kind ?? 'yok'}>
          <b>Dünkü sonucun: {c.last.rank}. / {c.last.total}</b><span className="muted">Skor {fmtNum(c.last.score)}</span>
          {c.last.prize?.kind === 'katilim' && <Rewards items={c.last.prize.items} label={`Katılım ödülü: o gün ${c.last.total} kişi katıldı, sıra ödülü için ${c.last.rank === 1 ? c.minFirst : c.minAll} katılım gerekiyordu.`} />}
          {c.last.prize?.kind === 'sira' && <Rewards items={c.last.prize.items} label={`${c.last.rank}. sıra ödülü`} />}
        </div>
      )}
      <SubTabs<'genel' | 'arkadas'> active={tab} onChange={setTab} tabs={[{ id: 'genel', icon: '🌍', label: 'Genel' }, { id: 'arkadas', icon: '🫂', label: 'Arkadaşlar' }]} />
      <Board rows={tab === 'genel' ? c.top : c.friends} meId={me?.id} empty={tab === 'genel' ? 'Bugün ilk skoru sen koy!' : 'Arkadaşların bugün henüz oynamadı.'} />
      <div className="card ev-rw-grid" data-testid="meydan-odul" data-total={c.total}>
        <b>Gün sonu ödülleri</b>
        <span data-testid="meydan-kural">{challengeRule(c.total, c.minFirst, c.minAll)}</span>
        {c.rewards.map((r) => <Rewards key={r.label} items={r.items} label={r.label === 'İlk %10' ? r.label : `${r.label} (en az ${r.min} katılımda)`} />)}
        <Rewards items={c.participation} label={`Katılım ödülü (sıra ödülünün eşiği altında kalan, puanı olan herkese)`} />
        <small className="muted">"İlk %10": ilk 10'un dışında kalıp katılanların ilk %10'una girenler. Katılan: bugün puanı olan oyuncu sayısı.</small>
      </div>
    </div>
  );
}

/** sıra ödülü kuralı ve bugünkü gerçek katılan sayısı (sahip kararı 53); gün bitmediği için "gün böyle biterse" */
export function challengeRule(total: number, minFirst: number, minAll: number): string {
  const kural = `1.'lik ödülü en az ${minFirst}, 2.–10. ödülleri en az ${minAll} katılımda verilir`;
  if (total === 0) return `Bugün henüz kimse katılmadı. ${kural}; daha az katılımda puanı olan herkes katılım ödülü alır.`;
  const once = `Bugün şu ana kadar ${fmtNum(total)} kişi katıldı; ${kural}.`;
  if (total < minFirst) return `${once} Gün böyle biterse puanı olan herkese katılım ödülü.`;
  if (total < minAll) return `${once} Gün böyle biterse 1.'ye sıra ödülü, diğer herkese katılım ödülü.`;
  return `${once} Sıra ödülleri geçerli.`;
}

export function Board({ rows, meId, empty }: { rows: RankRow[]; meId?: string; empty: string }) {
  if (!rows.length) return <div className="card muted">{empty}</div>;
  return (
    <ol className="ev-board" data-testid="siralama">
      {rows.map((r) => (
        <li key={r.id} className={`${r.id === meId ? 'me' : ''}${r.rank <= 3 && r.score > 0 ? ` top${r.rank}` : ''}`} data-name={r.name} data-rank={r.rank}>
          <span className="ev-rk">{r.score <= 0 ? '—' : r.rank <= 3 ? <Art name={(['medal1', 'medal2', 'medal3'] as const)[r.rank - 1]!} size={22} /> : r.rank}</span>
          <OdiAvatar color={r.color} size={30} />
          <b className="grow ellipsis">{r.name}{r.id === meId ? ' (sen)' : ''}</b>
          <span className="qn">{fmtNum(r.score)}</span>
        </li>
      ))}
    </ol>
  );
}
