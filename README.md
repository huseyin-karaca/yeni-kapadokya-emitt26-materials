# HTML → PDF Dönüştürme (Broşür + Kartvizit + Roll-up)

Bu klasördeki HTML dosyalarını, tasarımı bozmadan (arka planlar dahil) PDF’e dönüştürmek için Puppeteer tabanlı script’ler kullanılır.

## Gereksinimler

- Node.js **18+**

## Kurulum

Eğer `node_modules/` klasörü yoksa:

```bash
cd "/Users/huseyinkaraca/Desktop/fuar2026-gemini/final-tasarım"
npm install
```

## PDF üretimi

### Roll-up (mevcut)

```bash
cd "/Users/huseyinkaraca/Desktop/fuar2026-gemini/final-tasarım"
npm run pdf
```

Üretilen dosyalar:

- `turkce.pdf`
- `ingilizce.pdf`

### Kartvizit

Vektör (metin/vektör korunur):

```bash
cd "/Users/huseyinkaraca/Desktop/fuar2026-gemini/final-tasarım"
npm run pdf:kartvizit
```

Raster / flattened (Preview-safe):

```bash
cd "/Users/huseyinkaraca/Desktop/fuar2026-gemini/final-tasarım"
npm run pdf:kartvizit:raster
```

Üretilen dosyalar:

- `kartvizit.pdf`
- `kartvizit-raster.pdf`

### Broşür

Vektör (TR + EN):

```bash
cd "/Users/huseyinkaraca/Desktop/fuar2026-gemini/final-tasarım"
npm run pdf:brochure
```

Raster / flattened (TR + EN):

```bash
cd "/Users/huseyinkaraca/Desktop/fuar2026-gemini/final-tasarım"
npm run pdf:brochure:raster
```

Üretilen dosyalar:

- `brochure_tr.pdf`, `brochure_tr-raster.pdf`
- `brochure_en.pdf`, `brochure_en-raster.pdf`

## macOS Preview farkı (gölge/efekt)

macOS Preview bazen vektör PDF’lerde (özellikle yarı saydam gölgelerde) Chrome’dan farklı render edebilir. Bu durumda PDF’i **flatten (raster)** üretmek en garanti çözümdür:

```bash
cd "/Users/huseyinkaraca/Desktop/fuar2026-gemini/final-tasarım"
npm run pdf -- --raster
```

Üretilen dosyalar:

- `turkce-raster.pdf`
- `ingilizce-raster.pdf`

## Notlar

- `node_modules/` **kodun çalışması için gereklidir**, fakat repoda tutmak zorunda değilsiniz; silerseniz tekrar `npm install` ile kurulabilir.
- PDF sayfa boyutu `pdf.js` içinde **850×2000px** olarak ayarlanmıştır (tek sayfa).


 