import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ShoppingCart, Search, Plus, Minus, X, ChevronLeft, Package,
  Building2, Hammer, PaintBucket, Milestone, LayoutGrid, Wrench,
  Store, ClipboardList, User, Check, Clock, ArrowRight, AlertCircle,
  Truck, PackageCheck, Wallet, RotateCcw, CreditCard, Headphones,
  HelpCircle, ChevronRight, Phone, MessageCircle, Copy, MapPin, LogOut, Lock, Star, Upload, Share2, RefreshCw,
  Smile, Camera, Image as ImageIcon, Bell, History, MoreVertical, Download, FileEdit
} from "lucide-react";

// ============================================================
// DATA CONTOH (nanti diganti pemanggilan API ke Apps Script Anda)
// ============================================================
const SAMPLE_TOKO = [
  { kode: "C001", nama: "Toko Maju Jaya", kota: "Pekanbaru", alamat: "Jl. Sudirman No. 10, Pekanbaru", telp: "081234567891", jenisBayar: "Tempo" },
  { kode: "C002", nama: "CV Sinar Abadi", kota: "Jakarta", alamat: "Jl. Sudirman No. 5, Jakarta", telp: "081234567892", jenisBayar: "Tunai" },
  { kode: "C003", nama: "PT Berkah Sentosa", kota: "Pekanbaru", alamat: "Jl. Ahmad Yani No. 22, Pekanbaru", telp: "081234567893", jenisBayar: "Transfer" },
  { kode: "C004", nama: "Toko Sumber Rejeki", kota: "Makassar", alamat: "Jl. Sam Ratulangi No. 8, Makassar", telp: "081234567894", jenisBayar: "Tempo" },
  { kode: "C005", nama: "UD Makmur Jaya", kota: "Jakarta", alamat: "Jl. Thamrin No. 15, Jakarta", telp: "081234567895", jenisBayar: "Tunai" },
];

const CATEGORY_META = {
  "Bahan Bangunan": { icon: Building2, bg: "#EFE1BE", fg: "#B8860B" },
  "Cat": { icon: PaintBucket, bg: "#D8E9E6", fg: "#24272B" },
  "Pipa": { icon: Milestone, bg: "#D8E9E6", fg: "#24272B" },
  "Keramik": { icon: LayoutGrid, bg: "#EFE1BE", fg: "#B8860B" },
  "Sparepart": { icon: Wrench, bg: "#EFE1BE", fg: "#B8860B" },
};
// Dipakai kalau kategori barang belum ada di daftar di atas (misal kategori baru
// yang ditambahkan lewat menu Product di Dashboard) - supaya tidak bikin app crash.
const DEFAULT_CATEGORY_META = { icon: Package, bg: "#EDEAE3", fg: "#6B6F75" };

const SAMPLE_PRODUCTS = [
  { kode: "B001", nama: "Semen 50kg", kategori: "Bahan Bangunan", satuan: "Sak", harga: 65000, hargaAsli: null, stock: 200, isiPerKoli: 0 },
  { kode: "B002", nama: "Besi Beton 10mm", kategori: "Bahan Bangunan", satuan: "Batang", harga: 85000, hargaAsli: null, stock: 150, isiPerKoli: 0 },
  { kode: "B003", nama: "Cat Tembok 5kg", kategori: "Cat", satuan: "Kaleng", harga: 120000, hargaAsli: null, stock: 80, isiPerKoli: 0 },
  { kode: "B004", nama: "Pipa PVC 3 inch", kategori: "Pipa", satuan: "Batang", harga: 45000, hargaAsli: null, stock: 100, isiPerKoli: 0 },
  { kode: "B005", nama: "Keramik 40x40", kategori: "Keramik", satuan: "Dus", harga: 75000, hargaAsli: null, stock: 60, isiPerKoli: 0 },
  // harga = harga net (sudah termasuk diskon standar 20% dari hargaAsli), tampil dicoret di katalog.
  // isiPerKoli = ambil sejumlah ini dapat diskon TAMBAHAN 5% lagi dari harga net.
  { kode: "B006", nama: "Item A (Set)", kategori: "Sparepart", satuan: "Set", harga: 172500, hargaAsli: 215625, stock: 300, isiPerKoli: 20 },
  { kode: "B007", nama: "Item B (Set)", kategori: "Sparepart", satuan: "Set", harga: 189600, hargaAsli: 237000, stock: 200, isiPerKoli: 12 },
];

const MIN_CHECKOUT = 500000;

// ---------- Koneksi Supabase (database asli, pengganti data contoh) ----------
const SUPABASE_URL = "https://bzlktpveupyxtcuhrmgg.supabase.co";
// Daftar akun DEMO/UJI COBA - akun ini tetap pakai VA Xendit (bukan
// rekening manual perusahaan) dan tetap tampilkan pesan "Informasi" di
// katalog. Tambahkan email baru ke sini kalau ada akun demo tambahan.
const DAFTAR_EMAIL_DEMO = ["demo@indogarudaabadi.com", "hendrysky12@gmail.com"];
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6bGt0cHZldXB5eHRjdWhybWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMTIwNjQsImV4cCI6MjA5OTc4ODA2NH0.DKvaQ-_Gdi5nj5DFkhu-8IttPCztYuKCoMoXxcIUdEI";
const VAPID_PUBLIC_KEY = "BIsMEruRFmmq-ybQepJ1Vpr8vCQTDhp-5W403C_icGEh4b5jSaCX9H4106Eysboa6cNzIQ83Bp6yDGJUXiFWc8k";

// Ubah base64url (format VAPID) jadi Uint8Array yang dimengerti browser
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

// Daftarkan service worker + minta izin notifikasi + simpan langganan push
// ke database, supaya toko tetap dapat notif walau Web App sudah ditutup.
async function subscribeToPush(clientId) {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("Browser ini tidak mendukung notifikasi push.");
      return;
    }
    const registration = await navigator.serviceWorker.register("/sw.js");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      alert("Izin notifikasi ditolak/dibatalkan. Coba lagi dan pilih 'Izinkan'.");
      return;
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = subscription.toJSON();
    await supabaseFetch("push_subscriptions?on_conflict=endpoint", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: JSON.stringify({
        client_id: clientId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
      }),
    });
    alert("Notifikasi berhasil diaktifkan!");
  } catch (e) {
    alert("Gagal aktifkan notifikasi: " + e.message);
  }
}

