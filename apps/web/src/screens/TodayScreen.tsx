import { useEffect, useState, type MouseEvent } from 'react';
import { audio } from '@odi/audio';
import { MAX_STREAK_SHIELDS, questById, type RewardItem } from '@odi/content';
import { calendarView, chestReady, dailyChestReward, dailyFor, dayKey, explainReward, highestUnlocked, questDone, type CalendarDay, type RewardSwap } from '@odi/meta';
import { useStore } from '../store';
import { platform } from '../platform';
import { inviteUrl } from '../invite';
import { Bar, RewardChips, RewardGlyph, rewardLabel, rewardPlain, swapText, withSwapRows } from '../ui/bits';
import { celebrate } from '../celebrate';
import { chestTierFor } from '../celebrate/CelebrationLayer';
import { TopBar } from '../ui/social';
import { Art, Glyph } from '../ui/art';
import { useNav } from '../nav';

/** takvim hücresinin okunuşu (ekran okuyucu ve uzun basış): dönüşüm de söylenir */
function calDayText(d: CalendarDay): string {
  const what = d.reward.map(rewardPlain).join(', ');
  const swap = d.swaps.map((w) => swapText(w, d.state === 'alindi')).join('; ');
  return `${d.day}. gün${d.state === 'alindi' ? ' (alındı)' : ''}: ${what}${swap ? ` (${swap})` : ''}`;
}

