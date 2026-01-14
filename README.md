# Yeni Kapadokya Turizm - EMITT 2026 Fuar Tanıtım Materyalleri

Bu proje, Yeni Kapadokya Turizm'in EMITT 2026 fuarı için hazırlanan tanıtım materyallerini (broşür, roll-up, kartvizit, sosyal medya görselleri) içerir. Tasarımlar HTML/CSS ile hazırlanmış olup, Puppeteer script'leri aracılığıyla yüksek kaliteli PDF ve PNG formatlarına dönüştürülmektedir.

## Proje İçeriği

- **Broşür:** A4 3 kırım (TR ve EN)
- **Roll-up:** 85x200cm (TR ve EN)
- **Kartvizit:** 85x55mm (TR ve EN)
- **Sosyal Medya:** Kapak ve Instagram kare görselleri

## Klasör Yapısı

- `src/`: HTML kaynak dosyaları (`brochure_en.html`, `turkce.html` vb.)
- `assets/`: 
  - `images/`: PNG/JPG görseller
  - `logos/`: SVG logolar
- `scripts/`: PDF ve görsel oluşturma script'leri (Node.js)
- `dist/`: Oluşturulan çıktı dosyaları (PDF, PNG)

## Kurulum

Projeyi çalıştırmadan önce bağımlılıkları yükleyin:

```bash
npm install
```

## Kullanım (PDF ve Görsel Üretimi)

Tüm çıktılar `dist/` klasörüne kaydedilir.

### 1. Roll-up (TR + EN)
```bash
npm run pdf
```
_Raster çıktı (gölgeler için daha güvenli) için:_ `npm run pdf -- --raster`

### 2. Broşür (TR + EN)
```bash
npm run pdf:brochure
```
_Raster çıktı için:_ `npm run pdf:brochure:raster`

### 3. Kartvizit (TR + EN)
```bash
npm run pdf:kartvizit
```
_Raster çıktı için:_ `npm run pdf:kartvizit:raster`

### 4. Sosyal Medya Görselleri
```bash
npm run render:kapak   # Kapak görseli (kapak.png)
npm run render:kare    # Instagram kare görseli (instagram-kare.png)
```

## Notlar
- **Raster vs Vektör:** macOS Preview gibi bazı görüntüleyicilerde vektör PDF'lerdeki gölgeler hatalı görünebilir. Bu durumda `--raster` komutlarını kullanarak piksellere dökülmüş (flattened) PDF üretebilirsiniz.
- Tasarım değişiklikleri için `src/` altındaki HTML dosyalarını düzenleyin.
