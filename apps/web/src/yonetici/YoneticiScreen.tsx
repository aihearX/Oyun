/**
 * Profil › Admin (1.1.0): yalnız yönetici hesabında görünür (sunucu onayı: admin.state.isAdmin). Sunucu her işlemde ayrıca denetler
 * (apps/server/src/yonetici-ekran.ts). Bölümler: Oyuncular, Mesajlar, Fotoğraflar, Kodlar, Hediye. "Her şey açık" oynama modu
 * en üstteki anahtardadır (varsayılan kapalı). Listeler sayfalıdır (Daha fazla).
 */
import { useEffect, useRef, useState } from 'react';
import { useNet } from '@odi/net/store';
import { photoUrl, type AdminMessage, type AdminPhoto, type AdminPlayerDetail, type AdminPlayerRow, type AdminReport } from '@odi/shared';
import { act, errText, getNet, toast } from '../net';
import { platform } from '../platform';
import { ScreenHead } from '../ui/bits';
import { Sheet, fmtNum } from '../ui/social';
import { OdiAvatar } from '../ui/OdiAvatar';
import { AdminModeCard, CodePanel, useCodes } from '../codes/Codes';
import '../comm/comm.css'; // .switch (her şey açık anahtarı, AdminModeCard)
import './yonetici.css';

type Tab = 'oyuncular' | 'mesajlar' | 'fotograflar' | 'kodlar' | 'hediye';
const TABS: { id: Tab; label: string }[] = [
  { id: 'oyuncular', label: 'Oyuncular' }, { id: 'mesajlar', label: 'Mesajlar' }, { id: 'fotograflar', label: 'Fotoğraflar' },
  { id: 'kodlar', label: 'Kodlar' }, { id: 'hediye', label: 'Hediye' },
];

const fmtTime = (t: number) => new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
function ago(t: number): string {
  const d = Date.now() - t;
  if (d < 60_000) return 'az önce';
  if (d < 3_600_000) return `${Math.round(d / 60_000)} dk önce`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)} sa önce`;
  return `${Math.round(d / 86_400_000)} gün önce`;
}
const seen = (p: { online: boolean; lastSeen: number }) => (p.online ? 'çevrimiçi' : `${ago(p.lastSeen)} (${fmtTime(p.lastSeen)})`);
const REASON: Record<string, string> = { isim: 'Uygunsuz isim', taciz: 'Rahatsız ediyor', diger: 'Başka bir şey', dm: 'Özel mesaj', sohbet: 'Sohbet iletisi', foto: 'Fotoğraf' };

export function YoneticiScreen({ onBack }: { onBack: () => void }) {
  const isAdmin = useCodes((s) => !!s.server?.isAdmin);
  const online = useNet((s) => s.status) === 'bağlı';
  const [tab, setTab] = useState<Tab>('oyuncular');
  const [who, setWho] = useState<{ id: string; name: string } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [giftCode, setGiftCode] = useState('');
  return (
    <div className="screen fade-in yn" data-testid="yonetici-ekrani">
      <ScreenHead title="Admin" onBack={onBack} />
      {!isAdmin ? <div className="card muted">Bu ekran yalnız yönetici hesabında açılır.</div> : !online ? <div className="card muted">Sunucuya bağlı değilsin; bağlantı gelince açılır.</div> : (
        <>
          <AdminModeCard />
          <div className="yn-tabs" role="tablist" aria-label="Admin bölümleri">
            {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} data-testid={`yn-${t.id}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
          </div>
          {tab === 'oyuncular' && <Players onOpen={setDetail} />}
          {tab === 'mesajlar' && <Messages who={who} onClear={() => setWho(null)} onOpen={setDetail} />}
          {tab === 'fotograflar' && <Photos onOpen={setDetail} />}
          {tab === 'kodlar' && <div className="card"><CodePanel /></div>}
          {tab === 'hediye' && <Gift code={giftCode} setCode={setGiftCode} />}
          {detail && <PlayerSheet id={detail} onClose={() => setDetail(null)}
            onMessages={(p) => { setWho(p); setTab('mesajlar'); setDetail(null); }}
            onGift={(code) => { setGiftCode(code); setTab('hediye'); setDetail(null); }} />}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Oyuncular
