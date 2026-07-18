import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ShoppingCart, Search, Plus, Minus, X, ChevronLeft, Package,
  Building2, Hammer, PaintBucket, Milestone, LayoutGrid, Wrench,
  Store, ClipboardList, User, Check, Clock, ArrowRight, AlertCircle,
  Truck, PackageCheck, Wallet, RotateCcw, CreditCard, Headphones,
  HelpCircle, ChevronRight, Phone, MessageCircle, Copy, MapPin, LogOut, Lock, Star, Upload, Share2,
  Smile, Camera, Image as ImageIcon, Bell, History, MoreVertical
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

async function supabaseFetch(path, options = {}, userToken = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${userToken || SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`);
  return res.json();
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
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.msg || data.error_description || "Email atau password salah.");
  return data; // { access_token, user, ... }
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
// Diskon tambahan 5% kalau qty mencapai isiPerKoli bersifat ADITIF terhadap diskon
// standar (20%+5%=25% dari hargaAsli), BUKAN dihitung bertingkat/majemuk.
function hitungRincianItem(product, qty) {
  const subtotalSebelum = product.harga * qty;
  const kenaKoli = product.isiPerKoli > 0 && qty >= product.isiPerKoli;
  let totalSetelahDiskon = subtotalSebelum;
  let hargaSetelahKoli = product.harga;

  if (kenaKoli) {
    const diskonTambahanPct = product.diskonKoliPct !== undefined && product.diskonKoliPct !== null ? product.diskonKoliPct : 0.05;
    if (product.hargaAsli) {
      const diskonStandarPct = (product.hargaAsli - product.harga) / product.hargaAsli;
      const totalDiskonPct = diskonStandarPct + diskonTambahanPct; // aditif, misal 20% + 5% = 25%
      hargaSetelahKoli = product.hargaAsli * (1 - totalDiskonPct);
    } else {
      hargaSetelahKoli = product.harga * (1 - diskonTambahanPct);
    }
    totalSetelahDiskon = hargaSetelahKoli * qty;
  }

  return {
    subtotalSebelum,
    totalDiskon: subtotalSebelum - totalSetelahDiskon,
    totalSetelahDiskon,
    kenaKoli,
    hargaSetelahKoli,
  };
}

const rupiah = (n) => "Rp" + n.toLocaleString("id-ID");

// ============================================================
// KOMPONEN UTAMA
// ============================================================
export default function OrderApp() {
  const [screen, setScreen] = useState("catalog"); // login | register | catalog | product | cart | success | history | akun | akun-rekening | akun-cs | akun-bantuan | campaign-detail
  const [campaignVisible, setCampaignVisible] = useState(true);
  const [campaignReturnScreen, setCampaignReturnScreen] = useState("catalog");
  const [csReturnScreen, setCsReturnScreen] = useState("akun");
  const [products, setProducts] = useState(SAMPLE_PRODUCTS); // fallback dulu, diganti data asli kalau fetch berhasil
  const [dbError, setDbError] = useState("");

  useEffect(() => {
    supabaseFetch("v_katalog_publik?select=id,kode,nama,kategori,satuan,harga_jual,harga_asli,isi_per_koli,diskon_koli_pct,gambar_url,deskripsi")
      .then(async (rows) => {
        let stockMap = {};
        try {
          const stockRows = await supabaseFetch("v_stock_akhir?select=kode,stock_akhir");
          stockRows.forEach((r) => { stockMap[r.kode] = r.stock_akhir; });
        } catch (e) { /* kalau gagal, pakai stock_awal sebagai cadangan */ }
        const mapped = rows.map((r) => mapSupabaseProduct({ ...r, stock_akhir: stockMap[r.kode] }));
        if (mapped.length > 0) setProducts(mapped);
      })
      .catch(() => {
        setDbError("Tidak bisa akses database asli (mode preview) - sementara pakai data contoh.");
      });
  }, []);

  const [isGuest, setIsGuest] = useState(true);
  const [pointsBalance, setPointsBalance] = useState(0);
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
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem("cart_v1");
      return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
  }); // { kodeBarang: qty }
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    try { localStorage.setItem("cart_v1", JSON.stringify(cart)); } catch (e) {}
  }, [cart]);
  const [orders, setOrders] = useState([]);
  const [regForm, setRegForm] = useState({ email: "", password: "", nama: "", alamat: "", telp: "", jenisBayar: "Transfer", tempo: "0", provinsi: "", provinsiId: "", kota: "", kotaId: "", kecamatan: "", kecamatanId: "", kelurahan: "", kodePos: "" });
  const [regSubmitted, setRegSubmitted] = useState(false);
  const [regError, setRegError] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [useAltAddress, setUseAltAddress] = useState(false);
  const [editingAlt, setEditingAlt] = useState(false);
  const [altAddress, setAltAddress] = useState({ nama: "", telp: "", alamat: "" });
  const [isDropship, setIsDropship] = useState(false);
  const [dropshipPrices, setDropshipPrices] = useState({}); // { kodeBarang: hargaDropshipPerUnit }
  const [savedAddresses, setSavedAddresses] = useState([]); // [{ id, nama, telp, alamat }]
  const [dropshipSender, setDropshipSender] = useState("");
  const [savedSenderNames, setSavedSenderNames] = useState([]); // riwayat nama pengirim
  const [checkedItems, setCheckedItems] = useState({}); // { kodeBarang: false } -> default true kalau tidak ada di sini

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartRincian = useMemo(() => {
    return Object.entries(cart).reduce((acc, [kode, qty]) => {
      if (checkedItems[kode] === false) return acc; // dilewati kalau centangnya dihilangkan
      const p = products.find((x) => x.kode === kode);
      if (!p) return acc;
      const r = hitungRincianItem(p, qty);
      acc.subtotalSebelum += r.subtotalSebelum;
      acc.totalDiskon += r.totalDiskon;
      acc.totalBayar += r.totalSetelahDiskon;
      return acc;
    }, { subtotalSebelum: 0, totalDiskon: 0, totalBayar: 0 });
  }, [cart, checkedItems, products]);
  const cartTotal = cartRincian.totalBayar;
  const belowMinimum = cartTotal > 0 && cartTotal < MIN_CHECKOUT;

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
          : o.status === "menunggu_pengiriman" ? "Menunggu Pengiriman"
          : o.status === "proses_dikirim" || o.status === "dikirim" ? "Dikirim"
          : o.status === "selesai" ? "Selesai"
          : o.status,
        alasanDibatalkan: o.alasan_dibatalkan || null,
        sudahBayar: o.status_bayar === "lunas",
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
  async function loadTokoAndEnterApp(userId, token, email) {
    const rows = await supabaseFetch(`clients?select=*&id=eq.${userId}`, {}, token);
    if (!rows || rows.length === 0) {
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
    const tokoData = { id: r.id, kode: r.kode, nama: r.nama, alamat: r.alamat, telp: r.telp, kota: r.kota, jenisBayar: r.jenis_pembayaran, email, salesId: r.sales_id || null };
    setToko(tokoData);
    setAuthToken(token);
    setIsGuest(false);
    setScreen("catalog");
    saveSession({ token, userId, email });
    loadOrderHistory(r.id, token);
    loadPointsData(r.id, token);
    return true;
  }

  // Tarik data poin/checkin/tiket asli dari database (supaya tidak reset ke 0 tiap refresh)
  async function loadPointsData(clientId, token) {
    try {
      const now = new Date();
      const day = now.getDay();
      const sunday = new Date(now); sunday.setDate(now.getDate() - day); sunday.setHours(0, 0, 0, 0);
      const saturday = new Date(sunday); saturday.setDate(sunday.getDate() + 6); saturday.setHours(23, 59, 59, 999);
      const sundayStr = sunday.toISOString().slice(0, 10);
      const saturdayStr = saturday.toISOString().slice(0, 10);

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
      const ok = await loadTokoAndEnterApp(auth.user.id, auth.access_token, auth.user.email);
      if (!ok) clearSession();
    } catch (e) {
      setLoginError(e.message);
    }
    setLoggingIn(false);
  }

  function handleGuestBrowse() {
    setToko(null);
    setIsGuest(true);
    setLoginError("");
    setScreen("catalog");
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
    setDropshipPrices({});
    setDropshipSender("");
    setScreen("login");
  }

  // Begitu app dibuka, cek dulu apakah ada sesi login tersimpan (supaya tidak
  // disuruh login ulang tiap refresh halaman).
  useEffect(() => {
    const session = loadSession();
    if (!session) { setRestoringSession(false); return; }
    loadTokoAndEnterApp(session.userId, session.token, session.email)
      .catch(() => clearSession())
      .finally(() => setRestoringSession(false));
  }, []);


  function addToCart(kode, delta) {
    setCart((prev) => {
      const next = { ...prev };
      const cur = next[kode] || 0;
      const updated = Math.max(0, cur + delta);
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
  function saveCurrentAddress() {
    const exists = savedAddresses.some((a) => a.telp === altAddress.telp && a.alamat === altAddress.alamat);
    if (!exists && altAddress.alamat.trim()) {
      setSavedAddresses((prev) => [...prev, { id: Date.now(), ...altAddress }]);
    }
    setEditingAlt(false);
  }

  function pickSavedAddress(addr) {
    setAltAddress({ nama: addr.nama, telp: addr.telp, alamat: addr.alamat });
    setEditingAlt(false);
  }

  function handleToggleDropship(checked) {
    setIsDropship(checked);
    if (checked && !dropshipSender) {
      setDropshipSender(savedSenderNames[0] || toko?.nama || "");
    }
  }

  async function submitOrder() {
    if (cartTotal < MIN_CHECKOUT) return; // jaga-jaga, tombol sudah dinonaktifkan di UI
    const items = Object.entries(cart)
      .filter(([kode]) => checkedItems[kode] !== false)
      .map(([kode, qty]) => {
        const p = products.find((x) => x.kode === kode);
        return { ...p, qty };
      });
    const tujuan = useAltAddress
      ? { nama: altAddress.nama || toko.nama, telp: altAddress.telp, alamat: altAddress.alamat }
      : { nama: toko.nama, telp: toko.telp, alamat: toko.alamat };
    const itemsWithDropship = items.map((it) => ({
      ...it,
      hargaDropship: isDropship && dropshipPrices[it.kode] ? Number(dropshipPrices[it.kode]) : null,
    }));

    // Nomor Nota SELALU diambil dari database (supaya tidak bentrok antar toko) -
    // kode di bawah cuma dipakai fallback kalau memang toko sedang mode tanpa database.
    let noNota = "NOTA-" + String(1000 + orders.length + 1).slice(1);

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
          }),
        }, authToken);
        noNota = insertedOrder.no_nota; // pakai nomor resmi dari database
        await supabaseFetch("order_items", {
          method: "POST",
          body: JSON.stringify(
            itemsWithDropship.map((it) => ({
              order_id: insertedOrder.id,
              product_id: it.id,
              qty: it.qty,
              harga_satuan: it.harga,
              kena_diskon_koli: it.qty >= (it.isiPerKoli || Infinity),
              subtotal_setelah_diskon: hitungRincianItem(it, it.qty).totalSetelahDiskon,
              harga_dropship: it.hargaDropship,
            }))
          ),
        }, authToken);
        // Dapat 1 tiket Lucky Wheel tiap order - simpan permanen ke database
        try {
          await supabaseFetch("spin_tickets", {
            method: "POST",
            body: JSON.stringify({ client_id: toko.id, order_id: insertedOrder.id, dipakai: false }),
          }, authToken);
          setSpinTickets((prev) => prev + 1);
        } catch (e) {
          console.log("Gagal simpan tiket spin:", e.message);
        }
      } catch (e) {
        console.log("Gagal simpan order ke database asli (mode preview?):", e.message);
      }
    }

    const order = {
      id: noNota, tanggal: new Date(), items: itemsWithDropship, total: cartTotal,
      status: "Menunggu Persetujuan", tujuan, isDropship,
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
    setDropshipPrices({});
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
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
    const order = orders.find((o) => o.id === orderId);
    if (order?.dbId) {
      try {
        await supabaseFetch(`orders?id=eq.${order.dbId}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "selesai" }),
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
    const ext = file.name.split(".").pop();
    const filePath = `${order.dbId}-${Date.now()}.${ext}`;
    try {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/bukti-transfer/${filePath}`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${authToken || SUPABASE_ANON_KEY}`,
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
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

    const todayStr = new Date().toISOString().slice(0, 10);
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
      alert("Gagal simpan poin, coba lagi: " + e.message);
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

  async function submitRegistration() {
    setRegError("");
    setRegLoading(true);
    try {
      const auth = await supabaseSignUp(regForm.email.trim(), regForm.password);
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
          status: "pending",
          // kode TIDAK diisi -> otomatis dibuatkan nomor berikutnya oleh database
        }),
      }, auth.access_token);
      setRegSubmitted(true);
    } catch (e) {
      setRegError(e.message || "Gagal daftar. Coba lagi.");
    }
    setRegLoading(false);
  }

  const filteredProducts = products.filter((p) => {
    const matchCategory = activeCategory === "Semua" || p.kategori === activeCategory;
    const matchSearch = p.nama.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

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

      {campaignVisible && screen !== "login" && screen !== "register" && screen !== "campaign-detail" && (
        <FloatingCampaignWidget
          imageUrl="https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif"
          onClose={() => setCampaignVisible(false)}
          onOpenDetail={() => { setCampaignReturnScreen(screen); setScreen("campaign-detail"); }}
        />
      )}

      {screen === "login" && (
        <LoginScreen
          form={loginForm} setForm={setLoginForm}
          loginError={loginError} onLogin={handleLogin} loading={loggingIn}
          onGoRegister={() => setScreen("register")}
          onGuestBrowse={handleGuestBrowse}
        />
      )}

      {screen === "register" && (
        <RegisterScreen
          regForm={regForm} setRegForm={setRegForm}
          submitted={regSubmitted} onSubmit={submitRegistration}
          error={regError} loading={regLoading}
          onBack={() => { setScreen("login"); setRegSubmitted(false); setRegError(""); setRegForm({ email: "", password: "", nama: "", alamat: "", telp: "", jenisBayar: "Transfer", tempo: "0", provinsi: "", provinsiId: "", kota: "", kotaId: "", kecamatan: "", kecamatanId: "", kelurahan: "", kodePos: "" }); }}
        />
      )}

      {screen === "catalog" && (
        <CatalogScreen
          toko={toko} isGuest={isGuest}
          products={filteredProducts}
          activeCategory={activeCategory} setActiveCategory={setActiveCategory}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          cart={cart} addToCart={addToCart}
          onOpenProduct={(p) => { setSelectedProduct(p); setScreen("product"); }}
          onRequireLogin={() => setScreen("login")}
          onOpenChat={() => setScreen("cs-chat-choice")}
          onOpenNotifikasi={() => setScreen("notifikasi")}
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
          products={products} orders={orders} cart={cart} rincian={cartRincian}
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
          dropshipPrices={dropshipPrices} setDropshipPrices={setDropshipPrices}
          dropshipSender={dropshipSender} setDropshipSender={setDropshipSender} savedSenderNames={savedSenderNames}
          cart={cart} products={products} rincian={cartRincian} belowMinimum={belowMinimum}
          checkedItems={checkedItems} setCheckedItems={setCheckedItems}
          addToCart={addToCart} setCartQty={setCartQty}
          onBack={() => setScreen("catalog")}
          onCheckout={submitOrder}
        />
      )}

      {screen === "success" && (
        <SuccessScreen order={orders[0]} onDone={() => setScreen("catalog")} onHistory={() => setScreen("history")} />
      )}

      {screen === "history" && (
        <HistoryScreen orders={orders} onBack={() => setScreen("catalog")} />
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
          onLogout={handleLogout}
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
        <RekeningScreen onBack={() => setScreen("akun")} />
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
    </div>
  );
}

// ============================================================
// REGISTRASI TOKO BARU
// ============================================================
function RegisterScreen({ regForm, setRegForm, submitted, onSubmit, onBack, error, loading }) {
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
function CatalogScreen({ toko, isGuest, products, activeCategory, setActiveCategory, searchQuery, setSearchQuery, cart, addToCart, onOpenProduct, onRequireLogin, onOpenChat, onOpenNotifikasi }) {
  // Gabungkan kategori bawaan dengan kategori baru (kalau ada) dari produk asli di database
  const kategoriDariProduk = Array.from(new Set(products.map((p) => p.kategori).filter(Boolean)));
  const categories = ["Semua", ...Array.from(new Set([...Object.keys(CATEGORY_META), ...kategoriDariProduk]))];
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
              <button onClick={onOpenChat} style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "#24272B", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <MessageCircle size={18} color="#fff" />
              </button>
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
            <div key={p.kode} style={{ background: "#fff", borderRadius: 16, padding: 14, border: "1px solid #EDEAE3" }}>
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
                    <p className="disp" style={{ fontSize: 17, fontWeight: 700, color: p.hargaAsli ? "#C0392B" : "#24272B", margin: 0 }}>{rupiah(p.harga)}</p>
                    {p.isiPerKoli > 0 && (
                      qty >= p.isiPerKoli ? (
                        <p style={{ fontSize: 10, color: "#24272B", fontWeight: 700, margin: "4px 0 0", lineHeight: 1.3, display: "flex", alignItems: "center", gap: 3 }}>
                          <Check size={11} /> Diskon tambahan {Math.round((p.diskonKoliPct ?? 0.05) * 100)}% aktif (1 koli)
                        </p>
                      ) : (
                        <p style={{ fontSize: 10, color: "#B8860B", fontWeight: 600, margin: "4px 0 0", lineHeight: 1.3 }}>
                          Tambah {p.isiPerKoli - qty} {p.satuan} lagi untuk diskon {Math.round((p.diskonKoliPct ?? 0.05) * 100)}% (1 koli = {p.isiPerKoli} {p.satuan})
                        </p>
                      )
                    )}
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
        {products.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "40px 0", color: "#9CA0A6" }}>
            Barang tidak ketemu. Coba kata kunci lain.
          </div>
        )}
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
  const [fotoUtama, setFotoUtama] = useState([]);
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
              <img key={i} src={url} alt={product.nama} style={{ width: "100%", flexShrink: 0, scrollSnapAlign: "start", display: "block" }} />
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
            {product.isiPerKoli > 0 && (
              qty >= product.isiPerKoli ? (
                <div style={{ background: "#D8E9E6", color: "#24272B", padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
                  <Check size={15} /> Diskon tambahan {Math.round((product.diskonKoliPct ?? 0.05) * 100)}% aktif — sudah 1 koli ({product.isiPerKoli} {product.satuan})
                </div>
              ) : (
                <div style={{ background: "#FBF0D9", color: "#B8860B", padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
                  🎉 Tambah {product.isiPerKoli - qty} {product.satuan} lagi untuk diskon tambahan {Math.round((product.diskonKoliPct ?? 0.05) * 100)}% (1 koli = {product.isiPerKoli} {product.satuan})
                </div>
              )
            )}
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
              <img key={img.id} src={img.url} alt="" style={{ width: "100%", display: "block" }} />
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
          <button onClick={onBack} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 15 }}>
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
function CartScreen({ toko, useAltAddress, setUseAltAddress, editingAlt, setEditingAlt, altAddress, setAltAddress, savedAddresses, onSaveAddress, onPickAddress, isDropship, setIsDropship, dropshipPrices, setDropshipPrices, dropshipSender, setDropshipSender, savedSenderNames, cart, products, rincian, belowMinimum, checkedItems, setCheckedItems, addToCart, setCartQty, onBack, onCheckout }) {
  const [editingQtyKode, setEditingQtyKode] = useState(null);
  const [qtyInput, setQtyInput] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const items = Object.entries(cart).map(([kode, qty]) => ({ ...products.find((p) => p.kode === kode), qty }));

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

  const kurang = MIN_CHECKOUT - rincian.totalBayar;
  const setAlt = (k) => (e) => setAltAddress({ ...altAddress, [k]: e.target.value });
  const canSaveAlt = altAddress.telp.trim() && altAddress.alamat.trim();

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 300 }}>
      <div style={{ padding: "20px 20px 8px", position: "sticky", top: 0, zIndex: 10, background: "#F7F5F1" }}>
        <h1 className="disp" style={{ fontSize: 26, fontWeight: 700, color: "#24272B", margin: 0 }}>Keranjang</h1>
        <p style={{ color: "#9CA0A6", fontSize: 13, marginTop: 2 }}>{items.length} jenis barang</p>
      </div>

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
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9CA0A6" }}>{addr.telp} · {addr.alamat}</p>
                </button>
              ))}
              <button
                onClick={() => { setShowPicker(false); setEditingAlt(true); setAltAddress({ nama: "", telp: "", alamat: "" }); }}
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
              <Field label="Alamat Pengiriman">
                <textarea value={altAddress.alamat} onChange={setAlt("alamat")} rows={2} placeholder="Jl. Contoh No. 2, Kota" style={{ ...inputStyle, resize: "none" }} />
              </Field>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  onClick={() => { setUseAltAddress(false); setEditingAlt(false); setAltAddress({ nama: "", telp: "", alamat: "" }); }}
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
                <p style={{ margin: 0 }}>{altAddress.alamat}</p>
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 10, marginBottom: 12 }}>
                <button
                  onClick={() => { if (savedAddresses.length > 0) setShowPicker(true); else setEditingAlt(true); }}
                  style={{ background: "none", border: "none", color: "#B8860B", fontSize: 12.5, fontWeight: 700, padding: 0 }}
                >
                  Ganti alamat
                </button>
                <button
                  onClick={() => { setUseAltAddress(false); setEditingAlt(false); setAltAddress({ nama: "", telp: "", alamat: "" }); setIsDropship(false); setDropshipPrices({}); }}
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
                  Ini pesanan dropship — saya atur sendiri harga untuk penerima
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
                {r.kenaKoli ? (
                  <p style={{ fontSize: 13, margin: 0 }}>
                    <span style={{ color: "#B5B2AA", textDecoration: "line-through" }}>{rupiah(p.harga)}</span>{" "}
                    <span style={{ color: "#C0392B", fontWeight: 700 }}>{rupiah(Math.round(r.hargaSetelahKoli))}</span>{" "}
                    <span style={{ color: "#9CA0A6" }}>/ {p.satuan}</span>
                  </p>
                ) : (
                  <p style={{ fontSize: 13, color: "#9CA0A6", margin: 0 }}>{rupiah(p.harga)} / {p.satuan}</p>
                )}
                {r.totalDiskon > 0 && (
                  <p style={{ fontSize: 11.5, color: "#24272B", fontWeight: 600, margin: "4px 0 0" }}>
                    Hemat {rupiah(Math.round(r.totalDiskon))} {r.kenaKoli && "(termasuk bonus koli)"}
                  </p>
                )}
                {!r.kenaKoli && p.isiPerKoli > 0 && (
                  <p style={{ fontSize: 11.5, color: "#B8860B", fontWeight: 600, margin: "4px 0 0" }}>
                    Tambah {p.isiPerKoli - p.qty} {p.satuan} lagi (jadi {p.isiPerKoli} = 1 koli) untuk diskon tambahan {Math.round((p.diskonKoliPct ?? 0.05) * 100)}%
                  </p>
                )}
                {isDropship && (
                  <div style={{ marginTop: 8 }}>
                    <label style={{ fontSize: 10.5, color: "#9CA0A6", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", display: "block", marginBottom: 4 }}>
                      Harga untuk dropship
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 13, color: "#6B6F75" }}>Rp</span>
                      <input
                        type="number"
                        value={dropshipPrices[p.kode] ?? ""}
                        onChange={(e) => setDropshipPrices({ ...dropshipPrices, [p.kode]: e.target.value })}
                        placeholder={String(Math.round(r.kenaKoli ? r.hargaSetelahKoli : p.harga))}
                        style={{ width: 100, padding: "6px 8px", borderRadius: 8, border: "1.5px solid #E4E1DA", fontSize: 13, fontWeight: 600, outline: "none" }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "space-between" }}>
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

      <div style={{ position: "fixed", bottom: 72, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "#fff", borderTop: "1px solid #EDEAE3", padding: "10px 20px 12px" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#FBEAEA", color: "#C0392B", padding: "7px 10px", borderRadius: 9, fontSize: 11, fontWeight: 600, marginBottom: 8 }}>
            <AlertCircle size={14} style={{ flexShrink: 0 }} />
            Minimal order {rupiah(MIN_CHECKOUT)}. Tambah belanja {rupiah(Math.round(kurang))} lagi.
          </div>
        )}

        <button
          onClick={onCheckout}
          disabled={belowMinimum}
          style={{ width: "100%", padding: "10px", borderRadius: 10, border: "none", background: belowMinimum ? "#E4E1DA" : "#E8A426", color: belowMinimum ? "#9CA0A6" : "#24272B", fontWeight: 700, fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
        >
          Kirim Order {!belowMinimum && <ArrowRight size={13} />}
        </button>
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
function HistoryScreen({ orders, onBack }) {
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
              <span className="disp" style={{ fontWeight: 700, fontSize: 16, color: "#24272B" }}>{o.id}</span>
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
      {detailOrder && <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />}
    </div>
  );
}

// ============================================================
// AKUN
// ============================================================
function AccountScreen({ toko, orders, onMarkPaid, pointsBalance, onOpenRekening, onOpenCS, onOpenBantuan, onOpenPoin, onOpenOrderList, onOpenOrderUlang, onLogout }) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const counts = {
    pesanan: orders.filter((o) => o.status === "Menunggu Persetujuan").length,
    kirim: orders.filter((o) => o.status === "Menunggu Pengiriman").length,
    konfirmasi: orders.filter((o) => o.status === "Dikirim").length,
    bayar: orders.filter((o) => !o.sudahBayar && o.status !== "Dibatalkan").length,
  };
  const tiles = [
    { key: "pesanan", label: "Pesanan", icon: ClipboardList, count: counts.pesanan, matchStatus: "Menunggu Persetujuan" },
    { key: "kirim", label: "Menunggu Pengiriman", icon: Truck, count: counts.kirim, matchStatus: "Menunggu Pengiriman" },
    { key: "konfirmasi", label: "Konfirmasi Penerimaan", icon: PackageCheck, count: counts.konfirmasi, matchStatus: "Dikirim" },
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
            <p style={{ color: "#9CA0A6", fontSize: 12, margin: "2px 0 0" }}>Kode Toko: {toko?.kode}</p>
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

      <div style={{ padding: "8px 20px 4px" }}>
        <MenuRow icon={Bell} label="Aktifkan Notifikasi" onClick={() => subscribeToPush(toko.id)} />
        <MenuRow icon={RotateCcw} label="Order Ulang" onClick={onOpenOrderUlang} />
        <MenuRow icon={Star} label="Poin Saya" onClick={onOpenPoin} />
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
    pesanan: "Pesanan", kirim: "Menunggu Pengiriman", konfirmasi: "Konfirmasi Penerimaan", bayar: "Belum Bayar",
  };
  const MATCH_STATUS = {
    pesanan: "Menunggu Persetujuan", kirim: "Menunggu Pengiriman", konfirmasi: "Dikirim",
  };

  const filteredOrders = filterKey === "bayar"
    ? orders.filter((o) => !o.sudahBayar && o.status !== "Dibatalkan")
    : orders.filter((o) => o.status === MATCH_STATUS[filterKey]);

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
              <span className="disp" style={{ fontWeight: 700, fontSize: 14 }}>{o.id}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#24272B" }}>{rupiah(o.total)}</span>
            </div>
            <button onClick={() => setDetailOrder(o)} style={{ background: "none", border: "1px solid #E4E1DA", borderRadius: 8, padding: "6px 12px", color: "#24272B", fontSize: 11.5, fontWeight: 600, marginBottom: 8 }}>
              Detail Pesanan
            </button>
            {o.status === "Dikirim" && (
              <button onClick={() => onAdvance(o.id, "Selesai")} style={{ width: "100%", marginTop: 4, padding: "9px", borderRadius: 9, border: "none", background: "#E8A426", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}>
                Konfirmasi Penerimaan
              </button>
            )}
            {!o.sudahBayar && filterKey === "bayar" && (
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
            {!o.sudahBayar && filterKey === "bayar" && o.status !== "Dibatalkan" && (
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
            {o.status === "Menunggu Pengiriman" && (
              <p style={{ fontSize: 11, color: "#9CA0A6", margin: "4px 0 0" }}>Barang sedang disiapkan untuk dikirim.</p>
            )}
          </div>
        ))
      )}
      {detailOrder && <OrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />}
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
function OrderDetailModal({ order, onClose }) {
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
          <span style={{ fontSize: 11, fontWeight: 700, color: order.status === "Dibatalkan" ? "#C0392B" : "#B8860B", background: order.status === "Dibatalkan" ? "#FBEAEA" : "#FBF0D9", padding: "4px 10px", borderRadius: 999 }}>
            {order.status}
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: order.sudahBayar ? "#24272B" : "#C0392B", background: order.sudahBayar ? "#D8E9E6" : "#FBEAEA", padding: "4px 10px", borderRadius: 999 }}>
            {order.sudahBayar ? "Lunas" : "Belum Lunas"}
          </span>
          {order.isDropship && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#B8860B", background: "#FBF0D9", padding: "4px 10px", borderRadius: 999 }}>Dropship</span>
          )}
        </div>

        {order.status === "Dibatalkan" && order.alasanDibatalkan && (
          <div style={{ background: "#FBEAEA", borderRadius: 10, padding: 10, marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "#C0392B", margin: 0 }}>{order.alasanDibatalkan}</p>
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
          <img src={imageUrl} alt="Kampanye" style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} draggable={false} />
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
// CHAT CUSTOMER SERVICE AI - "INDAH"
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
// PILIHAN CHAT: INDAH (AI) ATAU SALES
// ============================================================
function CsChatChoiceScreen({ toko, onBack, onContactCS, products, orders, cart, rincian }) {
  const [activeTab, setActiveTab] = useState("indah"); // "indah" | "sales"
  const [salesInfo, setSalesInfo] = useState(null);
  const [showCaseHistory, setShowCaseHistory] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [caseHistoryList, setCaseHistoryList] = useState([]);
  const [caseHistorySearch, setCaseHistorySearch] = useState("");
  const [loadingCaseHistory, setLoadingCaseHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("sales"); // "sales" | "indah"

  // ---- state chat INDAH (AI) ----
  const [indahMessages, setIndahMessages] = useState([
    { role: "assistant", text: `Halo${toko?.nama ? " " + toko.nama : ""}! Saya INDAH, asisten customer service di sini. Ada yang bisa saya bantu seputar produk, cara order, atau status pesanan Anda?` },
  ]);
  const [indahInput, setIndahInput] = useState("");
  const [indahSending, setIndahSending] = useState(false);
  const indahScrollRef = useRef(null);

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
    supabaseFetch(`sales?select=nama,kode&id=eq.${toko.salesId}`)
      .then((rows) => setSalesInfo(rows[0] || null))
      .catch(() => setSalesInfo(null));
  }, [toko?.salesId]);

  useEffect(() => {
    loadExistingCaseOnly();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  // Cuma AMBIL kasus yang sudah ada (kalau ada) - TIDAK bikin No Case baru di
  // sini. No Case baru dibuat pas toko benar-benar kirim pesan pertama.
  async function loadExistingCaseOnly() {
    setSalesLoading(true);
    try {
      const existing = await supabaseFetch(`chat_cases?select=*&client_id=eq.${toko.id}&status=eq.open&order=created_at.desc&limit=1`);
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
    indahScrollRef.current?.scrollTo({ top: indahScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [indahMessages, indahSending]);

  useEffect(() => {
    salesScrollRef.current?.scrollTo({ top: salesScrollRef.current.scrollHeight, behavior: "smooth" });
  }, [salesMessages]);

  async function openCaseHistory() {
    setShowMoreMenu(false);
    setShowCaseHistory(true);
    setLoadingCaseHistory(true);
    try {
      const rows = await supabaseFetch(`chat_cases?select=id,no_case,status,created_at&client_id=eq.${toko.id}&order=created_at.desc`);
      setCaseHistoryList(rows);
    } catch (e) {
      console.log("Gagal muat riwayat case:", e.message);
    }
    setLoadingCaseHistory(false);
  }

  // ================= FUNGSI CHAT INDAH (AI) =================
  async function handleSendIndah() {
    const text = indahInput.trim();
    if (!text || indahSending) return;
    const nextMessages = [...indahMessages, { role: "user", text }];
    setIndahMessages(nextMessages);
    setIndahInput("");
    setIndahSending(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          system: `Kamu adalah INDAH, asisten AI customer service untuk toko B2B (distributor bahan bangunan & sparepart) yang melayani pelanggan lewat aplikasi order online ini. Tugasmu membantu pelanggan (pemilik toko yang jadi pelanggan B2B) dengan pertanyaan seputar produk, cara order, status pesanan, cara pembayaran, dan hal umum lain terkait layanan ini. Bersikap ramah, sopan, singkat, dan selalu pakai Bahasa Indonesia. Kalau ditanya hal di luar topik toko/produk/order, arahkan dengan sopan kembali ke seputar layanan ini. Kamu adalah AI, jangan berpura-pura jadi manusia kalau ditanya langsung. Nama toko yang sedang chat: ${toko?.nama || "Tamu"}.`,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.text })),
        }),
      });
      const data = await response.json();
      const replyText = data.content?.map((c) => c.text || "").join("") || "Maaf, saya belum bisa jawab itu sekarang.";
      setIndahMessages((prev) => [...prev, { role: "assistant", text: replyText }]);
    } catch (e) {
      setIndahMessages((prev) => [...prev, { role: "assistant", text: "Maaf, sedang ada gangguan koneksi. Coba lagi sebentar ya." }]);
    }
    setIndahSending(false);
  }

  // ================= FUNGSI CHAT SALES =================
  // Fungsi kirim generik - dipakai buat teks, gambar, referensi produk/pesanan/troli.
  async function sendMessage({ message, image_url, tipe_pesan }) {
    if (salesSending) return;
    setSalesSending(true);
    try {
      let activeCase = caseInfo;
      if (!activeCase) {
        const [created] = await supabaseFetch("chat_cases", {
          method: "POST",
          body: JSON.stringify({ client_id: toko.id, sales_id: toko.salesId || null }),
        });
        activeCase = created;
        setCaseInfo(created);
        pollRef.current = setInterval(() => loadMessages(created.id), 4000);
      }
      const [inserted] = await supabaseFetch("chat_messages", {
        method: "POST",
        body: JSON.stringify({ case_id: activeCase.id, sender_type: "toko", message: message || "", image_url: image_url || null, tipe_pesan: tipe_pesan || "teks" }),
      });
      setSalesMessages((prev) => [...prev, inserted]);
    } catch (e) {
      alert("Gagal kirim pesan: " + e.message);
    }
    setSalesSending(false);
  }

  async function handleSendSales() {
    const text = salesInput.trim();
    if (!text) return;
    setSalesInput("");
    await sendMessage({ message: text, tipe_pesan: "teks" });
  }

  function insertEmoji(emoji) {
    setSalesInput((prev) => prev + emoji);
    setShowEmoji(false);
  }

  async function handlePickImage(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setShowAttachMenu(false);
    setUploadingImage(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `chat-${toko.id}-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/produk-gambar/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": file.type || "application/octet-stream" },
        body: file,
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
    if (!caseInfo || caseInfo.status === "closed") return;
    if (!confirm("Tutup obrolan ini? Kalau nanti chat lagi, akan mulai No. Case baru.")) return;
    try {
      await supabaseFetch(`chat_cases?id=eq.${caseInfo.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "closed" }),
      });
      setCaseInfo((prev) => ({ ...prev, status: "closed" }));
      if (pollRef.current) clearInterval(pollRef.current);
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

      {/* TAB INDAH | SALES - langsung tampilkan chat, tanpa perlu pindah halaman */}
      <div style={{ display: "flex", gap: 8, padding: "12px 20px", background: "#fff", borderBottom: "1px solid #EDEAE3", flexShrink: 0 }}>
        <button
          onClick={() => setActiveTab("indah")}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px", borderRadius: 12, border: activeTab === "indah" ? "1.5px solid #E8A426" : "1.5px solid #EDEAE3", background: activeTab === "indah" ? "#FBF0D9" : "#fff" }}
        >
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#E8A426", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img
              src="https://api.dicebear.com/7.x/bottts/svg?seed=INDAH"
              alt="INDAH"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => { e.target.style.display = "none"; }}
            />
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: 0 }}>INDAH</p>
            <p style={{ fontSize: 10.5, color: "#9CA0A6", margin: 0 }}>AI Customer Service</p>
          </div>
        </button>
        <button
          onClick={() => setActiveTab("sales")}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px", borderRadius: 12, border: activeTab === "sales" ? "1.5px solid #E8A426" : "1.5px solid #EDEAE3", background: activeTab === "sales" ? "#FBF0D9" : "#fff" }}
        >
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#D8E9E6", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img
              src={`https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(salesInfo?.nama || "Sales")}`}
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

      {/* ===================== ISI CHAT INDAH ===================== */}
      {activeTab === "indah" && (
        <>
          <div ref={indahScrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            {indahMessages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
                <div style={{
                  maxWidth: "78%", padding: "10px 14px", borderRadius: 14,
                  background: m.role === "user" ? "#E8A426" : "#fff",
                  color: "#24272B",
                  border: m.role === "user" ? "none" : "1px solid #EDEAE3",
                  fontSize: 13.5, lineHeight: 1.5,
                  borderBottomRightRadius: m.role === "user" ? 4 : 14,
                  borderBottomLeftRadius: m.role === "user" ? 14 : 4,
                }}>
                  {m.text}
                </div>
              </div>
            ))}
            {indahSending && (
              <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
                <div style={{ padding: "10px 14px", borderRadius: 14, background: "#fff", border: "1px solid #EDEAE3", fontSize: 13, color: "#9CA0A6" }}>
                  INDAH sedang mengetik...
                </div>
              </div>
            )}
          </div>
          <div style={{ padding: "12px 20px", background: "#fff", borderTop: "1px solid #EDEAE3", display: "flex", gap: 10, flexShrink: 0 }}>
            <input
              value={indahInput}
              onChange={(e) => setIndahInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendIndah()}
              placeholder="Tulis pesan..."
              enterKeyHint="send"
              style={{ flex: 1, padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E4E1DA", fontSize: 13.5, outline: "none" }}
            />
            <button
              onClick={handleSendIndah}
              disabled={indahSending || !indahInput.trim()}
              style={{ padding: "0 18px", height: 44, borderRadius: 10, border: "none", background: (indahSending || !indahInput.trim()) ? "#E4E1DA" : "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              Kirim
            </button>
          </div>
        </>
      )}

      {/* ===================== ISI CHAT SALES ===================== */}
      {activeTab === "sales" && (
        salesLoading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#9CA0A6", fontSize: 13 }}>Memuat chat...</p>
          </div>
        ) : (
          <>
            <div style={{ padding: "10px 20px", background: "#fff", borderBottom: "1px solid #EDEAE3", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <p style={{ fontSize: 10.5, color: "#B5B2AA", margin: 0 }}>{caseInfo?.no_case ? `No. Case: ${caseInfo.no_case}` : "Belum ada No. Case - kirim pesan dulu"}</p>
              {caseInfo && caseInfo.status === "open" && (
                <button onClick={tutupKasus} style={{ padding: "5px 10px", borderRadius: 7, border: "1.5px solid #F0CFC7", background: "#fff", color: "#C0392B", fontSize: 11, fontWeight: 700 }}>
                  Tutup
                </button>
              )}
            </div>
            <div ref={salesScrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {salesMessages.length === 0 && (
                <p style={{ textAlign: "center", fontSize: 12.5, color: "#9CA0A6", padding: "20px 0" }}>
                  Belum ada pesan. Tulis pertanyaan Anda, sales akan membalas sesegera mungkin.
                </p>
              )}
              {salesMessages.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: m.sender_type === "toko" ? "flex-end" : "flex-start", marginBottom: 12 }}>
                  {m.tipe_pesan === "gambar" && m.image_url ? (
                    <img src={m.image_url} alt="Lampiran" style={{ maxWidth: "60%", borderRadius: 14, display: "block" }} />
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

            {caseInfo?.status === "closed" ? (
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
                    value={salesInput}
                    onChange={(e) => setSalesInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendSales()}
                    onFocus={() => { setShowAttachMenu(false); setShowEmoji(false); }}
                    placeholder="Tulis pesan..."
                    enterKeyHint="send"
                    style={{ flex: 1, padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E4E1DA", fontSize: 13.5, outline: "none" }}
                  />
                  <button
                    onClick={handleSendSales}
                    disabled={salesSending || !salesInput.trim()}
                    style={{ padding: "0 18px", height: 44, borderRadius: 10, border: "none", background: (salesSending || !salesInput.trim()) ? "#E4E1DA" : "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                  >
                    Kirim
                  </button>
                </div>
              </div>
            )}
          </>
        )
      )}

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
                onClick={() => setHistoryFilter("indah")}
                style={{ flex: 1, padding: "9px", borderRadius: 9, border: historyFilter === "indah" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: historyFilter === "indah" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
              >
                INDAH
              </button>
              <button
                onClick={() => setHistoryFilter("sales")}
                style={{ flex: 1, padding: "9px", borderRadius: 9, border: historyFilter === "sales" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: historyFilter === "sales" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
              >
                Salesman
              </button>
            </div>
            {historyFilter === "indah" ? (
              <p style={{ fontSize: 12.5, color: "#9CA0A6", textAlign: "center", padding: "20px 0" }}>Riwayat chat dengan INDAH belum tersimpan.</p>
            ) : loadingCaseHistory ? (
              <p style={{ fontSize: 12.5, color: "#9CA0A6", textAlign: "center", padding: "20px 0" }}>Memuat...</p>
            ) : (
              caseHistoryList
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
            {historyFilter === "sales" && !loadingCaseHistory && caseHistoryList.length === 0 && (
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
function CampaignDetailScreen({ onBack, cartCount, onGoToCart }) {
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
      <div style={{ padding: "20px 20px 40px" }}>
        <h1 className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>Promo Spesial!</h1>
        <p style={{ fontSize: 13.5, color: "#6B6F75", lineHeight: 1.6 }}>
          Ini halaman detail kampanye. Isi dengan konten promo, syarat & ketentuan,
          atau apapun yang Anda perlukan di sini.
        </p>
      </div>
    </div>
  );
}

function MenuRow({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "#fff", border: "1px solid #EDEAE3", borderRadius: 12, padding: 14, marginBottom: 10, textAlign: "left" }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={17} color="#24272B" />
      </div>
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "#24272B" }}>{label}</span>
      <ChevronRight size={17} color="#B5B2AA" />
    </button>
  );
}

// ============================================================
// REKENING / KETENTUAN PEMBAYARAN
// ============================================================
function RekeningScreen({ onBack }) {
  const [copiedIdx, setCopiedIdx] = useState(null);
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

      <p style={{ fontSize: 12, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>Rekening Perusahaan</p>
      {COMPANY_INFO.rekening.map((r, i) => (
        <div key={i} style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 14, padding: 16, marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: "#9CA0A6", margin: "0 0 4px" }}>{r.bank}</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p className="disp" style={{ fontSize: 20, fontWeight: 700, color: "#24272B", margin: 0 }}>{r.nomor}</p>
            <button onClick={() => copyNumber(r.nomor, i)} style={{ display: "flex", alignItems: "center", gap: 5, background: "#F7F5F1", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 11.5, fontWeight: 700, color: "#24272B" }}>
              <Copy size={13} /> {copiedIdx === i ? "Tersalin" : "Salin"}
            </button>
          </div>
          <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "6px 0 0" }}>a.n. {r.atasNama}</p>
        </div>
      ))}

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
            Belum ada tiket. Kirim order untuk dapat tiket Spin.
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
