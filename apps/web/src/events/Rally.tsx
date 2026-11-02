import { useEffect, useRef, useState } from 'react';
import { RALLY_MAX_PER_PLAYER, RALLY_MONSTERS, RALLY_RULES, rallyMaxHp, rallyMorePlayersNeeded, rallyPlayersNeeded, rallyReachable, rallyShownName, type RallyMonsterDef, type RallyMonsterId, type RallyState } from '@odi/shared';
import { useNet } from '@odi/net/store';
import { platform } from '../platform';
import { celebrate } from '../celebrate';
import { OdiAvatar } from '../ui/OdiAvatar';
import { Bar } from '../ui/bits';
import { Sheet, fmtNum, fmtTime } from '../ui/social';
import { evNet, useEvents } from './store';
import { Countdown, Rewards, errText, eventSpec, levelName, useSrvNow } from './common';
import type { PlayFn } from './EventsScreen';
import { MonsterArt } from './MonsterArt';
import { Art, rich } from '../ui/art';
import { TeammateCall } from './Call';
import '../race/race.css'; // race-dots / race-live / race-actions: yarış ekranları açılmadan da stilli (YN-026)

/**
 * Dürüst bilgi (YN-116): bu canı yenmek için en az kaç kişinin bütün hakları gerekir (herkes her koşuyu 3 yıldızla bitirse bile).
 * Can formülü sahip kararı 43'ü bekliyor; burada yalnız söylenir.
 */
function needText(hp: number): string {
  const n = rallyPlayersNeeded(hp);
  return n > RALLY_RULES.minPlayers
    ? `Yenmek için en az ${n} kişinin ${RALLY_RULES.triesPerPlayer} hakkı gerekir (kişi başı en çok ${RALLY_MAX_PER_PLAYER} hasar).`
    : `Yenmek için ${RALLY_RULES.minPlayers} kişi yetebilir (kişi başı ${RALLY_RULES.triesPerPlayer} hak, en çok ${RALLY_MAX_PER_PLAYER} hasar).`;
}

/** davet ya da sohbet kartının açtığı ralli (rallyId): o ralli yüklenir; biten ralli sonucuyla görünür, takımın başka rallisi açılmaz */
function useFocusRally(rallyId: string | undefined): { focus: string | null; rally: RallyState | null; loading: boolean; clear: () => void } {
  const [st, setSt] = useState<{ id: string; rally: RallyState | null; loaded: boolean } | null>(rallyId ? { id: rallyId, rally: null, loaded: false } : null);
  const live = useEvents((s) => s.rally);
  useEffect(() => {
    if (!rallyId) return;
    let on = true;
    const done = (rally: RallyState | null) => { if (on) setSt({ id: rallyId, rally, loaded: true }); };
    void evNet()?.call('rally.state', { rallyId }).then((r) => done(r.rally), () => done(null));
    return () => { on = false; };
  }, [rallyId]);
  if (!st) return { focus: null, rally: null, loading: false, clear: () => undefined };
  // canlı güncelleme: ralli takımın güncel rallisiyse depodaki sürüm
  return { focus: st.id, rally: live?.id === st.id ? live : st.rally, loading: !st.loaded && live?.id !== st.id, clear: () => setSt(null) };
}

