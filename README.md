# Yeni Kapadokya Turizm - EMITT 2026 Fuar Tanıtım Materyalleri

Bu proje, Yeni Kapadokya Turizm'in EMITT 2026 fuarı için hazırlanan tanıtım materyallerini (broşür, roll-up, kartvizit, sosyal medya görselleri) içerir. Tasarımlar HTML/CSS ile hazırlanmış olup, Puppeteer script'leri aracılığıyla yüksek kaliteli PDF ve PNG formatlarına dönüştürülmektedir.

Proje boyunca yapay zeka araçlarından yoğun şekilde faydalanılmıştır; bu sayede sıfır HTML/CSS bilgisinden tasarım üretimi ve hızlı iterasyon mümkün olmuştur. Buna rağmen bazı kısımlarda hatalar veya gereğinden kompleks çözümler bulunabilir—geri bildirim ve iyileştirmelere açıktır.

## Proje İçeriği

- **Broşür:** A4 3 kırım (TR ve EN)
- **Roll-up:** 85x200cm (TR ve EN)
- **Kartvizit:** 85x55mm (TR ve EN)
- **Sosyal Medya:** Kapak ve Instagram kare görselleri

## Klasör Yapısı
- `src/`: HTML kaynak dosyaları (`brochure_tr.html`, `brochure_en.html`, `rollup_tr.html`, `rollup_en.html`, `businesscard_tr.html`, `businesscard_en.html` vb.)
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
_İsterseniz aynı işlemleri `npm run` üzerinden de çalıştırabilirsiniz (ör. `npm run pdf:rollup`, `npm run pdf:brochure`, `npm run pdf:businesscard`)._

### 1. Roll-up (TR + EN)
```bash
node scripts/pdf-rollup.js
```
_Raster çıktı (gölgeler için daha güvenli) için:_ `node scripts/pdf-rollup.js --raster`

### 2. Broşür (TR + EN)
```bash
node scripts/pdf-brochure.js
```
_Raster çıktı için:_ `node scripts/pdf-brochure.js --raster`

### 3. Kartvizit (TR + EN)
```bash
node scripts/pdf-businesscard.js
```
Not: Kartvizitte `.logo-wrap img` için **SVG** veya **PDF** kaynak kullanabilirsiniz. Eğer `.pdf` verilirse, script logoyu PDF’e “stamp” ederek ekler (Chrome’un `<img src="...pdf">` render edememesi sorunu için).

### 4. Sosyal Medya Görselleri
```bash
node scripts/render-kapak.js   # Kapak görseli (kapak.png)
node scripts/render-kare.js    # Instagram kare görseli (instagram-kare.png)
```

## Notlar
- **Raster vs Vektör:** macOS Preview gibi bazı görüntüleyicilerde vektör PDF'lerdeki gölgeler hatalı görünebilir. Bu durumda `--raster` komutlarını kullanarak piksellere dökülmüş (flattened) PDF üretebilirsiniz.
- Tasarım değişiklikleri için `src/` altındaki HTML dosyalarını düzenleyin.