/**
 * Kod Gir: sürpriz ödül kodları ve yönetici hesabı (docs/10-sunucu.md "Kodlar"). Her doğrulama sunucuda; yönetici kodunun kendisi
 * istemcide yoktur. 1.1.0: yönetici kodu hesabı yalnız yönetici yapar (Profil › Admin görünür); "her şey açık" oynama modu
 * (tüm bölümler, tanıtımlar yok) kendiliğinden açılmaz, Admin ekranındaki anahtarla açılır. Mod açıkken yerelde de tutulur
 * (çevrimdışı da açık kalır), sıfırlamada silinir; bağlanınca sunucunun durumu esas alınır.
 */
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import type { NetClient } from '@odi/net';
import { useNet } from '@odi/net/store';
import { CODE_PATTERN, ROZETLER, normalizeCode, type AdminState, type CodeRedeemResult, type PromoCodeView, type PromoReward } from '@odi/shared';
import { COSMETICS } from '@odi/content';
import { act, errText, getNet, toast } from '../net';
import { platform } from '../platform';
import { useStore } from '../store';
import { celebrate, type RewardItem } from '../celebrate';
import { refreshComm } from '../comm/state';
import { hesabaGec } from '../hesap/gecis';
import { Sheet, fmtNum } from '../ui/social';
import { Art } from '../ui/art';
import './codes.css';
import '../comm/comm.css'; // .switch (paket bölme: kod kartı comm.css olmadan da çizilebilir)

interface CodesStore { server: AdminState | null }
export const useCodes = create<CodesStore>()(() => ({ server: null }));

/** yönetici modunu yerelde uygula (tüm bölüm ve yerler; tur yok) */
function applyLocal(on: boolean): void {
  useStore.setState((s) => ({ ftue: { ...s.ftue, ...(on ? { admin: true } : { admin: undefined }) } }));
}
export function bindCodes(c: NetClient): void {
  // 1.2.0 kilit hediyesi: hello yanıtındaki açılımlar (yoksa kalkar: yönetici kaldırmış olabilir)
  c.onMe((me) => useStore.getState().setAcik(me.acik));
  c.onStatus((st) => {
    if (st !== 'bağlı') return;
    if (c.me) useStore.getState().setAcik(c.me.acik);
    void c.call('admin.state', {}).then((r) => { useCodes.setState({ server: r.admin }); if (!!useStore.getState().ftue.admin !== r.admin.on) applyLocal(r.admin.on); }, () => undefined);
  });
}

export function rewardItems(r: PromoReward): RewardItem[] {
  const out: RewardItem[] = [];
  if (r.jeton) out.push({ kind: 'jeton', amount: r.jeton });
  if (r.kristal) out.push({ kind: 'kristal', amount: r.kristal });
  if (r.kalkan) out.push({ kind: 'kalkan', amount: r.kalkan });
  for (const k of r.kozmetik ?? []) out.push({ kind: 'kozmetik', amount: 1, ref: k, label: COSMETICS.find((c) => c.id === k)?.name ?? k });
  const h = r.hizlandirici; const hz = (h?.m5 ?? 0) + (h?.m60 ?? 0) + (h?.s8 ?? 0);
  if (hz) out.push({ kind: 'hizlandirici', amount: hz });
  return out;
}

