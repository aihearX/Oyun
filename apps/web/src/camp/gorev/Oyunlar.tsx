/**
 * Kamp oyunları. Ton Avı (Odyometri Odası): "ses var mı?" ve "hangisi daha ince?" denemeleri; sesler rahat bir düzeyde çalınır,
 * eşik aranmaz — BİR İŞİTME TESTİ DEĞİLDİR (ekranda yazar). Yalnız sesle oynanır: ekranda sesin çalıp çalmadığını ya da hangisinin
 * daha ince olduğunu ele veren hiçbir ipucu yoktur. Oyun sesi kapalıysa tur başlamaz; sesi açmayı öneren bir kart çıkar.
 * Timpanogram Eşleştir (Timpanometri Kulesi): 5 soruluk tur; sorular büyük bir bankadan, oyuncunun sunucudaki destesinden gelir
 * (eğri → bulgu, bulgu → eğri, sayılar → tip, kısa vaka, sağ/sol, bilgi). Tur tohumu ve puanlama sunucudadır; günde 5 tur ödüllü.
 */
import { useEffect, useRef, useState } from 'react';
import { useNet } from '@odi/net/store';
import type { KampOdul, KampOyunTur } from '@odi/shared';
import { EGRI_ADI, KAMP_OYUN, KG_KURAL, TIMP_BICIM_ADI, timpanoTuru, tonTuru, type TimpanoBulmaca, type TimpSecenek, type TonDeneme } from '@odi/content';
import { audio } from '@odi/audio';
import { act } from '../../net';
import { useStore } from '../../store';
import { Art } from '../../ui/art';
import { OtoskopSvg, TimpanogramSvg } from './charts';
import { KgIcon } from './art';
import { KgSheet } from './Klinik';
import { OdulChips } from './GorevPanel';
import { celebrateReward, openPanel, useKg } from './state';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
// eski "görsel ipucu" ayarı kaldırıldı: kayıtlı değeri bir kez temizle
try { localStorage.removeItem('odi.kg.gorsel'); } catch { /* gizli mod */ }

const sesAcikSimdi = () => { const st = useStore.getState(); return st.sounds && (st.sfxVol ?? 0) >= 0.05; };
/** Ton Avı yalnız sesle oynanır: oyun sesi açık ve efekt düzeyi duyulur olmalı */
function useSesAcik(): [boolean, () => void] {
  const sounds = useStore((s) => s.sounds); const sfx = useStore((s) => s.sfxVol);
  const ac = () => { const st = useStore.getState(); st.setSounds(true); if ((st.sfxVol ?? 0) < 0.3) st.setVolumes({ sfxVol: 0.8 }); try { audio.unlock(); } catch { /* yok */ } };
  return [sounds && (sfx ?? 0) >= 0.05, ac];
}

