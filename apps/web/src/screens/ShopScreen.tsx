import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import { PASS_DAILY_KRISTAL, PASS_DAYS, PASS_TOTAL_KRISTAL, SHOP, isRestorable, SPEND_LIMIT_FIRST_CHOICES, SPEND_LIMIT_OPTIONS, SPEND_LIMIT_SUGGESTED_TRY, TEAM_GIFT_ANON, type OpMap, type ShopProduct, type SpendState } from '@odi/shared';
import { errText, getNet, odemeIslendi, odemeKuyrugu, odemeRetMetni, toast } from '../net';
import type { BekleyenOdeme } from '../odeme-kuyrugu';
import { platform } from '../platform';
import { audio } from '@odi/audio';
import { celebrate } from '../celebrate';
import { useHudCount } from '../celebrate/hud';
import { ScreenHead, Bar } from '../ui/bits';
import { ItemChips, Online, Sheet, Skeleton, fmtDate, fmtHud, fmtTry } from '../ui/social';
import { Art, TeamEmblem } from '../ui/art';
import { BEST_VALUE_LABEL, bestValue, fmtPerTry, kalanSatiri, limitBlock, listPriceNote, loadStorePrices, payLine, priceLabel, type ShopMode, type StorePriceMap } from '../shopPrice';

type Product = ShopProduct & { bought: number };
type List = OpMap['shop.list']['res'];
const SHOP_IDS = SHOP.map((p) => p.id);
/** bu oturumda mağazadan gelen son fiyatlar (oyuncu başına): mağaza yeniden açılınca beklemeden gösterilir */
let priceCache: { playerId: string; map: StorePriceMap } | null = null;

/** Mağaza: içerik ve takım hediyesi açık, kişi başı sınır, aylık harcama sınırı (ilk alımdan önce oyuncu seçer), geçmiş. Takım ya da lig puanı satılmaz. */
export function ShopScreen({ onBack }: { onBack: () => void }) {
  const wallet = useNet((s) => s.wallet); const k = useHudCount('kristal', wallet?.kristal ?? 0);
  return (
    <div className="screen fade-in">
      <ScreenHead title="Mağaza" onBack={onBack} right={wallet ? <span className={`pill${k.bump ? ' hud-pop' : ''}`} key={`k${k.bump}`} data-hud="kristal"><Art name="crystal" size={18} className="art-inline" />{fmtHud(k.value)}</span> : undefined} />
      <Online what="Mağaza"><Shop /></Online>
    </div>
  );
}

