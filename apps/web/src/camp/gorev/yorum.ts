/**
 * Test sonuçlarının ekran metni: "genel" düzeyde sade yorum (ne gördüğünü söyler), "odyoloji" düzeyinde sayılar ve teknik ad
 * (yorumu öğrenciye bırakır). Tanıyı söylemez; tanıyı oyuncu seçer.
 */
import { bolunmez, derece, gaps, hacimSinifi, isYok, kayipTipi, pta3, type Abr, type BilgiDuzeyi, type Ear, type Islem, type Oae, type Odyogram, type Otoskopi, type Refleks, type Timp, type Vaka } from '@odi/content';

export const KULAK: Record<Ear, string> = { R: 'Sağ', L: 'Sol' };
const n1 = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** admitans iki basamak: 0,25 ml (Tip As) yuvarlanıp 0,3 ml (normal sınır) görünmesin */
const n2 = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

export const OTOSKOPI_ADI: Record<Otoskopi, { sade: string; teknik: string }> = {
  normal: { sade: 'Kanal temiz, zar inci grisi ve parlak', teknik: 'Normal: zar yarı saydam, ışık refleksi var' },
  serumen: { sade: 'Kanal kirle tıkalı', teknik: 'Tıkayıcı serumen' },
  odem: { sade: 'Kanal kızarık ve şiş', teknik: 'Kanalda ödem ve hiperemi' },
  eksostoz: { sade: 'Kanal duvarında sert, beyaz çıkıntılar', teknik: 'Kemik kanalda geniş tabanlı çıkıntılar' },
  perforasyon: { sade: 'Zarda delik', teknik: 'Timpanik membran perforasyonu' },
  efuzyon: { sade: 'Zar mat; arkasında sıvı', teknik: 'Efüzyon: mat zar, sıvı seviyesi / hava kabarcığı' },
  icecekik: { sade: 'Zar hafif içe çekik', teknik: 'Retrakte zar, kısalmış ışık refleksi' },
  retraksiyon: { sade: 'Zarın bir bölümü içe çökmüş (cep)', teknik: 'Retraksiyon cebi' },
  plak: { sade: 'Zarda beyaz plaklar', teknik: 'Timpanosklerotik plaklar' },
};
const KAYIP_SADE = { normal: 'normal', iletim: 'orta kulak/kanal kaynaklı (kemik yolu iyi)', sensorinoral: 'iç kulak kaynaklı (hava ve kemik yolu birlikte düşük)', mikst: 'karışık (kemik yolu da düşük ve arada fark var)' } as const;

/** "%76’sını": yüzdenin belirtme hâli eki, sayının okunuşunun son sözcüğüne göre (altı → sını, sekiz → ini, yüz → ünü) */
const BIRLER = ['', 'ini', 'sini', 'ünü', 'ünü', 'ini', 'sını', 'sini', 'ini', 'unu'];
const ONLAR = ['ını', 'unu', 'sini', 'unu', 'ını', 'sini', 'ını', 'ini', 'ini', 'ını'];
export const yuzdeEki = (n: number) => `%${n}’${n === 100 ? 'ünü' : n % 10 ? BIRLER[n % 10] : ONLAR[Math.floor(n / 10)]}`;
const ort = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
/**
 * Eğrinin biçimi (YN-090): saf ses ortalaması (500–2000 Hz) tize doğru inen eğride kaybı küçük gösterir. 4–8 kHz ortalaması
 * ondan en az 20 dB kötüyse ve 8 kHz'te düzelme yoksa (çentik değil) "inen" sayılır; alçak bant 250–1000 Hz ortalamasıdır.
 */
function inenEgri(ac: number[]): { alcak: number; yuksek: number } | null {
  const yuksek = ort([ac[5]!, ac[6]!, ac[7]!]);
  if (yuksek - pta3(ac) < 20 || ac[7]! < ac[5]! - 5) return null;
  return { alcak: ort([ac[0]!, ac[1]!, ac[2]!]), yuksek };
}

