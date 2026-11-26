/**
 * Ayarlar › Kimler mesaj atabilir (1.2.0): Herkes (varsayılan), Takımım ve arkadaşlarım, Yalnız arkadaşlarım. Sunucuda saklanır
 * (comm.settings dmKimden; apps/server/src/friends.ts dmBlockReason). Engellediğin kişi her durumda yazamaz; arkadaş olmayan biri
 * yalnız ikinizin de özel mesaj kilidi açıksa yazabilir.
 */
import { useNet } from '@odi/net/store';
import { DM_KIMDEN, DM_KIMDEN_AD, type DmKimden } from '@odi/shared';
import { act } from '../net';
import { useComm } from '../comm/state';

export function DmKimdenKart() {
  const online = useNet((s) => s.status) === 'bağlı';
  const st = useComm((s) => s.settings);
  if (!online || !st) return null;
  const cur: DmKimden = st.dmKimden ?? 'herkes';
  const set = async (v: DmKimden) => { if (v === cur) return; const r = await act('comm.settings', { dmKimden: v }); if (r) useComm.setState({ settings: r.settings }); };
  return (
    <div className="card" data-testid="dm-kimden">
      <h2>Kimler mesaj atabilir</h2>
      <div className="muted">Özel mesajı kimden alacağını sen seç. Engellediğin kişi hiçbir zaman yazamaz.</div>
      <div className="seg" role="radiogroup" aria-label="Kimler mesaj atabilir" style={{ marginTop: 8, flexWrap: 'wrap' }}>
        {DM_KIMDEN.map((v) => <button key={v} type="button" role="radio" aria-checked={cur === v} className={cur === v ? 'on' : ''} data-testid={`dm-kimden-${v}`} onClick={() => void set(v)}>{DM_KIMDEN_AD[v]}</button>)}
      </div>
    </div>
  );
}