export function OyunPanel({ oyun }: { oyun: 'ton' | 'timpano' }) {
  const def = KAMP_OYUN[oyun]; const kg = useKg((s) => s.kg); const duzey = useStore((s) => s.knowledge);
  const gun = kg?.oyun.find((g) => g.oyun === oyun);
  const [round, setRound] = useState<KampOyunTur | null>(null);
  const [sonuc, setSonuc] = useState<{ score: number; total: number; reward: KampOdul } | null>(null);
  const [busy, setBusy] = useState(false); const [sesAcik, acSes] = useSesAcik();
  const basladi = useRef(0); const [bekle, setBekle] = useState(false);
  const close = () => { audio.play('tap'); audio.music('menu'); openPanel(null); };
  const start = async () => {
    if (oyun === 'ton' && !sesAcikSimdi()) return;
    setBusy(true); const r = await act('koyun.start', { oyun, duzey }); setBusy(false);
    if (!r) return; audio.unlock(); if (oyun === 'ton') audio.music(null); setSonuc(null); basladi.current = Date.now(); setRound(r.round);
  };
  const finish = async (answers: number[]) => {
    if (!round) return;
    // sunucu çok kısa turu kabul etmez (en az süre); hızlı okuyan oyuncunun turu boşa gitmesin diye kalan süre beklenir
    const kalan = KG_KURAL.oyunEnAzMs[oyun] + 400 - (Date.now() - basladi.current);
    if (kalan > 0) { setBekle(true); await wait(kalan); setBekle(false); }
    const r = await act('koyun.finish', { id: round.id, answers });
    setRound(null); if (!r) return;
    useKg.setState({ kg: r.state }); useNet.setState({ wallet: r.wallet });
    setSonuc({ score: r.score, total: r.total, reward: r.reward });
    audio.play(r.score === r.total ? 'star3' : r.score >= r.total * 0.6 ? 'star2' : 'star1');
    celebrateReward(`${def.ad}: ${r.score}/${r.total}`, r.reward);
  };
  return (
    <KgSheet title={def.ad} icon={<KgIcon name={def.art} size={30} />} onClose={close} testid={`oyun-${oyun}`} wide>
      {bekle && <small className="kg-note" data-testid="oyun-bekle">Tur puanlanıyor…</small>}
      {round ? (oyun === 'ton' ? <TonTur round={round} onDone={(a) => void finish(a)} /> : <TimpanoTur round={round} onDone={(a) => void finish(a)} />) : (
        <div className="kg-oyun-giris">
          {sonuc && <div className="kg-oyun-sonuc" data-testid="oyun-sonuc" data-score={sonuc.score}><b>{sonuc.score}/{sonuc.total}</b><span>{sonuc.score === sonuc.total ? 'Kusursuz!' : sonuc.score >= sonuc.total * 0.6 ? 'Güzel tur!' : 'Bir tur daha dene!'}</span>
            {Object.keys(sonuc.reward).length ? <OdulChips r={sonuc.reward} /> : <small>Bu tur ödülsüz (bugünün ödüllü turları bitti).</small>}</div>}
          <p>{def.plain}</p>
          {oyun === 'ton' && <ul className="kg-kural"><li>“Ses var mı?” denemesinde dinle; sonra ses olup olmadığını seç.</li><li>“Hangisi daha ince?” denemesinde iki ses çalar; daha ince (tiz) olanı seç.</li><li>Yalnız sesle oynanır; kulaklık önerilir.</li><li className="kg-uyari"><Art name="ear" size={16} /> Bu bir işitme testi değildir. Sesler rahat bir düzeyde çalınır. İşitmenle ilgili bir kaygın varsa bir odyoloğa ya da hekime danış.</li></ul>}
          {oyun === 'timpano' && <ul className="kg-kural"><li>Her turda {KG_KURAL.timpanoBulmaca} soru gelir: eğriler, sayılar, kısa vakalar ve bilgi soruları. Sorular büyük bir bankadan gelir; çoğunu görmeden tekrar gelmez.</li><li>Timpanogram tek başına tanı koydurmaz: eğrinin ne gösterdiğini seç.</li><li>{duzey === 'genel' ? 'İpucu: tepeli eğri zarın rahat hareket ettiğini, düz eğri hareket etmediğini gösterir.' : 'Tepe basıncına, yüksekliğine ve düz eğride kanal hacmine bak (Jerger).'}</li></ul>}
          {gun && <small className="kg-note" data-testid="oyun-gun">{gun.rewarded < gun.cap ? `Bugün ödüllü tur: ${gun.rewarded}/${gun.cap}` : `Bugünün ödüllü turları bitti (${gun.cap}/${gun.cap}); dilediğin kadar eğlence için oynayabilirsin.`}</small>}
          {oyun === 'ton' && !sesAcik ? (
            <div className="kg-ses-kapali" data-testid="ton-ses-kapali" role="note">
              <b><Art name="ear" size={18} /> Ton Avı sesle oynanır: sesi aç (Ayarlar › Ses)</b>
              <span>Oyun sesi kapalı ya da çok kısık. Kulaklıkla oynamanı öneririz.</span>
              <button className="btn" data-testid="ton-sesi-ac" onClick={() => { acSes(); audio.play('tap'); }}>Sesi aç</button>
            </div>
          ) : <button className="btn" data-testid="oyun-basla" disabled={busy || (gun ? !gun.open : false)} onClick={() => void start()}>{sonuc ? 'Bir tur daha' : 'Başla'}</button>}
          {gun && !gun.open && <small className="kg-kilit"><Art name="lock" size={14} /> {gun.locked}</small>}
        </div>
      )}
    </KgSheet>
  );
}