// Batas waktu otomatis buat SEMUA permintaan ke Supabase - supaya kalau
// koneksi macet (misal pas pindah dari WiFi ke jaringan seluler), permintaan
// itu otomatis dianggap gagal setelah 15 detik, bukan macet "Memuat..."
// selamanya tanpa kepastian.
async function fetchDenganTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error("Koneksi terlalu lama merespons (mungkin sinyal lemah/baru ganti jaringan). Coba lagi.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function supabaseFetch(path, options = {}, userToken = null) {
  const res = await fetchDenganTimeout(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${userToken || SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${text}`);
  // Respons bisa kosong/whitespace saja (misal saat pakai header Prefer
  // yang tidak minta "return=representation") - jangan paksa parse JSON
  // kalau begitu, supaya tidak error "Unexpected end of JSON input".
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    throw new Error(`Gagal baca respons server: ${e.message}`);
  }
}

async function supabaseSignUp(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || "Gagal daftar akun.");
  return data; // { access_token, user, ... }
}

async function supabaseSignIn(email, password) {
  const res = await fetchDenganTimeout(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || "Email atau password salah.");
  return data; // { access_token, refresh_token, user, ... }
}

// Perpanjang sesi pakai refresh_token - access_token Supabase cuma berlaku
// ±1 jam, tapi refresh_token bisa dipakai berkali-kali buat dapat
// access_token baru tanpa perlu login ulang, sampai user klik Logout sendiri.
async function supabaseRefreshToken(refreshToken, timeoutMs) {
  const res = await fetchDenganTimeout(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  }, timeoutMs);
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || "Sesi berakhir, silakan login ulang.");
  return data; // { access_token, refresh_token baru, ... }
}

// Simpan/ambil sesi login supaya tetap login walau halaman di-refresh.
// (Ini website sungguhan yang sudah di-deploy, jadi localStorage aman dipakai -
// beda dengan preview di dalam chat Claude yang tidak mendukung ini.)
const SESSION_KEY = "toko_session_v1";
function saveSession(session) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
}
function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
}

// Ubah baris tabel Supabase (snake_case) jadi bentuk yang dipakai komponen (camelCase)
function mapSupabaseProduct(row) {
  return {
    id: row.id,
    kode: row.kode,
    nama: row.nama,
    kategori: row.kategori,
    satuan: row.satuan,
    harga: Number(row.harga_jual),
    hargaAsli: row.harga_asli ? Number(row.harga_asli) : null,
    isiPerKoli: row.isi_per_koli || 0,
    diskonKoliPct: row.diskon_koli_pct !== undefined && row.diskon_koli_pct !== null ? Number(row.diskon_koli_pct) : 0.05,
    minimalOrder: row.minimal_order || 1,
    kelipatanOrder: row.kelipatan_order || 1,
    stock: row.stock_akhir !== undefined ? Number(row.stock_akhir) : (row.stock_awal ?? 0),
    gambarUrl: row.gambar_url || null,
    deskripsi: row.deskripsi || null,
  };
}

const COMPANY_INFO = {
  nama: "PT Nama Perusahaan Anda",
  rekening: [
    { bank: "BCA", nomor: "1234567890", atasNama: "PT Nama Perusahaan Anda" },
    { bank: "Mandiri", nomor: "9876543210", atasNama: "PT Nama Perusahaan Anda" },
  ],
  ketentuan: [
    "Pembayaran Tunai/Transfer dilakukan maksimal 1x24 jam setelah barang diterima.",
    "Pembayaran Tempo mengikuti jangka waktu yang berlaku untuk toko Anda (lihat Data Client), dihitung sejak tanggal nota.",
    "Kirim bukti transfer ke WhatsApp Customer Service untuk konfirmasi lebih cepat.",
  ],
};

const CS_INFO = {
  jamOperasional: "Senin - Sabtu, 08.00 - 17.00 WIB",
  whatsapp: "6281234567890",
  whatsappDisplay: "0812-3456-7890",
};

const HELP_STEPS = [
  { judul: "Cara pesan barang", isi: "Masuk pakai Kode Toko, pilih kategori atau cari barang, tambahkan ke keranjang, lalu Kirim Order." },
  { judul: "Menunggu persetujuan", isi: "Setiap order perlu disetujui Owner sebelum diproses. Anda akan mendapat kabar begitu disetujui." },
  { judul: "Kirim ke alamat lain / dropship", isi: "Di halaman Keranjang, pilih 'Kirim ke alamat lain' kalau barang dikirim ke lokasi berbeda dari alamat toko terdaftar." },
  { judul: "Order ulang", isi: "Buka menu Akun > Order Ulang untuk salin order sebelumnya tanpa perlu pilih barang dari awal." },
  { judul: "Belum bayar / konfirmasi terima", isi: "Cek status pesanan di menu Akun. Kalau barang sudah sampai, tekan Konfirmasi Penerimaan." },
];

// Dataset CADANGAN dipakai HANYA kalau API wilayah asli (emsifa) gagal diakses
// (misal karena sandbox preview tidak mengizinkan akses internet keluar).
// Begitu di-deploy jadi web sungguhan, API asli akan dipakai otomatis.
const FALLBACK_WILAYAH_NAMES = {
  "Riau": {
    "Pekanbaru": {
      "Sukajadi": ["Kampung Tengah", "Kampung Melayu", "Jadirejo"],
      "Tampan": ["Simpang Baru", "Delima"],
      "Marpoyan Damai": ["Wonorejo", "Sidomulyo Timur"],
    },
    "Dumai": { "Dumai Kota": ["Dumai Kota"], "Dumai Barat": ["Simpang Tetap Darul Ichsan"] },
    "Bengkalis": { "Bengkalis": ["Bengkalis"], "Bantan": ["Bantan"], "Siak Kecil": ["Siak Kecil"], "Rupat": ["Rupat"], "Mandau": ["Mandau (Duri)"] },
    "Indragiri Hilir": { "Tembilahan": ["Tembilahan"], "Gaung": ["Gaung"], "Kateman": ["Kateman"], "Enok": ["Enok"], "Mandah": ["Mandah"] },
    "Indragiri Hulu": { "Rengat": ["Rengat"], "Lirik": ["Lirik"], "Pasir Penyu": ["Pasir Penyu"], "Kelayang": ["Kelayang"], "Batang Cenaku": ["Batang Cenaku"] },
    "Kampar": { "Bangkinang": ["Bangkinang"], "Kampar": ["Kampar"], "Siak Hulu": ["Siak Hulu"], "Tapung": ["Tapung"], "Koto Kampar Hulu": ["Koto Kampar Hulu"] },
    "Kepulauan Meranti": { "Tebing Tinggi (Selatpanjang)": ["Selatpanjang"], "Merbau": ["Merbau"], "Pulau Merbau": ["Pulau Merbau"], "Rangsang": ["Rangsang"] },
    "Kuantan Singingi": { "Kuantan Tengah (Teluk Kuantan)": ["Teluk Kuantan"] },
    "Pelalawan": { "Pangkalan Kerinci": ["Pangkalan Kerinci"], "Langgam": ["Langgam"], "Pangkalan Kuras": ["Pangkalan Kuras"], "Kuala Kampar": ["Kuala Kampar"], "Ukui": ["Ukui"] },
    "Rokan Hilir": { "Bagan Sinembah (Bagansiapiapi)": ["Bagansiapiapi"], "Kubu": ["Kubu"], "Pasir Limau Kapas": ["Pasir Limau Kapas"], "Bangko": ["Bangko"], "Tanah Putih": ["Tanah Putih"] },
    "Rokan Hulu": { "Pasir Pengaraian": ["Pasir Pengaraian"], "Rambah": ["Rambah"], "Ujung Batu": ["Ujung Batu"], "Kunto Darussalam": ["Kunto Darussalam"], "Rokan IV Koto": ["Rokan IV Koto"] },
    "Siak": { "Siak": ["Siak Sri Indrapura"], "Minas": ["Minas"], "Tualang": ["Tualang (Perawang)"], "Kandis": ["Kandis"] },
  },
  "DKI Jakarta": {
    "Jakarta Pusat": { "Menteng": ["Menteng", "Gondangdia"], "Tanah Abang": ["Bendungan Hilir", "Kebon Melati"] },
    "Jakarta Selatan": { "Kebayoran Baru": ["Melawai", "Senayan"] },
  },
  "Sulawesi Selatan": {
    "Makassar": { "Panakkukang": ["Karuwisi", "Masale"], "Rappocini": ["Gunung Sari", "Ballaparang"] },
  },
};

function buildFallbackWilayah(names) {
  const provinces = [];
  const regencies = {};
  const districts = {};
  const villages = {};
  const slug = (s) => s.replace(/\s+/g, "-").toLowerCase();
  Object.entries(names).forEach(([provName, regs]) => {
    const provId = "f-" + slug(provName);
    provinces.push({ id: provId, name: provName });
    regencies[provId] = [];
    Object.entries(regs).forEach(([regName, dists]) => {
      const regId = provId + "-" + slug(regName);
      regencies[provId].push({ id: regId, name: regName });
      districts[regId] = [];
      Object.entries(dists).forEach(([distName, vills]) => {
        const distId = regId + "-" + slug(distName);
        districts[regId].push({ id: distId, name: distName });
        villages[distId] = vills.map((v, i) => ({ id: distId + "-" + i, name: v }));
      });
    });
  });
  return { provinces, regencies, districts, villages };
}
const FALLBACK_WILAYAH = buildFallbackWilayah(FALLBACK_WILAYAH_NAMES);



// Hitung rincian harga 1 baris barang.
// "harga" = harga net saat ini (sudah termasuk diskon standar, misal 20% dari hargaAsli).
// Diskon tambahan per-koli DIHAPUS/DINONAKTIFKAN - fungsi ini sekarang
// SELALU mengembalikan harga apa adanya tanpa diskon tambahan koli.
function hitungRincianItem(product, qty) {
  const subtotalSebelum = product.harga * qty;
  return {
    subtotalSebelum,
    totalDiskon: 0,
    totalSetelahDiskon: subtotalSebelum,
    kenaKoli: false,
    hargaSetelahKoli: product.harga,
  };
}

const rupiah = (n) => "Rp" + n.toLocaleString("id-ID");

// Sensor nama: tampilkan huruf pertama & terakhir tiap kata, sisanya *
function sensorNama(nama) {
  if (!nama) return "-";
  return nama
    .split(" ")
    .map((word) => {
      if (word.length <= 2) return word;
      return word[0] + "*".repeat(word.length - 2) + word[word.length - 1];
    })
    .join(" ");
}

// Sensor no HP: tampilkan 2 digit depan & 2 digit belakang, sisanya *
function sensorNoHp(hp) {
  if (!hp) return "-";
  const digits = hp.replace(/\s/g, "");
  if (digits.length <= 4) return digits;
  return digits.slice(0, 2) + "*".repeat(digits.length - 4) + digits.slice(-2);
}

// ============================================================
// KOMPRESI GAMBAR - kecilkan ukuran file foto sebelum diupload (resize +
// re-encode jadi JPEG kualitas wajar), supaya lebih cepat & hemat kuota,
// tapi masih enak dilihat. Dipakai di SEMUA tempat upload foto.
// ============================================================
function compressImage(file, maxDimension = 1280, quality = 0.8) {
  return new Promise((resolve) => {
    // Kalau bukan file gambar (misal PDF dokumen), lewati kompresi -
    // kembalikan file aslinya apa adanya.
    if (!file.type || !file.type.startsWith("image/")) {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height / width) * maxDimension);
            width = maxDimension;
          } else {
            width = Math.round((width / height) * maxDimension);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        // Target WebP - ukuran jauh lebih kecil dari JPEG di kualitas yang
        // sama, didukung luas di browser modern. Kalau browser TIDAK
        // dukung WebP (jarang, HP/browser sangat lama), canvas otomatis
        // fallback ke PNG - makanya kita cek blob.type asli hasilnya,
        // bukan asumsi selalu WebP.
        canvas.toBlob(
          (blob) => resolve(blob || file), // kalau gagal kompres, tetap pakai file asli - jangan sampai upload gagal total
          "image/webp",
          quality
        );
      };
      img.onerror = () => resolve(file); // gagal baca gambar - pakai file asli saja
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// Tentukan ekstensi & Content-Type file YANG SEBENARNYA dihasilkan compressImage
// - biasanya WebP, tapi browser lama bisa fallback ke PNG/JPEG kalau WebP
// tidak didukung. Jangan asumsikan selalu satu format.
function infoFileTerkompresi(compressed, fileAsli) {
  const adalahGambar = fileAsli.type?.startsWith("image/");
  if (!adalahGambar || compressed === fileAsli) {
    return { ext: fileAsli.name.split(".").pop(), contentType: fileAsli.type || "application/octet-stream" };
  }
  const petaExt = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
  const ext = petaExt[compressed.type] || fileAsli.name.split(".").pop();
  return { ext, contentType: compressed.type || fileAsli.type };
}

// ============================================================
// GAMBAR AUTO-RETRY - kalau gambar gagal termuat penuh (koneksi putus
// tengah jalan), otomatis coba ulang beberapa kali dengan cache-busting,
// tanpa perlu user refresh halaman manual.
// ============================================================
function ImgAutoRetry({ src, alt, style, onClick, draggable, className }) {
  const [attempt, setAttempt] = useState(0);
  const [menyerah, setMenyerah] = useState(false); // true kalau semua percobaan OTOMATIS habis

  useEffect(() => {
    setAttempt(0); // gambar baru (src beda) - reset hitungan percobaan
    setMenyerah(false);
  }, [src]);

  const MAKS_PERCOBAAN_OTOMATIS = 8;

  function handleError() {
    if (attempt < MAKS_PERCOBAAN_OTOMATIS) {
      // Jeda antar percobaan naik bertahap, tapi dibatasi maksimal 5 detik
      // (supaya kalau jaringan mati lumayan lama, tetap terus dicoba tanpa
      // jeda yang kelewat panjang).
      const jeda = Math.min(800 * (attempt + 1), 5000);
      setTimeout(() => setAttempt((a) => a + 1), jeda);
    } else {
      // Percobaan otomatis habis - jangan diam sebagai gambar kosong/rusak,
      // tampilkan tombol supaya user bisa coba lagi sendiri (misal setelah
      // jaringan mereka pulih).
      setMenyerah(true);
    }
  }

  if (!src) return null;

  if (menyerah) {
    return (
      <button
        onClick={() => { setMenyerah(false); setAttempt((a) => a + 1); }}
        style={{ ...style, background: "#F7F5F1", border: "1px dashed #D8D4CB", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", padding: 0 }}
      >
        <RefreshCw size={16} color="#9CA0A6" />
        <span style={{ fontSize: 10.5, color: "#9CA0A6" }}>Gagal muat - tap untuk coba lagi</span>
      </button>
    );
  }

  // Percobaan ke-2 dst pakai parameter cache-busting supaya request
  // BENAR-BENAR ulang dari jaringan, bukan pakai cache/SW yang mungkin
  // menyimpan versi gagal/setengah sebelumnya.
  const finalSrc = attempt === 0 ? src : `${src}${src.includes("?") ? "&" : "?"}_retry=${attempt}`;

  return (
    <img
      src={finalSrc}
      alt={alt}
      style={style}
      onClick={onClick}
      draggable={draggable}
      className={className}
      onError={handleError}
    />
  );
}

// ============================================================
// KOMPONEN UTAMA
// ============================================================
export default function OrderApp() {
  const [screen, setScreen] = useState(() => {
    // Deteksi kalau app dibuka dari link reset password email (Supabase
    // menambahkan token di URL fragment/hash: #access_token=...&type=recovery)
    // ATAU kalau linknya sudah tidak valid/kedaluwarsa/sudah dipakai, Supabase
    // kirim pola beda: #error=...&error_description=...
    if (window.location.hash.includes("type=recovery") || window.location.hash.includes("error=")) return "reset-password-form";
    return "catalog";
  }); // login | register | catalog | product | cart | success | history | akun | akun-rekening | akun-cs | akun-bantuan | campaign-detail | reset-password-form
  const [recoveryToken, setRecoveryToken] = useState(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    return params.get("access_token") || null;
  });
  const [recoveryLinkError, setRecoveryLinkError] = useState(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    return params.get("error_description") ? params.get("error_description").replace(/\+/g, " ") : null;
  });

  // Kalau tab yang sama dipakai buka LAGI link reset password (browser HP
  // kadang tidak reload penuh, cuma ganti hash URL) - useState di atas cuma
  // jalan sekali pas awal mount, jadi perlu dengar perubahan hash juga biar
  // kedeteksi ulang setiap kali linknya dibuka.
  useEffect(() => {
    function handleHashChange() {
      if (window.location.hash.includes("type=recovery") || window.location.hash.includes("error=")) {
        const hash = window.location.hash.replace(/^#/, "");
        const params = new URLSearchParams(hash);
        setRecoveryToken(params.get("access_token") || null);
        setRecoveryLinkError(params.get("error_description") ? params.get("error_description").replace(/\+/g, " ") : null);
        setScreen("reset-password-form");
      }
    }
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);
  const [campaignVisible, setCampaignVisible] = useState(true);

  // Daftarkan Service Worker otomatis begitu app dibuka - supaya tampilan
  // app bisa di-cache dan muncul instan saat jaringan transisi, TERLEPAS
  // dari apakah user mengaktifkan notifikasi atau tidak (sebelumnya SW
  // cuma didaftarkan kalau user klik "Aktifkan Notifikasi").
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});

      // Deteksi kalau ada VERSI BARU kode yang sudah aktif mengambil alih
      // (controllerchange) - kode JS yang SEDANG dijalankan di tab ini
      // tetap versi LAMA sampai halaman di-refresh manual, jadi kasih
      // TAHU pengguna lewat banner supaya mereka tahu perlu refresh -
      // bukan auto-refresh paksa yang bisa hilangkan isian form mereka.
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        setUpdateTersedia(true);
      });
    }
  }, []);

  const [updateTersedia, setUpdateTersedia] = useState(false);
  const [maintenanceInfo, setMaintenanceInfo] = useState(null); // { aktif, pesan } | null

  // Cek status Mode Maintenance secara BERKALA (tiap 10 detik) - kalau
  // Owner aktifkan, tampilkan info maintenance (blokir interaksi). Begitu
  // Owner MATIKAN lagi (dari aktif jadi nonaktif), otomatis REFRESH PAKSA
  // halaman ini tanpa perlu klik apapun dari toko - supaya langsung dapat
  // kode/data terbaru.
  useEffect(() => {
    let sudahPernahAktif = false;
    async function cekMaintenance() {
      try {
        const rows = await supabaseFetch("pengaturan_maintenance?select=aktif,pesan&id=eq.1");
        const row = rows?.[0];
        if (!row) return;
        if (row.aktif) {
          sudahPernahAktif = true;
          setMaintenanceInfo({ aktif: true, pesan: row.pesan });
        } else if (sudahPernahAktif) {
          window.location.reload();
        }
      } catch (e) { /* diamkan - kalau gagal cek, anggap saja tidak maintenance */ }
    }
    cekMaintenance();
    const interval = setInterval(cekMaintenance, 10000);
    return () => clearInterval(interval);
  }, []);

  const [campaignBanner, setCampaignBanner] = useState(null);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Deteksi apakah sudah dijalankan sebagai app terinstall (jangan tawarkan
    // install lagi kalau sudah)
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    setIsStandalone(standalone);

    // Android/Chrome: tangkap event ini supaya bisa munculkan tombol install
    // sendiri (browser tidak munculkan prompt otomatis kalau sudah di-preventDefault)
    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      setInstallPromptEvent(e);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  async function handleInstallClick() {
    if (installPromptEvent) {
      installPromptEvent.prompt();
      const { outcome } = await installPromptEvent.userChoice;
      if (outcome === "accepted") setInstallPromptEvent(null);
    }
  }

  useEffect(() => {
    supabaseFetch("campaign_banner?select=*&limit=1")
      .then((rows) => setCampaignBanner(rows[0] || null))
      .catch(() => setCampaignBanner(null));
  }, []);
  const [campaignReturnScreen, setCampaignReturnScreen] = useState("catalog");
  const [csReturnScreen, setCsReturnScreen] = useState("akun");
  const [products, setProducts] = useState([]); // kosong dulu, diisi data asli setelah selesai dimuat
  const [productsLoading, setProductsLoading] = useState(true);
  const [dbError, setDbError] = useState("");
  const [hargaProvinsiMap, setHargaProvinsiMap] = useState({}); // { kodeProduk: { provinsi: harga } }

  useEffect(() => {
    supabaseFetch("harga_produk_provinsi?select=provinsi,harga,products(kode)")
      .then((rows) => {
        const map = {};
        rows.forEach((r) => {
          const kode = r.products?.kode;
          if (!kode) return;
          if (!map[kode]) map[kode] = {};
          map[kode][r.provinsi] = r.harga;
        });
        setHargaProvinsiMap(map);
      })
      .catch(() => {}); // biarkan kosong (semua pakai harga default) kalau gagal muat
  }, []);

  function loadProducts() {
    setProductsLoading(true);
    setDbError("");
    supabaseFetch("v_katalog_publik?select=id,kode,nama,kategori,satuan,harga_jual,harga_asli,isi_per_koli,diskon_koli_pct,minimal_order,kelipatan_order,gambar_url,deskripsi")
      .then(async (rows) => {
        let stockMap = {};
        try {
          const stockRows = await supabaseFetch("v_stock_akhir?select=kode,stock_akhir");
          stockRows.forEach((r) => { stockMap[r.kode] = r.stock_akhir; });
        } catch (e) { /* kalau gagal, pakai stock_awal sebagai cadangan */ }
        const mapped = rows.map((r) => mapSupabaseProduct({ ...r, stock_akhir: stockMap[r.kode] }));
        setProducts(mapped); // tampilkan apa adanya dari database, walau hasilnya 0 barang
        setProductsLoading(false);
      })
      .catch(() => {
        // JANGAN tampilkan data contoh/palsu di sini - kalau jaringan/koneksi
        // benar-benar gagal, lebih baik tampilkan pesan error + tombol coba
        // lagi, supaya toko tidak salah kira produk contoh (Semen/Besi) itu
        // barang asli yang bisa dipesan.
        setProducts([]);
        setProductsLoading(false);
        setDbError("Gagal memuat produk - kemungkinan koneksi internet Anda sedang bermasalah.");
      });
  }
  useEffect(() => { loadProducts(); }, []);

  const [isGuest, setIsGuest] = useState(true);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [poinDipakai, setPoinDipakai] = useState(0); // poin yang dipilih customer buat potongan checkout
  const [dailyClaims, setDailyClaims] = useState({}); // { 0: poin, 1: poin, ... } key = hari (0=Minggu...6=Sabtu), minggu berjalan (sesi ini saja)
  const [spinTickets, setSpinTickets] = useState(0);
  const [orderListKey, setOrderListKey] = useState(null); // "pesanan" | "kirim" | "konfirmasi" | "bayar"
  const [reorderPreview, setReorderPreview] = useState(null);
  const [toko, setToko] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [restoringSession, setRestoringSession] = useState(true);
  // ---- Mode Sales: sales login pakai email/password sendiri, lalu pilih
  // toko yang ditanganinya buat dibantu order-kan ----
  const [salesInfo2, setSalesInfo2] = useState(null); // { id, nama } - null kalau bukan sesi sales
  const [daftarTokoSales, setDaftarTokoSales] = useState([]);
  const [showPilihToko, setShowPilihToko] = useState(false);
  const [salesAuthCache, setSalesAuthCache] = useState(null); // { userId, token, refreshToken, email } - disimpan sementara sebelum toko dipilih
  const [cart, setCart] = useState({}); // { kodeBarang: qty }
  const [cartLoaded, setCartLoaded] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Keranjang sekarang disimpan PERMANEN di database (bukan localStorage HP
  // lagi - sama seperti alamat, itu bisa hilang kalau data browser
  // terhapus, terutama di Safari/iPhone).
  async function loadCart(clientId) {
    try {
      const rows = await supabaseFetch(`keranjang_toko?select=isi&client_id=eq.${clientId}`);
      setCart(rows[0]?.isi || {});
    } catch (e) {
      console.log("Gagal muat keranjang:", e.message);
    } finally {
      setCartLoaded(true);
    }
  }

  // Simpan ke database setiap kali isi keranjang berubah (jeda sedikit biar
  // tidak nembak database tiap klik +/- secara beruntun)
  useEffect(() => {
    if (!toko?.id || !cartLoaded) return;
    const timer = setTimeout(() => {
      supabaseFetch(`keranjang_toko?on_conflict=client_id`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ client_id: toko.id, isi: cart, updated_at: new Date().toISOString() }),
      }).catch((e) => console.log("Gagal simpan keranjang:", e.message));
    }, 600);
    return () => clearTimeout(timer);
  }, [cart, toko?.id, cartLoaded]);
  const [orders, setOrders] = useState([]);
  const [regForm, setRegForm] = useState({ email: "", password: "", nama: "", alamat: "", telp: "", jenisBayar: "Transfer", tempo: "0", provinsi: "", provinsiId: "", kota: "", kotaId: "", kecamatan: "", kecamatanId: "", kelurahan: "", kodePos: "", namaOwner: "", tanggalLahir: "", jenisUsaha: "" });
  const [regSubmitted, setRegSubmitted] = useState(false);
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regStep, setRegStep] = useState("form"); // "form" | "otp"
  const [regOtpKode, setRegOtpKode] = useState("");
  const [regAuthSementara, setRegAuthSementara] = useState(null); // simpan hasil signUp sementara sambil tunggu verifikasi OTP
  const [useAltAddress, setUseAltAddress] = useState(false);
  const [editingAlt, setEditingAlt] = useState(false);
  const [altAddress, setAltAddress] = useState({
    nama: "", telp: "", alamat: "",
    provinsi: "", provinsiId: "", kota: "", kotaId: "",
    kecamatan: "", kecamatanId: "", kelurahan: "", kodePos: "",
  });
  const [isDropship, setIsDropship] = useState(false);
  const [metodeBayar, setMetodeBayar] = useState("transfer"); // "transfer" | "cod"
  const [savedAddresses, setSavedAddresses] = useState([]); // [{ id, nama, telp, alamat, provinsi, kota, kecamatan, kelurahan, kodePos }]

  // Provinsi yang dipakai buat tentukan harga produk - kalau order dropship
  // DAN kirim ke alamat lain, pakai provinsi TUJUAN (bukan provinsi toko
  // sendiri), karena ongkirnya beda. Kalau bukan dropship, tetap pakai
  // provinsi toko sendiri seperti biasa.
  const provinsiUntukHarga = (useAltAddress && altAddress.provinsi) ? altAddress.provinsi : (toko?.provinsi || "");

  // Produk dengan harga yang SUDAH disesuaikan otomatis sesuai provinsi
  // aktif - kalau ada harga khusus provinsi itu, dipakai; kalau tidak,
  // tetap pakai harga default produk apa adanya.
  const productsHargaProvinsi = useMemo(() => {
    if (!provinsiUntukHarga) return products;
    return products.map((p) => {
      const hargaKhusus = hargaProvinsiMap[p.kode]?.[provinsiUntukHarga];
      return hargaKhusus !== undefined ? { ...p, harga: hargaKhusus } : p;
    });
  }, [products, hargaProvinsiMap, provinsiUntukHarga]);

  // Alamat tersimpan sekarang disimpan PERMANEN di database (bukan cuma
  // localStorage HP lagi - itu bisa hilang, terutama di Safari/iPhone yang
  // otomatis hapus data browser setelah ~7 hari tidak dibuka).
  async function loadSavedAddresses(clientId) {
    try {
      const rows = await supabaseFetch(`alamat_tersimpan?select=*&client_id=eq.${clientId}&order=created_at.desc`);
      setSavedAddresses(rows.map((r) => ({
        id: r.id, nama: r.nama, telp: r.telp, alamat: r.alamat,
        provinsi: r.provinsi, kota: r.kota, kecamatan: r.kecamatan, kelurahan: r.kelurahan, kodePos: r.kode_pos,
      })));
    } catch (e) {
      console.log("Gagal muat alamat tersimpan:", e.message);
    }
  }

  const [dropshipSender, setDropshipSender] = useState("");
  const [savedSenderNames, setSavedSenderNames] = useState([]); // riwayat nama pengirim
  const [checkedItems, setCheckedItems] = useState({}); // { kodeBarang: false } -> default true kalau tidak ada di sini

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartRincian = useMemo(() => {
    return Object.entries(cart).reduce((acc, [kode, qty]) => {
      if (checkedItems[kode] === false) return acc; // dilewati kalau centangnya dihilangkan
      const p = productsHargaProvinsi.find((x) => x.kode === kode);
      if (!p) return acc;
      const r = hitungRincianItem(p, qty);
      acc.subtotalSebelum += r.subtotalSebelum;
      acc.totalDiskon += r.totalDiskon;
      acc.totalBayar += r.totalSetelahDiskon;
      return acc;
    }, { subtotalSebelum: 0, totalDiskon: 0, totalBayar: 0 });
  }, [cart, checkedItems, productsHargaProvinsi]);
  const cartTotal = cartRincian.totalBayar;
  // Minimal order per produk BERLAKU UNTUK SEMUA KOTA/PROVINSI (bukan cuma
  // luar Pekanbaru lagi) - Owner atur sendiri per produk di Dashboard.
  // Toko Pekanbaru TETAP ada aturan tambahan minimal total belanja Rp500rb;
  // toko luar Pekanbaru tidak kena aturan total belanja itu (tapi tetap
  // kena aturan minimal order per produk seperti semua toko lain).
  const kotaTujuan = useAltAddress && altAddress.kota ? altAddress.kota : toko?.kota;
  const isLuarPekanbaru = !!(kotaTujuan && !kotaTujuan.trim().toLowerCase().includes("pekanbaru"));

  // COD cuma boleh dipilih kalau tujuan pengiriman di Pekanbaru - kalau
  // alamat berubah jadi luar kota, otomatis balik ke transfer
  useEffect(() => {
    if (isLuarPekanbaru && metodeBayar === "cod") setMetodeBayar("transfer");
  }, [isLuarPekanbaru]);
  const itemBelumMinimalOrder = Object.entries(cart)
    .filter(([kode]) => checkedItems[kode] !== false)
    .map(([kode, qty]) => {
      const p = productsHargaProvinsi.find((pr) => pr.kode === kode);
      if (!p) return null;
      const belumMinimal = p.minimalOrder > 1 && qty < p.minimalOrder;
      // Kelipatan CUMA berlaku untuk toko luar Pekanbaru - Pekanbaru cukup
      // penuhi minimal order saja, tidak perlu kelipatan.
      const belumKelipatan = isLuarPekanbaru && p.kelipatanOrder > 1 && qty % p.kelipatanOrder !== 0;
      return (belumMinimal || belumKelipatan) ? { ...p, qty, belumMinimal, belumKelipatan } : null;
    })
    .filter(Boolean);
  const belowMinimum = cartTotal > 0 && itemBelumMinimalOrder.length > 0;

  // Tarik ulang riwayat order milik toko ini dari database (supaya tidak hilang
  // kalau refresh/login ulang di device lain - sebelumnya cuma tersimpan di HP saja).
  async function loadOrderHistory(clientId, token) {
    try {
      const rows = await supabaseFetch(
        `orders?select=*,order_items(*,products(kode,nama,kategori,satuan,gambar_url))&client_id=eq.${clientId}&order=created_at.desc`,
        {}, token
      );
      const mapped = rows.map((o) => ({
        dbId: o.id,
        id: o.no_nota,
        tanggal: new Date(o.created_at),
        status:
          o.status === "menunggu_persetujuan" ? "Menunggu Persetujuan"
          : o.status === "ditolak" ? "Dibatalkan"
          : o.status === "menunggu_pembayaran" ? "Menunggu Pembayaran"
          : o.status === "menunggu_pengiriman" ? "Sedang Diproses"
          : o.status === "siap_dikirim" ? "Siap Dikirim"
          : o.status === "proses_dikirim" || o.status === "dikirim"
            ? (o.dikonfirmasi_toko_at ? "Selesai" : "Dikirim")
          : o.status === "diretur" ? "Diretur"
          : o.status === "selesai" && o.alasan_retur ? "Retur Selesai"
          : o.status === "selesai" ? "Selesai"
          : o.status,
        alasanRetur: o.alasan_retur || null,
        alasanDibatalkan: o.alasan_dibatalkan || null,
        waktuTahap: {
          diterima: o.created_at,
          disetujui: o.disetujui_at,
          dikemas: o.picking_selesai_at,
          siapKirim: o.outbound_verified_at,
          dikirim: o.tanggal_dikirim,
          selesai: o.selesai_at,
        },
        sudahBayar: o.status_bayar === "lunas",
        metodeBayar: o.metode_bayar,
        dikonfirmasiToko: !!o.dikonfirmasi_toko_at,
        buktiTransferUrl: o.bukti_transfer_url || null,
        isDropship: o.is_dropship,
        pengirim: o.nama_pengirim_dropship,
        tujuan: { nama: o.tujuan_nama, telp: o.tujuan_telp, alamat: o.tujuan_alamat },
        total: (o.order_items || []).reduce((sum, it) => sum + Number(it.subtotal_setelah_diskon || 0), 0),
        items: (o.order_items || []).map((it) => ({
          kode: it.products?.kode || it.product_id, nama: it.products?.nama || "Barang", kategori: it.products?.kategori,
          satuan: it.products?.satuan, qty: it.qty, harga: Number(it.harga_satuan),
          hargaDropship: it.harga_dropship ? Number(it.harga_dropship) : null,
          gambarUrl: it.products?.gambar_url || null,
        })),
      }));
      setOrders(mapped);
    } catch (e) {
      console.log("Gagal tarik riwayat order (mode preview?):", e.message);
    }
  }

  // Ambil data toko (dari tabel clients langsung, pakai token sendiri, bukan view publik -
  // toko yang login boleh baca profil lengkap miliknya sendiri) lalu simpan sesi login.
  async function loadTokoAndEnterApp(userId, token, email, refreshToken, overrideClientId, salesIdPembuat) {
    const idUntukDicari = overrideClientId || userId;
    const rows = await supabaseFetch(`clients?select=*&id=eq.${idUntukDicari}`, {}, token);
    if (!rows || rows.length === 0) {
      // Bukan akun toko - cek apakah ini akun SALES (Dashboard) yang mau
      // login buat bantu order-kan toko yang ditanganinya.
      const profilRows = await supabaseFetch(`profiles?select=role,sales_id&id=eq.${userId}`, {}, token);
      const profil = profilRows?.[0];
      if (profil?.role === "sales" && profil?.sales_id) {
        const salesRows = await supabaseFetch(`sales?select=id,nama&id=eq.${profil.sales_id}`, {}, token);
        const salesData = salesRows?.[0];
        const tokoList = await supabaseFetch(`clients?select=id,nama,kode,kota,email&sales_id=eq.${profil.sales_id}&status=eq.aktif&mode_sales_aktif=eq.true&order=nama.asc`, {}, token);
        setSalesInfo2(salesData || { id: profil.sales_id, nama: "Sales" });
        setDaftarTokoSales(tokoList || []);
        setSalesAuthCache({ userId, token, refreshToken, email });
        setShowPilihToko(true);
        setAuthToken(token);
        saveSession({ token, userId, email, refreshToken });
        return true;
      }
      throw new Error("Akun ditemukan tapi profil toko belum ada. Coba daftar ulang.");
    }
    const r = rows[0];
    if (r.status === "pending") {
      setLoginError("Toko Anda masih menunggu persetujuan Owner. Coba login lagi nanti.");
      return false;
    }
    if (r.status === "ditolak") {
      setLoginError("Pendaftaran toko ini ditolak Owner. Hubungi Service Centre untuk info lebih lanjut.");
      return false;
    }
    const tokoData = {
      id: r.id, kode: r.kode, nama: r.nama, alamat: r.alamat, telp: r.telp, kota: r.kota,
      jenisBayar: r.jenis_pembayaran, email: salesIdPembuat ? r.email : email, salesId: r.sales_id || null,
      statusVerifikasi: r.status_verifikasi || "belum_upload",
      fotoTokoUrl: r.foto_toko_url || null, fotoKtpUrl: r.foto_ktp_url || null,
      statusPerubahanVerifikasi: r.status_perubahan_verifikasi || null,
      alasanPerubahanDitolak: r.alasan_perubahan_ditolak || null,
      alasanVerifikasiDitolak: r.alasan_verifikasi_ditolak || null,
      namaOwner: r.nama_owner || null, tanggalLahir: r.tanggal_lahir || null,
      jenisUsaha: r.jenis_usaha || null, provinsi: r.provinsi || null,
      status: r.status || null, noHpDiubahTerakhir: r.no_hp_diubah_terakhir || null,
      dibuatOlehSales: salesIdPembuat || null, namaSalesPembuat: salesIdPembuat ? salesInfo2?.nama : null,
    };
    // Kalau ini mode SALES (termasuk hasil restore refresh yang langsung
    // "lompat" ke toko terakhir) - pastikan daftar toko & cache sales TETAP
    // terisi, supaya nanti kalau klik "Ganti Toko" datanya sudah siap,
    // tidak kosong.
    if (salesIdPembuat && (!salesAuthCache || daftarTokoSales.length === 0)) {
      setSalesAuthCache({ userId, token, refreshToken, email });
      try {
        const salesRows = await supabaseFetch(`sales?select=id,nama&id=eq.${salesIdPembuat}`, {}, token);
        setSalesInfo2(salesRows?.[0] || { id: salesIdPembuat, nama: "Sales" });
        const tokoList = await supabaseFetch(`clients?select=id,nama,kode,kota,email&sales_id=eq.${salesIdPembuat}&status=eq.aktif&mode_sales_aktif=eq.true&order=nama.asc`, {}, token);
        setDaftarTokoSales(tokoList || []);
      } catch (e) { /* diamkan - kalau gagal, nanti dicoba lagi pas klik Ganti Toko */ }
    }
    setToko(tokoData);
    setAuthToken(token);
    setIsGuest(false);
    setShowPilihToko(false);
    setScreen("catalog");
    if (!salesIdPembuat) saveSession({ token, userId, email, refreshToken });
    loadOrderHistory(r.id, token);
    loadPointsData(r.id, token);
    loadSavedAddresses(r.id);
    loadCart(r.id);
    return true;
  }

  // Tarik data poin/checkin/tiket asli dari database (supaya tidak reset ke 0 tiap refresh)
  async function loadPointsData(clientId, token) {
    try {
      const now = new Date();
      const day = now.getDay();
      const sunday = new Date(now); sunday.setDate(now.getDate() - day); sunday.setHours(0, 0, 0, 0);
      const saturday = new Date(sunday); saturday.setDate(sunday.getDate() + 6); saturday.setHours(23, 59, 59, 999);
      const toLocalDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const sundayStr = toLocalDateStr(sunday);
      const saturdayStr = toLocalDateStr(saturday);

      const [checkinRows, ledgerRows, ticketRows] = await Promise.all([
        supabaseFetch(`daily_checkins?select=tanggal,poin&client_id=eq.${clientId}&tanggal=gte.${sundayStr}&tanggal=lte.${saturdayStr}`, {}, token),
        supabaseFetch(`points_ledger?select=poin&client_id=eq.${clientId}`, {}, token),
        supabaseFetch(`spin_tickets?select=id&client_id=eq.${clientId}&dipakai=eq.false`, {}, token),
      ]);

      const claimsMap = {};
      checkinRows.forEach((row) => {
        const d = new Date(row.tanggal + "T00:00:00");
        claimsMap[d.getDay()] = row.poin;
      });
      setDailyClaims(claimsMap);

      const totalPoin = ledgerRows.reduce((sum, r) => sum + Number(r.poin || 0), 0);
      setPointsBalance(totalPoin);

      setSpinTickets(ticketRows.length);
    } catch (e) {
      console.log("Gagal tarik data poin (mode preview?):", e.message);
    }
  }

  async function handleLogin() {
    setLoginError("");
    if (!loginForm.email.trim() || !loginForm.password) {
      setLoginError("Isi dulu email dan password-nya.");
      return;
    }
    setLoggingIn(true);
    try {
      const auth = await supabaseSignIn(loginForm.email.trim(), loginForm.password);
      const ok = await loadTokoAndEnterApp(auth.user.id, auth.access_token, auth.user.email, auth.refresh_token);
      if (!ok) clearSession();
    } catch (e) {
      setLoginError(e.message);
    }
    setLoggingIn(false);
  }

  // SEMENTARA - buat verifikasi Xendit saja. Pengunjung tanpa login
  // otomatis "masuk" sebagai akun demo (bukan cuma browse read-only),
  // supaya bisa coba alur order & pembayaran sungguhan tanpa perlu
  // daftar dulu. HAPUS/KEMBALIKAN fungsi ini ke versi semula (yang cuma
  // setIsGuest(true) tanpa auto-login) setelah verifikasi Xendit selesai.
  async function handleGuestBrowse() {
    setLoginError("");
    setLoggingIn(true);
    try {
      const auth = await supabaseSignIn("demo@indogarudaabadi.com", "DemoXendit2026!");
      const ok = await loadTokoAndEnterApp(auth.user.id, auth.access_token, auth.user.email, auth.refresh_token);
      if (!ok) clearSession();
    } catch (e) {
      // Kalau akun demo belum siap/gagal - tetap fallback ke mode browse biasa
      setToko(null);
      setIsGuest(true);
      setScreen("catalog");
    }
    setLoggingIn(false);
  }

  function handleLogout() {
    clearSession();
    setToko(null);
    setAuthToken(null);
    setIsGuest(false);
    setLoginForm({ email: "", password: "" });
    setLoginError("");
    setCart({});
    setCheckedItems({});
    setUseAltAddress(false);
    setEditingAlt(false);
    setAltAddress({ nama: "", telp: "", alamat: "" });
    setIsDropship(false);
    setDropshipSender("");
    setSalesInfo2(null);
    setDaftarTokoSales([]);
    setShowPilihToko(false);
    setSalesAuthCache(null);
    setScreen("login");
  }

  // Sales pilih 1 toko dari daftar yang ditanganinya - masuk ke app SEPERTI
  // toko itu login sendiri, tapi ditandai "dibuatOlehSales" buat transparansi.
  async function pilihTokoUntukSales(clientId) {
    if (!salesAuthCache) return;
    setLoggingIn(true);
    try {
      await loadTokoAndEnterApp(salesAuthCache.userId, salesAuthCache.token, salesAuthCache.email, salesAuthCache.refreshToken, clientId, salesInfo2?.id);
      // Simpan toko yang dipilih ke sesi - supaya kalau di-refresh, sales
      // TETAP di toko yang sama, tidak balik ke layar pilih toko lagi.
      saveSession({ token: salesAuthCache.token, userId: salesAuthCache.userId, email: salesAuthCache.email, refreshToken: salesAuthCache.refreshToken, selectedClientId: clientId, salesIdPembuat: salesInfo2?.id });
    } catch (e) {
      setLoginError(e.message);
    }
    setLoggingIn(false);
  }

  // Keluar dari toko yang lagi "dipakaikan" sales - balik ke daftar pilih
  // toko lagi (bukan logout total, sesi sales tetap aktif).
  async function keluarDariTokoSales() {
    setToko(null);
    setCart({});
    setCheckedItems({});
    setShowPilihToko(true);
    setScreen("login");
    // Jaga2 - kalau karena suatu sebab daftar toko masih kosong (misal fetch
    // sebelumnya gagal), coba ambil ulang di sini sebelum tampil ke user.
    if (daftarTokoSales.length === 0 && salesAuthCache) {
      try {
        const tokoList = await supabaseFetch(`clients?select=id,nama,kode,kota,email&sales_id=eq.${salesInfo2?.id}&status=eq.aktif&mode_sales_aktif=eq.true&order=nama.asc`, {}, salesAuthCache.token);
        setDaftarTokoSales(tokoList || []);
      } catch (e) { /* diamkan */ }
    }
  }

  // Begitu app dibuka, cek dulu apakah ada sesi login tersimpan (supaya tidak
  // disuruh login ulang tiap refresh halaman). access_token lama mungkin
  // sudah kedaluwarsa (cuma berlaku ±1 jam), jadi selalu refresh dulu pakai
  // refresh_token buat dapat access_token yang segar - begini user tetap
  // login terus sampai benar-benar klik Logout, bukan expired sendiri.
  useEffect(() => {
    // Kalau lagi buka link reset password (dari email), JANGAN restore sesi
    // login lama - biarkan user selesai ganti password dulu, jangan sampai
    // "dipaksa" pindah ke Catalog di tengah proses itu.
    if (window.location.hash.includes("type=recovery") || window.location.hash.includes("error=")) { setRestoringSession(false); return; }

    const session = loadSession();
    if (!session) { setRestoringSession(false); return; }

    // Bedakan error KONEKSI/JARINGAN (misal pas pindah WiFi ke 4G, sinyal
    // sempat putus sesaat) dari error OTENTIKASI ASLI (refresh_token memang
    // sudah tidak valid/dicabut). Cuma error otentikasi asli yang boleh
    // logout - error jaringan harus dicoba ulang, bukan langsung logout.
    function isNetworkError(e) {
      const msg = (e?.message || "").toLowerCase();
      return msg.includes("koneksi terlalu lama") || msg.includes("failed to fetch") || msg.includes("network") || msg.includes("load failed");
    }

    async function restoreWithRefresh(timeoutMs) {
      if (session.refreshToken) {
        const refreshed = await supabaseRefreshToken(session.refreshToken, timeoutMs);
        await loadTokoAndEnterApp(session.userId, refreshed.access_token, session.email, refreshed.refresh_token, session.selectedClientId, session.salesIdPembuat);
        return;
      }
      // Sesi lama (sebelum fitur ini ada) belum punya refresh_token - coba
      // pakai access_token yang tersimpan apa adanya, kalau gagal ya harus login ulang
      await loadTokoAndEnterApp(session.userId, session.token, session.email, undefined, session.selectedClientId, session.salesIdPembuat);
    }

    // Coba sampai 3x kalau penyebabnya error jaringan (jeda singkat di
    // antaranya) - supaya pergantian jaringan sesaat (WiFi ke 4G dsb) bisa
    // "lewat begitu saja" tanpa perlu logout, asal jaringan baru cepat siap.
    // Percobaan PERTAMA pakai batas waktu lebih pendek (4 detik) - soalnya
    // kalau koneksi lama (WiFi) masih "sekarat", lebih baik cepat menyerah &
    // langsung coba lewat jalur baru, daripada nunggu lama-lama di situ.
    async function restoreDenganPercobaanUlang(percobaanKe = 1) {
      try {
        await restoreWithRefresh(percobaanKe === 1 ? 4000 : 6000);
        setRestoringSession(false);
      } catch (e) {
        if (isNetworkError(e) && percobaanKe < 3) {
          setTimeout(() => restoreDenganPercobaanUlang(percobaanKe + 1), 500);
          return;
        }
        if (isNetworkError(e)) {
          // Sudah dicoba 3x tetap gagal karena jaringan - JANGAN hapus sesi
          // (mungkin cuma lagi benar-benar tidak ada sinyal), biarkan user
          // coba lagi manual (refresh halaman) tanpa kehilangan sesi login-nya.
          setRestoringSession(false);
          return;
        }
        // Ini baru error otentikasi asli (refresh_token invalid/dicabut) -
        // baru di titik ini beneran perlu hapus sesi & minta login ulang.
        clearSession();
        setRestoringSession(false);
      }
    }

    restoreDenganPercobaanUlang();
  }, []);

  // Refresh token secara berkala di latar belakang (tiap 45 menit) selama
  // tab dibiarkan terbuka - supaya access_token tidak sempat kedaluwarsa di
  // tengah pemakaian walau tidak pernah reload halaman.
  useEffect(() => {
    if (!toko) return;
    const interval = setInterval(async () => {
      const session = loadSession();
      if (!session?.refreshToken) return;
      try {
        const refreshed = await supabaseRefreshToken(session.refreshToken);
        setAuthToken(refreshed.access_token);
        saveSession({ ...session, token: refreshed.access_token, refreshToken: refreshed.refresh_token });
      } catch (e) {
        console.log("Gagal refresh token di latar belakang:", e.message);
      }
    }, 45 * 60 * 1000);
    return () => clearInterval(interval);
  }, [toko]);


  function addToCart(kode, delta) {
    setCart((prev) => {
      const next = { ...prev };
      const cur = next[kode] || 0;
      const p = productsHargaProvinsi.find((pr) => pr.kode === kode);
      let increment = delta;

      if (p && p.kelipatanOrder > 1) {
        if (isLuarPekanbaru) {
          // Luar Pekanbaru: SETIAP klik +/- selalu loncat sebesar kelipatan,
          // supaya qty selalu tetap dalam kelipatan yang valid.
          increment = delta > 0 ? p.kelipatanOrder : -p.kelipatanOrder;
        } else if (delta > 0 && cur === 0) {
          // Pekanbaru: klik PERTAMA (dari kosong) langsung loncat ke
          // kelipatan sekali saja - abis itu tambah/kurang normal 1-1.
          increment = p.kelipatanOrder;
        }
      }

      const updated = Math.max(0, cur + increment);
      if (updated === 0) delete next[kode];
      else next[kode] = updated;
      return next;
    });
  }

  function setCartQty(kode, qty) {
    setCart((prev) => {
      const next = { ...prev };
      const clean = Math.max(0, Math.floor(Number(qty)) || 0);
      if (clean === 0) delete next[kode];
      else next[kode] = clean;
      return next;
    });
  }

  // Simpan alamat yang baru diisi ke daftar alamat tersimpan (kalau belum ada persis sama)
  async function saveCurrentAddress() {
    const exists = savedAddresses.some((a) => a.telp === altAddress.telp && a.alamat === altAddress.alamat);
    if (!exists && altAddress.alamat.trim()) {
      try {
        const [inserted] = await supabaseFetch("alamat_tersimpan", {
          method: "POST",
          body: JSON.stringify({
            client_id: toko.id, nama: altAddress.nama, telp: altAddress.telp, alamat: altAddress.alamat,
            provinsi: altAddress.provinsi, kota: altAddress.kota, kecamatan: altAddress.kecamatan,
            kelurahan: altAddress.kelurahan, kode_pos: altAddress.kodePos,
          }),
        });
        setSavedAddresses((prev) => [{ ...altAddress, id: inserted.id }, ...prev]);
      } catch (e) {
        alert("Gagal simpan alamat: " + e.message);
      }
    }
    setEditingAlt(false);
  }

  function pickSavedAddress(addr) {
    setAltAddress({
      nama: addr.nama || "", telp: addr.telp || "", alamat: addr.alamat || "",
      provinsi: addr.provinsi || "", provinsiId: addr.provinsiId || "",
      kota: addr.kota || "", kotaId: addr.kotaId || "",
      kecamatan: addr.kecamatan || "", kecamatanId: addr.kecamatanId || "",
      kelurahan: addr.kelurahan || "", kodePos: addr.kodePos || "",
    });
    setEditingAlt(false);
  }

  function handleToggleDropship(checked) {
    setIsDropship(checked);
    if (checked && !dropshipSender) {
      setDropshipSender(savedSenderNames[0] || toko?.nama || "");
    }
  }

  async function submitOrder() {
    if (toko.statusVerifikasi !== "terverifikasi") {
      alert("Toko Anda belum terverifikasi. Silakan upload foto toko & KTP dulu di menu Akun > Foto Toko, dan tunggu persetujuan Owner sebelum bisa order.");
      return;
    }
    if (belowMinimum) return; // jaga-jaga, tombol sudah dinonaktifkan di UI
    const items = Object.entries(cart)
      .filter(([kode]) => checkedItems[kode] !== false)
      .map(([kode, qty]) => {
        const p = productsHargaProvinsi.find((x) => x.kode === kode);
        return { ...p, qty };
      });
    // Mode Sales - PAKSA pakai alamat toko terdaftar, abaikan alamat
    // alternatif apapun (jaga2 lapis kedua, walau tombolnya sudah
    // disembunyikan di UI) - supaya barang tidak bisa "dialihkan" ke
    // alamat lain pakai identitas toko yang tidak sadar apa-apa.
    const pakaiAltAddress = useAltAddress && !toko?.dibuatOlehSales;
    const tujuan = pakaiAltAddress
      ? {
          nama: altAddress.nama || toko.nama, telp: altAddress.telp,
          alamat: altAddress.kota
            ? `${altAddress.alamat}, ${altAddress.kelurahan}, ${altAddress.kecamatan}, ${altAddress.kota}, ${altAddress.provinsi} ${altAddress.kodePos}`
            : altAddress.alamat,
          kota: altAddress.kota || toko.kota,
        }
      : { nama: toko.nama, telp: toko.telp, alamat: toko.alamat, kota: toko.kota };
    const itemsWithDropship = items.map((it) => ({
      ...it,
      // Harga dropship SEKARANG OTOMATIS dari harga per provinsi (sudah
      // ikut di it.harga/harga_satuan) - tidak perlu override manual lagi.
      hargaDropship: null,
    }));

    // Nomor Nota SELALU diambil dari database (supaya tidak bentrok antar toko) -
    // kode di bawah cuma dipakai fallback kalau memang toko sedang mode tanpa database.
    let noNota = "NOTA-" + String(1000 + orders.length + 1).slice(1);
    let insertedOrderId = null; // diisi kalau berhasil simpan ke database - dipakai supaya order lokal (di state) langsung punya dbId, tanpa perlu refresh dulu buat bisa upload bukti transfer

    // Poin toko TIDAK PERNAH dipakai kalau order ini dibuatkan sales (jaga2
    // walau UI-nya sudah disembunyikan, ini lapis pengaman tambahan).
    const poinDipakaiValid = (!toko?.dibuatOlehSales && poinDipakai >= 5000) ? poinDipakai : 0;

    if (toko.id) {
      try {
        const [insertedOrder] = await supabaseFetch("orders", {
          method: "POST",
          body: JSON.stringify({
            client_id: toko.id,
            sales_id: toko.salesId,
            channel: "web",
            status: "menunggu_persetujuan",
            status_bayar: "belum_lunas",
            is_dropship: isDropship,
            nama_pengirim_dropship: isDropship ? dropshipSender : null,
            tujuan_nama: tujuan.nama,
            tujuan_telp: tujuan.telp,
            tujuan_alamat: tujuan.alamat,
            tujuan_kota: tujuan.kota,
            metode_bayar: metodeBayar,
            dibuat_oleh_sales: toko?.dibuatOlehSales || null,
            ...(poinDipakaiValid > 0 ? {
              diskon_tambahan_jenis: "rupiah",
              diskon_tambahan_nilai: poinDipakaiValid,
              diskon_tambahan_keterangan: `Potongan dari ${poinDipakaiValid.toLocaleString("id-ID")} poin`,
            } : {}),
          }),
        }, authToken);
        noNota = insertedOrder.no_nota; // pakai nomor resmi dari database
        insertedOrderId = insertedOrder.id;
        // Potongan poin dikurangkan LANGSUNG dari subtotal item (bukan cuma
        // dicatat terpisah di kolom diskon_tambahan_nilai) - supaya total
        // order di MANAPUN dihitung (Dashboard, trigger pembayaran, dll -
        // yang semuanya jumlahkan order_items.subtotal_setelah_diskon)
        // otomatis sudah benar, tidak perlu diubah satu-satu di banyak
        // tempat. Dikurangkan berurutan dari item pertama sampai habis.
        let sisaPotonganPoin = poinDipakaiValid;
        await supabaseFetch("order_items", {
          method: "POST",
          body: JSON.stringify(
            itemsWithDropship.map((it) => {
              const subtotalAsli = hitungRincianItem(it, it.qty).totalSetelahDiskon;
              const potongItemIni = Math.min(sisaPotonganPoin, subtotalAsli);
              sisaPotonganPoin -= potongItemIni;
              return {
                order_id: insertedOrder.id,
                product_id: it.id,
                qty: it.qty,
                harga_satuan: it.harga,
                kena_diskon_koli: false, // diskon koli sudah dinonaktifkan sepenuhnya
                subtotal_setelah_diskon: subtotalAsli - potongItemIni,
                harga_dropship: it.hargaDropship,
              };
            })
          ),
        }, authToken);

        // Kurangi saldo poin toko kalau tadi pakai potongan poin - dicatat
        // sebagai baris NEGATIF di points_ledger (jenis 'redeem')
        if (poinDipakaiValid > 0) {
          try {
            await supabaseFetch("points_ledger", {
              method: "POST",
              body: JSON.stringify({
                client_id: toko.id, poin: -poinDipakaiValid, sumber: "redeem",
                keterangan: `Dipakai buat potongan order ${noNota}`,
              }),
            }, authToken);
            setPointsBalance((prev) => prev - poinDipakaiValid);
            setPoinDipakai(0);
          } catch (e) {
            console.log("Gagal catat pengurangan poin:", e.message);
          }
        }
      } catch (e) {
        console.log("Gagal simpan order ke database asli (mode preview?):", e.message);
      }
    }

    const order = {
      id: noNota, dbId: insertedOrderId, tanggal: new Date(), items: itemsWithDropship, total: cartTotal,
      status: "Menunggu Persetujuan", tujuan, isDropship, metodeBayar,
      pengirim: isDropship ? dropshipSender : null,
      sudahBayar: toko.jenisBayar === "Tunai",
    };
    setOrders((prev) => [order, ...prev]);

    // simpan nama pengirim ke riwayat supaya bisa dipilih lagi lain kali
    if (isDropship && dropshipSender.trim() && !savedSenderNames.includes(dropshipSender.trim())) {
      setSavedSenderNames((prev) => [dropshipSender.trim(), ...prev]);
    }

    setCart({});
    setCheckedItems({});
    setUseAltAddress(false);
    setEditingAlt(false);
    setAltAddress({ nama: "", telp: "", alamat: "" });
    setIsDropship(false);
    setMetodeBayar("transfer");
    setScreen("success");
  }

  // Salin order lama ke keranjang supaya bisa order ulang tanpa pilih barang dari awal
  function openReorderPreview(order) {
    setReorderPreview(order);
    setScreen("reorder-confirm");
  }

  function confirmReorder(order) {
    const next = {};
    order.items.forEach((it) => { next[it.kode] = it.qty; });
    setCart(next);
    setCheckedItems({});
    setScreen("cart");
  }

  // Simulasi progres status pesanan (dipakai di prototipe ini karena belum tersambung backend)
  async function advanceOrderStatus(orderId, nextStatus) {
    const order = orders.find((o) => o.id === orderId);
    // Konfirmasi Penerimaan dari toko TIDAK langsung menyelesaikan order DI
    // DATABASE - status ASLI tetap "proses_dikirim" sampai Owner benar-benar
    // selesaikan lewat Dashboard (supaya Owner tetap bisa review dokumen
    // pengiriman dulu). TAPI di sisi TAMPILAN toko, biar terlihat simpel,
    // status langsung ditampilkan "Selesai" begitu mereka konfirmasi.
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "Selesai", dikonfirmasiToko: true } : o)));
    if (order?.dbId) {
      try {
        await supabaseFetch(`orders?id=eq.${order.dbId}`, {
          method: "PATCH",
          body: JSON.stringify({ dikonfirmasi_toko_at: new Date().toISOString() }),
        }, authToken);
      } catch (e) {
        console.log("Gagal simpan konfirmasi penerimaan ke database:", e.message);
      }
    }
  }
  function markOrderPaid(orderId) {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, sudahBayar: true } : o)));
  }

  // Toko membatalkan sendiri order yang belum dibayar
  async function cancelOrder(order) {
    if (!order.dbId) return;
    try {
      await supabaseFetch(`orders?id=eq.${order.dbId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "ditolak", alasan_dibatalkan: "Dibatalkan oleh toko" }),
      }, authToken);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: "Dibatalkan", alasanDibatalkan: "Dibatalkan oleh toko" } : o)));
    } catch (e) {
      alert("Gagal membatalkan pesanan: " + e.message);
    }
  }

  // Upload file bukti transfer ke Supabase Storage, lalu simpan link-nya ke order tsb.
  async function uploadBuktiTransfer(order, file) {
    if (!order.dbId || !file) return;
    const compressed = await compressImage(file);
    const { ext, contentType } = infoFileTerkompresi(compressed, file);
    const filePath = `${order.dbId}-${Date.now()}.${ext}`;
    try {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/bukti-transfer/${filePath}`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${authToken || SUPABASE_ANON_KEY}`,
          "Content-Type": contentType,
        },
        body: compressed,
      });
      if (!res.ok) throw new Error(await res.text());
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/bukti-transfer/${filePath}`;
      await supabaseFetch(`orders?id=eq.${order.dbId}`, {
        method: "PATCH",
        body: JSON.stringify({ bukti_transfer_url: publicUrl }),
      }, authToken);
      setOrders((prev) => prev.map((o) => (o.dbId === order.dbId ? { ...o, buktiTransferUrl: publicUrl } : o)));
      return true;
    } catch (e) {
      alert("Gagal upload bukti transfer: " + e.message);
      return false;
    }
  }

  const randBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  // Klaim poin harian. Hari: 0=Minggu, 1=Senin, ..., 6=Sabtu.
  // Sabtu = hari spesial: 500-1000 poin kalau Minggu-Jumat (0-5) full diklaim,
  // kalau tidak full (ada yang miss), Sabtu cuma dapat 100-500.
  // Hari biasa (Minggu-Jumat): random 10-50 poin.
  async function claimDailyPoint() {
    const today = new Date().getDay(); // 0-6
    if (dailyClaims[today] !== undefined) return; // sudah diklaim hari ini
    if (!toko?.id) return;

    let earned;
    if (today === 6) {
      const weekdaysFullyClaimed = [0, 1, 2, 3, 4, 5].every((d) => dailyClaims[d] !== undefined);
      earned = weekdaysFullyClaimed ? randBetween(500, 1000) : randBetween(100, 500);
    } else {
      earned = randBetween(10, 50);
    }

    // PENTING: pakai tanggal LOKAL (bukan toISOString() yang otomatis geser
    // ke UTC) - supaya "hari ini" di database selalu cocok dengan "hari ini"
    // di jam HP pengguna, tidak geser di waktu-waktu tertentu (misal malam hari).
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    try {
      await supabaseFetch("daily_checkins", {
        method: "POST",
        body: JSON.stringify({ client_id: toko.id, tanggal: todayStr, poin: earned }),
      }, authToken);
      await supabaseFetch("points_ledger", {
        method: "POST",
        body: JSON.stringify({ client_id: toko.id, poin: earned, sumber: "checkin", keterangan: `Check-in harian` }),
      }, authToken);
      setDailyClaims((prev) => ({ ...prev, [today]: earned }));
      setPointsBalance((prev) => prev + earned);
    } catch (e) {
      if (e.message.includes("23505") || e.message.includes("duplicate key")) {
        // Sudah pernah diklaim hari ini (kemungkinan klik dobel atau sesi
        // beda perangkat) - tandai saja sebagai sudah diklaim, jangan
        // munculkan error yang membingungkan.
        setDailyClaims((prev) => ({ ...prev, [today]: prev[today] ?? 0 }));
        alert("Poin hari ini sudah pernah diklaim sebelumnya.");
      } else {
        alert("Gagal simpan poin, coba lagi: " + e.message);
      }
    }
  }

  // Pakai 1 tiket, hasil poin dari roda (150/250/350/500) sudah ditentukan sebelumnya
  // oleh PoinScreen (dipilih acak di sana untuk animasi berhenti di segmen yang tepat).
  async function spinWheel(wonPoints) {
    if (spinTickets <= 0 || !toko?.id) return;
    try {
      const tickets = await supabaseFetch(`spin_tickets?select=id&client_id=eq.${toko.id}&dipakai=eq.false&limit=1`, {}, authToken);
      if (!tickets || tickets.length === 0) return;
      await supabaseFetch(`spin_tickets?id=eq.${tickets[0].id}`, {
        method: "PATCH",
        body: JSON.stringify({ dipakai: true, hasil_poin: wonPoints }),
      }, authToken);
      await supabaseFetch("points_ledger", {
        method: "POST",
        body: JSON.stringify({ client_id: toko.id, poin: wonPoints, sumber: "lucky_wheel", keterangan: "Lucky Wheel" }),
      }, authToken);
      setSpinTickets((prev) => prev - 1);
      setPointsBalance((prev) => prev + wonPoints);
    } catch (e) {
      alert("Gagal simpan hasil spin: " + e.message);
    }
  }

  // TAHAP 1 - buat akun auth, kirim kode OTP ke email untuk verifikasi
  // dulu, BELUM insert ke tabel clients (belum masuk antrian approval Owner).
  async function submitRegistration() {
    setRegError("");
    setRegLoading(true);
    try {
      const auth = await supabaseSignUp(regForm.email.trim(), regForm.password);
      setRegAuthSementara(auth);

      const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: regForm.email.trim(), create_user: false }),
      });
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (e) {}
      if (!res.ok) throw new Error(data.msg || data.error_description || `Gagal kirim kode verifikasi (status ${res.status}).`);

      setRegStep("otp");
    } catch (e) {
      setRegError(e.message || "Gagal daftar. Coba lagi.");
    }
    setRegLoading(false);
  }

  // TAHAP 2 - verifikasi kode OTP yang dimasukkan, kalau BENAR baru insert
  // ke tabel clients (status pending, masuk ke Owner buat di-approve).
  async function verifikasiOtpRegistrasi() {
    if (!regOtpKode.trim()) {
      setRegError("Masukkan dulu kode yang dikirim ke email Anda.");
      return;
    }
    setRegError("");
    setRegLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: regForm.email.trim(), token: regOtpKode.trim(), type: "email" }),
      });
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (e) {}
      if (!res.ok) throw new Error(data.msg || data.error_description || "Kode salah atau sudah kedaluwarsa.");

      const auth = regAuthSementara;
      await supabaseFetch("clients", {
        method: "POST",
        body: JSON.stringify({
          id: auth.user.id, // samakan dengan akun Supabase Auth-nya
          email: regForm.email.trim(),
          nama: regForm.nama,
          alamat: `${regForm.alamat}, ${regForm.kelurahan}, ${regForm.kecamatan}, ${regForm.kota}, ${regForm.provinsi} ${regForm.kodePos}`,
          telp: regForm.telp,
          jenis_pembayaran: "Transfer",
          kota: regForm.kota,
          provinsi: regForm.provinsi,
          nama_owner: regForm.namaOwner || null,
          tanggal_lahir: regForm.tanggalLahir || null,
          jenis_usaha: regForm.jenisUsaha || null,
          status: "pending",
          // kode TIDAK diisi -> otomatis dibuatkan nomor berikutnya oleh database
        }),
      }, auth.access_token);
      setRegSubmitted(true);
    } catch (e) {
      setRegError(e.message || "Gagal verifikasi. Coba lagi.");
    }
    setRegLoading(false);
  }

  const filteredProducts = productsHargaProvinsi.filter((p) => {
    const matchCategory = activeCategory === "Semua" || p.kategori === activeCategory;
    const matchSearch = p.nama.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });
  // Daftar kategori dihitung dari SEMUA produk aktif (bukan yang sudah
  // kefilter kategori), supaya tab kategori lain tidak hilang begitu salah
  // satu kategori dipilih. Kategori yang produk aktifnya 0 otomatis tidak muncul.
  const availableCategories = ["Semua", ...Array.from(new Set(products.map((p) => p.kategori).filter(Boolean)))];

  if (screen === "reset-password-form") {
    return <ResetPasswordFormScreen recoveryToken={recoveryToken} recoveryLinkError={recoveryLinkError} onDone={() => { window.location.hash = ""; setScreen("login"); }} />;
  }

  if (maintenanceInfo?.aktif) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#24272B", padding: 32, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#FBF0D9", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
          <RefreshCw size={30} color="#8A6A1A" />
        </div>
        <h2 className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: "0 0 10px" }}>Sedang Maintenance</h2>
        <p style={{ color: "#9CA0A6", fontSize: 13.5, lineHeight: 1.6, maxWidth: 320 }}>
          {maintenanceInfo.pesan || "Sistem sedang dalam pemeliharaan. Mohon tunggu sebentar, halaman akan otomatis refresh setelah selesai."}
        </p>
      </div>
    );
  }

  if (restoringSession) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#24272B" }}>
        <p style={{ color: "#9CA0A6", fontSize: 13 }}>Memuat...</p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: "#F7F5F1", minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative", paddingBottom: screen === "catalog" || screen === "cart" || screen === "history" ? 72 : 0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .disp { font-family: 'Barlow Condensed', sans-serif; letter-spacing: 0.01em; }
        button { font-family: inherit; cursor: pointer; }
        input, select { font-family: inherit; }
        ::selection { background: #E8A426; color: #24272B; }
      `}</style>

      {updateTersedia && (
        <div style={{ position: "fixed", bottom: 16, left: 16, right: 16, maxWidth: 448, margin: "0 auto", zIndex: 300, background: "#24272B", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 4px 16px rgba(0,0,0,0.25)" }}>
          <RefreshCw size={18} color="#E8A426" style={{ flexShrink: 0 }} />
          <p style={{ flex: 1, fontSize: 12.5, color: "#fff", margin: 0, lineHeight: 1.4 }}>Ada update terbaru tersedia.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: "#E8A426", color: "#24272B", fontSize: 12, fontWeight: 700, flexShrink: 0 }}
          >
            Refresh
          </button>
        </div>
      )}

      {toko?.dibuatOlehSales && screen !== "login" && screen !== "register" && (
        <div style={{ position: "sticky", top: 0, zIndex: 200, background: "#24272B", color: "#fff", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 11.5 }}>
          <span>🎧 Mode Sales - Order untuk <strong>{toko.nama}</strong></span>
          <button onClick={keluarDariTokoSales} style={{ background: "#E8A426", border: "none", color: "#24272B", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, flexShrink: 0 }}>
            Ganti Toko
          </button>
        </div>
      )}

      {campaignVisible && campaignBanner?.aktif && campaignBanner?.gambar_url && screen !== "login" && screen !== "register" && screen !== "campaign-detail" && (
        <FloatingCampaignWidget
          imageUrl={campaignBanner.gambar_url}
          onClose={() => setCampaignVisible(false)}
          onOpenDetail={() => { setCampaignReturnScreen(screen); setScreen("campaign-detail"); }}
        />
      )}

      {screen === "login" && !showPilihToko && (
        <LoginScreen
          form={loginForm} setForm={setLoginForm}
          loginError={loginError} onLogin={handleLogin} loading={loggingIn}
          onGoRegister={() => setScreen("register")}
          onGuestBrowse={handleGuestBrowse}
        />
      )}

      {screen === "login" && showPilihToko && (
        <PilihTokoScreen
          salesInfo={salesInfo2} daftarToko={daftarTokoSales}
          token={salesAuthCache?.token}
          onPilih={pilihTokoUntukSales} loading={loggingIn}
          onLogout={handleLogout}
        />
      )}

      {screen === "register" && (
        <RegisterScreen
          regForm={regForm} setRegForm={setRegForm}
          submitted={regSubmitted} onSubmit={submitRegistration}
          error={regError} loading={regLoading}
          regStep={regStep} regOtpKode={regOtpKode} setRegOtpKode={setRegOtpKode}
          onVerifikasiOtp={verifikasiOtpRegistrasi}
          onBack={() => { setScreen("login"); setRegSubmitted(false); setRegError(""); setRegStep("form"); setRegOtpKode(""); setRegForm({ email: "", password: "", nama: "", alamat: "", telp: "", jenisBayar: "Transfer", tempo: "0", provinsi: "", provinsiId: "", kota: "", kotaId: "", kecamatan: "", kecamatanId: "", kelurahan: "", kodePos: "" }); }}
        />
      )}

      {screen === "catalog" && (
        <CatalogScreen
          toko={toko} isGuest={isGuest}
          products={filteredProducts}
          productsLoading={productsLoading}
          dbError={dbError} onRetry={loadProducts}
          availableCategories={availableCategories}
          activeCategory={activeCategory} setActiveCategory={setActiveCategory}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          cart={cart} addToCart={addToCart}
          onOpenProduct={(p) => { setSelectedProduct(p); setScreen("product"); }}
          onRequireLogin={() => setScreen("login")}
          onOpenChat={() => setScreen("cs-chat-choice")}
          onOpenNotifikasi={() => setScreen("notifikasi")}
          showInstallButton={!isStandalone && (installPromptEvent || isIOS)}
          isIOS={isIOS}
          onInstallClick={handleInstallClick}
        />
      )}

      {screen === "notifikasi" && (
        <NotifikasiScreen toko={toko} onBack={() => setScreen("catalog")} />
      )}

      {screen === "cs-chat-choice" && (
        <CsChatChoiceScreen
          toko={toko}
          onBack={() => setScreen("catalog")}
          onContactCS={() => { setCsReturnScreen("cs-chat-choice"); setScreen("akun-cs"); }}
          products={productsHargaProvinsi} orders={orders} cart={cart} rincian={cartRincian}
        />
      )}

      {screen === "product" && selectedProduct && (
        <ProductScreen
          product={selectedProduct} qty={cart[selectedProduct.kode] || 0}
          isGuest={isGuest}
          cartCount={Object.values(cart).reduce((a, b) => a + b, 0)}
          onChangeQty={(delta) => addToCart(selectedProduct.kode, delta)}
          onSetQty={(qty) => setCartQty(selectedProduct.kode, qty)}
          onBack={() => setScreen("catalog")}
          onGoToCart={() => setScreen("cart")}
          onRequireLogin={() => setScreen("login")}
        />
      )}

      {screen === "cart" && (
        <CartScreen
          toko={toko}
          useAltAddress={useAltAddress} setUseAltAddress={setUseAltAddress}
          editingAlt={editingAlt} setEditingAlt={setEditingAlt}
          altAddress={altAddress} setAltAddress={setAltAddress}
          savedAddresses={savedAddresses} onSaveAddress={saveCurrentAddress} onPickAddress={pickSavedAddress}
          isDropship={isDropship} setIsDropship={handleToggleDropship}
          dropshipSender={dropshipSender} setDropshipSender={setDropshipSender} savedSenderNames={savedSenderNames}
          cart={cart} products={productsHargaProvinsi} rincian={cartRincian} belowMinimum={belowMinimum}
          isLuarPekanbaru={isLuarPekanbaru} itemBelumMinimalOrder={itemBelumMinimalOrder}
          metodeBayar={metodeBayar} setMetodeBayar={setMetodeBayar}
          checkedItems={checkedItems} setCheckedItems={setCheckedItems}
          addToCart={addToCart} setCartQty={setCartQty}
          onBack={() => setScreen("catalog")}
          onCheckout={() => setScreen("konfirmasi-pembelian")}
        />
      )}

      {screen === "konfirmasi-pembelian" && (
        <KonfirmasiPembelianScreen
          rincian={cartRincian} metodeBayar={metodeBayar}
          toko={toko} useAltAddress={useAltAddress} altAddress={altAddress}
          cart={cart} products={productsHargaProvinsi} checkedItems={checkedItems}
          pointsBalance={pointsBalance} poinDipakai={poinDipakai} setPoinDipakai={setPoinDipakai}
          onBack={() => setScreen("cart")}
          onSubmit={submitOrder}
        />
      )}

      {screen === "success" && (
        <SuccessScreen order={orders[0]} onDone={() => setScreen("catalog")} onHistory={() => setScreen("history")} />
      )}

      {screen === "history" && (
        <HistoryScreen orders={orders} onBack={() => setScreen("catalog")} toko={toko} />
      )}

      {screen === "akun" && (
        <AccountScreen
          toko={toko} orders={orders}
          onOpenOrderUlang={() => setScreen("order-ulang-list")}
          onMarkPaid={markOrderPaid}
          pointsBalance={pointsBalance}
          onOpenRekening={() => setScreen("akun-rekening")}
          onOpenCS={() => { setCsReturnScreen("akun"); setScreen("akun-cs"); }}
          onOpenBantuan={() => setScreen("akun-bantuan")}
          onOpenPoin={() => setScreen("akun-poin")}
          onOpenOrderList={(key) => { setOrderListKey(key); setScreen("akun-orderlist"); }}
          onOpenSaldo={() => setScreen("akun-saldo")}
          onOpenVerifikasi={() => setScreen("akun-verifikasi")}
          onOpenInfoAkun={() => setScreen("akun-info")}
          onLogout={handleLogout}
        />
      )}

      {screen === "akun-info" && (
        <InformasiAkunScreen
          toko={toko}
          onBack={() => setScreen("akun")}
          onOpenAlamat={() => setScreen("akun-alamat")}
          onOpenTentang={() => setScreen("akun-tentang")}
          onUpdated={(updates) => setToko((prev) => ({ ...prev, ...updates }))}
        />
      )}

      {screen === "akun-alamat" && (
        <DaftarAlamatScreen
          toko={toko}
          savedAddresses={savedAddresses}
          setSavedAddresses={setSavedAddresses}
          onBack={() => setScreen("akun-info")}
        />
      )}

      {screen === "akun-tentang" && (
        <TentangScreen toko={toko} onBack={() => setScreen("akun-info")} />
      )}

      {screen === "akun-saldo" && (
        <SaldoScreen toko={toko} onBack={() => setScreen("akun")} />
      )}

      {screen === "akun-verifikasi" && (
        <VerifikasiTokoScreen
          toko={toko}
          authToken={authToken}
          onBack={() => setScreen("akun")}
          onUpdated={(updates) => setToko((prev) => ({ ...prev, ...updates }))}
        />
      )}

      {screen === "akun-orderlist" && (
        <OrderListScreen
          filterKey={orderListKey} toko={toko} orders={orders}
          onAdvance={advanceOrderStatus} onUploadBukti={uploadBuktiTransfer} onCancelOrder={cancelOrder}
          onBack={() => setScreen("akun")}
        />
      )}

      {screen === "order-ulang-list" && (
        <OrderUlangListScreen
          orders={orders}
          onReorder={openReorderPreview}
          onBack={() => setScreen("akun")}
        />
      )}

      {screen === "reorder-confirm" && reorderPreview && (
        <ReorderConfirmScreen
          order={reorderPreview}
          onConfirm={() => confirmReorder(reorderPreview)}
          onBack={() => setScreen("order-ulang-list")}
        />
      )}

      {screen === "akun-rekening" && (
        <RekeningScreen toko={toko} onBack={() => setScreen("akun")} />
      )}
      {screen === "akun-cs" && (
        <ServiceCentreScreen onBack={() => setScreen(csReturnScreen)} />
      )}
      {screen === "akun-bantuan" && (
        <BantuanScreen onBack={() => setScreen("akun")} />
      )}
      {screen === "campaign-detail" && (
        <CampaignDetailScreen
          onBack={() => setScreen(campaignReturnScreen)}
          cartCount={Object.values(cart).reduce((a, b) => a + b, 0)}
          onGoToCart={() => setScreen("cart")}
          judul={campaignBanner?.judul}
          deskripsi={campaignBanner?.deskripsi}
        />
      )}
      {screen === "akun-poin" && (
        <PoinScreen
          pointsBalance={pointsBalance} dailyClaims={dailyClaims}
          onClaim={claimDailyPoint}
          spinTickets={spinTickets} onSpin={spinWheel}
          onBack={() => setScreen("akun")}
        />
      )}

      {(screen === "catalog" || screen === "cart" || screen === "history" || screen === "akun") && (
        <BottomNav
          screen={screen} cartCount={cartCount} isGuest={isGuest}
          onCatalog={() => setScreen("catalog")}
          onCart={() => setScreen("cart")}
          onHistory={() => setScreen("history")}
          onAkun={() => setScreen("akun")}
          onRequireLogin={() => setScreen("login")}
        />
      )}
    </div>
  );
}

