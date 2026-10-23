/**
 * Kamp oyunları. Ton Avı (Odyometri Odası): "ses var mı?" ve "hangisi daha ince?" denemeleri; sesler rahat bir düzeyde çalınır,
 * eşik aranmaz — BİR İŞİTME TESTİ DEĞİLDİR (ekranda yazar). Ses kapalıysa ya da isteyene görsel ipucu: aynı oyun görerek oynanır.
 * Timpanogram Eşleştir (Timpanometri Kulesi): eğriye bak, anlamını seç. Tur tohumu ve puanlama sunucudadır; günde 5 tur ödüllü.
 */
import { useEffect, useRef, useState } from 'react';
import { useNet } from '@odi/net/store';
import type { KampOdul, KampOyunTur } from '@odi/shared';
import { EGRI_ADI, KAMP_OYUN, KG_KURAL, egriTipi, timpanoTuru, tonTuru, type TimpanoBulmaca, type TonDeneme } from '@odi/content';
import { audio } from '@odi/audio';
import { act } from '../../net';
import { useStore } from '../../store';
import { Art } from '../../ui/art';
import { TimpanogramSvg } from './charts';
import { KgIcon } from './art';
import { KgSheet } from './Klinik';
import { OdulChips } from './GorevPanel';
import { celebrateReward, openPanel, useKg } from './state';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const GORSEL = 'odi.kg.gorsel';
function useGorsel(): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(() => { try { const s = localStorage.getItem(GORSEL); if (s) return s === '1'; } catch { /* yok */ } return !audio.volumes().enabled || audio.volumes().sfx < 0.05; });
  return [v, (n) => { setV(n); try { localStorage.setItem(GORSEL, n ? '1' : '0'); } catch { /* gizli mod */ } }];
}

export function OyunPanel({ oyun }: { oyun: 'ton' | 'timpano' }) {
  const def = KAMP_OYUN[oyun]; const kg = useKg((s) => s.kg); const duzey = useStore((s) => s.knowledge);
  const gun = kg?.oyun.find((g) => g.oyun === oyun);
  const [round, setRound] = useState<KampOyunTur | null>(null);
  const [sonuc, setSonuc] = useState<{ score: number; total: number; reward: KampOdul } | null>(null);
  const [busy, setBusy] = useState(false);
  const close = () => { audio.play('tap'); audio.music('menu'); openPanel(null); };
  const start = async () => {
    setBusy(true); const r = await act('koyun.start', { oyun, duzey }); setBusy(false);
    if (!r) return; audio.unlock(); if (oyun === 'ton') audio.music(null); setSonuc(null); setRound(r.round);
  };
  const finish = async (answers: number[]) => {
    if (!round) return;
    const r = await act('koyun.finish', { id: round.id, answers });
    setRound(null); if (!r) return;
    useKg.setState({ kg: r.state }); useNet.setState({ wallet: r.wallet });
    setSonuc({ score: r.score, total: r.total, reward: r.reward });
    audio.play(r.score === r.total ? 'star3' : r.score >= r.total * 0.6 ? 'star2' : 'star1');
    celebrateReward(`${def.ad}: ${r.score}/${r.total}`, r.reward);
  };
  return (
    <KgSheet title={def.ad} icon={<KgIcon name={def.art} size={30} />} onClose={close} testid={`oyun-${oyun}`} wide>
      {round ? (oyun === 'ton' ? <TonTur round={round} onDone={(a) => void finish(a)} /> : <TimpanoTur round={round} onDone={(a) => void finish(a)} />) : (
        <div className="kg-oyun-giris">
          {sonuc && <div className="kg-oyun-sonuc" data-testid="oyun-sonuc" data-score={sonuc.score}><b>{sonuc.score}/{sonuc.total}</b><span>{sonuc.score === sonuc.total ? 'Kusursuz!' : sonuc.score >= sonuc.total * 0.6 ? 'Güzel tur!' : 'Bir tur daha dene!'}</span>
            {Object.keys(sonuc.reward).length ? <OdulChips r={sonuc.reward} /> : <small>Bu tur ödülsüz (bugünün ödüllü turları bitti).</small>}</div>}
          <p>{def.plain}</p>
          {oyun === 'ton' && <ul className="kg-kural"><li>“Ses var mı?” denemesinde dinle; sonra ses olup olmadığını seç.</li><li>“Hangisi daha ince?” denemesinde iki ses çalar; daha ince (tiz) olanı seç.</li><li className="kg-uyari"><Art name="ear" size={16} /> Bu bir işitme testi değildir. Sesler rahat bir düzeyde çalınır. İşitmenle ilgili bir kaygın varsa bir odyoloğa ya da hekime danış.</li></ul>}
          {oyun === 'timpano' && <ul className="kg-kural"><li>Her turda {KG_KURAL.timpanoBulmaca} eğri gelir; eğrinin anlamını seç.</li><li>{duzey === 'genel' ? 'İpucu: tepeli eğri zarın rahat hareket ettiğini, düz eğri hareket etmediğini gösterir.' : 'Tepe basıncına, yüksekliğine ve düz eğride kanal hacmine bak (Jerger).'}</li></ul>}
          {gun && <small className="kg-note" data-testid="oyun-gun">{gun.rewarded < gun.cap ? `Bugün ödüllü tur: ${gun.rewarded}/${gun.cap}` : `Bugünün ödüllü turları bitti (${gun.cap}/${gun.cap}); dilediğin kadar eğlence için oynayabilirsin.`}</small>}
          <button className="btn" data-testid="oyun-basla" disabled={busy || (gun ? !gun.open : false)} onClick={() => void start()}>{sonuc ? 'Bir tur daha' : 'Başla'}</button>
          {gun && !gun.open && <small className="kg-kilit"><Art name="lock" size={14} /> {gun.locked}</small>}
        </div>
      )}
    </KgSheet>
  );
}