function Shop() {
  const me = useNet((s) => s.me)!; const team = useNet((s) => s.team);
  const [data, setData] = useState<List | null>(null); const [err, setErr] = useState('');
  const [sel, setSel] = useState<Product | null>(null); const [busy, setBusy] = useState(false);
  const [limitOpen, setLimitOpen] = useState(false);
  // aylık sınırı aşan paketin fiyatına dokunuldu: altında kalan tutar ve sıfırlanma günü (dokunuş sessizce yutulmaz, YN-197)
  const [sinirNotu, setSinirNotu] = useState<string | null>(null);
  useEffect(() => { if (!sinirNotu) return; const h = setTimeout(() => setSinirNotu(null), 6000); return () => clearTimeout(h); }, [sinirNotu]);
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
  // gerçek ödeme yalnız sunucu makbuzu doğrulayabiliyorsa (realStore; eski sunucu göndermez): yoksa ödeme alınıp ürün verilemezdi
  const mode: ShopMode = real && data.realStore !== false ? 'real' : data.testStore ? 'test' : 'closed';
  // yanlış para birimi gösterilmez: listedeki her ürünün mağaza fiyatı varsa hepsi mağazadan, yoksa hepsi TL
  const prices: StorePriceMap = mode === 'real' && storeMap && data.products.every((p) => storeMap.has(p.id)) ? storeMap : null;
  const sp = data.spend;
  // "En iyi değer" gerçek kristal/TL oranından (sabit etiket değil); bağlamı söyler: yalnız kristal paketleri arasında
  const best = bestValue(data.products);

  const buy = async (p: Product) => {
    const c = getNet(); if (!c) return;
    setBusy(true);
    const basarili = async (res: OpMap['shop.purchase']['res']) => {
      const before = useNet.getState().wallet?.kristal ?? 0;
      odemeIslendi([p.id], res.wallet);
      platform().haptic('success'); audio.play('fanfare');
      celebrate.banner({ icon: '🎉', title: `${p.name} hesabında`, body: res.teamGiftSent ? 'Takımındaki herkese adsız hediye gitti.' : undefined, tone: 'gold' });
      if (res.wallet.kristal > before) void celebrate.coins({ amount: res.wallet.kristal - before, kind: 'kristal' });
      setSel(null); await load();
    };
    // mağaza penceresi açıldıktan sonraki beklenmeyen hata: ödeme alınmış olabilir, "ödeme alınmadı" denmez
    let odemeBasladi = false;
    try {
      if (mode === 'real' && real) {
        // sınırlar ödemeden ÖNCE sunucuda (ödeme alındıktan sonra sınır yüzünden reddetmek parayı ürünsüz bırakırdı)
        await c.call('shop.check', { productId: p.id });
        odemeBasladi = true;
        const pr = await real(p.id, me.id);
        if (!pr.ok) {
          // makbuzu gelmeyen ama ödemesi alınmış olabilecek işlem: RevenueCat SDK'sı tutar; sunucu bağlanınca RevenueCat'i tarar
          if (pr.pending || pr.uncertain) void odemeKuyrugu.taramaIste(me.id);
          if (pr.pending) toast('🧭', 'Ödeme onay bekliyor', pr.error);
          else if (!pr.cancelled) toast('🙈', pr.uncertain ? 'Mağaza işlemi yarım kaldı' : 'Satın alma tamamlanmadı', pr.error, 'bronze');
          setBusy(false); return;
        }
        // ödeme alındı: makbuz önce kalıcı kuyruğa, sonra sunucuya (YN-285). İşlenemezse bağlantı dönünce kendiliğinden yeniden gider.
        const r = await odemeKuyrugu.odemeAlindi({ playerId: me.id, productId: p.id, store: pr.store, receipt: pr.receipt });
        if (r.k === 'islendi' || r.k === 'zaten') { if (r.res) await basarili(r.res); else { setSel(null); await load(); } }
        else if (r.k === 'ret') { toast('🙈', 'Satın alma bu hesaba işlenemedi', odemeRetMetni(r), 'bronze'); setSel(null); await load(); }
        else {
          toast('🧭', 'Ödeme alındı; bağlantı dönünce hesabına işlenecek', r.kalici
            ? 'Mağaza işlemi bu cihazda saklandı. Sunucuya ulaşınca ürün kendiliğinden hesabına geçer; uygulamayı kapatsan da kaybolmaz.'
            : 'Mağaza işlemi bu cihaza kaydedilemedi. Ürün bir süre içinde gelmezse Mağaza › Satın alımları geri yükle.', 'bronze');
          setSel(null);
        }
      } else await basarili(await c.call('shop.purchase', { productId: p.id, store: 'test' }));
    } catch (e) {
      if (odemeBasladi) {
        void odemeKuyrugu.taramaIste(me.id);
        toast('🙈', 'Mağaza işlemi yarım kaldı', 'Ödeme alındıysa bağlantı dönünce hesabına işlenir; gelmezse Mağaza › Satın alımları geri yükle.', 'bronze');
      } else toast('🙈', 'Satın alınamadı', errText(e), 'bronze'); // ödeme başlamadan (shop.check) ya da test mağazası
    }
    setBusy(false);
  };

  return (
    <div className="stack magaza">
      {mode === 'test' && <div className="test-banner" role="note"><Art name="flask" size="1.2em" className="art-inline" /> TEST MAĞAZASI — gerçek para çekilmez. Satın almalar yalnızca denemedir.</div>}
      {mode === 'closed' && <div className="card"><b>Mağaza bu sürümde kapalı</b><div className="muted">Oyunun tamamı oynayarak ilerler; mağaza yalnızca zaman ve stil kazandırır.</div></div>}
      {/* yeni oyuncu üstte tek kısa cümle okur; oyun kelimeleriyle ayrıntı açılır bölümde, içerik aynı (OT-ilk-kez-oyun-28) */}
      <div className="magaza-ilke" data-testid="magaza-ilke">
        <b>Burada bölüm geçirten ya da sıralamada öne geçiren bir şey satılmaz.</b>
        <details className="ilke-detay">
          <summary>Neler satılmaz?</summary>
          <div className="muted small-note">Mağazada savaş, baskın, yarış ya da lig puanı satılmaz. Hızlandırıcılar yalnız kamp inşaatını kısaltır; kamp binaları takım puanlarına ve lige hiç eklenmez. Atölye kalkanı ve Klinik seni bölümde korur ama korunan vuruş da hasar sayılır: “Hiç hasar alma” ve hasara bağlı yıldızlar bu yolla gelmez. Takım hediyesindeki jeton takım teknolojisine bağışlanamaz. İçerikler önceden yazılı, şans yok.</div>
        </details>
      </div>
      {mode !== 'closed' && !prices && <div className="muted small-note" data-testid="fiyat-notu">{listPriceNote(mode)}</div>}
      <BekleyenOdemeler playerId={me.id} onIslendi={() => void load()} />

      <SpendCard sp={sp} storePrices={!!prices} onEdit={() => setLimitOpen(true)} />

      {data.products.map((p) => {
        // aylık sınırı aşan paket listede de gri ve sebebi yazılı; pencere aynı kuralı kullanır (limitBlock)
        const soldOut = p.limit > 0 && p.bought >= p.limit; const block = soldOut || mode === 'closed' ? null : limitBlock(sp, p.priceTry);
        const isBest = best?.id === p.id; return (
        <div className={`card product${isBest ? ' tag-en-iyi-deger' : p.tag === 'baslangic' ? ' tag-baslangic' : ''}`} key={p.id}>
          {isBest ? <span className="ribbon" data-testid="en-iyi-deger">{BEST_VALUE_LABEL}</span> : p.tag === 'baslangic' && <span className="ribbon">Başlangıç</span>}
          {mode === 'test' && <span className="test-chip">TEST</span>}
          <div className="row"><div className="grow min0"><b>{p.name}</b><div className="muted">{p.desc}</div></div></div>
          <ItemChips items={p.contents} small />
          {p.teamGift && p.teamGiftContents && <div className="team-gift-line"><Art name="gift" size="1.2em" className="art-inline" /> Takımındaki herkese: <GiftParts items={p.teamGiftContents} />{!team && <span className="muted"> (bir takımdaysan)</span>}</div>}
          {isBest && <div className="muted small-note" data-testid="en-iyi-deger-hesap">TL liste fiyatıyla lira başına {fmtPerTry(best.perTry)} kristal: kristal paketleri arasında en çok. Sezon Kartı kristalini 28 güne yayar, bu karşılaştırmada yok.</div>}
          {p.id === 'odi.pass' && <><PassPath /><PassTerms /></>}
          <div className="row between prod-foot">
            <span className="muted small-note">{p.limit > 0 ? `Kişi başı ${p.limit} · alındı ${p.bought}/${p.limit}` : p.bought ? `${p.bought} kez alındı` : ''}</span>
            {/* sınırı aşan paketin düğmesi gri ama dokunulabilir: dokununca kalan tutar ve sıfırlanma günü yazılır */}
            <button className="btn small" disabled={mode === 'closed' || soldOut} aria-disabled={block ? true : undefined} onClick={() => (block ? setSinirNotu(p.id) : setSel(p))}>{soldOut ? 'Alındı' : priceLabel(p, prices).text}</button>
          </div>
          {block && <div className="muted small-note sinir-asiyor" data-testid="sinir-asiyor">{block}</div>}
          {block && sinirNotu === p.id && <div className="small-note sinir-notu" role="status" data-testid="sinir-notu">{sp.limitTry > 0 ? `${kalanSatiri(sp)}.` : 'Aylık sınırın “Kapalı”: satın alma yok.'} Sınırı yukarıdaki “Sınırı ayarla”dan değiştirebilirsin.</div>}
        </div>); })}

      {mode === 'real' && platform().restorePurchases && <GeriYukle playerId={me.id} onDone={(r) => setData({ ...data, spend: r.spend })} />}

      <div className="card">
        <b>Satın alma geçmişi</b>{prices && sp.purchases.length > 0 && <span className="muted small-note"> · TL liste fiyatıyla</span>}
        {sp.purchases.length === 0 ? <div className="muted">Henüz satın alma yok.</div> : (
          <ul className="history">{sp.purchases.map((x) => <li key={x.id}><span className="grow ellipsis">{data.products.find((p) => p.id === x.productId)?.name ?? x.productId}</span><span className="muted">{fmtDate(x.at)}{x.store === 'test' ? ' · TEST' : ''}</span><b>{fmtTry(x.amountTry)}</b></li>)}</ul>
        )}
      </div>

      {sel && !sp.limitChosen && (
        <Sheet title="Önce aylık harcama sınırı" onClose={() => setSel(null)}>
          <FirstLimit onSaved={(s) => setData({ ...data, spend: s })} onCancel={() => setSel(null)} />
        </Sheet>)}
      {sel && sp.limitChosen && (() => { const over = limitBlock(sp, sel.priceTry) != null; const pl = priceLabel(sel, prices); return (
        <Sheet title={sel.name} onClose={() => setSel(null)}>
          {mode === 'test' && <div className="test-banner small"><Art name="flask" size="1.2em" className="art-inline" /> TEST — gerçek para çekilmez</div>}
          <div className="confirm-price" data-testid="onay-fiyat">{pl.text}</div>
          <div className="muted small-note" data-testid="odenecek-tutar">{payLine(mode, sel, prices)}</div>
          <div className="muted">İçerik:</div><ItemChips items={sel.contents} />
          {sel.id === 'odi.pass' && <PassTerms />}
          {sel.teamGift && sel.teamGiftContents && team && <div className="team-gift-line"><Art name="gift" size="1.2em" className="art-inline" /> <TeamEmblem e={team.emblem} size="1.1em" className="art-inline" /> {team.name} takımındaki diğer {team.members - 1} kişiye: <GiftParts items={sel.teamGiftContents} /></div>}
          {sel.teamGift && team && <div className="muted small-note" data-testid="adsiz-hediye">{TEAM_GIFT_ANON.shopNote}</div>}
          <div className="muted small-note">Aylık sınır (TL liste fiyatıyla): {fmtTry(sp.monthTry)} → {fmtTry(sp.monthTry + sel.priceTry)} / {fmtTry(sp.limitTry)}</div>
          {over && <div className="chat-err">Bu satın alma aylık sınırını aşıyor. Sınırı mağazadaki "Sınırı ayarla"dan değiştirebilirsin (yükseltme ayrıca onay ister, 24 saat sonra geçerli olur).</div>}
          <button className="btn" disabled={busy || over} onClick={() => void buy(sel)}>{busy ? 'İşleniyor…' : mode === 'test' ? 'Test satın alması yap' : pl.store ? `${pl.text} öde` : 'Mağazada satın al'}</button>
          <button className="btn ghost" onClick={() => setSel(null)}>Vazgeç</button>
        </Sheet>); })()}
      {limitOpen && <LimitSheet sp={sp} onClose={() => setLimitOpen(false)} onSaved={(s) => { setData({ ...data, spend: s }); setLimitOpen(false); }} />}
    </div>
  );
}

