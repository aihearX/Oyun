/**
 * 1.3.0 anlık bildirim tabloları (göç 22; push.ts). Ayrı dosya: göçler (migrations.ts) oyuncu modüllerini içe aktarmasın.
 * - push_tokens: cihazın Expo bildirim anahtarı → oyuncu. Anahtar tek oyuncuya aittir (birincil anahtar); hesap değişince yeni
 *   oyuncuya geçer. Bir oyuncunun birden çok cihazı olabilir. Hesap silinince, bütün bildirimler kapatılınca ya da telefonda izin
 *   kapalıysa silinir; Expo "cihaz kayıtlı değil" derse de silinir.
 * - push_settings: bildirim türleri (Ayarlar › Bildirimler). Satır yoksa varsayılanlar (PUSH_VARSAYILAN): özel mesaj açık, takım
 *   sohbeti kapalı, arkadaşlar ve hediyeler açık, takım başvuruları açık.
 */
export const PUSH_SCHEMA = `
CREATE TABLE IF NOT EXISTS push_tokens(token TEXT PRIMARY KEY, player_id TEXT NOT NULL, platform TEXT NOT NULL, at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS push_tokens_player ON push_tokens(player_id);
CREATE TABLE IF NOT EXISTS push_settings(player_id TEXT PRIMARY KEY, dm INTEGER NOT NULL DEFAULT 1, takim INTEGER NOT NULL DEFAULT 0,
  arkadas INTEGER NOT NULL DEFAULT 1, basvuru INTEGER NOT NULL DEFAULT 1, at INTEGER NOT NULL);
`;