// ------------------------------------------------------------------ Ton Avı
function TonTur({ round, onDone }: { round: KampOyunTur; onDone: (a: number[]) => void }) {
  const trials = useRef<TonDeneme[]>(tonTuru(round.seed, round.duzey)).current;
  const [gorsel, setGorsel] = useGorsel();
  const [i, setI] = useState(0); const [faz, setFaz] = useState<'dinle' | 'cevap' | 'geri'>('dinle');
  const [isik, setIsik] = useState<0 | 1 | 2 | 3>(0); // 0 yok, 1 ses (var), 2 ilk ses, 3 ikinci ses
  const [dogru, setDogru] = useState<boolean | null>(null); const [tekrar, setTekrar] = useState(false);
  const answers = useRef<number[]>([]); const alive = useRef(true); const gorselRef = useRef(gorsel); gorselRef.current = gorsel;
  useEffect(() => () => { alive.current = false; }, []);
  const t = trials[i]!;
  const play = async (d: TonDeneme) => {
    setFaz('dinle'); setIsik(0);
    if (d.tur === 'var') {
      await wait(d.at); if (!alive.current) return;
      if (d.var) { audio.tone(d.hz, 0.4, 0.09); if (gorselRef.current) setIsik(1); }
      await wait(Math.max(300, 1900 - d.at)); setIsik(0);
    } else {
      await wait(250); if (!alive.current) return;
      audio.tone(d.a, 0.45, 0.09); setIsik(2); await wait(650); setIsik(0); await wait(150);
      audio.tone(d.b, 0.45, 0.09); setIsik(3); await wait(650); setIsik(0);
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
  // görsel ipucu: perde yüksekliği dikey konum (log ölçek), "var" denemesinde nabız halkası
  const yuk = (hz: number) => Math.round(((Math.log2(hz) - Math.log2(300)) / (Math.log2(7000) - Math.log2(300))) * 100);
  return (
    <div className="kg-ton" data-testid="ton-tur" data-deneme={i} data-tur={t.tur} data-faz={faz}>
      <div className="kg-dots">{trials.map((_, k) => <i key={k} className={k < i ? 'on' : k === i ? 'cur' : ''} />)}</div>
      <h3>{t.tur === 'var' ? 'Ses var mı?' : 'Hangisi daha ince?'}</h3>
      <div className={`kg-ton-sahne${gorsel ? ' gorsel' : ''}`} aria-live="polite">
        {t.tur === 'var'
          ? <div className={`kg-nabiz${isik === 1 ? ' on' : ''}${faz === 'dinle' ? ' dinle' : ''}`}><Art name="ear" size={46} /></div>
          : <div className="kg-perde">{[2, 3].map((k) => { const hz = k === 2 ? t.a : t.b; return <div key={k} className={`kg-perde-col${isik === k ? ' on' : ''}`}><span className="kg-perde-bar" style={{ bottom: gorsel && isik === k ? `${yuk(hz)}%` : undefined }} /><b>{k - 1}</b></div>; })}</div>}
        <small>{faz === 'dinle' ? 'Dinle…' : faz === 'cevap' ? 'Seçimini yap' : dogru ? 'Doğru!' : 'Olmadı'}</small>
      </div>
      {t.tur === 'var' ? (
        <div className="kg-cevap"><button className="btn" data-cevap="1" disabled={faz !== 'cevap'} onClick={() => void cevap(1)}>Ses vardı</button><button className="btn ghost" data-cevap="0" disabled={faz !== 'cevap'} onClick={() => void cevap(0)}>Ses yoktu</button></div>
      ) : (
        <div className="kg-cevap"><button className="btn" data-cevap="0" disabled={faz !== 'cevap'} onClick={() => void cevap(0)}>1. daha ince</button><button className="btn" data-cevap="1" disabled={faz !== 'cevap'} onClick={() => void cevap(1)}>2. daha ince</button>
          <button className="btn ghost small" disabled={faz !== 'cevap' || tekrar} onClick={() => { setTekrar(true); void play(t); }}>Bir daha dinle</button></div>
      )}
      <label className="kg-toggle"><input type="checkbox" checked={gorsel} onChange={(e) => setGorsel(e.target.checked)} /> Görsel ipucu (ses kapalıysa)</label>
      <small className="kg-uyari"><Art name="ear" size={14} /> Bu bir oyundur, işitme testi değildir.</small>
    </div>
  );
}

// ------------------------------------------------------------------ Timpanogram Eşleştir
function TimpanoTur({ round, onDone }: { round: KampOyunTur; onDone: (a: number[]) => void }) {
  const tur = useRef<TimpanoBulmaca[]>(timpanoTuru(round.seed, round.duzey)).current;
  const [i, setI] = useState(0); const [secim, setSecim] = useState<number | null>(null);
  const answers = useRef<number[]>([]);
  const b = tur[i]!; const genel = round.duzey === 'genel';
  const sec = (k: number) => {
    if (secim !== null) return;
    setSecim(k); answers.current.push(k); audio.play(k === b.dogru ? 'coin' : 'tap');
    setTimeout(() => { setSecim(null); if (i + 1 >= tur.length) onDone(answers.current); else setI(i + 1); }, 1500);
  };
  return (
    <div className="kg-timpano" data-testid="timpano-tur" data-bulmaca={i}>
      <div className="kg-dots">{tur.map((_, k) => <i key={k} className={k < i ? 'on' : k === i ? 'cur' : ''} />)}</div>
      <h3>Bu eğri ne anlatıyor?</h3>
      <TimpanogramSvg tek={b.timp} values title="Bulmaca timpanogramı" />
      {!genel && <small className="kg-note">{b.timp.basinc === null ? 'Tepe yok' : `Tepe ${b.timp.basinc} daPa`} · admitans {b.timp.uyum.toLocaleString('tr-TR')} ml · kanal hacmi {b.timp.hacim.toLocaleString('tr-TR')} ml</small>}
      <div className="kg-opts">
        {b.secenek.map((e, k) => <button key={e} className={`kg-opt${secim === null ? '' : k === b.dogru ? ' ok' : k === secim ? ' no' : ' dim'}`} data-egri={e} data-secenek={k} disabled={secim !== null} onClick={() => sec(k)}>{genel ? EGRI_ADI[e].sade : `${EGRI_ADI[e].teknik} · ${EGRI_ADI[e].sade}`}</button>)}
      </div>
      {secim !== null && <div className={`kg-geri ${secim === b.dogru ? 'ok' : 'no'}`}>{secim === b.dogru ? 'Doğru! ' : 'Doğrusu: '}{EGRI_ADI[b.egri].sade} (Tip {egriTipi(b.egri)}).</div>}
    </div>
  );
}