/**
 * Ödemesi alınıp hesaba henüz işlenmemiş mağaza satın almaları (YN-285, odeme-kuyrugu.ts): bağlantı dönünce kendiliğinden işlenir;
 * oyuncu beklemek istemezse "Şimdi dene".
 */
function BekleyenOdemeler({ playerId, onIslendi }: { playerId: string; onIslendi: () => void }) {
  const [list, setList] = useState<BekleyenOdeme[]>([]); const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    const yenile = () => { void odemeKuyrugu.bekleyenler(playerId).then((l) => { if (live) setList(l); }); };
    yenile(); const off = odemeKuyrugu.abone(yenile);
    return () => { live = false; off(); };
  }, [playerId]);
  if (!list.length) return null;
  const dene = async () => {
    setBusy(true);
    const { sonuclar } = await odemeKuyrugu.bosalt(playerId);
    const islenen = sonuclar.filter((r) => r.k === 'islendi' || r.k === 'zaten');
    const son = [...islenen].reverse().find((r) => r.res)?.res;
    if (son) odemeIslendi(sonuclar.filter((r) => r.k === 'islendi').map((r) => r.item.productId), son.wallet);
    if (islenen.length) { toast('🎉', 'Satın alma hesabında', islenen.map((r) => SHOP.find((p) => p.id === r.item.productId)?.name ?? r.item.productId).join(', ')); onIslendi(); }
    for (const r of sonuclar) if (r.k === 'ret') toast('🙈', 'Satın alma bu hesaba işlenemedi', odemeRetMetni(r), 'bronze');
    const kalan = sonuclar.find((r) => r.k === 'bekle');
    if (kalan && kalan.k === 'bekle') toast('🧭', 'Henüz işlenemedi', `${kalan.message} Kayıt bu cihazda duruyor; bağlantı dönünce yeniden denenir.`, 'bronze');
    setBusy(false);
  };
  return (
    <div className="card stack bekleyen-odeme" role="status" data-testid="bekleyen-odeme">
      <b>Ödeme alındı; bağlantı dönünce hesabına işlenecek</b>
      <ul className="history">{list.map((o) => <li key={o.receipt}><span className="grow ellipsis">{SHOP.find((p) => p.id === o.productId)?.name ?? o.productId}</span><span className="muted">{fmtDate(o.at)}</span></li>)}</ul>
      <div className="muted small-note">Mağaza işlemi bu cihazda saklı. Sunucuya ulaşınca ürün kendiliğinden hesabına geçer; ikinci kez ödeme alınmaz.</div>
      <button className="btn small ghost" disabled={busy} onClick={() => void dene()}>{busy ? 'Deneniyor…' : 'Şimdi dene'}</button>
    </div>
  );
}

