# DESIGN_REFERENCE.md

## Document Verification Platform

**Versi:** 0.1\
**Status:** Arah visual dipilih --- referensi dan prinsip desain\
**Arah utama:** Enterprise Trust × Premium Technology\
**Tema:** Light Mode + Dark Mode

------------------------------------------------------------------------

## 1. Design Intent

Produk harus terasa seperti platform dokumen profesional yang dapat
dipercaya, bukan dashboard SaaS generik.

Karakter yang ingin dibangun: - **Trustworthy:** rapi, tenang,
konsisten, dan tidak berlebihan. - **Precise:** informasi dokumen, kode,
tanggal, dan hash mudah dibaca. - **Modern:** komponen kontemporer
dengan detail visual yang halus. - **Purpose-built:** antarmuka
dirancang berdasarkan proses pengajuan, review, dan pemeriksaan
dokumen. - **Accessible:** keterbacaan dan kontras lebih penting
daripada efek dekoratif.

Arah visual bukan untuk meniru produk referensi. Referensi digunakan
untuk mengambil prinsip yang relevan, lalu diterjemahkan menjadi
identitas produk sendiri.

## 2. Referensi Desain

### 2.1 Stripe --- Professional Product Clarity

Referensi: [Stripe Design Language Study](https://stripe.design/)

**Hal yang dipelajari:** - hierarki tipografi yang jelas; - penggunaan
warna aksen secara terukur; - tata letak yang rapi; - detail spacing dan
motion yang konsisten; - nuansa produk finansial yang serius dan
terawat.

**Yang diadaptasi:** - kesan profesional; - pemisahan informasi utama
dan sekunder; - kualitas detail komponen; - transisi yang halus dan
tidak mengganggu.

**Yang tidak disalin:** - palet ungu Stripe; - bentuk, logo, ilustrasi,
atau komposisi halaman Stripe; - pricing/marketing layout yang tidak
relevan dengan workflow dokumen.

Catatan: stripe.design adalah studi desain independen, bukan dokumentasi
resmi Stripe. Gunakan sebagai referensi visual, bukan sumber spesifikasi
brand Stripe.

### 2.2 Vercel Geist --- Technical Precision

Referensi resmi: - [Geist Design
System](https://vercel.com/geist/introduction) - [Geist
Typography](https://vercel.com/geist/typography) - [Geist
Colors](https://vercel.com/geist/colors)

**Hal yang dipelajari:** - penggunaan token warna semantik; - pemisahan
background, surface, border, dan text; - tipografi yang konsisten untuk
heading, body, label, dan kode; - penggunaan sans-serif dan monospace
sesuai konteks; - kontras yang jelas pada antarmuka terang maupun gelap.

**Yang diadaptasi:** - Geist Sans sebagai kandidat font UI; - Geist Mono
untuk kode verifikasi, hash, ID, dan metadata teknis; - semantic design
tokens; - penggunaan warna berdasarkan fungsi, bukan dekorasi.

**Yang tidak disalin:** - tampilan developer dashboard Vercel secara
langsung; - warna brand dan identitas Vercel; - pola halaman deployment
yang tidak sesuai dengan produk dokumen.

### 2.3 Linear --- Calm Information Density

Referensi: [A calmer interface for a product in
motion](https://linear.app/now/behind-the-latest-design-refresh)

**Hal yang dipelajari:** - navigasi tidak perlu bersaing dengan area
kerja utama; - informasi padat tetap dapat terasa tenang jika
hierarkinya baik; - border dan separator digunakan hanya saat membantu
pemahaman; - ikon tidak perlu muncul di setiap elemen; - konsistensi
posisi aksi dan navigasi mengurangi beban kognitif.

**Yang diadaptasi:** - sidebar yang lebih tenang; - fokus visual pada
konten aktif; - border tipis dan terukur; - tab, filter, dan kontrol
yang ringkas; - kepadatan informasi yang terkontrol.

**Yang tidak disalin:** - tema gelap Linear secara mentah; - pola issue
tracker dan project management; - warna aksen atau komposisi khas
Linear.

## 3. Sintesis Arah Visual

  -----------------------------------------------------------------------
  Sumber inspirasi        Prinsip yang diambil    Penerapan pada produk
  ----------------------- ----------------------- -----------------------
  Stripe                  Profesional, detail,    User workspace dan form
                          hierarki                submission

  Geist                   Tipografi teknis,       Kode, hash, ID, dan
                          semantic tokens         sistem tema

  Linear                  Tenang, minim noise,    Admin queue dan review
                          navigasi jelas          workspace
  -----------------------------------------------------------------------

Hasil sintesis: - fondasi warna netral bernuansa navy; - satu aksen
utama biru yang kuat tetapi tidak neon; - tipografi sans-serif modern
dan monospace untuk data teknis; - permukaan berlapis secara halus; -
border lebih sering digunakan daripada shadow; - layout berorientasi
pada tugas, bukan kumpulan kartu statistik.

## 4. Identitas Visual Produk

### Brand personality

-   Professional
-   Dependable
-   Precise
-   Calm
-   Secure-minded

### Logo direction --- belum final

Rekomendasi awal: - simbol abstrak yang menggabungkan bentuk halaman
dokumen dan tanda pemeriksaan/integrity; - bentuk sederhana yang tetap
jelas pada ukuran 20--24 px; - tidak menggunakan ikon perisai atau
gembok generik sebagai satu-satunya identitas; - wordmark mengikuti nama
produk final, yang masih TBD.

Jangan membuat logo final atau nama brand secara otomatis sebelum
pemilik produk menyetujuinya.

## 5. Penerapan pada Tiga Area Produk

### 5.1 User Workspace

Fokus: - kemudahan mengajukan dokumen; - status pengajuan yang jelas; -
daftar dokumen mudah dipindai; - hasil pemeriksaan hash yang mudah
dimengerti.

Visual: - ruang kosong cukup; - form satu kolom dengan grouping yang
jelas; - tabel/list sederhana; - status tidak hanya bergantung pada
warna.

### 5.2 Admin Workspace

Fokus: - antrean pemeriksaan; - preview PDF; - empat aspek checklist; -
keputusan dan catatan reviewer.

Visual: - informasi lebih padat dibanding User Workspace; - sidebar
tidak dominan; - preview dokumen menjadi fokus utama; - panel checklist
tetap terlihat jelas; - aksi approve/revision/reject dibedakan dengan
tegas.

### 5.3 Verification Interface

Fokus: - hasil hash matching; - hasil pencarian kode/QR; - status
dokumen; - metadata yang relevan.

Visual: - hasil utama tampil paling menonjol; - kode/hash menggunakan
monospace; - status memiliki label teks dan ikon; - penjelasan batas
makna hasil verifikasi terlihat jelas.

## 6. Prinsip Anti-Template

Jangan: - memakai empat kartu statistik besar secara default pada setiap
halaman; - membuat semua konten menjadi card di atas card; - menggunakan
gradient mesh, glassmorphism, glow, dan neon tanpa alasan; - menambahkan
grafik dekoratif yang tidak menjawab kebutuhan pengguna; - menggunakan
ikon berwarna-warni pada setiap menu; - memakai radius terlalu besar
pada semua elemen; - menggunakan sidebar, topbar, dan tabel generik
tanpa menyesuaikan workflow; - menampilkan placeholder data seolah-olah
data nyata.

Lakukan: - rancang setiap halaman berdasarkan satu tugas utama; -
gunakan komposisi berbeda untuk dashboard, review detail, dan
verification result; - buat hierarchy yang kuat melalui ukuran, berat
font, spacing, dan alignment; - gunakan data contoh hanya pada prototype
dan beri label sebagai data contoh; - buat empty, loading, error,
success, dan permission state; - gunakan status dan tindakan sesuai
bahasa produk.

## 7. Referensi Implementasi

Referensi ini menjadi dasar eksplorasi desain, bukan izin untuk menyalin
brand atau komponen proprietary. Seluruh keputusan visual final berada
pada `DESIGN_SYSTEM.md` dan `DESIGN_TOKENS.css`.
