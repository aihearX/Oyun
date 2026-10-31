import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import { SHOP, type OpMap, type ShopProduct, type SpendState } from '@odi/shared';
import { applyServerItems, errText, getNet, toast } from '../net';
import { platform } from '../platform';
import { audio } from '@odi/audio';
import { celebrate } from '../celebrate';
import { useHudCount } from '../celebrate/hud';
import { ScreenHead, Bar } from '../ui/bits';
import { ItemChips, Online, Sheet, Skeleton, fmtDate, fmtTry } from '../ui/social';
import { Art, Rich } from '../ui/art';
import { STORE_PRICE_NOTE, loadStorePrices, priceLabel, type StorePriceMap } from '../shopPrice';

type Product = ShopProduct & { bought: number };
type List = OpMap['shop.list']['res'];
const TAG = { populer: 'Popüler', 'en-iyi-deger': 'En iyi değer', baslangic: 'Başlangıç' } as const;
const LIMITS = [0, 100, 250, 500, 1000, 2000, 5000];
const SHOP_IDS = SHOP.map((p) => p.id);
/** bu oturumda mağazadan gelen son fiyatlar (oyuncu başına): mağaza yeniden açılınca beklemeden gösterilir */
let priceCache: { playerId: string; map: StorePriceMap } | null = null;

/** Mağaza: içerik ve takım hediyesi açık, kişi başı sınır, aylık harcama sınırı, geçmiş. Savaş/lig puanı satılmaz. */
export function ShopScreen({ onBack }: { onBack: () => void }) {
  const wallet = useNet((s) => s.wallet); const k = useHudCount('kristal', wallet?.kristal ?? 0);
  return (
    <div className="screen fade-in">
      <ScreenHead title="Mağaza" onBack={onBack} right={wallet ? <span className={`pill${k.bump ? ' hud-pop' : ''}`} key={`k${k.bump}`} data-hud="kristal"><Art name="crystal" size={18} className="art-inline" />{k.value}</span> : undefined} />
      <Online what="Mağaza"><Shop /></Online>
    </div>
  );
}