/**
 * Satın alımları geri yükle (Apple 3.1.1; tüketilmeyen ürün ve yenilenmeyen abonelik): mağaza hesabındaki işlemler RevenueCat'e iletilir,
 * sunucu (`shop.restore`) bu oyun hesabına işlenmemiş olanları işler. Tüketilebilir paketler (kristal, hızlandırıcı) işlendikten sonra
 * geri yüklenmez; başka bir oyun hesabına işlenmiş satın alma bu hesaba verilmez. Metin bunları açıkça söyler.
 */
function GeriYukle({ playerId, onDone }: { playerId: string; onDone: (r: OpMap['shop.restore']['res']) => void }) {
  const [busy, setBusy] = useState(false); const [sonuc, setSonuc] = useState<string | null>(null);
  const ad = (id: string) => SHOP.find((p) => p.id === id)?.name ?? id;
  const kalicilar = SHOP.filter(isRestorable).map((p) => p.name).join(' ve ');
  const run = async () => {
    const c = getNet(); const fn = platform().restorePurchases; if (!c || !fn) return;
    setBusy(true); setSonuc(null);
    try {
      const m = await fn(playerId);
      if (!m.ok) { setSonuc(m.error); return; }
      const r = await c.call('shop.restore', {});
      void odemeKuyrugu.taramaBitti(playerId);
      if (r.restored.length) {
        odemeIslendi(r.restored.map((x) => x.productId), r.wallet);
        platform().haptic('success');
        celebrate.banner({ icon: '🎉', title: 'Satın alımların hesabında', body: r.restored.map((x) => ad(x.productId)).join(', '), tone: 'gold' });
      }
      const satir = [
        r.restored.length ? `Hesabına işlendi: ${[...new Set(r.restored.map((x) => ad(x.productId)))].join(', ')}.` : '',
        r.alreadyHere.length ? `Zaten bu hesapta: ${r.alreadyHere.map(ad).join(', ')}.` : '',
        r.elsewhere.length ? `Başka bir oyun hesabına işlenmiş, bu hesaba verilmedi: ${r.elsewhere.map(ad).join(', ')}.` : '',
      ].filter(Boolean);
      setSonuc(satir.length ? satir.join(' ') : 'Bu mağaza hesabında bu oyun hesabına geri yüklenecek satın alma bulunamadı.');
      onDone(r);
    } catch (e) { setSonuc(errText(e)); } finally { setBusy(false); }
  };
  return (
    <div className="card stack geri-yukle" data-testid="geri-yukle">
      <b>Satın alımları geri yükle</b>
      <div className="muted small-note">{kalicilar} bu oyun hesabına bağlıdır. Bu hesapta görünmüyorsa ya da ödemesi alınıp hesabına işlenmemiş bir satın alma varsa buradan geri yükle. Kristal ve hızlandırıcı paketleri harcanır: hesabına işlendikten sonra geri yüklenmez. Başka bir oyun hesabına işlenmiş satın alma bu hesaba ikinci kez verilmez.</div>
      <button className="btn small ghost" data-testid="geri-yukle-dugme" disabled={busy} onClick={() => void run()}>{busy ? 'Geri yükleniyor…' : 'Satın alımları geri yükle'}</button>
      {sonuc && <div className="small-note" role="status" data-testid="geri-yukle-sonuc">{sonuc}</div>}
    </div>
  );
}