function Players({ onOpen }: { onOpen: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<AdminPlayerRow[] | null>(null);
  const [total, setTotal] = useState(0); const [more, setMore] = useState(false); const [err, setErr] = useState('');
  const seq = useRef(0);
  const load = (offset: number, query: string) => {
    const c = getNet(); if (!c) return;
    const my = ++seq.current;
    c.call('admin.players', { query: query.trim() || undefined, offset }).then((r) => {
      if (my !== seq.current) return;
      setList((l) => (offset ? [...(l ?? []), ...r.players] : r.players)); setTotal(r.total); setMore(r.hasMore); setErr('');
    }, (e) => setErr(errText(e)));
  };
  useEffect(() => { const t = setTimeout(() => load(0, q), q ? 300 : 0); return () => clearTimeout(t); }, [q]);
  return (
    <div className="yn-sec">
      <input className="input" value={q} onChange={(e) => setQ(e.target.value.slice(0, 40))} placeholder="Ad ya da arkadaş kodu" aria-label="Oyuncu ara" data-testid="yn-ara" />
      <div className="muted small-note">{list ? `${fmtNum(total)} oyuncu · son bağlanan önce` : 'Yükleniyor…'}</div>
      {err && <div className="chat-err" role="alert">{err}</div>}
      <div className="yn-list">
        {list?.map((p) => (
          <button key={p.id} type="button" className="yn-row" data-testid="yn-oyuncu" onClick={() => onOpen(p.id)}>
            <OdiAvatar size={40} color={p.color} pid={p.id} photo={p.photo} />
            <span className="grow min0">
              <b className="ellipsis">{p.name}{p.admin ? ' (admin)' : ''} <small className="mono muted">{p.friendCode}</small></b>
              <small className="muted">Bölüm {p.highest} · {p.stars} yıldız · Sv {p.level} · {fmtNum(p.jeton)} jeton · {fmtNum(p.kristal)} kristal · {p.kalkan} kalkan{p.teamName ? ` · ${p.teamName}` : ''}</small>
              <small className={p.online ? 'yn-on' : 'muted'}>{seen(p)} · katıldı {fmtTime(p.createdAt)}{p.mutedUntil > Date.now() ? ' · susturuldu' : ''}</small>
            </span>
          </button>
        ))}
      </div>
      {more && <button className="btn ghost" onClick={() => load(list?.length ?? 0, q)}>Daha fazla</button>}
    </div>
  );
}

function PlayerSheet({ id, onClose, onMessages, onGift }: { id: string; onClose: () => void; onMessages: (p: { id: string; name: string }) => void; onGift: (code: string) => void }) {
  const [p, setP] = useState<AdminPlayerDetail | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const load = () => { const c = getNet(); if (!c) return; c.call('admin.player', { id }).then((r) => setP(r.player), (e) => setErr(errText(e))); };
  useEffect(load, [id]);
  const run = async (f: () => Promise<unknown>) => { setBusy(true); try { await f(); } finally { setBusy(false); load(); } };
  if (!p) return <Sheet title="Oyuncu" onClose={onClose}>{err ? <div className="chat-err" role="alert">{err}</div> : <div className="muted">Yükleniyor…</div>}</Sheet>;
  const muted = p.mutedUntil > Date.now();
  const line = (k: string, v: string | number) => <div className="yn-kv"><span className="muted">{k}</span><b>{v}</b></div>;
  return (
    <Sheet title={p.name} onClose={onClose}>
      <div className="yn-detail" data-testid="yn-detay">
        <div className="row"><OdiAvatar size={72} color={p.color} hat={p.hat} pid={p.id} photo={p.photo} /><div className="min0"><b>{p.name}</b><div className="mono muted">{p.friendCode}</div><div className={p.online ? 'yn-on' : 'muted'}>{seen(p)}</div></div></div>
        {line('Katıldı', fmtTime(p.createdAt))}
        {line('Bölüm', `${p.highest} (geçilen ${p.levels.cleared}, 3 yıldızlı ${p.levels.threeStars})`)}
        {line('Yıldız / XP', `${p.stars} / ${fmtNum(p.xp)} (Sv ${p.level})`)}
        {line('Cüzdan', `${fmtNum(p.jeton)} jeton · ${fmtNum(p.kristal)} kristal · ${p.kalkan} kalkan`)}
        {line('Hızlandırıcı', `5 dk ${p.hizlandirici.m5} · 1 sa ${p.hizlandirici.m60} · 8 sa ${p.hizlandirici.s8}`)}
        {line('Takım', p.teamName ? `${p.teamName}${p.teamRole ? ` (${p.teamRole})` : ''}` : 'yok')}
        {line('Lig', p.league)}
        {line('Kozmetik / kart', `${p.cosmetics} / ${p.cards}`)}
        {line('Arkadaş', p.friends)}
        {line('Gönderdiği', `${p.dmCount} özel mesaj · ${p.chatCount} sohbet iletisi`)}
        {line('Satın alma', p.purchases)}
        {line('Rozet', p.badges.join(', ') || 'yok')}
        {line('Şikâyet', `hakkında ${p.reportsAgainst.length} · yaptığı ${p.reportsBy}`)}
        {line('Susturma', muted ? `${fmtTime(p.mutedUntil)} tarihine kadar` : 'yok')}
        {p.admin && line('Admin', p.adminOn ? 'her şey açık modu açık' : 'evet')}
        {p.levels.recent.length > 0 && <div className="muted small-note">Son bölümler: {p.levels.recent.map((l) => `${l.level} (${'★'.repeat(l.stars) || '0'})`).join(', ')}</div>}
        <div className="yn-actions">
          <button className="btn teal" onClick={() => onMessages({ id: p.id, name: p.name })}>Mesajlarını gör</button>
          <button className="btn ghost" onClick={() => onGift(p.friendCode)}>Hediye gönder</button>
          {p.photo !== undefined || p.photoHidden ? <button className="btn ghost" disabled={busy} onClick={() => void run(async () => { if (await act('admin.photo.delete', { id: p.id })) toast('🗑️', 'Fotoğraf silindi', p.name); })}>Fotoğrafı sil</button> : null}
        </div>
        <div className="yn-actions">
          {[1, 7, 30].map((d) => <button key={d} className="btn small ghost" disabled={busy} onClick={() => void run(async () => { if (await act('admin.mute', { id: p.id, days: d })) toast('🔇', `${p.name} ${d} gün susturuldu`); })}>{d} gün sustur</button>)}
          {muted && <button className="btn small" disabled={busy} onClick={() => void run(async () => { if (await act('admin.mute', { id: p.id, days: 0 })) toast('🔊', 'Susturma kaldırıldı'); })}>Susturmayı kaldır</button>}
        </div>
        {p.reportsAgainst.length > 0 && <><h3>Hakkındaki şikâyetler</h3><div className="yn-list">{p.reportsAgainst.map((r, i) => <ReportRow key={i} r={r} />)}</div></>}
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------------ Mesajlar
function Messages({ who, onClear, onOpen }: { who: { id: string; name: string } | null; onClear: () => void; onOpen: (id: string) => void }) {
  const [view, setView] = useState<'iletiler' | 'sikayet'>('iletiler');
  const [kind, setKind] = useState<'hepsi' | 'dm' | 'sohbet'>('hepsi');
  const [list, setList] = useState<AdminMessage[] | null>(null); const [more, setMore] = useState(false);
  const [reps, setReps] = useState<AdminReport[] | null>(null); const [repMore, setRepMore] = useState(false);
  const [err, setErr] = useState('');
  const loadMsgs = (before?: number) => {
    const c = getNet(); if (!c) return;
    c.call('admin.messages', { id: who?.id, kind, before }).then((r) => { setList((l) => (before ? [...(l ?? []), ...r.messages] : r.messages)); setMore(r.hasMore); setErr(''); }, (e) => setErr(errText(e)));
  };
  const loadReps = (before?: number) => {
    const c = getNet(); if (!c) return;
    c.call('admin.reports', { before }).then((r) => { setReps((l) => (before ? [...(l ?? []), ...r.reports] : r.reports)); setRepMore(r.hasMore); setErr(''); }, (e) => setErr(errText(e)));
  };
  useEffect(() => { if (view === 'iletiler') { setList(null); loadMsgs(); } else { setReps(null); loadReps(); } }, [view, kind, who?.id]);
  return (
    <div className="yn-sec">
      <div className="seg" role="tablist" aria-label="Mesaj görünümü">
        <button role="tab" aria-selected={view === 'iletiler'} className={view === 'iletiler' ? 'on' : ''} onClick={() => setView('iletiler')}>İletiler</button>
        <button role="tab" aria-selected={view === 'sikayet'} className={view === 'sikayet' ? 'on' : ''} data-testid="yn-sikayetler" onClick={() => setView('sikayet')}>Şikâyet edilenler</button>
      </div>
      {err && <div className="chat-err" role="alert">{err}</div>}
      {view === 'iletiler' ? (
        <>
          <div className="row between">
            <b className="min0 ellipsis">{who ? `${who.name}: özel mesajlar ve sohbet` : 'Herkesin son iletileri'}</b>
            {who && <button className="btn small ghost" onClick={onClear}>Herkes</button>}
          </div>
          <div className="seg" role="tablist" aria-label="İleti türü">
            {([['hepsi', 'Hepsi'], ['dm', 'Özel'], ['sohbet', 'Sohbet']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{l}</button>)}
          </div>
          <div className="yn-list">
            {!list ? <div className="muted">Yükleniyor…</div> : list.length === 0 ? <div className="muted">İleti yok.</div> : list.map((m) => (
              <div key={`${m.kind}-${m.id}`} className="yn-msg" data-testid="yn-ileti">
                <small className="muted">
                  {fmtTime(m.at)} · {m.kind === 'dm' ? 'Özel' : m.room}{m.hidden ? ' · gizlendi' : ''}{m.deleted ? ' · silindi' : ''}
                </small>
                <div>
                  <button className="linkish" onClick={() => onOpen(m.fromId)}>{m.fromName}</button>
                  {m.kind === 'dm' && m.toId && <> → <button className="linkish" onClick={() => onOpen(m.toId!)}>{m.toName}</button></>}
                </div>
                <div className="yn-text" data-ugc>{m.text || (m.deleted ? '(silinmiş mesaj)' : '')}</div>
              </div>
            ))}
          </div>
          {more && list && <button className="btn ghost" onClick={() => loadMsgs(list[list.length - 1]!.at)}>Daha eski</button>}
        </>
      ) : (
        <>
          <div className="yn-list">
            {!reps ? <div className="muted">Yükleniyor…</div> : reps.length === 0 ? <div className="muted">Şikâyet yok.</div> : reps.map((r, i) => <ReportRow key={i} r={r} onOpen={onOpen} />)}
          </div>
          {repMore && reps && <button className="btn ghost" onClick={() => loadReps(reps[reps.length - 1]!.at)}>Daha eski</button>}
        </>
      )}
    </div>
  );
}

function ReportRow({ r, onOpen }: { r: AdminReport; onOpen?: (id: string) => void }) {
  return (
    <div className="yn-msg" data-testid="yn-sikayet">
      <small className="muted">{fmtTime(r.at)} · {REASON[r.reason] ?? r.reason} · şikâyet eden {r.reporterName}</small>
      <div>{onOpen ? <button className="linkish" onClick={() => onOpen(r.targetId)}>{r.targetName}</button> : <b>{r.targetName}</b>} <small className="mono muted">{r.targetCode}</small></div>
      {r.text !== undefined && <div className="yn-text" data-ugc>{r.text || '(silinmiş)'}</div>}
      {r.kind === 'foto' && <small className="muted">Profil fotoğrafı (Fotoğraflar bölümünden bak)</small>}
    </div>
  );
}

// ------------------------------------------------------------------ Fotoğraflar
function Photos({ onOpen }: { onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState<'yeni' | 'sikayet'>('yeni');
  const [list, setList] = useState<AdminPhoto[] | null>(null); const [more, setMore] = useState(false); const [err, setErr] = useState('');
  const load = (before?: number) => {
    const c = getNet(); if (!c) return;
    c.call('admin.photos', { filter, before }).then((r) => { setList((l) => (before ? [...(l ?? []), ...r.photos] : r.photos)); setMore(r.hasMore); setErr(''); }, (e) => setErr(errText(e)));
  };
  useEffect(() => { setList(null); load(); }, [filter]);
  const del = async (p: AdminPhoto) => { if (await act('admin.photo.delete', { id: p.id })) { toast('🗑️', 'Fotoğraf silindi', p.name); setList((l) => l?.filter((x) => x.id !== p.id) ?? null); } };
  const show = async (p: AdminPhoto) => { if (await act('admin.photo.show', { id: p.id })) { toast('👁️', 'Fotoğraf yeniden görünür', p.name); load(); } };
  return (
    <div className="yn-sec">
      <div className="seg" role="tablist" aria-label="Fotoğraflar">
        <button role="tab" aria-selected={filter === 'yeni'} className={filter === 'yeni' ? 'on' : ''} onClick={() => setFilter('yeni')}>Yeni</button>
        <button role="tab" aria-selected={filter === 'sikayet'} className={filter === 'sikayet' ? 'on' : ''} onClick={() => setFilter('sikayet')}>Şikâyet edilen</button>
      </div>
      {err && <div className="chat-err" role="alert">{err}</div>}
      <div className="yn-photos">
        {!list ? <div className="muted">Yükleniyor…</div> : list.length === 0 ? <div className="muted">Fotoğraf yok.</div> : list.map((p) => (
          <div key={p.id} className={`yn-photo${p.hidden ? ' gizli' : ''}`} data-testid="yn-foto">
            <PhotoImg p={p} />
            <button className="linkish ellipsis" onClick={() => onOpen(p.id)}>{p.name}</button>
            <small className="muted">{ago(p.at)}{p.reports ? ` · ${p.reports} şikâyet` : ''}{p.hidden ? ' · gizlendi' : ''}</small>
            <div className="row">
              <button className="btn small coral" onClick={() => void del(p)}>Sil</button>
              {p.hidden && <button className="btn small ghost" onClick={() => void show(p)}>Geri aç</button>}
            </div>
          </div>
        ))}
      </div>
      {more && list && <button className="btn ghost" onClick={() => load(list[list.length - 1]!.at)}>Daha fazla</button>}
    </div>
  );
}

/** görünür fotoğraf herkese açık adresten; gizlenmiş olan yalnız yöneticiye, sunucudan veri olarak */
function PhotoImg({ p }: { p: AdminPhoto }) {
  const [data, setData] = useState('');
  useEffect(() => {
    if (!p.hidden) return;
    const c = getNet(); if (!c) return;
    c.call('admin.photo.data', { id: p.id }).then((r) => setData(r.data), () => setData(''));
  }, [p.id, p.v, p.hidden]);
  const src = p.hidden ? data : photoUrl(platform().serverUrl(), p.id, p.v);
  return src ? <img className="yn-img" src={src} alt={`${p.name} fotoğrafı`} /> : <div className="yn-img" />;
}

// ------------------------------------------------------------------ Hediye
function Gift({ code, setCode }: { code: string; setCode: (c: string) => void }) {
  const [all, setAll] = useState(false);
  const [f, setF] = useState({ jeton: '', kristal: '', kalkan: '', note: '' });
  const [confirm, setConfirm] = useState(false); const [busy, setBusy] = useState(false);
  const n = (v: string) => (v.trim() ? Math.max(0, Math.floor(Number(v))) || undefined : undefined);
  const any = !!(n(f.jeton) || n(f.kristal) || n(f.kalkan));
  const send = async () => {
    if (all && !confirm) { setConfirm(true); return; }
    setBusy(true);
    const r = await act('admin.gift', { ...(all ? { all: true } : { code: code.trim() }), jeton: n(f.jeton), kristal: n(f.kristal), kalkan: n(f.kalkan), note: f.note.trim() || undefined });
    setBusy(false); setConfirm(false);
    if (r) { toast('🎁', all ? `Hediye ${fmtNum(r.count)} oyuncuya gitti` : 'Hediye gönderildi', 'Ödül kutularına düştü.', 'green'); setF({ jeton: '', kristal: '', kalkan: '', note: '' }); }
  };
  const field = (k: keyof typeof f, label: string, type = 'number') => (
    <label className="field"><span>{label}</span><input className="input" type={type} inputMode={type === 'number' ? 'numeric' : undefined} value={f[k]} onChange={(e) => { setF({ ...f, [k]: e.target.value }); setConfirm(false); }} data-testid={`hediye-${k}`} /></label>
  );
  return (
    <div className="card yn-sec" data-testid="yn-hediye">
      <div className="seg" role="tablist" aria-label="Kime">
        <button role="tab" aria-selected={!all} className={!all ? 'on' : ''} onClick={() => { setAll(false); setConfirm(false); }}>Tek oyuncu</button>
        <button role="tab" aria-selected={all} className={all ? 'on' : ''} onClick={() => { setAll(true); setConfirm(false); }}>Herkese</button>
      </div>
      {!all && <label className="field"><span>Arkadaş kodu</span><input className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 12))} placeholder="ör. K7M2QX" data-testid="hediye-kod" /></label>}
      <div className="panel-grid">{field('jeton', 'Jeton')}{field('kristal', 'Kristal')}{field('kalkan', 'Kalkan')}{field('note', 'Mesaj (ödül kutusunda görünür)', 'text')}</div>
      <div className="muted small-note">Hediye oyuncunun ödül kutusuna düşer; oradan alır.</div>
      <button className={`btn${confirm ? ' coral' : ''}`} data-testid="hediye-gonder" disabled={busy || !any || (!all && code.trim().length < 4)} onClick={() => void send()}>
        {confirm ? 'Eminim, herkese gönder' : all ? 'Herkese gönder' : 'Gönder'}
      </button>
    </div>
  );
}