function Shop() {
  const me = useNet((s) => s.me)!; const team = useNet((s) => s.team);
  const [data, setData] = useState<List | null>(null); const [err, setErr] = useState('');
  const [sel, setSel] = useState<Product | null>(null); const [busy, setBusy] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  const real = platform().purchase; const storeFn = platform().storePrices;
  // mağaza fiyatı yalnız gerçek satın almayla birlikte istenir; undefined = bekleniyor (en çok 6 sn), null = yok → TL liste fiyatı
  const cached = priceCache?.playerId === me.id ? priceCache.map : undefined;
  const [storeMap, setStoreMap] = useState<StorePriceMap | undefined>(real && storeFn ? cached : null);
  const load = () => getNet()?.call('shop.list', {}).then(setData, (e) => setErr(errText(e)));
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!real || !storeFn) return;
    let live = true;
    void loadStorePrices(storeFn, SHOP_IDS, me.id).then((m) => { if (m || !priceCache) priceCache = { playerId: me.id, map: m }; if (live) setStoreMap(m ?? (priceCache?.playerId === me.id ? priceCache.map : null)); });
    return () => { live = false; };
  }, [real, storeFn, me.id]);
  if (!data || (storeMap === undefined && !err)) return err ? <div className="chat-err">{err}</div> : <Skeleton rows={4} />;
  const mode: 'real' | 'test' | 'closed' = real ? 'real' : data.testStore ? 'test' : 'closed';
  // yanlış para birimi gösterilmez: listedeki her ürünün mağaza fiyatı varsa hepsi mağazadan, yoksa hepsi TL
  const prices: StorePriceMap = mode === 'real' && storeMap && data.products.every((p) => storeMap.has(p.id)) ? storeMap : null;
  const sp = data.spend;

  const buy = async (p: Product) => {
    const c = getNet(); if (!c) return;
    setBusy(true);
    try {
      let res: OpMap['shop.purchase']['res'];
      if (mode === 'real' && real) {
        const pr = await real(p.id, me.id);
        if (!pr.ok) { if (!pr.cancelled) toast('🙈', 'Satın alma tamamlanmadı', pr.error, 'bronze'); setBusy(false); return; }
        res = await c.call('shop.purchase', { productId: p.id, store: pr.store, receipt: pr.receipt });
      } else res = await c.call('shop.purchase', { productId: p.id, store: 'test' });
      const before = useNet.getState().wallet?.kristal ?? 0;
      useNet.setState({ wallet: res.wallet });
      applyServerItems(p.contents.filter((x) => x.kind === 'kozmetik').map((x) => ({ kind: 'kozmetik' as const, amount: 1, ref: x.ref ?? '' })));
      void c.call('profile.update', {}).catch(() => undefined);
      platform().haptic('success'); audio.play('fanfare');
      celebrate.banner({ icon: '🎉', title: `${p.name} hesabında`, body: res.teamGiftSent ? 'Takımındaki herkese hediye gitti!' : undefined, tone: 'gold' });
      if (res.wallet.kristal > before) void celebrate.coins({ amount: res.wallet.kristal - before, kind: 'kristal' });
      setSel(null); await load();
    } catch (e) { toast('🙈', 'Satın alınamadı', errText(e), 'bronze'); }
    setBusy(false);
  };

  return (
    <div className="stack">
      {mode === 'test' && <div className="test-banner" role="note"><Art name="flask" size="1.2em" className="art-inline" /> TEST MAĞAZASI — gerçek para çekilmez. Satın almalar yalnızca denemedir.</div>}
      {mode === 'closed' && <div className="card"><b>Mağaza bu sürümde kapalı</b><div className="muted">Oyunun tamamı oynayarak ilerler; mağaza yalnızca zaman ve stil kazandırır.</div></div>}
      <div className="muted small-note">Mağazada savaş ya da lig puanı satılmaz; içerikler önceden yazılı, şans yok.</div>
      {mode !== 'closed' && !prices && <div className="muted small-note" data-testid="fiyat-notu">Fiyatlar TL liste fiyatıdır. {STORE_PRICE_NOTE}.</div>}

      <SpendCard sp={sp} storePrices={!!prices} onEdit={() => setLimitOpen(true)} />

      {data.products.map((p) => { const soldOut = p.limit > 0 && p.bought >= p.limit; return (
        <div className={`card product${p.tag ? ` tag-${p.tag}` : ''}`} key={p.id}>
          {p.tag && <span className="ribbon">{TAG[p.tag]}</span>}
          {mode === 'test' && <span className="test-chip">TEST</span>}
          <div className="row"><div className="grow min0"><b>{p.name}</b><div className="muted">{p.id === 'odi.pass' ? PASS_DESC : p.desc}</div></div></div>
          <ItemChips items={p.contents} small />
          {p.teamGift && p.teamGiftContents && <div className="team-gift-line"><Rich text={`🎁 Takımındaki herkese: ${p.teamGiftContents.map((g) => `${g.kind === 'kristal' ? '💎' : '🪙'} ${g.amount}`).join(' + ')}`} />{!team && <span className="muted"> (bir takımdaysan)</span>}</div>}
          {p.id === 'odi.pass' && <><PassPath /><PassTerms /></>}
          <div className="row between prod-foot">
            <span className="muted small-note">{p.limit > 0 ? `Kişi başı ${p.limit} · alındı ${p.bought}/${p.limit}` : p.bought ? `${p.bought} kez alındı` : ''}</span>
            <button className="btn small" disabled={mode === 'closed' || soldOut} onClick={() => setSel(p)}>{soldOut ? 'Alındı' : priceLabel(p, prices).text}</button>
          </div>
        </div>); })}

      <div className="card">
        <b>Satın alma geçmişi</b>{prices && sp.purchases.length > 0 && <span className="muted small-note"> · TL liste fiyatıyla</span>}
        {sp.purchases.length === 0 ? <div className="muted">Henüz satın alma yok.</div> : (
          <ul className="history">{sp.purchases.map((x) => <li key={x.id}><span className="grow ellipsis">{data.products.find((p) => p.id === x.productId)?.name ?? x.productId}</span><span className="muted">{fmtDate(x.at)}{x.store === 'test' ? ' · TEST' : ''}</span><b>{fmtTry(x.amountTry)}</b></li>)}</ul>
        )}
      </div>

      {sel && (() => { const over = sp.monthTry + sel.priceTry > sp.limitTry + 1e-9; const pl = priceLabel(sel, prices); return (
        <Sheet title={sel.name} onClose={() => setSel(null)}>
          {mode === 'test' && <div className="test-banner small"><Art name="flask" size="1.2em" className="art-inline" /> TEST — gerçek para çekilmez</div>}
          <div className="confirm-price" data-testid="onay-fiyat">{pl.text}</div>
          {!pl.store && <div className="muted small-note">TL liste fiyatı. {STORE_PRICE_NOTE}.</div>}
          <div className="muted">İçerik:</div><ItemChips items={sel.contents} />
          {sel.id === 'odi.pass' && <PassTerms />}
          {sel.teamGift && sel.teamGiftContents && team && <div className="team-gift-line"><Art name="gift" size="1.2em" className="art-inline" /> <span data-ugc>{team.emblem}</span> {team.name} takımındaki diğer {team.members - 1} kişiye: <Rich text={sel.teamGiftContents.map((g) => `${g.kind === 'kristal' ? '💎' : '🪙'} ${g.amount}`).join(' + ')} /></div>}
          <div className="muted small-note">Aylık sınır (TL liste fiyatıyla): {fmtTry(sp.monthTry)} → {fmtTry(sp.monthTry + sel.priceTry)} / {fmtTry(sp.limitTry)}</div>
          {over && <div className="chat-err">Bu satın alma aylık sınırını aşıyor. Sınırı aşağıdan değiştirebilirsin (yükseltme 24 saat sonra geçerli).</div>}
          <button className="btn" disabled={busy || over} onClick={() => void buy(sel)}>{busy ? 'İşleniyor…' : mode === 'test' ? 'Test satın alması yap' : pl.store ? `${pl.text} öde` : 'Mağazada satın al'}</button>
          <button className="btn ghost" onClick={() => setSel(null)}>Vazgeç</button>
        </Sheet>); })()}
      {limitOpen && <LimitSheet sp={sp} onClose={() => setLimitOpen(false)} onSaved={(s) => { setData({ ...data, spend: s }); setLimitOpen(false); }} />}
    </div>
  );
}