/** kod girme sayfası (Profil › Kod Gir, Ayarlar › Kod gir) */
export function CodeSheet({ onClose }: { onClose: () => void }) {
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: 'err' | 'ok'; text: string } | null>(null);
  const online = useNet((s) => s.status) === 'bağlı';
  const code = normalizeCode(raw);
  const submit = async () => {
    if (!code || busy) return;
    setBusy(true); setMsg(null);
    let res: CodeRedeemResult | null = null;
    try { res = (await getNet()!.call('code.redeem', { code: raw })).result; } catch (e) { setMsg({ tone: 'err', text: errText(e) }); }
    setBusy(false);
    if (!res) return;
    if (res.kind === 'hata') { platform().haptic('error'); setMsg({ tone: 'err', text: res.message }); return; }
    platform().haptic('success');
    if (res.kind === 'yonetici') {
      // oynama modu (admin_on) sunucunun söylediği gibi: kod onu açmaz, oyun ve tanıtımlar olduğu gibi kalır
      useCodes.setState({ server: res.admin }); if (!!useStore.getState().ftue.admin !== res.admin.on) applyLocal(res.admin.on);
      setMsg({ tone: 'ok', text: 'Yönetici hesabı tanındı. Profil › Admin’den yönetebilirsin.' });
      setRaw('');
      return;
    }
    if (res.kind === 'hesap') {
      // 1.2.0 geri alma kodu: bu cihaz o hesaba geçer (yeni anahtar, sunucudaki ilerleme; uygulama yeniden kurulur)
      setMsg({ tone: 'ok', text: `${res.name} hesabın açılıyor…` });
      await hesabaGec(res.token, res.ilerleme);
      return;
    }
    // kalıcı rozet (YN-041): profil sunucudan yenilenir (rozet, çerçeve); başka ödül yoksa sayfada kutlama notu
    const rozet = (res.rewards.rozet ?? []).filter((r): r is keyof typeof ROZETLER => r in ROZETLER);
    if (rozet.length) await getNet()!.call('profile.update', {}).catch(() => undefined);
    const items = rewardItems(res.rewards);
    if (rozet.length && !items.length) {
      setRaw('');
      setMsg({ tone: 'ok', text: rozet.includes('kurucu')
        ? 'Hoş geldin, Kurucu Yolcu! Rozetin profilinde; çerçeveni Dolap’tan seçebilir, Ayarlar’dan adını Kurucular listesinde gösterebilirsin.'
        : `${rozet.map((r) => ROZETLER[r].ad).join(', ')} unvanın profilinde.` });
      return;
    }
    onClose();
    await celebrate.chest({ title: res.title, items, tier: items.some((i) => i.kind === 'kozmetik') ? 'altin' : (res.rewards.kristal ?? 0) >= 20 ? 'gumus' : 'bronz' });
    toast('🎁', 'Ödüller ödül kutusunda', 'Profil › Ödül kutusu’ndan al.', 'green');
  };
  return (
    <Sheet title="Kod gir" onClose={onClose}>
      <div className="code-sheet" data-testid="kod-sayfasi">
        <div className="muted">Sana verilen kodu yaz. Her kod hesabına bir kez işler; ödüller ödül kutusuna gelir. Hesabını geri almak için sana verilen GERİ kodu da buraya yazılır.</div>
        {/* kodun kaynağı ve dolandırıcılık uyarısı (OT-ekonomi-denetci-28): Profil ve Ayarlar aynı sayfayı açar */}
        <div className="muted code-safe" role="note" data-testid="kod-uyari">Kodlar yalnız ODİ duyurularında verilir, satılmaz. Kod için kimseye şifreni, telefonunu ya da para verme.</div>
        <form className="code-form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <input className="input code-input" data-testid="kod-girdi" value={raw} onChange={(e) => { setRaw(e.target.value.slice(0, 40)); setMsg(null); }} placeholder="KOD" aria-label="Kod"
            autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="go" maxLength={40} />
          <button className="btn" data-testid="kod-kullan" disabled={busy || !online || !CODE_PATTERN.test(code)}>{busy ? 'Bakılıyor…' : 'Kullan'}</button>
        </form>
        {!online && <div className="muted small-note">Kodlar sunucuda doğrulanır; bağlantı gelince kullanabilirsin.</div>}
        {msg && <div className={`code-msg ${msg.tone}`} role={msg.tone === 'err' ? 'alert' : 'status'} data-testid="kod-sonuc">{msg.text}</div>}
      </div>
    </Sheet>
  );
}

/** Ayarlar kartı: "Kod gir" (yönetici işleri 1.1.0'dan beri Profil › Admin'de) */
export function CodeSettingsCard() {
  const [sheet, setSheet] = useState(false);
  return (
    <div className="card code-card" data-testid="kod-ayar">
      <div className="row between">
        <div className="min0"><h2>Kod gir</h2><div className="muted">Sürpriz ödül kodlarını buraya yaz.</div></div>
        <button className="btn small" data-testid="kod-ac-ayar" onClick={() => setSheet(true)}>Kod gir</button>
      </div>
      {sheet && <CodeSheet onClose={() => setSheet(false)} />}
    </div>
  );
}

/** Admin ekranı: "her şey açık" oynama modu (varsayılan kapalı). Açıkken tüm bölümler ve yerler açık, tanıtımlar çıkmaz. */
export function AdminModeCard() {
  const admin = useStore((s) => !!s.ftue.admin);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    const r = await act('admin.set', { on: !admin });
    setBusy(false);
    if (!r) return;
    useCodes.setState({ server: r.admin }); applyLocal(r.admin.on); void refreshComm();
    toast(r.admin.on ? '🛠️' : '🔒', r.admin.on ? 'Her şey açık modu açık' : 'Her şey açık modu kapalı', r.admin.on ? 'Tüm bölümler ve yerler açık.' : 'Bölümler gerçek ilerlemene göre.');
  };
  return (
    <div className="card admin-box" data-testid="yonetici">
      <div className="row between">
        <span className={`pill admin-pill${admin ? ' on' : ''}`} data-testid="yonetici-rozet"><Art name="key" size={16} className="art-inline" /> {admin ? 'Her şey açık: açık' : 'Her şey açık: kapalı'}</span>
        <button type="button" className="switch" role="switch" aria-checked={admin} aria-label="Her şey açık modu" data-testid="yonetici-anahtar" disabled={busy} onClick={() => void toggle()} />
      </div>
      <div className="muted small-note">{admin ? 'Tüm bölümler ve yerler açık, tanıtımlar çıkmaz; yıldızların ve ilerlemen gerçek kalır.' : 'Kapalı: oyun normal akar (bölüm kilitleri, tanıtımlar). Test için anahtara dokun.'} Yönetici hesabı her durumda sıralama, lig ve haftalık ödüllere katılmaz.</div>
    </div>
  );
}

