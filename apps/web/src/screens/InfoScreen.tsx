import { CALENDAR, DAILY_CHEST_BASE, LUCKY_NOTE, MAX_STREAK_SHIELDS, DUPLICATE_VALUE, TREASURES, TIER_REWARD } from '@odi/content';
import { RewardChips, ScreenHead } from '../ui/bits';

/** Ödüller nasıl çalışır: tüm ihtimaller ve içerikler açıkça. Gizli olasılık yok, para yok. */
export function InfoScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="screen fade-in">
      <ScreenHead title="Ödüller nasıl çalışır?" onBack={onBack} />
      <div className="card info">
        <h2>🍀 Şanslı Nota</h2>
        <p>Her bölüme girişte <b>%{Math.round(LUCKY_NOTE.chance * 100)}</b> ihtimalle bir Şanslı Nota çıkar ve bölüm başında haber verilir. Yolun ortasındaki bir jetonun üstünde parlar; toplarsan sonuçta bonus alırsın:</p>
        <RewardChips items={LUCKY_NOTE.reward} small />
        <p className="muted">Satın alınamaz, para ile hiçbir ilgisi yoktur. İhtimal herkes için aynıdır.</p>
      </div>
      <div className="card info">
        <h2>🎁 Günlük sandık</h2>
        <p>Günün 3 görevi bitince açılır. İçeriği sandıkta önceden yazılıdır, rastgele değildir:</p>
        <RewardChips items={DAILY_CHEST_BASE} small />
        <p className="muted">+ ulaştığın biyomlardan sıradaki "sandık kartı" (kalmadıysa 30 jeton). Görevler her gün tarihe göre seçilir; aynı gün herkes aynı görevleri görür.</p>
      </div>
      <div className="card info">
        <h2>📅 Giriş takvimi ve seri</h2>
        <p>Her gün uğradığında serin bir artar ve takvimde bir gün ilerlersin. 7. günden sonra takvim baştan başlar.</p>
        <div className="info-cal">{CALENDAR.map((c) => <div key={c.day} className="row"><b className="w3">{c.day}. gün</b><RewardChips items={c.reward} small /></div>)}</div>
        <p><b>🛡️ Seri koruyucu:</b> günlük sandıktan ve takvimin 4. gününden gelir, en fazla {MAX_STREAK_SHIELDS} tane birikir. Bir günü kaçırırsan bir koruyucu harcanır ve serin korunur (kaçırılan gün sayılmaz). Koruyucu yoksa seri 1'den başlar; dert değil.</p>
      </div>
      <div className="card info">
        <h2>🗺️ Harita hazineleri</h2>
        <p>Bu bölümleri ilk kez bitirince açılır: {TREASURES.map((t) => t.level).join(', ')}. İçerikleri haritada görünür.</p>
      </div>
      <div className="card info">
        <h2>🏆 Başarımlar</h2>
        <div className="info-cal">
          <div className="row"><b className="w3">Bronz</b><RewardChips items={TIER_REWARD[1]} small /></div>
          <div className="row"><b className="w3">Gümüş</b><RewardChips items={TIER_REWARD[2]} small /></div>
          <div className="row"><b className="w3">Altın</b><RewardChips items={TIER_REWARD[3]} small /></div>
        </div>
        <p className="muted">Zaten sahip olduğun bir şey yeniden gelirse karşılığı jetondur: kozmetik {DUPLICATE_VALUE.kozmetik}, kart {DUPLICATE_VALUE.kart}, fazla koruyucu {DUPLICATE_VALUE.koruyucu} jeton.</p>
      </div>
    </div>
  );
}
