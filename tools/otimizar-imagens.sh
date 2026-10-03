#!/usr/bin/env bash
# Converte as imagens originais em WebP responsivo (640/1024/1600/2400 px de largura).
#
# Uso (a partir da pasta yachthouse-lp/):
#   ./tools/otimizar-imagens.sh                 # lê de ../Assets
#   ./tools/otimizar-imagens.sh assets-originais
#
# Os originais NUNCA vão para assets/ (pasta publicada). Guarde-os em ../Assets
# ou em assets-originais/ (ignorada pelo git).
#
# Usa `cwebp` se estiver instalado (brew install webp); senão, usa sharp-cli via npx.
# Imagens menores que a largura-alvo não são ampliadas.
# Logo_HEAD.png é copiado como PNG otimizado (precisa de transparência nítida).

set -euo pipefail

ORIGEM="${1:-../Assets}"
DESTINO="assets"
LARGURAS=(640 1024 1600 2400)
QUALIDADE=78

[ -d "$ORIGEM" ] || { echo "Pasta de originais não encontrada: $ORIGEM"; exit 1; }
mkdir -p "$DESTINO"

slug() {
  # "Fachada Noturna 01.JPG" -> "fachada-noturna-01"
  local base="${1%.*}"
  echo "$base" | iconv -f utf-8 -t ascii//TRANSLIT 2>/dev/null \
    | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g'
}

largura_original() { sips -g pixelWidth "$1" 2>/dev/null | awk '/pixelWidth/ {print $2}'; }
altura_original()  { sips -g pixelHeight "$1" 2>/dev/null | awk '/pixelHeight/ {print $2}'; }

converter() { # $1 entrada  $2 largura  $3 saída
  if command -v cwebp >/dev/null 2>&1; then
    cwebp -quiet -q "$QUALIDADE" -resize "$2" 0 -metadata none "$1" -o "$3"
  else
    npx --yes sharp-cli@5 -i "$1" -o "$3" -f webp -q "$QUALIDADE" resize "$2" --withoutEnlargement >/dev/null
  fi
}

shopt -s nullglob nocaseglob
for arquivo in "$ORIGEM"/*.{jpg,jpeg,png,webp,tif,tiff,heic}; do
  nome="$(basename "$arquivo")"

  if [[ "$nome" == Logo_HEAD.* ]]; then
    cp "$arquivo" "$DESTINO/logo-mercatto.png"
    sips -Z 600 "$DESTINO/logo-mercatto.png" >/dev/null
    echo "logo      -> $DESTINO/logo-mercatto.png"
    continue
  fi

  s="$(slug "$nome")"
  w="$(largura_original "$arquivo")"; h="$(altura_original "$arquivo")"
  srcset=()
  for lw in "${LARGURAS[@]}"; do
    if [ "$lw" -gt "$w" ] && [ "${#srcset[@]}" -gt 0 ]; then break; fi
    alvo=$(( lw < w ? lw : w ))
    saida="$DESTINO/$s-$alvo.webp"
    converter "$arquivo" "$alvo" "$saida"
    srcset+=("$saida ${alvo}w")
    [ "$alvo" -eq "$w" ] && break
  done

  maior="${srcset[${#srcset[@]}-1]%% *}"
  maior_w="${srcset[${#srcset[@]}-1]##* }"; maior_w="${maior_w%w}"
  maior_h=$(( h * maior_w / w ))
  echo
  echo "$nome  (${w}x${h})"
  echo "  <img src=\"$maior\""
  echo "       srcset=\"$(IFS=,; echo "${srcset[*]}" | sed 's/,/, /g')\""
  echo "       sizes=\"(min-width: 900px) 50vw, 100vw\" width=\"$maior_w\" height=\"$maior_h\""
  echo "       alt=\"[descreva a imagem]\" loading=\"lazy\" decoding=\"async\">"
done

echo
echo "Pronto. Arquivos em $DESTINO/:"
ls -lh "$DESTINO" | awk 'NR>1 {print "  " $5 "  " $9}'