const rewardLine = (r: PromoReward) => [...rewardItems(r).map((i) => `${fmtNum(i.amount)} ${i.kind === 'kozmetik' ? i.label ?? 'kozmetik' : i.kind === 'hizlandirici' ? 'hızlandırıcı' : i.kind}`),
  ...(r.rozet ?? []).filter((x): x is keyof typeof ROZETLER => x in ROZETLER).map((x) => `${ROZETLER[x].ad} ${ROZETLER[x].tur}`)].join(' + ');
const fmtDay = (t: number | null) => (t == null ? 'yok' : new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }));

const EMPTY = { code: '', jeton: '', kristal: '', kalkan: '', m5: '', m60: '', kozmetik: '', max: '', bitis: '', note: '' };
/** Admin › Kodlar: kod oluştur, listele, kapat/aç (sunucu yalnız yönetici hesabına izin verir) */
export function CodePanel() {
  const [codes, setCodes] = useState<PromoCodeView[] | null>(null);
  const [err, setErr] = useState('');
  const [f, setF] = useState(EMPTY);
  const load = () => { const c = getNet(); if (!c) return; c.call('code.list', {}).then((r) => { setCodes(r.codes); setErr(''); }, (e) => setErr(errText(e))); };
  useEffect(load, []);
  const n = (v: string) => (v.trim() ? Math.max(0, Math.floor(Number(v))) || undefined : undefined);
  const create = async () => {
    const endsAt = f.bitis ? Date.parse(`${f.bitis}T00:00:00+03:00`) + 86_400_000 : null;
    const m5 = n(f.m5); const m60 = n(f.m60);
    const r = await act('code.create', { code: f.code, note: f.note.trim() || undefined, maxUses: n(f.max) ?? null, endsAt, rewards: {
      jeton: n(f.jeton), kristal: n(f.kristal), kalkan: n(f.kalkan), ...(f.kozmetik ? { kozmetik: [f.kozmetik] } : {}),
      ...(m5 || m60 ? { hizlandirici: { ...(m5 ? { m5 } : {}), ...(m60 ? { m60 } : {}) } } : {}),
    } });
    if (r) { toast('✅', `${r.code.code} eklendi`, rewardLine(r.code.rewards), 'green'); setF(EMPTY); load(); }
  };
  const field = (k: keyof typeof f, label: string, o: { type?: string; ph?: string } = {}) => (
    <label className="field"><span>{label}</span><input className="input" data-testid={`panel-${k}`} type={o.type ?? 'text'} inputMode={o.type === 'number' ? 'numeric' : undefined} value={f[k]} placeholder={o.ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></label>
  );
  return (
    <div className="admin-panel" data-testid="kod-paneli">
      <div className="muted small-note">Yeni kod oluştur. Her oyuncu bir kez kullanır; sınır ve bitiş isteğe bağlı.</div>
      {field('code', 'Kod', { ph: 'ör. ODIYAKINDA' })}
      <div className="panel-grid">{field('jeton', 'Jeton', { type: 'number' })}{field('kristal', 'Kristal', { type: 'number' })}{field('kalkan', 'Kalkan', { type: 'number' })}{field('max', 'En çok kullanım', { type: 'number', ph: 'sınırsız' })}</div>
      <div className="panel-grid">{field('m5', '5 dk hızlandırıcı', { type: 'number' })}{field('m60', '1 sa hızlandırıcı', { type: 'number' })}
        <label className="field"><span>Kozmetik</span><select className="input" data-testid="panel-kozmetik" value={f.kozmetik} onChange={(e) => setF({ ...f, kozmetik: e.target.value })}>
          <option value="">Yok</option>{COSMETICS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></label>
      </div>
      <div className="panel-grid">{field('bitis', 'Bitiş günü', { type: 'date' })}{field('note', 'Başlık', { ph: 'Sürpriz ödül!' })}</div>
      <button className="btn" data-testid="panel-olustur" disabled={!CODE_PATTERN.test(normalizeCode(f.code))} onClick={() => void create()}>Kodu oluştur</button>
      {err && <div className="chat-err">{err}</div>}
      <h3>Kodlar</h3>
      <div className="code-list" data-testid="panel-liste">
        {!codes ? <div className="muted">Yükleniyor…</div> : codes.length === 0 ? <div className="muted">Henüz kod yok.</div> : codes.map((c) => (
          <div key={c.code} className={`code-row${c.active ? '' : ' off'}`} data-testid="panel-kod" data-code={c.code}>
            <span className="grow min0"><b className="mono ellipsis">{c.code}</b><small className="muted">{rewardLine(c.rewards)} · {c.uses}/{c.maxUses ?? '∞'} · bitiş {fmtDay(c.endsAt)}</small></span>
            <button className="btn small ghost" onClick={async () => { const r = await act('code.close', { code: c.code, active: !c.active }); if (r) load(); }}>{c.active ? 'Kapat' : 'Aç'}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
