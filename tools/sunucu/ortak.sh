# shellcheck shell=bash
# shellcheck disable=SC2034  # buradaki değişkenleri bu dosyayı okuyan betikler kullanır
# ODİ sunucu betiklerinin ortak parçası (docs/18-sunucu-kurulum.md).
# kur.sh depodaki kopyayı, yardımcı komutlar (odi-guncelle, odi-durum, …) /usr/local/lib/odi/ortak.sh kopyasını okur.
#
# Gizlilik kuralı: yönetici kodu ve DuckDNS token'ı yalnız kabuk değişkeninde (dışa aktarılmadan) ya da standart girdide
# dolaşır; hiçbir komutun argümanına, günlüğe ya da ekrana yazılmaz. Bu dosyada ve onu okuyan betiklerde `set -x` kullanılmaz.

export LC_ALL=C.UTF-8
umask 022

# ---------------------------------------------------------------- yerler
ODI_KOK=/opt/odi
ODI_KAYNAK=$ODI_KOK/kaynak          # git klonu (odi kullanıcısının; derleme burada)
ODI_SURUMLER=$ODI_KOK/surumler      # derlenmiş sürümler (root'un; salt okunur)
ODI_GUNCEL=$ODI_KOK/guncel          # çalışan sürüme bağlantı
ODI_EV=$ODI_KOK/ev                  # derleme kullanıcısının ev klasörü (npm önbelleği)
ODI_VERI=/var/lib/odi               # veritabanı ve yedekler (servisin yazabildiği tek yer)
ODI_YEDEK=$ODI_VERI/yedek
ODI_DB=$ODI_VERI/odi.sqlite
ODI_ETC=/etc/odi
ODI_ENV=$ODI_ETC/odi.env            # 0600 root:root: systemd EnvironmentFile'ı root olarak okur, odi kullanıcısı göremez
ODI_CONF=$ODI_ETC/kurulum.conf      # gizli olmayan kurulum bilgisi (alan adı, dal, kaynak)
ODI_TOKEN_DOSYA=$ODI_ETC/duckdns.token
ODI_LIB=/usr/local/lib/odi
ODI_BIN=/usr/local/bin
ODI_KULLANICI=odi
ODI_PORT=8787
ODI_HOST=127.0.0.1                  # oyun sunucusu yalnız makinenin içinden erişilir; dışarıya Caddy (80/443) açılır
ODI_NODE_EN_AZ=22.13
ODI_SURUM_TUT=3                     # diskte tutulan sürüm sayısı
ODI_KOD_EN_AZ=16
ODI_KOD_EN_COK=32

# ---------------------------------------------------------------- ekran
if [ -t 1 ]; then _R=$'\033[0m'; _M=$'\033[1;36m'; _Y=$'\033[1;32m'; _S=$'\033[1;33m'; _K=$'\033[1;31m'; _B=$'\033[1m'
else _R=; _M=; _Y=; _S=; _K=; _B=; fi
baslik() { printf '\n%s== %s ==%s\n' "$_B" "$*" "$_R"; }
bilgi()  { printf '%s▸%s %s\n' "$_M" "$_R" "$*"; }
tamam()  { printf '%s✓%s %s\n' "$_Y" "$_R" "$*"; }
uyari()  { printf '%s!%s %s\n' "$_S" "$_R" "$*" >&2; }
hata()   { printf '%s✗%s %s\n' "$_K" "$_R" "$*" >&2; }
olum()   { hata "$*"; exit 1; }

root_gerek() { [ "$(id -u)" -eq 0 ] || olum "Bu komut yönetici yetkisiyle çalışır: sudo $*"; }

# ---------------------------------------------------------------- yardımcılar
# kurulum.conf'tan bir değer (dosya kaynak olarak okunmaz; yalnız ANAHTAR=değer satırları)
conf_oku() {
  local anahtar=$1 satir
  [ -r "$ODI_CONF" ] || return 0
  while IFS= read -r satir || [ -n "$satir" ]; do
    case $satir in "$anahtar="*) printf '%s' "${satir#*=}"; return 0 ;; esac
  done < "$ODI_CONF"
}