export function odyoSatir(o: Odyogram, e: Ear, duzey: BilgiDuzeyi): string {
  const p = pta3(o.ac[e]); const k = kayipTipi(o, e); const inen = k === 'normal' ? null : inenEgri(o.ac[e]);
  if (duzey === 'genel') {
    if (k === 'normal') return `${KULAK[e]}: işitme normal sınırda`;
    if (inen) return `${KULAK[e]}: yüksek frekanslara doğru inen kayıp: alçak frekanslarda ${derece(inen.alcak)}, 4–8 kHz’te ${derece(inen.yuksek)}; ${KAYIP_SADE[k]}`;
    return `${KULAK[e]}: ${derece(p)} kayıp, ${KAYIP_SADE[k]}`;
  }
  const g = gaps(o, e).filter((x): x is number => x !== null);
  const lo = Math.max(0, Math.min(...g)); const hi = Math.max(0, ...g);
  return `${KULAK[e]}: saf ses ortalaması ${n1(p)} dB HL${inen ? ` · yüksek frekans ortalaması (4–8 kHz) ${n1(inen.yuksek)} dB HL` : ''} · hava–kemik aralığı ${lo === hi ? lo : `${lo}–${hi}`} dB`;
}
export function timpSatir(t: Timp | null, e: Ear, duzey: BilgiDuzeyi, grup: Vaka['hasta']['grup']): string {
  if (!t) return `${KULAK[e]}: ölçülmedi`;
  const h = hacimSinifi(t.hacim, grup);
  if (duzey === 'odyoloji') return `${KULAK[e]}: ${t.basinc === null ? 'tepe yok' : `tepe ${t.basinc} daPa`} · admitans ${n2(t.uyum)} ml · kanal hacmi ${n1(t.hacim)} ml`;
  const hs = h === 'buyuk' ? ' · kanal hacmi büyük' : h === 'kucuk' ? ' · kanal hacmi küçük' : '';
  switch (t.tip) {
    case 'A': return `${KULAK[e]}: zar rahat hareket ediyor (tepeli eğri)`;
    case 'As': return `${KULAK[e]}: tepe çok alçak (sert sistem)`;
    case 'Ad': return `${KULAK[e]}: tepe çok yüksek (aşırı gevşek)`;
    case 'B': return `${KULAK[e]}: düz eğri, zar hareket etmiyor${hs}`;
    case 'C': return `${KULAK[e]}: tepe negatif basınçta (orta kulak basıncı düşük)`;
  }
}
export const REFLEKS_ADI: Record<Refleks, string> = { var: 'var', yok: 'alınamadı', yuksek: 'yüksek eşikte', yorulma: 'var ama hızla yoruluyor (decay)' };
export const OAE_ADI: Record<Oae, string> = { var: 'var (geçti)', yok: 'alınamadı', kismi: 'alçak-orta frekansta var, tizde yok', azalmis: 'zayıf' };
export const ABR_ADI: Record<Abr, { sade: string; teknik: string }> = {
  normal: { sade: 'normal', teknik: 'I–V latansları normal' },
  gecikmis: { sade: 'sinir yanıtı gecikmiş', teknik: 'dalga V gecikmiş, I–V aralığı uzamış' },
  cm: { sade: 'sinir yanıtı yok; yalnız iç kulak sinyali var', teknik: 'nöral dalgalar yok, koklear mikrofonik var' },
  yok: { sade: 'yanıt yok', teknik: 'yanıt alınamadı' },
};
export const ISLEM_ADI: Record<Islem, string> = { normal: 'yaş normunda', zayif: 'yaş normunun altında' };

/** testin sonucu: kısa satırlar (kart başlığının altında); sayı–birim ve aralıklar satır sonunda bölünmez */
export function testSatirlari(v: Vaka, id: string, duzey: BilgiDuzeyi): string[] {
  return satirlar(v, id, duzey).map(bolunmez);
}
function satirlar(v: Vaka, id: string, duzey: BilgiDuzeyi): string[] {
  const T = v.testler as unknown as Record<string, unknown>; const x = T[id];
  if (!x || isYok(x)) return [isYok(x) ? x.yok : 'Bu test bu vakada yapılmadı.'];
  const ears: Ear[] = ['R', 'L'];
  switch (id) {
    case 'otoskopi': { const o = x as { R: Otoskopi | null; L: Otoskopi | null; aciklama?: Partial<Record<Ear, string>> }; return ears.map((e) => (o[e] ? `${KULAK[e]}: ${o.aciklama?.[e] ?? OTOSKOPI_ADI[o[e]!][duzey === 'genel' ? 'sade' : 'teknik']}` : `${KULAK[e]}: bakılamadı`)); }
    case 'odyometri': { const o = x as Odyogram & { not?: string }; return [...ears.map((e) => odyoSatir(o, e, duzey)), ...(o.not ? [o.not] : [])]; }
    case 'timpanometri': { const t = x as { R: Timp | null; L: Timp | null; not?: string }; return [...ears.map((e) => timpSatir(t[e], e, duzey, v.hasta.grup)), ...(t.not ? [t.not] : [])]; }
    case 'refleks': { const r = x as { R: Refleks | null; L: Refleks | null; not?: string }; return [...ears.map((e) => `${KULAK[e]} (ipsilateral): ${r[e] ? REFLEKS_ADI[r[e]!] : 'ölçülmedi'}`), ...(r.not ? [r.not] : [])]; }
    case 'oae': { const r = x as { R: Oae | null; L: Oae | null; not?: string }; return [...ears.map((e) => `${KULAK[e]}: ${r[e] ? OAE_ADI[r[e]!] : 'ölçülmedi'}`), ...(r.not ? [r.not] : [])]; }
    case 'abr': { const r = x as { R: Abr | null; L: Abr | null; not?: string }; return [...ears.map((e) => `${KULAK[e]}: ${r[e] ? ABR_ADI[r[e]!][duzey === 'genel' ? 'sade' : 'teknik'] : 'ölçülmedi'}`), ...(r.not ? [r.not] : [])]; }
    case 'konusma': { const k = x as { srt: Record<Ear, number>; sds: Record<Ear, number>; not?: string }; return [...ears.map((e) => (duzey === 'genel' ? `${KULAK[e]}: konuşmayı ${k.srt[e]} dB HL’de algılamaya başlıyor; rahat duyduğu seste kelimelerin ${yuzdeEki(k.sds[e])} doğru tekrarlıyor` : `${KULAK[e]}: SRT ${k.srt[e]} dB HL · kelime tanıma %${k.sds[e]} (konforlu düzeyde)`)), ...(k.not ? [k.not] : [])]; }
    case 'islemleme': { const k = x as { gurultu: Islem; dikotik: Islem; bosluk: Islem; not?: string }; return [`Gürültüde konuşma: ${ISLEM_ADI[k.gurultu]}`, `Dikotik dinleme: ${ISLEM_ADI[k.dikotik]}`, `Boşluk saptama: ${ISLEM_ADI[k.bosluk]}`, ...(k.not ? [k.not] : [])]; }
  }
  return [];
}
