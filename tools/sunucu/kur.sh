#!/bin/bash
# ODİ sosyal sunucusu kurulumu: Oracle Cloud Always Free (Ubuntu 24.04, ARM) + DuckDNS + Caddy (HTTPS).
# Rehber: docs/18-sunucu-kurulum.md
#
#   git clone https://github.com/aihearX/Oyun.git && sudo bash Oyun/tools/sunucu/kur.sh
#
# Yeniden çalıştırmak güvenlidir: her adım yapılmışsa atlanır, ayar dosyaları yeniden yazılır, kayıtlı cevaplar korunur.
#
# Seçenekler:
#   --deneme        Sisteme dokunmadan planı ve yazılacak dosyaları gösterir (root gerekmez).
#   --yeniden-sor   Kayıtlı DuckDNS adı/token'ı yerine yeniden sorar.
#   --yardim        Bu açıklama.
# Etkileşimsiz kullanım (test için): ODI_KUR_DUCK=ad ODI_KUR_TOKEN=… ODI_KUR_KOD=… sudo -E bash kur.sh
#   ODI_KUR_KAYNAK  derlenecek depo (varsayılan: bu klonun origin adresi), ODI_KUR_DAL (varsayılan: main)
#   ODI_KUR_ATLA    yalnız test ortamı: virgüllü adım listesi (sistem, duckdns, guvenlik-duvari, https)
#
# Gizlilik: yönetici kodu ve token yalnız gizli girişle alınır, ekrana/günlüğe/komut argümanlarına yazılmaz;
# kodun yalnız tuzlu özeti /etc/odi/odi.env'e (0600 root:root) yazılır. Bu betikte `set -x` kullanılmaz.
set -euo pipefail

BURASI=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=tools/sunucu/ortak.sh
. "$BURASI/ortak.sh"

DENEME=0; YENIDEN_SOR=0
for a in "$@"; do
  case $a in
    --deneme) DENEME=1 ;;
    --yeniden-sor) YENIDEN_SOR=1 ;;
    -h|--yardim|--help) sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) olum "Bilinmeyen seçenek: $a (yardım: --yardim)" ;;
  esac
done

atla() { case ",${ODI_KUR_ATLA:-}," in *",$1,"*) return 0 ;; esac; return 1; }

