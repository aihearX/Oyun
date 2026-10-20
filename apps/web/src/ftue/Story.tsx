import { useEffect, useState, type ReactNode } from 'react';
import { Art } from '../ui/art';
import { OdiHero } from '../screens/TitleScreen';
import { TuyDede } from './Narrator';
import { SpeechPanel, sayAloud, stopVoice, useTypewriter } from './Coach';
import { audio } from '@odi/audio';
import { lineText } from './script';
import { prefetchLines } from './voice';

/** Hikâye girişi: kim, ne tehlike, hedef ne, kim yardım eder. Kısa (7 cümle), atlanabilir; sonunda doğrudan 1. bölüm. */
export const STORY: { id: string; say: string; scene: () => ReactNode; mood?: 'happy' | 'wow' | 'wink'; dark?: boolean }[] = [
  { id: 'hikaye-01', say: lineText('hikaye-01'), scene: () => <div className="sc-a float"><TuyDede size={210} talking /></div> },
  { id: 'hikaye-02', say: lineText('hikaye-02'), scene: () => <>
    <div className="sc-a float"><OdiHero size={190} /></div>
    <span className="sc-a glow float" style={{ left: '14%', top: '18%' }}><Art name="note" size={34} /></span>
    <span className="sc-a glow float" style={{ right: '14%', top: '24%', animationDelay: '-2s' }}><Art name="note" size={26} /></span>
  </> },
  { id: 'hikaye-03', say: lineText('hikaye-03'), scene: () => <JourneyScene /> },
  { id: 'hikaye-04', say: lineText('hikaye-04'), mood: 'wow', dark: true, scene: () => <>
    <span className="sc-a shake"><Art name="monster" size={150} /></span>
    <span className="sc-a dim" style={{ left: '12%', top: '16%' }}><Art name="note" size={30} /></span>
    <span className="sc-a dim" style={{ right: '12%', bottom: '16%' }}><Art name="shell" size={34} /></span>
  </> },
  { id: 'hikaye-05', say: lineText('hikaye-05'), scene: () => <>
    <span className="sc-a glow float"><Art name="star" size={120} /></span>
    <span className="sc-a float" style={{ left: '16%', bottom: '18%', animationDelay: '-1s' }}><Art name="star" size={46} /></span>
    <span className="sc-a float" style={{ right: '16%', bottom: '18%', animationDelay: '-3s' }}><Art name="star" size={46} /></span>
  </> },
  { id: 'hikaye-06', say: lineText('hikaye-06'), mood: 'wink', scene: () => <>
    <span className="sc-a float"><Art name="users" size={130} /></span>
    <span className="sc-a glow float" style={{ right: '18%', top: '18%', animationDelay: '-2s' }}><Art name="heart" size={40} /></span>
    <span className="sc-a float" style={{ left: '14%', bottom: '14%' }}><TuyDede size={84} /></span>
  </> },
  { id: 'hikaye-07', say: lineText('hikaye-07'), scene: () => <>
    <div className="sc-a float"><OdiHero size={170} /></div>
    <span className="sc-a" style={{ right: '16%', bottom: '14%' }}><Art name="play" size={54} /></span>
  </> },
];

/** kulaktan beyne yol: kulak kepçesi → kanal → kulak zarı → koklea → beyin (ui/art ikonlarıyla) */
function JourneyScene() {
  const stops: [string, number, number, Parameters<typeof Art>[0]['name']][] = [['Kepçe', 18, 74, 'ear'], ['Kulak zarı', 40, 44, 'target'], ['Koklea', 64, 66, 'shell'], ['Beyin', 80, 24, 'bulb']];
  return (
    <>
      <svg className="path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <path d="M18 74 C28 60 32 48 40 44 S56 70 64 66 S78 36 82 28" fill="none" stroke="rgba(255,201,60,.75)" strokeWidth="1.6" strokeDasharray="2.4 2.4" strokeLinecap="round" />
      </svg>
      {stops.map(([label, x, y, art], i) => (
        <span key={label} className="sc-a float" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', animationDelay: `${-i}s`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Art name={art} size={44} /><small style={{ fontWeight: 900, fontSize: 11, color: 'var(--text-2)' }}>{label}</small>
        </span>
      ))}
      <span className="sc-a" style={{ left: '24%', top: '56%' }}><OdiHero size={46} /></span>
    </>
  );
}

export function StoryScreen({ onDone, replay }: { onDone: () => void; replay?: boolean }) {
  const [i, setI] = useState(0);
  const s = STORY[i]!;
  const tw = useTypewriter(s.say, i);
  useEffect(() => { sayAloud(s.say, s.id); prefetchLines(STORY.slice(i + 1, i + 3).map((x) => ({ id: x.id, text: x.say }))); return () => stopVoice(); }, [i]);
  useEffect(() => { audio.music('menu'); }, []);
  const next = () => { if (!tw.done) { tw.finish(); return; } stopVoice(); audio.play('tap'); if (i + 1 >= STORY.length) onDone(); else setI(i + 1); };
  return (
    <div className="story" data-testid="hikaye" data-step={i} onClick={next}>
      <div className="story-top" onClick={(e) => e.stopPropagation()}>
        <span className="st-k">{replay ? 'Hikâye' : 'ODİ · Sesin Yolu'}</span>
        <button type="button" className="story-skip" onClick={() => { stopVoice(); onDone(); }}>Atla</button>
      </div>
      <div className="story-scene"><div className={`scene${s.dark ? ' dark' : ''}`} key={i}>{s.scene()}</div></div>
      <SpeechPanel text={s.say} typed={tw.shown} typing={!tw.done} index={i} total={STORY.length} mood={s.mood} onNext={next} />
    </div>
  );
}
