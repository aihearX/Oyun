#!/bin/bash
# Gizlilik denetimi (docs/yonetim/sunucu-dogrulama.md D15): kur.sh'nin deneme ve etkileşimsiz modları, verilen sahte
# yönetici kodunu ve DuckDNS token'ını hiçbir çıktıya yazmamalı.
#   bash tools/sunucu/test/gizlilik.sh                  deneme modu (root gerekmez, sisteme dokunmaz)
#   bash tools/sunucu/test/gizlilik.sh DOSYA…           ayrıca verilen dosyalarda da arar (ör. kurulum günlüğü, journalctl çıktısı)
# Ortam: ODI_GIZLI_KOD / ODI_GIZLI_TOKEN verilirse bu değerler aranır (gerçek kurulumu denetlemek için; değerler yazdırılmaz).
set -uo pipefail
burasi=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
kod=${ODI_GIZLI_KOD:-DENEME-KOD-ORNEK-$RANDOM-$RANDOM}
tok=${ODI_GIZLI_TOKEN:-0000aaaa-$RANDOM-4bbb-8ccc-dddd$RANDOM}
unset ODI_GIZLI_KOD ODI_GIZLI_TOKEN
hata=0
ara() { # $1 ad, $2 metin dosyası
  local ad=$1 f=$2 n
  for d in "$kod" "$tok" "${kod//-/}"; do
    if grep -qF -- "$d" "$f"; then echo "✗ $ad: gizli değer çıktıda görünüyor"; hata=1; return; fi
  done
  n=$(wc -l < "$f"); echo "✓ $ad: gizli değer yok ($n satır)"
}
cikti=$(mktemp); trap 'rm -f "$cikti"' EXIT

# 1) deneme modu, etkileşimsiz girdilerle
ODI_KUR_DUCK=ornek-ad ODI_KUR_TOKEN=$tok ODI_KUR_KOD=$kod bash "$burasi/kur.sh" --deneme > "$cikti" 2>&1
grep -q 'Deneme bitti' "$cikti" || { echo "✗ deneme modu bitmedi:"; tail -n 20 "$cikti"; hata=1; }
grep -q 'ODI_KUR_KOD ön denetimden geçti' "$cikti" || { echo "✗ deneme modu kodu denetlemedi"; hata=1; }
ara "kur.sh --deneme" "$cikti"

# 2) deneme modu: kod etkileşimsiz verilmiş ama çok kısa (hata iletisi kodu tekrar etmemeli)
ODI_KUR_DUCK=ornek-ad ODI_KUR_TOKEN=$tok ODI_KUR_KOD=KISA bash "$burasi/kur.sh" --deneme > "$cikti" 2>&1
if grep -qF 'KISA' "$cikti"; then echo "✗ kısa kod hata iletisinde görünüyor"; hata=1; else echo "✓ kısa kod iletiye yazılmadı"; fi

# 3) argümanlarda görünmeme: gizli değişken dış bir komutun argümanı olmamalı (printf/echo kabuk yerleşiğidir)
if grep -nE '(curl|node|awk|sed|logger|git|npm)[^|]*\$\{?(ODI__KOD|ODI__TOKEN|tok)\b' "$burasi"/kur.sh "$burasi"/ortak.sh "$burasi"/duckdns-guncelle "$burasi"/odi-* \
   | grep -vE 'printf' ; then echo "✗ gizli değişken bir komutun argümanında"; hata=1; else echo "✓ gizli değişkenler yalnız printf/stdin ile geçiyor"; fi
if grep -nE '^\s*set\s+-[a-z]*x' "$burasi"/kur.sh "$burasi"/ortak.sh "$burasi"/duckdns-guncelle "$burasi"/odi-*; then echo "✗ set -x var"; hata=1; else echo "✓ set -x yok"; fi

# 4) verilen ek dosyalar
for f in "$@"; do [ -r "$f" ] && ara "$f" "$f"; done
exit $hata
