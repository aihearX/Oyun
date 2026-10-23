/**
 * Takım Akışı'nda Konsültasyon kartı: takım arkadaşı zorlandığı bir vakayı (kurgusal) takımına danışır. Arkadaşlar yalnız hazır
 * seçeneklerle (tanı adları) oy verir — serbest yazı yok (güvenli sohbet kuralı; yorum için kartın konusu, o da 8. bölüme kadar hazır
 * sözlerle). Soran vakayı çözünce kart kapanır ve doğru cevap görünür. Görüş bildirene küçük ödül (günde 5 ödüllü oy).
 */
import { useState } from 'react';
import type { ChatMessage } from '@odi/shared';
import { useNet } from '@odi/net/store';
import { KG_ODUL, odulMetni } from '@odi/content';
import { audio } from '@odi/audio';
import { act, toast } from '../../net';
import { platform } from '../../platform';
import { Art } from '../../ui/art';
import { OdiAvatar } from '../../ui/OdiAvatar';
import { fmtTime } from '../../ui/social';
import { ReactionBar, ThreadPreview, ThreadSheet } from '../../comm/Cards';
import { hatKey } from '../../screens/team/TeamMembers';
import { KgIcon } from './art';
import { celebrateReward, refreshKg } from './state';
import './gorev.css';

const s = (x: unknown) => (typeof x === 'string' ? x : x == null ? '' : String(x));
const n = (x: unknown) => (typeof x === 'number' ? x : Number(x) || 0);

export function KonsultCard({ m, live }: { m: ChatMessage; live: ChatMessage[] }) {
  const me = useNet((x) => x.me?.id);
  const [mine, setMine] = useState<number | null>(null); const [busy, setBusy] = useState(false); const [thread, setThread] = useState(false);
  const own = s(m.meta?.pid) === me; const done = !!m.meta?.done; const ans = done ? n(m.meta?.ans) : -1;
  const voted = mine !== null;
  const total = n(m.meta?.n);
  const vote = async (i: number) => {
    setBusy(true); const r = await act('vaka.oy', { msgId: m.id, choice: i }); setBusy(false);
    if (!r) return;
    setMine(i); audio.play('pop'); platform().haptic('light');
    useNet.setState({ wallet: r.wallet });
    if (Object.keys(r.reward).length) celebrateReward('Görüşün için teşekkürler!', r.reward); else toast('💬', 'Görüşün iletildi', 'Bugünün ödüllü görüşleri doldu; yine de takımına yardım ettin.', 'green');
    void refreshKg();
  };
  return (
    <div className={`fcard t-konsult${done ? ' done' : ''}`} data-testid="konsult-karti" data-id={m.id} data-done={done ? '1' : '0'}>
      <div className="fc-head">
        <span className="fc-av"><OdiAvatar size={38} color={n(m.meta?.pc) || 0x8b6bff} hat={hatKey(s(m.meta?.ph))} mood="wow" /><span className="fc-badge"><KgIcon name="konsult" size={16} /></span></span>
        <div className="fc-txt min0"><small>Konsültasyon · {fmtTime(m.at)}</small><b>{m.text}</b></div>
      </div>
      <div className="kg-ks-vaka"><b>{s(m.meta?.hasta)} · {s(m.meta?.baslik)}</b><p>{s(m.meta?.oyku)}</p><small>Kurgusal eğitim vakası · tıbbi öneri değildir</small></div>
      <div className="kg-ks-opts">
        {[0, 1, 2].map((i) => { const v = n(m.meta?.[`v${i}`]); const pct = total ? Math.round((v / total) * 100) : 0; const show = own || voted || done; return (
          <button key={i} type="button" className={`kg-ks-opt${done && i === ans ? ' ok' : ''}${mine === i ? ' mine' : ''}`} data-choice={i} disabled={own || voted || done || busy} onClick={() => void vote(i)}>
            {show && <i className="kg-ks-fill" style={{ width: `${pct}%` }} />}
            <span>{s(m.meta?.[`l${i}`])}</span>{show && <b>{v}</b>}{done && i === ans && <Art name="check" size={16} />}
          </button>); })}
      </div>
      <small className="muted small-note">{done ? 'Vaka çözüldü: doğru tanı işaretli.' : own ? `${total ? `${total} görüş geldi.` : 'Henüz görüş yok.'} Vakayı çözünce doğru cevap burada görünür.` : voted ? 'Görüşün iletildi. Vaka çözülünce doğru cevap görünür.' : `Bir tanı seç: görüş bildirene ${odulMetni(KG_ODUL.konsultOy).join(' + ')}.`}</small>
      <div className="fc-foot"><ReactionBar msg={m} compact /><span className="grow" /><button type="button" className="fc-ibtn" onClick={() => setThread(true)} aria-label="Yanıtla"><Art name="chat" size={18} /></button></div>
      <ThreadPreview parent={m} live={live} onOpen={() => setThread(true)} />
      {thread && <ThreadSheet parent={m} onClose={() => setThread(false)} ctx={['genel', 'tesekkur']} />}
    </div>
  );
}