/** Ralli odası: canavar seçimi → canlı can barı, katılımcılar, hasar akışı, geri sayım, sonuç kutlaması */
export function RallyView({ onPlay, rallyId }: { onPlay: PlayFn; rallyId?: string }) {
  const teamRally = useEvents((s) => s.rally); const left = useEvents((s) => s.rallyStartsLeft);
  const focus = useFocusRally(rallyId);
  const rally = focus.focus ? focus.rally : teamRally;
  const me = useNet((s) => s.me); const team = useNet((s) => s.team);
  const now = useSrvNow(500);
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const prevHp = useRef<number | null>(null); const [hit, setHit] = useState<number>(0);
  const celebrated = useRef<string | null>(null);
  const members = team?.members ?? 2;

  useEffect(() => {
    if (!rally) return;
    if (prevHp.current != null && rally.hp < prevHp.current) { setHit(prevHp.current - rally.hp); platform().haptic('medium'); const h = setTimeout(() => setHit(0), 1300); prevHp.current = rally.hp; return () => clearTimeout(h); }
    prevHp.current = rally.hp;
  }, [rally?.hp]);
  useEffect(() => {
    if (rally?.status !== 'kazanildi' || celebrated.current === rally.id || !rally.participants.some((p) => p.id === me?.id)) return;
    celebrated.current = rally.id;
    const m = RALLY_MONSTERS.find((x) => x.id === rally.monster)!;
    void celebrate.chest({ title: `${m.name} yenildi!`, items: m.reward.map((r) => ({ kind: r.kind, amount: r.amount, ref: r.ref })), tier: m.id === 'yanki-hayaleti' ? 'altin' : m.id === 'cinlama-cini' ? 'gumus' : 'bronz' });
  }, [rally?.status, rally?.id]);

  const act = async (fn: () => Promise<unknown>) => { setBusy(true); setErr(null); try { await fn(); } catch (e) { setErr(errText(e)); platform().haptic('error'); } setBusy(false); };
  const start = (id: RallyMonsterId) => act(async () => { const r = await evNet()!.call('rally.start', { monster: id }); useEvents.setState((s) => ({ rally: r.rally, rallyStartsLeft: Math.max(0, s.rallyStartsLeft - 1) })); platform().haptic('heavy'); });

  // "Yeni ralli": kart açtıysa takımın kendi rallisine dön (açık bir ralli varsa o görünür), yoksa seçim
  const fresh = () => { focus.clear(); if (!focus.focus || !teamRally || teamRally.id === focus.focus) useEvents.setState({ rally: null }); };
  if (focus.focus && focus.loading) return <div className="card muted" data-testid="ralli-yukleniyor">Ralli yükleniyor…</div>;
  if (focus.focus && !rally) return (
    <div className="stack">
      <div className="card ev-wait" data-testid="ralli-davet-yok"><b>Bu ralli artık açık değil</b><span className="muted small-note">Davetin rallisi bulunamadı ya da takımının değil.</span></div>
      <button className="btn ghost" onClick={fresh}>Takımının rallisine git</button>
    </div>
  );
  const open = rally && rally.status === 'acik' && rally.endsAt > now;
  if (!rally || (!open && rally.status === 'acik')) return <Picker left={left} members={members} busy={busy} err={err} onStart={start} />;
  const m = RALLY_MONSTERS.find((x) => x.id === rally.monster)!;
  const mine = rally.participants.find((p) => p.id === me?.id);
  const ready = rally.participants.length >= RALLY_RULES.minPlayers;
  const pct = rally.maxHp ? rally.hp / rally.maxHp : 0;
  // katılımcıların kalan haklarıyla erişilebilecek en çok hasar canın altındaysa açıkça söylenir (YN-116)
  const more = open ? rallyMorePlayersNeeded(rally.hp, rally.participants) : 0;
  return (
    <div className="stack ev-rally" data-testid="ralli-oda" data-status={rally.status} data-hp={rally.hp}>
      {err && <div className="ev-err" role="alert">{err}</div>}
      <div className={`ev-stage tone-coral${hit ? ' shake' : ''}${rally.status === 'kazanildi' ? ' won' : ''}${rally.status === 'kaybedildi' ? ' lost' : ''}`}>
        <div className="row between ev-stage-top">
          <span className="ev-tag">{rallyShownName(rally.starterName)} başlattı · {fmtTime(rally.startsAt)}</span>
          {open ? <Countdown to={rally.endsAt} urgentMs={120_000} /> : <span className="ev-tag strong">{rich(rally.status === 'kazanildi' ? '🏆 Kazanıldı' : '💨 Kaçtı')}</span>}
        </div>
        <div className="ev-monster" aria-hidden>
          <span className="ev-mon-glow" />
          <span className="ev-mon-e"><MonsterArt id={m.id} size={136} beaten={rally.status === 'kazanildi'} /></span>
          {hit > 0 && <span className="ev-dmg">−{hit}</span>}
        </div>
        <b className="ev-mon-name">{m.name}</b>
        <div className="ev-hp"><Bar value={pct} tone="coral" label="Canavarın canı" /><span className="qn"><Art e="❤️" size="1.15em" className="art-inline" /> {fmtNum(rally.hp)}/{fmtNum(rally.maxHp)}</span></div>
        <div className="ev-parts">
          {rally.participants.map((p) => (
            <div key={p.id} className={`ev-part${p.id === me?.id ? ' me' : ''}`} title={rallyShownName(p.name)}>
              <OdiAvatar color={p.color} hat={p.hat} size={40} mood={p.damage > 0 ? 'wow' : 'happy'} />
              <b className="ellipsis">{rallyShownName(p.name)}</b><small><Art e="⚔️" size="1.15em" className="art-inline" /> {p.damage}</small>
            </div>
          ))}
          {open && Array.from({ length: Math.max(0, RALLY_RULES.minPlayers - rally.participants.length) }, (_, i) => <div key={`b${i}`} className="ev-part empty"><span>＋</span><small>Bekleniyor</small></div>)}
        </div>
      </div>

      {more > 0 && (
        <div className="card ev-warn" role="status" data-testid="ralli-yetmez">
          <b>Bu katılımla canavar yenilemez</b>
          <span className="small-note">{rally.participants.length} katılımcının kalan haklarıyla en çok {fmtNum(rallyReachable(rally.participants))} hasar verilebilir; canavarın canı {fmtNum(rally.hp)}. Yenmek için en az {more} kişi daha katılmalı.</span>
        </div>
      )}
      {open && !mine && <button className="btn coral ev-big" data-testid="ralli-katil" disabled={busy} onClick={() => void act(async () => { const r = await evNet()!.call('rally.join', { rallyId: rally.id }); useEvents.setState({ rally: r.rally }); platform().haptic('heavy'); })}><Art e="🔥" size="1.15em" className="art-inline" /> Ralliye katıl</button>}
      {open && mine && !ready && (
        <div className="card ev-wait" data-testid="ralli-bekleme"><span className="race-dots" aria-hidden><i /><i /><i /></span><b>Takım arkadaşları bekleniyor</b>
          {/* kural açık: süre başlatınca işler; kimse gelmezse ralli sayılmaz, günlük hak geri verilir (sunucu: rallyStartsLeft) */}
          <span className="muted small-note" data-testid="ralli-kural">Saldırı, bir takım arkadaşın daha katılınca açılır (en az {RALLY_RULES.minPlayers} kişi). Süre başlattığın an işlemeye başladı; süre dolana dek kimse katılmazsa bu ralli sayılmaz, takımın günlük ralli hakkı geri verilir. Takımına bildirim gitti.</span>
          <RallyCall rallyId={rally.id} title={m.name} joined={rally.participants.map((p) => p.id)} /></div>
      )}
      {open && mine && ready && <RallyCall rallyId={rally.id} title={m.name} joined={rally.participants.map((p) => p.id)} />}
      {open && mine && ready && (
        <button className="btn ev-big" data-testid="ralli-saldir" disabled={mine.tries >= RALLY_RULES.triesPerPlayer} onClick={() => onPlay(eventSpec(m.level, rally.salt), { kind: 'ralli', rallyId: rally.id })}>
          <Art e="⚔️" size="1.15em" className="art-inline" /> Saldır! · {m.level}. {levelName(m.level)} <small>({RALLY_RULES.triesPerPlayer - mine.tries} hak)</small>
        </button>
      )}
      {rally.status === 'kazanildi' && <div className="card cream ev-result"><b><Art e="🏆" size="1.15em" className="art-inline" /> {m.name} yenildi!</b><span>Katılan herkese:</span><Rewards items={m.reward} /><small>Takıma +{m.teamXp} XP · Düelloya +{RALLY_RULES.duelPoints} puan/kişi</small></div>}
      {!open && <button className="btn ghost" onClick={fresh}>Yeni ralli</button>}

      <div className="card">
        <b>Hasar akışı</b>
        {rally.hits.length === 0 ? <div className="muted small-note" data-testid="ralli-akis-bos">{!open ? 'Bu rallide hiç darbe vurulmadı.' : ready ? 'Henüz darbe yok. İlk vuruş senden olsun!' : !mine && rally.participants.length + 1 >= RALLY_RULES.minPlayers ? 'Sen katılınca saldırı açılır.' : 'Bir takım arkadaşın katılınca saldırı açılır.'}</div> : (
          <ul className="ev-feed">{rally.hits.map((h, i) => <li key={`${h.at}-${i}`}><span className="grow ellipsis">{rich(h.completed ? '⭐'.repeat(Math.max(1, h.stars)) : '🩹')} {rallyShownName(h.name)}</span><b className="coral-t">−{h.damage}</b></li>)}</ul>
        )}
      </div>
      <div className="muted small-note">Hasar: bölümü bitirirsen 60 + 30 × yıldız, bitiremezsen 15. Her katılımcının {RALLY_RULES.triesPerPlayer} hakkı var. Süre: {RALLY_RULES.durationMs / 60_000} dk.</div>
    </div>
  );
}