/**
 * takım hediyesinin içeriği yazıyla ve simgesi, sayısı, adı tek parça: "100 kristal + 200 jeton" (OT-buyuk-yazi-60: Büyük yazıda
 * "100 ◆ + ●" satır sonunda, "200" tek başına alt satırdaydı; "jeton" sözcüğü yoktu)
 */
function GiftParts({ items }: { items: readonly { kind: string; amount: number }[] }) {
  return <>{items.map((g, i) => <span key={i}>{i > 0 && ' + '}<span className="sayi-parca"><Art name={g.kind === 'kristal' ? 'crystal' : 'coin'} size="1.1em" className="art-inline" />{g.amount.toLocaleString('tr-TR')}{'\u00a0'}{g.kind === 'kristal' ? 'kristal' : 'jeton'}</span></span>)}</>;
}

/** aylık harcama: sunucu TL liste fiyatıyla sayar (mağaza fiyatı gösterilse de); her zaman TL */
function SpendCard({ sp, storePrices, onEdit }: { sp: SpendState; storePrices: boolean; onEdit: () => void }) {
  if (!sp.limitChosen) return (
    <div className="card spend" data-testid="sinir-secilmedi">
      <div className="row between"><b>Aylık harcama sınırı</b><button className="linkish" onClick={onEdit}>Sınırı seç</button></div>
      <div className="muted small-note">Henüz seçmedin. İlk satın almadan önce kendin seçersin; önerimiz {fmtTry(SPEND_LIMIT_SUGGESTED_TRY)}.{sp.monthTry > 0 ? ` Bu ay ${fmtTry(sp.monthTry)} harcandı.` : ''}</div>
    </div>
  );
  return (
    <div className="card spend">
      <div className="row between"><b>Bu ayki harcama (TL)</b><button className="linkish" onClick={onEdit}>Sınırı ayarla</button></div>
      <div className="row qbar"><Bar value={sp.limitTry ? sp.monthTry / sp.limitTry : 1} tone={sp.monthTry >= sp.limitTry ? 'coral' : 'green'} label="Aylık harcama" /><span className="qn">{fmtTry(sp.monthTry)} / {fmtTry(sp.limitTry)}</span></div>
      {/* sayaç takvim ayı (sunucu shop.ts resetAt): bu ay ne kadar kaldığı ve ne zaman sıfırlandığı (YN-197, OT-ekonomi-denetci-39) */}
      {sp.limitTry > 0 && <div className="small-note" data-testid="kalan-tutar">{kalanSatiri(sp)}</div>}
      {sp.pendingLimitTry != null && sp.pendingLimitAt != null && <div className="muted small-note">Yeni sınır {fmtTry(sp.pendingLimitTry)}: {fmtDate(sp.pendingLimitAt)} itibarıyla geçerli.</div>}
      {storePrices && <div className="muted small-note">Sınır, ürünlerin TL liste fiyatıyla sayılır.</div>}
    </div>
  );
}