// ------------------------------------------------------------------ Ton Avı (yalnız ses; ekranda cevabı ele veren ipucu yok)
function TonTur({ round, onDone }: { round: KampOyunTur; onDone: (a: number[]) => void }) {
  const trials = useRef<TonDeneme[]>(tonTuru(round.seed, round.duzey)).current;
  const [i, setI] = useState(0); const [faz, setFaz] = useState<'dinle' | 'cevap' | 'geri'>('dinle');
  /** "hangisi daha ince" denemesinde şu an kaçıncı ses çalıyor (1/2): sıra bilgisidir, perdeyi göstermez */
  const [sira, setSira] = useState<0 | 1 | 2>(0);
  const [dogru, setDogru] = useState<boolean | null>(null); const [tekrar, setTekrar] = useState(false);
  const answers = useRef<number[]>([]); const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const t = trials[i]!;
  const play = async (d: TonDeneme) => {
    setFaz('dinle'); setSira(0);
    if (d.tur === 'var') {
      // dinleme penceresi her denemede aynı uzunlukta: ses olsa da olmasa da ekran aynı kalır
      await wait(d.at); if (!alive.current) return;
      if (d.var) audio.tone(d.hz, 0.4, 0.09);
      await wait(Math.max(300, 1900 - d.at));
    } else {
      await wait(250); if (!alive.current) return;
      setSira(1); audio.tone(d.a, 0.45, 0.09); await wait(650); setSira(0); await wait(150);
      setSira(2); audio.tone(d.b, 0.45, 0.09); await wait(650); setSira(0);
    }
    if (alive.current) setFaz('cevap');
  };
  useEffect(() => { setTekrar(false); void play(t); }, [i]);
  const cevap = async (x: number) => {
    const ok = (t.tur === 'var' ? (t.var ? 1 : 0) : t.dogru) === x;
    answers.current.push(x); setDogru(ok); setFaz('geri'); audio.play(ok ? 'coin' : 'tap');
    await wait(650); if (!alive.current) return; setDogru(null);
    if (i + 1 >= trials.length) onDone(answers.current); else setI(i + 1);
  };
  return (
    <div className="kg-ton" data-testid="ton-tur" data-deneme={i} data-tur={t.tur} data-faz={faz}>
      <div className="kg-dots">{trials.map((_, k) => <i key={k} className={k < i ? 'on' : k === i ? 'cur' : ''} />)}</div>
      <h3>{t.tur === 'var' ? 'Ses var mı?' : 'Hangisi daha ince?'}</h3>
      <div className="kg-ton-sahne" aria-live="polite">
        {t.tur === 'var'
          ? <div className={`kg-nabiz${faz === 'dinle' ? ' dinle' : ''}`}><Art name="ear" size={46} /></div>
          : <div className="kg-perde">{[1, 2].map((k) => <div key={k} className={`kg-perde-col${sira === k ? ' on' : ''}`}><b>{k}</b></div>)}</div>}
        <small>{faz === 'dinle' ? 'Dinle…' : faz === 'cevap' ? 'Seçimini yap' : dogru ? 'Doğru!' : 'Olmadı'}</small>
      </div>
      {t.tur === 'var' ? (
        <div className="kg-cevap"><button className="btn" data-cevap="1" disabled={faz !== 'cevap'} onClick={() => void cevap(1)}>Ses vardı</button><button className="btn ghost" data-cevap="0" disabled={faz !== 'cevap'} onClick={() => void cevap(0)}>Ses yoktu</button></div>
      ) : (
        <div className="kg-cevap"><button className="btn" data-cevap="0" disabled={faz !== 'cevap'} onClick={() => void cevap(0)}>1. daha ince</button><button className="btn" data-cevap="1" disabled={faz !== 'cevap'} onClick={() => void cevap(1)}>2. daha ince</button>
          <button className="btn ghost small" disabled={faz !== 'cevap' || tekrar} onClick={() => { setTekrar(true); void play(t); }}>Bir daha dinle</button></div>
      )}
      <small className="kg-uyari"><Art name="ear" size={14} /> BU BİR İŞİTME TESTİ DEĞİLDİR. Bu bir dinleme oyunudur; kulaklık önerilir.</small>
    </div>
  );
}

