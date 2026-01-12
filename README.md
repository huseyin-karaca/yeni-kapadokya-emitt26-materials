# HTML → PDF (Roll-up) Dönüştürme

Bu klasördeki `turkce.html` ve `ingilizce.html` dosyalarını, tasarımı bozmadan (arka planlar dahil) PDF’e dönüştürmek için `pdf.js` kullanılır.

## Gereksinimler

- Node.js **18+**

## Kurulum

Eğer `node_modules/` klasörü yoksa:

```bash
cd "/Users/huseyinkaraca/Desktop/fuar2026-gemini/final-tasarım"
npm install
```

## PDF üretimi

```bash
cd "/Users/huseyinkaraca/Desktop/fuar2026-gemini/final-tasarım"
node pdf.js
```

Üretilen dosyalar:

- `turkce.pdf`
- `ingilizce.pdf`

## macOS Preview farkı (gölge/efekt)

macOS Preview bazen vektör PDF’lerde (özellikle yarı saydam gölgelerde) Chrome’dan farklı render edebilir. Bu durumda PDF’i **flatten (raster)** üretmek en garanti çözümdür:

```bash
cd "/Users/huseyinkaraca/Desktop/fuar2026-gemini/final-tasarım"
node pdf.js --raster
```

Üretilen dosyalar:

- `turkce-raster.pdf`
- `ingilizce-raster.pdf`

## Notlar

- `node_modules/` **kodun çalışması için gereklidir**, fakat repoda tutmak zorunda değilsiniz; silerseniz tekrar `npm install` ile kurulabilir.
- PDF sayfa boyutu `pdf.js` içinde **850×2000px** olarak ayarlanmıştır (tek sayfa).