# ANAHTAR=değer dosyasında bir anahtarı ayarla (yalnız kabuk yerleşikleriyle: değer hiçbir komutun argümanına girmez).
# Diğer satırlar (elle eklenen REVENUECAT_API_KEY gibi) korunur. Dosya 0600 root:root yazılır.
anahtar_ayarla() {
  local dosya=$1 anahtar=$2 deger=$3 satir gecici
  gecici=$(mktemp "$dosya.XXXXXX")
  chmod 0600 "$gecici"
  {
    if [ -f "$dosya" ]; then
      while IFS= read -r satir || [ -n "$satir" ]; do
        case $satir in "$anahtar="*) ;; *) printf '%s\n' "$satir" ;; esac
      done < "$dosya"
    fi
    printf '%s=%s\n' "$anahtar" "$deger"
  } > "$gecici"
  mv -f "$gecici" "$dosya"
}

env_oku() {
  local anahtar=$1 satir
  [ -r "$ODI_ENV" ] || return 0
  while IFS= read -r satir || [ -n "$satir" ]; do
    case $satir in "$anahtar="*) printf '%s' "${satir#*=}"; return 0 ;; esac
  done < "$ODI_ENV"
}

node_uygun() {
  command -v node >/dev/null 2>&1 || return 1
  node -e 'const [a,b]=process.versions.node.split(".").map(Number);const [x,y]=process.argv[1].split(".").map(Number);process.exit(a>x||(a===x&&b>=y)?0:1)' "$ODI_NODE_EN_AZ"
}

# odi kullanıcısı olarak komut (derleme, test, git). Vekil ayarları varsa geçer (yalnız test ortamı için).
odi_olarak() {
  local -a ortam=("HOME=$ODI_EV" "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    "LC_ALL=C.UTF-8" "npm_config_cache=$ODI_EV/.npm" "npm_config_update_notifier=false" "npm_config_fund=false"
    "npm_config_audit=false" "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1" "CI=1")
  local v
  for v in https_proxy HTTPS_PROXY no_proxy NO_PROXY NODE_EXTRA_CA_CERTS GIT_SSL_CAINFO SSL_CERT_FILE npm_config_https_proxy npm_config_noproxy; do
    [ -n "${!v:-}" ] && ortam+=("$v=${!v}")
  done
  runuser -u "$ODI_KULLANICI" -- env -i "${ortam[@]}" "$@"
}

# ---------------------------------------------------------------- yönetici kodu
# Gizli girişle iki kez sorar; sonuç ODI__KOD kabuk değişkeninde (dışa aktarılmaz). Kaba ön denetim burada,
# kesin denetim (oyunun kabul ettiği biçim) kod.mjs ozet'te.
kod_on_denetim() {
  local k=$1 sade
  sade=${k//[[:space:]]/}
  if [ "${#sade}" -lt "$ODI_KOD_EN_AZ" ]; then echo "en az $ODI_KOD_EN_AZ karakter olmalı (boşluklar sayılmaz)"; return 1; fi
  if [ "${#sade}" -gt "$ODI_KOD_EN_COK" ]; then echo "en çok $ODI_KOD_EN_COK karakter olmalı (boşluklar sayılmaz)"; return 1; fi
  case $sade in *[!A-Za-z0-9ÇĞİÖŞÜçğıöşü-]*) echo "yalnız harf, rakam ve tire kullanın"; return 1 ;; esac
  return 0
}

kod_sor() {
  local k1 k2 neden
  [ -t 0 ] || olum "Yönetici kodu sorulamıyor (terminal yok). Etkileşimsiz kullanımda ODI_KUR_KOD verin."
  while :; do
    printf 'Yönetici kodu (%s–%s karakter; harf, rakam, tire; ekranda görünmez): ' "$ODI_KOD_EN_AZ" "$ODI_KOD_EN_COK" >&2
    IFS= read -r -s k1; printf '\n' >&2
    if ! neden=$(kod_on_denetim "$k1"); then hata "Kod uygun değil: $neden."; continue; fi
    printf 'Aynı kodu yeniden yazın: ' >&2
    IFS= read -r -s k2; printf '\n' >&2
    if [ "$k1" != "$k2" ]; then hata "İki giriş aynı değil; yeniden deneyin."; continue; fi
    ODI__KOD=$k1
    k1=; k2=
    return 0
  done
}

# ODI__KOD'un tuzlu özetini üretir (kod standart girdiden; printf kabuk yerleşiği, argümanlarda görünmez) → ODI__OZET
kod_ozetle() {
  local kodmjs=$1 cikti
  if ! cikti=$(printf '%s' "$ODI__KOD" | node --disable-warning=ExperimentalWarning "$kodmjs" ozet 2>&1); then
    printf '%s\n' "$cikti" | sed 's/^✗ /  /' >&2
    return 1
  fi
  case $cikti in scrypt:*:*) ODI__OZET=$cikti ;; *) hata "Özet üretilemedi."; return 1 ;; esac
}