// ------------------------------------------------------------------ Timpanogram Eşleştir
const n1 = (v: number) => v.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
function Secenek({ o, genel, sec }: { o: TimpSecenek; genel: boolean; sec: string }) {
  if (o.egri) return <span className="kg-opt-egri"><TimpanogramSvg tek={o.egri} mini title="Seçenek eğrisi" /><small>{genel ? `kanal hacmi ${n1(o.egri.hacim)} ml` : `${o.egri.basinc === null ? 'tepe yok' : `${o.egri.basinc} daPa`} · ${n1(o.egri.uyum)} ml · hacim ${n1(o.egri.hacim)} ml`}</small></span>;
  if (o.teknik && !genel) return <span className="kg-opt-txt"><b>{o.teknik}</b><small>{o.metin}</small></span>;
  return <span className="kg-opt-txt" data-sec={sec}>{o.metin}</span>;
}
function TimpanoTur({ round, onDone }: { round: KampOyunTur; onDone: (a: number[]) => void }) {
  const tur = useRef<TimpanoBulmaca[]>(timpanoTuru(round.seed, round.duzey, round.items)).current;
  const [i, setI] = useState(0); const [secim, setSecim] = useState<number | null>(null);
  const answers = useRef<number[]>([]);
  const b = tur[i]!; const genel = round.duzey === 'genel';
  const sec = (k: number) => { if (secim !== null) return; setSecim(k); answers.current.push(k); audio.play(k === b.dogru ? 'coin' : 'tap'); };
  const bitti = useRef(false);
  const ileri = () => { if (i + 1 >= tur.length) { if (!bitti.current) { bitti.current = true; onDone(answers.current); } return; } setSecim(null); setI(i + 1); };
  const egriSecenek = b.bicim === 'bulgu-egri';
  const geriRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (secim !== null) geriRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [secim]);
  return (
    <div className="kg-timpano" data-testid="timpano-tur" data-bulmaca={i} data-soru={b.id} data-bicim={b.bicim}>
      <div className="kg-dots">{tur.map((_, k) => <i key={k} className={k < i ? 'on' : k === i ? 'cur' : ''} />)}</div>
      <small className="kg-bicim">{TIMP_BICIM_ADI[b.bicim]}{b.yas ? ` · ${b.yas}` : ''}</small>
      <h3>{b.soru}</h3>
      {b.hikaye && <p className="kg-vinyet">{b.hikaye}</p>}
      {b.bulgu && <p className="kg-bulgu"><b>{genel ? EGRI_ADI[b.bulgu].sade : `${EGRI_ADI[b.bulgu].teknik} — ${EGRI_ADI[b.bulgu].sade}`}</b></p>}
      {b.sayilar && b.egri && <div className="kg-sayilar" data-testid="timp-sayilar"><span><small>Tepe basıncı</small><b>{b.egri.basinc === null ? 'tepe yok' : `${b.egri.basinc} daPa`}</b></span><span><small>Admitans</small><b>{n1(b.egri.uyum)} ml</b></span><span><small>Kanal hacmi</small><b>{n1(b.egri.hacim)} ml</b></span></div>}
      {!b.sayilar && b.egri && (
        <div className={b.otoskopi ? 'kg-vinyet-row' : undefined}>
          <TimpanogramSvg tek={b.egri} values title="Soru timpanogramı" />
          {b.otoskopi && <figure className="kg-vinyet-oto"><OtoskopSvg f={b.otoskopi} ear="R" size={84} /><figcaption>Otoskopi görünümü</figcaption></figure>}
        </div>
      )}
      {(b.sag || b.sol) && <TimpanogramSvg R={b.sag} L={b.sol} title="Sağ ve sol timpanogram" />}
      {b.sag && b.sol && <small className="kg-note">Sağ: kırmızı düz çizgi · Sol: mavi kesikli çizgi · kanal hacmi sağ {n1(b.sag.hacim)} ml, sol {n1(b.sol.hacim)} ml</small>}
      {!genel && b.egri && !b.sayilar && <small className="kg-note">{b.egri.basinc === null ? 'Tepe yok' : `Tepe ${b.egri.basinc} daPa`} · admitans {n1(b.egri.uyum)} ml · kanal hacmi {n1(b.egri.hacim)} ml</small>}
      <div className={`kg-opts${egriSecenek ? ' egri' : ''}`}>
        {b.secenek.map((o, k) => <button key={o.anahtar} className={`kg-opt${secim === null ? '' : k === b.dogru ? ' ok' : k === secim ? ' no' : ' dim'}`} data-secenek={k} data-anahtar={o.anahtar} disabled={secim !== null} onClick={() => sec(k)}><Secenek o={o} genel={genel} sec={o.anahtar} /></button>)}
      </div>
      {secim !== null && (
        <div ref={geriRef} className={`kg-geri ${secim === b.dogru ? 'ok' : 'no'}`} data-testid="timp-aciklama">
          <b>{secim === b.dogru ? 'Doğru!' : 'Doğrusu işaretli.'}</b> {b.aciklama}
          <small className="kg-kaynak">Kaynak: {b.kaynak}</small>
          <button className="btn small" data-testid="timp-ileri" onClick={ileri}>{i + 1 >= tur.length ? 'Turu bitir' : 'Sonraki soru'}</button>
        </div>
      )}
    </div>
  );
}
