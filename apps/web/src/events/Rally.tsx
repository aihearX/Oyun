import { useEffect, useRef, useState } from 'react';
import { RALLY_MONSTERS, RALLY_RULES, rallyMaxHp, type RallyMonsterId } from '@odi/shared';
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
import { Icon } from '../ui/icons';
import '../race/race.css'; // race-dots / race-live / race-actions: yarış ekranları açılmadan da stilli (YN-026)

/** Ralli odası: canavar seçimi → canlı can barı, katılımcılar, hasar akışı, geri sayım, sonuç kutlaması */
export function RallyView({ onPlay }: { onPlay: PlayFn }) {
  const rally = useEvents((s) => s.rally); const left = useEvents((s) => s.rallyStartsLeft);
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

  const open = rally && rally.status === 'acik' && rally.endsAt > now;
  if (!rally || (!open && rally.status === 'acik')) return <Picker left={left} members={members} busy={busy} err={err} onStart={start} />;
  const m = RALLY_MONSTERS.find((x) => x.id === rally.monster)!;
  const mine = rally.participants.find((p) => p.id === me?.id);
  const ready = rally.participants.length >= RALLY_RULES.minPlayers;
  const pct = rally.maxHp ? rally.hp / rally.maxHp : 0;
  return (
    <div className="stack ev-rally" data-testid="ralli-oda" data-status={rally.status} data-hp={rally.hp}>
      {err && <div className="ev-err" role="alert">{err}</div>}
      <div className={`ev-stage tone-coral${hit ? ' shake' : ''}${rally.status === 'kazanildi' ? ' won' : ''}${rally.status === 'kaybedildi' ? ' lost' : ''}`}>
        <div className="row between ev-stage-top">
          <span className="ev-tag">{rally.starterName} başlattı · {fmtTime(rally.startsAt)}</span>
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
            <div key={p.id} className={`ev-part${p.id === me?.id ? ' me' : ''}`} title={p.name}>
              <OdiAvatar color={p.color} hat={p.hat} size={40} mood={p.damage > 0 ? 'wow' : 'happy'} />
              <b className="ellipsis">{p.name}</b><small><Art e="⚔️" size="1.15em" className="art-inline" /> {p.damage}</small>
            </div>
          ))}
          {open && Array.from({ length: Math.max(0, RALLY_RULES.minPlayers - rally.participants.length) }, (_, i) => <div key={`b${i}`} className="ev-part empty"><span>＋</span><small>Bekleniyor</small></div>)}
        </div>
      </div>

      {open && !mine && <button className="btn coral ev-big" data-testid="ralli-katil" disabled={busy} onClick={() => void act(async () => { const r = await evNet()!.call('rally.join', { rallyId: rally.id }); useEvents.setState({ rally: r.rally }); platform().haptic('heavy'); })}><Art e="🔥" size="1.15em" className="art-inline" /> Ralliye katıl</button>}
      {open && mine && !ready && <div className="card ev-wait" data-testid="ralli-bekleme"><span className="race-dots" aria-hidden><i /><i /><i /></span><b>Takım arkadaşları bekleniyor</b><span className="muted small-note">Saldırı için en az {RALLY_RULES.minPlayers} katılımcı gerekli. Takımına bildirim gitti!</span><RallyCall rallyId={rally.id} title={m.name} joined={rally.participants.map((p) => p.id)} /></div>}
      {open && mine && ready && <RallyCall rallyId={rally.id} title={m.name} joined={rally.participants.map((p) => p.id)} />}
      {open && mine && ready && (
        <button className="btn ev-big" data-testid="ralli-saldir" disabled={mine.tries >= RALLY_RULES.triesPerPlayer} onClick={() => onPlay(eventSpec(m.level, rally.salt), { kind: 'ralli', rallyId: rally.id })}>
          <Art e="⚔️" size="1.15em" className="art-inline" /> Saldır! · {m.level}. {levelName(m.level)} <small>({RALLY_RULES.triesPerPlayer - mine.tries} hak)</small>
        </button>
      )}
      {rally.status === 'kazanildi' && <div className="card cream ev-result"><b><Art e="🏆" size="1.15em" className="art-inline" /> {m.name} yenildi!</b><span>Katılan herkese:</span><Rewards items={m.reward} /><small>Takıma +{m.teamXp} XP · Düelloya +{RALLY_RULES.duelPoints} puan/kişi</small></div>}
      {!open && <button className="btn ghost" onClick={() => useEvents.setState({ rally: null })}>Yeni ralli</button>}

      <div className="card">
        <b>Hasar akışı</b>
        {rally.hits.length === 0 ? <div className="muted small-note">Henüz darbe yok. İlk vuruş senden olsun!</div> : (
          <ul className="ev-feed">{rally.hits.map((h, i) => <li key={`${h.at}-${i}`}><span className="grow ellipsis">{rich(h.completed ? '⭐'.repeat(Math.max(1, h.stars)) : '🩹')} {h.name}</span><b className="coral-t">−{h.damage}</b></li>)}</ul>
        )}
      </div>
      <div className="muted small-note">Hasar: bölümü bitirirsen 60 + 30 × yıldız, bitiremezsen 15. Her katılımcının {RALLY_RULES.triesPerPlayer} hakkı var. Süre: {RALLY_RULES.durationMs / 60_000} dk.</div>
    </div>
  );
}

