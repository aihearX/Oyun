/**
 * Görevler paneli (kamp üst göstergesindeki "Görevler" düğmesi): Kampın Hikâyesi (Tüy Dede), günlük kamp görevleri + haftalık
 * kamp hedefi, kamp etkinlikleri (Klinik, Ton Avı, Timpanogram Eşleştir, takım kliniği) ve başarılar. İlerleme sunucudan gelir;
 * "Al" düğmesi bir ödülü tam bir kez alır (kutlama yalnız başarılı yanıtta, bir kez).
 */
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { KampOdul, KgBasamak, KgGorev, KgState } from '@odi/shared';
import { KAMP_OYUN, KG_KURAL, odulMetni } from '@odi/content';
import { audio } from '@odi/audio';
import { TuyDede } from '../../ftue/Narrator';
import { lineText } from '../../ftue/script';
import { speakLine, stopVoiceIf } from '../../ftue/voice';
import { Art } from '../../ui/art';
import { fmtLeft, useNow } from '../../ui/social';
import { KgIcon } from './art';
import { KgSheet } from './Klinik';
import { act } from '../../net';
import { claimKg, openPanel, refreshKg, useKg, type GorevSekme } from './state';

const satir = (id: string) => { try { return lineText(id); } catch { return ''; } };
const DINLENDI = 'odi.kg.dinlendi';
function dinlendi(id: string): boolean { try { const l = JSON.parse(localStorage.getItem(DINLENDI) ?? '[]') as string[]; if (l.includes(id)) return true; localStorage.setItem(DINLENDI, JSON.stringify([...l, id].slice(-60))); return false; } catch { return true; } }
const from = (e: MouseEvent<HTMLElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

export function OdulChips({ r, small }: { r: KampOdul; small?: boolean }) {
  return <span className={`kg-odul${small ? ' small' : ''}`}>{odulMetni(r).map((t) => <i key={t} className="kg-odul-chip">{t}</i>)}</span>;
}
export function sekmeRozet(s: KgState): Record<GorevSekme, number> {
  const tiers = (t: KgBasamak[]) => t.filter((x) => x.reached && !x.claimed).length;
  return {
    hikaye: s.story.chapter?.done ? 1 : 0,
    gunluk: s.daily.tasks.filter((t) => t.done && !t.claimed).length + (s.weekly ? tiers(s.weekly.tiers) : 0),
    etkinlik: (s.takim?.reached && s.takim.contributed && !s.takim.claimed ? 1 : 0),
    basari: s.achievements.reduce((a, b) => a + tiers(b.tiers), 0),
  };
}

export function GorevPanel({ tab }: { tab: GorevSekme }) {
  const kg = useKg((s) => s.kg);
  useEffect(() => { void refreshKg(); }, []);
  const close = () => { audio.play('tap'); openPanel(null); };
  const rozet = kg ? sekmeRozet(kg) : null;
  const TABS: { id: GorevSekme; label: string; icon: string }[] = [{ id: 'hikaye', label: 'Hikâye', icon: 'gorev' }, { id: 'gunluk', label: 'Günlük', icon: 'kamp' }, { id: 'etkinlik', label: 'Etkinlik', icon: 'ton' }, { id: 'basari', label: 'Başarı', icon: 'yildiz' }];
  return (
    <KgSheet title="Kamp Görevleri" icon={<KgIcon name="gorev" size={30} />} onClose={close} testid="kg-panel" wide>
      <div className="kg-tabs four" role="tablist">
        {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} data-tab={t.id} onClick={() => { audio.play('tab'); openPanel({ kind: 'gorev', tab: t.id }); }}>
          <KgIcon name={t.icon} size={18} /> {t.label}{rozet && rozet[t.id] > 0 && <i className="kg-badge">{rozet[t.id]}</i>}</button>)}
      </div>
      {!kg ? <div className="kg-note">Görevler yükleniyor…</div>
        : tab === 'hikaye' ? <Hikaye s={kg} /> : tab === 'gunluk' ? <Gunluk s={kg} /> : tab === 'etkinlik' ? <Etkinlik s={kg} /> : <Basari s={kg} />}
      {kg && !kg.growth && (kg.pending.kampXp > 0 || kg.pending.dekor.length > 0) && <p className="kg-note" data-testid="kg-bekleyen">Kamp XP ve dekor ödüllerin saklanıyor ({kg.pending.kampXp} Kamp XP{kg.pending.dekor.length ? `, ${kg.pending.dekor.length} dekor` : ''}); kamp büyümesi açılınca kampına eklenir.</p>}
    </KgSheet>
  );
}