# ---------------------------------------------------------------- derleme ve sürümler
# kaynak klasörünü verilen dala getirir; derlenecek commit'i yazar
kaynak_guncelle() {
  local dal=$1
  odi_olarak git -C "$ODI_KAYNAK" fetch --quiet --depth 50 origin "$dal" || return 1
  odi_olarak git -C "$ODI_KAYNAK" checkout --quiet --force -B "$dal" FETCH_HEAD || return 1
  odi_olarak git -C "$ODI_KAYNAK" clean --quiet -fdx -e node_modules -e '**/node_modules' || return 1
  odi_olarak git -C "$ODI_KAYNAK" rev-parse HEAD
}

# bağımlılıklar: package-lock.json değişmediyse yeniden kurulmaz. Yükleme betikleri çalıştırılmaz (--ignore-scripts):
# derleme ve testler için gerekmez, tedarik zinciri riskini azaltır. Mobil uygulama bağımlılıkları kurulmaz.
bagimlilik_kur() {
  local isaret=$ODI_KAYNAK/node_modules/.odi-kilit yeni eski=
  yeni=$(sha256sum "$ODI_KAYNAK/package-lock.json" | cut -d' ' -f1)
  [ -f "$isaret" ] && eski=$(cat "$isaret")
  if [ "$yeni" = "$eski" ] && [ -d "$ODI_KAYNAK/node_modules" ]; then tamam "Bağımlılıklar güncel."; return 0; fi
  bilgi "Bağımlılıklar kuruluyor (npm ci; birkaç dakika sürebilir)…"
  ( cd "$ODI_KAYNAK" && odi_olarak npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund --loglevel=error \
      -w @odi/server -w @odi/web --include-workspace-root ) || return 1
  printf '%s\n' "$yeni" | odi_olarak tee "$isaret" >/dev/null
}

derle() {
  bilgi "Oyun sunucusu derleniyor…"
  ( cd "$ODI_KAYNAK" && odi_olarak npm run --silent build:server ) || return 1
  bilgi "Web sürümü derleniyor…"
  ( cd "$ODI_KAYNAK" && odi_olarak npm run --silent build:web ) || return 1
  [ -s "$ODI_KAYNAK/apps/server/dist/server.mjs" ] && [ -s "$ODI_KAYNAK/apps/web/dist/index.html" ]
}

# Küçük makinede (2 OCPU) zamanlamaya bağlı testler yavaşlayabilir: süre sınırları geniş, iki işçi, düşen test bir kez
# daha denenir (gerçek bir hata iki denemede de düşer).
birim_testleri() {
  bilgi "Sunucu birim testleri çalışıyor (apps/server/test)…"
  ( cd "$ODI_KAYNAK" && odi_olarak timeout 1800 npx vitest run apps/server/test --reporter=dot --testTimeout=30000 --hookTimeout=30000 --maxWorkers=2 --retry=1 )
}

# derlenmiş çıktıyı yeni sürüm klasörüne kopyalar → ODI__YENI_SURUM
surum_hazirla() {
  local sha=$1 dal=$2 ad
  ad="$(date -u +%Y%m%d-%H%M%S)-${sha:0:8}"
  ODI__YENI_SURUM=$ODI_SURUMLER/$ad
  install -d -m 0755 "$ODI__YENI_SURUM/sunucu"
  cp "$ODI_KAYNAK"/apps/server/dist/server.mjs "$ODI_KAYNAK"/apps/server/dist/server.mjs.map \
     "$ODI_KAYNAK"/apps/server/dist/kod.mjs "$ODI__YENI_SURUM/sunucu/"
  cp -r "$ODI_KAYNAK/apps/web/dist" "$ODI__YENI_SURUM/web"
  # açık oturumlar eski sürümün geç yüklenen parçalarını isteyebilir: önceki sürümün parmak izli dosyaları da kalır
  if [ -d "$ODI_GUNCEL/web/assets" ] && [ -d "$ODI__YENI_SURUM/web/assets" ]; then
    cp -an "$ODI_GUNCEL/web/assets/." "$ODI__YENI_SURUM/web/assets/" 2>/dev/null || true
  fi
  printf 'commit=%s\ndal=%s\nderleme=%s\n' "$sha" "$dal" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "$ODI__YENI_SURUM/SURUM"
  chown -R root:root "$ODI__YENI_SURUM"
  chmod -R u=rwX,go=rX "$ODI__YENI_SURUM"
}

