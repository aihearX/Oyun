import { useEffect, useRef, useState } from 'react';
import { RALLY_MAX_PER_PLAYER, RALLY_MONSTERS, RALLY_RULES, rallyMaxHp, rallyPerPlayerNeed, rallyReachable, rallyRewardReason, rallyShownName, type InboxItem, type RallyCall, type RallyMonsterDef, type RallyMonsterId, type RallyState } from '@odi/shared';
import { useNet } from '@odi/net/store';
import { platform } from '../platform';
import { celebrate } from '../celebrate';
import { claimInboxItem, toast } from '../net';
import { OdiAvatar } from '../ui/OdiAvatar';
import { Bar } from '../ui/bits';
import { Sheet, fmtNum, fmtTime } from '../ui/social';
import { evNet, refreshEvents, useEvents } from './store';
import { Countdown, Rewards, errText, eventSpec, levelName, useSrvNow } from './common';
import type { PlayFn } from './EventsScreen';
import { MonsterArt } from './MonsterArt';
import { Art, rich } from '../ui/art';
import { TeammateCall } from './Call';
import { Icon } from '../ui/icons';
import '../race/race.css'; // race-dots / race-live / race-actions: yarış ekranları açılmadan da stilli (YN-026)

/**
 * Dürüst bilgi (YN-116, karar 43 / YN-117): can katılımcı sayısına göre; kaç kişiyle ne kadar can olduğu ve kişi başına
 * ortalama ne kadar hasar gerektiği söylenir (en az 2 kişiyle de, kalabalıkla da tam güçle yenilebilir: ralli.test.ts).
 */