// ============================================================
// LOGIN
// ============================================================
// ============================================================
// FORM RESET PASSWORD - dibuka dari link email reset password
// ============================================================
function ResetPasswordFormScreen({ recoveryToken, recoveryLinkError, onDone }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [checkingUsed, setCheckingUsed] = useState(true);
  const [alreadyUsed, setAlreadyUsed] = useState(false);
  const [formExpired, setFormExpired] = useState(false);

  const BATAS_WAKTU_FORM_DETIK = 5 * 60; // 5 menit sejak halaman dibuka

  useEffect(() => {
    const timer = setTimeout(() => setFormExpired(true), BATAS_WAKTU_FORM_DETIK * 1000);
    return () => clearTimeout(timer);
  }, []);

  // Hash sederhana buat jadikan token panjang jadi kode pendek unik (tidak
  // perlu simpan token asli di database, cukup "sidik jari"-nya saja)
  function hashToken(token) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash << 5) - hash + token.charCodeAt(i);
      hash |= 0;
    }
    return "h" + Math.abs(hash).toString(36) + token.length;
  }

  useEffect(() => {
    if (!recoveryToken) { setCheckingUsed(false); return; }
    const hash = hashToken(recoveryToken);
    fetch(`${SUPABASE_URL}/functions/v1/cek-token-reset`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ token_hash: hash, action: "check" }),
    })
      .then((r) => r.json())
      .then((data) => setAlreadyUsed(!!data.used))
      .catch(() => setAlreadyUsed(true)) // GAGAL-TERTUTUP: kalau gagal cek, anggap mencurigakan & blokir, bukan izinkan
      .finally(() => setCheckingUsed(false));
  }, [recoveryToken]);

  async function submit() {
    if (formExpired) return; // jaga-jaga, tombol sudah tidak tampil kalau ini true
    setError("");
    if (!password || password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${recoveryToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || data.error_description || "Gagal ubah password. Link mungkin sudah kedaluwarsa.");

      // Tandai link ini sudah dipakai lewat Edge Function (pasti berhasil,
      // tidak seperti insert langsung yang gagal diam-diam karena RLS)
      const markRes = await fetch(`${SUPABASE_URL}/functions/v1/cek-token-reset`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ token_hash: hashToken(recoveryToken), action: "mark" }),
      });
      if (!markRes.ok) {
        console.log("Gagal tandai token reset sebagai sudah dipakai - ini celah keamanan, cek Edge Function");
      }

      setSuccess(true);
    } catch (e) {
      setError(e.message);
    }
    setSubmitting(false);
  }

  const inputStyle = { width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E4E1DA", fontSize: 14, outline: "none", marginBottom: 12 };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F5F1", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 380, padding: 28 }}>
        {checkingUsed ? (
          <p style={{ textAlign: "center", fontSize: 13, color: "#9CA0A6" }}>Memeriksa link...</p>
        ) : recoveryLinkError ? (
          <>
            <h1 className="disp" style={{ fontSize: 20, fontWeight: 700, color: "#C0392B", margin: "0 0 10px" }}>Link Sudah Tidak Berlaku</h1>
            <p style={{ fontSize: 13, color: "#6B6F75", lineHeight: 1.6 }}>
              Link ini sudah pernah dipakai atau sudah kedaluwarsa. Silakan minta link baru dari menu Informasi Akun kalau masih perlu ganti password.
            </p>
          </>
        ) : !recoveryToken ? (
          <>
            <h1 className="disp" style={{ fontSize: 20, fontWeight: 700, color: "#C0392B", margin: "0 0 10px" }}>Link Tidak Valid</h1>
            <p style={{ fontSize: 13, color: "#6B6F75", lineHeight: 1.6 }}>
              Link reset password ini tidak valid atau sudah kedaluwarsa. Silakan minta link baru dari menu Informasi Akun.
            </p>
          </>
        ) : alreadyUsed ? (
          <>
            <h1 className="disp" style={{ fontSize: 20, fontWeight: 700, color: "#C0392B", margin: "0 0 10px" }}>Link Sudah Dipakai</h1>
            <p style={{ fontSize: 13, color: "#6B6F75", lineHeight: 1.6 }}>
              Link reset password ini sudah pernah digunakan sebelumnya. Setiap link cuma berlaku sekali - silakan minta link baru dari menu Informasi Akun kalau masih perlu ganti password.
            </p>
          </>
        ) : formExpired && !success ? (
          <>
            <h1 className="disp" style={{ fontSize: 20, fontWeight: 700, color: "#C0392B", margin: "0 0 10px" }}>Link Sudah Tidak Berlaku</h1>
            <p style={{ fontSize: 13, color: "#6B6F75", lineHeight: 1.6 }}>
              Waktu untuk ganti password sudah habis. Silakan minta link baru dari menu Informasi Akun.
            </p>
          </>
        ) : success ? (
          <>
            <h1 className="disp" style={{ fontSize: 20, fontWeight: 700, color: "#28685D", margin: "0 0 10px" }}>Password Berhasil Diubah</h1>
            <p style={{ fontSize: 13, color: "#6B6F75", lineHeight: 1.6, marginBottom: 20 }}>
              Silakan login kembali menggunakan password baru Anda.
            </p>
            <button onClick={onDone} style={{ width: "100%", padding: 13, borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 14 }}>
              Ke Halaman Login
            </button>
          </>
        ) : (
          <>
            <h1 className="disp" style={{ fontSize: 20, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>Buat Password Baru</h1>
            <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 20px" }}>Masukkan password baru untuk akun Anda.</p>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password baru (min. 6 karakter)" style={inputStyle} />
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Konfirmasi password baru" style={inputStyle} />
            {error && <p style={{ fontSize: 12, color: "#C0392B", margin: "0 0 12px" }}>{error}</p>}
            <button onClick={submit} disabled={submitting} style={{ width: "100%", padding: 13, borderRadius: 10, border: "none", background: submitting ? "#E4E1DA" : "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 14 }}>
              {submitting ? "Menyimpan..." : "Simpan Password Baru"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function LoginScreen({ form, setForm, loginError, onLogin, loading, onGoRegister, onGuestBrowse }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "32px 28px", background: "#24272B" }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ width: 52, height: 52, background: "#E8A426", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Package size={28} color="#24272B" strokeWidth={2.2} />
        </div>
        <h1 className="disp" style={{ color: "#FFFFFF", fontSize: 36, fontWeight: 700, margin: 0, lineHeight: 1.05 }}>
          Pesan stok,<br />bukan basa-basi.
        </h1>
        <p style={{ color: "#9CA0A6", fontSize: 14, marginTop: 10, lineHeight: 1.5 }}>
          Masuk pakai email untuk lihat katalog dan kirim orderan.
        </p>
      </div>

      <label style={{ color: "#9CA0A6", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, display: "block" }}>
        Email
      </label>
      <input
        type="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        placeholder="toko@contoh.com"
        style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "none", fontSize: 15, fontWeight: 500, marginBottom: 12, outline: "none", background: "#F7F5F1", color: "#24272B" }}
      />
      <label style={{ color: "#9CA0A6", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, display: "block" }}>
        Password
      </label>
      <input
        type="password"
        value={form.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && onLogin()}
        placeholder="••••••••"
        style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: "none", fontSize: 15, fontWeight: 500, marginBottom: loginError ? 10 : 20, outline: "none", background: "#F7F5F1", color: "#24272B" }}
      />
      {loginError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#E8A426", fontSize: 13, marginBottom: 20 }}>
          <AlertCircle size={16} /> {loginError}
        </div>
      )}

      <button
        onClick={onLogin} disabled={loading}
        style={{ width: "100%", padding: "16px", borderRadius: 12, border: "none", background: "#E8A426", color: "#24272B", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        {loading ? "Memeriksa..." : <>Masuk <ArrowRight size={18} /></>}
      </button>

      <div style={{ textAlign: "center", marginTop: 24 }}>
        <button onClick={onGoRegister} style={{ background: "none", border: "none", color: "#9CA0A6", fontSize: 14 }}>
          Toko baru? <span style={{ color: "#E8A426", fontWeight: 600 }}>Daftar di sini</span>
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "24px 0" }}>
        <div style={{ flex: 1, height: 1, background: "#24272B" }} />
        <span style={{ color: "#6B6F75", fontSize: 11, fontWeight: 600 }}>ATAU</span>
        <div style={{ flex: 1, height: 1, background: "#24272B" }} />
      </div>

      <button
        onClick={onGuestBrowse}
        style={{ width: "100%", padding: "14px", borderRadius: 12, border: "1.5px solid #24272B", background: "none", color: "#fff", fontSize: 14, fontWeight: 600 }}
      >
        Lihat Katalog Dulu (Tanpa Login)
      </button>

      <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid #33363B" }}>
        <p style={{ color: "#6B6F75", fontSize: 11, fontWeight: 700, textTransform: "uppercase", margin: "0 0 8px" }}>PT Indo Garuda Abadi</p>
        <p style={{ color: "#9CA0A6", fontSize: 11.5, margin: "0 0 4px" }}>pt.indogarudaabadi@gmail.com &middot; +62 823-8875-9949</p>
        <p style={{ color: "#9CA0A6", fontSize: 11.5, margin: 0, lineHeight: 1.5 }}>
          Jl. Hangtuah Ujung No.279C, Bencah Lesung, Tenayan Raya, Kota Pekanbaru, Riau 28131
        </p>
      </div>
    </div>
  );
}

// ============================================================
// PILIH TOKO (khusus akun Sales) - sales pilih toko mana yang mau
// dibantu order-kan
// ============================================================
function PilihTokoScreen({ salesInfo, daftarToko, token, onPilih, loading, onLogout }) {
  const [cari, setCari] = useState("");
  const [daftarAkses, setDaftarAkses] = useState([]); // [{ client_id, berlaku_sampai }]
  const [loadingAkses, setLoadingAkses] = useState(true);
  // ---- Alur OTP kalau toko yang dipilih belum/sudah tidak punya akses ----
  const [tokoOtp, setTokoOtp] = useState(null); // toko yang lagi diminta izin OTP-nya
  const [otpStep, setOtpStep] = useState("none"); // none | sending | input
  const [otpKode, setOtpKode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);

  const tokoTampil = daftarToko.filter((t) =>
    !cari.trim() || t.nama.toLowerCase().includes(cari.toLowerCase()) || t.kode.toLowerCase().includes(cari.toLowerCase())
  );

  async function muatAkses() {
    setLoadingAkses(true);
    try {
      const rows = await supabaseFetch(`akses_sales_toko?select=client_id,berlaku_sampai&sales_id=eq.${salesInfo.id}`, {}, token);
      setDaftarAkses(rows || []);
    } catch (e) { /* diamkan - anggap belum ada akses kalau gagal muat */ }
    setLoadingAkses(false);
  }
  useEffect(() => { if (salesInfo?.id && token) muatAkses(); }, [salesInfo?.id, token]);

  function aksesMasihBerlaku(clientId) {
    const akses = daftarAkses.find((a) => a.client_id === clientId);
    if (!akses) return false;
    return new Date(akses.berlaku_sampai) > new Date();
  }

  function tanggalBerlaku(clientId) {
    const akses = daftarAkses.find((a) => a.client_id === clientId);
    if (!akses) return null;
    return new Date(akses.berlaku_sampai);
  }

  // Klik toko - kalau akses masih berlaku, langsung masuk. Kalau belum
  // pernah/kadaluarsa, minta OTP dulu ke email toko itu.
  function klikToko(t) {
    if (aksesMasihBerlaku(t.id)) {
      onPilih(t.id);
    } else {
      setTokoOtp(t);
      setOtpKode("");
      setOtpError("");
      kirimOtpAkses(t);
    }
  }

  async function kirimOtpAkses(t) {
    if (!t.email) {
      setOtpError("Toko ini belum punya email terdaftar - tidak bisa kirim kode izin akses. Hubungi Owner untuk lengkapi data toko ini dulu.");
      setOtpStep("none");
      return;
    }
    setOtpStep("sending");
    setOtpError("");
    setOtpBusy(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: t.email, create_user: false }),
      });
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (e) {}
      if (!res.ok) throw new Error(data.msg || data.error_description || `Gagal kirim kode (status ${res.status}).`);
      setOtpStep("input");
    } catch (e) {
      setOtpError("Gagal kirim kode: " + (e.message || "terjadi kesalahan tak terduga."));
      setOtpStep("none");
    }
    setOtpBusy(false);
  }

  async function verifikasiOtpAkses() {
    if (!otpKode.trim()) {
      setOtpError("Minta toko sebutkan kode yang masuk ke email mereka.");
      return;
    }
    setOtpBusy(true);
    setOtpError("");
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: tokoOtp.email, token: otpKode.trim(), type: "email" }),
      });
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (parseErr) { /* respons kosong/bukan JSON - lanjut cek res.ok saja */ }
      if (!res.ok) throw new Error(data.msg || data.error_description || `Kode salah atau sudah kedaluwarsa (status ${res.status}).`);
    } catch (e) {
      setOtpError("Verifikasi kode gagal: " + (e.message || "terjadi kesalahan tak terduga."));
      setOtpBusy(false);
      return;
    }

    // Kode benar - simpan izin akses berlaku 30 hari ke depan. Dipisah jadi
    // try-catch SENDIRI supaya kalau gagal di sini, pesannya jelas beda dari
    // kegagalan verifikasi kode di atas.
    try {
      const berlakuSampai = new Date();
      berlakuSampai.setDate(berlakuSampai.getDate() + 30);
      await supabaseFetch(`akses_sales_toko?on_conflict=sales_id,client_id`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ sales_id: salesInfo.id, client_id: tokoOtp.id, berlaku_sampai: berlakuSampai.toISOString() }),
      }, token);

      setTokoOtp(null);
      setOtpStep("none");
      onPilih(tokoOtp.id);
    } catch (e) {
      setOtpError("Kode benar, tapi gagal simpan izin akses: " + (e.message || "terjadi kesalahan tak terduga."));
    }
    setOtpBusy(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F7F5F1", padding: "40px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #E8A426, #D6871A)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
          <Headphones size={26} color="#fff" />
        </div>
        <h1 className="disp" style={{ fontSize: 20, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>Halo, {salesInfo?.nama || "Sales"}</h1>
        <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>Pilih toko yang mau Anda bantu order-kan</p>
      </div>

      {tokoOtp ? (
        <div style={{ background: "#fff", borderRadius: 14, padding: 18 }}>
          <button onClick={() => { setTokoOtp(null); setOtpStep("none"); }} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 13, marginBottom: 14, padding: 0 }}>
            <ChevronLeft size={16} /> Batal, kembali ke daftar
          </button>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>Minta Izin Akses - {tokoOtp.nama}</p>
          <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "0 0 16px", lineHeight: 1.5 }}>
            Belum ada izin aktif (atau sudah lewat 30 hari) untuk toko ini. Kode konfirmasi sudah dikirim ke email toko ({tokoOtp.email || "-"}) - minta pemilik toko sebutkan kodenya.
          </p>
          {otpStep === "sending" && <p style={{ fontSize: 12.5, color: "#9CA0A6" }}>Mengirim kode...</p>}
          {(otpStep === "input" || (otpStep === "none" && otpError)) && (
            <>
              <input
                value={otpKode} onChange={(e) => setOtpKode(e.target.value)}
                placeholder="Kode dari email toko" inputMode="numeric"
                style={{ width: "100%", padding: "12px 14px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 16, textAlign: "center", letterSpacing: 4, marginBottom: 10 }}
              />
              {otpError && <p style={{ fontSize: 11.5, color: "#C0392B", margin: "0 0 10px" }}>{otpError}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => kirimOtpAkses(tokoOtp)} disabled={otpBusy} style={{ flex: 1, padding: 11, borderRadius: 9, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 700, fontSize: 12.5 }}>
                  Kirim Ulang Kode
                </button>
                <button onClick={verifikasiOtpAkses} disabled={otpBusy} style={{ flex: 1, padding: 11, borderRadius: 9, border: "none", background: "#28685D", color: "#fff", fontWeight: 700, fontSize: 12.5 }}>
                  {otpBusy ? "Memproses..." : "Verifikasi"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <div style={{ position: "relative", marginBottom: 16 }}>
            <Search size={16} color="#9CA0A6" style={{ position: "absolute", left: 14, top: 13 }} />
            <input
              value={cari} onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama/kode toko..."
              style={{ width: "100%", padding: "11px 14px 11px 38px", borderRadius: 10, border: "1.5px solid #E4E1DA", fontSize: 13.5 }}
            />
          </div>

          {loadingAkses ? (
            <p style={{ textAlign: "center", fontSize: 13, color: "#9CA0A6", padding: "30px 0" }}>Memuat...</p>
          ) : tokoTampil.length === 0 ? (
            <p style={{ textAlign: "center", fontSize: 13, color: "#9CA0A6", padding: "30px 0" }}>
              {daftarToko.length === 0 ? "Belum ada toko yang bisa dibantu order. Minta Owner aktifkan dulu toko yang bersangkutan." : "Tidak ketemu toko dengan kata kunci itu."}
            </p>
          ) : (
            tokoTampil.map((t) => {
              const aktif = aksesMasihBerlaku(t.id);
              const tglBerlaku = tanggalBerlaku(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => klikToko(t)}
                  disabled={loading}
                  style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderRadius: 12, border: "1px solid #EDEAE3", background: "#fff", marginBottom: 10, textAlign: "left" }}
                >
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{t.nama}</p>
                    <p style={{ fontSize: 12, color: "#9CA0A6", margin: 0 }}>{t.kode} - {t.kota || "-"}</p>
                    {aktif ? (
                      <p style={{ fontSize: 10.5, color: "#28685D", fontWeight: 700, margin: "4px 0 0" }}>Akses aktif sampai {tglBerlaku.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                    ) : (
                      <p style={{ fontSize: 10.5, color: "#B8860B", fontWeight: 700, margin: "4px 0 0" }}>Perlu izin OTP dulu</p>
                    )}
                  </div>
                  <ChevronRight size={18} color="#9CA0A6" />
                </button>
              );
            })
          )}
        </>
      )}

      <button onClick={onLogout} style={{ display: "block", margin: "24px auto 0", background: "none", border: "none", color: "#9CA0A6", fontSize: 12.5, textDecoration: "underline" }}>
        Keluar dari akun Sales
      </button>
    </div>
  );
}

// ============================================================
// REGISTRASI TOKO BARU
// ============================================================
function RegisterScreen({ regForm, setRegForm, submitted, onSubmit, onBack, error, loading, regStep, regOtpKode, setRegOtpKode, onVerifikasiOtp }) {
  const [provinces, setProvinces] = useState([]);
  const [regencies, setRegencies] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [villages, setVillages] = useState([]);
  const [wilayahError, setWilayahError] = useState("");

  const WILAYAH_PROXY = `${SUPABASE_URL}/functions/v1/wilayah-proxy`;
  const titleCase = (s) => s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());

  useEffect(() => {
    fetch(`${WILAYAH_PROXY}?path=provinces.json`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } })
      .then((r) => r.json())
      .then((data) => setProvinces(data.map((d) => ({ id: d.id, name: titleCase(d.name) }))))
      .catch(() => {
        setProvinces(FALLBACK_WILAYAH.provinces);
        setWilayahError("Tidak bisa akses API wilayah asli (mode preview) - sementara pakai data contoh Riau/Jakarta/Makassar.");
      });
  }, []);

  useEffect(() => {
    if (!regForm.provinsiId) { setRegencies([]); return; }
    fetch(`${WILAYAH_PROXY}?path=regencies/${regForm.provinsiId}.json`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } })
      .then((r) => r.json())
      .then((data) => setRegencies(data.map((d) => ({ id: d.id, name: titleCase(d.name) }))))
      .catch(() => setRegencies(FALLBACK_WILAYAH.regencies[regForm.provinsiId] || []));
  }, [regForm.provinsiId]);

  useEffect(() => {
    if (!regForm.kotaId) { setDistricts([]); return; }
    fetch(`${WILAYAH_PROXY}?path=districts/${regForm.kotaId}.json`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } })
      .then((r) => r.json())
      .then((data) => setDistricts(data.map((d) => ({ id: d.id, name: titleCase(d.name) }))))
      .catch(() => setDistricts(FALLBACK_WILAYAH.districts[regForm.kotaId] || []));
  }, [regForm.kotaId]);

  useEffect(() => {
    if (!regForm.kecamatanId) { setVillages([]); return; }
    fetch(`${WILAYAH_PROXY}?path=villages/${regForm.kecamatanId}.json`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } })
      .then((r) => r.json())
      .then((data) => setVillages(data.map((d) => ({ id: d.id, name: titleCase(d.name) }))))
      .catch(() => setVillages(FALLBACK_WILAYAH.villages[regForm.kecamatanId] || []));
  }, [regForm.kecamatanId]);

  if (regStep === "otp" && !submitted) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#D8E9E6", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
          <MessageCircle size={34} color="#24272B" />
        </div>
        <h2 className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: "0 0 10px" }}>Verifikasi Email</h2>
        <p style={{ color: "#6B6F75", fontSize: 13.5, lineHeight: 1.6, maxWidth: 300, marginBottom: 20 }}>
          Kode verifikasi sudah dikirim ke <strong>{regForm.email}</strong>. Masukkan kodenya di bawah ini.
        </p>
        <input
          value={regOtpKode} onChange={(e) => setRegOtpKode(e.target.value)}
          placeholder="Kode dari email" inputMode="numeric"
          style={{ width: "100%", maxWidth: 280, padding: "13px 16px", borderRadius: 10, border: "1.5px solid #E4E1DA", fontSize: 18, textAlign: "center", letterSpacing: 4, marginBottom: 12 }}
        />
        {error && <p style={{ fontSize: 12, color: "#C0392B", margin: "0 0 12px", maxWidth: 300 }}>{error}</p>}
        <button
          onClick={onVerifikasiOtp} disabled={loading}
          style={{ width: "100%", maxWidth: 280, padding: "14px", borderRadius: 12, border: "none", background: "#24272B", color: "#fff", fontWeight: 600, fontSize: 14, marginBottom: 10 }}
        >
          {loading ? "Memverifikasi..." : "Verifikasi"}
        </button>
        <button onClick={onSubmit} disabled={loading} style={{ background: "none", border: "none", color: "#6B6F75", fontSize: 12.5, textDecoration: "underline" }}>
          Kirim Ulang Kode
        </button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#D8E9E6", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
          <Clock size={34} color="#24272B" />
        </div>
        <h2 className="disp" style={{ fontSize: 26, fontWeight: 700, color: "#24272B", margin: "0 0 10px" }}>Menunggu persetujuan</h2>
        <p style={{ color: "#6B6F75", fontSize: 14, lineHeight: 1.6, maxWidth: 300 }}>
          Pendaftaran toko <strong>{regForm.nama}</strong> sudah dikirim ke Owner. Anda akan dihubungi begitu disetujui dan bisa login pakai email yang tadi didaftarkan.
        </p>
        <button onClick={onBack} style={{ marginTop: 28, padding: "14px 28px", borderRadius: 12, border: "none", background: "#24272B", color: "#fff", fontWeight: 600, fontSize: 14 }}>
          Kembali ke Login
        </button>
      </div>
    );
  }

  const set = (k) => (e) => setRegForm({ ...regForm, [k]: e.target.value });
  const canSubmit = regForm.email && regForm.password && regForm.password.length >= 6 && regForm.nama && regForm.alamat && regForm.telp && regForm.provinsi && regForm.kota && regForm.kecamatan && regForm.kelurahan;

  function selectProvinsi(name) {
    const found = provinces.find((p) => p.name === name);
    setRegForm({ ...regForm, provinsi: name, provinsiId: found?.id || "", kota: "", kotaId: "", kecamatan: "", kecamatanId: "", kelurahan: "" });
  }
  function selectKota(name) {
    const found = regencies.find((r) => r.name === name);
    setRegForm({ ...regForm, kota: name, kotaId: found?.id || "", kecamatan: "", kecamatanId: "", kelurahan: "" });
  }
  function selectKecamatan(name) {
    const found = districts.find((d) => d.name === name);
    setRegForm({ ...regForm, kecamatan: name, kecamatanId: found?.id || "", kelurahan: "" });
  }
  function selectKelurahan(name) {
    setRegForm({ ...regForm, kelurahan: name });
  }

  return (
    <div style={{ minHeight: "100vh", padding: "20px 24px 40px" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#F7F5F1", margin: "-18px -20px 0", padding: "18px 20px 10px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, padding: "8px 0", marginBottom: 8 }}>
        <ChevronLeft size={18} /> Kembali
      </button>
      </div>
      <h1 className="disp" style={{ fontSize: 28, fontWeight: 700, color: "#24272B", margin: "4px 0 4px" }}>Daftar toko baru</h1>
      <p style={{ color: "#6B6F75", fontSize: 13, marginBottom: 24 }}>Perlu persetujuan Owner sebelum bisa order.</p>

      {wilayahError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBEAEA", color: "#C0392B", padding: "10px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} /> {wilayahError}
        </div>
      )}
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBEAEA", color: "#C0392B", padding: "10px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}

      <Field label="Email"><input type="email" value={regForm.email} onChange={set("email")} placeholder="toko@contoh.com" style={inputStyle} /></Field>
      <Field label="Password"><input type="password" value={regForm.password} onChange={set("password")} placeholder="Minimal 6 karakter" style={inputStyle} /></Field>
      <Field label="Nama Toko"><input value={regForm.nama} onChange={set("nama")} placeholder="Toko Jaya Sentosa" style={inputStyle} /></Field>
      <Field label="Alamat (Jalan, No. Rumah)"><textarea value={regForm.alamat} onChange={set("alamat")} placeholder="Jl. Contoh No. 1" rows={2} style={{ ...inputStyle, resize: "none" }} /></Field>
      <Field label="No. Telepon"><input value={regForm.telp} onChange={set("telp")} placeholder="0812xxxxxxx" style={inputStyle} /></Field>
      <Field label="Nama Pemilik (Owner)"><input value={regForm.namaOwner} onChange={set("namaOwner")} placeholder="Nama lengkap pemilik toko" style={inputStyle} /></Field>
      <Field label="Tanggal Lahir Pemilik"><input type="date" value={regForm.tanggalLahir} onChange={set("tanggalLahir")} style={inputStyle} /></Field>
      <Field label="Jenis Usaha"><input value={regForm.jenisUsaha} onChange={set("jenisUsaha")} placeholder="misal Toko Bangunan, Toko Sparepart" style={inputStyle} /></Field>

      <Field label="Provinsi">
        <AutocompleteField value={regForm.provinsi} onSelect={selectProvinsi} options={provinces.map((p) => p.name)} placeholder="Ketik nama provinsi..." />
      </Field>
      <Field label="Kota / Kabupaten">
        <AutocompleteField value={regForm.kota} onSelect={selectKota} options={regencies.map((r) => r.name)} placeholder="Ketik nama kota..." disabled={!regForm.provinsiId} />
      </Field>
      <Field label="Kecamatan">
        <AutocompleteField value={regForm.kecamatan} onSelect={selectKecamatan} options={districts.map((d) => d.name)} placeholder="Ketik nama kecamatan..." disabled={!regForm.kotaId} />
      </Field>
      <Field label="Kelurahan">
        <AutocompleteField value={regForm.kelurahan} onSelect={selectKelurahan} options={villages.map((v) => v.name)} placeholder="Ketik nama kelurahan..." disabled={!regForm.kecamatanId} />
      </Field>
      <Field label="Kode Pos">
        <input value={regForm.kodePos} onChange={set("kodePos")} placeholder="Isi manual, misal 28292" style={inputStyle} inputMode="numeric" maxLength={5} />
      </Field>

      <Field label="Jenis Pembayaran">
        <div style={{ ...inputStyle, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F7F5F1", color: "#6B6F75" }}>
          <span style={{ fontWeight: 600, color: "#24272B" }}>Transfer</span>
          <span style={{ fontSize: 11, color: "#9CA0A6" }}>Otomatis untuk toko baru</span>
        </div>
      </Field>
      <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "-10px 0 16px", lineHeight: 1.5 }}>
        Toko baru otomatis menggunakan pembayaran Transfer. Kalau butuh jenis pembayaran lain (misal Tempo), hubungi Owner setelah toko disetujui.
      </p>

      <button
        disabled={!canSubmit || loading}
        onClick={onSubmit}
        style={{ width: "100%", marginTop: 12, padding: "16px", borderRadius: 12, border: "none", background: canSubmit ? "#24272B" : "#D8D6D0", color: canSubmit ? "#fff" : "#9CA0A6", fontSize: 15, fontWeight: 700 }}
      >
        {loading ? "Mengirim..." : "Kirim Pendaftaran"}
      </button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#6B6F75", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6, display: "block" }}>{label}</label>
      {children}
    </div>
  );
}
const inputStyle = { width: "100%", padding: "13px 14px", borderRadius: 10, border: "1.5px solid #E4E1DA", fontSize: 15, outline: "none", background: "#fff", color: "#24272B" };