# yeni paketi geçici bir örnek olarak açıp /saglik'e bakar. Varsa en yeni yedeğin bir kopyasıyla açar
# (göçler gerçek veride denenir); üretim veritabanına ve portuna dokunmaz.
duman_testi() {
  local surum=$1 port gecici db yedek pid i=0 sonuc=1
  port=$(( 20000 + RANDOM % 20000 ))
  gecici=$(mktemp -d "$ODI_VERI/duman.XXXXXX")
  chown "$ODI_KULLANICI:$ODI_KULLANICI" "$gecici"; chmod 0700 "$gecici"
  db=$gecici/duman.sqlite
  yedek=$(son_yedek)
  if [ -n "$yedek" ]; then install -o "$ODI_KULLANICI" -g "$ODI_KULLANICI" -m 0600 "$yedek" "$db"; fi
  runuser -u "$ODI_KULLANICI" -- env -i PATH=/usr/bin:/bin NODE_ENV=production HOST=127.0.0.1 PORT="$port" ODI_DB="$db" ODI_LOG=0 \
    node --disable-warning=ExperimentalWarning "$surum/sunucu/server.mjs" > "$gecici/cikti.log" 2>&1 &
  pid=$!
  while [ $i -lt 30 ]; do
    if curl -fsS --max-time 2 "http://127.0.0.1:$port/saglik" 2>/dev/null | grep -q '"ok":true'; then sonuc=0; break; fi
    kill -0 "$pid" 2>/dev/null || break
    sleep 1; i=$((i + 1))
  done
  kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
  if [ $sonuc -ne 0 ]; then hata "Yeni sürüm açılmadı. Çıktısı:"; tail -n 20 "$gecici/cikti.log" >&2; fi
  rm -rf "$gecici"
  return $sonuc
}

# çalışan veritabanının anlık yedeği (sürüm geçişinden önce). Sunucunun kendi yedekleriyle aynı ad ve klasör: aynı
# sırayla döner. VACUUM INTO salt okunur bağlantıyla yapılır (WAL açıkken de tutarlı; çalışan servise dokunmaz).
anlik_yedek() {
  [ -f "$ODI_DB" ] || return 0
  local hedef
  hedef=$ODI_YEDEK/odi-yedek-$(date -u +%Y%m%d-%H%M%S).sqlite
  [ -e "$hedef" ] && return 0
  # shellcheck disable=SC2016  # JavaScript şablon dizgisi
  runuser -u "$ODI_KULLANICI" -- node --disable-warning=ExperimentalWarning -e '
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(process.argv[1], { readOnly: true });
    db.exec(`VACUUM INTO ${JSON.stringify(process.argv[2]).replace(/^"|"$/g, "\x27")}`);
    db.close();' "$ODI_DB" "$hedef" || return 1
  printf '%s' "$hedef"
}

# çalışan sürüme bağlantıyı tek adımda değiştirir
surume_gec() {
  ln -sfn "$1" "$ODI_GUNCEL.yeni"
  mv -Tf "$ODI_GUNCEL.yeni" "$ODI_GUNCEL"
}

eski_surumleri_sil() {
  local guncel s n=0
  guncel=$(readlink -f "$ODI_GUNCEL" 2>/dev/null || true)
  while IFS= read -r s; do
    [ -n "$s" ] || continue
    n=$((n + 1))
    if [ $n -gt "$ODI_SURUM_TUT" ] && [ "$s" != "$guncel" ]; then rm -rf "$s"; fi
  done < <(find "$ODI_SURUMLER" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null | sort -r | sed "s|^|$ODI_SURUMLER/|")
}

surum_bilgisi() { # $1 sürüm klasörü → "kısa-sha (tarih)"
  local f=$1/SURUM c='' t=''
  [ -r "$f" ] || { printf '(bilinmiyor)'; return; }
  c=$(sed -n 's/^commit=//p' "$f"); t=$(sed -n 's/^derleme=//p' "$f")
  printf '%s (%s)' "${c:0:8}" "$t"
}

son_yedek() { find "$ODI_YEDEK" -maxdepth 1 -name 'odi-yedek-*.sqlite' -type f 2>/dev/null | sort | tail -n 1; }