const limitLabel = (n: number) => (n === 0 ? 'Kapalı' : `${n} TL`);

/**
 * İlk satın almadan önce aylık sınır seçimi (karar 28): önerilen 100 TL seçili gelir; ilk seçim hemen geçerli. "Satın alma kapalı"
 * da bir seçenektir. Kaydedince satın alma onayı açılır (üst bileşen yeni SpendState ile yeniden çizer).
 */
function FirstLimit({ onSaved, onCancel }: { onSaved: (s: SpendState) => void; onCancel?: () => void }) {
  const [v, setV] = useState<number>(SPEND_LIMIT_SUGGESTED_TRY); const [busy, setBusy] = useState(false);
  const save = async () => {
    const c = getNet(); if (!c) return;
    setBusy(true);
    try { const r = await c.call('shop.limit', { limitTry: v }); onSaved(r.spend); toast('🧭', 'Aylık sınırın kaydedildi', `Aylık sınır: ${v === 0 ? 'satın alma kapalı' : fmtTry(v)}`); } catch (e) { toast('🙈', 'Kaydedilemedi', errText(e), 'bronze'); }
    setBusy(false);
  };
  return (
    <div className="stack" data-testid="ilk-sinir">
      <div className="muted">Satın almadan önce bir ayda en çok ne kadar harcamak istediğini seç. Sınır TL'dir, ürünlerin TL liste fiyatıyla sayılır. Sonra düşürmek hemen geçerli olur; yükseltmek ayrıca onay ister ve 24 saat sonra geçerli olur.</div>
      <div className="limit-first" role="radiogroup" aria-label="Aylık harcama sınırı">
        {SPEND_LIMIT_FIRST_CHOICES.map((n) => (
          <button key={n} role="radio" aria-checked={v === n} className={`chip-btn${v === n ? ' on' : ''}`} data-testid={`ilk-sinir-${n}`} onClick={() => setV(n)}>
            {n === 0 ? 'Satın alma kapalı' : `${n} TL`}{n === SPEND_LIMIT_SUGGESTED_TRY && <small className="limit-tag"> · önerilen</small>}
          </button>))}
      </div>
      <button className="btn" data-testid="ilk-sinir-kaydet" disabled={busy} onClick={() => void save()}>{busy ? 'Kaydediliyor…' : 'Sınırı kaydet'}</button>
      {onCancel && <button className="btn ghost" onClick={onCancel}>Vazgeç</button>}
    </div>
  );
}

