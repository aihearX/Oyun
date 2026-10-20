import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import { COMM_RULES } from '@odi/shared';
import { act, toast } from '../net';
import { platform } from '../platform';
import { featureOpen } from '../ftue/useFeatures';
import { useStore } from '../store';
import { Art } from '../ui/art';
import { noteRun, useComm } from './state';

/**
 * Sonuç ekranı iletişim kartları:
 *  - Yardım İste: aynı bölümde art arda 3 başarısızlıkta (ya da 3+ başarısızlık serisinde) "Takımdan yardım iste".
 *  - Takıma meydan oku: geçilen bölümde, sunucudaki en iyi skorla takım sohbetine kart.
 */
export function ResultComm({ level, completed, demo }: { level: number; completed: boolean; demo?: boolean }) {
  const team = useNet((s) => s.team); const status = useNet((s) => s.status);
  const fails = useComm((s) => s.fails[level] ?? 0); const asked = useComm((s) => s.asked.includes(level));
  const failStreak = useStore((s) => s.failStreak);
  const [state, setState] = useState<'' | 'busy' | 'done'>('');
  const [duel, setDuel] = useState<'' | 'busy' | 'done'>('');
  useEffect(() => { if (!demo) noteRun(level, completed); }, []);
  if (status !== 'bağlı' || !team || !featureOpen('team')) return null;
  const mine = team.help.some((h) => h.level === level && h.expiresAt > Date.now() && useNet.getState().me?.id === h.from);
  if (!completed && (fails >= COMM_RULES.helpFailsToAsk || failStreak >= COMM_RULES.helpFailsToAsk)) {
    const ask = async () => {
      setState('busy');
      const r = await act('team.help.request', { level });
      if (r) { setState('done'); useComm.setState((s) => ({ asked: [...s.asked, level] })); platform().haptic('success'); toast('🙋', 'Takımına haber verdin', 'İpucu, kalkan ya da birlikte yarış gelebilir. Geçince ikinize de ödül.', 'green'); }
      else setState('');
    };
    const done = state === 'done' || asked || mine;
    return (
      <div className="comm-result" data-testid="yardim-iste" onClick={(e) => e.stopPropagation()}>
        <span className="cr-ic"><Art name="help" size={30} /></span>
        <span className="cr-t"><b>{done ? 'Yardım istedin' : 'Takımından yardım iste'}</b><small>{done ? 'Takım sohbetinde kartın var; ipucu ve kalkanlar oraya gelir.' : `${level}. bölümü ${Math.max(fails, failStreak)} kez denedin. Takım arkadaşların ipucu, kalkan ya da birlikte yarış gönderebilir.`}</small></span>
        {!done && <button type="button" className="btn small" data-testid="yardim-iste-dugme" disabled={state === 'busy'} onClick={() => void ask()}>Yardım iste</button>}
      </div>
    );
  }
  if (completed && featureOpen('race')) {
    const post = async () => { setDuel('busy'); const r = await act('feed.challenge', { level }); if (r) { setDuel('done'); toast('🏁', 'Meydan okuma takım sohbetinde', 'Geçen olursa sana haber vereceğim.', 'green'); } else setDuel(''); };
    return (
      <div className="comm-result duel" data-testid="takima-meydan" onClick={(e) => e.stopPropagation()}>
        <span className="cr-ic"><Art name="finish" size={30} /></span>
        <span className="cr-t"><b>{duel === 'done' ? 'Meydan okudun!' : 'Takımına meydan oku'}</b><small>{duel === 'done' ? 'Kartın takım sohbetinde. 48 saat açık.' : 'En iyi skorun takım sohbetine kart olarak düşer; geçen olursa haber verilir.'}</small></span>
        {duel !== 'done' && <button type="button" className="btn small coral" data-testid="takima-meydan-dugme" disabled={duel === 'busy'} onClick={() => void post()}>Takıma gönder</button>}
      </div>
    );
  }
  return null;
}