# 127.0.0.1 üzerinden oyun sunucusunun sağlığını bekler
saglik_bekle() {
  local sure=${1:-60} i=0
  while [ $i -lt "$sure" ]; do
    curl -fsS --max-time 2 "http://$ODI_HOST:$ODI_PORT/saglik" 2>/dev/null | grep -q '"ok":true' && return 0
    sleep 1; i=$((i + 1))
  done
  return 1
}

# Gereksiz ağ servisleri (YN-036): Oracle'ın Ubuntu görüntüsünde rpcbind 0.0.0.0:111'i (TCP+UDP) dinler; NFS kullanılmıyor.
# Birim yoksa sessizce atlanır; zaten kapalıysa bir şey yazmaz (yeniden çalıştırmak güvenlidir).
GEREKSIZ_BIRIMLER=(rpcbind.socket rpcbind.service)
gereksiz_servisleri_kapat() {
  local u acik=0 var=()
  command -v systemctl >/dev/null 2>&1 || return 0
  for u in "${GEREKSIZ_BIRIMLER[@]}"; do
    [ -n "$(systemctl list-unit-files "$u" --no-legend 2>/dev/null)" ] || continue
    var+=("$u")
    if [ "$(systemctl is-enabled "$u" 2>/dev/null)" = enabled ] || systemctl is-active --quiet "$u" 2>/dev/null; then acik=1; fi
  done
  [ "$acik" -eq 1 ] || return 0
  systemctl disable --now --quiet "${var[@]}" 2>/dev/null || true
  if systemctl is-active --quiet "${var[@]}" 2>/dev/null; then uyari "rpcbind kapatılamadı: sudo systemctl disable --now ${var[*]}"
  else tamam "rpcbind kapatıldı ve açılışta başlamayacak (111 artık dinlenmiyor; NFS kullanılmıyor)."; fi
}

# ---------------------------------------------------------------- yapılandırma dosyaları (kur.sh ve --deneme)
env_icerigi() { # $1 = özet satırının değeri (deneme modunda yer tutucu)
  cat <<EOF
# ODİ sosyal sunucusu ayarları: tools/sunucu/kur.sh yazdı (docs/18-sunucu-kurulum.md).
# İzin 0600 root:root: systemd bu dosyayı root olarak okuyup servise verir; odi kullanıcısı dosyayı okuyamaz.
# Elle değiştirince: sudo systemctl restart odi
NODE_ENV=production
HOST=$ODI_HOST
PORT=$ODI_PORT
ODI_DB=$ODI_DB
ODI_BACKUP_DIR=$ODI_YEDEK
ODI_BACKUP_HOURS=6
ODI_BACKUP_KEEP=28
ODI_TRUST_PROXY=1
ODI_TEST_STORE=0
ODI_NEW_PER_IP_HOUR=20
ODI_ADMIN_CODE_HASH=$1
EOF
}

odi_unit() {
  local node_yolu=${1:-/usr/bin/node}
  cat <<EOF
# ODİ sosyal sunucusu: tools/sunucu/kur.sh yazdı
[Unit]
Description=ODİ: Sesin Yolu sosyal sunucusu
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$ODI_KULLANICI
Group=$ODI_KULLANICI
EnvironmentFile=$ODI_ENV
WorkingDirectory=$ODI_VERI
ExecStart=$node_yolu --disable-warning=ExperimentalWarning --enable-source-maps $ODI_GUNCEL/sunucu/server.mjs
Restart=always
RestartSec=3
TimeoutStopSec=20
UMask=0027
LimitNOFILE=65536
MemoryMax=4G
# sertleştirme
NoNewPrivileges=yes
ProtectSystem=strict
ReadWritePaths=$ODI_VERI
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectKernelLogs=yes
ProtectControlGroups=yes
ProtectClock=yes
ProtectHostname=yes
RestrictSUIDSGID=yes
RestrictRealtime=yes
RestrictNamespaces=yes
LockPersonality=yes
# AF_NETLINK: os.networkInterfaces() (sunucu açılışta yerel adresleri yazar) için gerekli
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX AF_NETLINK
CapabilityBoundingSet=
AmbientCapabilities=
SystemCallArchitectures=native

[Install]
WantedBy=multi-user.target
EOF
}

duckdns_unit() {
  cat <<EOF
# DuckDNS adres güncelleyici: tools/sunucu/kur.sh yazdı. Token dosyası root'a özel (0600); servis root olarak ama hiçbir
# yetki (capability) olmadan, salt okunur dosya sistemiyle çalışır: yalnız kendi dosyasını okuyup HTTPS isteği atabilir.
[Unit]
Description=ODİ DuckDNS adres güncelleyici
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=$ODI_LIB/duckdns-guncelle
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictNamespaces=yes
RestrictSUIDSGID=yes
LockPersonality=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
CapabilityBoundingSet=
AmbientCapabilities=
EOF
}