/** Bugün: 7 günlük giriş takvimi, 3 günlük görev, içeriği önceden görünen günlük sandık, seri ve koruyucu. */
export function TodayScreen({ onInfo }: { onInfo: () => void }) {
  const s = useStore(); const today = dayKey(); const nav = useNav();
  useEffect(() => { s.touchDay(); }, []);
  const [note, setNote] = useState('');
  const [just, setJust] = useState<string | null>(null);
  const daily = dailyFor(s, today); const cal = calendarView(s, today);
  const chest = explainReward(s.meta, dailyChestReward(s)); const ready = chestReady(daily);
  const doneCount = daily.quests.filter(questDone).length;
  /**
   * sandık/takvim: kutlama katmanında açılır; gösterilen = verilen (store'un döndürdüğü öğeler aynen). Zaten sahip olunan şeyin
   * jetonu adıyla ayrı satırda ("Kulaklı Bere zaten dolabında" ×50); toplam aynı.
   */
  const openChest = (title: string, items: RewardItem[] | null, swaps: RewardSwap[], big = false) => { if (items) void celebrate.chest({ title, items: withSwapRows(items, swaps), tier: big ? 'altin' : chestTierFor(items) }); };
  const calShown = (cal.claimedToday ? cal.days[(cal.dayIndex + 1) % 7] : cal.days[cal.dayIndex])!;
  const calToday = cal.days[cal.dayIndex]!;
  /** görev: tamam sesi + kart parlaması; jetonlar düğmeden sayaca uçar, diğerleri şeritte yazılı */
  const claimQuest = (id: string, e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect(); const items = s.claimQuest(id); if (!items) return;
    audio.play('questDone'); platform().haptic('success'); setJust(id); setTimeout(() => setJust((j) => (j === id ? null : j)), 900);
    const coins = items.filter((i) => i.kind === 'jeton').reduce((a, i) => a + i.amount, 0);
    if (coins > 0) void celebrate.coins({ amount: coins, kind: 'jeton', from: { x: r.left + r.width / 2, y: r.top + r.height / 2 } });
    celebrate.banner({ icon: '✅', title: 'Görev tamam!', body: items.map(rewardLabel).join(' · '), tone: 'green' });
  };
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
        <div className="sc-flame" aria-hidden><Art name="flame" size={46} /></div>
        <div className="grow min0"><b className="big">{Math.max(1, s.streak)}. gün</b><div className="muted">Seri: her gün bir uğra, takvim ilerlesin.</div></div>
        <div className="shield-pill" title="Seri koruyucu: bir günü kaçırırsan serini korur"><Art name="shield" size="1.25em" className="art-inline" /> {s.meta.shields}/{MAX_STREAK_SHIELDS}</div>
      </div>

      <section className="card">
        <div className="row between"><h2>Giriş takvimi</h2><span className="muted">{cal.cycle > 1 ? `${cal.cycle}. tur` : '7 gün'}</span></div>
        <div className="calendar">
          {cal.days.map((d) => (
            <div key={d.day} className={`cal-day ${d.state}${d.big ? ' big' : ''}${d.swaps.length ? ' swap' : ''}`} title={calDayText(d)} aria-label={calDayText(d)}>
              <span className="cd-n">{d.day}</span>
              {/* zaten sahip olunan şey soluk görünür; yazan sayı verilen jeton (alınmadan önce ve sonra aynı) */}
              <span className="cd-i">{d.state === 'alindi' ? <Art name="check" size={22} /> : <RewardGlyph items={d.swaps.length ? d.swaps.map((w) => w.from) : d.reward} size={22} />}</span>
              <span className="cd-a">{d.reward.find((r) => r.kind === 'jeton')?.amount ?? ''}</span>
            </div>
          ))}
        </div>
        <div className="cal-today">
          <div className="grow min0">
            {cal.claimedToday && calToday.swaps.map((w, i) => <div className="muted cal-swap" key={`b${i}`}>Bugün: {swapText(w, true)}</div>)}
            <div className="muted">{cal.claimedToday ? 'Bugünün ödülü alındı. Yarın:' : `Bugün (${cal.dayIndex + 1}. gün):`}</div>
            <RewardChips items={calShown.reward} small />
            {calShown.swaps.map((w, i) => <div className="muted cal-swap" key={i}>{swapText(w)}</div>)}</div>
          <button className="btn small" disabled={cal.claimedToday || s.lastDay !== today} onClick={() => openChest(`Takvim · ${cal.dayIndex + 1}. gün`, s.claimCalendar(), calToday.swaps, !!calToday.big)}>{cal.claimedToday ? 'Alındı' : 'Al'}</button>
        </div>
      </section>

      <section className="card">
        <div className="row between"><h2>Günlük görevler</h2><span className="muted">{doneCount}/3</span></div>
        <div className="quests">
          {daily.quests.map((q) => { const d = questById(q.id); if (!d) return null; const ok = questDone(q); return (
            <div className={`quest${ok ? ' ok' : ''}${q.claimed ? ' claimed' : ''}${just === q.id ? ' just' : ''}`} key={q.id}>
              <span className="qe"><Glyph e={q.claimed ? '✅' : d.emoji} size={26} /></span>
              <div className="grow min0">
                <div className="qt">{d.text}</div>
                <div className="row qbar"><Bar value={q.progress / d.target} tone="green" label={d.text} /><span className="qn">{q.progress}/{d.target}</span></div>
                <RewardChips items={d.reward} small />
              </div>
              {q.claimed ? <span className="muted">Alındı</span>
                : ok ? <button className="btn small" onClick={(e) => claimQuest(q.id, e)}>Al</button>
                : d.metric === 'share' ? <button className="btn small" onClick={() => void challenge()}>Paylaş</button> : null}
            </div>); })}
        </div>
      </section>

      <section className={`card chest${ready ? ' ready' : ''}${daily.chestOpened ? ' opened' : ''}`}>
        <div className="chest-icon" aria-hidden><Art name={daily.chestOpened ? 'mail' : 'chest'} size={52} /></div>
        <div className="grow min0">
          <h2>Günlük sandık</h2>
          <div className="muted">{daily.chestOpened ? 'Açıldı. Yarın yeni görevler, yeni sandık.' : ready ? 'Üç görev de tamam. Aç bakalım!' : `Üç görev bitince açılır (${doneCount}/3). İçinde:`}</div>
          {!daily.chestOpened && <RewardChips items={chest.items} small />}
          {!daily.chestOpened && chest.swaps.map((w, i) => <div className="muted cal-swap" key={i}>{swapText(w)}</div>)}
        </div>
        {!daily.chestOpened && <button className="btn small" disabled={!ready} onClick={() => openChest('Günlük sandık', s.openChest(), chest.swaps)}>Aç</button>}
      </section>

      {/* tek kişilik bilgi pratiği (YN-078): takımsız ve çevrimdışı da; ödülsüz, bu yüzden görev/sandık akışının dışında */}
      <section className="card pratik-kart" data-testid="bugun-pratik">
        <div className="pk-icon" aria-hidden><Art name="bulb" size={44} /></div>
        <div className="grow min0">
          <h2>Bilgi pratiği</h2>
          <div className="muted">Tek başına 10 soru, her cevaptan sonra açıklama. Ödülsüz, yalnız öğrenmek için.</div>
          <button className="btn small pk-btn" data-testid="bugun-pratik-ac" onClick={() => nav.open({ name: 'pratik' })}>Pratik yap</button>
        </div>
      </section>

      <button className="linkish" onClick={onInfo}>Ödüller nasıl çalışır? Şanslı Nota ihtimali, sandık içerikleri →</button>

      {note && <div className="toast">{note}</div>}
    </div>
  );
}
