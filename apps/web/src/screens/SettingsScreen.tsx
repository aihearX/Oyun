import { useStore } from '../store';

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const s = useStore();
  return (
    <div className="screen fade-in">
      <div className="topbar"><button className="btn ghost small" onClick={onBack} aria-label="Geri">← Profil</button></div>
      <h1>Ayarlar</h1>
      <div className="card skill"><div><h2>Sesler</h2><div className="muted">Efektler ve notalar</div></div><button className="btn small" onClick={() => s.setSounds(!s.sounds)}>{s.sounds ? 'Açık' : 'Kapalı'}</button></div>
      <div className="card skill"><div><h2>İlerlemeyi sıfırla</h2><div className="muted">Yıldızlar, jetonlar, yetenekler, başarımlar, kartlar ve kozmetikler silinir.</div></div><button className="btn coral small" onClick={() => { if (confirm('Tüm ilerleme silinsin mi?')) s.reset(); }}>Sıfırla</button></div>
      <div className="muted">ODİ: Sesin Yolu · sürüm 0.1 · Faz 1</div>
    </div>
  );
}
