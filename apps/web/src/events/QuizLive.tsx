import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import { useNav } from '../nav';
import { useFeatures } from '../ftue/useFeatures';
import { afterText } from '../ftue/features';
import { Art } from '../ui/art';
import { refreshEvents, srvNow, useEvents } from './store';

/** sabit saat bu kadar yakınsa o an tazelenir (yarışma sabit saatte sunucuda açılır) */
const SLOT_WATCH_MS = 6 * 60 * 60_000;
const mmss = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/**
 * Canlı Kulak Bilgi Yarışması göstergesi (YN-161, OT-sinav-adayi-32): takımın yarışması lobide ya da sorulardayken Bilgi pratiği ve
 * Bugün ekranında "Şu an canlı · Katıl" (Etkinlikler › Bilgi yarışması'nı açar). Etkinlikler henüz kilitliyse ne zaman katılabileceği;
 * takımsız oyuncuya sabit saat açıkken dürüst not (yarışma takımla oynanır). Canlı yarışma yoksa hiçbir şey çizmez.
 * Yalnız global stiller (styles.css `.quiz-canli`): Bugün sekmesi etkinlik CSS'ini yüklemez.
 */
export function QuizLiveCard() {
  const quiz = useEvents((s) => s.quiz); const info = useEvents((s) => s.quizInfo); const inTeam = useEvents((s) => s.inTeam);
  const loaded = useEvents((s) => s.loaded); const fast = useEvents((s) => s.fast);
  const status = useNet((s) => s.status); const meId = useNet((s) => s.me?.id);
  const nav = useNav(); const f = useFeatures();
  const [now, setNow] = useState(srvNow);
  useEffect(() => { const h = setInterval(() => setNow(srvNow()), 1000); return () => clearInterval(h); }, []);
  useEffect(() => { void refreshEvents(); }, [status]);
  // sabit saat gelince bir kez tazele: ekran açıkken başlayan yarışma da görünsün
  useEffect(() => {
    if (!info || info.slotOpen) return;
    const ms = info.nextSlotAt - srvNow() + 1500;
    if (ms <= 0 || ms > SLOT_WATCH_MS) return;
    const h = setTimeout(() => void refreshEvents(), ms); return () => clearTimeout(h);
  }, [info?.nextSlotAt, info?.slotOpen]);
  if (status !== 'bağlı' || !loaded) return null;
  if (!inTeam) {
    if (fast || !info?.slotOpen) return null;
    return (
      <div className="card quiz-canli" role="status" data-testid="quiz-canli" data-durum="takimsiz">
        <span className="qc-ic" aria-hidden><Art e="🧠" size={34} /></span>
        <div className="grow min0"><b className="qc-baslik">Şu an canlı: Kulak Bilgi Yarışması</b>
          <span className="muted">Canlı yarışma takımla oynanır. Bir takıma katılınca her gün 13:00 ve 20:00'de sen de katılabilirsin.</span></div>
      </div>
    );
  }
  const live = quiz && quiz.phase !== 'bitti' && quiz.endsAt > now ? quiz : null;
  if (!live) return null;
  const joined = live.players.some((p) => p.id === meId);
  const phase = live.phase === 'lobi' ? `Katılım açık · başlamasına ${mmss(live.lobbyEndsAt - now)}` : `Soru ${(live.question?.index ?? 0) + 1}/${live.question?.total ?? 10} · sonraki sorudan katılabilirsin`;
  const locked = !f.open('events');
  return (
    <div className="card quiz-canli" role="status" data-testid="quiz-canli" data-durum={locked ? 'kilitli' : joined ? 'katildi' : 'acik'}>
      <span className="qc-ic" aria-hidden><Art e="🧠" size={34} /></span>
      <div className="grow min0">
        <b className="qc-baslik"><span className="qc-canli">Şu an canlı</span> Kulak Bilgi Yarışması</b>
        <span className="muted">{locked ? `Takımın yarışıyor. ${afterText('events')} katılabilirsin.` : joined ? 'Katıldın; yarışmaya dönebilirsin.' : phase}</span>
        {!locked && <button className="btn small qc-btn" data-testid="quiz-canli-katil" onClick={() => nav.open({ name: 'events', view: 'quiz' })}>{joined ? 'Yarışmaya dön' : 'Katıl'}</button>}
      </div>
    </div>
  );
}