function Picker({ left, members, busy, err, onStart }: { left: number; members: number; busy: boolean; err: string | null; onStart: (id: RallyMonsterId) => void }) {
  const [ask, setAsk] = useState<RallyMonsterDef | null>(null);
  return (
    <div className="stack" data-testid="ralli-secim">
      {err && <div className="ev-err" role="alert">{err}</div>}
      <div className="card ev-intro tone-coral"><b>Canavarını seç, takımını topla!</b><span className="muted">Ralli 10 dakika sürer. En az 2 kişi katılınca herkes canavarın kısa bölümünü oynar; her sonuç hasar verir. Can sıfırlanırsa katılan herkes ödülü alır. Süre dolana dek kimse katılmazsa ralli sayılmaz, günlük hak geri verilir.</span><span className="ev-tag">Bugün kalan ralli: {left}</span></div>
      {RALLY_MONSTERS.map((m) => (
        <div key={m.id} className="ev-mon-card" data-tone="coral">
          <span className="ev-mon-big" aria-hidden><MonsterArt id={m.id} size={72} /></span>
          <div className="grow min0">
            <b>{m.name}</b>
            <div className="muted small-note">{m.desc}</div>
            <div className="ev-mon-meta"><span><Art e="❤️" size="1.15em" className="art-inline" /> {rallyMaxHp(m, members)} can</span><span><Art e="🗺️" size="1.15em" className="art-inline" /> {m.level}. {levelName(m.level)}</span></div>
            <div className="small-note ev-need" data-testid={`ralli-gerekli-${m.id}`}>{needText(rallyMaxHp(m, members))}</div>
            <Rewards items={m.reward} label="Katılan herkese" />
          </div>
          <button className="btn small coral" data-testid={`ralli-baslat-${m.id}`} disabled={busy || left <= 0} onClick={() => setAsk(m)}>Başlat</button>
        </div>
      ))}
      {ask && (
        <Sheet title={`${ask.name} rallisini başlat`} onClose={() => setAsk(null)}>
          <div className="stack" data-testid="ralli-onay">
            <span className="muted">Takımının bugünkü canı: <b>{fmtNum(rallyMaxHp(ask, members))}</b> ({members} üye). Ralli {RALLY_RULES.durationMs / 60_000} dakika sürer; saldırı en az {RALLY_RULES.minPlayers} kişi katılınca açılır.</span>
            <b className="ev-need" data-testid="ralli-onay-gerekli">{needText(rallyMaxHp(ask, members))}</b>
            <span className="muted small-note">Bugün kalan ralli: {left}. Süre dolana dek kimse katılmazsa ralli sayılmaz.</span>
            <button className="btn coral" data-testid="ralli-onay-baslat" disabled={busy} onClick={() => { const id = ask.id; setAsk(null); onStart(id); }}>Başlat</button>
            <button className="btn ghost" onClick={() => setAsk(null)}>Vazgeç</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** Ralliye takım arkadaşını özel mesajla çağır (DM davet kartı → Etkinlikler › Ralli); çevrimiçiler üstte */
function RallyCall({ rallyId, title, joined }: { rallyId: string; title: string; joined: string[] }) {
  return <TeammateCall joined={joined} testId="ralli-cagir" label="Takım arkadaşını çağır" sheetTitle="Kimi ralliye çağıralım?" note="Özel mesajla davet kartı gider; dokununca ralli açılır."
    text={`Ralliye katıl! ${title} seni bekliyor`} meta={{ type: 'ralli', roomId: rallyId, title }} />;
}