duckdns_timer() {
  cat <<'EOF'
# DuckDNS adresini 5 dakikada bir günceller: tools/sunucu/kur.sh yazdı
[Unit]
Description=ODİ DuckDNS adres güncelleyici (5 dakikada bir)

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
AccuracySec=30s

[Install]
WantedBy=timers.target
EOF
}

journald_ayari() {
  cat <<'EOF'
# ODİ: günlükler en çok 1 GB ve 30 gün tutulur (tools/sunucu/kur.sh)
[Journal]
SystemMaxUse=1G
MaxRetentionSec=30day
EOF
}

caddyfile() { # $1 = tam alan adı (ör. ad.duckdns.org)
  cat <<EOF
# ODİ: tools/sunucu/kur.sh yazdı; elle değiştirmeyin (yeniden yazmak için kur.sh'yi yeniden çalıştırın).
# Denetim: caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
{
	# sertifika yalnız Let's Encrypt'ten (kendiliğinden alınır ve yenilenir)
	cert_issuer acme
	servers {
		protocols h1 h2
	}
}

$1 {
	encode zstd gzip

	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}

	# Oyun sunucusu: WebSocket yükseltmesi (oyun kök adrese bağlanır: wss://$1) ve sağlık/ölçüm uçları.
	# Oyun sunucusu yalnız $ODI_HOST:$ODI_PORT'u dinler; dışarıdan yalnız buradan erişilir.
	@oyun {
		header Connection *Upgrade*
		header Upgrade websocket
	}
	handle @oyun {
		reverse_proxy $ODI_HOST:$ODI_PORT
	}
	handle /saglik {
		reverse_proxy $ODI_HOST:$ODI_PORT
	}
	handle /olcum {
		reverse_proxy $ODI_HOST:$ODI_PORT
	}
	# Çökme raporu (YN-011): yalnız /hata (POST; gövde en çok 8 KB, sunucu ayrıca sınırlar). Özet (/hata/ozet) dışarı açılmaz:
	# odi-durum onu sunucunun kendisinden okur. Erişim günlüğü (log) yok: IP yazılmaz.
	handle /hata {
		request_body {
			max_size 8KB
		}
		reverse_proxy $ODI_HOST:$ODI_PORT
	}
	# Beta geri bildirimi: yalnız /geri-bildirim (POST; gövde en çok 4 KB, sunucu ayrıca sınırlar: IP başına saatte 5, günde 20).
	# Sayı özeti (/geri-bildirim/ozet) dışarı açılmaz: odi-durum onu sunucunun kendisinden okur. Erişim günlüğü (log) yok: IP yazılmaz.
	handle /geri-bildirim {
		request_body {
			max_size 4KB
		}
		reverse_proxy $ODI_HOST:$ODI_PORT
	}

	# Web sürümü (apps/web derlemesi). Parmak izli dosyalar (/assets/*) bir yıl önbellekte kalır;
	# index.html, ses dosyaları ve diğerleri her açılışta doğrulanır (güncellemeden sonra hemen yenisi gelir).
	handle /assets/* {
		root * $ODI_GUNCEL/web
		@var file
		header @var Cache-Control "public, max-age=31536000, immutable"
		file_server
	}
	handle {
		root * $ODI_GUNCEL/web
		header Cache-Control "no-cache"
		# /gizlilik → gizlilik.html (yasal sayfalar, vite.config.ts odiYasalSayfalar); bilinmeyen yol → oyun
		try_files {path} {path}.html /index.html
		file_server
	}
}
EOF
}

# dosyayı yalnız içerik değiştiyse yazar; değiştiyse 0 döner
dosya_yaz() { # $1 yol, $2 izin, $3 sahip; içerik standart girdiden
  local yol=$1 izin=$2 sahip=$3 gecici
  gecici=$(mktemp)
  cat > "$gecici"
  if [ -f "$yol" ] && cmp -s "$gecici" "$yol"; then
    chmod "$izin" "$yol"; chown "$sahip" "$yol"; rm -f "$gecici"; return 1
  fi
  install -D -m "$izin" -o "${sahip%%:*}" -g "${sahip##*:}" "$gecici" "$yol"
  rm -f "$gecici"
  return 0
}