/** Sınırı değiştir: düşürmek hemen; yükseltmek ikinci bir onay adımı ister ve 24 saat sonra geçerli olur (karar 28). */
function LimitSheet({ sp, onClose, onSaved }: { sp: SpendState; onClose: () => void; onSaved: (s: SpendState) => void }) {
  const [v, setV] = useState(sp.pendingLimitTry ?? sp.limitTry);
  const [confirm, setConfirm] = useState(false);
  if (!sp.limitChosen) return <Sheet title="Aylık harcama sınırı" onClose={onClose}><FirstLimit onSaved={onSaved} /></Sheet>;
  const raise = v > sp.limitTry;
  const save = async (confirmRaise: boolean) => {
    const c = getNet(); if (!c) return;
    try {
      const r = await c.call('shop.limit', { limitTry: v, ...(confirmRaise ? { confirmRaise: true } : {}) });
      onSaved(r.spend); toast('🧭', raise ? 'Yükseltme 24 saat sonra geçerli' : 'Sınır hemen güncellendi', `Aylık sınır: ${limitLabel(v)}`);
    } catch (e) { toast('🙈', 'Kaydedilemedi', errText(e), 'bronze'); }
  };
  if (confirm && raise) return (
    <Sheet title="Sınırı yükselt?" onClose={onClose}>
      <div className="stack" data-testid="sinir-yukselt-onay">
        <div>Aylık sınırın <b>{limitLabel(sp.limitTry)}</b> → <b>{limitLabel(v)}</b> olacak.</div>
        <div className="muted">Yükseltme <b>24 saat sonra</b> geçerli olur; o zamana kadar bugünkü sınır geçerli kalır ve istersen sınırı yeniden düşürebilirsin.</div>
        <button className="btn" data-testid="sinir-yukselt-evet" onClick={() => void save(true)}>Evet, yükselt</button>
        <button className="btn ghost" onClick={() => setConfirm(false)}>Vazgeç</button>
      </div>
    </Sheet>
  );
  return (
    <Sheet title="Aylık harcama sınırı" onClose={onClose}>
      <div className="muted">Sınır TL'dir, ürünlerin TL liste fiyatıyla sayılır. Düşürmek hemen geçerli olur; yükseltmek ayrıca onay ister ve 24 saat sonra geçerli olur. Kapalı = satın alma kapalı.</div>
      <div className="limit-grid">{SPEND_LIMIT_OPTIONS.map((n) => <button key={n} className={`chip-btn${v === n ? ' on' : ''}`} onClick={() => setV(n)}>{limitLabel(n)}</button>)}</div>
      <button className="btn" data-testid="sinir-kaydet" onClick={() => (raise ? setConfirm(true) : void save(false))}>{raise ? 'Yükselt…' : 'Kaydet'}</button>
    </Sheet>
  );
}

