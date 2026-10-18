import type { ReactNode } from 'react';
import type { EventKind } from '@odi/shared';
import { RALLY_MONSTERS } from '@odi/shared';
import { useNet } from '@odi/net/store';
import { OdiAvatar } from '../ui/OdiAvatar';
import { Bar } from '../ui/bits';
import { fmtNum } from '../ui/social';
import { useNav } from '../nav';
import { useEvents } from './store';
import { Countdown, EVENT_META, levelName, useSrvNow } from './common';

/** Etkinlik kartı: renkli bant (etkinliğin vurgu rengi), başlık, kalan süre, içerik, ana düğme */
export function EvCard({ kind, live, clock, cta, ctaTone, onOpen, children, testId }: { kind: EventKind; live?: string | null; clock?: ReactNode; cta?: string; ctaTone?: 'gold' | 'ghost'; onOpen: () => void; children?: ReactNode; testId?: string }) {
  const m = EVENT_META[kind];
  return (
    <div className={`ev-card${live ? ' live' : ''}`} data-tone={m.tone} data-testid={testId ?? `ev-kart-${kind}`}>
      <button className="ev-band" onClick={onOpen} aria-label={`${m.name} ayrıntıları`}>
        <span className="ev-art" aria-hidden>{m.icon}</span>
        <span className="ev-band-t min0"><b className="ellipsis">{m.name}</b><small className="ellipsis">{m.blurb}</small></span>
        {live && <span className="ev-live">{live}</span>}
      </button>
      <div className="ev-body">
        {clock && <div className="ev-clockrow">{clock}</div>}
        {children}
        {cta && <button className={`btn small ev-cta${ctaTone === 'ghost' ? ' ghost' : ''}`} onClick={onOpen}>{cta}</button>}
      </div>
    </div>
  );
}

function Avatars({ list, max = 5 }: { list: { id: string; color: number; hat: string }[]; max?: number }) {
  return <span className="ev-avs">{list.slice(0, max).map((p) => <OdiAvatar key={p.id} color={p.color} hat={p.hat} size={30} />)}{list.length > max && <i>+{list.length - max}</i>}</span>;
}

