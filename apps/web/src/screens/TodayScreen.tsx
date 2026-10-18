import { useEffect, useState } from 'react';
import { MAX_STREAK_SHIELDS, questById, type RewardItem } from '@odi/content';
import { calendarView, chestReady, dailyChestReward, dayKey, ensureDaily, highestUnlocked, questDone, resolveReward } from '@odi/meta';
import { useStore } from '../store';
import { platform } from '../platform';
import { inviteUrl } from '../invite';
import { Bar, RewardChips, rewardIcon } from '../ui/bits';
import { TopBar } from '../ui/social';

/** Bugün: 7 günlük giriş takvimi, 3 günlük görev, içeriği önceden görünen günlük sandık, seri ve koruyucu. */
export function TodayScreen({ onInfo }: { onInfo: () => void }) {
  const s = useStore(); const today = dayKey();
  useEffect(() => { s.touchDay(); }, []);
  const [got, setGot] = useState<{ title: string; items: RewardItem[] } | null>(null);
  const [note, setNote] = useState('');
  const daily = ensureDaily(s.meta.daily, today); const cal = calendarView(s, today);
  const chestItems = resolveReward(s.meta, dailyChestReward(s)); const ready = chestReady(daily);
  const doneCount = daily.quests.filter(questDone).length;
  const show = (title: string, items: RewardItem[] | null) => { if (items) { setGot({ title, items }); platform().haptic('success'); } };
  const challenge = async () => {
    const lvl = Math.max(1, highestUnlocked(s.progress) - 1); const p = s.progress[lvl];
    const link = inviteUrl({ level: lvl, score: p?.best ?? 0, stars: p?.stars ?? 0 });
    const r = await platform().share(`ODİ: ${lvl}. bölümde ${p?.best ? `${p.best} puan yaptım` : 'seni bekliyorum'}. Kulak ver, gel geç beni! ${link}`);
    if (r !== 'cancelled') s.recordShare();
    if (r === 'copied') { setNote('Bağlantı kopyalandı'); setTimeout(() => setNote(''), 1500); }
  };
  const dateLabel = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div className="screen fade-in with-tabs">
      <TopBar title="Bugün" />
      <div className="muted cap">{dateLabel}</div>

      <div className="card streak-card">
        <div className="sc-flame" aria-hidden>🔥</div>
        <div className="grow min0"><b className="big">{Math.max(1, s.streak)}. gün</b><div className="muted">Seri: her gün bir uğra, takvim ilerlesin.</div></div>
        <div className="shield-pill" title="Seri koruyucu: bir günü kaçırırsan serini korur">🛡️ {s.meta.shields}/{MAX_STREAK_SHIELDS}</div>
      </div>

      <section className="card">
        <div className="row between"><h2>Giriş takvimi</h2><span className="muted">{cal.cycle > 1 ? `${cal.cycle}. tur` : '7 gün'}</span></div>
        <div className="calendar">
          {cal.days.map((d) => (
            <div key={d.day} className={`cal-day ${d.state}${d.big ? ' big' : ''}`}>
              <span className="cd-n">{d.day}</span>
              <span className="cd-i">{d.state === 'alindi' ? '✓' : rewardIcon(d.reward)}</span>
              <span className="cd-a">{d.reward.find((r) => r.kind === 'jeton')?.amount ?? ''}</span>
            </div>
          ))}
        </div>
        <div className="cal-today">
          <div className="grow min0"><div className="muted">{cal.claimedToday ? 'Bugünün ödülü alındı. Yarın:' : `Bugün (${cal.dayIndex + 1}. gün):`}</div>
            <RewardChips items={(cal.claimedToday ? cal.days[(cal.dayIndex + 1) % 7] : cal.days[cal.dayIndex])!.reward} small /></div>
          <button className="btn small" disabled={cal.claimedToday || s.lastDay !== today} onClick={() => show(`Takvim · ${cal.dayIndex + 1}. gün`, s.claimCalendar())}>{cal.claimedToday ? 'Alındı' : 'Al'}</button>
        </div>
      </section>

      <section className="card">
        <div className="row between"><h2>Günlük görevler</h2><span className="muted">{doneCount}/3</span></div>
        <div className="quests">
          {daily.quests.map((q) => { const d = questById(q.id); if (!d) return null; const ok = questDone(q); return (
            <div className={`quest${ok ? ' ok' : ''}${q.claimed ? ' claimed' : ''}`} key={q.id}>
              <span className="qe">{q.claimed ? '✅' : d.emoji}</span>
              <div className="grow min0">
                <div className="qt">{d.text}</div>
                <div className="row qbar"><Bar value={q.progress / d.target} tone="green" label={d.text} /><span className="qn">{q.progress}/{d.target}</span></div>
                <RewardChips items={d.reward} small />
              </div>
              {q.claimed ? <span className="muted">Alındı</span>
                : ok ? <button className="btn small" onClick={() => show(d.text, s.claimQuest(q.id))}>Al</button>
                : d.metric === 'share' ? <button className="btn coral small" onClick={challenge}>📣</button> : null}
            </div>); })}
        </div>
      </section>

      <section className={`card chest${ready ? ' ready' : ''}${daily.chestOpened ? ' opened' : ''}`}>
        <div className="chest-icon" aria-hidden>{daily.chestOpened ? '📭' : '🎁'}</div>
        <div className="grow min0">
          <h2>Günlük sandık</h2>
          <div className="muted">{daily.chestOpened ? 'Açıldı. Yarın yeni görevler, yeni sandık.' : ready ? 'Üç görev de tamam. Aç bakalım!' : `Üç görev bitince açılır (${doneCount}/3). İçinde:`}</div>
          {!daily.chestOpened && <RewardChips items={chestItems} small />}
        </div>
        {!daily.chestOpened && <button className="btn small" disabled={!ready} onClick={() => show('Günlük sandık', s.openChest())}>Aç</button>}
      </section>

      <button className="linkish" onClick={onInfo}>Ödüller nasıl çalışır? Şanslı Nota ihtimali, sandık içerikleri →</button>

      {got && (
        <div className="overlay" onClick={() => setGot(null)}>
          <div className="card reward-pop" role="dialog" aria-label="Kazandın">
            <div className="rp-burst" aria-hidden>✨</div>
            <h2>Kulağına müjde!</h2>
            <div className="muted">{got.title}</div>
            <RewardChips items={got.items} />
            <button className="btn" onClick={() => setGot(null)}>Süper</button>
          </div>
        </div>
      )}
      {note && <div className="toast">{note}</div>}
    </div>
  );
}