// Input dengan saran otomatis - nilai HANYA tersimpan kalau salah satu saran diklik,
// mengetik tanpa klik saran tidak dianggap terisi.
function AutocompleteField({ value, onSelect, options, placeholder, disabled }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);

  useEffect(() => { setQuery(value || ""); }, [value]);

  const filtered = (query.trim().length > 0
    ? options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()))
    : options
  ).slice(0, 8);

  function handleChange(e) {
    const v = e.target.value;
    setQuery(v);
    setOpen(true);
    if (value) onSelect(""); // batalkan pilihan lama selama masih mengetik ulang
  }

  function pick(opt) {
    setQuery(opt);
    onSelect(opt);
    setOpen(false);
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        disabled={disabled}
        placeholder={disabled ? "Isi dulu yang di atas" : placeholder}
        style={{ ...inputStyle, background: disabled ? "#F7F5F1" : "#fff", color: disabled ? "#B5B2AA" : "#24272B" }}
      />
      {open && !disabled && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid #E4E1DA", borderRadius: 10, boxShadow: "0 8px 20px rgba(0,0,0,0.08)", zIndex: 20, maxHeight: 180, overflowY: "auto" }}>
          {filtered.map((opt) => (
            <button
              key={opt}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(opt)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", fontSize: 13.5, color: "#24272B", borderBottom: "1px solid #F7F5F1" }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
      {open && !disabled && query.trim().length > 0 && filtered.length === 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid #E4E1DA", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "#9CA0A6", zIndex: 20 }}>
          Tidak ketemu. Coba kata kunci lain.
        </div>
      )}
    </div>
  );
}

// ============================================================
// KATALOG
// ============================================================
function CatalogScreen({ toko, isGuest, products, productsLoading, dbError, onRetry, availableCategories, activeCategory, setActiveCategory, searchQuery, setSearchQuery, cart, addToCart, onOpenProduct, onRequireLogin, onOpenChat, onOpenNotifikasi, showInstallButton, isIOS, onInstallClick }) {
  const [showIosTip, setShowIosTip] = useState(false);
  const categories = availableCategories || ["Semua"];
  const [unreadCount, setUnreadCount] = useState(0);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (!toko?.id) return;
    function loadUnread() {
      supabaseFetch(`notifications?select=id&client_id=eq.${toko.id}&is_read=eq.false`)
        .then((rows) => setUnreadCount(rows.length))
        .catch(() => {});
    }
    loadUnread();
    const interval = setInterval(loadUnread, 15000);
    return () => clearInterval(interval);
  }, [toko?.id]);

  return (
    <div>
      <div style={{ background: "#24272B", padding: "20px 20px 16px", borderBottomLeftRadius: 22, borderBottomRightRadius: 22, position: "sticky", top: 0, zIndex: 10 }}>
        {showSearch ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Search size={17} color="#6B6F75" style={{ position: "absolute", left: 14, top: 13 }} />
              <input
                autoFocus
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari barang..."
                style={{ width: "100%", padding: "12px 14px 12px 40px", borderRadius: 10, border: "none", fontSize: 14, outline: "none" }}
              />
            </div>
            <button
              onClick={() => { setShowSearch(false); setSearchQuery(""); }}
              style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "#24272B", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <X size={18} color="#fff" />
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ color: "#9CA0A6", fontSize: 12, margin: 0 }}>Distributor</p>
              <p className="disp" style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: "2px 0 0" }}>INDO GARUDA ABADI</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowSearch(true)} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "#24272B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Search size={18} color="#fff" />
              </button>
              {!toko?.dibuatOlehSales && (
                <button onClick={onOpenChat} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "#24272B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MessageCircle size={18} color="#fff" />
                </button>
              )}
              <button onClick={onOpenNotifikasi} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "#24272B", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <Bell size={18} color="#fff" />
                {unreadCount > 0 && (
                  <span style={{ position: "absolute", top: -3, right: -3, background: "#E4453A", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", border: "2px solid #24272B" }}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
        {!showSearch && isGuest && (
          <button onClick={onRequireLogin} style={{ marginTop: 12, width: "100%", padding: "10px", borderRadius: 9, border: "none", background: "#E8A426", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}>
            Login / Daftar untuk lihat harga & order
          </button>
        )}
      </div>

      {showInstallButton && (
        <div style={{ padding: "14px 20px 0" }}>
          <div style={{ background: "#fff", border: "1.5px solid #E8A426", borderRadius: 12, padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: "#FBF0D9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Download size={17} color="#8A6A1A" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "#24272B", margin: 0 }}>Pasang Aplikasi di HP</p>
              <p style={{ fontSize: 11, color: "#9CA0A6", margin: 0 }}>Akses lebih cepat lewat layar utama</p>
            </div>
            <button
              onClick={() => { if (isIOS) setShowIosTip(true); else onInstallClick(); }}
              style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#E8A426", color: "#24272B", fontSize: 12, fontWeight: 700, flexShrink: 0 }}
            >
              Pasang
            </button>
          </div>
          {showIosTip && (
            <div style={{ marginTop: 8, background: "#FFFBF0", borderRadius: 10, padding: 12 }}>
              <p style={{ fontSize: 11.5, color: "#8A6A1A", margin: 0, lineHeight: 1.6 }}>
                Di Safari: tekan ikon <strong>Share</strong> (kotak dengan panah ke atas) di bagian bawah layar, lalu pilih <strong>"Add to Home Screen"</strong>.
              </p>
              <button onClick={() => setShowIosTip(false)} style={{ marginTop: 8, background: "none", border: "none", color: "#8A6A1A", fontSize: 11, fontWeight: 700, padding: 0, textDecoration: "underline" }}>
                Tutup
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "16px 20px 4px", scrollbarWidth: "none" }}>
        {categories.map((cat) => {
          const active = activeCategory === cat;
          return (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              style={{ flexShrink: 0, padding: "8px 16px", borderRadius: 999, border: active ? "none" : "1.5px solid #E4E1DA", background: active ? "#24272B" : "#fff", color: active ? "#fff" : "#6B6F75", fontSize: 13, fontWeight: 600 }}>
              {cat}
            </button>
          );
        })}
      </div>

      <div style={{ padding: "12px 20px 20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {products.map((p) => {
          const meta = CATEGORY_META[p.kategori] || DEFAULT_CATEGORY_META;
          const Icon = meta.icon;
          const qty = cart[p.kode] || 0;
          return (
            <div key={p.kode} style={{ background: "#fff", borderRadius: 16, padding: 10, border: "1px solid #EDEAE3" }}>
              <button onClick={() => onOpenProduct(p)} style={{ background: "none", border: "none", padding: 0, width: "100%", textAlign: "left" }}>
                <div style={{ width: "100%", aspectRatio: "1", background: p.gambarUrl ? `url(${p.gambarUrl}) center/cover` : meta.bg, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  {!p.gambarUrl && <Icon size={30} color={meta.fg} strokeWidth={1.8} />}
                </div>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: "#24272B", margin: "0 0 3px", lineHeight: 1.3 }}>{p.nama}</p>
                <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 6px" }}>{p.satuan} · stok {p.stock}</p>
                {isGuest ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, color: "#B5B2AA" }}>
                    <Lock size={13} />
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Login untuk harga</span>
                  </div>
                ) : (
                  <>
                    {p.hargaAsli && (
                      <p style={{ fontSize: 11.5, color: "#B5B2AA", textDecoration: "line-through", margin: "0 0 1px" }}>{rupiah(p.hargaAsli)}</p>
                    )}
                    <p className="disp" style={{ fontSize: 19, fontWeight: 700, color: p.hargaAsli ? "#C0392B" : "#24272B", margin: 0 }}>{rupiah(p.harga)}</p>
                  </>
                )}
              </button>

              {isGuest ? (
                <button onClick={onRequireLogin} style={{ width: "100%", marginTop: 10, padding: "9px", borderRadius: 9, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontSize: 12.5, fontWeight: 700 }}>
                  Login untuk Order
                </button>
              ) : qty === 0 ? (
                <button onClick={() => addToCart(p.kode, 1)} style={{ width: "100%", marginTop: 10, padding: "9px", borderRadius: 9, border: "none", background: "#F7F5F1", color: "#24272B", fontSize: 13, fontWeight: 700 }}>
                  + Tambah
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, background: "#24272B", borderRadius: 9, padding: "6px 8px" }}>
                  <button aria-label={`Kurangi ${p.nama}`} onClick={() => addToCart(p.kode, -1)} style={{ background: "none", border: "none", color: "#fff", padding: 4 }}><Minus size={15} /></button>
                  <span style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{qty}</span>
                  <button aria-label={`Tambah ${p.nama}`} onClick={() => addToCart(p.kode, 1)} style={{ background: "none", border: "none", color: "#fff", padding: 4 }}><Plus size={15} /></button>
                </div>
              )}
            </div>
          );
        })}
        {products.length === 0 && productsLoading && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 0", color: "#9CA0A6" }}>
            Memuat produk...
          </div>
        )}
        {dbError && products.length === 0 && !productsLoading && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 20px" }}>
            <AlertCircle size={32} color="#C0392B" style={{ marginBottom: 10 }} />
            <p style={{ color: "#C0392B", fontSize: 13, fontWeight: 600, margin: "0 0 14px" }}>{dbError}</p>
            <button
              onClick={onRetry}
              style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: "#24272B", color: "#fff", fontWeight: 700, fontSize: 13 }}
            >
              Coba Lagi
            </button>
          </div>
        )}
        {!dbError && products.length === 0 && !productsLoading && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 0", color: "#9CA0A6" }}>
            Barang tidak ketemu. Coba kata kunci lain.
          </div>
        )}
      </div>

      <div style={{ margin: "0 20px 24px", padding: 18, background: "#fff", borderRadius: 16, border: "1px solid #EDEAE3" }}>
        {DAFTAR_EMAIL_DEMO.includes(toko?.email) && (
          <>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#24272B", textTransform: "uppercase", margin: "0 0 8px" }}>Informasi</p>
            <p style={{ fontSize: 12.5, color: "#6B6F75", lineHeight: 1.6, margin: "0 0 14px" }}>
              Saat ini kami baru menjual <strong>2 produk</strong> di katalog ini. Ke depannya jumlah produk akan terus bertambah seiring perkembangan bisnis kami.
            </p>
          </>
        )}
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 8px" }}>Kontak Kami</p>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
          <MessageCircle size={14} color="#9CA0A6" style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: "#24272B", margin: 0 }}>pt.indogarudaabadi@gmail.com</p>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 6 }}>
          <Phone size={14} color="#9CA0A6" style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: "#24272B", margin: 0 }}>+62 823-8875-9949</p>
        </div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <MapPin size={14} color="#9CA0A6" style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 12, color: "#24272B", margin: 0, lineHeight: 1.5 }}>
            Jl. Hangtuah Ujung No.279C, Bencah Lesung, Tenayan Raya, Kota Pekanbaru, Riau 28131
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DETAIL PRODUK
// ============================================================
function ProductScreen({ product, qty, isGuest, cartCount, onChangeQty, onSetQty, onBack, onGoToCart, onRequireLogin }) {
  const meta = CATEGORY_META[product.kategori] || DEFAULT_CATEGORY_META;
  const Icon = meta.icon;
  const [fotoUtama, setFotoUtama] = useState(product.gambarUrl ? [product.gambarUrl] : []);
  const [galeriDeskripsi, setGaleriDeskripsi] = useState([]);
  const [editingQty, setEditingQty] = useState(false);
  const [qtyInput, setQtyInput] = useState(String(qty));
  const [scrollOpacity, setScrollOpacity] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    supabaseFetch(`product_images?select=id,url,tipe&product_id=eq.${product.id}&order=urutan.asc`)
      .then((rows) => {
        const utama = rows.filter((r) => r.tipe === "utama").map((r) => r.url);
        setFotoUtama(product.gambarUrl ? [product.gambarUrl, ...utama] : utama);
        setGaleriDeskripsi(rows.filter((r) => r.tipe !== "utama"));
      })
      .catch(() => {
        setFotoUtama(product.gambarUrl ? [product.gambarUrl] : []);
        setGaleriDeskripsi([]);
      });
  }, [product.id]);

  useEffect(() => {
    const onScroll = () => setScrollOpacity(Math.min(1, window.scrollY / 80));
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleShare() {
    const shareData = { title: product.nama, text: `Lihat ${product.nama} di katalog kami`, url: window.location.href };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert("Link disalin ke clipboard.");
      }
    } catch (e) { /* dibatalkan pengguna, biarkan saja */ }
  }
  return (
    <div style={{ minHeight: "100vh", paddingBottom: 90 }}>
      <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#fff", borderBottom: "1px solid #EDEAE3", padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 50, opacity: scrollOpacity, pointerEvents: scrollOpacity > 0.15 ? "auto" : "none" }}>
        <button onClick={onBack} style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <ChevronLeft size={19} color="#24272B" />
        </button>
        <p className="disp" style={{ fontSize: 15, fontWeight: 700, color: "#24272B", margin: 0, flex: 1, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", padding: "0 10px" }}>
          {product.nama}
        </p>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={handleShare} style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Share2 size={17} color="#24272B" />
          </button>
          {!isGuest && (
            <button onClick={onGoToCart} style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              <ShoppingCart size={17} color="#24272B" />
              {cartCount > 0 && (
                <span style={{ position: "absolute", top: -4, right: -4, background: "#E8A426", color: "#24272B", fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
                  {cartCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      <div style={{ position: "relative" }}>
        {fotoUtama.length > 0 ? (
          <div
            onScroll={(e) => setActiveSlide(Math.round(e.target.scrollLeft / e.target.clientWidth))}
            style={{ display: "flex", overflowX: "auto", scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}
          >
            {fotoUtama.map((url, i) => (
              Math.abs(i - activeSlide) <= 1 ? (
                <ImgAutoRetry key={i} src={url} alt={product.nama} style={{ width: "100%", flexShrink: 0, scrollSnapAlign: "start", display: "block" }} />
              ) : (
                // Foto yang MASIH JAUH dari yang sedang dilihat belum dimuat
                // sama sekali - mengurangi jumlah foto yang diminta BERSAMAAN
                // ke jaringan (supaya kecil kemungkinan ada yang gagal),
                // nanti otomatis dimuat begitu digeser mendekat.
                <div key={i} style={{ width: "100%", flexShrink: 0, scrollSnapAlign: "start" }} />
              )
            ))}
          </div>
        ) : (
          <div style={{ width: "100%", aspectRatio: "1.4", background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon size={70} color={meta.fg} strokeWidth={1.5} />
          </div>
        )}
        {fotoUtama.length > 1 && (
          <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
            {fotoUtama.map((_, i) => (
              <div key={i} style={{ width: i === activeSlide ? 16 : 6, height: 6, borderRadius: 3, background: i === activeSlide ? "#E8A426" : "rgba(255,255,255,0.7)", transition: "width 0.2s" }} />
            ))}
          </div>
        )}
        <div style={{ position: "absolute", top: 16, left: 16, right: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={onBack} style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
            <ChevronLeft size={19} color="#24272B" />
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleShare} style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
              <Share2 size={17} color="#24272B" />
            </button>
            {!isGuest && (
              <button onClick={onGoToCart} style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
                <ShoppingCart size={17} color="#24272B" />
                {cartCount > 0 && (
                  <span style={{ position: "absolute", top: -4, right: -4, background: "#E8A426", color: "#24272B", fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
                    {cartCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: meta.fg, textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>{product.kategori}</p>
        <h1 className="disp" style={{ fontSize: 26, fontWeight: 700, color: "#24272B", margin: "0 0 8px" }}>{product.nama}</h1>

        {isGuest ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#9CA0A6", marginBottom: 16 }}>
            <Lock size={16} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Login untuk lihat harga</span>
          </div>
        ) : (
          <>
            {product.hargaAsli && (
              <p style={{ fontSize: 14, color: "#B5B2AA", textDecoration: "line-through", margin: "0 0 2px" }}>{rupiah(product.hargaAsli)}</p>
            )}
            <p className="disp" style={{ fontSize: 24, fontWeight: 700, color: product.hargaAsli ? "#C0392B" : "#24272B", margin: "0 0 4px" }}>{rupiah(product.harga)} <span style={{ fontSize: 14, color: "#9CA0A6", fontWeight: 500 }}>/ {product.satuan}</span></p>
            <p style={{ fontSize: 13, color: "#9CA0A6", marginBottom: 16 }}>Stok tersedia: {product.stock} {product.satuan}</p>
          </>
        )}
      </div>

      <div style={{ background: "#F7F5F1", padding: "20px 0 24px", marginTop: 8 }}>
        <div style={{ background: "#fff", padding: "18px 20px", marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: "#9CA0A6", margin: 0 }}>
            <span style={{ fontWeight: 700, color: "#24272B" }}>Kode Produk:</span> {product.kode}
          </p>
        </div>

        <div style={{ background: "#fff", padding: "18px 20px" }}>
          <h3 className="disp" style={{ fontSize: 16, fontWeight: 700, color: "#24272B", margin: "0 0 8px" }}>Deskripsi Produk</h3>
          {product.deskripsi ? (
            <p style={{ fontSize: 13.5, color: "#6B6F75", lineHeight: 1.6, margin: 0, whiteSpace: "pre-line" }}>{product.deskripsi}</p>
          ) : (
            <p style={{ fontSize: 13, color: "#B5B2AA", margin: 0, fontStyle: "italic" }}>Belum ada deskripsi untuk produk ini.</p>
          )}
        </div>
        {galeriDeskripsi.length > 0 && (
          <div>
            {galeriDeskripsi.map((img) => (
              <ImgAutoRetry key={img.id} src={img.url} alt="" style={{ width: "100%", display: "block" }} />
            ))}
          </div>
        )}
      </div>

      {isGuest ? (
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#fff", borderTop: "1px solid #EDEAE3", padding: "16px 20px" }}>
          <button onClick={onRequireLogin} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 15 }}>
            Login / Daftar untuk Order
          </button>
        </div>
      ) : (
        <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#fff", borderTop: "1px solid #EDEAE3", padding: "16px 20px", display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#F7F5F1", borderRadius: 12, padding: "10px 16px" }}>
            <button onClick={() => onChangeQty(-1)} style={{ background: "none", border: "none", color: "#24272B" }}><Minus size={18} /></button>
            {editingQty ? (
              <input
                type="number" autoFocus value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                onBlur={() => { onSetQty(qtyInput); setEditingQty(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") { onSetQty(qtyInput); setEditingQty(false); } }}
                style={{ width: 40, fontWeight: 700, fontSize: 16, textAlign: "center", border: "none", background: "transparent", outline: "none", padding: 0 }}
              />
            ) : (
              <span onClick={() => { setQtyInput(String(qty)); setEditingQty(true); }} style={{ fontWeight: 700, fontSize: 16, minWidth: 20, textAlign: "center", cursor: "pointer" }}>{qty}</span>
            )}
            <button onClick={() => onChangeQty(1)} style={{ background: "none", border: "none", color: "#24272B" }}><Plus size={18} /></button>
          </div>
          <button onClick={() => (qty > 0 ? onGoToCart() : onBack())} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 15 }}>
            {qty > 0 ? "Sudah di keranjang" : "Tambah ke keranjang"}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// KERANJANG
// ============================================================
function CartScreen({ toko, useAltAddress, setUseAltAddress, editingAlt, setEditingAlt, altAddress, setAltAddress, savedAddresses, onSaveAddress, onPickAddress, isDropship, setIsDropship, dropshipSender, setDropshipSender, savedSenderNames, cart, products, rincian, belowMinimum, isLuarPekanbaru, itemBelumMinimalOrder, metodeBayar, setMetodeBayar, checkedItems, setCheckedItems, addToCart, setCartQty, onBack, onCheckout }) {
  const [editingQtyKode, setEditingQtyKode] = useState(null);
  const [qtyInput, setQtyInput] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const items = Object.entries(cart).map(([kode, qty]) => ({ ...products.find((p) => p.kode === kode), qty }));

  // Wilayah (provinsi/kota/kecamatan/kelurahan) untuk alamat pengiriman baru -
  // sama persis pola yang dipakai saat pendaftaran toko.
  const [provinces, setProvinces] = useState([]);
  const [regencies, setRegencies] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [villages, setVillages] = useState([]);
  const WILAYAH_PROXY = `${SUPABASE_URL}/functions/v1/wilayah-proxy`;
  const titleCase = (s) => s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());

  useEffect(() => {
    fetch(`${WILAYAH_PROXY}?path=provinces.json`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } })
      .then((r) => r.json())
      .then((data) => setProvinces(data.map((d) => ({ id: d.id, name: titleCase(d.name) }))))
      .catch(() => setProvinces(FALLBACK_WILAYAH.provinces));
  }, []);

  useEffect(() => {
    if (!altAddress.provinsiId) { setRegencies([]); return; }
    fetch(`${WILAYAH_PROXY}?path=regencies/${altAddress.provinsiId}.json`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } })
      .then((r) => r.json())
      .then((data) => setRegencies(data.map((d) => ({ id: d.id, name: titleCase(d.name) }))))
      .catch(() => setRegencies(FALLBACK_WILAYAH.regencies[altAddress.provinsiId] || []));
  }, [altAddress.provinsiId]);

  useEffect(() => {
    if (!altAddress.kotaId) { setDistricts([]); return; }
    fetch(`${WILAYAH_PROXY}?path=districts/${altAddress.kotaId}.json`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } })
      .then((r) => r.json())
      .then((data) => setDistricts(data.map((d) => ({ id: d.id, name: titleCase(d.name) }))))
      .catch(() => setDistricts(FALLBACK_WILAYAH.districts[altAddress.kotaId] || []));
  }, [altAddress.kotaId]);

  useEffect(() => {
    if (!altAddress.kecamatanId) { setVillages([]); return; }
    fetch(`${WILAYAH_PROXY}?path=villages/${altAddress.kecamatanId}.json`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } })
      .then((r) => r.json())
      .then((data) => setVillages(data.map((d) => ({ id: d.id, name: titleCase(d.name) }))))
      .catch(() => setVillages(FALLBACK_WILAYAH.villages[altAddress.kecamatanId] || []));
  }, [altAddress.kecamatanId]);

  function selectProvinsiAlt(name) {
    const found = provinces.find((p) => p.name === name);
    setAltAddress({ ...altAddress, provinsi: name, provinsiId: found?.id || "", kota: "", kotaId: "", kecamatan: "", kecamatanId: "", kelurahan: "" });
  }
  function selectKotaAlt(name) {
    const found = regencies.find((r) => r.name === name);
    setAltAddress({ ...altAddress, kota: name, kotaId: found?.id || "", kecamatan: "", kecamatanId: "", kelurahan: "" });
  }
  function selectKecamatanAlt(name) {
    const found = districts.find((d) => d.name === name);
    setAltAddress({ ...altAddress, kecamatan: name, kecamatanId: found?.id || "", kelurahan: "" });
  }
  function selectKelurahanAlt(name) {
    setAltAddress({ ...altAddress, kelurahan: name });
  }

  if (items.length === 0) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
        <ShoppingCart size={48} color="#D8D6D0" />
        <p className="disp" style={{ fontSize: 20, fontWeight: 700, color: "#24272B", margin: "16px 0 6px" }}>Keranjang kosong</p>
        <p style={{ color: "#9CA0A6", fontSize: 13, marginBottom: 20 }}>Yuk mulai pilih barang dari katalog.</p>
        <button onClick={onBack} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "#24272B", color: "#fff", fontWeight: 600, fontSize: 14 }}>Lihat Katalog</button>
      </div>
    );
  }

  const setAlt = (k) => (e) => setAltAddress({ ...altAddress, [k]: e.target.value });
  const canSaveAlt = altAddress.telp.trim() && altAddress.alamat.trim() && altAddress.provinsi && altAddress.kota && altAddress.kecamatan && altAddress.kelurahan;

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 300 }}>
      <div style={{ padding: "20px 20px 8px", position: "sticky", top: 0, zIndex: 10, background: "#F7F5F1" }}>
        <h1 className="disp" style={{ fontSize: 26, fontWeight: 700, color: "#24272B", margin: 0 }}>Keranjang</h1>
        <p style={{ color: "#9CA0A6", fontSize: 13, marginTop: 2 }}>{items.length} jenis barang</p>
      </div>

      {toko && toko.statusVerifikasi !== "terverifikasi" && (
        <div style={{ margin: "0 20px 12px", background: "#FBEAEA", borderRadius: 12, padding: 14 }}>
          <p style={{ fontSize: 12.5, color: "#C0392B", margin: 0, fontWeight: 600, lineHeight: 1.5 }}>
            Toko Anda belum terverifikasi. Upload foto toko & KTP dulu di menu Akun {'>'} Foto Toko sebelum bisa melakukan pemesanan.
          </p>
        </div>
      )}

      {toko && (
        <div style={{ margin: "8px 20px 4px", background: "#fff", border: "1px solid #EDEAE3", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#EFE1BE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Store size={17} color="#B8860B" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, color: "#9CA0A6", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>Dikirim untuk</p>
              <p className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: 0 }}>{altAddress.nama || toko.nama}</p>
            </div>
          </div>

          {!useAltAddress && (
            <>
              <div style={{ fontSize: 12.5, color: "#6B6F75", lineHeight: 1.6 }}>
                <p style={{ margin: 0 }}>{toko.telp}</p>
                <p style={{ margin: 0 }}>{toko.alamat}</p>
              </div>
              {!toko?.dibuatOlehSales && (
                <button
                  onClick={() => {
                    setUseAltAddress(true);
                    if (savedAddresses.length > 0) setShowPicker(true);
                    else setEditingAlt(true);
                  }}
                  style={{ marginTop: 10, background: "none", border: "none", color: "#B8860B", fontSize: 12.5, fontWeight: 700, padding: 0 }}
                >
                  + Kirim ke alamat lain
                </button>
              )}
              {toko?.dibuatOlehSales && (
                <p style={{ marginTop: 10, fontSize: 11, color: "#9CA0A6", margin: "10px 0 0" }}>
                  Mode Sales - pengiriman terkunci ke alamat toko terdaftar.
                </p>
              )}
            </>
          )}

          {useAltAddress && showPicker && (
            <div style={{ marginTop: 4 }}>
              {savedAddresses.map((addr) => (
                <button
                  key={addr.id}
                  onClick={() => { onPickAddress(addr); setShowPicker(false); }}
                  style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 12px", marginBottom: 8, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff" }}
                >
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#24272B" }}>{addr.nama || toko.nama}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9CA0A6" }}>
                    {addr.telp} · {addr.alamat}{addr.kota ? `, ${addr.kota}` : ""}
                  </p>
                </button>
              ))}
              <button
                onClick={() => { setShowPicker(false); setEditingAlt(true); setAltAddress({ nama: "", telp: "", alamat: "", provinsi: "", provinsiId: "", kota: "", kotaId: "", kecamatan: "", kecamatanId: "", kelurahan: "", kodePos: "" }); }}
                style={{ background: "none", border: "none", color: "#B8860B", fontSize: 12.5, fontWeight: 700, padding: "6px 0" }}
              >
                + Alamat baru
              </button>
              <div>
                <button
                  onClick={() => { setUseAltAddress(false); setShowPicker(false); }}
                  style={{ background: "none", border: "none", color: "#9CA0A6", fontSize: 12.5, fontWeight: 600, padding: 0 }}
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {useAltAddress && editingAlt && !showPicker && (
            <div style={{ marginTop: 4 }}>
              <Field label="Nama Penerima">
                <input value={altAddress.nama} onChange={setAlt("nama")} placeholder={toko.nama} style={inputStyle} />
              </Field>
              <Field label="No. Telepon Penerima">
                <input value={altAddress.telp} onChange={setAlt("telp")} placeholder="0812xxxxxxx" style={inputStyle} />
              </Field>
              <Field label="Alamat (Jalan, No. Rumah)">
                <textarea value={altAddress.alamat} onChange={setAlt("alamat")} rows={2} placeholder="Jl. Contoh No. 2" style={{ ...inputStyle, resize: "none" }} />
              </Field>
              <Field label="Provinsi">
                <AutocompleteField value={altAddress.provinsi} onSelect={selectProvinsiAlt} options={provinces.map((p) => p.name)} placeholder="Ketik nama provinsi..." />
              </Field>
              <Field label="Kota / Kabupaten">
                <AutocompleteField value={altAddress.kota} onSelect={selectKotaAlt} options={regencies.map((r) => r.name)} placeholder="Ketik nama kota..." disabled={!altAddress.provinsiId} />
              </Field>
              <Field label="Kecamatan">
                <AutocompleteField value={altAddress.kecamatan} onSelect={selectKecamatanAlt} options={districts.map((d) => d.name)} placeholder="Ketik nama kecamatan..." disabled={!altAddress.kotaId} />
              </Field>
              <Field label="Kelurahan">
                <AutocompleteField value={altAddress.kelurahan} onSelect={selectKelurahanAlt} options={villages.map((v) => v.name)} placeholder="Ketik nama kelurahan..." disabled={!altAddress.kecamatanId} />
              </Field>
              <Field label="Kode Pos">
                <input value={altAddress.kodePos} onChange={setAlt("kodePos")} placeholder="Isi manual, misal 28292" style={inputStyle} inputMode="numeric" maxLength={5} />
              </Field>
              {altAddress.kota && !altAddress.kota.trim().toLowerCase().includes("pekanbaru") && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FFFBF0", color: "#8A6A1A", padding: "9px 12px", borderRadius: 9, fontSize: 11.5, fontWeight: 600, marginBottom: 14 }}>
                  <AlertCircle size={14} style={{ flexShrink: 0 }} />
                  Kota ini di luar Pekanbaru - metode pembayaran otomatis Transfer (COD tidak tersedia).
                </div>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  onClick={() => { setUseAltAddress(false); setEditingAlt(false); setAltAddress({ nama: "", telp: "", alamat: "", provinsi: "", provinsiId: "", kota: "", kotaId: "", kecamatan: "", kecamatanId: "", kelurahan: "", kodePos: "" }); }}
                  style={{ flex: 1, padding: "12px", borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontSize: 13, fontWeight: 600 }}
                >
                  Batal
                </button>
                <button
                  disabled={!canSaveAlt}
                  onClick={onSaveAddress}
                  style={{ flex: 1, padding: "12px", borderRadius: 10, border: "none", background: canSaveAlt ? "#24272B" : "#E4E1DA", color: canSaveAlt ? "#fff" : "#9CA0A6", fontSize: 13, fontWeight: 700 }}
                >
                  Simpan Alamat Ini
                </button>
              </div>
            </div>
          )}

          {useAltAddress && !editingAlt && !showPicker && (
            <div>
              <div style={{ fontSize: 12.5, color: "#6B6F75", lineHeight: 1.6 }}>
                <p style={{ margin: 0 }}>{altAddress.telp}</p>
                <p style={{ margin: 0 }}>
                  {altAddress.alamat}
                  {altAddress.kota && `, ${altAddress.kelurahan}, ${altAddress.kecamatan}, ${altAddress.kota}, ${altAddress.provinsi}`}
                </p>
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 10, marginBottom: 12 }}>
                <button
                  onClick={() => { if (savedAddresses.length > 0) setShowPicker(true); else setEditingAlt(true); }}
                  style={{ background: "none", border: "none", color: "#B8860B", fontSize: 12.5, fontWeight: 700, padding: 0 }}
                >
                  Ganti alamat
                </button>
                <button
                  onClick={() => { setUseAltAddress(false); setEditingAlt(false); setAltAddress({ nama: "", telp: "", alamat: "" }); setIsDropship(false); }}
                  style={{ background: "none", border: "none", color: "#9CA0A6", fontSize: 12.5, fontWeight: 600, padding: 0 }}
                >
                  Pakai alamat toko terdaftar
                </button>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#F7F5F1", borderRadius: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isDropship}
                  onChange={(e) => setIsDropship(e.target.checked)}
                  style={{ width: 17, height: 17, accentColor: "#E8A426" }}
                />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#24272B" }}>
                  Ini pesanan dropship — harga otomatis menyesuaikan provinsi tujuan
                </span>
              </label>

              {isDropship && (
                <div style={{ marginTop: 10 }}>
                  <Field label="Nama Pengirim">
                    <input
                      list="daftar-nama-pengirim"
                      value={dropshipSender}
                      onChange={(e) => setDropshipSender(e.target.value)}
                      placeholder={toko.nama}
                      style={inputStyle}
                    />
                    <datalist id="daftar-nama-pengirim">
                      {savedSenderNames.map((n) => <option key={n} value={n} />)}
                    </datalist>
                  </Field>
                  {savedSenderNames.length > 0 && (
                    <p style={{ fontSize: 11, color: "#9CA0A6", margin: "-8px 0 0" }}>
                      Otomatis pakai nama terakhir — ketik untuk ganti, atau pilih dari riwayat.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ padding: "8px 20px" }}>
        {items.map((p) => {
          const meta = CATEGORY_META[p.kategori] || DEFAULT_CATEGORY_META;
          const Icon = meta.icon;
          const r = hitungRincianItem(p, p.qty);
          const checked = checkedItems[p.kode] !== false;
          return (
            <div key={p.kode} style={{ display: "flex", gap: 10, padding: "14px 0", borderBottom: "1px solid #EDEAE3", opacity: checked ? 1 : 0.45 }}>
              <button
                aria-label={checked ? `Hilangkan centang ${p.nama}` : `Centang ${p.nama}`}
                onClick={() => setCheckedItems({ ...checkedItems, [p.kode]: !checked })}
                style={{ width: 22, height: 22, borderRadius: 7, border: checked ? "none" : "1.5px solid #D8D6D0", background: checked ? "#E8A426" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "center", padding: 0 }}
              >
                {checked && <Check size={14} color="#24272B" strokeWidth={3} />}
              </button>
              <div style={{ width: 54, height: 54, borderRadius: 12, background: p.gambarUrl ? `url(${p.gambarUrl}) center/cover` : meta.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {!p.gambarUrl && <Icon size={24} color={meta.fg} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#24272B", margin: "0 0 4px" }}>{p.nama}</p>
                <p style={{ fontSize: 13, color: "#9CA0A6", margin: 0 }}>{rupiah(p.harga)} / {p.satuan}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
                <button aria-label={`Hapus ${p.nama}`} onClick={() => addToCart(p.kode, -p.qty)} style={{ background: "none", border: "none", color: "#C0392B" }}><X size={16} /></button>
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F7F5F1", borderRadius: 8, padding: "4px 8px" }}>
                  <button aria-label={`Kurangi ${p.nama}`} onClick={() => addToCart(p.kode, -1)} style={{ background: "none", border: "none", color: "#24272B" }}><Minus size={13} /></button>
                  {editingQtyKode === p.kode ? (
                    <input
                      type="number" autoFocus value={qtyInput}
                      onChange={(e) => setQtyInput(e.target.value)}
                      onBlur={() => { setCartQty(p.kode, qtyInput); setEditingQtyKode(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { setCartQty(p.kode, qtyInput); setEditingQtyKode(null); } }}
                      style={{ width: 32, fontWeight: 700, fontSize: 13, textAlign: "center", border: "none", background: "transparent", outline: "none", padding: 0 }}
                    />
                  ) : (
                    <span onClick={() => { setQtyInput(String(p.qty)); setEditingQtyKode(p.kode); }} style={{ fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{p.qty}</span>
                  )}
                  <button aria-label={`Tambah ${p.nama}`} onClick={() => addToCart(p.kode, 1)} style={{ background: "none", border: "none", color: "#24272B" }}><Plus size={13} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ position: "fixed", bottom: 72, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#fff", borderTop: "1px solid #EDEAE3", padding: "10px 20px 12px", zIndex: 50 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#6B6F75", marginBottom: 3 }}>
          <span>Subtotal</span>
          <span>{rupiah(Math.round(rincian.subtotalSebelum))}</span>
        </div>
        {rincian.totalDiskon > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#24272B", fontWeight: 600, marginBottom: 3 }}>
            <span>Diskon</span>
            <span>-{rupiah(Math.round(rincian.totalDiskon))}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingTop: 5, borderTop: "1px dashed #EDEAE3" }}>
          <span style={{ color: "#6B6F75", fontSize: 12, alignSelf: "center" }}>Total Bayar</span>
          <span className="disp" style={{ fontWeight: 700, fontSize: 16, color: "#24272B" }}>{rupiah(Math.round(rincian.totalBayar))}</span>
        </div>

        {belowMinimum && (
          <div style={{ background: "#FBEAEA", color: "#C0392B", padding: "9px 10px", borderRadius: 9, fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              Ada barang belum sesuai aturan order:
            </div>
            {itemBelumMinimalOrder.map((p) => (
              <p key={p.kode} style={{ margin: "2px 0 0 20px" }}>
                {p.nama}: {p.qty} {p.satuan}
                {p.belumMinimal && ` (minimal ${p.minimalOrder})`}
                {p.belumKelipatan && ` (harus kelipatan ${p.kelipatanOrder})`}
              </p>
            ))}
          </div>
        )}

        {!isLuarPekanbaru && (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", margin: "0 0 8px", textTransform: "uppercase" }}>Metode Pembayaran</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setMetodeBayar("transfer")}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: metodeBayar === "transfer" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: metodeBayar === "transfer" ? "#FBF0D9" : "#fff", fontSize: 13, fontWeight: 700, color: "#24272B" }}
              >
                Transfer
              </button>
              <button
                onClick={() => setMetodeBayar("cod")}
                style={{ flex: 1, padding: "10px", borderRadius: 10, border: metodeBayar === "cod" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: metodeBayar === "cod" ? "#FBF0D9" : "#fff", fontSize: 13, fontWeight: 700, color: "#24272B" }}
              >
                COD (Bayar di Tempat)
              </button>
            </div>
          </div>
        )}

        <button
          onClick={onCheckout}
          disabled={belowMinimum}
          style={{ width: "100%", padding: "10px", borderRadius: 10, border: "none", background: belowMinimum ? "#E4E1DA" : "#E8A426", color: belowMinimum ? "#9CA0A6" : "#24272B", fontWeight: 700, fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
        >
          Pembelian {!belowMinimum && <ArrowRight size={13} />}
        </button>
        <p style={{ textAlign: "center", fontSize: 10, color: "#9CA0A6", marginTop: 6, marginBottom: 0 }}>Order menunggu persetujuan sebelum diproses</p>
      </div>
    </div>
  );
}

// ============================================================
// KONFIRMASI PEMBELIAN - review terakhir sebelum kirim order, di sini
// baru bisa pakai potongan poin
// ============================================================
function KonfirmasiPembelianScreen({ rincian, metodeBayar, toko, useAltAddress, altAddress, cart, products, checkedItems, pointsBalance, poinDipakai, setPoinDipakai, onBack, onSubmit }) {
  const [mengirim, setMengirim] = useState(false);
  // ---- OTP konfirmasi pemilik toko (WAJIB kalau order ini dibuatkan sales -
  // supaya order tidak bisa terkirim tanpa toko benar-benar menyetujui) ----
  const [otpStep, setOtpStep] = useState("none"); // none | sending | input | terverifikasi
  const [otpKonfirmasi, setOtpKonfirmasi] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const poinDipakaiEfektif = toko?.dibuatOlehSales ? 0 : poinDipakai; // jaga-jaga - poin toko TIDAK PERNAH dipakai kalau lagi mode sales
  const totalSetelahPoin = Math.max(0, Math.round(rincian.totalBayar) - (poinDipakaiEfektif >= 5000 ? poinDipakaiEfektif : 0));

  const daftarItem = Object.entries(cart)
    .filter(([kode]) => checkedItems[kode] !== false)
    .map(([kode, qty]) => {
      const p = products.find((x) => x.kode === kode);
      if (!p) return null;
      return { ...p, qty };
    })
    .filter(Boolean);

  const tujuan = useAltAddress
    ? {
        nama: altAddress.nama || toko.nama, telp: altAddress.telp,
        alamat: altAddress.kota
          ? `${altAddress.alamat}, ${altAddress.kelurahan}, ${altAddress.kecamatan}, ${altAddress.kota}, ${altAddress.provinsi} ${altAddress.kodePos}`
          : altAddress.alamat,
        kota: altAddress.kota || toko.kota,
      }
    : { nama: toko.nama, telp: toko.telp, alamat: toko.alamat, kota: toko.kota };

  // Kirim kode OTP ke EMAIL TOKO (bukan email sales) - minta toko sebutkan
  // kodenya ke sales, buat pastikan toko benar2 tahu & setuju order ini.
  async function kirimOtpKonfirmasi() {
    if (!toko?.email) {
      setOtpError("Toko ini belum punya email terdaftar - tidak bisa kirim kode konfirmasi. Hubungi Owner untuk lengkapi data toko ini dulu.");
      setOtpStep("none");
      return;
    }
    setOtpStep("sending");
    setOtpError("");
    setOtpBusy(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: toko.email, create_user: false }),
      });
      const text = await res.text();
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (parseErr) { /* respons kosong/bukan JSON - anggap saja kalau res.ok tetap sukses */ }
      if (!res.ok) throw new Error(data.msg || data.error_description || `Gagal kirim kode ke email toko (status ${res.status}).`);
      setOtpStep("input");
    } catch (e) {
      setOtpError("Gagal kirim kode: " + (e.message || "terjadi kesalahan tak terduga.") + " Coba lagi.");
      setOtpStep("none");
    }
    setOtpBusy(false);
  }

  async function verifikasiOtpKonfirmasi() {
    if (!otpKonfirmasi.trim()) {
      setOtpError("Minta toko sebutkan kode yang masuk ke email mereka.");
      return;
    }
    setOtpBusy(true);
    setOtpError("");
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: toko.email, token: otpKonfirmasi.trim(), type: "email" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || data.error_description || "Kode salah atau sudah kedaluwarsa.");
      setOtpStep("terverifikasi");
      // Kode benar - baru SEKARANG order beneran dikirim.
      await handleSubmit();
    } catch (e) {
      setOtpError(e.message);
    }
    setOtpBusy(false);
  }

  async function handleSubmit() {
    setMengirim(true);
    try {
      await onSubmit();
    } finally {
      setMengirim(false);
    }
  }

  // Tombol utama - kalau mode SALES, wajib lewat OTP dulu; toko biasa
  // langsung kirim seperti biasa.
  function handleTombolUtama() {
    if (toko?.dibuatOlehSales) {
      kirimOtpKonfirmasi();
    } else {
      handleSubmit();
    }
  }

  return (
    <div style={{ minHeight: "100vh", padding: "18px 20px 100px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, marginBottom: 16 }}>
        <ChevronLeft size={18} /> Kembali ke Keranjang
      </button>

      <h1 className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>Konfirmasi Pembelian</h1>
      <p style={{ fontSize: 13, color: "#6B6F75", margin: "0 0 20px" }}>Periksa lagi rincian pesanan sebelum dikirim.</p>

      <div style={{ background: "#fff", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 8px" }}>Dikirim untuk</p>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{tujuan.nama}</p>
        {tujuan.telp && <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "0 0 4px" }}>{tujuan.telp}</p>}
        <p style={{ fontSize: 12.5, color: "#6B6F75", margin: 0, lineHeight: 1.5 }}>{tujuan.alamat}</p>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>Barang Dipesan ({daftarItem.length})</p>
        {daftarItem.map((p) => {
          const meta = CATEGORY_META[p.kategori] || DEFAULT_CATEGORY_META;
          const Icon = meta.icon;
          const r = hitungRincianItem(p, p.qty);
          return (
            <div key={p.kode} style={{ display: "flex", gap: 10, padding: "12px 0", borderBottom: "1px solid #EDEAE3" }}>
              <div style={{ width: 48, height: 48, borderRadius: 11, background: p.gambarUrl ? `url(${p.gambarUrl}) center/cover` : meta.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {!p.gambarUrl && <Icon size={21} color={meta.fg} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: "#24272B", margin: "0 0 4px" }}>{p.nama}</p>
                <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: 0 }}>{rupiah(p.harga)} / {p.satuan}</p>
              </div>
              <div style={{ flexShrink: 0, alignSelf: "center", background: "#F7F5F1", borderRadius: 8, padding: "5px 10px" }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: "#24272B" }}>{p.qty} {p.satuan}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6B6F75", marginBottom: 6 }}>
          <span>Subtotal</span>
          <span>{rupiah(Math.round(rincian.subtotalSebelum))}</span>
        </div>
        {rincian.totalDiskon > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#24272B", fontWeight: 600, marginBottom: 6 }}>
            <span>Diskon</span>
            <span>-{rupiah(Math.round(rincian.totalDiskon))}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6B6F75", marginBottom: 6 }}>
          <span>Metode Bayar</span>
          <span style={{ fontWeight: 600, color: "#24272B", textTransform: "uppercase" }}>{metodeBayar}</span>
        </div>
      </div>

      {!toko?.dibuatOlehSales && (
        <div style={{ background: "#FBF0D9", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: poinDipakai > 0 ? 10 : 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#8A6A1A" }}>Gunakan Poin (punya {pointsBalance.toLocaleString("id-ID")} pts)</span>
            {poinDipakai > 0 && (
              <button type="button" onClick={() => setPoinDipakai(0)} style={{ background: "none", border: "none", color: "#C0392B", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Batal</button>
            )}
          </div>
          {pointsBalance >= 5000 ? (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={5000}
                  max={Math.min(pointsBalance, Math.floor(rincian.totalBayar))}
                  value={poinDipakai || ""}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0;
                    const batasAtas = Math.min(pointsBalance, Math.floor(rincian.totalBayar));
                    setPoinDipakai(Math.min(v, batasAtas));
                  }}
                  placeholder="Minimal 5000"
                  style={{ flex: 1, padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4C88A", fontSize: 14 }}
                />
                <span style={{ fontSize: 12.5, color: "#8A6A1A", fontWeight: 700 }}>= {rupiah(poinDipakai)}</span>
              </div>
              {poinDipakai > 0 && poinDipakai < 5000 && (
                <p style={{ fontSize: 11.5, color: "#C0392B", margin: "8px 0 0" }}>Minimal pakai 5000 poin.</p>
              )}
            </>
          ) : (
            <>
              <input
                disabled
                placeholder="Minimal 5000 poin"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4C88A", fontSize: 14, background: "#F7F0DE", color: "#B5A16A" }}
              />
              <p style={{ fontSize: 11.5, color: "#8A6A1A", margin: "8px 0 0" }}>
                Kumpulkan {(5000 - pointsBalance).toLocaleString("id-ID")} poin lagi untuk bisa dipakai sebagai potongan.
              </p>
            </>
          )}
        </div>
      )}

      <div style={{ background: "#fff", borderRadius: 12, padding: 16 }}>
        {poinDipakai >= 5000 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#8A6A1A", fontWeight: 600, marginBottom: 8 }}>
            <span>Potongan Poin ({poinDipakai.toLocaleString("id-ID")} pts)</span>
            <span>-{rupiah(poinDipakai)}</span>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: poinDipakai >= 5000 ? 8 : 0, borderTop: poinDipakai >= 5000 ? "1px dashed #EDEAE3" : "none" }}>
          <span style={{ color: "#6B6F75", fontSize: 14, alignSelf: "center", fontWeight: 600 }}>Total Bayar</span>
          <span className="disp" style={{ fontWeight: 700, fontSize: 20, color: "#24272B" }}>{rupiah(totalSetelahPoin)}</span>
        </div>
      </div>

      {toko?.dibuatOlehSales && otpStep === "none" && otpError && (
        <div style={{ background: "#FBEAEA", borderRadius: 12, padding: 14, marginBottom: 100 }}>
          <p style={{ fontSize: 12.5, color: "#C0392B", margin: 0, lineHeight: 1.5 }}>{otpError}</p>
        </div>
      )}

      {toko?.dibuatOlehSales && otpStep === "input" && (
        <div style={{ background: "#FBF0D9", borderRadius: 12, padding: 16, marginBottom: 100 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#8A6A1A", margin: "0 0 6px" }}>Konfirmasi Pemilik Toko</p>
          <p style={{ fontSize: 12, color: "#8A6A1A", margin: "0 0 12px", lineHeight: 1.5 }}>
            Kode 6-digit sudah dikirim ke email toko ({toko.email}). Minta pemilik toko sebutkan kodenya.
          </p>
          <input
            value={otpKonfirmasi} onChange={(e) => setOtpKonfirmasi(e.target.value)}
            placeholder="Kode dari email toko" inputMode="numeric"
            style={{ width: "100%", padding: "12px 14px", borderRadius: 9, border: "1.5px solid #E4C88A", fontSize: 16, textAlign: "center", letterSpacing: 4, marginBottom: 10 }}
          />
          {otpError && <p style={{ fontSize: 11.5, color: "#C0392B", margin: "0 0 10px" }}>{otpError}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={kirimOtpKonfirmasi} disabled={otpBusy} style={{ flex: 1, padding: 11, borderRadius: 9, border: "1.5px solid #E4C88A", background: "#fff", color: "#8A6A1A", fontWeight: 700, fontSize: 12.5 }}>
              Kirim Ulang Kode
            </button>
            <button onClick={verifikasiOtpKonfirmasi} disabled={otpBusy || mengirim} style={{ flex: 1, padding: 11, borderRadius: 9, border: "none", background: "#28685D", color: "#fff", fontWeight: 700, fontSize: 12.5 }}>
              {otpBusy || mengirim ? "Memproses..." : "Verifikasi & Kirim"}
            </button>
          </div>
        </div>
      )}

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#fff", borderTop: "1px solid #EDEAE3", padding: "12px 20px calc(12px + env(safe-area-inset-bottom))" }}>
        {!(toko?.dibuatOlehSales && otpStep === "input") && (
          <button
            onClick={handleTombolUtama}
            disabled={mengirim || otpBusy || (poinDipakai > 0 && poinDipakai < 5000)}
            style={{ width: "100%", padding: 13, borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            {otpStep === "sending" ? "Mengirim kode ke email toko..." : mengirim ? "Mengirim..." : toko?.dibuatOlehSales ? <>Minta Konfirmasi Toko <ArrowRight size={14} /></> : <>Kirim Order <ArrowRight size={14} /></>}
          </button>
        )}
        <p style={{ textAlign: "center", fontSize: 10, color: "#9CA0A6", marginTop: 6, marginBottom: 0 }}>Order menunggu persetujuan sebelum diproses</p>
      </div>
    </div>
  );
}

// ============================================================
// SUKSES
// ============================================================
function SuccessScreen({ order, onDone, onHistory }) {
  if (!order) return null;
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
      <div style={{ width: 76, height: 76, borderRadius: "50%", background: "#E8A426", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
        <Check size={38} color="#24272B" strokeWidth={2.5} />
      </div>
      <h2 className="disp" style={{ fontSize: 28, fontWeight: 700, color: "#24272B", margin: "0 0 6px" }}>Order terkirim!</h2>
      <p style={{ color: "#6B6F75", fontSize: 14, marginBottom: 4 }}>Nomor referensi</p>
      <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#E8A426", margin: "0 0 20px" }}>{order.id}</p>
      <div style={{ background: "#F7F5F1", borderRadius: 14, padding: "16px 20px", width: "100%", maxWidth: 320, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
          <span style={{ color: "#6B6F75" }}>{order.items.length} jenis barang</span>
          <span style={{ fontWeight: 700, color: "#24272B" }}>{rupiah(order.total)}</span>
        </div>
        {order.tujuan && (
          <div style={{ textAlign: "left", fontSize: 12, color: "#6B6F75", borderTop: "1px dashed #E4E1DA", paddingTop: 8, marginBottom: 8, lineHeight: 1.5 }}>
            <p style={{ margin: 0, fontWeight: 700, color: "#24272B" }}>
              Dikirim ke: {order.tujuan.nama}
              {order.isDropship && (
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#B8860B", background: "#EFE1BE", padding: "2px 8px", borderRadius: 999 }}>
                  DROPSHIP
                </span>
              )}
            </p>
            {order.tujuan.telp && <p style={{ margin: 0 }}>{order.tujuan.telp}</p>}
            {order.tujuan.alamat && <p style={{ margin: 0 }}>{order.tujuan.alamat}</p>}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#B8860B", fontWeight: 600 }}>
          <Clock size={13} /> Menunggu persetujuan Owner
        </div>
      </div>
      <button onClick={onDone} style={{ width: "100%", maxWidth: 320, padding: "15px", borderRadius: 12, border: "none", background: "#24272B", color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 10 }}>
        Lanjut Belanja
      </button>
      <button onClick={onHistory} style={{ width: "100%", maxWidth: 320, padding: "15px", borderRadius: 12, border: "1.5px solid #E4E1DA", background: "#fff", color: "#24272B", fontWeight: 600, fontSize: 14 }}>
        Lihat Riwayat Order
      </button>
    </div>
  );
}

// ============================================================
// RIWAYAT
// ============================================================
function HistoryScreen({ orders, onBack, toko }) {
  const [detailOrder, setDetailOrder] = useState(null);
  return (
    <div style={{ minHeight: "100vh", padding: "0 0 20px" }}>
      <div style={{ padding: "20px 20px 16px", position: "sticky", top: 0, zIndex: 10, background: "#F7F5F1" }}>
        <h1 className="disp" style={{ fontSize: 26, fontWeight: 700, color: "#24272B", margin: 0 }}>Riwayat Order</h1>
      </div>
      <div style={{ padding: "0 20px" }}>
      {orders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9CA0A6" }}>
          <ClipboardList size={40} color="#D8D6D0" />
          <p style={{ marginTop: 12, fontSize: 14 }}>Belum ada order yang dikirim.</p>
        </div>
      ) : (
        orders.map((o) => {
          const isCancelled = o.status === "Dibatalkan";
          return (
          <div key={o.id} style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, border: "1px solid #EDEAE3" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span className="disp" style={{ fontWeight: 700, fontSize: 16, color: "#24272B" }}>
                {o.id}
                {o.metodeBayar === "cod" && (
                  <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#FBF0D9", color: "#8A6A1A", verticalAlign: "middle" }}>COD</span>
                )}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: isCancelled ? "#C0392B" : "#B8860B", background: isCancelled ? "#FBEAEA" : "#FBF0D9", padding: "4px 10px", borderRadius: 999 }}>{o.status}</span>
            </div>
            {isCancelled && o.alasanDibatalkan && (
              <p style={{ fontSize: 11.5, color: "#C0392B", margin: "0 0 8px", fontStyle: "italic" }}>{o.alasanDibatalkan}</p>
            )}
            <p style={{ fontSize: 12, color: "#9CA0A6", margin: "0 0 10px" }}>
              {o.tanggal.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} · {o.items.length} jenis barang
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#6B6F75" }}>{o.items.map((i) => i.nama).join(", ")}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <button onClick={() => setDetailOrder(o)} style={{ background: "none", border: "1px solid #E4E1DA", borderRadius: 8, padding: "6px 12px", color: "#24272B", fontSize: 11.5, fontWeight: 600 }}>
                Detail Pesanan
              </button>
              <span className="disp" style={{ fontWeight: 700, fontSize: 17, color: "#24272B" }}>{rupiah(o.total)}</span>
            </div>
          </div>
          );
        })
      )}
      </div>
      {detailOrder && <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} clientId={toko?.id} />}
    </div>
  );
}

// ============================================================
// AKUN
// ============================================================
function AccountScreen({ toko, orders, onMarkPaid, pointsBalance, onOpenRekening, onOpenCS, onOpenBantuan, onOpenPoin, onOpenOrderList, onOpenOrderUlang, onOpenSaldo, onOpenVerifikasi, onOpenInfoAkun, onLogout }) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const counts = {
    pesanan: orders.filter((o) => o.status === "Menunggu Persetujuan").length,
    kirim: orders.filter((o) => o.status === "Sedang Diproses" || o.status === "Siap Dikirim").length,
    konfirmasi: orders.filter((o) => o.status === "Dikirim").length,
    bayar: orders.filter((o) => !o.sudahBayar && o.status !== "Dibatalkan").length,
  };
  const tiles = [
    { key: "pesanan", label: "Pesanan", icon: ClipboardList, count: counts.pesanan, matchStatus: "Menunggu Persetujuan" },
    { key: "kirim", label: "Menunggu Pengiriman", icon: Truck, count: counts.kirim, matchStatus: null },
    { key: "konfirmasi", label: "Dikirim", icon: PackageCheck, count: counts.konfirmasi, matchStatus: "Dikirim" },
    { key: "bayar", label: "Belum Bayar", icon: Wallet, count: counts.bayar, matchStatus: null },
  ];

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 88 }}>
      <div style={{ background: "#24272B", padding: "20px 20px 22px", borderBottomLeftRadius: 22, borderBottomRightRadius: 22, position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#E8A426", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <User size={22} color="#24272B" />
          </div>
          <div>
            <p className="disp" style={{ color: "#fff", fontSize: 19, fontWeight: 700, margin: 0 }}>{toko?.nama}</p>
            <button onClick={onOpenInfoAkun} style={{ background: "none", border: "none", padding: 0, display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ color: "#9CA0A6", fontSize: 12 }}>Kode Toko: {toko?.kode}</span>
              <ChevronRight size={13} color="#9CA0A6" />
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 20px 4px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => onOpenOrderList(t.key)}
              style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 14, padding: 14, textAlign: "left" }}
            >
              <Icon size={20} color="#B8860B" strokeWidth={1.8} />
              <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#24272B", margin: "8px 0 0" }}>{t.count}</p>
              <p style={{ fontSize: 11.5, color: "#6B6F75", margin: "2px 0 0", lineHeight: 1.3 }}>{t.label}</p>
            </button>
          );
        })}
      </div>

      {!toko?.dibuatOlehSales && (
        <div style={{ padding: "0 20px 4px" }}>
          <button onClick={onOpenPoin} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "#24272B", borderRadius: 16, padding: 16, border: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#E8A426", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Star size={19} color="#24272B" />
              </div>
              <div style={{ textAlign: "left" }}>
                <p style={{ color: "#9CA0A6", fontSize: 11, margin: 0 }}>Poin Saya</p>
                <p className="disp" style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: "1px 0 0" }}>{pointsBalance.toLocaleString("id-ID")} pts</p>
              </div>
            </div>
            <ChevronRight size={18} color="#6B6F75" />
          </button>
        </div>
      )}

      <div style={{ padding: "8px 20px 4px" }}>
        <MenuRow icon={Wallet} label="Saldo Saya" onClick={onOpenSaldo} />
        <MenuRow
          icon={User} label="Foto Toko"
          onClick={onOpenVerifikasi}
          badge={
            toko.statusVerifikasi === "terverifikasi" ? { text: "Terverifikasi", bg: "#D8E9E6", color: "#28685D" } :
            toko.statusVerifikasi === "menunggu_review" ? { text: "Menunggu Review", bg: "#FBF0D9", color: "#8A6A1A" } :
            toko.statusVerifikasi === "ditolak" ? { text: "Ditolak", bg: "#FBEAEA", color: "#C0392B" } :
            { text: "Wajib Isi", bg: "#FBEAEA", color: "#C0392B" }
          }
        />
        <MenuRow icon={Bell} label="Aktifkan Notifikasi" onClick={() => subscribeToPush(toko.id)} />
        <MenuRow icon={RotateCcw} label="Order Ulang" onClick={onOpenOrderUlang} />
        {!toko?.dibuatOlehSales && <MenuRow icon={Star} label="Poin Saya" onClick={onOpenPoin} />}
        <MenuRow icon={CreditCard} label="Ketentuan Pembayaran & Rekening Bank" onClick={onOpenRekening} />
        <MenuRow icon={Headphones} label="Service Centre" onClick={onOpenCS} />
        <MenuRow icon={HelpCircle} label="Bantuan" onClick={onOpenBantuan} />
      </div>

      <div style={{ padding: "8px 20px 20px" }}>
        {!showLogoutConfirm ? (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", background: "#fff", border: "1px solid #F0CFC7", borderRadius: 12, padding: 14, color: "#C0392B", fontSize: 13.5, fontWeight: 700 }}
          >
            <LogOut size={16} /> Keluar
          </button>
        ) : (
          <div style={{ background: "#FBEAEA", border: "1px solid #F0CFC7", borderRadius: 12, padding: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>Keluar dari akun ini?</p>
            <p style={{ fontSize: 12, color: "#6B6F75", margin: "0 0 12px" }}>{toko?.nama} akan keluar dan kembali ke halaman login.</p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowLogoutConfirm(false)}
                style={{ flex: 1, padding: "11px", borderRadius: 9, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontSize: 13, fontWeight: 600 }}
              >
                Batal
              </button>
              <button
                onClick={onLogout}
                style={{ flex: 1, padding: "11px", borderRadius: 9, border: "none", background: "#C0392B", color: "#fff", fontSize: 13, fontWeight: 700 }}
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// DAFTAR ORDER PER KATEGORI (halaman baru, dibuka dari tile Akun)
// ============================================================
function OrderListScreen({ filterKey, toko, orders, onAdvance, onUploadBukti, onCancelOrder, onBack }) {
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [detailOrder, setDetailOrder] = useState(null);

  const TITLE_MAP = {
    pesanan: "Pesanan", kirim: "Menunggu Pengiriman", konfirmasi: "Dikirim", bayar: "Belum Bayar",
  };
  const MATCH_STATUS = {
    pesanan: ["Menunggu Persetujuan"], kirim: ["Sedang Diproses", "Siap Dikirim"], konfirmasi: ["Dikirim"],
  };

  const filteredOrders = filterKey === "bayar"
    ? orders.filter((o) => !o.sudahBayar && o.status !== "Dibatalkan")
    : orders.filter((o) => (MATCH_STATUS[filterKey] || []).includes(o.status));

  return (
    <div style={{ minHeight: "100vh", padding: "18px 20px 40px" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#F7F5F1", margin: "-18px -20px 0", padding: "18px 20px 10px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, marginBottom: 12 }}>
        <ChevronLeft size={18} /> Kembali
      </button>
      </div>
      <h1 className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: "0 0 16px" }}>{TITLE_MAP[filterKey]}</h1>

      {filteredOrders.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "#9CA0A6", textAlign: "center", padding: "40px 0" }}>Tidak ada order di kategori ini.</p>
      ) : (
        filteredOrders.map((o) => (
          <div key={o.id} style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="disp" style={{ fontWeight: 700, fontSize: 14 }}>
                {o.id}
                {o.metodeBayar === "cod" && (
                  <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#FBF0D9", color: "#8A6A1A", verticalAlign: "middle" }}>COD</span>
                )}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#24272B" }}>{rupiah(o.total)}</span>
            </div>
            <button onClick={() => setDetailOrder(o)} style={{ background: "none", border: "1px solid #E4E1DA", borderRadius: 8, padding: "6px 12px", color: "#24272B", fontSize: 11.5, fontWeight: 600, marginBottom: 8 }}>
              Detail Pesanan
            </button>
            {o.status === "Dikirim" && !o.dikonfirmasiToko && (
              <button onClick={() => onAdvance(o.id, "Selesai")} style={{ width: "100%", marginTop: 4, padding: "9px", borderRadius: 9, border: "none", background: "#E8A426", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}>
                Konfirmasi Penerimaan
              </button>
            )}
            {o.status === "Dikirim" && o.dikonfirmasiToko && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px", background: "#FBF0D9", borderRadius: 9, fontSize: 11.5, color: "#B8860B", fontWeight: 600, marginTop: 4 }}>
                <Check size={13} /> Penerimaan dikonfirmasi, menunggu review Owner
              </div>
            )}
            {!o.sudahBayar && (filterKey === "bayar" || filterKey === "pesanan") && (
              toko?.jenisBayar === "Transfer" ? (
                o.buktiTransferUrl ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px", background: "#FBF0D9", borderRadius: 9, fontSize: 11.5, color: "#B8860B", fontWeight: 600 }}>
                    <Check size={13} /> Bukti transfer terkirim, menunggu konfirmasi Owner
                  </div>
                ) : (
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "9px", borderRadius: 9, border: "1.5px dashed #E8A426", background: "#F7F5F1", color: "#B8860B", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                    <Upload size={14} /> Upload Bukti Transfer
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) onUploadBukti(o, e.target.files[0]); }} />
                  </label>
                )
              ) : (
                <p style={{ fontSize: 11, color: "#9CA0A6", margin: "4px 0 0" }}>Menunggu konfirmasi pembayaran dari Owner.</p>
              )
            )}
            {!o.sudahBayar && filterKey === "bayar" && o.status !== "Dibatalkan"
              && (o.metodeBayar === "cod" ? o.status === "Menunggu Persetujuan" : !o.buktiTransferUrl) && (
              confirmCancelId === o.id ? (
                <div style={{ marginTop: 8, background: "#FBEAEA", borderRadius: 9, padding: 10 }}>
                  <p style={{ fontSize: 11.5, color: "#C0392B", fontWeight: 600, margin: "0 0 8px" }}>Yakin batalkan pesanan ini?</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      disabled={cancelling}
                      onClick={async () => { setCancelling(true); await onCancelOrder(o); setCancelling(false); setConfirmCancelId(null); }}
                      style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: "#C0392B", color: "#fff", fontSize: 12, fontWeight: 700 }}
                    >
                      {cancelling ? "Membatalkan..." : "Ya, Batalkan"}
                    </button>
                    <button onClick={() => setConfirmCancelId(null)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontSize: 12, fontWeight: 600 }}>
                      Tidak
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmCancelId(o.id)}
                  style={{ width: "100%", marginTop: 8, padding: "9px", borderRadius: 9, border: "1.5px solid #F0CFC7", background: "#fff", color: "#C0392B", fontSize: 12, fontWeight: 700 }}
                >
                  Batalkan Pesanan
                </button>
              )
            )}
            {o.status === "Menunggu Persetujuan" && (
              <p style={{ fontSize: 11, color: "#B8860B", margin: "4px 0 0" }}>Menunggu Owner menyetujui pesanan ini.</p>
            )}
            {o.status === "Sedang Diproses" && (
              <p style={{ fontSize: 11, color: "#9CA0A6", margin: "4px 0 0" }}>Barang sedang disiapkan untuk dikirim.</p>
            )}
            {o.status === "Siap Dikirim" && (
              <p style={{ fontSize: 11, color: "#9CA0A6", margin: "4px 0 0" }}>Barang sudah siap, menunggu diambil kurir.</p>
            )}
          </div>
        ))
      )}
      {detailOrder && <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} clientId={toko?.id} />}
    </div>
  );
}

// ============================================================
// DAFTAR ORDER UNTUK DIPESAN ULANG (halaman tersendiri dari menu Akun)
// ============================================================
function OrderUlangListScreen({ orders, onReorder, onBack }) {
  const reorderable = orders.filter((o) => o.status !== "Dibatalkan");
  return (
    <div style={{ minHeight: "100vh", padding: "18px 20px 40px" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#F7F5F1", margin: "-18px -20px 0", padding: "18px 20px 10px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, marginBottom: 12 }}>
        <ChevronLeft size={18} /> Kembali
      </button>
      </div>
      <h1 className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>Order Ulang</h1>
      <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 18px" }}>Salin order sebelumnya, tidak perlu pilih barang dari awal.</p>

      {reorderable.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "#9CA0A6", textAlign: "center", padding: "40px 0" }}>Belum ada riwayat order.</p>
      ) : (
        reorderable.map((o) => (
          <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #EDEAE3", borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{o.id}</p>
              <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 2px" }}>{o.tanggal.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {o.items.map((i) => i.nama).join(", ")}
              </p>
            </div>
            <button
              onClick={() => onReorder(o)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 9, border: "none", background: "#F7F5F1", color: "#24272B", fontSize: 12, fontWeight: 700, flexShrink: 0 }}
            >
              <RotateCcw size={13} /> Order Ulang
            </button>
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================
// KONFIRMASI ORDER ULANG (halaman baru sebelum langsung isi keranjang)
// ============================================================
function ReorderConfirmScreen({ order, onConfirm, onBack }) {
  return (
    <div style={{ minHeight: "100vh", padding: "18px 20px 100px" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#F7F5F1", margin: "-18px -20px 0", padding: "18px 20px 10px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, marginBottom: 12 }}>
        <ChevronLeft size={18} /> Kembali
      </button>
      </div>
      <h1 className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>Order Ulang</h1>
      <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 20px" }}>
        Berdasarkan pesanan {order.id} · {order.tanggal.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
      </p>

      <p style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 8px" }}>Barang yang akan dipesan lagi</p>
      {order.items.map((it, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #EDEAE3", borderRadius: 12, padding: 14, marginBottom: 10 }}>
          <div style={{ width: 48, height: 48, borderRadius: 10, background: it.gambarUrl ? `url(${it.gambarUrl}) center/cover` : "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {!it.gambarUrl && <Package size={20} color="#D8D6D0" />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13.5, fontWeight: 600, color: "#24272B", margin: "0 0 2px" }}>{it.nama}</p>
            <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: 0 }}>{it.qty} {it.satuan} &times; {rupiah(it.harga)}</p>
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B" }}>{rupiah(it.harga * it.qty)}</span>
        </div>
      ))}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 14, borderTop: "2px solid #24272B" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#24272B" }}>Estimasi Total</span>
        <span className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B" }}>{rupiah(order.items.reduce((s, it) => s + it.harga * it.qty, 0))}</span>
      </div>
      <p style={{ fontSize: 11, color: "#9CA0A6", margin: "6px 0 0" }}>*Harga bisa berbeda dari sebelumnya, mengikuti harga & diskon yang berlaku saat ini.</p>

      <button
        onClick={onConfirm}
        style={{ width: "100%", marginTop: 24, padding: "15px", borderRadius: 12, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 15 }}
      >
        Pesan Lagi Sekarang
      </button>
    </div>
  );
}

// ============================================================
// MODAL DETAIL PESANAN
// ============================================================
// ============================================================
// TIMELINE VISUAL - progress pesanan step-by-step, supaya toko bisa
// pantau posisi pesanannya dengan jelas
// ============================================================
function OrderTrackingTimeline({ status, waktuTahap }) {
  if (status === "Dibatalkan") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, background: "#FBEAEA", borderRadius: 10, marginBottom: 16 }}>
        <X size={16} color="#C0392B" />
        <p style={{ fontSize: 13, fontWeight: 700, color: "#C0392B", margin: 0 }}>Pesanan Dibatalkan</p>
      </div>
    );
  }
  if (status === "Diretur" || status === "Retur Selesai") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, background: "#FBF0D9", borderRadius: 10, marginBottom: 16 }}>
        <RotateCcw size={16} color="#B8860B" />
        <p style={{ fontSize: 13, fontWeight: 700, color: "#B8860B", margin: 0 }}>{status === "Retur Selesai" ? "Retur Sudah Diselesaikan" : "Pesanan Sedang Diretur"}</p>
      </div>
    );
  }

  function formatWaktu(iso) {
    if (!iso) return null;
    return new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const langkah = [
    { label: "Pesanan Diterima", waktu: waktuTahap?.diterima },
    { label: "Disetujui", waktu: waktuTahap?.disetujui },
    { label: "Dikemas", waktu: waktuTahap?.dikemas },
    { label: "Siap Dikirim", waktu: waktuTahap?.siapKirim },
    { label: "Dikirim", waktu: waktuTahap?.dikirim },
    { label: "Selesai", waktu: waktuTahap?.selesai },
  ];
  const stepIndex = {
    "Menunggu Persetujuan": 0,
    "Menunggu Pembayaran": 1,
    "Sedang Diproses": 2,
    "Siap Dikirim": 3,
    "Dikirim": 4,
    "Selesai": 5,
  }[status] ?? 0;

  return (
    <div style={{ marginBottom: 18, padding: "16px 4px" }}>
      {langkah.map((step, i) => (
        <div key={i} style={{ display: "flex", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              background: i <= stepIndex ? "#28685D" : "#F0EDE6",
              color: i <= stepIndex ? "#fff" : "#B8B4AB",
            }}>
              {i < stepIndex ? <Check size={13} /> : <span style={{ fontSize: 10, fontWeight: 700 }}>{i + 1}</span>}
            </div>
            {i < langkah.length - 1 && (
              <div style={{ width: 2, flex: 1, minHeight: 22, background: i < stepIndex ? "#28685D" : "#F0EDE6" }} />
            )}
          </div>
          <div style={{ margin: "0 0 20px" }}>
            <p style={{ fontSize: 13, fontWeight: i === stepIndex ? 700 : 600, color: i <= stepIndex ? "#24272B" : "#B8B4AB", margin: 0 }}>
              {step.label}
              {i === stepIndex && <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#28685D", marginTop: 2 }}>Tahap saat ini</span>}
            </p>
            {formatWaktu(step.waktu) && (
              <p style={{ fontSize: 11, color: "#9CA0A6", margin: "3px 0 0" }}>{formatWaktu(step.waktu)}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function OrderDetailModal({ order, onClose, clientId }) {
  const [ratingTersimpan, setRatingTersimpan] = useState(null); // null = belum dicek, {} = belum ada, {...} = sudah ada
  const [showFormRating, setShowFormRating] = useState(false);
  const [ratingInput, setRatingInput] = useState(0);
  const [kategoriKomplain, setKategoriKomplain] = useState("");
  const [catatanInput, setCatatanInput] = useState("");
  const [mengirimRating, setMengirimRating] = useState(false);

  useEffect(() => {
    if (order.status !== "Selesai" && order.status !== "Retur Selesai") return;
    supabaseFetch(`rating_pesanan?select=*&order_id=eq.${order.dbId}`)
      .then((rows) => setRatingTersimpan(rows?.[0] || {}))
      .catch(() => setRatingTersimpan({}));
  }, [order.dbId]);

  async function kirimRating() {
    if (ratingInput === 0) {
      alert("Pilih dulu bintang ratingnya.");
      return;
    }
    if (ratingInput <= 3 && !kategoriKomplain) {
      alert("Pilih dulu kategori masalahnya, supaya kami bisa perbaiki.");
      return;
    }
    setMengirimRating(true);
    try {
      const [inserted] = await supabaseFetch("rating_pesanan", {
        method: "POST",
        body: JSON.stringify({
          order_id: order.dbId, client_id: clientId, rating: ratingInput,
          kategori_komplain: ratingInput <= 3 ? kategoriKomplain : null,
          catatan: catatanInput.trim() || null,
        }),
      });
      setRatingTersimpan(inserted);
      setShowFormRating(false);
    } catch (e) {
      alert("Gagal kirim rating: " + e.message);
    }
    setMengirimRating(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", padding: "20px 20px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 2px", fontWeight: 700, textTransform: "uppercase" }}>Detail Pesanan</p>
            <h2 className="disp" style={{ fontSize: 20, fontWeight: 700, color: "#24272B", margin: 0 }}>{order.id}</h2>
          </div>
          <button onClick={onClose} style={{ background: "#F7F5F1", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={16} color="#6B6F75" />
          </button>
        </div>
        <p style={{ fontSize: 12, color: "#9CA0A6", margin: "0 0 14px" }}>
          {order.tanggal.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999,
            color: order.status === "Dibatalkan" ? "#C0392B" : order.status === "Diretur" || order.status === "Retur Selesai" ? "#B8860B" : order.status === "Selesai" ? "#8A6A1A" : order.status === "Dikirim" || order.status === "Siap Dikirim" ? "#28685D" : "#B8860B",
            background: order.status === "Dibatalkan" ? "#FBEAEA" : order.status === "Diretur" || order.status === "Retur Selesai" ? "#FBF0D9" : order.status === "Selesai" ? "#EFE1BE" : order.status === "Dikirim" || order.status === "Siap Dikirim" ? "#D8E9E6" : "#FBF0D9",
          }}>
            {order.status}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: order.sudahBayar ? "#24272B" : "#C0392B", background: order.sudahBayar ? "#D8E9E6" : "#FBEAEA", padding: "4px 10px", borderRadius: 999 }}>
            {order.sudahBayar ? "Lunas" : "Belum Lunas"}
          </span>
          {order.isDropship && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#B8860B", background: "#FBF0D9", padding: "4px 10px", borderRadius: 999 }}>Dropship</span>
          )}
          {order.metodeBayar === "cod" && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#8A6A1A", background: "#FBF0D9", padding: "4px 10px", borderRadius: 999 }}>COD</span>
          )}
        </div>

        {order.status === "Dibatalkan" && order.alasanDibatalkan && (
          <div style={{ background: "#FBEAEA", borderRadius: 10, padding: 10, marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "#C0392B", margin: 0 }}>{order.alasanDibatalkan}</p>
          </div>
        )}

        {(order.status === "Diretur" || order.status === "Retur Selesai") && order.alasanRetur && (
          <div style={{ background: "#FBF0D9", borderRadius: 10, padding: 10, marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#B8860B", textTransform: "uppercase", margin: "0 0 4px" }}>Alasan Retur</p>
            <p style={{ fontSize: 12, color: "#B8860B", margin: 0 }}>{order.alasanRetur}</p>
          </div>
        )}

        <OrderTrackingTimeline status={order.status} waktuTahap={order.waktuTahap} />

        {(order.status === "Selesai" || order.status === "Retur Selesai") && ratingTersimpan !== null && (
          <div style={{ background: "#F7F5F1", borderRadius: 12, padding: 14, marginBottom: 18 }}>
            {ratingTersimpan.id ? (
              <>
                <p style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 6px" }}>Rating Anda</p>
                <div style={{ display: "flex", gap: 2, marginBottom: ratingTersimpan.catatan ? 8 : 0 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={18} fill={n <= ratingTersimpan.rating ? "#E8A426" : "none"} color={n <= ratingTersimpan.rating ? "#E8A426" : "#D8D6D0"} />
                  ))}
                </div>
                {ratingTersimpan.catatan && <p style={{ fontSize: 12.5, color: "#24272B", margin: 0 }}>{ratingTersimpan.catatan}</p>}
              </>
            ) : showFormRating ? (
              <>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: "0 0 10px" }}>Bagaimana pesanan ini?</p>
                <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} onClick={() => setRatingInput(n)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                      <Star size={30} fill={n <= ratingInput ? "#E8A426" : "none"} color={n <= ratingInput ? "#E8A426" : "#D8D6D0"} />
                    </button>
                  ))}
                </div>
                {ratingInput > 0 && ratingInput <= 3 && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6F75", margin: "0 0 8px" }}>Apa masalahnya?</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {[
                        { key: "kualitas_barang", label: "Kualitas Barang" },
                        { key: "salah_kirim", label: "Salah Kirim" },
                        { key: "kemasan_rusak", label: "Kemasan Rusak" },
                        { key: "pengiriman_lambat", label: "Pengiriman Lambat" },
                        { key: "lainnya", label: "Lainnya" },
                      ].map((k) => (
                        <button
                          key={k.key} onClick={() => setKategoriKomplain(k.key)}
                          style={{ padding: "6px 12px", borderRadius: 999, border: kategoriKomplain === k.key ? "1.5px solid #C0392B" : "1.5px solid #E4E1DA", background: kategoriKomplain === k.key ? "#FBEAEA" : "#fff", color: kategoriKomplain === k.key ? "#C0392B" : "#6B6F75", fontSize: 11.5, fontWeight: 600 }}
                        >
                          {k.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <textarea
                  value={catatanInput} onChange={(e) => setCatatanInput(e.target.value)}
                  placeholder="Catatan tambahan (opsional)..."
                  rows={2}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, resize: "vertical", marginBottom: 12 }}
                />
                <button
                  onClick={kirimRating} disabled={mengirimRating}
                  style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}
                >
                  {mengirimRating ? "Mengirim..." : "Kirim Rating"}
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowFormRating(true)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: 12, borderRadius: 10, border: "1.5px dashed #E8A426", background: "#FFFBF0", color: "#8A6A1A", fontWeight: 700, fontSize: 13.5 }}
              >
                <Star size={16} /> Beri Rating & Ulasan
              </button>
            )}
          </div>
        )}

        <p style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 8px" }}>Barang Dipesan</p>
        {order.items.map((it, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < order.items.length - 1 ? "1px solid #F0EDE6" : "none" }}>
            <div style={{ width: 44, height: 44, borderRadius: 9, background: it.gambarUrl ? `url(${it.gambarUrl}) center/cover` : "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {!it.gambarUrl && <Package size={18} color="#D8D6D0" />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#24272B", margin: "0 0 2px" }}>{it.nama}</p>
              <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: 0 }}>{it.qty} {it.satuan} &times; {rupiah(it.hargaDropship || it.harga)}</p>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#24272B" }}>{rupiah((it.hargaDropship || it.harga) * it.qty)}</span>
          </div>
        ))}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTop: "2px solid #24272B" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#24272B" }}>Total</span>
          <span className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B" }}>{rupiah(order.total)}</span>
        </div>

        {(order.tujuan?.nama || order.tujuan?.alamat) && (
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #EDEAE3" }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 6px" }}>Dikirim Ke</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#24272B", margin: "0 0 2px" }}>{order.tujuan.nama}</p>
            {order.tujuan.telp && <p style={{ fontSize: 12, color: "#6B6F75", margin: "0 0 2px" }}>{order.tujuan.telp}</p>}
            {order.tujuan.alamat && <p style={{ fontSize: 12, color: "#6B6F75", margin: 0 }}>{order.tujuan.alamat}</p>}
            {order.isDropship && order.pengirim && (
              <p style={{ fontSize: 11.5, color: "#B8860B", margin: "6px 0 0", fontWeight: 600 }}>Dropship a/n: {order.pengirim}</p>
            )}
          </div>
        )}

        {order.buktiTransferUrl && (
          <a href={order.buktiTransferUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 16, textAlign: "center", padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", color: "#24272B", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            Lihat Bukti Transfer
          </a>
        )}
      </div>
    </div>
  );
}

// ============================================================
// WIDGET KAMPANYE MENGAMBANG
// ============================================================
function FloatingCampaignWidget({ imageUrl, onClose, onOpenDetail }) {
  const WIDGET_SIZE = 64;
  const CLOSE_AREA = 26;
  const SAFE_MARGIN = 16;
  const BOTTOM_NAV_HEIGHT = 72; // tinggi bottom nav di app ini
  const GAP_ABOVE_NAV = 10; // jarak widget dengan bottom nav

  const clampTop = (value) => {
    const maxTop = window.innerHeight - WIDGET_SIZE - CLOSE_AREA - SAFE_MARGIN;
    const minTop = SAFE_MARGIN;
    return Math.min(maxTop, Math.max(minTop, value));
  };

  // Posisi default: tepat di atas bottom nav (dekat menu Akun)
  const [top, setTop] = useState(() =>
    clampTop(window.innerHeight - BOTTOM_NAV_HEIGHT - WIDGET_SIZE - CLOSE_AREA - GAP_ABOVE_NAV)
  );
  const [isShaking, setIsShaking] = useState(false);
  const dragState = useRef({ dragging: false, startY: 0, startTop: 0, moved: false });

  useEffect(() => {
    function onMove(e) {
      if (!dragState.current.dragging) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const delta = clientY - dragState.current.startY;
      if (Math.abs(delta) > 3) dragState.current.moved = true;
      setTop(clampTop(dragState.current.startTop + delta));
    }
    function onUp() {
      dragState.current.dragging = false;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  function handleDown(e) {
    dragState.current.dragging = true;
    dragState.current.moved = false;
    dragState.current.startY = e.touches ? e.touches[0].clientY : e.clientY;
    dragState.current.startTop = top;
    setIsShaking(true); // mulai animasi getar (dihentikan otomatis lewat onAnimationEnd)
  }

  function handleClick() {
    if (dragState.current.moved) return; // itu drag, bukan tap
    onOpenDetail();
  }

  return (
    // Bingkai tak terlihat selebar app (480px, sama seperti elemen fixed
    // lain di app ini) - supaya widget nempel ke kanan APP, bukan ke kanan
    // browser kalau layarnya lebih lebar dari 480px.
    <div style={{ position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, height: 0, zIndex: 200, pointerEvents: "none" }}>
      <style>{`
        @keyframes campaignShake {
          0% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
          100% { transform: translateX(0); }
        }
      `}</style>
      <div style={{ position: "absolute", top, right: 0, width: WIDGET_SIZE, height: WIDGET_SIZE + CLOSE_AREA, pointerEvents: "auto" }}>
        {/* Badan widget (gambar/GIF) */}
        <div
          onMouseDown={handleDown}
          onTouchStart={handleDown}
          onClick={handleClick}
          onAnimationEnd={() => setIsShaking(false)}
          style={{
            position: "absolute", top: CLOSE_AREA, left: 0, right: 0, height: WIDGET_SIZE,
            borderRadius: 14, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
            cursor: "pointer", touchAction: "none", background: "#fff",
            animation: isShaking ? "campaignShake 0.4s ease" : "none",
          }}
        >
          <ImgAutoRetry src={imageUrl} alt="Kampanye" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} draggable={false} />
        </div>

        {/* Tombol close - DI LUAR badan widget (area khusus di atasnya) */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 0, right: 4, width: 20, height: 20, borderRadius: "50%",
            border: "none", background: "rgba(0,0,0,0.2)", color: "#fff", display: "flex",
            alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.15)", padding: 0,
          }}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// HALAMAN DETAIL KAMPANYE
// ============================================================
// ============================================================
// CHAT CUSTOMER SERVICE - "CLARA"
// ============================================================
// ============================================================
// NOTIFIKASI (status pesanan & balasan chat)
// ============================================================
function NotifikasiScreen({ toko, onBack }) {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const rows = await supabaseFetch(`notifications?select=*&client_id=eq.${toko.id}&order=created_at.desc&limit=100`);
      setNotifs(rows);
      // Tandai semua sudah dibaca begitu halaman ini dibuka
      const unreadIds = rows.filter((n) => !n.is_read).map((n) => n.id);
      if (unreadIds.length > 0) {
        await supabaseFetch(`notifications?is_read=eq.false&client_id=eq.${toko.id}`, {
          method: "PATCH",
          body: JSON.stringify({ is_read: true }),
        });
      }
    } catch (e) {
      console.log("Gagal muat notifikasi:", e.message);
    }
    setLoading(false);
  }

  function waktuRelatif(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const menit = Math.floor(diffMs / 60000);
    if (menit < 1) return "Baru saja";
    if (menit < 60) return `${menit} menit lalu`;
    const jam = Math.floor(menit / 60);
    if (jam < 24) return `${jam} jam lalu`;
    const hari = Math.floor(jam / 24);
    return `${hari} hari lalu`;
  }

  return (
    <div style={{ minHeight: "100vh", padding: "0 0 20px" }}>
      <div style={{ padding: "20px 20px 16px", position: "sticky", top: 0, zIndex: 10, background: "#F7F5F1" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, marginBottom: 10 }}>
          <ChevronLeft size={18} /> Kembali
        </button>
        <h1 className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: 0 }}>Notifikasi</h1>
      </div>

      <div style={{ padding: "0 20px" }}>
        {loading ? (
          <p style={{ textAlign: "center", fontSize: 12.5, color: "#9CA0A6", padding: "40px 0" }}>Memuat...</p>
        ) : notifs.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#9CA0A6" }}>
            <Bell size={40} color="#D8D6D0" />
            <p style={{ marginTop: 12, fontSize: 14 }}>Belum ada notifikasi.</p>
          </div>
        ) : (
          notifs.map((n) => (
            <div key={n.id} style={{ background: n.is_read ? "#fff" : "#F7F5F1", border: "1px solid #EDEAE3", borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: 0 }}>{n.title}</p>
                {!n.is_read && <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E4453A", flexShrink: 0, marginTop: 4 }} />}
              </div>
              {n.body && <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "4px 0 6px", lineHeight: 1.4 }}>{n.body}</p>}
              <p style={{ fontSize: 11, color: "#B5B2AA", margin: 0 }}>{waktuRelatif(n.created_at)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// PILIHAN CHAT: CLARA (CS) ATAU SALES
// ============================================================
function CsChatChoiceScreen({ toko, onBack, onContactCS, products, orders, cart, rincian }) {
  const [activeTab, setActiveTab] = useState("clara"); // "clara" | "sales"
  const [salesInfo, setSalesInfo] = useState(null);
  const [showCaseHistory, setShowCaseHistory] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [caseHistoryList, setCaseHistoryList] = useState([]);
  const [caseHistorySearch, setCaseHistorySearch] = useState("");
  const [loadingCaseHistory, setLoadingCaseHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("sales"); // "sales" | "clara"

  // ---- state chat CLARA (Customer Service - manusia asli, terhubung ke
  // Chat Toko, ditangani Admin Transaksi) ----
  const [claraCaseInfo, setClaraCaseInfo] = useState(null);
  const [claraMessages, setClaraMessages] = useState([]);
  const [claraInput, setClaraInput] = useState("");
  const [claraSending, setClaraSending] = useState(false);
  const [claraLoading, setClaraLoading] = useState(true);
  const claraScrollRef = useRef(null);
  const claraPollRef = useRef(null);

  // ---- state chat SALES ----
  const [caseInfo, setCaseInfo] = useState(null);
  const [salesMessages, setSalesMessages] = useState([]);
  const [salesInput, setSalesInput] = useState("");
  const [salesSending, setSalesSending] = useState(false);
  const [salesLoading, setSalesLoading] = useState(true);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showPickProduk, setShowPickProduk] = useState(false);
  const [showPickPesanan, setShowPickPesanan] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const salesScrollRef = useRef(null);
  const pollRef = useRef(null);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  useEffect(() => {
    if (!toko?.salesId) return;
    supabaseFetch(`sales?select=nama,kode,foto_url&id=eq.${toko.salesId}`)
      .then((rows) => setSalesInfo(rows[0] || null))
      .catch(() => setSalesInfo(null));
  }, [toko?.salesId]);

  useEffect(() => {
    loadExistingCaseOnly();
    loadExistingClaraCase();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (claraPollRef.current) clearInterval(claraPollRef.current);
    };
  }, []);

  // Cuma AMBIL kasus CLARA yang sudah ada (kalau ada) - sama polanya
  // seperti sales, tapi kategori='clara'.
  async function loadExistingClaraCase() {
    setClaraLoading(true);
    try {
      const existing = await supabaseFetch(`chat_cases?select=*&client_id=eq.${toko.id}&kategori=eq.clara&status=eq.open&order=created_at.desc&limit=1`);
      if (existing[0]) {
        setClaraCaseInfo(existing[0]);
        await loadClaraMessages(existing[0].id);
        claraPollRef.current = setInterval(() => loadClaraMessages(existing[0].id), 4000);
      }
    } catch (e) {
      console.log("Gagal buka chat Clara:", e.message);
    }
    setClaraLoading(false);
  }

  async function loadClaraMessages(caseId) {
    try {
      const rows = await supabaseFetch(`chat_messages?select=*&case_id=eq.${caseId}&order=created_at.asc`);
      setClaraMessages(rows);
    } catch (e) { /* diamkan, coba lagi di polling berikutnya */ }
  }

  // Cuma AMBIL kasus yang sudah ada (kalau ada) - TIDAK bikin No Case baru di
  // sini. No Case baru dibuat pas toko benar-benar kirim pesan pertama.
  async function loadExistingCaseOnly() {
    setSalesLoading(true);
    try {
      const existing = await supabaseFetch(`chat_cases?select=*&client_id=eq.${toko.id}&kategori=eq.sales&status=eq.open&order=created_at.desc&limit=1`);
      if (existing[0]) {
        setCaseInfo(existing[0]);
        await loadMessages(existing[0].id);
        pollRef.current = setInterval(() => loadMessages(existing[0].id), 4000);
      }
    } catch (e) {
      console.log("Gagal buka chat sales:", e.message);
    }
    setSalesLoading(false);
  }

  async function loadMessages(caseId) {
    try {
      const rows = await supabaseFetch(`chat_messages?select=*&case_id=eq.${caseId}&order=created_at.asc`);
      setSalesMessages(rows);
    } catch (e) { /* diamkan, coba lagi di polling berikutnya */ }
  }

  useEffect(() => {
    claraScrollRef.current?.scrollTo({ top: claraScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [claraMessages, claraSending]);

  useEffect(() => {
    salesScrollRef.current?.scrollTo({ top: salesScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [salesMessages]);

  async function openCaseHistory() {
    setShowMoreMenu(false);
    setShowCaseHistory(true);
    setLoadingCaseHistory(true);
    try {
      const rows = await supabaseFetch(`chat_cases?select=id,no_case,status,created_at,kategori&client_id=eq.${toko.id}&order=created_at.desc`);
      setCaseHistoryList(rows);
    } catch (e) {
      console.log("Gagal muat riwayat case:", e.message);
    }
    setLoadingCaseHistory(false);
  }

  // ================= FUNGSI CHAT (generik - dipakai baik tab Clara maupun
  // Sales, tinggal cek activeTab buat tahu case/state mana yang dipakai) =================
  async function sendMessage({ message, image_url, tipe_pesan }) {
    const isClara = activeTab === "clara";
    if (isClara ? claraSending : salesSending) return;
    (isClara ? setClaraSending : setSalesSending)(true);
    try {
      let activeCase = isClara ? claraCaseInfo : caseInfo;
      if (!activeCase) {
        const [created] = await supabaseFetch("chat_cases", {
          method: "POST",
          body: JSON.stringify(
            isClara
              ? { client_id: toko.id, kategori: "clara" }
              : { client_id: toko.id, sales_id: toko.salesId || null, kategori: "sales" }
          ),
        });
        activeCase = created;
        if (isClara) {
          setClaraCaseInfo(created);
          claraPollRef.current = setInterval(() => loadClaraMessages(created.id), 4000);
        } else {
          setCaseInfo(created);
          pollRef.current = setInterval(() => loadMessages(created.id), 4000);
        }
      }
      const [inserted] = await supabaseFetch("chat_messages", {
        method: "POST",
        body: JSON.stringify({ case_id: activeCase.id, sender_type: "toko", message: message || "", image_url: image_url || null, tipe_pesan: tipe_pesan || "teks" }),
      });
      (isClara ? setClaraMessages : setSalesMessages)((prev) => [...prev, inserted]);
    } catch (e) {
      alert("Gagal kirim pesan: " + e.message);
    }
    (isClara ? setClaraSending : setSalesSending)(false);
  }

  async function handleSendSales() {
    const isClara = activeTab === "clara";
    const text = (isClara ? claraInput : salesInput).trim();
    if (!text) return;
    (isClara ? setClaraInput : setSalesInput)("");
    await sendMessage({ message: text, tipe_pesan: "teks" });
  }

  function insertEmoji(emoji) {
    if (activeTab === "clara") setClaraInput((prev) => prev + emoji);
    else setSalesInput((prev) => prev + emoji);
    setShowEmoji(false);
  }

  async function handlePickImage(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setShowAttachMenu(false);
    setUploadingImage(true);
    try {
      const compressed = await compressImage(file);
      const { ext, contentType } = infoFileTerkompresi(compressed, file);
      const filePath = `chat-${activeTab}-${toko.id}-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/produk-gambar/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": contentType },
        body: compressed,
      });
      if (!res.ok) throw new Error(await res.text());
      const url = `${SUPABASE_URL}/storage/v1/object/public/produk-gambar/${filePath}`;
      await sendMessage({ image_url: url, tipe_pesan: "gambar" });
    } catch (e) {
      alert("Gagal upload foto: " + e.message);
    }
    setUploadingImage(false);
  }

  async function kirimTroli() {
    setShowAttachMenu(false);
    const entries = Object.entries(cart || {});
    if (entries.length === 0) {
      alert("Keranjang Anda masih kosong.");
      return;
    }
    const lines = entries.map(([kode, qty]) => {
      const p = (products || []).find((x) => x.kode === kode);
      return `- ${p?.nama || kode} x${qty}`;
    });
    const total = rincian?.totalSetelahDiskon ?? rincian?.total ?? 0;
    const text = `\ud83d\uded2 Nanya soal keranjang saya:\n${lines.join("\n")}\nEstimasi total: ${rupiah(total)}`;
    await sendMessage({ message: text, tipe_pesan: "troli" });
  }

  async function kirimProduk(p) {
    setShowPickProduk(false);
    setShowAttachMenu(false);
    await sendMessage({ message: `\ud83d\udce6 Nanya soal barang: ${p.nama} (${p.kode})`, tipe_pesan: "produk" });
  }

  async function kirimPesanan(o) {
    setShowPickPesanan(false);
    setShowAttachMenu(false);
    await sendMessage({ message: `\ud83e\uddfe Nanya soal pesanan: ${o.id}`, tipe_pesan: "pesanan" });
  }

  async function tutupKasus() {
    const isClara = activeTab === "clara";
    const activeCase = isClara ? claraCaseInfo : caseInfo;
    if (!activeCase || activeCase.status === "closed") return;
    if (!confirm("Tutup obrolan ini? Kalau nanti chat lagi, akan mulai No. Case baru.")) return;
    try {
      await supabaseFetch(`chat_cases?id=eq.${activeCase.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "closed" }),
      });
      (isClara ? setClaraCaseInfo : setCaseInfo)((prev) => ({ ...prev, status: "closed" }));
      if (isClara) { if (claraPollRef.current) clearInterval(claraPollRef.current); }
      else { if (pollRef.current) clearInterval(pollRef.current); }
    } catch (e) {
      alert("Gagal menutup obrolan: " + e.message);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", background: "#F7F5F1", zIndex: 300 }}>
      {/* HEADER */}
      <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", borderBottom: "1px solid #EDEAE3", flexShrink: 0, position: "relative" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", padding: 0, flexShrink: 0 }}>
          <ChevronLeft size={20} color="#24272B" />
        </button>
        <p className="disp" style={{ fontSize: 16, fontWeight: 700, color: "#24272B", margin: 0, flex: 1, textAlign: "center", padding: "0 8px" }}>Customer Service Centre</p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, position: "relative", flexShrink: 0 }}>
          <button onClick={openCaseHistory} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <History size={16} color="#24272B" />
          </button>
          <button onClick={() => setShowMoreMenu((v) => !v)} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MoreVertical size={16} color="#24272B" />
          </button>
          {showMoreMenu && (
            <div style={{ position: "absolute", top: 40, right: 0, background: "#fff", borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", padding: 6, minWidth: 160, zIndex: 20 }}>
              <button
                onClick={() => { setShowMoreMenu(false); onContactCS?.(); }}
                style={{ width: "100%", textAlign: "left", padding: "10px 12px", background: "none", border: "none", fontSize: 13, color: "#24272B", borderRadius: 7, display: "flex", alignItems: "center", gap: 8 }}
              >
                <Headphones size={15} /> Kontak CS
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TAB CLARA | SALES - langsung tampilkan chat, tanpa perlu pindah halaman */}
      <div style={{ display: "flex", gap: 8, padding: "12px 20px", background: "#fff", borderBottom: "1px solid #EDEAE3", flexShrink: 0 }}>
        <button
          onClick={() => setActiveTab("clara")}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px", borderRadius: 12, border: activeTab === "clara" ? "1.5px solid #E8A426" : "1.5px solid #EDEAE3", background: activeTab === "clara" ? "#FBF0D9" : "#fff" }}
        >
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg, #E8A426, #D6871A)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Headphones size={22} color="#fff" />
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: 0 }}>CLARA</p>
            <p style={{ fontSize: 10.5, color: "#9CA0A6", margin: 0 }}>Customer Service</p>
          </div>
        </button>
        <button
          onClick={() => setActiveTab("sales")}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px", borderRadius: 12, border: activeTab === "sales" ? "1.5px solid #E8A426" : "1.5px solid #EDEAE3", background: activeTab === "sales" ? "#FBF0D9" : "#fff" }}
        >
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#D8E9E6", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img
              src={salesInfo?.foto_url || `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(salesInfo?.nama || "Sales")}`}
              alt={salesInfo?.nama || "Sales"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { e.target.style.display = "none"; }}
            />
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: 0 }}>{salesInfo ? salesInfo.nama : "Sales"}</p>
            <p style={{ fontSize: 10.5, color: "#9CA0A6", margin: 0 }}>Sales</p>
          </div>
        </button>
      </div>

      {/* ===================== ISI CHAT (generik - Clara atau Sales) ===================== */}
      {(activeTab === "clara" || activeTab === "sales") && (() => {
        const isClaraTab = activeTab === "clara";
        const activeCaseInfo = isClaraTab ? claraCaseInfo : caseInfo;
        const activeMessages = isClaraTab ? claraMessages : salesMessages;
        const activeLoadingChat = isClaraTab ? claraLoading : salesLoading;
        const activeScrollRef = isClaraTab ? claraScrollRef : salesScrollRef;
        const activeInputValue = isClaraTab ? claraInput : salesInput;
        const setActiveInputValue = isClaraTab ? setClaraInput : setSalesInput;
        const activeSendingChat = isClaraTab ? claraSending : salesSending;
        const namaLawanBicara = isClaraTab ? "Clara" : "sales";

        return activeLoadingChat ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#9CA0A6", fontSize: 13 }}>Memuat chat...</p>
          </div>
        ) : (
          <>
            <div style={{ padding: "10px 20px", background: "#fff", borderBottom: "1px solid #EDEAE3", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <p style={{ fontSize: 10.5, color: "#B5B2AA", margin: 0 }}>{activeCaseInfo?.no_case ? `No. Case: ${activeCaseInfo.no_case}` : "Belum ada No. Case - kirim pesan dulu"}</p>
              {activeCaseInfo && activeCaseInfo.status === "open" && (
                <button onClick={tutupKasus} style={{ padding: "5px 10px", borderRadius: 7, border: "1.5px solid #F0CFC7", background: "#fff", color: "#C0392B", fontSize: 11, fontWeight: 700 }}>
                  Tutup
                </button>
              )}
            </div>
            <div ref={activeScrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {activeMessages.length === 0 && (
                <p style={{ textAlign: "center", fontSize: 12.5, color: "#9CA0A6", padding: "20px 0" }}>
                  {isClaraTab
                    ? `Halo${toko?.nama ? " " + toko.nama : ""}! Saya Clara, Customer Service di sini. Tulis pertanyaan Anda seputar produk, pesanan, atau pembayaran.`
                    : "Belum ada pesan. Tulis pertanyaan Anda, sales akan membalas sesegera mungkin."}
                </p>
              )}
              {activeMessages.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: m.sender_type === "toko" ? "flex-end" : "flex-start", marginBottom: 12 }}>
                  {m.tipe_pesan === "gambar" && m.image_url ? (
                    <ImgAutoRetry src={m.image_url} alt="Lampiran" style={{ maxWidth: "60%", borderRadius: 14, display: "block" }} />
                  ) : (
                    <div style={{
                      maxWidth: "78%", padding: "10px 14px", borderRadius: 14,
                      background: m.sender_type === "toko" ? "#E8A426" : "#fff",
                      border: m.sender_type === "toko" ? "none" : "1px solid #EDEAE3",
                      fontSize: 13.5, lineHeight: 1.5, color: "#24272B", whiteSpace: "pre-line",
                      borderBottomRightRadius: m.sender_type === "toko" ? 4 : 14,
                      borderBottomLeftRadius: m.sender_type === "toko" ? 14 : 4,
                    }}>
                      {m.message}
                    </div>
                  )}
                </div>
              ))}
              {uploadingImage && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                  <div style={{ padding: "10px 14px", borderRadius: 14, background: "#FBF0D9", fontSize: 12.5, color: "#B8860B" }}>Mengirim foto...</div>
                </div>
              )}
            </div>

            {activeCaseInfo?.status === "closed" ? (
              <div style={{ padding: "14px 20px", background: "#fff", borderTop: "1px solid #EDEAE3", flexShrink: 0, textAlign: "center" }}>
                <p style={{ fontSize: 12, color: "#9CA0A6", margin: 0 }}>Obrolan ini sudah ditutup.</p>
              </div>
            ) : (
              <div style={{ background: "#fff", borderTop: "1px solid #EDEAE3", flexShrink: 0, position: "relative" }}>
                {showAttachMenu && (
                  <div style={{ padding: "16px 20px", borderBottom: "1px solid #EDEAE3", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                    {[
                      { icon: Smile, label: "Emoji", onClick: () => { setShowEmoji(true); setShowAttachMenu(false); } },
                      { icon: Camera, label: "Ambil Foto", onClick: () => cameraInputRef.current?.click() },
                      { icon: ImageIcon, label: "Album Foto", onClick: () => galleryInputRef.current?.click() },
                      { icon: ShoppingCart, label: "Troli", onClick: kirimTroli },
                      { icon: Package, label: "Riwayat Produk", onClick: () => { setShowPickProduk(true); setShowAttachMenu(false); } },
                      { icon: ClipboardList, label: "Riwayat Pesanan", onClick: () => { setShowPickPesanan(true); setShowAttachMenu(false); } },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <button key={item.label} onClick={item.onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", border: "none", padding: 4 }}>
                          <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icon size={20} color="#24272B" />
                          </div>
                          <span style={{ fontSize: 10.5, color: "#6B6F75", textAlign: "center" }}>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {showEmoji && (
                  <div style={{ padding: "12px 20px", borderBottom: "1px solid #EDEAE3", display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {["\ud83d\ude00","\ud83d\ude02","\ud83d\ude0d","\ud83d\udc4d","\ud83d\ude4f","\ud83d\ude22","\ud83d\ude21","\ud83c\udf89","\u2764\ufe0f","\ud83d\udd25","\ud83d\udc4c","\ud83d\ude05","\ud83e\udd14","\ud83d\ude34","\ud83d\ude4c","\u2705"].map((e) => (
                      <button key={e} onClick={() => insertEmoji(e)} style={{ fontSize: 22, background: "none", border: "none", padding: 2 }}>{e}</button>
                    ))}
                  </div>
                )}

                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handlePickImage} />
                <input ref={galleryInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePickImage} />

                <div style={{ padding: "12px 20px", display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={() => { setShowAttachMenu((v) => !v); setShowEmoji(false); }}
                    style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: showAttachMenu ? "#E8A426" : "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                  >
                    <Plus size={18} color={showAttachMenu ? "#24272B" : "#6B6F75"} />
                  </button>
                  <input
                    value={activeInputValue}
                    onChange={(e) => setActiveInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendSales()}
                    onFocus={() => { setShowAttachMenu(false); setShowEmoji(false); }}
                    placeholder="Tulis pesan..."
                    enterKeyHint="send"
                    style={{ flex: 1, padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E4E1DA", fontSize: 13.5, outline: "none" }}
                  />
                  <button
                    onClick={handleSendSales}
                    disabled={activeSendingChat || !activeInputValue.trim()}
                    style={{ padding: "0 18px", height: 44, borderRadius: 10, border: "none", background: (activeSendingChat || !activeInputValue.trim()) ? "#E4E1DA" : "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                  >
                    Kirim
                  </button>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* Modal riwayat kasus - cuma daftar, tidak bisa lihat isi percakapan lama */}
      {showCaseHistory && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 400 }}>
          <div style={{ background: "#fff", borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 480, maxHeight: "75vh", overflowY: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p className="disp" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Riwayat Kasus</p>
              <button onClick={() => setShowCaseHistory(false)} style={{ background: "none", border: "none" }}><X size={20} /></button>
            </div>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <Search size={15} color="#9CA0A6" style={{ position: "absolute", left: 12, top: 11 }} />
              <input
                value={caseHistorySearch}
                onChange={(e) => setCaseHistorySearch(e.target.value)}
                placeholder="Cari No. Case..."
                style={{ width: "100%", padding: "9px 12px 9px 34px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13 }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <button
                onClick={() => setHistoryFilter("clara")}
                style={{ flex: 1, padding: "9px", borderRadius: 9, border: historyFilter === "clara" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: historyFilter === "clara" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
              >
                CLARA
              </button>
              <button
                onClick={() => setHistoryFilter("sales")}
                style={{ flex: 1, padding: "9px", borderRadius: 9, border: historyFilter === "sales" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: historyFilter === "sales" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
              >
                Salesman
              </button>
            </div>
            {loadingCaseHistory ? (
              <p style={{ fontSize: 12.5, color: "#9CA0A6", textAlign: "center", padding: "20px 0" }}>Memuat...</p>
            ) : (
              caseHistoryList
                .filter((c) => c.kategori === historyFilter)
                .filter((c) => c.no_case?.toLowerCase().includes(caseHistorySearch.toLowerCase()))
                .map((c) => (
                  <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 4px", borderBottom: "1px solid #F0EDE6" }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: "#24272B" }}>{c.no_case}</p>
                      <p style={{ fontSize: 11, color: "#9CA0A6", margin: 0 }}>{new Date(c.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: c.status === "open" ? "#D8E9E6" : "#F7F5F1", color: c.status === "open" ? "#24272B" : "#9CA0A6" }}>
                      {c.status === "open" ? "Terbuka" : "Ditutup"}
                    </span>
                  </div>
                ))
            )}
            {!loadingCaseHistory && caseHistoryList.filter((c) => c.kategori === historyFilter).length === 0 && (
              <p style={{ fontSize: 12.5, color: "#9CA0A6", textAlign: "center", padding: "20px 0" }}>Belum ada riwayat kasus.</p>
            )}
          </div>
        </div>
      )}

      {/* Modal pilih produk dari riwayat */}
      {showPickProduk && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 400 }}>
          <div style={{ background: "#fff", borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 480, maxHeight: "70vh", overflowY: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p className="disp" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Pilih Produk</p>
              <button onClick={() => setShowPickProduk(false)} style={{ background: "none", border: "none" }}><X size={20} /></button>
            </div>
            {(products || []).map((p) => (
              <button key={p.kode} onClick={() => kirimProduk(p)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", background: "none", border: "none", borderBottom: "1px solid #F0EDE6", textAlign: "left" }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: p.gambarUrl ? `url(${p.gambarUrl}) center/cover` : "#F7F5F1", flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{p.nama}</p>
                  <p style={{ fontSize: 11, color: "#9CA0A6", margin: 0 }}>{p.kode}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modal pilih pesanan dari riwayat */}
      {showPickPesanan && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 400 }}>
          <div style={{ background: "#fff", borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 480, maxHeight: "70vh", overflowY: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p className="disp" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Pilih Pesanan</p>
              <button onClick={() => setShowPickPesanan(false)} style={{ background: "none", border: "none" }}><X size={20} /></button>
            </div>
            {(orders || []).length === 0 && <p style={{ fontSize: 12.5, color: "#9CA0A6", textAlign: "center", padding: "20px 0" }}>Belum ada riwayat pesanan.</p>}
            {(orders || []).map((o) => (
              <button key={o.id} onClick={() => kirimPesanan(o)} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 4px", background: "none", border: "none", borderBottom: "1px solid #F0EDE6", textAlign: "left" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{o.id}</p>
                  <p style={{ fontSize: 11, color: "#9CA0A6", margin: 0 }}>{o.tanggal.toLocaleDateString("id-ID")}</p>
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{rupiah(o.total)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================
// DETAIL KAMPANYE
// ============================================================
function CampaignDetailScreen({ onBack, cartCount, onGoToCart, judul, deskripsi }) {
  const [galeri, setGaleri] = useState([]);

  useEffect(() => {
    supabaseFetch("campaign_banner_images?select=*&order=urutan.asc")
      .then(setGaleri)
      .catch(() => setGaleri([]));
  }, []);

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #EDEAE3", position: "sticky", top: 0, zIndex: 10, background: "#fff" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#24272B", fontSize: 14, fontWeight: 600, padding: 0 }}>
          <ChevronLeft size={20} /> Kembali
        </button>
        <button onClick={onGoToCart} style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <ShoppingCart size={17} color="#24272B" />
          {cartCount > 0 && (
            <span style={{ position: "absolute", top: -4, right: -4, background: "#E8A426", color: "#24272B", fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
              {cartCount}
            </span>
          )}
        </button>
      </div>
      <div style={{ padding: "20px 20px 0" }}>
        <h1 className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>{judul || "Promo Spesial!"}</h1>
        <p style={{ fontSize: 13.5, color: "#6B6F75", lineHeight: 1.6, whiteSpace: "pre-line", marginBottom: galeri.length > 0 ? 20 : 40 }}>
          {deskripsi || "Belum ada konten promo."}
        </p>
      </div>
      {galeri.length > 0 && (
        <div>
          {galeri.map((img) => (
            <ImgAutoRetry key={img.id} src={img.url} alt="" style={{ width: "100%", display: "block" }} />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuRow({ icon: Icon, label, onClick, badge }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "#fff", border: "1px solid #EDEAE3", borderRadius: 12, padding: 14, marginBottom: 10, textAlign: "left" }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={17} color="#24272B" />
      </div>
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "#24272B" }}>{label}</span>
      {badge && (
        <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: badge.bg, color: badge.color, marginRight: 4 }}>
          {badge.text}
        </span>
      )}
      <ChevronRight size={17} color="#B5B2AA" />
    </button>
  );
}

// ============================================================
// REKENING / KETENTUAN PEMBAYARAN
// ============================================================
// ============================================================
// SALDO SAYA - lihat saldo, nomor VA, dan riwayat transaksi
// ============================================================
// ============================================================
// FOTO TOKO - upload foto toko & KTP untuk verifikasi (wajib sebelum order)
// ============================================================
function VerifikasiTokoScreen({ toko, authToken, onBack, onUpdated }) {
  const [fotoToko, setFotoToko] = useState(toko.fotoTokoUrl);
  const [fotoKtp, setFotoKtp] = useState(toko.fotoKtpUrl);
  const [uploadingToko, setUploadingToko] = useState(false);
  const [uploadingKtp, setUploadingKtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [editMode, setEditMode] = useState(false);

  // Alur verifikasi email sebelum boleh ubah foto:
  // "none" -> "sending" -> "input_code" -> (masuk editMode kalau kode benar)
  const [emailOtpStep, setEmailOtpStep] = useState("none");
  const [fotoKtpDisplayUrl, setFotoKtpDisplayUrl] = useState(null);

  useEffect(() => {
    // Kalau toko sudah pernah upload KTP sebelumnya, ambil signed URL-nya
    // supaya bisa ditampilkan (path mentahnya tidak bisa diakses langsung)
    if (toko.fotoKtpUrl) {
      getSignedKtpUrl(toko.fotoKtpUrl).then(setFotoKtpDisplayUrl);
    }
  }, []);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);

  async function mulaiVerifikasiEmail() {
    setEmailOtpStep("sending");
    setOtpError("");
    setOtpBusy(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: toko.email, create_user: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || data.error_description || "Gagal kirim kode ke email.");
      setEmailOtpStep("input_code");
    } catch (e) {
      alert("Gagal kirim kode verifikasi: " + e.message);
      setEmailOtpStep("none");
    }
    setOtpBusy(false);
  }

  async function verifikasiKodeEmail() {
    if (!otpCode.trim()) {
      setOtpError("Masukkan kode yang dikirim ke email Anda.");
      return;
    }
    setOtpBusy(true);
    setOtpError("");
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: toko.email, token: otpCode.trim(), type: "email" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || data.error_description || "Kode salah atau sudah kedaluwarsa.");
      setEmailOtpStep("none");
      setOtpCode("");
      setEditMode(true);
    } catch (e) {
      setOtpError(e.message);
    }
    setOtpBusy(false);
  }

  async function uploadFoto(file, jenis) {
    const setUploading = jenis === "toko" ? setUploadingToko : setUploadingKtp;
    const setUrl = jenis === "toko" ? setFotoToko : setFotoKtp;
    setUploading(true);
    try {
      // Foto KTP butuh tetap jelas terbaca (buat verifikasi identitas) -
      // pakai kualitas/dimensi lebih tinggi dibanding foto toko biasa.
      const compressed = jenis === "ktp" ? await compressImage(file, 1600, 0.88) : await compressImage(file);
      const { ext, contentType } = infoFileTerkompresi(compressed, file);
      const filePath = `verifikasi-${jenis}-${toko.id}-${Date.now()}.${ext}`;

      if (jenis === "ktp") {
        // Foto KTP masuk bucket PRIVAT - tidak ada URL publik sama sekali.
        // Yang disimpan cuma PATH-nya, nanti ditampilkan lewat signed URL
        // sementara (lihat getSignedKtpUrl).
        const res = await fetch(`${SUPABASE_URL}/storage/v1/object/dokumen-verifikasi/${filePath}`, {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": contentType },
          body: compressed,
        });
        if (!res.ok) throw new Error(await res.text());
        setUrl(filePath);
        const signed = await getSignedKtpUrl(filePath);
        setFotoKtpDisplayUrl(signed);
      } else {
        const res = await fetch(`${SUPABASE_URL}/storage/v1/object/produk-gambar/${filePath}`, {
          method: "POST",
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": contentType },
          body: compressed,
        });
        if (!res.ok) throw new Error(await res.text());
        const url = `${SUPABASE_URL}/storage/v1/object/public/produk-gambar/${filePath}`;
        setUrl(url);
      }
    } catch (e) {
      alert("Gagal upload foto: " + e.message);
    }
    setUploading(false);
  }

  async function getSignedKtpUrl(filePath) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-ktp-signed-url`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: filePath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal ambil link foto KTP");
      return data.signedUrl;
    } catch (e) {
      console.log("Gagal buat signed URL KTP:", e.message);
      return null;
    }
  }

  async function kirimVerifikasi() {
    if (!fotoToko || !fotoKtp) {
      alert("Upload dulu kedua foto (Foto Toko dan Foto KTP) sebelum kirim.");
      return;
    }
    setSubmitting(true);
    try {
      const sudahTerverifikasi = toko.statusVerifikasi === "terverifikasi";
      // Kalau toko SUDAH terverifikasi sebelumnya - simpan foto baru sebagai
      // PENGAJUAN PERUBAHAN terpisah (kolom _pending), JANGAN timpa foto
      // lama yang sudah terverifikasi. Foto lama tetap valid/dipakai sampai
      // pengajuan baru ini disetujui Owner.
      const body = sudahTerverifikasi
        ? { foto_toko_url_pending: fotoToko, foto_ktp_url_pending: fotoKtp, status_perubahan_verifikasi: "menunggu_review", alasan_perubahan_ditolak: null }
        : { foto_toko_url: fotoToko, foto_ktp_url: fotoKtp, status_verifikasi: "menunggu_review", alasan_verifikasi_ditolak: null };

      await supabaseFetch(`clients?id=eq.${toko.id}`, { method: "PATCH", body: JSON.stringify(body) }, authToken);

      if (sudahTerverifikasi) {
        onUpdated({ statusPerubahanVerifikasi: "menunggu_review" }); // foto & status utama TIDAK berubah
      } else {
        onUpdated({ fotoTokoUrl: fotoToko, fotoKtpUrl: fotoKtp, statusVerifikasi: "menunggu_review", alasanVerifikasiDitolak: null });
      }
      setEditMode(false);
    } catch (e) {
      alert("Gagal kirim verifikasi: " + e.message);
    }
    setSubmitting(false);
  }

  const statusInfo = {
    belum_upload: { text: "Anda belum mengirim foto verifikasi. Toko belum bisa melakukan pemesanan sampai proses ini selesai.", bg: "#FBEAEA", color: "#C0392B" },
    menunggu_review: { text: "Foto Anda sudah terkirim dan sedang ditinjau oleh Owner. Mohon tunggu, biasanya diproses dalam 1x24 jam.", bg: "#FBF0D9", color: "#8A6A1A" },
    terverifikasi: { text: "Toko Anda sudah terverifikasi. Anda sudah bisa melakukan pemesanan seperti biasa.", bg: "#D8E9E6", color: "#28685D" },
    ditolak: { text: "Verifikasi ditolak. Silakan upload ulang foto yang jelas dan sesuai.", bg: "#FBEAEA", color: "#C0392B" },
  }[toko.statusVerifikasi] || {};

  return (
    <div style={{ minHeight: "100vh", padding: "0 0 30px" }}>
      <div style={{ padding: "18px 20px 16px", position: "sticky", top: 0, zIndex: 10, background: "#F7F5F1" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, padding: 0 }}>
            <ChevronLeft size={18} /> Kembali
          </button>
          {toko.statusVerifikasi === "terverifikasi" && !editMode && !toko?.dibuatOlehSales && (
            <button
              onClick={mulaiVerifikasiEmail}
              style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}
            >
              Ubah
            </button>
          )}
        </div>
        <h1 className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: 0 }}>Foto Toko</h1>
      </div>

      <div style={{ padding: "0 20px" }}>
        <div style={{ background: statusInfo.bg, borderRadius: 12, padding: 14, marginBottom: 20 }}>
          <p style={{ fontSize: 12.5, color: statusInfo.color, margin: 0, lineHeight: 1.5, fontWeight: 600 }}>{statusInfo.text}</p>
        </div>

        {toko.statusVerifikasi === "ditolak" && toko.alasanVerifikasiDitolak && (
          <div style={{ background: "#fff", border: "1px solid #F0CFC7", borderRadius: 12, padding: 14, marginBottom: 20 }}>
            <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 4px", fontWeight: 700 }}>ALASAN DITOLAK</p>
            <p style={{ fontSize: 13, color: "#C0392B", margin: 0 }}>{toko.alasanVerifikasiDitolak}</p>
          </div>
        )}

        {toko.statusPerubahanVerifikasi === "menunggu_review" && (
          <div style={{ background: "#FBF0D9", borderRadius: 12, padding: 14, marginBottom: 20 }}>
            <p style={{ fontSize: 12.5, color: "#8A6A1A", margin: 0, lineHeight: 1.5, fontWeight: 600 }}>
              Anda mengajukan perubahan foto - sedang menunggu review Owner. Foto yang sudah terverifikasi sebelumnya tetap berlaku sampai pengajuan ini disetujui.
            </p>
          </div>
        )}
        {toko.statusPerubahanVerifikasi === "ditolak" && toko.alasanPerubahanDitolak && (
          <div style={{ background: "#fff", border: "1px solid #F0CFC7", borderRadius: 12, padding: 14, marginBottom: 20 }}>
            <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 4px", fontWeight: 700 }}>PENGAJUAN PERUBAHAN DITOLAK</p>
            <p style={{ fontSize: 13, color: "#C0392B", margin: 0 }}>{toko.alasanPerubahanDitolak}</p>
          </div>
        )}

        {toko.statusVerifikasi === "menunggu_review" && !editMode ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 700 }}>FOTO TOKO</p>
                <ImgAutoRetry src={fotoToko} alt="Foto Toko" onClick={() => setLightboxUrl(fotoToko)} style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 10, cursor: "pointer" }} />
              </div>
              <div>
                <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 700 }}>FOTO KTP</p>
                <ImgAutoRetry src={fotoKtpDisplayUrl} alt="Foto KTP" onClick={() => setLightboxUrl(fotoKtpDisplayUrl)} style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 10, cursor: "pointer" }} />
              </div>
            </div>
            <button
              disabled
              style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: "#E4E1DA", color: "#9CA0A6", fontWeight: 700, fontSize: 14 }}
            >
              Sedang di Review
            </button>
          </>
        ) : toko.statusVerifikasi === "terverifikasi" && !editMode ? null : (
          <>
            {editMode && (
              <p style={{ fontSize: 11.5, color: "#8A6A1A", background: "#FFFBF0", padding: 10, borderRadius: 9, margin: "0 0 16px", lineHeight: 1.5 }}>
                Mengganti foto akan membuat toko Anda perlu diverifikasi ulang oleh Owner sebelum bisa order lagi.
              </p>
            )}
            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "#24272B", margin: "0 0 8px" }}>Foto Toko</p>
              <label style={{ display: "block", width: "100%", height: 160, borderRadius: 12, border: fotoToko ? "none" : "1.5px dashed #E8A426", background: fotoToko ? `url(${fotoToko}) center/cover` : "#FFFBF0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                {!fotoToko && (uploadingToko ? <p style={{ fontSize: 12, color: "#8A6A1A" }}>Mengupload...</p> : (
                  <div style={{ textAlign: "center" }}>
                    <Camera size={24} color="#8A6A1A" />
                    <p style={{ fontSize: 11.5, color: "#8A6A1A", marginTop: 6 }}>Tap untuk upload foto toko</p>
                  </div>
                ))}
                <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingToko} onChange={(e) => { if (e.target.files[0]) uploadFoto(e.target.files[0], "toko"); }} />
              </label>
              {fotoToko && (
                <button onClick={() => setFotoToko(null)} style={{ marginTop: 8, background: "none", border: "none", color: "#C0392B", fontSize: 11.5, fontWeight: 600, padding: 0 }}>Ganti Foto</button>
              )}
            </div>

            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: "#24272B", margin: "0 0 8px" }}>Foto KTP</p>
              <label style={{ display: "block", width: "100%", height: 160, borderRadius: 12, border: fotoKtp ? "none" : "1.5px dashed #E8A426", background: fotoKtpDisplayUrl ? `url(${fotoKtpDisplayUrl}) center/cover` : "#FFFBF0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                {!fotoKtp && (uploadingKtp ? <p style={{ fontSize: 12, color: "#8A6A1A" }}>Mengupload...</p> : (
                  <div style={{ textAlign: "center" }}>
                    <Camera size={24} color="#8A6A1A" />
                    <p style={{ fontSize: 11.5, color: "#8A6A1A", marginTop: 6 }}>Tap untuk upload foto KTP</p>
                  </div>
                ))}
                <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingKtp} onChange={(e) => { if (e.target.files[0]) uploadFoto(e.target.files[0], "ktp"); }} />
              </label>
              {fotoKtp && (
                <button onClick={() => { setFotoKtp(null); setFotoKtpDisplayUrl(null); }} style={{ marginTop: 8, background: "none", border: "none", color: "#C0392B", fontSize: 11.5, fontWeight: 600, padding: 0 }}>Ganti Foto</button>
              )}
              <p style={{ fontSize: 10.5, color: "#9CA0A6", marginTop: 8, lineHeight: 1.5 }}>
                Data KTP hanya digunakan untuk keperluan verifikasi internal dan tidak dibagikan ke pihak lain.
              </p>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {editMode && (
                <button
                  onClick={() => { setEditMode(false); setFotoToko(toko.fotoTokoUrl); setFotoKtp(toko.fotoKtpUrl); }}
                  style={{ padding: "14px 20px", borderRadius: 12, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 14 }}
                >
                  Batal
                </button>
              )}
              <button
                onClick={kirimVerifikasi}
                disabled={submitting || uploadingToko || uploadingKtp}
                style={{ flex: 1, padding: 14, borderRadius: 12, border: "none", background: (submitting || uploadingToko || uploadingKtp) ? "#E4E1DA" : "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 14 }}
              >
                {submitting ? "Mengirim..." : "Kirim untuk Verifikasi"}
              </button>
            </div>
          </>
        )}
      </div>

      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <ImgAutoRetry src={lightboxUrl} alt="Full" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8, objectFit: "contain" }} />
          <button
            onClick={() => setLightboxUrl(null)}
            style={{ position: "absolute", top: 20, right: 20, width: 40, height: 40, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.15)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={20} />
          </button>
        </div>
      )}

      {(emailOtpStep === "sending" || emailOtpStep === "input_code") && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 380, padding: 24 }}>
            {emailOtpStep === "sending" ? (
              <p style={{ textAlign: "center", fontSize: 13, color: "#6B6F75" }}>Mengirim kode ke email Anda...</p>
            ) : (
              <>
                <h2 className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 8px" }}>Verifikasi Email</h2>
                <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "0 0 16px", lineHeight: 1.5 }}>
                  Kode 6 digit sudah dikirim ke <strong>{toko.email}</strong>. Masukkan di bawah ini untuk lanjut ubah foto.
                </p>
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Kode dari email"
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E4E1DA", fontSize: 16, letterSpacing: 4, textAlign: "center", marginBottom: 12 }}
                />
                {otpError && <p style={{ fontSize: 12, color: "#C0392B", margin: "0 0 12px" }}>{otpError}</p>}
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <button
                    onClick={() => { setEmailOtpStep("none"); setOtpCode(""); setOtpError(""); }}
                    style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13 }}
                  >
                    Batal
                  </button>
                  <button
                    onClick={verifikasiKodeEmail}
                    disabled={otpBusy}
                    style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: otpBusy ? "#E4E1DA" : "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13 }}
                  >
                    {otpBusy ? "Memeriksa..." : "Verifikasi"}
                  </button>
                </div>
                <button onClick={mulaiVerifikasiEmail} disabled={otpBusy} style={{ width: "100%", background: "none", border: "none", color: "#8A6A1A", fontSize: 12, fontWeight: 600, padding: 0 }}>
                  Kirim ulang kode
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// INFORMASI AKUN - detail akun toko, sensor data sensitif
// ============================================================
function InformasiAkunScreen({ toko, onBack, onOpenAlamat, onOpenTentang, onUpdated }) {
  const [showEditHp, setShowEditHp] = useState(false);
  const [hpStep, setHpStep] = useState("konfirmasi"); // konfirmasi | otp_kirim | otp_input | form
  const [hpBaru, setHpBaru] = useState("");
  const [savingHp, setSavingHp] = useState(false);
  const [hpError, setHpError] = useState("");
  const [resettingPw, setResettingPw] = useState(false);
  const [otpCodeHp, setOtpCodeHp] = useState("");
  const [otpErrorHp, setOtpErrorHp] = useState("");
  const [otpBusyHp, setOtpBusyHp] = useState(false);

  const hariSejakUbahHp = toko.noHpDiubahTerakhir
    ? Math.floor((Date.now() - new Date(toko.noHpDiubahTerakhir).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const bolehUbahHp = hariSejakUbahHp === null || hariSejakUbahHp >= 60;
  const sisaHari = bolehUbahHp ? 0 : 60 - hariSejakUbahHp;

  async function mulaiVerifikasiEmailHp() {
    setHpStep("otp_kirim");
    setOtpErrorHp("");
    setOtpBusyHp(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: toko.email, create_user: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || data.error_description || "Gagal kirim kode ke email.");
      setHpStep("otp_input");
    } catch (e) {
      alert("Gagal kirim kode verifikasi: " + e.message);
      setHpStep("konfirmasi");
    }
    setOtpBusyHp(false);
  }

  async function verifikasiKodeEmailHp() {
    if (!otpCodeHp.trim()) {
      setOtpErrorHp("Masukkan kode yang dikirim ke email Anda.");
      return;
    }
    setOtpBusyHp(true);
    setOtpErrorHp("");
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: toko.email, token: otpCodeHp.trim(), type: "email" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || data.error_description || "Kode salah atau sudah kedaluwarsa.");
      setOtpCodeHp("");
      setHpStep("form");
    } catch (e) {
      setOtpErrorHp(e.message);
    }
    setOtpBusyHp(false);
  }

  async function simpanHpBaru() {
    if (!hpBaru.trim()) {
      setHpError("Masukkan nomor HP baru.");
      return;
    }
    setSavingHp(true);
    setHpError("");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/update-no-hp`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: toko.id, no_hp_baru: hpBaru.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal simpan no. HP.");
      onUpdated({ telp: hpBaru.trim(), noHpDiubahTerakhir: new Date().toISOString() });
      setShowEditHp(false);
      setHpStep("konfirmasi");
      setHpBaru("");
    } catch (e) {
      setHpError("Gagal simpan: " + e.message);
    }
    setSavingHp(false);
  }

  async function resetPassword() {
    setResettingPw(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(window.location.origin)}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: toko.email }),
      });
      if (!res.ok) throw new Error("Gagal kirim email reset password.");
      alert(`Link reset password sudah dikirim ke ${toko.email}. Cek email Anda.`);
    } catch (e) {
      alert(e.message);
    }
    setResettingPw(false);
  }

  const rowStyle = { padding: "14px 0", borderBottom: "1px solid #EDEAE3" };
  const labelStyle = { fontSize: 11, color: "#9CA0A6", margin: "0 0 4px", fontWeight: 700, textTransform: "uppercase" };
  const valueStyle = { fontSize: 14, color: "#24272B", margin: 0, fontWeight: 600 };

  return (
    <div style={{ minHeight: "100vh", padding: "0 0 30px" }}>
      <div style={{ padding: "18px 20px 16px", position: "sticky", top: 0, zIndex: 10, background: "#F7F5F1" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, marginBottom: 10 }}>
          <ChevronLeft size={18} /> Kembali
        </button>
        <h1 className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: 0 }}>Informasi Akun</h1>
      </div>

      <div style={{ padding: "0 20px" }}>
        <div style={rowStyle}>
          <p style={labelStyle}>Kode Customer</p>
          <p style={valueStyle}>{toko.kode}</p>
        </div>

        <div style={rowStyle}>
          <p style={labelStyle}>Nama Owner</p>
          <p style={valueStyle}>{sensorNama(toko.namaOwner) || "-"}</p>
        </div>

        <div style={rowStyle}>
          <p style={labelStyle}>Tanggal Lahir</p>
          <p style={valueStyle}>{toko.tanggalLahir ? new Date(toko.tanggalLahir).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-"}</p>
        </div>

        <div style={rowStyle}>
          <p style={labelStyle}>Nama Toko</p>
          <p style={valueStyle}>{sensorNama(toko.nama)}</p>
        </div>

        <div style={{ ...rowStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={labelStyle}>No. HP</p>
            <p style={valueStyle}>{sensorNoHp(toko.telp)}</p>
          </div>
          {!toko?.dibuatOlehSales && (
            <button onClick={() => { setShowEditHp(true); setHpStep("konfirmasi"); }} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FileEdit size={15} color="#24272B" />
            </button>
          )}
        </div>

        {!toko?.dibuatOlehSales && (
          <div style={rowStyle}>
            <button onClick={resetPassword} disabled={resettingPw} style={{ background: "none", border: "none", padding: 0, color: "#B8860B", fontSize: 13.5, fontWeight: 700 }}>
              {resettingPw ? "Mengirim..." : "Reset Password"}
            </button>
          </div>
        )}

        <div style={rowStyle}>
          <p style={labelStyle}>Jenis Usaha</p>
          <p style={valueStyle}>{toko.jenisUsaha || "-"}</p>
        </div>

        <div style={rowStyle}>
          <p style={labelStyle}>Status</p>
          <p style={valueStyle}>{toko.status === "aktif" ? "Aktif" : toko.status || "-"}</p>
        </div>

        <div style={rowStyle}>
          <p style={labelStyle}>Provinsi</p>
          <p style={valueStyle}>{toko.provinsi || "-"}</p>
        </div>

        {!toko?.dibuatOlehSales && (
          <button onClick={onOpenAlamat} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid #EDEAE3", background: "none", border: "none", borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "#EDEAE3" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#24272B" }}>Daftar Alamat</span>
            <ChevronRight size={17} color="#B5B2AA" />
          </button>
        )}

        <button onClick={onOpenTentang} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", background: "none", border: "none" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#24272B" }}>Tentang</span>
          <ChevronRight size={17} color="#B5B2AA" />
        </button>
      </div>

      {showEditHp && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 380, padding: 24 }}>
            {hpStep === "konfirmasi" ? (
              <>
                <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 10px" }}>Ubah No. HP</h2>
                <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "0 0 20px", lineHeight: 1.6 }}>
                  Satu akun hanya dapat melakukan perubahan nomor HP <strong>sekali setiap 60 hari</strong>.
                  {!bolehUbahHp && (
                    <span style={{ display: "block", marginTop: 8, color: "#C0392B", fontWeight: 600 }}>
                      Anda baru bisa mengubah lagi dalam {sisaHari} hari.
                    </span>
                  )}
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => setShowEditHp(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13 }}>
                    Batalkan
                  </button>
                  <button
                    onClick={() => bolehUbahHp && mulaiVerifikasiEmailHp()}
                    disabled={!bolehUbahHp}
                    style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: bolehUbahHp ? "#E8A426" : "#E4E1DA", color: bolehUbahHp ? "#24272B" : "#9CA0A6", fontWeight: 700, fontSize: 13 }}
                  >
                    Lanjutkan
                  </button>
                </div>
              </>
            ) : hpStep === "otp_kirim" ? (
              <p style={{ textAlign: "center", fontSize: 13, color: "#6B6F75" }}>Mengirim kode ke email Anda...</p>
            ) : hpStep === "otp_input" ? (
              <>
                <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 8px" }}>Verifikasi Email</h2>
                <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "0 0 16px", lineHeight: 1.5 }}>
                  Kode 6 digit sudah dikirim ke <strong>{toko.email}</strong>. Masukkan di bawah ini untuk lanjut ubah No. HP.
                </p>
                <input
                  value={otpCodeHp} onChange={(e) => setOtpCodeHp(e.target.value)}
                  placeholder="Kode dari email"
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E4E1DA", fontSize: 16, letterSpacing: 4, textAlign: "center", marginBottom: 12 }}
                />
                {otpErrorHp && <p style={{ fontSize: 12, color: "#C0392B", margin: "0 0 12px" }}>{otpErrorHp}</p>}
                <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                  <button onClick={() => { setShowEditHp(false); setHpStep("konfirmasi"); setOtpCodeHp(""); }} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13 }}>
                    Batal
                  </button>
                  <button onClick={verifikasiKodeEmailHp} disabled={otpBusyHp} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: otpBusyHp ? "#E4E1DA" : "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13 }}>
                    {otpBusyHp ? "Memeriksa..." : "Verifikasi"}
                  </button>
                </div>
                <button onClick={mulaiVerifikasiEmailHp} disabled={otpBusyHp} style={{ width: "100%", background: "none", border: "none", color: "#8A6A1A", fontSize: 12, fontWeight: 600, padding: 0 }}>
                  Kirim ulang kode
                </button>
              </>
            ) : (
              <>
                <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 14px" }}>Masukkan No. HP Baru</h2>
                <input
                  value={hpBaru} onChange={(e) => setHpBaru(e.target.value)}
                  placeholder="0812xxxxxxx"
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E4E1DA", fontSize: 14, marginBottom: 10 }}
                />
                {hpError && <p style={{ fontSize: 12, color: "#C0392B", margin: "0 0 10px" }}>{hpError}</p>}
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { setShowEditHp(false); setHpStep("konfirmasi"); setHpBaru(""); }} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13 }}>
                    Batal
                  </button>
                  <button onClick={simpanHpBaru} disabled={savingHp} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: savingHp ? "#E4E1DA" : "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13 }}>
                    {savingHp ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TENTANG
// ============================================================
// Nomor perangkat - dibuat sekali & disimpan di HP, dipakai buat identifikasi
// perangkat (misal kalau ada laporan masalah teknis)
function getDeviceId() {
  try {
    let id = localStorage.getItem("device_id_v1");
    if (!id) {
      id = "DEV-" + Math.random().toString(36).slice(2, 10).toUpperCase() + "-" + Date.now().toString(36).toUpperCase();
      localStorage.setItem("device_id_v1", id);
    }
    return id;
  } catch (e) {
    return "DEV-UNKNOWN";
  }
}

function TentangScreen({ toko, onBack }) {
  const [expanded, setExpanded] = useState(null); // "syarat" | "privasi" | null
  const [showHapusAkun, setShowHapusAkun] = useState(false);
  const [alasanHapus, setAlasanHapus] = useState("");
  const [submittingHapus, setSubmittingHapus] = useState(false);
  const [sudahDiajukan, setSudahDiajukan] = useState(false);

  async function ajukanHapusAkun() {
    setSubmittingHapus(true);
    try {
      await supabaseFetch("permintaan_hapus_akun", {
        method: "POST",
        body: JSON.stringify({ client_id: toko.id, alasan: alasanHapus || null }),
      });
      setSudahDiajukan(true);
    } catch (e) {
      alert("Gagal mengajukan: " + e.message);
    }
    setSubmittingHapus(false);
  }

  const sectionStyle = { padding: "14px 0", borderBottom: "1px solid #EDEAE3" };

  return (
    <div style={{ minHeight: "100vh", padding: "0 0 30px" }}>
      <div style={{ padding: "18px 20px 16px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, marginBottom: 10 }}>
          <ChevronLeft size={18} /> Kembali
        </button>
        <h1 className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: 0 }}>Tentang</h1>
      </div>
      <div style={{ padding: "0 20px" }}>
        <p style={{ fontSize: 13.5, color: "#24272B", fontWeight: 700, margin: "0 0 4px" }}>INDO GARUDA ABADI</p>
        <p style={{ fontSize: 12.5, color: "#6B6F75", lineHeight: 1.6, marginBottom: 20 }}>
          Aplikasi order online untuk pelanggan distributor Indo Garuda Abadi. Dibuat untuk mempermudah proses pemesanan, pembayaran, dan pengecekan status pesanan secara online.
        </p>

        <div style={sectionStyle}>
          <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 8px", fontWeight: 700, textTransform: "uppercase" }}>Kontak Kami</p>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
            <MessageCircle size={15} color="#9CA0A6" style={{ marginTop: 1, flexShrink: 0 }} />
            <p style={{ fontSize: 12.5, color: "#24272B", margin: 0 }}>pt.indogarudaabadi@gmail.com</p>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
            <Phone size={15} color="#9CA0A6" style={{ marginTop: 1, flexShrink: 0 }} />
            <p style={{ fontSize: 12.5, color: "#24272B", margin: 0 }}>+62 823-8875-9949</p>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <MapPin size={15} color="#9CA0A6" style={{ marginTop: 1, flexShrink: 0 }} />
            <p style={{ fontSize: 12.5, color: "#24272B", margin: 0, lineHeight: 1.5 }}>
              Jl. Hangtuah Ujung No.279C, Bencah Lesung, Tenayan Raya, Kota Pekanbaru, Riau 28131
            </p>
          </div>
        </div>

        <div style={sectionStyle}>
          <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 4px", fontWeight: 700, textTransform: "uppercase" }}>Nomor Perangkat</p>
          <p style={{ fontSize: 12.5, color: "#24272B", fontFamily: "monospace", margin: 0 }}>{getDeviceId()}</p>
        </div>

        <div style={sectionStyle}>
          <button onClick={() => setExpanded(expanded === "syarat" ? null : "syarat")} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", padding: 0 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#24272B" }}>Syarat & Ketentuan Registrasi</span>
            <ChevronRight size={16} color="#9CA0A6" style={{ transform: expanded === "syarat" ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
          </button>
          {expanded === "syarat" && (
            <div style={{ marginTop: 12, fontSize: 12, color: "#6B6F75", lineHeight: 1.7 }}>
              <p>1. Toko yang mendaftar wajib mengisi data yang benar dan sesuai identitas pemilik/penanggung jawab toko.</p>
              <p>2. Verifikasi (foto toko & KTP) wajib diselesaikan sebelum akun dapat melakukan pemesanan.</p>
              <p>3. Harga, ketentuan pembayaran, dan syarat pengiriman dapat berubah sewaktu-waktu sesuai kebijakan Indo Garuda Abadi.</p>
              <p>4. Akun yang terbukti memberikan data palsu berhak ditolak atau dinonaktifkan oleh Owner.</p>
              <p>5. Dengan mendaftar, pengguna setuju data yang diberikan digunakan untuk keperluan transaksi dan verifikasi sesuai Kebijakan Privasi.</p>
            </div>
          )}
        </div>

        <div style={sectionStyle}>
          <button onClick={() => setExpanded(expanded === "privasi" ? null : "privasi")} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", border: "none", padding: 0 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#24272B" }}>Kebijakan Privasi</span>
            <ChevronRight size={16} color="#9CA0A6" style={{ transform: expanded === "privasi" ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
          </button>
          {expanded === "privasi" && (
            <div style={{ marginTop: 12, fontSize: 12, color: "#6B6F75", lineHeight: 1.7 }}>
              <p>1. Data yang dikumpulkan meliputi: nama, alamat, no. HP, email, foto toko, dan foto KTP untuk keperluan verifikasi & transaksi.</p>
              <p>2. Foto KTP disimpan secara terpisah dan tidak dapat diakses publik, hanya dapat dilihat oleh staff berwenang untuk keperluan verifikasi.</p>
              <p>3. Data tidak dibagikan ke pihak ketiga di luar keperluan operasional (misal pengiriman, pembayaran).</p>
              <p>4. Pengguna dapat mengajukan penghapusan akun & data melalui menu ini kapan saja.</p>
            </div>
          )}
        </div>

        <div style={sectionStyle}>
          <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 4px", fontWeight: 700, textTransform: "uppercase" }}>Versi</p>
          <p style={{ fontSize: 12.5, color: "#24272B", margin: 0 }}>1.0</p>
        </div>

        {!toko?.dibuatOlehSales && (
          <div style={{ padding: "20px 0 0" }}>
            {sudahDiajukan ? (
              <div style={{ background: "#D8E9E6", borderRadius: 12, padding: 14 }}>
                <p style={{ fontSize: 12.5, color: "#28685D", margin: 0, fontWeight: 600, lineHeight: 1.5 }}>
                  Permintaan penghapusan akun Anda sudah diterima dan sedang diproses tim kami.
                </p>
              </div>
            ) : (
              <button onClick={() => setShowHapusAkun(true)} style={{ background: "none", border: "none", color: "#C0392B", fontSize: 13, fontWeight: 700, padding: 0 }}>
              Ajukan Penghapusan Akun
            </button>
          )}
          </div>
        )}
      </div>

      {showHapusAkun && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 380, padding: 24 }}>
            <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#C0392B", margin: "0 0 10px" }}>Ajukan Penghapusan Akun</h2>
            <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "0 0 16px", lineHeight: 1.6 }}>
              Permintaan Anda akan ditinjau oleh tim kami. Akun tidak langsung terhapus otomatis - Anda akan dihubungi untuk konfirmasi lebih lanjut.
            </p>
            <textarea
              value={alasanHapus} onChange={(e) => setAlasanHapus(e.target.value)}
              placeholder="Alasan (opsional)..." rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #E4E1DA", fontSize: 13, resize: "vertical", marginBottom: 14 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowHapusAkun(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13 }}>
                Batal
              </button>
              <button
                onClick={async () => { await ajukanHapusAkun(); setShowHapusAkun(false); }}
                disabled={submittingHapus}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: submittingHapus ? "#E4E1DA" : "#C0392B", color: "#fff", fontWeight: 700, fontSize: 13 }}
              >
                {submittingHapus ? "Mengirim..." : "Ajukan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// DAFTAR ALAMAT (kelola alamat pengiriman tersimpan, lepas dari checkout)
// ============================================================
function DaftarAlamatScreen({ toko, savedAddresses, setSavedAddresses, onBack }) {
  const [mode, setMode] = useState("list"); // list | form
  const [form, setForm] = useState({
    nama: "", telp: "", alamat: "",
    provinsi: "", provinsiId: "", kota: "", kotaId: "",
    kecamatan: "", kecamatanId: "", kelurahan: "", kodePos: "",
  });

  const [provinces, setProvinces] = useState([]);
  const [regencies, setRegencies] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [villages, setVillages] = useState([]);
  const WILAYAH_PROXY = `${SUPABASE_URL}/functions/v1/wilayah-proxy`;
  const titleCase = (s) => s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());

  useEffect(() => {
    fetch(`${WILAYAH_PROXY}?path=provinces.json`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } })
      .then((r) => r.json())
      .then((data) => setProvinces(data.map((d) => ({ id: d.id, name: titleCase(d.name) }))))
      .catch(() => setProvinces(FALLBACK_WILAYAH.provinces));
  }, []);
  useEffect(() => {
    if (!form.provinsiId) { setRegencies([]); return; }
    fetch(`${WILAYAH_PROXY}?path=regencies/${form.provinsiId}.json`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } })
      .then((r) => r.json())
      .then((data) => setRegencies(data.map((d) => ({ id: d.id, name: titleCase(d.name) }))))
      .catch(() => setRegencies(FALLBACK_WILAYAH.regencies[form.provinsiId] || []));
  }, [form.provinsiId]);
  useEffect(() => {
    if (!form.kotaId) { setDistricts([]); return; }
    fetch(`${WILAYAH_PROXY}?path=districts/${form.kotaId}.json`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } })
      .then((r) => r.json())
      .then((data) => setDistricts(data.map((d) => ({ id: d.id, name: titleCase(d.name) }))))
      .catch(() => setDistricts(FALLBACK_WILAYAH.districts[form.kotaId] || []));
  }, [form.kotaId]);
  useEffect(() => {
    if (!form.kecamatanId) { setVillages([]); return; }
    fetch(`${WILAYAH_PROXY}?path=villages/${form.kecamatanId}.json`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } })
      .then((r) => r.json())
      .then((data) => setVillages(data.map((d) => ({ id: d.id, name: titleCase(d.name) }))))
      .catch(() => setVillages(FALLBACK_WILAYAH.villages[form.kecamatanId] || []));
  }, [form.kecamatanId]);

  function selectProvinsi(name) {
    const found = provinces.find((p) => p.name === name);
    setForm({ ...form, provinsi: name, provinsiId: found?.id || "", kota: "", kotaId: "", kecamatan: "", kecamatanId: "", kelurahan: "" });
  }
  function selectKota(name) {
    const found = regencies.find((r) => r.name === name);
    setForm({ ...form, kota: name, kotaId: found?.id || "", kecamatan: "", kecamatanId: "", kelurahan: "" });
  }
  function selectKecamatan(name) {
    const found = districts.find((d) => d.name === name);
    setForm({ ...form, kecamatan: name, kecamatanId: found?.id || "", kelurahan: "" });
  }

  const canSave = form.telp.trim() && form.alamat.trim() && form.provinsi && form.kota && form.kecamatan && form.kelurahan;

  async function simpanAlamat() {
    try {
      const [inserted] = await supabaseFetch("alamat_tersimpan", {
        method: "POST",
        body: JSON.stringify({
          client_id: toko.id, nama: form.nama, telp: form.telp, alamat: form.alamat,
          provinsi: form.provinsi, kota: form.kota, kecamatan: form.kecamatan,
          kelurahan: form.kelurahan, kode_pos: form.kodePos,
        }),
      });
      setSavedAddresses((prev) => [{ ...form, id: inserted.id }, ...prev]);
      setForm({ nama: "", telp: "", alamat: "", provinsi: "", provinsiId: "", kota: "", kotaId: "", kecamatan: "", kecamatanId: "", kelurahan: "", kodePos: "" });
      setMode("list");
    } catch (e) {
      alert("Gagal simpan alamat: " + e.message);
    }
  }

  async function hapusAlamat(id) {
    if (!confirm("Hapus alamat ini?")) return;
    try {
      await supabaseFetch(`alamat_tersimpan?id=eq.${id}`, { method: "DELETE" });
      setSavedAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      alert("Gagal hapus alamat: " + e.message);
    }
  }

  const inputStyle = { width: "100%", padding: "11px 13px", borderRadius: 10, border: "1.5px solid #E4E1DA", fontSize: 13.5, outline: "none" };

  return (
    <div style={{ minHeight: "100vh", padding: "0 0 30px" }}>
      <div style={{ padding: "18px 20px 16px", position: "sticky", top: 0, zIndex: 10, background: "#F7F5F1" }}>
        <button onClick={() => (mode === "form" ? setMode("list") : onBack())} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, marginBottom: 10 }}>
          <ChevronLeft size={18} /> Kembali
        </button>
        <h1 className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: 0 }}>Daftar Alamat</h1>
      </div>

      <div style={{ padding: "0 20px" }}>
        {mode === "list" ? (
          <>
            {savedAddresses.length === 0 ? (
              <p style={{ textAlign: "center", fontSize: 12.5, color: "#9CA0A6", padding: "40px 0" }}>Belum ada alamat tersimpan.</p>
            ) : (
              savedAddresses.map((addr) => (
                <div key={addr.id} style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#24272B" }}>{addr.nama || toko.nama}</p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6B6F75" }}>{addr.telp}</p>
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6B6F75" }}>
                    {addr.alamat}{addr.kota ? `, ${addr.kelurahan}, ${addr.kecamatan}, ${addr.kota}, ${addr.provinsi}` : ""}
                  </p>
                  <button onClick={() => hapusAlamat(addr.id)} style={{ marginTop: 8, background: "none", border: "none", color: "#C0392B", fontSize: 11.5, fontWeight: 600, padding: 0 }}>
                    Hapus
                  </button>
                </div>
              ))
            )}
            <button
              onClick={() => setMode("form")}
              style={{ width: "100%", padding: 14, borderRadius: 12, border: "1.5px dashed #E8A426", background: "#FFFBF0", color: "#8A6A1A", fontWeight: 700, fontSize: 13.5, marginTop: 8 }}
            >
              + Daftarkan Alamat Baru
            </button>
          </>
        ) : (
          <>
            <Field label="Nama Penerima">
              <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder={toko.nama} style={inputStyle} />
            </Field>
            <Field label="No. Telepon Penerima">
              <input value={form.telp} onChange={(e) => setForm({ ...form, telp: e.target.value })} placeholder="0812xxxxxxx" style={inputStyle} />
            </Field>
            <Field label="Alamat (Jalan, No. Rumah)">
              <textarea value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} rows={2} placeholder="Jl. Contoh No. 2" style={{ ...inputStyle, resize: "none" }} />
            </Field>
            <Field label="Provinsi">
              <AutocompleteField value={form.provinsi} onSelect={selectProvinsi} options={provinces.map((p) => p.name)} placeholder="Ketik nama provinsi..." />
            </Field>
            <Field label="Kota / Kabupaten">
              <AutocompleteField value={form.kota} onSelect={selectKota} options={regencies.map((r) => r.name)} placeholder="Ketik nama kota..." disabled={!form.provinsiId} />
            </Field>
            <Field label="Kecamatan">
              <AutocompleteField value={form.kecamatan} onSelect={selectKecamatan} options={districts.map((d) => d.name)} placeholder="Ketik nama kecamatan..." disabled={!form.kotaId} />
            </Field>
            <Field label="Kelurahan">
              <AutocompleteField value={form.kelurahan} onSelect={(name) => setForm({ ...form, kelurahan: name })} options={villages.map((v) => v.name)} placeholder="Ketik nama kelurahan..." disabled={!form.kecamatanId} />
            </Field>
            <Field label="Kode Pos">
              <input value={form.kodePos} onChange={(e) => setForm({ ...form, kodePos: e.target.value })} placeholder="Isi manual, misal 28292" style={inputStyle} inputMode="numeric" maxLength={5} />
            </Field>
            <button
              onClick={simpanAlamat}
              disabled={!canSave}
              style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: canSave ? "#E8A426" : "#E4E1DA", color: canSave ? "#24272B" : "#9CA0A6", fontWeight: 700, fontSize: 14, marginTop: 6 }}
            >
              Simpan Alamat
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SaldoScreen({ toko, onBack }) {
  const [loading, setLoading] = useState(true);
  const [saldo, setSaldo] = useState(0);
  const [va, setVa] = useState([]);
  const [rekeningPerusahaan, setRekeningPerusahaan] = useState([]);
  const [riwayat, setRiwayat] = useState([]);
  const [totalKurangBayar, setTotalKurangBayar] = useState(0);
  const [orderKurangBayar, setOrderKurangBayar] = useState([]);
  const [copiedIdx, setCopiedIdx] = useState(null);
  // Verifikasi Xendit sudah selesai - SEMUA akun sekarang pakai VA (bukan
  // cuma demo lagi). Kalau suatu saat perlu revert ke rekening manual,
  // ganti baris ini balik ke: DAFTAR_EMAIL_DEMO.includes(toko?.email)
  const isAkunDemo = true;

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [saldoRows, vaRows, ledgerRows, rekeningRows] = await Promise.all([
        supabaseFetch(`v_saldo_toko?select=saldo&client_id=eq.${toko.id}`),
        isAkunDemo ? supabaseFetch(`virtual_accounts?select=*&client_id=eq.${toko.id}`) : Promise.resolve([]),
        supabaseFetch(`saldo_ledger?select=*&client_id=eq.${toko.id}&order=created_at.desc&limit=30`),
        supabaseFetch(`rekening_bank_perusahaan?select=nama_bank,no_rekening,atas_nama&aktif=eq.true&order=urutan.asc`),
      ]);
      setSaldo(Number(saldoRows[0]?.saldo || 0));
      setVa(vaRows || []);
      setRekeningPerusahaan(rekeningRows || []);
      setRiwayat(ledgerRows);

      // Order yang statusnya "menunggu_pembayaran" (transfer) - saldo toko
      // BELUM cukup buat lunasi PENUH order ini (kalau sudah cukup, order
      // otomatis lunas & pindah status oleh trigger database). Tampilan
      // "kurang bayar" di sini memperhitungkan saldo yang SUDAH ada sebagai
      // pengurang, supaya toko tahu persis berapa LAGI yang perlu ditransfer
      // - dialokasikan FIFO (order terlama duluan), sama seperti cara
      // trigger auto-bayar bekerja di database.
      const ordersMenunggu = await supabaseFetch(
        `orders?select=no_nota,status,created_at,order_items(subtotal_setelah_diskon)&client_id=eq.${toko.id}&status=in.(menunggu_persetujuan,menunggu_pembayaran)&metode_bayar=eq.transfer&order=created_at.asc`
      );
      let sisaSaldo = Number(saldoRows[0]?.saldo || 0);
      const daftarKurang = ordersMenunggu.map((o) => {
        const totalOrder = (o.order_items || []).reduce((sum, it) => sum + Number(it.subtotal_setelah_diskon || 0), 0);
        const kurang = Math.max(0, totalOrder - sisaSaldo);
        // Saldo yang "terpakai" buat kurangi order ini cuma dianggap
        // terpakai kalau order ini bisa dianggap sudah tercakup penuh -
        // sisa saldo yang masih ada dilanjutkan ke order berikutnya kalau
        // order ini sudah "habis" jatah saldonya (kurang > 0, artinya
        // semua sisa saldo sudah "terserap" ke order ini duluan).
        sisaSaldo = Math.max(0, sisaSaldo - totalOrder);
        return { no_nota: o.no_nota, status: o.status, kurang };
      }).filter((o) => o.kurang > 0);
      setOrderKurangBayar(daftarKurang);
      setTotalKurangBayar(daftarKurang.reduce((sum, o) => sum + o.kurang, 0));
    } catch (e) {
      console.log("Gagal muat saldo:", e.message);
    }
    setLoading(false);
  }

  const labelJenis = {
    topup_va: "Top Up via VA",
    pakai_bayar_order: "Dipakai Bayar Order",
    refund: "Refund",
    adjustment_manual: "Penyesuaian",
  };

  function copyNumber(nomor, idx) {
    if (navigator.clipboard) navigator.clipboard.writeText(nomor).catch(() => {});
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  }

  return (
    <div style={{ minHeight: "100vh", padding: "0 0 30px" }}>
      <div style={{ padding: "18px 20px 16px", position: "sticky", top: 0, zIndex: 10, background: "#F7F5F1" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, marginBottom: 10 }}>
          <ChevronLeft size={18} /> Kembali
        </button>
        <h1 className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: 0 }}>Saldo Saya</h1>
      </div>

      {loading ? (
        <p style={{ textAlign: "center", fontSize: 12.5, color: "#9CA0A6", padding: "40px 0" }}>Memuat...</p>
      ) : (
        <div style={{ padding: "0 20px" }}>
          <div style={{ background: "#24272B", borderRadius: 16, padding: 20, marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "#9CA0A6", margin: "0 0 6px" }}>Saldo Tersedia</p>
            <p className="disp" style={{ fontSize: 30, fontWeight: 700, color: "#fff", margin: 0 }}>{rupiah(saldo)}</p>
          </div>

          {isAkunDemo ? (
            va.length > 0 ? (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11.5, color: "#24272B", margin: "0 0 8px", fontWeight: 700, textTransform: "uppercase" }}>Nomor Virtual Account</p>
                {va.map((v, i) => (
                  <div key={v.id} style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 14, padding: 16, marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <p style={{ fontSize: 13, color: "#24272B", margin: "0 0 2px", fontWeight: 700 }}>{v.bank_code}</p>
                        <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#24272B", margin: 0 }}>{v.va_number}</p>
                      </div>
                      <button onClick={() => copyNumber(v.va_number, "va-" + i)} style={{ display: "flex", alignItems: "center", gap: 5, background: "#F7F5F1", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 11.5, fontWeight: 700, color: "#24272B", flexShrink: 0 }}>
                        <Copy size={13} /> {copiedIdx === "va-" + i ? "Tersalin" : "Salin"}
                      </button>
                    </div>
                    <p style={{ fontSize: 11.5, color: "#24272B", margin: "8px 0 0" }}>PT INDO GARUDA ABADI</p>
                  </div>
                ))}
                <p style={{ fontSize: 11.5, color: "#24272B", margin: "6px 0 0", lineHeight: 1.5 }}>
                  Transfer ke salah satu nomor VA di atas kapan saja - saldo Anda otomatis bertambah begitu dana masuk, dan bisa langsung dipakai membayar pesanan yang disetujui.
                </p>

                {rekeningPerusahaan.filter((r) => r.nama_bank?.toUpperCase().includes("BCA")).map((r, i) => (
                  <div key={i} style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 14, padding: 16, marginTop: 14 }}>
                    <p style={{ fontSize: 13, color: "#24272B", margin: "0 0 2px", fontWeight: 700 }}>{r.nama_bank}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 2px" }}>
                      <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#24272B", margin: 0 }}>{r.no_rekening}</p>
                      <button onClick={() => copyNumber(r.no_rekening, "bca-" + i)} style={{ display: "flex", alignItems: "center", gap: 5, background: "#F7F5F1", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 11.5, fontWeight: 700, color: "#24272B", flexShrink: 0 }}>
                        <Copy size={13} /> {copiedIdx === "bca-" + i ? "Tersalin" : "Salin"}
                      </button>
                    </div>
                    <p style={{ fontSize: 12, color: "#24272B", margin: 0 }}>{r.atas_nama}</p>
                    <p style={{ fontSize: 11.5, color: "#8A6A1A", margin: "8px 0 0", lineHeight: 1.5 }}>
                      Transfer via Bank BCA mohon upload bukti pembayaran.
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ background: "#FBF0D9", borderRadius: 14, padding: 16, marginBottom: 20 }}>
                <p style={{ fontSize: 12.5, color: "#8A6A1A", margin: 0, lineHeight: 1.5 }}>
                  Anda belum punya nomor Virtual Account. Hubungi Sales/CS untuk dibuatkan.
                </p>
              </div>
            )
          ) : (
            rekeningPerusahaan.length > 0 ? (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 8px", fontWeight: 700, textTransform: "uppercase" }}>Rekening Bank Perusahaan</p>
                {rekeningPerusahaan.map((r, i) => (
                  <div key={i} style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 14, padding: 16, marginBottom: 10 }}>
                    <p style={{ fontSize: 13, color: "#24272B", margin: "0 0 2px", fontWeight: 700 }}>{r.nama_bank}</p>
                    <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#24272B", margin: 0 }}>{r.no_rekening}</p>
                    <p style={{ fontSize: 11.5, color: "#24272B", margin: "4px 0 0" }}>{r.atas_nama}</p>
                  </div>
                ))}
                <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "6px 0 0", lineHeight: 1.5 }}>
                  Transfer ke salah satu rekening di atas untuk pembayaran pesanan Anda.
                </p>
              </div>
            ) : (
              <div style={{ background: "#FBF0D9", borderRadius: 14, padding: 16, marginBottom: 20 }}>
                <p style={{ fontSize: 12.5, color: "#8A6A1A", margin: 0, lineHeight: 1.5 }}>
                  Rekening pembayaran belum tersedia. Hubungi Sales/CS.
                </p>
              </div>
            )
          )}

          {totalKurangBayar > 0 && (
            <div style={{ background: "#FBEAEA", border: "1px solid #F0CFC7", borderRadius: 14, padding: 16, marginBottom: 20 }}>
              <p style={{ fontSize: 11.5, color: "#C0392B", margin: "0 0 6px", fontWeight: 700, textTransform: "uppercase" }}>Total Perlu Dibayarkan</p>
              <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#C0392B", margin: "0 0 8px" }}>{rupiah(totalKurangBayar)}</p>
              <p style={{ fontSize: 11.5, color: "#8A6A1A", margin: "0 0 8px", lineHeight: 1.5 }}>
                Ini termasuk pesanan yang masih menunggu persetujuan Admin - segera isi saldo lewat VA di atas supaya begitu disetujui, pesanan bisa langsung lanjut diproses tanpa perlu transfer manual lagi.
              </p>
              {orderKurangBayar.map((o, i) => (
                <p key={i} style={{ fontSize: 12, color: "#6B6F75", margin: "2px 0" }}>
                  {o.no_nota}{o.status === "menunggu_persetujuan" ? " (Menunggu Persetujuan)" : ""}: <strong style={{ color: "#C0392B" }}>{rupiah(o.kurang)}</strong>
                </p>
              ))}
            </div>
          )}

          <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: "0 0 10px" }}>Riwayat Transaksi</p>
          {riwayat.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "#9CA0A6", textAlign: "center", padding: "20px 0" }}>Belum ada transaksi saldo.</p>
          ) : (
            riwayat.map((r) => (
              <div key={r.id} style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 12, padding: 14, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#24272B", margin: "0 0 2px" }}>{labelJenis[r.jenis] || r.jenis}</p>
                  <p style={{ fontSize: 11, color: "#24272B", margin: 0 }}>{new Date(r.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: Number(r.jumlah) >= 0 ? "#28685D" : "#C0392B" }}>
                  {Number(r.jumlah) >= 0 ? "+" : ""}{rupiah(r.jumlah)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function RekeningScreen({ toko, onBack }) {
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [vaList, setVaList] = useState([]);
  const [rekeningPerusahaan, setRekeningPerusahaan] = useState([]);
  const [loadingVa, setLoadingVa] = useState(true);
  // Verifikasi Xendit sudah selesai - SEMUA akun sekarang pakai VA (bukan
  // cuma demo lagi). Kalau suatu saat perlu revert ke rekening manual,
  // ganti baris ini balik ke: DAFTAR_EMAIL_DEMO.includes(toko?.email)
  const isAkunDemo = true;

  useEffect(() => {
    if (!toko?.id) { setLoadingVa(false); return; }
    Promise.all([
      supabaseFetch(`virtual_accounts?select=bank_code,va_number&client_id=eq.${toko.id}`).catch(() => []),
      supabaseFetch(`rekening_bank_perusahaan?select=nama_bank,no_rekening,atas_nama&aktif=eq.true&order=urutan.asc`).catch(() => []),
    ]).then(([va, rekening]) => {
      setVaList(va);
      setRekeningPerusahaan(rekening);
    }).finally(() => setLoadingVa(false));
  }, [toko?.id]);

  function copyNumber(nomor, idx) {
    if (navigator.clipboard) navigator.clipboard.writeText(nomor).catch(() => {});
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  }
  return (
    <div style={{ minHeight: "100vh", padding: "18px 20px 40px" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#F7F5F1", margin: "-18px -20px 0", padding: "18px 20px 10px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, marginBottom: 8 }}>
        <ChevronLeft size={18} /> Kembali
      </button>
      </div>
      <h1 className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: "4px 0 16px" }}>Pembayaran & Rekening Bank</h1>

      {isAkunDemo ? (
        <>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Virtual Account Toko Anda</p>
          <p style={{ fontSize: 12, color: "#6B6F75", marginBottom: 14, lineHeight: 1.5 }}>
            Transfer ke nomor VA di bawah ini untuk isi saldo toko Anda - saldo bisa langsung dipakai bayar pesanan.
          </p>

          {loadingVa ? (
            <p style={{ fontSize: 12.5, color: "#9CA0A6" }}>Memuat...</p>
          ) : vaList.length === 0 ? (
            <div style={{ background: "#FFFBF0", border: "1px solid #E8A426", borderRadius: 14, padding: 16 }}>
              <p style={{ fontSize: 12.5, color: "#8A6A1A", margin: 0, lineHeight: 1.5 }}>
                Toko Anda belum punya nomor VA. Hubungi Owner/Admin lewat menu Customer Service untuk dibuatkan.
              </p>
            </div>
          ) : (
            vaList.map((r, i) => (
              <div key={i} style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 14, padding: 16, marginBottom: 12 }}>
                <p style={{ fontSize: 13, color: "#24272B", margin: "0 0 4px" }}>{r.bank_code}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#24272B", margin: 0 }}>{r.va_number}</p>
                  <button onClick={() => copyNumber(r.va_number, i)} style={{ display: "flex", alignItems: "center", gap: 5, background: "#F7F5F1", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 11.5, fontWeight: 700, color: "#24272B" }}>
                    <Copy size={13} /> {copiedIdx === i ? "Tersalin" : "Salin"}
                  </button>
                </div>
                <p style={{ fontSize: 12.5, color: "#24272B", margin: "6px 0 0" }}>PT INDO GARUDA ABADI</p>
              </div>
            ))
          )}

          {rekeningPerusahaan.filter((r) => r.nama_bank?.toUpperCase().includes("BCA")).map((r, i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 14, padding: 16, marginTop: 14 }}>
              <p style={{ fontSize: 13, color: "#24272B", margin: "0 0 4px" }}>{r.nama_bank}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#24272B", margin: 0 }}>{r.no_rekening}</p>
                <button onClick={() => copyNumber(r.no_rekening, "bca-" + i)} style={{ display: "flex", alignItems: "center", gap: 5, background: "#F7F5F1", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 11.5, fontWeight: 700, color: "#24272B", flexShrink: 0 }}>
                  <Copy size={13} /> {copiedIdx === "bca-" + i ? "Tersalin" : "Salin"}
                </button>
              </div>
              <p style={{ fontSize: 12, color: "#24272B", margin: "2px 0 0" }}>{r.atas_nama}</p>
              <p style={{ fontSize: 11.5, color: "#8A6A1A", margin: "8px 0 0", lineHeight: 1.5 }}>
                Transfer via Bank BCA mohon upload bukti pembayaran.
              </p>
            </div>
          ))}
        </>
      ) : (
        <>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Rekening Bank Perusahaan</p>
          <p style={{ fontSize: 12, color: "#6B6F75", marginBottom: 14, lineHeight: 1.5 }}>
            Transfer ke salah satu rekening di bawah ini untuk pembayaran pesanan Anda.
          </p>

          {loadingVa ? (
            <p style={{ fontSize: 12.5, color: "#9CA0A6" }}>Memuat...</p>
          ) : rekeningPerusahaan.length === 0 ? (
            <div style={{ background: "#FFFBF0", border: "1px solid #E8A426", borderRadius: 14, padding: 16 }}>
              <p style={{ fontSize: 12.5, color: "#8A6A1A", margin: 0, lineHeight: 1.5 }}>
                Rekening pembayaran belum tersedia. Hubungi Owner/Admin lewat menu Customer Service.
              </p>
            </div>
          ) : (
            rekeningPerusahaan.map((r, i) => (
              <div key={i} style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 14, padding: 16, marginBottom: 12 }}>
                <p style={{ fontSize: 13, color: "#24272B", margin: "0 0 4px" }}>{r.nama_bank}</p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#24272B", margin: 0 }}>{r.no_rekening}</p>
                  <button onClick={() => copyNumber(r.no_rekening, i)} style={{ display: "flex", alignItems: "center", gap: 5, background: "#F7F5F1", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 11.5, fontWeight: 700, color: "#24272B" }}>
                    <Copy size={13} /> {copiedIdx === i ? "Tersalin" : "Salin"}
                  </button>
                </div>
                <p style={{ fontSize: 12.5, color: "#24272B", margin: "6px 0 0" }}>{r.atas_nama}</p>
              </div>
            ))
          )}
        </>
      )}

      <p style={{ fontSize: 12, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", letterSpacing: "0.04em", margin: "16px 0 10px" }}>Ketentuan Pembayaran</p>
      <div style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 14, padding: 16 }}>
        {COMPANY_INFO.ketentuan.map((k, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < COMPANY_INFO.ketentuan.length - 1 ? 10 : 0 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#B5B2AA", marginTop: 7, flexShrink: 0 }} />
            <p style={{ fontSize: 12.5, color: "#6B6F75", margin: 0, lineHeight: 1.5 }}>{k}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// SERVICE CENTRE
// ============================================================
function ServiceCentreScreen({ onBack }) {
  return (
    <div style={{ minHeight: "100vh", padding: "18px 20px 40px" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#F7F5F1", margin: "-18px -20px 0", padding: "18px 20px 10px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, marginBottom: 8 }}>
        <ChevronLeft size={18} /> Kembali
      </button>
      </div>
      <h1 className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: "4px 0 16px" }}>Service Centre</h1>

      <div style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Clock size={17} color="#B8860B" />
          <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: 0 }}>Jam Operasional</p>
        </div>
        <p style={{ fontSize: 13, color: "#6B6F75", margin: 0, paddingLeft: 27 }}>{CS_INFO.jamOperasional}</p>
      </div>

      <div style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 14, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <MessageCircle size={17} color="#24272B" />
          <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: 0 }}>WhatsApp Customer Service</p>
        </div>
        <p className="disp" style={{ fontSize: 19, fontWeight: 700, color: "#24272B", margin: "0 0 12px", paddingLeft: 27 }}>{CS_INFO.whatsappDisplay}</p>
        <a
          href={`https://wa.me/${CS_INFO.whatsapp}`}
          target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none", background: "#24272B", color: "#fff", padding: "12px", borderRadius: 10, fontSize: 13.5, fontWeight: 700 }}
        >
          <MessageCircle size={16} /> Chat Sekarang
        </a>
      </div>
    </div>
  );
}

// ============================================================
// BANTUAN
// ============================================================
function BantuanScreen({ onBack }) {
  const visuals = [HelpVisualOrder, HelpVisualApproval, HelpVisualDropship, HelpVisualReorder, HelpVisualPayment];
  return (
    <div style={{ minHeight: "100vh", padding: "18px 20px 40px" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#F7F5F1", margin: "-18px -20px 0", padding: "18px 20px 10px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, marginBottom: 8 }}>
        <ChevronLeft size={18} /> Kembali
      </button>
      </div>
      <h1 className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: "4px 0 4px" }}>Bantuan</h1>
      <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 18px" }}>Cara menggunakan aplikasi ini, langkah demi langkah.</p>

      {HELP_STEPS.map((s, i) => {
        const Visual = visuals[i];
        return (
          <div key={i} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#EFE1BE", color: "#B8860B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>
                {i + 1}
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#24272B", margin: 0 }}>{s.judul}</p>
            </div>
            <div style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 14, padding: 14 }}>
              {Visual && <Visual />}
              <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "12px 0 0", lineHeight: 1.5 }}>{s.isi}</p>
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 4, padding: "14px 16px", background: "#F7F5F1", borderRadius: 12 }}>
        <p style={{ fontSize: 12, color: "#6B6F75", margin: 0, lineHeight: 1.5 }}>
          Masih ada pertanyaan? Hubungi kami lewat menu <strong>Service Centre</strong>.
        </p>
      </div>
    </div>
  );
}

// ---- Ilustrasi mini tiap langkah bantuan (mockup, bukan screenshot asli) ----
function HelpVisualOrder() {
  return (
    <div style={{ background: "#F7F5F1", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", borderRadius: 8, padding: "7px 10px", marginBottom: 8 }}>
        <Search size={13} color="#B5B2AA" />
        <span style={{ fontSize: 11, color: "#B5B2AA" }}>Cari barang...</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ background: "#fff", borderRadius: 9, padding: 8 }}>
          <div style={{ width: "100%", aspectRatio: "1.6", background: "#EFE1BE", borderRadius: 6, marginBottom: 5 }} />
          <div style={{ height: 5, width: "70%", background: "#E4E1DA", borderRadius: 3, marginBottom: 4 }} />
          <div style={{ height: 5, width: "45%", background: "#E4E1DA", borderRadius: 3 }} />
        </div>
        <div style={{ background: "#fff", borderRadius: 9, padding: 8, border: "1.5px solid #E8A426" }}>
          <div style={{ width: "100%", aspectRatio: "1.6", background: "#EFE1BE", borderRadius: 6, marginBottom: 5 }} />
          <div style={{ height: 5, width: "70%", background: "#E4E1DA", borderRadius: 3, marginBottom: 4 }} />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: "#E8A426", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Plus size={12} color="#24272B" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HelpVisualApproval() {
  return (
    <div style={{ background: "#F7F5F1", borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#FBF0D9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Clock size={19} color="#B8860B" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#24272B" }}>NOTA-0001</span>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: "#B8860B", background: "#FBF0D9", padding: "2px 8px", borderRadius: 999 }}>Menunggu Persetujuan</span>
        </div>
        <div style={{ height: 5, width: "60%", background: "#E4E1DA", borderRadius: 3 }} />
      </div>
    </div>
  );
}

function HelpVisualDropship() {
  return (
    <div style={{ background: "#F7F5F1", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: 9, padding: 10, marginBottom: 8, opacity: 0.55 }}>
        <MapPin size={15} color="#9CA0A6" />
        <div style={{ flex: 1 }}>
          <div style={{ height: 5, width: "40%", background: "#E4E1DA", borderRadius: 3, marginBottom: 4 }} />
          <div style={{ height: 5, width: "70%", background: "#E4E1DA", borderRadius: 3 }} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: 9, padding: 10, border: "1.5px solid #E8A426" }}>
        <MapPin size={15} color="#B8860B" />
        <div style={{ flex: 1 }}>
          <div style={{ height: 5, width: "50%", background: "#EFE1BE", borderRadius: 3, marginBottom: 4 }} />
          <div style={{ height: 5, width: "80%", background: "#EFE1BE", borderRadius: 3 }} />
        </div>
        <div style={{ width: 18, height: 18, borderRadius: 5, background: "#E8A426", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Check size={11} color="#24272B" strokeWidth={3} />
        </div>
      </div>
    </div>
  );
}

function HelpVisualReorder() {
  return (
    <div style={{ background: "#F7F5F1", borderRadius: 12, padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1 }}>
        <div style={{ height: 6, width: "35%", background: "#D8D6D0", borderRadius: 3, marginBottom: 6 }} />
        <div style={{ height: 5, width: "65%", background: "#E4E1DA", borderRadius: 3 }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#E8A426", borderRadius: 8, padding: "7px 10px" }}>
        <RotateCcw size={12} color="#24272B" />
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "#24272B" }}>Order Ulang</span>
      </div>
    </div>
  );
}

function HelpVisualPayment() {
  return (
    <div style={{ background: "#F7F5F1", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
        <div style={{ background: "#fff", borderRadius: 8, padding: "8px 10px" }}>
          <PackageCheck size={14} color="#9CA0A6" />
          <div style={{ height: 5, width: "50%", background: "#E4E1DA", borderRadius: 3, marginTop: 6 }} />
        </div>
        <div style={{ background: "#24272B", borderRadius: 8, padding: "8px 10px" }}>
          <Wallet size={14} color="#E8A426" />
          <div style={{ height: 5, width: "50%", background: "#24272B", borderRadius: 3, marginTop: 6 }} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#E8A426", borderRadius: 8, padding: "8px" }}>
        <Check size={13} color="#24272B" strokeWidth={3} />
        <span style={{ fontSize: 10.5, fontWeight: 700, color: "#24272B" }}>Konfirmasi Penerimaan</span>
      </div>
    </div>
  );
}

// ============================================================
// POIN SAYA (daily check-in)
// ============================================================
function PoinScreen({ pointsBalance, dailyClaims, onClaim, spinTickets, onSpin, onBack }) {
  const WHEEL_SEGMENTS = [
    { points: 150, color: "#F0EDE6", text: "#6B6F75" },
    { points: 250, color: "#D8E9E6", text: "#24272B" },
    { points: 350, color: "#EFE1BE", text: "#B8860B" },
    { points: 500, color: "#E8A426", text: "#24272B" },
  ];
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [lastWin, setLastWin] = useState(null);

  function handleSpin() {
    if (spinTickets <= 0 || spinning) return;
    setLastWin(null);
    const idx = Math.floor(Math.random() * WHEEL_SEGMENTS.length);
    const segAngle = 360 / WHEEL_SEGMENTS.length;
    const targetCenter = idx * segAngle + segAngle / 2;
    const currentMod = ((rotation % 360) + 360) % 360;
    const desiredMod = (360 - targetCenter) % 360;
    let delta = desiredMod - currentMod;
    if (delta < 0) delta += 360;
    const newRotation = rotation + delta + 5 * 360;
    setSpinning(true);
    setRotation(newRotation);
    setTimeout(() => {
      setSpinning(false);
      setLastWin(WHEEL_SEGMENTS[idx].points);
      onSpin(WHEEL_SEGMENTS[idx].points);
    }, 3500);
  }

  const HARI_URUT = [
    { idx: 0, label: "Minggu", singkat: "Min" },
    { idx: 1, label: "Senin", singkat: "Sen" },
    { idx: 2, label: "Selasa", singkat: "Sel" },
    { idx: 3, label: "Rabu", singkat: "Rab" },
    { idx: 4, label: "Kamis", singkat: "Kam" },
    { idx: 5, label: "Jumat", singkat: "Jum" },
    { idx: 6, label: "Sabtu", singkat: "Sab" },
  ];
  const today = new Date().getDay();
  const todayClaimed = dailyClaims[today] !== undefined;
  const weekdaysFullyClaimed = [0, 1, 2, 3, 4, 5].every((d) => dailyClaims[d] !== undefined);

  return (
    <div style={{ minHeight: "100vh", padding: "18px 20px 40px" }}>
      <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#F7F5F1", margin: "-18px -20px 0", padding: "18px 20px 10px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, marginBottom: 8 }}>
        <ChevronLeft size={18} /> Kembali
      </button>
      </div>

      <div style={{ background: "#24272B", borderRadius: 18, padding: 20, marginBottom: 20, textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#E8A426", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
          <Star size={22} color="#24272B" />
        </div>
        <p style={{ color: "#9CA0A6", fontSize: 12, margin: 0 }}>Total Poin</p>
        <p className="disp" style={{ color: "#fff", fontSize: 32, fontWeight: 700, margin: "2px 0 0" }}>{pointsBalance.toLocaleString("id-ID")}</p>
      </div>

      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>Check-in Harian</h2>
      <p style={{ fontSize: 12, color: "#9CA0A6", margin: "0 0 14px", lineHeight: 1.5 }}>
        Klaim tiap hari. Klaim spesial poin di setiap hari Sabtu.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 20 }}>
        {HARI_URUT.map((h) => {
          const claimed = dailyClaims[h.idx];
          const isToday = h.idx === today;
          const isPast = h.idx < today;
          const isFuture = h.idx > today;
          const missed = isPast && claimed === undefined;
          const isSabtu = h.idx === 6;

          let bg = "#F7F5F1", fg = "#9CA0A6", border = "1px solid transparent";
          if (isSabtu && claimed === undefined && !missed) { bg = "#FBF0D9"; fg = "#B8860B"; }
          if (claimed !== undefined) { bg = isSabtu ? "#EFE1BE" : "#D8E9E6"; fg = isSabtu ? "#B8860B" : "#24272B"; }
          if (missed) { bg = "#F7F5F1"; fg = "#9CA0A6"; }
          if (isToday && !todayClaimed) { border = "1.5px solid #E8A426"; }

          return (
            <div key={h.idx} style={{ textAlign: "center" }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: isToday ? "#24272B" : "#9CA0A6", margin: "0 0 4px" }}>{h.singkat}</p>
              <div style={{ background: bg, border, borderRadius: 10, aspectRatio: "1", padding: "4px 2px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                {isSabtu ? <Star size={14} color={fg} /> : claimed !== undefined ? <Check size={14} color={fg} /> : <Star size={13} color={fg} />}
                <span style={{ fontSize: 8.5, fontWeight: 700, color: fg, marginTop: 3, lineHeight: 1.2, textAlign: "center" }}>
                  {claimed !== undefined ? `+${claimed}` : missed ? "?" : isSabtu ? "Poin Spesial" : isFuture ? "-" : "Klaim"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {todayClaimed ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#D8E9E6", color: "#24272B", padding: "14px", borderRadius: 12, fontSize: 13.5, fontWeight: 700 }}>
          <Check size={16} /> Sudah diklaim hari ini, kembali lagi besok
        </div>
      ) : (
        <button
          onClick={onClaim}
          style={{ width: "100%", padding: "15px", borderRadius: 12, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Star size={17} /> Klaim Poin Hari Ini{today === 6 ? (weekdaysFullyClaimed ? " (Bonus Spesial!)" : "") : ""}
        </button>
      )}

      <div style={{ marginTop: 32 }}>
        <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>Lucky Wheel</h2>
        <p style={{ fontSize: 12, color: "#9CA0A6", margin: "0 0 18px", lineHeight: 1.5 }}>
          Dapatkan tiket Spin setiap melakukan orderan. Putar untuk dapat 150, 250, 350, atau 500 poin.
        </p>

        <div style={{ position: "relative", width: 220, height: 220, margin: "0 auto 20px" }}>
          <div style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "16px solid #24272B", zIndex: 2 }} />
          <div
            style={{
              width: 220, height: 220, borderRadius: "50%",
              background: `conic-gradient(${WHEEL_SEGMENTS.map((s, i) => `${s.color} ${i * 25}% ${(i + 1) * 25}%`).join(", ")})`,
              border: "5px solid #24272B",
              position: "relative",
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? "transform 3.5s cubic-bezier(0.17, 0.89, 0.32, 1.1)" : "none",
            }}
          >
            {WHEEL_SEGMENTS.map((s, i) => {
              const segAngle = 360 / WHEEL_SEGMENTS.length;
              const centerAngle = i * segAngle + segAngle / 2;
              return (
                <div
                  key={i}
                  style={{
                    position: "absolute", top: "50%", left: "50%", width: 0, height: 0,
                    transform: `rotate(${centerAngle}deg) translate(0, -78px) rotate(${-centerAngle}deg)`,
                  }}
                >
                  <span className="disp" style={{ display: "block", transform: "translate(-50%, -50%)", fontSize: 15, fontWeight: 700, color: s.text, whiteSpace: "nowrap" }}>
                    {s.points}
                  </span>
                </div>
              );
            })}
          </div>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 18, height: 18, borderRadius: "50%", background: "#24272B", border: "3px solid #E8A426" }} />
        </div>

        {lastWin !== null && !spinning && (
          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: 0 }}>🎉 Selamat! Anda dapat {lastWin} poin</p>
          </div>
        )}

        <button
          onClick={handleSpin}
          disabled={spinTickets <= 0 || spinning}
          style={{ width: "100%", padding: "15px", borderRadius: 12, border: "none", background: (spinTickets <= 0 || spinning) ? "#E4E1DA" : "#E8A426", color: (spinTickets <= 0 || spinning) ? "#9CA0A6" : "#24272B", fontWeight: 700, fontSize: 15 }}
        >
          {spinning ? "Memutar..." : `Putar Sekarang (${spinTickets} tiket)`}
        </button>
        {spinTickets <= 0 && !spinning && (
          <p style={{ textAlign: "center", fontSize: 11.5, color: "#9CA0A6", marginTop: 8 }}>
            Belum ada tiket. Selesaikan 1 pesanan untuk dapat tiket Spin.
          </p>
        )}
      </div>
    </div>
  );
}


function BottomNav({ screen, cartCount, isGuest, onCatalog, onCart, onHistory, onAkun, onRequireLogin }) {
  const items = [
    { key: "catalog", label: "Katalog", icon: Package, onClick: onCatalog },
    { key: "cart", label: "Keranjang", icon: ShoppingCart, onClick: isGuest ? onRequireLogin : onCart, badge: isGuest ? 0 : cartCount },
    { key: "history", label: "Riwayat", icon: ClipboardList, onClick: isGuest ? onRequireLogin : onHistory },
    { key: "akun", label: isGuest ? "Login" : "Akun", icon: isGuest ? LogOut : User, onClick: isGuest ? onRequireLogin : onAkun },
  ];
  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#fff", borderTop: "1px solid #EDEAE3", display: "flex", padding: "8px 0 10px" }}>
      {items.map((it) => {
        const Icon = it.icon;
        const active = it.key === "akun" ? screen.startsWith("akun") : screen === it.key;
        return (
          <button key={it.key} onClick={it.onClick} style={{ flex: 1, background: "none", border: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, position: "relative", padding: "6px 0" }}>
            <div style={{ position: "relative" }}>
              <Icon size={22} color={active ? "#24272B" : "#B5B2AA"} strokeWidth={active ? 2.3 : 1.8} />
              {it.badge > 0 && (
                <span style={{ position: "absolute", top: -6, right: -8, background: "#E8A426", color: "#24272B", fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
                  {it.badge}
                </span>
              )}
            </div>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: active ? "#24272B" : "#B5B2AA" }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
