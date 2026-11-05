import { useEffect, useState } from 'react';
import './comm.css'; // paket bölme: bu bileşen Cards.tsx olmadan da çizilir (sonuç ekranı), stili kendisi yüklesin
import { useNet } from '@odi/net/store';
import { NetError } from '@odi/net';
import { COMM_RULES } from '@odi/shared';
import { act, errText, getNet, toast } from '../net';
import { platform } from '../platform';
import { featureOpen } from '../ftue/useFeatures';
import { useStore } from '../store';
import { Art } from '../ui/art';
import { helpLeftOf, setHelpLeft } from '../screens/team/teamTabs';
import { noteRun, useComm } from './state';

/**
 * Sonuç ekranı iletişim kartları:
 *  - Yardım İste: aynı bölümde art arda 3 başarısızlıkta (ya da 3+ başarısızlık serisinde) "Takımdan yardım iste". Kalan günlük hak
 *    yazılır; hak bitince düğme yerine sakin bir not (kayıp ekranına ikinci bir ret kutusu düşmesin; OT-ilk-kez-oyun-43).
 *  - Takıma meydan oku: geçilen bölümde, sunucudaki en iyi skorla takım sohbetine kart. Gönderilen kart geri alınamaz (sunucuda
 *    silme yolu yok): "Takıma gönder" önce tek adımlı onay ister (başka bir dokunuş yanlışlıkla sohbete düşürmesin; OT-ekonomi-denetci-14).
 */
export function ResultComm({ level, completed, demo }: { level: number; completed: boolean; demo?: boolean }) {
  const team = useNet((s) => s.team); const status = useNet((s) => s.status);
  const fails = useComm((s) => s.fails[level] ?? 0); const asked = useComm((s) => s.asked.includes(level));
  const failStreak = useStore((s) => s.failStreak); const levelFails = useStore((s) => s.progress[level]?.fails ?? 0);
  const [state, setState] = useState<'' | 'busy' | 'done'>('');
  const [duel, setDuel] = useState<'' | 'confirm' | 'busy' | 'done'>('');
  useEffect(() => { if (!demo) noteRun(level, completed); }, []);
  // önizleme (yalnız ekran görüntüsü; `?demo=sonuc&yardim=4`): takım bağlantısı olmadan yardım kartı, düğme ağa bir şey göndermez
  const demoFails = demo && !completed ? Number(new URLSearchParams(location.search).get('yardim') ?? 0) : 0;
  if (!demoFails && (status !== 'bağlı' || !team || !featureOpen('team'))) return null;
  const mine = !!team?.help.some((h) => h.level === level && h.expiresAt > Date.now() && useNet.getState().me?.id === h.from);
  if (!completed && (demoFails || fails >= COMM_RULES.helpFailsToAsk || failStreak >= COMM_RULES.helpFailsToAsk)) {
    const ask = async () => {
      if (demoFails) { setState('done'); return; }
      const c = getNet(); if (!c) return;
      setState('busy');
      try {
        const r = await c.call('team.help.request', { level });
        if (r.helpLeft !== undefined) setHelpLeft(r.helpLeft);
        setState('done'); useComm.setState((s) => ({ asked: [...s.asked, level] })); platform().haptic('success');
        toast('🙋', 'Takımına haber verdin', 'İpucu, kalkan ya da birlikte yarış gelebilir. Geçince ikinize de ödül.', 'green');
      } catch (e) {
        setState('');
        // hak başka cihazda bitmiş olabilir: ret kutusu yerine kart sakin nota döner
        if (e instanceof NetError && e.code === 'LIMIT') setHelpLeft(0);
        else { platform().haptic('error'); toast('🙈', 'Olmadı', errText(e), 'bronze'); }
      }
    };
    const done = state === 'done' || asked || mine;
    const left = demoFails ? undefined : helpLeftOf(team, getNet()?.serverNow() ?? Date.now());
    const out = !done && left === 0;
    // bölümün adıyla yalnız o bölümün art arda kaybı (oturumun sayısı ya da kayıtlı ilerlemenin `fails`i, bu kayıp dahil); kart
    // bölümler arası seriyle açıldıysa yalnız seri, bölüm adı olmadan: 38'deki kayıp "39. bölümü 3 kez denedin"e sayılmasın (YN-240,
    // OT-ogrenci-birinci-49)
    const tried = Math.max(fails, demo ? 0 : levelFails, demoFails);
    return (
      <div className="comm-result" data-testid="yardim-iste" onClick={(e) => e.stopPropagation()}>
        <span className="cr-ic"><Art name="help" size={30} /></span>
        <span className="cr-t"><b>{done ? 'Yardım istedin' : out ? 'Bugünkü yardım hakların bitti' : 'Takımından yardım iste'}</b>
          <small data-testid="yardim-iste-not">{done ? 'Takım sohbetinde kartın var; ipucu ve kalkanlar oraya gelir.'
            : out ? 'Yarın yeniden isteyebilirsin. Takım sohbetindeki kartların açık.'
            : `${tried >= COMM_RULES.helpFailsToAsk ? `${level}. bölümü ${tried} kez denedin.` : `Üst üste ${failStreak} kayıp.`} Takım arkadaşların ipucu, kalkan ya da birlikte yarış gönderebilir.${left !== undefined ? ` Bugün ${left} hak kaldı.` : ''}`}</small></span>
        {!done && !out && <button type="button" className="btn small" data-testid="yardim-iste-dugme" disabled={state === 'busy'} onClick={() => void ask()}>Yardım iste</button>}
      </div>
    );
  }
  if (completed && featureOpen('race')) {
    const post = async () => { setDuel('busy'); const r = await act('feed.challenge', { level }); if (r) { setDuel('done'); toast('🏁', 'Meydan okuma takım sohbetinde', 'Geçen olursa sana haber vereceğim.', 'green'); } else setDuel(''); };
    return (
      <div className="comm-result duel" data-testid="takima-meydan" onClick={(e) => e.stopPropagation()}>
        <span className="cr-ic"><Art name="finish" size={30} /></span>
        <span className="cr-t">
          <b>{duel === 'done' ? 'Meydan okudun!' : duel === 'confirm' || duel === 'busy' ? 'Takım sohbetine gönderilsin mi?' : 'Takımına meydan oku'}</b>
          <small>{duel === 'done' ? 'Kartın takım sohbetinde. 48 saat açık.' : duel === 'confirm' || duel === 'busy' ? 'Kart herkese görünür, geri alınamaz.' : 'Takım sohbetine bu düğme gönderir: en iyi skorun kart olarak düşer, geçen olursa haber verilir. "Meydan oku" ise bağlantı paylaşır.'}</small>
        </span>
        {duel === '' && <button type="button" className="btn small coral" data-testid="takima-meydan-dugme" onClick={() => setDuel('confirm')}>Takıma gönder</button>}
        {(duel === 'confirm' || duel === 'busy') && (
          <span className="cr-confirm">
            <button type="button" className="btn small coral" data-testid="takima-meydan-onay" disabled={duel === 'busy'} onClick={() => void post()}>Gönder</button>
            <button type="button" className="btn small ghost" data-testid="takima-meydan-vazgec" disabled={duel === 'busy'} onClick={() => setDuel('')}>Vazgeç</button>
          </span>
        )}
      </div>
    );
  }
  return null;
}