function hpText(m: RallyMonsterDef): string {
  const n = RALLY_RULES.minPlayers;
  return `Can katılımcıya göre: ${n} kişiyle ${fmtNum(rallyMaxHp(m, n))}, her yeni katılımcı +${m.hpPerMember}. ${n} kişide kişi başı ortalama ${rallyPerPlayerNeed(m, n)} hasar gerekir (en çok ${RALLY_MAX_PER_PLAYER}).`;
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
  const me = useNet((s) => s.me);
  const now = useSrvNow(500);
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const prevHp = useRef<number | null>(null); const [hit, setHit] = useState<number>(0);
  const celebrated = useRef<string | null>(null);

  useEffect(() => {
    if (!rally) return;
    if (prevHp.current != null && rally.hp < prevHp.current) { setHit(prevHp.current - rally.hp); platform().haptic('medium'); const h = setTimeout(() => setHit(0), 1300); prevHp.current = rally.hp; return () => clearTimeout(h); }
    prevHp.current = rally.hp;
  }, [rally?.hp]);
  useEffect(() => {
    if (rally?.status !== 'kazanildi' || celebrated.current === rally.id || !rally.participants.some((p) => p.id === me?.id)) return;
    celebrated.current = rally.id;
    void rallyChest(rally);
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
  if (!rally || (!open && rally.status === 'acik')) return <Picker left={left} busy={busy} err={err} onStart={start} />;
  const m = RALLY_MONSTERS.find((x) => x.id === rally.monster)!;
  const mine = rally.participants.find((p) => p.id === me?.id);
  const ready = rally.participants.length >= RALLY_RULES.minPlayers;
  const pct = rally.maxHp ? rally.hp / rally.maxHp : 0;
  // saldırı başladıktan sonra katılım kapalı: katılımcıların kalan haklarıyla erişilebilecek en çok hasar canın altındaysa açıkça söylenir (YN-116, YN-117)
  const reach = rallyReachable(rally.participants);
  const lost = open && reach < rally.hp;
  const lateClosed = open && rally.attackStarted && !mine;
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
        <span className="small-note ev-hp-basis" data-testid="ralli-can-temel">{rally.attackStarted || !open
          ? `Can ${fmtNum(rally.maxHp)}: saldırı başladığında ${rally.hpPlayers} katılımcıya göre sabitlendi.`
          : `Can ${fmtNum(rally.maxHp)}: şu an ${rally.hpPlayers} katılımcıya göre. Katılan her kişi +${m.hpPerMember} ekler; ilk vuruşta sabitlenir, sonra yeni katılım kapanır.`}</span>
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

      {lost && (
        <div className="card ev-warn" role="status" data-testid="ralli-yetmez">
          <b>Bu ralli artık kazanılamaz</b>
          <span className="small-note">{rally.participants.length} katılımcının kalan haklarıyla en çok {fmtNum(reach)} hasar verilebilir; canavarın kalan canı {fmtNum(rally.hp)}. Saldırı başladığı için yeni katılım kapalı.</span>
        </div>
      )}
      {lateClosed && (
        <div className="card ev-wait" data-testid="ralli-katilim-kapali"><b>Saldırı başladı</b>
          <span className="muted small-note">Can {rally.hpPlayers} katılımcıya göre sabitlendi; bu ralliye artık katılınamaz. Bir sonraki ralliye katılabilirsin.</span></div>
      )}
      {open && !mine && !rally.attackStarted && <button className="btn coral ev-big" data-testid="ralli-katil" disabled={busy} onClick={() => void act(async () => { const r = await evNet()!.call('rally.join', { rallyId: rally.id }); useEvents.setState({ rally: r.rally }); platform().haptic('heavy'); })}><Art e="🔥" size="1.15em" className="art-inline" /> Ralliye katıl</button>}
      {open && mine && !ready && (
        <div className="card ev-wait" data-testid="ralli-bekleme"><span className="race-dots" aria-hidden><i /><i /><i /></span><b>Takım arkadaşları bekleniyor</b>
          {/* kural açık: süre başlatınca işler; kimse gelmezse ralli sayılmaz, günlük hak geri verilir (sunucu: rallyStartsLeft) */}
          <span className="muted small-note" data-testid="ralli-kural">Saldırı, bir takım arkadaşın daha katılınca açılır (en az {RALLY_RULES.minPlayers} kişi). Canavarın canı katılımcı sayısına göre ve ilk vuruşta sabitlenir. Süre başlattığın an işlemeye başladı; süre dolana dek kimse katılmazsa bu ralli sayılmaz, takımın günlük ralli hakkı geri verilir. Takımına bildirim gitti.</span>
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
        {rally.hits.length === 0 ? <div className="muted small-note" data-testid="ralli-akis-bos">{!open ? 'Bu rallide hiç darbe vurulmadı.' : ready ? 'Henüz darbe yok. İlk vuruş canı sabitler ve yeni katılımı kapatır.' : !mine && rally.participants.length + 1 >= RALLY_RULES.minPlayers ? 'Sen katılınca saldırı açılır.' : 'Bir takım arkadaşın katılınca saldırı açılır.'}</div> : (
          <ul className="ev-feed">{rally.hits.map((h, i) => <li key={`${h.at}-${i}`}><span className="grow ellipsis">{rich(h.completed ? '⭐'.repeat(Math.max(1, h.stars)) : '🩹')} {rallyShownName(h.name)}</span><b className="coral-t">−{h.damage}</b></li>)}</ul>
        )}
      </div>
      <div className="muted small-note">Hasar: bölümü bitirirsen 60 + 30 × yıldız, bitiremezsen 15. Her katılımcının {RALLY_RULES.triesPerPlayer} hakkı var. Süre: {RALLY_RULES.durationMs / 60_000} dk.</div>
    </div>
  );
}

/** bu rallinin ödül kutusu satırları (sunucu kazanınca yazar: rallyRewardReason + kazanma anı); bağlı değilse null */
async function rallyInboxRows(rally: RallyState, m: RallyMonsterDef): Promise<InboxItem[] | null> {
  const c = evNet(); const wonAt = rally.wonAt;
  if (!c || c.status !== 'bağlı' || wonAt == null) return null;
  try {
    const { items } = await c.call('inbox.list', {});
    return items.filter((i) => i.reason === rallyRewardReason(m.name) && i.at >= wonAt && i.at < wonAt + 60_000);
  } catch { return null; }
}

/**
 * Kazanma sandığı (OT-ekonomi-denetci-32): sunucu ödülü ödül kutusuna yazar; "Topla" o rallinin satırlarını mevcut `inbox.claim` ile
 * gerçekten alır (sayaç uçuş bitene dek eski değerde tutulur, sonra sunucu cüzdanı). Alınmış satır ikinci kez yazılmaz (idempotent:
 * Ödül kutusundan önce alındıysa ya da bugünkü ralli ödülü dolduysa satır yoktur, sandık da açılmaz). Bağlı değilsek jeton uçmaz,
 * not dürüst: "Bağlanınca Ödül kutundan alınır".
 */
async function rallyChest(rally: RallyState): Promise<void> {
  const m = RALLY_MONSTERS.find((x) => x.id === rally.monster)!;
  const title = `${m.name} yenildi!`; const tier = m.id === 'yanki-hayaleti' ? 'altin' : m.id === 'cinlama-cini' ? 'gumus' : 'bronz';
  const rows = await rallyInboxRows(rally, m);
  if (rows === null) { await celebrate.chest({ title, items: m.reward.map((r) => ({ kind: r.kind, amount: r.amount, ref: r.ref })), tier, granted: true, note: 'Bağlanınca Ödül kutundan alınır' }); return; }
  if (!rows.length) return;
  const shown = celebrate.chest({ title, items: rows.map((r) => ({ kind: r.kind, amount: r.amount, ref: r.ref })), tier });
  const got = await Promise.all(rows.map((r) => claimInboxItem(r.id)));
  await shown;
  // Etkinlikler kartı oyuncunun ödülünü sunucudan okur ("ödülün cüzdanında" / "ödül kutunda", YN-171)
  void refreshEvents();
  if (got.some((x) => !x)) toast('📬', 'Ödülün bir kısmı Ödül kutunda', 'Profil › Ödül kutusu’ndan alabilirsin.', 'bronze');
}

function Picker({ left, busy, err, onStart }: { left: number; busy: boolean; err: string | null; onStart: (id: RallyMonsterId) => void }) {
  const [ask, setAsk] = useState<RallyMonsterDef | null>(null);
  return (
    <div className="stack" data-testid="ralli-secim">
      {err && <div className="ev-err" role="alert">{err}</div>}
      <div className="card ev-intro tone-coral"><b>Canavarını seç, takımını topla!</b><span className="muted">Ralli 10 dakika sürer. En az 2 kişi katılınca herkes canavarın kısa bölümünü oynar; her sonuç hasar verir. Canavarın canı katılan kişi sayısına göredir ve ilk vuruşta sabitlenir; saldırı başlayınca yeni katılım kapanır. Can sıfırlanırsa katılan herkes ödülü alır. Süre dolana dek kimse katılmazsa ralli sayılmaz, günlük hak geri verilir.</span><span className="ev-tag">Bugün kalan ralli: {left}</span></div>
      {RALLY_MONSTERS.map((m) => (
        <div key={m.id} className="ev-mon-card" data-tone="coral">
          <span className="ev-mon-big" aria-hidden><MonsterArt id={m.id} size={72} /></span>
          <div className="grow min0">
            <b>{m.name}</b>
            <div className="muted small-note">{m.desc}</div>
            <div className="ev-mon-meta"><span><Art e="❤️" size="1.15em" className="art-inline" /> {fmtNum(rallyMaxHp(m, RALLY_RULES.minPlayers))} can ({RALLY_RULES.minPlayers} kişiyle)</span><span><Art e="🗺️" size="1.15em" className="art-inline" /> {m.level}. {levelName(m.level)}</span></div>
            <div className="small-note ev-need" data-testid={`ralli-gerekli-${m.id}`}>{hpText(m)}</div>
            <Rewards items={m.reward} label="Katılan herkese" />
          </div>
          <button className="btn small coral" data-testid={`ralli-baslat-${m.id}`} disabled={busy || left <= 0} onClick={() => setAsk(m)}>Başlat</button>
        </div>
      ))}
      {ask && (
        <Sheet title={`${ask.name} rallisini başlat`} onClose={() => setAsk(null)}>
          <div className="stack" data-testid="ralli-onay">
            <span className="muted">Canavarın canı katılan kişi sayısına göre: {Array.from({ length: 4 }, (_, i) => RALLY_RULES.minPlayers + i).map((n) => `${n} kişiyle ${fmtNum(rallyMaxHp(ask, n))}`).join(', ')}. İlk vuruşta sabitlenir; saldırı başlayınca yeni katılım kapanır. Ralli {RALLY_RULES.durationMs / 60_000} dakika sürer; saldırı en az {RALLY_RULES.minPlayers} kişi katılınca açılır.</span>
            <b className="ev-need" data-testid="ralli-onay-gerekli">{hpText(ask)}</b>
            <span className="muted small-note">Bugün kalan ralli: {left}. Süre dolana dek kimse katılmazsa ralli sayılmaz.</span>
            <button className="btn coral" data-testid="ralli-onay-baslat" disabled={busy} onClick={() => { const id = ask.id; setAsk(null); onStart(id); }}>Başlat</button>
            <button className="btn ghost" onClick={() => setAsk(null)}>Vazgeç</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

/** çağrılanın durumu (YN-224): katıldıysa "katıldı", değilse davetin okunup okunmadığı (sunucu: özel mesajdaki çift tikle aynı kaynak) */
export const rallyCallState = (c: Pick<RallyCall, 'seen'>, joined: boolean): string => (joined ? 'katıldı' : c.seen ? 'gördü' : 'henüz görmedi');

/** bu ralliye benim çağırdıklarım (sunucu `rally.calls`); çağrılan daveti okuyunca gelen 'dm.read' ile ve yeni davette yenilenir */
function useRallyCalls(rallyId: string): { calls: RallyCall[]; refresh: () => void } {
  const [calls, setCalls] = useState<RallyCall[]>([]); const [n, setN] = useState(0);
  const ids = useRef<string[]>([]); ids.current = calls.map((c) => c.id);
  useEffect(() => {
    let on = true;
    void evNet()?.call('rally.calls', { rallyId }).then((r) => { if (on) setCalls(r.calls); }, () => undefined);
    return () => { on = false; };
  }, [rallyId, n]);
  useEffect(() => evNet()?.on('dm.read', ({ by }) => { if (ids.current.includes(by)) setN((x) => x + 1); }), []);
  return { calls, refresh: () => setN((x) => x + 1) };
}

/**
 * Ralliye takım arkadaşını özel mesajla çağır (DM davet kartı → Etkinlikler › Ralli); çevrimiçiler üstte. Altında kimin çağrıldığı ve
 * davetin görülüp görülmediği (OT-takim-kaptani-39): "Çağrıldı: Hesapli · gördü / henüz görmedi". Tahmin ya da sahte "gördü" yok.
 */
function RallyCall({ rallyId, title, joined }: { rallyId: string; title: string; joined: string[] }) {
  const { calls, refresh } = useRallyCalls(rallyId);
  return (
    <>
      <TeammateCall joined={joined} testId="ralli-cagir" label="Takım arkadaşını çağır" sheetTitle="Kimi ralliye çağıralım?" note="Özel mesajla davet kartı gider; dokununca ralli açılır."
        text={`Ralliye katıl! ${title} seni bekliyor`} meta={{ type: 'ralli', roomId: rallyId, title }} onSent={refresh} />
      {calls.length > 0 && (
        <ul className="ev-calls" data-testid="ralli-cagrilar">
          {calls.map((c) => { const st = rallyCallState(c, joined.includes(c.id)); return (
            <li key={c.id} data-testid="ralli-cagrilan" data-durum={st}>
              <span className="min0">Çağrıldı: <b>{rallyShownName(c.name)}</b></span>
              <span className={`ev-call-st${st === 'henüz görmedi' ? ' muted' : ''}`}>· {st !== 'henüz görmedi' && <Icon name="check" size="1em" className="ic-inline" />}{st}</span>
            </li>); })}
        </ul>
      )}
    </>
  );
}
