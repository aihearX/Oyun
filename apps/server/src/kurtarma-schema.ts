/**
 * Hesap kurtarma tabloları (1.2.0, kurtarma.ts). Göç 21 kurar (CREATE … IF NOT EXISTS: iki kez çalışması bir şey değiştirmez).
 * - kurtarma_istek: e-postayla giriş kodu istekleri. Kod bu sürümde otomatik gönderilmez: yönetici ekranında görünür, ekip elle
 *   e-postayla yollar; bu yüzden kod okunabilir tutulur (yalnız yönetici görür, en çok 24 saat geçerli, sonra 7 gün içinde silinir).
 * - kurtarma_log: deneme kaydı (IP ile; e-posta ve kod yazılmaz), 90 gün.
 * - geri_kod: yöneticinin ürettiği geri alma kodu (GERI-XXXX-XXXX); yalnız özeti tutulur, 24 saat.
 * - tasinan_anahtar: kurtarmayla geçersizleşen eski oturum anahtarlarının özeti: eski cihaz sessizce yeni hesap açmasın, "hesabın
 *   başka cihazda açıldı" desin (players.ts hello, TASINDI).
 */
export const KURTARMA_SCHEMA = `
CREATE TABLE IF NOT EXISTS kurtarma_istek(id TEXT PRIMARY KEY, eposta TEXT NOT NULL, kod TEXT NOT NULL, at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  tries INTEGER NOT NULL DEFAULT 0, durum TEXT NOT NULL DEFAULT 'bekliyor', used_at INTEGER, used_by TEXT, gonderildi_at INTEGER);
CREATE INDEX IF NOT EXISTS kurtarma_istek_eposta ON kurtarma_istek(eposta, at);
CREATE INDEX IF NOT EXISTS kurtarma_istek_at ON kurtarma_istek(at);
CREATE TABLE IF NOT EXISTS kurtarma_log(at INTEGER NOT NULL, ip TEXT NOT NULL DEFAULT '', player_id TEXT NOT NULL DEFAULT '', result TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS kurtarma_log_at ON kurtarma_log(at);
CREATE TABLE IF NOT EXISTS geri_kod(code_hash TEXT PRIMARY KEY, player_id TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER,
  created_by TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS tasinan_anahtar(token_hash TEXT PRIMARY KEY, player_id TEXT NOT NULL, at INTEGER NOT NULL);
`;