/** aylık harcama: sunucu TL liste fiyatıyla sayar (mağaza fiyatı gösterilse de); her zaman TL */
function SpendCard({ sp, storePrices, onEdit }: { sp: SpendState; storePrices: boolean; onEdit: () => void }) {
  return (
    <div className="card spend">
      <div className="row between"><b>Bu ayki harcama (TL)</b><button className="linkish" onClick={onEdit}>Sınırı ayarla</button></div>
      <div className="row qbar"><Bar value={sp.limitTry ? sp.monthTry / sp.limitTry : 1} tone={sp.monthTry >= sp.limitTry ? 'coral' : 'green'} label="Aylık harcama" /><span className="qn">{fmtTry(sp.monthTry)} / {fmtTry(sp.limitTry)}</span></div>
      {sp.pendingLimitTry != null && sp.pendingLimitAt != null && <div className="muted small-note">Yeni sınır {fmtTry(sp.pendingLimitTry)}: {fmtDate(sp.pendingLimitAt)} itibarıyla geçerli.</div>}
      {storePrices && <div className="muted small-note">Sınır, ürünlerin TL liste fiyatıyla sayılır.</div>}
    </div>
  );
}

function LimitSheet({ sp, onClose, onSaved }: { sp: SpendState; onClose: () => void; onSaved: (s: SpendState) => void }) {
  const [v, setV] = useState(sp.pendingLimitTry ?? sp.limitTry);
  const save = async () => { const c = getNet(); if (!c) return; try { const r = await c.call('shop.limit', { limitTry: v }); onSaved(r.spend); toast('🧭', v <= sp.limitTry ? 'Sınır hemen güncellendi' : 'Yükseltme 24 saat sonra geçerli', `Aylık sınır: ${fmtTry(v)}`); } catch (e) { toast('🙈', 'Kaydedilemedi', errText(e), 'bronze'); } };
  return (
    <Sheet title="Aylık harcama sınırı" onClose={onClose}>
      <div className="muted">Sınır TL'dir, ürünlerin TL liste fiyatıyla sayılır. Düşürmek hemen, yükseltmek 24 saat sonra geçerli olur. 0 = satın alma kapalı.</div>
      <div className="limit-grid">{LIMITS.map((n) => <button key={n} className={`chip-btn${v === n ? ' on' : ''}`} onClick={() => setV(n)}>{n === 0 ? 'Kapalı' : `${n} TL`}</button>)}</div>
      <button className="btn" onClick={() => void save()}>Kaydet</button>
    </Sheet>
  );
}

/**
 * Sezon Kartı'nın bugünkü işleyişi (sunucu: players.ts passDaily, shop.ts deliver): satın alındığı andan 28 gün boyunca her takvim
 * gününün (Türkiye saati) ilk girişinde 30 kristal ödül kutusuna; girilmeyen günün kristali sonradan gelmez; tek seferlik alım,
 * kendiliğinden yenilenmez. Paylaşılan ürün açıklamasındaki "toplam 840" ancak her gün girilirse doğru olduğundan kartta bu açıklama
 * kullanılır. İşleyiş sahip kararı bekliyor (durum.md, karar 30): değişirse bu metin de değişmeli.
 */
const PASS_DESC = '28 gün boyunca, girdiğin her gün 30 kristal + Altın Koklea kostümü';
function PassTerms() {
  return (
    <ul className="pass-terms" data-testid="sezon-kosullari">
      <li>Satın aldığın andan başlayarak 28 gün sürer; satın aldığın gün de sayılır.</li>
      <li>Her günün (Türkiye saatiyle) ilk girişinde 30 kristal ödül kutuna gelir.</li>
      <li>Oyuna girmediğin günün kristali sonradan verilmez. Toplam 840 kristal, ancak 28 günün hepsinde girersen.</li>
      <li>Altın Koklea kostümü satın alır almaz dolabında.</li>
      <li>Tek seferlik alımdır: abonelik değildir, kendiliğinden yenilenmez, yeniden ücret alınmaz.</li>
    </ul>
  );
}

/** Sezon Kartı ödül yolu: 28 gün, her günün ilk girişinde 30 kristal + Altın Koklea kostümü (hemen) */
function PassPath() {
  return (
    <div className="pass-path" aria-label="Sezon Kartı ödül yolu">
      <div className="pp-day first"><b>Hemen</b><span><Art name="palette" size="1.15em" className="art-inline" /> Altın Koklea</span></div>
      {Array.from({ length: 28 }, (_, i) => <div className="pp-day" key={i}><b>{i + 1}. gün</b><span><Art name="crystal" size="1.15em" className="art-inline" /> 30</span></div>)}
    </div>
  );
}