function Ilerleme({ progress, need, locked }: { progress: number; need: number; locked: string | null }) {
  return locked ? <small className="kg-kilit"><Art name="lock" size={14} /> {locked}</small>
    : <div className="kg-ilerleme"><div className="kg-bar"><i style={{ width: `${Math.round((progress / need) * 100)}%` }} /></div><small>{progress}/{need}</small></div>;
}
/** hikâye adımı; takıma bağlı adımda "ya da" satırı (takımsız eşdeğeri): ikisinden biri adımı tamamlar */
function Adim({ t }: { t: KgGorev }) {
  const ya = t.ya;
  // adım "ya da" yoluyla bittiyse ana yolun boş çubuğu gösterilmez (tamamlanan satır "ya da"dır)
  const ana = !(ya?.done && t.progress < t.need);
  return (
    <div className={`kg-adim${t.done ? ' done' : ''}${t.locked && !ya ? ' locked' : ''}${ya ? ' has-ya' : ''}`} data-adim={t.id}>
      <span className="kg-adim-ic"><KgIcon name={t.art} size={26} /></span>
      <div className="grow min0"><b>{t.text}</b>
        {ana && <Ilerleme progress={t.progress} need={t.need} locked={t.locked} />}
        {ya && (
          <div className={`kg-ya${ya.done ? ' done' : ''}`} data-ya={ya.id}>
            <small className="kg-ya-etiket">ya da</small>
            <b>{ya.text}</b>
            <Ilerleme progress={ya.progress} need={ya.need} locked={ya.locked} />
          </div>
        )}
      </div>
      {t.done && <Art name="check" size={22} />}
    </div>
  );
}

function Hikaye({ s }: { s: KgState }) {
  const busy = useKg((x) => x.busy);
  const [son, setSon] = useState<{ no: number; title: string; outro: string } | null>(null);
  const c = s.story.chapter;
  const talk = useRef(-1);
  useEffect(() => {
    if (!c || son) return;
    if (!dinlendi(c.intro)) talk.current = speakLine(satir(c.intro), c.intro);
    return () => stopVoiceIf(talk.current);
  }, [c?.intro, !!son]);
  const claim = async (e: MouseEvent<HTMLButtonElement>) => {
    if (!c) return; const at = from(e);
    const r = await claimKg(c.ref, `Bölüm ${c.no}: ${c.title}`, { from: at, big: true });
    if (r) { setSon({ no: c.no, title: c.title, outro: c.outro }); talk.current = speakLine(satir(c.outro), c.outro); }
  };
  if (son) return (
    <div className="kg-dede done" data-testid="kg-bolum-son">
      <span className="kg-dede-yuz"><TuyDede size={64} mood="wow" /></span>
      <div><small>Bölüm {son.no} tamam · {son.title}</small><p>{satir(son.outro)}</p>
        <button className="btn small" onClick={() => setSon(null)}>{s.story.chapter ? `Sıradaki: ${s.story.chapter.title}` : 'Tamam'}</button></div>
    </div>
  );
  if (!c) return <div className="kg-empty"><TuyDede size={70} mood="wink" /><b>Kampın Hikâyesi tamam!</b><span>{s.story.total} bölümün hepsini bitirdin. Günlük görevler ve başarılar seni bekliyor.</span></div>;
  return (
    <div className="kg-story" data-testid="kg-story" data-bolum={c.no}>
      <div className="kg-story-head"><small>Kampın Hikâyesi · Bölüm {c.no}/{s.story.total}</small><b>{c.title}</b>
        <div className="kg-pips">{Array.from({ length: s.story.total }, (_, i) => <i key={i} className={i < s.story.claimed ? 'on' : i === s.story.claimed ? 'cur' : ''} />)}</div></div>
      <div className="kg-dede">
        <span className="kg-dede-yuz"><TuyDede size={54} mood="happy" /></span>
        <p>{satir(c.intro)}</p>
        <button className="kg-dinle" aria-label="Tüy Dede’yi dinle" onClick={() => { stopVoiceIf(talk.current); talk.current = speakLine(satir(c.intro), c.intro); }}><Art name="sound" size={20} /></button>
      </div>
      <div className="kg-adimlar">{c.steps.map((t) => <Adim key={t.id} t={t} />)}</div>
      <div className="kg-claim-row">
        <div className="grow min0"><small>Bölüm ödülü</small><OdulChips r={c.reward} small /></div>
        <button className="btn gold" data-testid="kg-al" data-ref={c.ref} disabled={!c.done || busy === c.ref} onClick={(e) => void claim(e)}>{c.done ? 'Ödülü al' : `${c.steps.filter((x) => x.done).length}/${c.steps.length}`}</button>
      </div>
      {s.story.next && <small className="kg-note">Sonra: Bölüm {s.story.next.no} · {s.story.next.title}</small>}
    </div>
  );
}