# Etkileşimsiz girdiler kabuk değişkenine alınır ve ortamdan hemen silinir (alt süreçlere geçmez)
ODI__DUCK=${ODI_KUR_DUCK:-}; ODI__TOKEN=${ODI_KUR_TOKEN:-}; ODI__KOD=${ODI_KUR_KOD:-}
unset ODI_KUR_DUCK ODI_KUR_TOKEN ODI_KUR_KOD
ODI__OZET=
ODI__IP=
DAL=${ODI_KUR_DAL:-$(conf_oku ODI_DAL)}; DAL=${DAL:-main}
KAYNAK_URL=${ODI_KUR_KAYNAK:-$(conf_oku ODI_KAYNAK_URL)}
if [ -z "$KAYNAK_URL" ]; then
  KAYNAK_URL=$(git -C "$BURASI" remote get-url origin 2>/dev/null || true)
  KAYNAK_URL=${KAYNAK_URL:-https://github.com/aihearX/Oyun.git}
fi

GUNLUK=/var/log/odi-kur.log

# ================================================================ sorular
duck_sor() {
  local k
  [ -t 0 ] || olum "DuckDNS adı sorulamıyor (terminal yok). Etkileşimsiz kullanımda ODI_KUR_DUCK verin."
  printf 'DuckDNS adı (yalnız ad, .duckdns.org olmadan; ör. ornek-ad): ' >&2
  IFS= read -r k
  ODI__DUCK=$k
}
duck_denetle() {
  local k=${ODI__DUCK,,}
  k=${k#https://}; k=${k#http://}; k=${k#wss://}; k=${k%%/*}; k=${k%.duckdns.org}
  ODI__DUCK=$k
  [[ $k =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]]
}
token_sor() {
  [ -t 0 ] || olum "DuckDNS token'ı sorulamıyor (terminal yok). Etkileşimsiz kullanımda ODI_KUR_TOKEN verin."
  printf "DuckDNS token'ı (duckdns.org sayfasının üstünde; ekranda görünmez): " >&2
  IFS= read -r -s ODI__TOKEN; printf '\n' >&2
}
token_denetle() { [[ $ODI__TOKEN =~ ^[A-Za-z0-9-]{16,64}$ ]]; }

sorular() {
  baslik "Sorular"
  local kayitli_duck
  kayitli_duck=$(conf_oku ODI_DUCK)
  if [ -z "$ODI__DUCK" ] && [ -n "$kayitli_duck" ] && [ $YENIDEN_SOR -eq 0 ]; then ODI__DUCK=$kayitli_duck; fi
  [ -n "$ODI__DUCK" ] || duck_sor
  until duck_denetle; do
    hata "DuckDNS adı yalnız küçük harf, rakam ve tire içerebilir (ör. ornek-ad)."
    duck_sor
  done
  tamam "Adres: $ODI__DUCK.duckdns.org"

  if [ -z "$ODI__TOKEN" ] && [ -s "$ODI_TOKEN_DOSYA" ] && [ $YENIDEN_SOR -eq 0 ]; then
    tamam "DuckDNS token'ı kayıtlı ($ODI_TOKEN_DOSYA); değiştirmek için: --yeniden-sor"
  else
    [ -n "$ODI__TOKEN" ] || token_sor
    until token_denetle; do
      hata "Token biçimi tanınmadı (duckdns.org sayfasındaki 'token' değerini kopyalayın)."
      [ -t 0 ] || exit 1
      token_sor
    done
    tamam "DuckDNS token'ı alındı."
  fi

  if [ -z "$ODI__KOD" ] && [ -n "$(env_oku ODI_ADMIN_CODE_HASH)" ]; then
    tamam "Yönetici kodu zaten ayarlı; korunuyor (değiştirmek için: sudo odi-kod-degistir)."
  else
    if [ -n "$ODI__KOD" ]; then
      local neden
      neden=$(kod_on_denetim "$ODI__KOD") || olum "ODI_KUR_KOD uygun değil: $neden."
    else
      kod_sor
    fi
    tamam "Yönetici kodu alındı (yalnız tuzlu özeti saklanacak)."
  fi
}

# ================================================================ adımlar
adim_duckdns() {
  baslik "1/10 DuckDNS adresi"
  install -d -m 0755 "$ODI_ETC" "$ODI_LIB"
  anahtar_ayarla "$ODI_CONF" ODI_DUCK "$ODI__DUCK"
  anahtar_ayarla "$ODI_CONF" ODI_DAL "$DAL"
  anahtar_ayarla "$ODI_CONF" ODI_KAYNAK_URL "$KAYNAK_URL"
  chmod 0644 "$ODI_CONF"
  if [ -n "$ODI__TOKEN" ]; then
    ( umask 077; printf '%s\n' "$ODI__TOKEN" > "$ODI_TOKEN_DOSYA.yeni" )
    chown root:root "$ODI_TOKEN_DOSYA.yeni"; chmod 0600 "$ODI_TOKEN_DOSYA.yeni"
    mv -f "$ODI_TOKEN_DOSYA.yeni" "$ODI_TOKEN_DOSYA"
    ODI__TOKEN=
  fi
  install -m 0755 "$BURASI/duckdns-guncelle" "$ODI_LIB/duckdns-guncelle"
  if atla duckdns; then uyari "DuckDNS güncellemesi atlandı (ODI_KUR_ATLA)."; return; fi
  local y
  if y=$("$ODI_LIB/duckdns-guncelle" 2>&1); then
    ODI__IP=$(printf '%s' "$y" | awk '{print $2}')
    tamam "DuckDNS: $ODI__DUCK.duckdns.org → $ODI__IP"
  else
    hata "$y"
    olum "DuckDNS güncellenemedi. duckdns.org'da adın ($ODI__DUCK) sizin hesabınızda olduğunu ve token'ı kontrol edip yeniden çalıştırın: sudo bash $0 --yeniden-sor"
  fi
}

adim_sistem() {
  baslik "2/10 Sistem güncellemesi"
  export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a
  local apt_sec=(-y -q -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)
  echo 'iptables-persistent iptables-persistent/autosave_v4 boolean false' | debconf-set-selections
  echo 'iptables-persistent iptables-persistent/autosave_v6 boolean false' | debconf-set-selections
  if atla sistem; then
    uyari "apt upgrade atlandı (ODI_KUR_ATLA)."
    apt-get update -q
  else
    apt-get update -q
    apt-get "${apt_sec[@]}" upgrade
  fi
  apt-get "${apt_sec[@]}" install git curl ca-certificates gnupg openssl unattended-upgrades iptables-persistent netfilter-persistent
  dosya_yaz /etc/apt/apt.conf.d/20auto-upgrades 0644 root:root <<'EOF' || true
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
  tamam "Sistem güncel; güvenlik güncellemeleri otomatik (unattended-upgrades)."
  if [ -f /var/run/reboot-required ]; then uyari "Çekirdek güncellendi: kurulum bitince bir kez 'sudo reboot' önerilir."; fi
}

adim_node() {
  baslik "3/10 Node.js 22 LTS"
  if node_uygun; then tamam "Node $(node -v) kurulu."; return; fi
  bilgi "NodeSource deposundan Node 22 kuruluyor…"
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  dosya_yaz /etc/apt/sources.list.d/nodesource.list 0644 root:root <<'EOF' || true
deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main
EOF
  dosya_yaz /etc/apt/preferences.d/nodesource 0644 root:root <<'EOF' || true
Package: nodejs
Pin: origin deb.nodesource.com
Pin-Priority: 600
EOF
  apt-get update -q
  apt-get install -y -q nodejs
  node_uygun || olum "Node $(node -v 2>/dev/null || echo yok) kuruldu ama en az $ODI_NODE_EN_AZ gerekiyor."
  tamam "Node $(node -v) ($(uname -m))."
}

adim_kullanici() {
  baslik "4/10 Kullanıcı ve klasörler"
  if ! id -u "$ODI_KULLANICI" >/dev/null 2>&1; then
    useradd --system --user-group --home-dir "$ODI_EV" --no-create-home --shell /usr/sbin/nologin "$ODI_KULLANICI"
    tamam "Sistem kullanıcısı '$ODI_KULLANICI' oluşturuldu."
  else
    tamam "Sistem kullanıcısı '$ODI_KULLANICI' var."
  fi
  install -d -m 0755 -o root -g root "$ODI_KOK" "$ODI_SURUMLER"
  install -d -m 0750 -o "$ODI_KULLANICI" -g "$ODI_KULLANICI" "$ODI_EV"
  install -d -m 0750 -o "$ODI_KULLANICI" -g "$ODI_KULLANICI" "$ODI_VERI" "$ODI_YEDEK"
}

adim_derleme() {
  baslik "5/10 Oyunu derleme"
  if [ ! -d "$ODI_KAYNAK/.git" ]; then
    install -d -m 0755 -o "$ODI_KULLANICI" -g "$ODI_KULLANICI" "$ODI_KAYNAK"
    odi_olarak git clone --quiet --depth 50 --branch "$DAL" "$KAYNAK_URL" "$ODI_KAYNAK" \
      || olum "Depo alınamadı: $KAYNAK_URL ($DAL)"
  else
    odi_olarak git -C "$ODI_KAYNAK" remote set-url origin "$KAYNAK_URL"
  fi
  local sha
  sha=$(kaynak_guncelle "$DAL") || olum "Depo güncellenemedi ($KAYNAK_URL, $DAL)."
  bilgi "Sürüm: ${sha:0:8} ($DAL)"
  local guncel_sha=
  [ -r "$ODI_GUNCEL/SURUM" ] && guncel_sha=$(sed -n 's/^commit=//p' "$ODI_GUNCEL/SURUM")
  if [ "$guncel_sha" = "$sha" ] && [ -s "$ODI_GUNCEL/sunucu/server.mjs" ]; then
    tamam "Bu sürüm zaten kurulu: $(surum_bilgisi "$ODI_GUNCEL")"
    return
  fi
  bagimlilik_kur || olum "Bağımlılıklar kurulamadı (npm ci)."
  derle || olum "Derleme başarısız."
  surum_hazirla "$sha" "$DAL"
  duman_testi "$ODI__YENI_SURUM" || { rm -rf "$ODI__YENI_SURUM"; olum "Yeni sürüm açılış denetiminden geçmedi."; }
  surume_gec "$ODI__YENI_SURUM"
  eski_surumleri_sil
  tamam "Kuruldu: $(surum_bilgisi "$ODI_GUNCEL")"
}

adim_ayarlar() {
  baslik "6/10 Ayarlar ve yönetici kodu"
  if [ -n "$ODI__KOD" ]; then
    until kod_ozetle "$ODI_GUNCEL/sunucu/kod.mjs"; do
      ODI__KOD=
      [ -t 0 ] || olum "ODI_KUR_KOD oyunun kabul ettiği biçimde değil."
      kod_sor
    done
    ODI__KOD=
  fi
  local ozet=${ODI__OZET:-$(env_oku ODI_ADMIN_CODE_HASH)}
  ODI__OZET=
  local eski_izin=
  if [ -f "$ODI_ENV" ]; then eski_izin=$(stat -c '%a %U:%G' "$ODI_ENV")
  else ( umask 077; env_icerigi - | grep '^#' > "$ODI_ENV" ); fi
  # yönetilen anahtarlar yeniden yazılır, elle eklenenler (REVENUECAT_API_KEY gibi) korunur
  local satir anahtar
  while IFS= read -r satir; do
    case $satir in ''|'#'*) continue ;; esac
    anahtar=${satir%%=*}
    if [ "$anahtar" = ODI_ADMIN_CODE_HASH ]; then
      [ -n "$ozet" ] && anahtar_ayarla "$ODI_ENV" "$anahtar" "$ozet"
    else
      anahtar_ayarla "$ODI_ENV" "$anahtar" "${satir#*=}"
    fi
  done < <(env_icerigi "-")
  ozet=
  chown root:root "$ODI_ENV"; chmod 0600 "$ODI_ENV"
  chmod 0755 "$ODI_ETC"
  [ -n "$eski_izin" ] && [ "$eski_izin" != "600 root:root" ] && bilgi "$ODI_ENV izni $eski_izin → 600 root:root"
  if [ -n "$(env_oku ODI_ADMIN_CODE_HASH)" ]; then tamam "$ODI_ENV yazıldı (0600 root:root; yönetici kodunun yalnız özeti)."
  else uyari "Yönetici kodu ayarlı değil: yönetici modu kapalı. Açmak için: sudo odi-kod-degistir"; fi
}

adim_servis() {
  baslik "7/10 Oyun servisi (systemd)"
  local degisti=0
  odi_unit "$(command -v node)" | dosya_yaz /etc/systemd/system/odi.service 0644 root:root && degisti=1
  journald_ayari | dosya_yaz /etc/systemd/journald.conf.d/odi.conf 0644 root:root && systemctl restart systemd-journald || true
  systemctl daemon-reload
  systemctl enable --quiet odi.service
  systemctl restart odi.service
  [ $degisti -eq 1 ] && bilgi "odi.service yazıldı."
  if saglik_bekle 60; then tamam "Oyun sunucusu çalışıyor: http://$ODI_HOST:$ODI_PORT/saglik (yalnız makinenin içinden)."
  else journalctl -u odi -n 30 --no-pager >&2 || true; olum "Oyun sunucusu açılmadı (yukarıdaki günlüğe bakın)."; fi
}

guvenlik_kurali() { # $1 port
  iptables -C INPUT -p tcp -m state --state NEW -m tcp --dport "$1" -j ACCEPT 2>/dev/null && return 1
  local sira
  sira=$(iptables -L INPUT --line-numbers -n | awk '$2 == "REJECT" || $2 == "DROP" {print $1; exit}')
  if [ -n "$sira" ]; then iptables -I INPUT "$sira" -p tcp -m state --state NEW -m tcp --dport "$1" -j ACCEPT
  else iptables -A INPUT -p tcp -m state --state NEW -m tcp --dport "$1" -j ACCEPT; fi
  return 0
}

adim_guvenlik_duvari() {
  baslik "8/10 Güvenlik duvarı (80, 443)"
  if atla guvenlik-duvari; then uyari "Güvenlik duvarı adımı atlandı (ODI_KUR_ATLA)."; return; fi
  # Oracle'ın Ubuntu görüntüsü /etc/iptables/rules.v4 ile 22 dışındaki her şeyi REJECT eder.
  # Yalnız 80 ve 443 için ACCEPT kuralı REJECT'in önüne eklenir; mevcut kurallar (SSH 22) olduğu gibi kalır.
  local p eklendi=0
  for p in 80 443; do guvenlik_kurali "$p" && eklendi=1; done
  if [ $eklendi -eq 1 ]; then netfilter-persistent save >/dev/null 2>&1 || iptables-save > /etc/iptables/rules.v4
    tamam "80 ve 443 açıldı, kalıcı kaydedildi (/etc/iptables/rules.v4)."
  else tamam "80 ve 443 zaten açık."; fi
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q 'Status: active'; then
    ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
    tamam "ufw: 22, 80, 443 izinli."
  fi
  iptables -C INPUT -p tcp -m state --state NEW -m tcp --dport 22 -j ACCEPT 2>/dev/null \
    || iptables -S INPUT | grep -q -- '--dport 22' || uyari "INPUT zincirinde 22 (SSH) için açık kural görünmüyor; mevcut ayara dokunulmadı."
}

adim_caddy() {
  baslik "9/10 Caddy (HTTPS ve web sürümü)"
  if ! command -v caddy >/dev/null 2>&1; then
    bilgi "Caddy resmi deposundan kuruluyor…"
    curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    dosya_yaz /etc/apt/sources.list.d/caddy-stable.list 0644 root:root <<'EOF' || true
deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main
EOF
    apt-get update -q
    apt-get install -y -q caddy
  fi
  local gecici
  gecici=$(mktemp)
  caddyfile "$ODI__DUCK.duckdns.org" > "$gecici"
  caddy validate --config "$gecici" --adapter caddyfile >/dev/null 2>&1 || { caddy validate --config "$gecici" --adapter caddyfile || true; rm -f "$gecici"; olum "Caddyfile doğrulanamadı."; }
  if dosya_yaz /etc/caddy/Caddyfile 0644 root:root < "$gecici"; then bilgi "Caddyfile yazıldı."; fi
  rm -f "$gecici"
  systemctl enable --quiet caddy
  if systemctl is-active --quiet caddy; then systemctl reload caddy || systemctl restart caddy; else systemctl restart caddy; fi
  tamam "Caddy: https://$ODI__DUCK.duckdns.org → web sürümü + wss:// (oyun sunucusu)."
}

adim_son() {
  baslik "10/10 Zamanlayıcı ve yardımcı komutlar"
  duckdns_unit | dosya_yaz /etc/systemd/system/odi-duckdns.service 0644 root:root || true
  duckdns_timer | dosya_yaz /etc/systemd/system/odi-duckdns.timer 0644 root:root || true
  systemctl daemon-reload
  systemctl enable --quiet --now odi-duckdns.timer
  tamam "DuckDNS 5 dakikada bir güncellenecek (odi-duckdns.timer)."
  install -m 0644 "$BURASI/ortak.sh" "$ODI_LIB/ortak.sh"
  local k
  for k in odi-guncelle odi-durum odi-kod-degistir odi-yedek-geri; do install -m 0755 "$BURASI/$k" "$ODI_BIN/$k"; done
  tamam "Komutlar: sudo odi-guncelle · sudo odi-durum · sudo odi-kod-degistir · sudo odi-yedek-geri"
}

teshis() {
  local alan=$1 dns
  hata "https://$alan/saglik yanıt vermedi. Olası nedenler:"
  if ! saglik_bekle 2; then echo "  • Oyun sunucusu çalışmıyor: sudo journalctl -u odi -n 50" >&2; fi
  if ! systemctl is-active --quiet caddy; then echo "  • Caddy çalışmıyor: sudo journalctl -u caddy -n 50" >&2; fi
  dns=$(getent ahostsv4 "$alan" 2>/dev/null | awk 'NR==1{print $1}')
  if [ -z "$dns" ]; then
    echo "  • $alan çözülemiyor: duckdns.org'da adın kayıtlı olduğunu kontrol edin." >&2
  elif [ -n "$ODI__IP" ] && [ "$dns" != "$ODI__IP" ]; then
    echo "  • DNS bu sunucuyu göstermiyor ($alan → $dns, bu sunucu → $ODI__IP). Birkaç dakika bekleyin ya da duckdns.org'da 'current ip'yi düzeltin." >&2
  fi
  local g
  g=$(journalctl -u caddy --since "-15min" --no-pager 2>/dev/null || true)
  if grep -qiE 'timeout during connect|connection refused|likely firewall|no route to host|i/o timeout' <<< "$g"; then
    echo "  • Let's Encrypt sunucuya dışarıdan ulaşamadı: Oracle konsolunda Security List'e 80 ve 443 (TCP, 0.0.0.0/0) giriş kuralı ekleyin (Adım 3)." >&2
  fi
  if grep -qiE 'NXDOMAIN|no valid A records|DNS problem' <<< "$g"; then
    echo "  • Let's Encrypt adı çözemedi: DuckDNS adının doğru IP'yi gösterdiğini kontrol edin." >&2
  fi
  if grep -qiE 'rateLimited|too many (certificates|failed)' <<< "$g"; then
    echo "  • Let's Encrypt deneme sınırına takıldı: bir saat bekleyip yeniden deneyin." >&2
  fi
  echo "  • Oracle Security List'te 80/443 açık değilse sertifika alınamaz (en sık neden)." >&2
  echo "Düzeltince yeniden çalıştırın: sudo bash $0   ·   Durum: sudo odi-durum" >&2
}

adim_denetim() {
  baslik "Son denetim"
  local alan=$ODI__DUCK.duckdns.org url i=0
  url="https://$alan/saglik"
  if atla https; then
    uyari "Dış HTTPS denetimi atlandı (ODI_KUR_ATLA); yerel sağlık: $(curl -fsS --max-time 3 "http://$ODI_HOST:$ODI_PORT/saglik" || echo yok)"
    return 0
  fi
  bilgi "Sertifika ve adres bekleniyor (en çok 4 dakika)…"
  # Makinenin kendi genel IP'sine içeriden ulaşmak her ağda çalışmaz: adres 127.0.0.1'e yönlendirilerek Caddy'nin
  # gerçek (Let's Encrypt) sertifikası doğrulanır. Sertifikanın alınmış olması dışarıdan 80/443'e ulaşıldığını gösterir.
  while [ $i -lt 48 ]; do
    if curl -fsS --max-time 5 --resolve "$alan:443:127.0.0.1" "$url" 2>/dev/null | grep -q '"ok":true'; then
      echo
      tamam "Sağlık denetimi geçti ($url)."
      printf '\n%sHazır: wss://%s%s\n' "$_Y" "$alan" "$_R"
      printf 'Web sürümü: https://%s\n' "$alan"
      printf 'Durum: sudo odi-durum   Güncelleme: sudo odi-guncelle\n'
      return 0
    fi
    sleep 5; i=$((i + 1))
  done
  teshis "$alan"
  return 2
}

# ================================================================ deneme modu
deneme() {
  [ -n "$ODI__DUCK" ] || ODI__DUCK=ornek-ad
  duck_denetle || olum "DuckDNS adı uygun değil."
  local alan=$ODI__DUCK.duckdns.org
  cat <<EOF
DENEME MODU: sisteme dokunulmaz, hiçbir şey kurulmaz ya da yazılmaz.

Kaynak: $KAYNAK_URL ($DAL)
Adres:  https://$alan  ·  wss://$alan

Adımlar:
  Sorular  DuckDNS adı, DuckDNS token'ı (gizli), yönetici kodu (gizli, iki kez, $ODI_KOD_EN_AZ–$ODI_KOD_EN_COK karakter)
  1  DuckDNS: $ODI_CONF, $ODI_TOKEN_DOSYA (0600 root), $ODI_LIB/duckdns-guncelle; adres bu sunucunun IP'sine güncellenir
  2  apt update + upgrade; git curl gnupg openssl unattended-upgrades iptables-persistent; otomatik güvenlik güncellemeleri
  3  Node.js 22 LTS (NodeSource, $(uname -m)); en az $ODI_NODE_EN_AZ
  4  sistem kullanıcısı '$ODI_KULLANICI'; $ODI_KOK, $ODI_VERI (0750 odi), $ODI_YEDEK
  5  $ODI_KAYNAK ← git clone; npm ci (yalnız sunucu + web, betikler kapalı); build:server + build:web;
     $ODI_SURUMLER/<tarih>-<commit>/{sunucu,web}; açılış denetimi (geçici örnek, ayrı port); $ODI_GUNCEL → yeni sürüm
  6  $ODI_ENV (0600 root:root): ayarlar + yönetici kodunun tuzlu özeti (kod.mjs ozet, kod standart girdiden)
  7  /etc/systemd/system/odi.service (User=odi, Restart=always, sertleştirilmiş); journald 1 GB / 30 gün
  8  iptables: 80 ve 443 ACCEPT (REJECT kuralının önüne), netfilter-persistent save; 22 (SSH) olduğu gibi kalır
  9  Caddy (resmi apt deposu); /etc/caddy/Caddyfile; Let's Encrypt sertifikası
  10 odi-duckdns.timer (5 dk); $ODI_BIN/{odi-guncelle,odi-durum,odi-kod-degistir,odi-yedek-geri}
  Son https://$alan/saglik 200 bekler, sonra "Hazır: wss://$alan" yazar

Yazılacak dosyalar:
EOF
  printf '\n----- %s (0600 root:root) -----\n' "$ODI_ENV"
  env_icerigi "<kurulumda üretilecek tuzlu özet>"
  printf '\n----- %s (0644 root:root) -----\n' "$ODI_CONF"
  printf 'ODI_DUCK=%s\nODI_DAL=%s\nODI_KAYNAK_URL=%s\n' "$ODI__DUCK" "$DAL" "$KAYNAK_URL"
  printf '\n----- %s (0600 root:root) -----\n(DuckDNS token; gösterilmez)\n' "$ODI_TOKEN_DOSYA"
  printf '\n----- /etc/systemd/system/odi.service -----\n'; odi_unit /usr/bin/node
  printf '\n----- /etc/systemd/system/odi-duckdns.service -----\n'; duckdns_unit
  printf '\n----- /etc/systemd/system/odi-duckdns.timer -----\n'; duckdns_timer
  printf '\n----- /etc/systemd/journald.conf.d/odi.conf -----\n'; journald_ayari
  printf '\n----- /etc/caddy/Caddyfile -----\n'; caddyfile "$alan"
  printf '\n----- /etc/apt/apt.conf.d/20auto-upgrades -----\nAPT::Periodic::Update-Package-Lists "1";\nAPT::Periodic::Unattended-Upgrade "1";\n'
  if [ -n "$ODI__TOKEN" ]; then token_denetle && echo "(ODI_KUR_TOKEN biçimi uygun)" || echo "(ODI_KUR_TOKEN biçimi uygun DEĞİL)"; fi
  if [ -n "$ODI__KOD" ]; then
    local neden
    if neden=$(kod_on_denetim "$ODI__KOD"); then echo "(ODI_KUR_KOD ön denetimden geçti)"; else echo "(ODI_KUR_KOD uygun DEĞİL: $neden)"; fi
  fi
  ODI__TOKEN=; ODI__KOD=
  printf '\nDeneme bitti; hiçbir şey değişmedi.\n'
}

# ================================================================ ana akış
if [ $DENEME -eq 1 ]; then deneme; exit 0; fi

root_gerek "bash $0"
if [ -r /etc/os-release ]; then
  # shellcheck source=/dev/null
  . /etc/os-release
  [ "${ID:-}" = ubuntu ] || uyari "Bu betik Ubuntu 24.04 için yazıldı (bulunan: ${PRETTY_NAME:-?})."
fi
command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ] || olum "systemd bulunamadı; bu betik systemd'li bir Ubuntu sunucusu ister."

touch "$GUNLUK"; chown root:root "$GUNLUK"; chmod 0600 "$GUNLUK"
printf '%s ODİ kurulum (%s)\n' "$(date -Is)" "$(uname -m)" >> "$GUNLUK"

sorular
# sorulardan sonraki her şey günlüğe de yazılır (gizli değerler hiçbir zaman ekrana yazılmadığı için günlükte de yoktur)
exec > >(tee -a "$GUNLUK") 2>&1

adim_duckdns
adim_sistem
adim_node
adim_kullanici
adim_derleme
adim_ayarlar
adim_servis
adim_guvenlik_duvari
adim_caddy
adim_son
adim_denetim
