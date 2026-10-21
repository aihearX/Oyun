/**
 * Odi'nin görünüşü — TEK KAYNAK. Renk: takma ad sayfasında seçilen (ya da Dolap'ta açıkça giyilen) `odiColor`;
 * yoksa Dolap'taki renk kozmetiği. Şapka: Dolap. Bölüm, harita, kamp, profil, sonuç, açılış ve yarış hep buradan okur;
 * sunucu profiline de aynı renk yazılır (arkadaşlar, takım, yarış hayaletleri aynı Odi'yi görür).
 */
import { resolveLook } from '@odi/meta';
import { DEFAULT_COLOR_ID } from '@odi/content';
import type { NetClient } from '@odi/net';
import { useStore } from './store';

export interface OdiLook { color: number; hat?: string; colorId: string; /** oyuncu rengini kendisi seçti (bölüm varsayılan biyom rengini kullanmaz) */ custom: boolean }
type S = Pick<ReturnType<typeof useStore.getState>, 'meta' | 'odiColor'>;
export function odiLook(s: S): OdiLook {
  const l = resolveLook(s.meta);
  return { color: s.odiColor ?? l.color, hat: l.hat, colorId: l.colorId, custom: s.odiColor != null || l.colorId !== DEFAULT_COLOR_ID };
}
export function useOdiLook(): OdiLook {
  const meta = useStore((s) => s.meta); const odiColor = useStore((s) => s.odiColor);
  return odiLook({ meta, odiColor });
}

/** 0xRRGGBB rengini aç (k>0, beyaza doğru) ya da koyulaştır (k<0) → #rrggbb */
export function tone(color: number, k: number): string {
  const ch = [(color >> 16) & 255, (color >> 8) & 255, color & 255].map((c) => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k)));
  return `#${ch.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Sunucu profiliyle eşitle: renk yerelde tutulur (çevrimdışı da geçerli) ve her değişimde `profile.update { color }` gider.
 * İlk bağlantı: yerel renk yoksa ve oyuncu takma adını seçmişse (sunucudaki renk onun seçtiğidir) o renk benimsenir;
 * Dolap'ta varsayılan dışı bir renk giyiliyse o renk esas alınır ve sunucuya yazılır.
 */
const isDefaultName = (n: string) => /^Odi\d{4}$/.test(n);
export function bindOdiColor(c: NetClient): () => void {
  const push = () => {
    const col = useStore.getState().odiColor;
    if (col == null || c.status !== 'bağlı' || !c.me || c.me.color === col) return;
    void c.call('profile.update', { color: col }).catch(() => undefined);
  };
  const offMe = c.onMe((me) => {
    if (!me) return;
    const s = useStore.getState();
    if (s.odiColor == null) {
      const l = resolveLook(s.meta);
      if (l.colorId !== DEFAULT_COLOR_ID) s.setOdiColor(l.color);
      else if (!isDefaultName(me.name)) s.setOdiColor(me.color, true);
    }
    push();
  });
  const offSt = c.onStatus((st) => { if (st === 'bağlı') push(); });
  const offStore = useStore.subscribe((n, p) => { if (n.odiColor !== p.odiColor) push(); });
  return () => { offMe(); offSt(); offStore(); };
}
