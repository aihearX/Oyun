/** Ayarlar › Gizlilik ve hakkında (metin: ../legal.ts; hukuk onayına kadar TASLAK) */
import { Sheet } from '../ui/social';
import { APP_VERSION, PRIVACY_DRAFT, PRIVACY_SECTIONS } from '../legal';

export function LegalSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Gizlilik ve hakkında" onClose={onClose}>
      <div className="legal-sheet" data-testid="gizlilik">
        {PRIVACY_DRAFT && <p className="legal-draft" data-testid="gizlilik-taslak">TASLAK: Bu metin hukuk onayı bekliyor; son hâli değildir.</p>}
        {PRIVACY_SECTIONS.map((s) => (
          <section key={s.title}><h3>{s.title}</h3><ul>{s.items.map((t) => <li key={t}>{t}</li>)}</ul></section>
        ))}
        <section><h3>Hakkında</h3>
          <ul>
            <li>ODİ: Sesin Yolu · sürüm {APP_VERSION} · aiHear</li>
            <li>Oyundaki odyoloji bilgileri öğreticidir; tanı koymaz, tıbbi tavsiye yerine geçmez.</li>
          </ul>
        </section>
      </div>
    </Sheet>
  );
}
