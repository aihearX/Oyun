/**
 * Profil › Kurucular ("ODİ'yi birlikte kuranlar", YN-041): kapalı betanın Kurucu Yolcuları, kodu kullanma sırasıyla.
 * Yalnız "Adım listede görünsün" diyenlerin takma adı görünür (varsayılan kapalı; Ayarlar'dan ya da buradan değişir).
 * Kişisel veri yok: yalnız takma ad. Yalnız görünüş: sıralama, güç ya da ödül yok.
 */
import { useEffect, useState } from 'react';
import { useNet } from '@odi/net/store';
import { act, errText, getNet } from '../net';
import { ScreenHead } from '../ui/bits';
import { Art } from '../ui/art';
import { kurucuMu } from './rozet';
import './kurucu.css';

/** kurucunun kendi seçimi: adı Kurucular listesinde görünsün mü (Ayarlar ve Kurucular ekranı) */
export function KurucuSecim({ onChange }: { onChange?: () => void }) {
  const me = useNet((s) => s.me);
  const [busy, setBusy] = useState(false);
  if (!kurucuMu(me)) return null;
  const on = !!me?.listede;
  const toggle = async () => { setBusy(true); const r = await act('profile.update', { listede: !on }); setBusy(false); if (r) onChange?.(); };
  return (
    <div className="card kurucu-secim" data-testid="kurucu-secim">
      <div className="min0"><h2>Adım listede görünsün</h2><div className="muted">Takma adın Profil › Kurucular ekranında görünür. Rozetin her durumda sende kalır.</div></div>
      <button type="button" className={`btn small toggle-btn${on ? '' : ' ghost'}`} data-testid="kurucu-listede" aria-pressed={on} aria-label="Adım Kurucular listesinde görünsün" disabled={busy} onClick={() => void toggle()}>{on ? 'Açık' : 'Kapalı'}</button>
    </div>
  );
}

export function KurucularScreen({ onBack }: { onBack: () => void }) {
  const online = useNet((s) => s.status) === 'bağlı';
  const [list, setList] = useState<{ names: string[]; gizli: number } | null>(null);
  const [err, setErr] = useState('');
  const load = () => { const c = getNet(); if (!c || !online) return; c.call('kurucu.liste', {}).then((r) => { setList(r); setErr(''); }, (e) => setErr(errText(e))); };
  useEffect(load, [online]);
  return (
    <div className="screen fade-in" data-testid="kurucular">
      <ScreenHead title="Kurucular" onBack={onBack} />
      <div className="card kurucu-hero">
        <Art name="founder" size={56} />
        <div className="min0"><h2>ODİ'yi birlikte kuranlar</h2><p className="muted">Kapalı betada oyunu test edip bize yol gösteren Kurucu Yolcular. Kodu kullandıkları sırayla.</p></div>
      </div>
      <KurucuSecim onChange={load} />
      {!online && <div className="card muted">Liste sunucudan gelir; bağlantı gelince görünür.</div>}
      {err && <div className="chat-err" role="alert">{err}</div>}
      {online && !list && !err && <div className="card muted" aria-busy="true">Yükleniyor…</div>}
      {list && (
        <div className="card">
          {list.names.length
            ? <ol className="kurucu-list" data-testid="kurucu-listesi">{list.names.map((n, i) => <li key={`${i}-${n}`}><span className="kl-no">{i + 1}.</span><b data-ugc>{n}</b></li>)}</ol>
            : <div className="muted">Henüz listede görünmeyi seçen kurucu yok.</div>}
          {list.gizli > 0 && <div className="muted small-note">{list.gizli} kurucu adını listede göstermemeyi seçti.</div>}
        </div>
      )}
    </div>
  );
}