/**
 * Sezon Kartı'nın işleyişi (karar 30; sunucu: players.ts passDaily, shop.ts deliver): satın alınan takvim günü (Türkiye saati) 1. gün;
 * 28 günün her birine 30 kristal. Girilmeyen günlerin kristali birikir ve sonraki girişte ödül kutusuna toplu gelir; toplam tam 840,
 * 28. günden sonra hiçbir şey gelmez. Kendiliğinden yenilenmez (App Store türü: yenilenmeyen abonelik).
 */
function PassTerms() {
  return (
    <ul className="pass-terms" data-testid="sezon-kosullari">
      <li>Satın aldığın andan başlayarak {PASS_DAYS} gün sürer; satın aldığın gün 1. gün sayılır.</li>
      <li>Her güne {PASS_DAILY_KRISTAL} kristal düşer; o günkü ilk girişinde ödül kutuna gelir.</li>
      <li>Oyuna girmediğin günlerin kristali kaybolmaz: birikir, bir sonraki girişinde ödül kutuna toplu gelir. Toplam {PASS_TOTAL_KRISTAL} kristal; {PASS_DAYS}. günden sonra kristal gelmez.</li>
      <li>Altın Koklea kostümü satın alır almaz dolabında.</li>
      <li>Kendiliğinden yenilenmez, yeniden ücret alınmaz (App Store bunu “yenilenmeyen abonelik” diye gösterir). Hesap başına bir kez; kart bu oyun hesabına bağlıdır.</li>
    </ul>
  );
}

/** Sezon Kartı ödül yolu: 28 gün, her güne 30 kristal (girilmeyen günlerinki birikir) + Altın Koklea kostümü (hemen) */
function PassPath() {
  return (
    <div className="pass-path" aria-label="Sezon Kartı ödül yolu">
      <div className="pp-day first"><b>Hemen</b><span><Art name="palette" size="1.15em" className="art-inline" /> Altın Koklea</span></div>
      {Array.from({ length: PASS_DAYS }, (_, i) => <div className="pp-day" key={i}><b>{i + 1}. gün</b><span><Art name="crystal" size="1.15em" className="art-inline" /> {PASS_DAILY_KRISTAL}</span></div>)}
    </div>
  );
}