function Gunluk({ s }: { s: KgState }) {
  const busy = useKg((x) => x.busy); const now = useNow(30_000);
  const [degis, setDegis] = useState<string | null>(null);
  const reroll = async (id: string) => { setDegis(id); const r = await act('kg.reroll', { id }); setDegis(null); if (r) { useKg.setState({ kg: r.state }); audio.play('whoosh'); } };
  return (
    <div className="kg-gunluk">
      {s.weekly && <Haftalik s={s} />}
      <div className="kg-sec-head"><b>Bugünün kamp görevleri</b><small>Yenilenme: {fmtLeft(Math.max(0, s.dayEndsAt - now))}</small></div>
      <div className="kg-gorevler">
        {s.daily.tasks.map((t) => (
          <div key={t.id} className={`kg-gorev${t.done ? ' done' : ''}${t.claimed ? ' claimed' : ''}`} data-gorev={t.id}>
            <span className="kg-adim-ic"><KgIcon name={t.art} size={28} /></span>
            <div className="grow min0"><b>{t.text}</b>
              {t.locked && !t.done ? <small className="kg-kilit"><Art name="lock" size={14} /> {t.locked}</small> : <div className="kg-ilerleme"><div className="kg-bar"><i style={{ width: `${Math.round((t.progress / t.need) * 100)}%` }} /></div><small>{t.progress}/{t.need}</small></div>}
              {t.reward && <OdulChips r={t.reward} small />}
            </div>
            {t.claimed ? <span className="kg-alindi">Alındı</span>
              : t.done ? <button className="btn small gold" data-testid="kg-al" data-ref={t.ref} disabled={busy === t.ref} onClick={(e) => void claimKg(t.ref, 'Kamp görevi tamam!', { from: from(e) })}>Al</button>
                : s.daily.rerollLeft > 0 ? <button className="kg-degis" data-testid="kg-degistir" aria-label={`Görevi değiştir: ${t.text}`} disabled={!!degis} onClick={() => void reroll(t.id)}><Art name="refresh" size={18} /><small>Değiştir</small></button> : null}
          </div>
        ))}
      </div>
      <small className="kg-note">{s.daily.rerollLeft > 0 ? 'Bugün bir görevi değiştirebilirsin.' : 'Bugünün değiştirme hakkı kullanıldı.'} Günlük görevler her gün gece yarısı yenilenir.</small>
    </div>
  );
}