function Picker({ left, members, busy, err, onStart }: { left: number; members: number; busy: boolean; err: string | null; onStart: (id: RallyMonsterId) => void }) {
  return (
    <div className="stack" data-testid="ralli-secim">
      {err && <div className="ev-err" role="alert">{err}</div>}
      <div className="card ev-intro tone-coral"><b>Canavarını seç, takımını topla!</b><span className="muted">Ralli 10 dakika sürer. En az 2 kişi katılınca herkes canavarın kısa bölümünü oynar; her sonuç hasar verir. Can sıfırlanırsa katılan herkes ödülü alır.</span><span className="ev-tag">Bugün kalan ralli: {left}</span></div>
      {RALLY_MONSTERS.map((m) => (
        <div key={m.id} className="ev-mon-card" data-tone="coral">
          <span className="ev-mon-big" aria-hidden><MonsterArt id={m.id} size={72} /></span>
          <div className="grow min0">
            <b>{m.name}</b>
            <div className="muted small-note">{m.desc}</div>
            <div className="ev-mon-meta"><span><Art e="❤️" size="1.15em" className="art-inline" /> {rallyMaxHp(m, members)} can</span><span><Art e="🗺️" size="1.15em" className="art-inline" /> {m.level}. {levelName(m.level)}</span></div>
            <Rewards items={m.reward} label="Katılan herkese" />
          </div>
          <button className="btn small coral" data-testid={`ralli-baslat-${m.id}`} disabled={busy || left <= 0} onClick={() => onStart(m.id)}>Başlat</button>
        </div>
      ))}
    </div>
  );
}

/** Ralliye takım arkadaşını özel mesajla çağır (DM davet kartı → Etkinlikler › Ralli) */
export function RallyCall({ rallyId, title, joined }: { rallyId: string; title: string; joined: string[] }) {
  const team = useNet((s) => s.team); const me = useNet((s) => s.me);
  const [open, setOpen] = useState(false); const [sent, setSent] = useState<Record<string, string>>({});
  const list = (team?.roster ?? []).filter((m) => m.id !== me?.id && !joined.includes(m.id));
  if (!list.length) return null;
  const call = async (to: string) => {
    try { await evNet()!.call('dm.send', { to, text: `Ralliye katıl! ${title} seni bekliyor 🔥`, kind: 'davet', meta: { type: 'ralli', roomId: rallyId, title } }); setSent((s) => ({ ...s, [to]: 'ok' })); platform().haptic('light'); }
    catch (e) { setSent((s) => ({ ...s, [to]: errText(e) })); }
  };
  return (
    <>
      <button className="btn ghost small" data-testid="ralli-cagir" onClick={() => setOpen(true)}><Art e="📨" size="1.15em" className="art-inline" /> Takım arkadaşını çağır</button>
      {open && (
        <Sheet title="Kimi ralliye çağıralım?" onClose={() => setOpen(false)}>
          <div className="muted small-note">Özel mesajla davet kartı gider; dokununca ralli açılır.</div>
          {list.map((m) => (
            <div key={m.id} className="ev-pass">
              <OdiAvatar color={m.color} hat={m.hat} size={36} /><b className="grow ellipsis">{m.name}</b>
              {sent[m.id] === 'ok' ? <span className="ev-tag">Gönderildi <Icon name="check" size="1.1em" className="ic-inline" /></span> : <button className="btn small" onClick={() => void call(m.id)}>Çağır</button>}
              {sent[m.id] && sent[m.id] !== 'ok' && <small className="ev-note" style={{ flexBasis: '100%' }}>{sent[m.id]}</small>}
            </div>
          ))}
        </Sheet>
      )}
    </>
  );
}