/** Etkinlik merkezi: tüm aktif/yaklaşan etkinlikler (Whiteout'un etkinlik sekmesi gibi) */
export function Hub({ open }: { open: (k: EventKind) => void }) {
  const s = useEvents(); const me = useNet((x) => x.me); const nav = useNav();
  const now = useSrvNow();
  const meId = me?.id ?? '';
  const r = s.rally?.status === 'acik' && s.rally.endsAt > now ? s.rally : null;
  const rMon = r ? RALLY_MONSTERS.find((m) => m.id === r.monster)! : null;
  const rJoined = !!r?.participants.some((p) => p.id === meId);
  const relayMine = s.relay?.carrier?.id === meId;
  const q = s.quiz && s.quiz.phase !== 'bitti' ? s.quiz : null;
  const duel = s.duel;

  const team: ReactNode[] = [];
  if (s.inTeam) {
    team.push(
      <EvCard key="ralli" kind="ralli" live={r ? 'CANLI' : null} onOpen={() => open('ralli')}
        clock={r ? <Countdown to={r.endsAt} urgentMs={120_000} /> : <span className="ev-note">Bugün {s.rallyStartsLeft} ralli hakkı</span>}
        cta={r ? (rJoined ? (r.participants.length >= 2 ? '⚔️ Saldır' : 'Takım bekleniyor…') : '🔥 Katıl') : '🔥 Ralli başlat'}>
        {r && rMon ? (
          <div className="ev-rally-mini">
            <span className="ev-mon-s" aria-hidden>{rMon.emoji}</span>
            <div className="grow min0"><b className="ellipsis">{rMon.name}</b><div className="row"><Bar value={r.hp / r.maxHp} tone="coral" label="Canavarın canı" /><span className="qn">{fmtNum(r.hp)}/{fmtNum(r.maxHp)}</span></div></div>
            <Avatars list={r.participants} max={3} />
          </div>
        ) : <div className="ev-mons">{RALLY_MONSTERS.map((m) => <span key={m.id} title={m.name}>{m.emoji}</span>)}<small className="muted">3 canavar, en az 2 katılımcı</small></div>}
      </EvCard>,
      <EvCard key="duello" kind="duello" live={duel?.finalPush ? 'SON 2 SAAT' : null} onOpen={() => open('duello')}
        clock={duel?.period ? <Countdown to={duel.period.endsAt} urgentMs={duel.finalPushMs} /> : duel ? <Countdown to={duel.next.startsAt} label="başlamasına" /> : null}
        cta={duel?.status === 'eslesti' ? 'Skoru gör' : undefined} ctaTone="ghost">
        {duel?.status === 'eslesti' && duel.me && duel.rival ? <MiniTug a={duel.me.points} b={duel.rival.points} ea={duel.me.emblem} eb={duel.rival.emblem} />
          : duel?.status === 'araniyor' ? <div className="ev-note">🔎 Rakip aranıyor… Yıldızların şimdiden puan.</div>
          : <div className="ev-note">Haftada 2 düello: Pzt–Çar ve Per–Cmt.</div>}
      </EvCard>,
      <EvCard key="bayrak" kind="bayrak" live={relayMine ? 'BAYRAK SENDE' : null} onOpen={() => open('bayrak')} clock={s.relay ? <Countdown to={s.relay.period.endsAt} /> : null}
        cta={relayMine ? '🏃 Ayağı koş' : s.relay && s.relay.current < 4 && !s.relay.carrier ? '🚩 Bayrağı al' : 'Parkuru gör'} ctaTone={relayMine || (s.relay && !s.relay.carrier && s.relay.current < 4) ? 'gold' : 'ghost'}>
        {s.relay && <div className="ev-flags">{s.relay.legs.map((l, i) => <span key={i} className={`ev-flag${l.firstBy ? ' done' : ''}${i === s.relay!.current ? ' cur' : ''}`}>{l.firstBy ? '🚩' : i + 1}</span>)}
          <small className="muted ellipsis">{s.relay.current >= 4 ? `Toplam ${s.relay.totalSec} sn` : s.relay.carrier ? `Bayrak: ${s.relay.carrier.name}` : `${s.relay.current + 1}. ayak gönüllü bekliyor`}</small></div>}
      </EvCard>,
      <EvCard key="avi" kind="avi" onOpen={() => open('avi')} clock={s.hunt?.period ? <Countdown to={s.hunt.period.endsAt} /> : s.hunt ? <Countdown to={s.hunt.next.startsAt} label="başlamasına" /> : null}
        cta={s.hunt?.song ? '🎶 Şarkıyı dinle' : undefined} ctaTone="ghost">
        {s.hunt?.period ? <div className="row"><Bar value={s.hunt.progress / Math.max(1, s.hunt.target)} tone="amber" label="Melodi" /><span className="qn">♪ {fmtNum(s.hunt.progress)}/{fmtNum(s.hunt.target)}</span></div>
          : <div className="ev-note">Perşembe dinlenme günü; Cuma yeni av!</div>}
      </EvCard>,
      <EvCard key="quiz" kind="quiz" live={q ? (q.phase === 'lobi' ? 'KATILIM AÇIK' : 'CANLI') : null} onOpen={() => open('quiz')}
        clock={q ? (q.phase === 'lobi' ? <Countdown to={q.lobbyEndsAt} label="başlamasına" /> : <span className="ev-note">Soru {(q.question?.index ?? 0) + 1}/10</span>) : s.quizInfo && !s.quizInfo.slotOpen ? <Countdown to={s.quizInfo.nextSlotAt} label="sabit saate" /> : null}
        cta={q ? (q.players.some((p) => p.id === meId) ? 'Yarışmaya dön' : '🧠 Katıl') : s.quizInfo?.canStart ? '🧠 Yarışma başlat' : 'Ayrıntılar'} ctaTone={q || s.quizInfo?.canStart ? 'gold' : 'ghost'}>
        {!q && <div className="ev-note">Her gün 13:00 ve 20:00'de kendiliğinden açılır.</div>}
      </EvCard>,
      <EvCard key="gorev" kind="gorev" onOpen={() => open('gorev')} clock={s.quests ? <Countdown to={s.quests.endsAt} /> : null}>
        {s.quests && <div className="ev-qmini">{s.quests.quests.map((x) => <div key={x.kind} className={`row${x.done ? ' done' : ''}`}><span className="grow min0 ellipsis">{x.done ? '✅' : '◻️'} {x.text}</span><span className="qn">{x.progress}/{x.need}</span></div>)}</div>}
      </EvCard>,
    );
  }
  const ch = s.challenge; const tn = s.tourney;
  return (
    <div className="ev-hub stack">
      {s.fast && <div className="ev-fast">⚡ Test modu: etkinlik süreleri kısaltıldı (saat → dakika)</div>}
      <h2 className="ev-sec">👥 Takım etkinlikleri</h2>
      {s.inTeam ? team : (
        <div className="card ev-join">
          <span className="ev-art big" aria-hidden>🤝</span>
          <b>Ralli, düello, bayrak yarışı, quiz… hepsi takımla!</b>
          <span className="muted">Bir takıma katıl ya da kendi takımını kur; grup etkinlikleri hemen açılır.</span>
          <button className="btn small" onClick={() => nav.tab('team')}>Takım bul</button>
        </div>
      )}
      <h2 className="ev-sec">🙋 Bireysel etkinlikler</h2>
      {ch && (
        <EvCard kind="meydan" onOpen={() => open('meydan')} clock={<Countdown to={ch.endsAt} />} cta={ch.tries < ch.maxTries ? `▶ Oyna (${ch.maxTries - ch.tries} deneme)` : 'Sıralamayı gör'} ctaTone={ch.tries < ch.maxTries ? 'gold' : 'ghost'}>
          <div className="ev-stat-row"><span><small>Bölüm</small><b className="ellipsis">{ch.level}. {levelName(ch.level)}</b></span><span><small>En iyi</small><b>{ch.best != null ? fmtNum(ch.best) : '—'}</b></span><span><small>Sıra</small><b>{ch.rank ? `${ch.rank}/${ch.total}` : '—'}</b></span></div>
        </EvCard>
      )}
      {tn && (
        <EvCard kind="turnuva" onOpen={() => open('turnuva')} clock={<Countdown to={tn.endsAt} />} cta="▶ Turnuva bölümleri" ctaTone="ghost">
          <div className="ev-stat-row"><span><small>Toplam</small><b>{fmtNum(tn.total)}</b></span><span><small>Grup sıran</small><b>{tn.rank ? `${tn.rank}.` : '—'}</b></span><span><small>Oynanan</small><b>{tn.levels.filter((l) => l.best != null).length}/5</b></span></div>
        </EvCard>
      )}
      <div className="muted small-note ev-honest">Tüm puanlar yalnızca oynayarak kazanılır; ödüller sabittir ve önceden yazılıdır. Rakipler ve takım arkadaşları gerçek oyunculardır.</div>
    </div>
  );
}

function MiniTug({ a, b, ea, eb }: { a: number; b: number; ea: string; eb: string }) {
  const p = a + b > 0 ? a / (a + b) : 0.5;
  return (
    <div className="ev-tug mini" aria-label={`Biz ${a}, rakip ${b}`}>
      <span className="ev-tug-e">{ea}</span><b>{fmtNum(a)}</b>
      <div className="ev-tug-bar"><i style={{ width: `${p * 100}%` }} /></div>
      <b>{fmtNum(b)}</b><span className="ev-tug-e">{eb}</span>
    </div>
  );
}
export { MiniTug, Avatars };