function Haftalik({ s }: { s: KgState }) {
  const w = s.weekly!; const busy = useKg((x) => x.busy); const max = w.tiers[w.tiers.length - 1]!.need; const now = useNow(60_000);
  return (
    <div className="kg-hafta" data-testid="kg-hafta">
      <div className="kg-sec-head"><b><KgIcon name={w.art} size={20} /> Haftalık kamp hedefi</b><small>{fmtLeft(Math.max(0, s.weekEndsAt - now))}</small></div>
      <div className="kg-hafta-text">{w.text}: <b>{w.progress}</b></div>
      <div className="kg-hafta-bar"><div className="kg-bar"><i style={{ width: `${Math.min(100, Math.round((w.progress / max) * 100))}%` }} /></div>
        {w.tiers.map((t) => <span key={t.ref} className={`kg-tier-mark${t.reached ? ' on' : ''}`} style={{ left: `${(t.need / max) * 100}%` }}>{t.need}</span>)}</div>
      <div className="kg-tiers">
        {w.tiers.map((t, i) => (
          <div key={t.ref} className={`kg-tier-box${t.claimed ? ' claimed' : t.reached ? ' ready' : ''}`}>
            <small>{i + 1}. basamak · {t.need}</small><OdulChips r={t.reward} small />
            {t.claimed ? <span className="kg-alindi">Alındı</span> : t.reached ? <button className="btn small gold" data-testid="kg-al" data-ref={t.ref} disabled={busy === t.ref} onClick={(e) => void claimKg(t.ref, `Haftalık hedef: ${i + 1}. basamak`, { from: from(e), big: i === 2 })}>Al</button> : <span className="kg-kalan">{t.need - w.progress} kaldı</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Etkinlik({ s }: { s: KgState }) {
  const busy = useKg((x) => x.busy);
  return (
    <div className="kg-etkinlik">
      <button className={`kg-etk${s.vaka.open ? '' : ' locked'}`} data-testid="etk-klinik" disabled={!s.vaka.open} onClick={() => { audio.play('tap'); openPanel({ kind: 'klinik', tab: 'salon' }); }}>
        <KgIcon name="klinik" size={40} /><span className="grow min0"><b>Hasta Vakaları</b><small>{s.vaka.open ? `${s.vaka.waiting} hasta bekliyor · günde en çok ${KG_KURAL.vakaGunluk} yeni hasta` : s.vaka.locked}</small></span>
        {s.vaka.open && s.vaka.waiting > 0 && <i className="kg-badge">{s.vaka.waiting}</i>}
      </button>
      {s.oyun.map((g) => (
        <button key={g.oyun} className={`kg-etk${g.open ? '' : ' locked'}`} data-testid={`etk-${g.oyun}`} disabled={!g.open} onClick={() => { audio.play('tap'); openPanel({ kind: 'oyun', oyun: g.oyun }); }}>
          <KgIcon name={KAMP_OYUN[g.oyun].art} size={40} /><span className="grow min0"><b>{KAMP_OYUN[g.oyun].ad}</b>
            <small>{g.open ? (g.rewarded < g.cap ? `Bugün ödüllü tur: ${g.rewarded}/${g.cap}` : `Bugünün ödüllü turları bitti (${g.cap}/${g.cap}); eğlence için oynayabilirsin`) : g.locked}</small></span>
        </button>
      ))}
      {s.takim && (
        <div className="kg-takim" data-testid="kg-takim">
          <div className="kg-sec-head"><b><KgIcon name="takim" size={20} /> Takım kliniği</b><small>bu hafta</small></div>
          <div className="kg-hafta-text">Takımca ilk kez çözülen vaka: <b>{s.takim.progress}/{s.takim.need}</b></div>
          <div className="kg-bar"><i style={{ width: `${Math.min(100, Math.round((s.takim.progress / s.takim.need) * 100))}%` }} /></div>
          <div className="kg-claim-row"><div className="grow min0"><OdulChips r={s.takim.reward} small />{!s.takim.contributed && <small className="kg-note">Ödül için bu hafta en az bir vaka çöz.</small>}</div>
            {s.takim.claimed ? <span className="kg-alindi">Alındı</span> : <button className="btn small gold" data-testid="kg-al" data-ref={s.takim.ref} disabled={!s.takim.reached || !s.takim.contributed || busy === s.takim.ref} onClick={(e) => void claimKg(s.takim!.ref, 'Takım kliniği hedefi!', { from: from(e) })}>Al</button>}</div>
        </div>
      )}
      <small className="kg-note">Kamp oyunlarında günde {KG_KURAL.oyunOdulluTur} tur ödüllüdür; sonrası yalnız eğlence için. Ton Avı bir işitme testi değildir.</small>
    </div>
  );
}

function Basari({ s }: { s: KgState }) {
  const busy = useKg((x) => x.busy);
  return (
    <div className="kg-basarilar">
      {s.achievements.map((a) => {
        const next = a.tiers.find((t) => !t.claimed); const ready = a.tiers.find((t) => t.reached && !t.claimed); const top = a.tiers[a.tiers.length - 1]!;
        const target = next ?? top;
        return (
          <div key={a.id} className={`kg-basari${ready ? ' ready' : ''}${a.locked ? ' locked' : ''}`} data-basari={a.id}>
            <span className="kg-adim-ic"><KgIcon name={a.art} size={30} /></span>
            <div className="grow min0"><b>{a.title}</b><small>{a.text}</small>
              <div className="kg-pips">{a.tiers.map((t) => <i key={t.ref} className={t.claimed ? 'on' : t.reached ? 'cur' : ''} />)}</div>
              {a.locked && !ready ? <small className="kg-kilit"><Art name="lock" size={14} /> {a.locked}</small>
                : <div className="kg-ilerleme"><div className="kg-bar"><i style={{ width: `${Math.min(100, Math.round((a.progress / target.need) * 100))}%` }} /></div><small>{Math.min(a.progress, target.need)}/{target.need}</small></div>}
              {next && <OdulChips r={next.reward} small />}
            </div>
            {ready ? <button className="btn small gold" data-testid="kg-al" data-ref={ready.ref} disabled={busy === ready.ref} onClick={(e) => void claimKg(ready.ref, `Başarı: ${a.title}`, { from: from(e), big: !!ready.reward.dekor })}>Al</button>
              : !next ? <Art name="trophy" size={26} /> : null}
          </div>
        );
      })}
    </div>
  );
}
