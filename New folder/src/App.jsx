import React, { useState, useMemo, useEffect } from "react";
import {
  ShoppingCart, Search, Plus, Minus, X, ChevronLeft, Package,
  Building2, Hammer, PaintBucket, Milestone, LayoutGrid, Wrench,
  Store, ClipboardList, User, Check, Clock, ArrowRight, AlertCircle,
  Truck, PackageCheck, Wallet, RotateCcw, CreditCard, Headphones,
  HelpCircle, ChevronRight, Phone, MessageCircle, Copy, MapPin, LogOut, Lock, Star
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
  "Bahan Bangunan": { icon: Building2, bg: "#EFE1BE", fg: "#8A6A1A" },
  "Cat": { icon: PaintBucket, bg: "#E3D9F0", fg: "#5B3F91" },
  "Pipa": { icon: Milestone, bg: "#D8E9E6", fg: "#28685D" },
  "Keramik": { icon: LayoutGrid, bg: "#F0DCD6", fg: "#9A4630" },
  "Sparepart": { icon: Wrench, bg: "#DCE6F0", fg: "#2C5985" },
};

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

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}: ${await res.text()}`);
  return res.json();
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
    stock: row.stock_akhir !== undefined ? Number(row.stock_akhir) : (row.stock_awal ?? 0),
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
    if (product.hargaAsli) {
      const diskonStandarPct = (product.hargaAsli - product.harga) / product.hargaAsli;
      const totalDiskonPct = diskonStandarPct + 0.05; // aditif, misal 20% + 5% = 25%
      hargaSetelahKoli = product.hargaAsli * (1 - totalDiskonPct);
    } else {
      hargaSetelahKoli = product.harga * 0.95;
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
  const [screen, setScreen] = useState("catalog"); // login | register | catalog | product | cart | success | history | akun | akun-rekening | akun-cs | akun-bantuan
  const [products, setProducts] = useState(SAMPLE_PRODUCTS); // fallback dulu, diganti data asli kalau fetch berhasil
  const [dbError, setDbError] = useState("");

  useEffect(() => {
    supabaseFetch("products?select=id,kode,nama,kategori,satuan,harga_jual,harga_asli,isi_per_koli,stock_awal&aktif=eq.true")
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
  const [toko, setToko] = useState(null);
  const [loginInput, setLoginInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [cart, setCart] = useState({}); // { kodeBarang: qty }
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [orders, setOrders] = useState([]);
  const [regForm, setRegForm] = useState({ nama: "", alamat: "", telp: "", jenisBayar: "Transfer", tempo: "0", provinsi: "", provinsiId: "", kota: "", kotaId: "", kecamatan: "", kecamatanId: "", kelurahan: "", kodePos: "" });
  const [regSubmitted, setRegSubmitted] = useState(false);
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
  }, [cart, checkedItems]);
  const cartTotal = cartRincian.totalBayar;
  const belowMinimum = cartTotal > 0 && cartTotal < MIN_CHECKOUT;

  async function handleLogin() {
    const kode = loginInput.trim().toUpperCase();
    if (!kode) { setLoginError("Isi dulu Kode Toko-nya."); return; }

    try {
      const rows = await supabaseFetch(`clients?select=*&kode=eq.${kode}&status=eq.aktif`);
      if (rows.length > 0) {
        const r = rows[0];
        setToko({ id: r.id, kode: r.kode, nama: r.nama, alamat: r.alamat, telp: r.telp, kota: r.kota, jenisBayar: r.jenis_pembayaran });
        setIsGuest(false);
        setLoginError("");
        setScreen("catalog");
        return;
      }
      // Kalau fetch berhasil tapi tidak ketemu -> memang salah kode, bukan masalah koneksi
      setLoginError("Kode Toko tidak ditemukan atau belum disetujui. Cek lagi, atau daftar toko baru.");
    } catch (e) {
      // Database tidak terjangkau (misal mode preview) -> fallback ke data contoh
      const found = SAMPLE_TOKO.find((t) => t.kode.toUpperCase() === kode);
      if (!found) {
        setLoginError("Kode Toko tidak ditemukan. Cek lagi, atau daftar toko baru.");
        return;
      }
      setToko(found);
      setIsGuest(false);
      setLoginError("");
      setScreen("catalog");
    }
  }

  function handleGuestBrowse() {
    setToko(null);
    setIsGuest(true);
    setLoginError("");
    setScreen("catalog");
  }

  function handleLogout() {
    setToko(null);
    setIsGuest(false);
    setLoginInput("");
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

  function submitOrder() {
    if (cartTotal < MIN_CHECKOUT) return; // jaga-jaga, tombol sudah dinonaktifkan di UI
    const noNota = "NOTA-" + String(1000 + orders.length + 1).slice(1);
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
    const order = {
      id: noNota, tanggal: new Date(), items: itemsWithDropship, total: cartTotal,
      status: "Menunggu Persetujuan", tujuan, isDropship,
      pengirim: isDropship ? dropshipSender : null,
      sudahBayar: toko.jenisBayar === "Tunai",
    };
    setOrders((prev) => [order, ...prev]);
    setSpinTickets((prev) => prev + 1); // dapat 1 tiket Lucky Wheel tiap order

    // Kirim juga ke database asli kalau toko ini benar-benar login dari Supabase
    // (toko.id ada) - kalau gagal/tidak terjangkau, order tetap tercatat lokal di atas.
    if (toko.id) {
      (async () => {
        try {
          const [insertedOrder] = await supabaseFetch("orders", {
            method: "POST",
            body: JSON.stringify({
              no_nota: noNota,
              client_id: toko.id,
              channel: "web",
              status: "menunggu_persetujuan",
              status_bayar: "belum_lunas",
              is_dropship: isDropship,
              nama_pengirim_dropship: isDropship ? dropshipSender : null,
              tujuan_nama: tujuan.nama,
              tujuan_telp: tujuan.telp,
              tujuan_alamat: tujuan.alamat,
            }),
          });
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
          });
        } catch (e) {
          console.log("Gagal simpan order ke database asli (mode preview?):", e.message);
        }
      })();
    }

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
  function reorder(order) {
    const next = {};
    order.items.forEach((it) => { next[it.kode] = it.qty; });
    setCart(next);
    setCheckedItems({});
    setScreen("cart");
  }

  // Simulasi progres status pesanan (dipakai di prototipe ini karena belum tersambung backend)
  function advanceOrderStatus(orderId, nextStatus) {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
  }
  function markOrderPaid(orderId) {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, sudahBayar: true } : o)));
  }

  const randBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  // Klaim poin harian. Hari: 0=Minggu, 1=Senin, ..., 6=Sabtu.
  // Sabtu = hari spesial: 500-1000 poin kalau Minggu-Jumat (0-5) full diklaim,
  // kalau tidak full (ada yang miss), Sabtu cuma dapat 100-500.
  // Hari biasa (Minggu-Jumat): random 10-50 poin.
  function claimDailyPoint() {
    const today = new Date().getDay(); // 0-6
    if (dailyClaims[today] !== undefined) return; // sudah diklaim hari ini

    let earned;
    if (today === 6) {
      const weekdaysFullyClaimed = [0, 1, 2, 3, 4, 5].every((d) => dailyClaims[d] !== undefined);
      earned = weekdaysFullyClaimed ? randBetween(500, 1000) : randBetween(100, 500);
    } else {
      earned = randBetween(10, 50);
    }
    setDailyClaims((prev) => ({ ...prev, [today]: earned }));
    setPointsBalance((prev) => prev + earned);
  }

  // Pakai 1 tiket, hasil poin dari roda (150/250/350/500) sudah ditentukan sebelumnya
  // oleh PoinScreen (dipilih acak di sana untuk animasi berhenti di segmen yang tepat).
  function spinWheel(wonPoints) {
    if (spinTickets <= 0) return;
    setSpinTickets((prev) => prev - 1);
    setPointsBalance((prev) => prev + wonPoints);
  }

  async function submitRegistration() {
    try {
      await supabaseFetch("clients", {
        method: "POST",
        body: JSON.stringify({
          kode: "PENDING-" + Date.now().toString().slice(-6), // sementara, Owner ganti jadi kode resmi saat approve
          nama: regForm.nama,
          alamat: `${regForm.alamat}, ${regForm.kelurahan}, ${regForm.kecamatan}, ${regForm.kota}, ${regForm.provinsi} ${regForm.kodePos}`,
          telp: regForm.telp,
          jenis_pembayaran: "Transfer",
          kota: regForm.kota,
          status: "pending",
        }),
      });
    } catch (e) {
      console.log("Gagal kirim pendaftaran ke database asli (mode preview?):", e.message);
    }
    setRegSubmitted(true);
  }

  const filteredProducts = products.filter((p) => {
    const matchCategory = activeCategory === "Semua" || p.kategori === activeCategory;
    const matchSearch = p.nama.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

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

      {screen === "login" && (
        <LoginScreen
          loginInput={loginInput} setLoginInput={setLoginInput}
          loginError={loginError} onLogin={handleLogin}
          onGoRegister={() => setScreen("register")}
          onGuestBrowse={handleGuestBrowse}
        />
      )}

      {screen === "register" && (
        <RegisterScreen
          regForm={regForm} setRegForm={setRegForm}
          submitted={regSubmitted} onSubmit={submitRegistration}
          onBack={() => { setScreen("login"); setRegSubmitted(false); setRegForm({ nama: "", alamat: "", telp: "", jenisBayar: "Transfer", tempo: "0", provinsi: "", provinsiId: "", kota: "", kotaId: "", kecamatan: "", kecamatanId: "", kelurahan: "", kodePos: "" }); }}
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
        />
      )}

      {screen === "product" && selectedProduct && (
        <ProductScreen
          product={selectedProduct} qty={cart[selectedProduct.kode] || 0}
          isGuest={isGuest}
          onChangeQty={(delta) => addToCart(selectedProduct.kode, delta)}
          onBack={() => setScreen("catalog")}
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
          addToCart={addToCart}
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
          onReorder={reorder}
          onAdvance={advanceOrderStatus} onMarkPaid={markOrderPaid}
          pointsBalance={pointsBalance}
          onOpenRekening={() => setScreen("akun-rekening")}
          onOpenCS={() => setScreen("akun-cs")}
          onOpenBantuan={() => setScreen("akun-bantuan")}
          onOpenPoin={() => setScreen("akun-poin")}
          onLogout={handleLogout}
        />
      )}

      {screen === "akun-rekening" && (
        <RekeningScreen onBack={() => setScreen("akun")} />
      )}
      {screen === "akun-cs" && (
        <ServiceCentreScreen onBack={() => setScreen("akun")} />
      )}
      {screen === "akun-bantuan" && (
        <BantuanScreen onBack={() => setScreen("akun")} />
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
function LoginScreen({ loginInput, setLoginInput, loginError, onLogin, onGoRegister, onGuestBrowse }) {
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
          Masuk pakai Kode Toko untuk lihat katalog dan kirim orderan.
        </p>
      </div>

      <label style={{ color: "#9CA0A6", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, display: "block" }}>
        Kode Toko
      </label>
      <input
        value={loginInput}
        onChange={(e) => setLoginInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onLogin()}
        placeholder="Contoh: C001"
        style={{ width: "100%", padding: "16px 18px", borderRadius: 12, border: "none", fontSize: 18, fontWeight: 600, marginBottom: loginError ? 10 : 20, outline: "none", background: "#F7F5F1", color: "#24272B" }}
      />
      {loginError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#E8A426", fontSize: 13, marginBottom: 20 }}>
          <AlertCircle size={16} /> {loginError}
        </div>
      )}

      <button
        onClick={onLogin}
        style={{ width: "100%", padding: "16px", borderRadius: 12, border: "none", background: "#E8A426", color: "#24272B", fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        Masuk <ArrowRight size={18} />
      </button>

      <div style={{ textAlign: "center", marginTop: 24 }}>
        <button onClick={onGoRegister} style={{ background: "none", border: "none", color: "#9CA0A6", fontSize: 14 }}>
          Toko baru? <span style={{ color: "#E8A426", fontWeight: 600 }}>Daftar di sini</span>
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "24px 0" }}>
        <div style={{ flex: 1, height: 1, background: "#3A3E44" }} />
        <span style={{ color: "#6B6F75", fontSize: 11, fontWeight: 600 }}>ATAU</span>
        <div style={{ flex: 1, height: 1, background: "#3A3E44" }} />
      </div>

      <button
        onClick={onGuestBrowse}
        style={{ width: "100%", padding: "14px", borderRadius: 12, border: "1.5px solid #3A3E44", background: "none", color: "#fff", fontSize: 14, fontWeight: 600 }}
      >
        Lihat Katalog Dulu (Tanpa Login)
      </button>

      <div style={{ marginTop: 24, padding: "14px 16px", background: "#2E3237", borderRadius: 10 }}>
        <p style={{ color: "#6B6F75", fontSize: 11, margin: 0, lineHeight: 1.5 }}>
          DEMO — Coba kode: C001, C002, C003, C004, atau C005
        </p>
      </div>
    </div>
  );
}

// ============================================================
// REGISTRASI TOKO BARU
// ============================================================
function RegisterScreen({ regForm, setRegForm, submitted, onSubmit, onBack }) {
  const [provinces, setProvinces] = useState([]);
  const [regencies, setRegencies] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [villages, setVillages] = useState([]);
  const [wilayahError, setWilayahError] = useState("");

  const WILAYAH_API = "https://emsifa.github.io/api-wilayah-indonesia/api";
  const titleCase = (s) => s.replace(/\w\S*/g, (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());

  useEffect(() => {
    fetch(`${WILAYAH_API}/provinces.json`)
      .then((r) => r.json())
      .then((data) => setProvinces(data.map((d) => ({ id: d.id, name: titleCase(d.name) }))))
      .catch(() => {
        setProvinces(FALLBACK_WILAYAH.provinces);
        setWilayahError("Tidak bisa akses API wilayah asli (mode preview) - sementara pakai data contoh Riau/Jakarta/Makassar.");
      });
  }, []);

  useEffect(() => {
    if (!regForm.provinsiId) { setRegencies([]); return; }
    fetch(`${WILAYAH_API}/regencies/${regForm.provinsiId}.json`)
      .then((r) => r.json())
      .then((data) => setRegencies(data.map((d) => ({ id: d.id, name: titleCase(d.name) }))))
      .catch(() => setRegencies(FALLBACK_WILAYAH.regencies[regForm.provinsiId] || []));
  }, [regForm.provinsiId]);

  useEffect(() => {
    if (!regForm.kotaId) { setDistricts([]); return; }
    fetch(`${WILAYAH_API}/districts/${regForm.kotaId}.json`)
      .then((r) => r.json())
      .then((data) => setDistricts(data.map((d) => ({ id: d.id, name: titleCase(d.name) }))))
      .catch(() => setDistricts(FALLBACK_WILAYAH.districts[regForm.kotaId] || []));
  }, [regForm.kotaId]);

  useEffect(() => {
    if (!regForm.kecamatanId) { setVillages([]); return; }
    fetch(`${WILAYAH_API}/villages/${regForm.kecamatanId}.json`)
      .then((r) => r.json())
      .then((data) => setVillages(data.map((d) => ({ id: d.id, name: titleCase(d.name) }))))
      .catch(() => setVillages(FALLBACK_WILAYAH.villages[regForm.kecamatanId] || []));
  }, [regForm.kecamatanId]);

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#D8E9E6", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 24 }}>
          <Clock size={34} color="#28685D" />
        </div>
        <h2 className="disp" style={{ fontSize: 26, fontWeight: 700, color: "#24272B", margin: "0 0 10px" }}>Menunggu persetujuan</h2>
        <p style={{ color: "#6B6F75", fontSize: 14, lineHeight: 1.6, maxWidth: 300 }}>
          Pendaftaran toko <strong>{regForm.nama}</strong> sudah dikirim ke Owner. Anda akan dihubungi begitu disetujui dan bisa login pakai Kode Toko yang diberikan.
        </p>
        <button onClick={onBack} style={{ marginTop: 28, padding: "14px 28px", borderRadius: 12, border: "none", background: "#24272B", color: "#fff", fontWeight: 600, fontSize: 14 }}>
          Kembali ke Login
        </button>
      </div>
    );
  }

  const set = (k) => (e) => setRegForm({ ...regForm, [k]: e.target.value });
  const canSubmit = regForm.nama && regForm.alamat && regForm.telp && regForm.provinsi && regForm.kota && regForm.kecamatan && regForm.kelurahan;

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
      <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, padding: "8px 0", marginBottom: 8 }}>
        <ChevronLeft size={18} /> Kembali
      </button>
      <h1 className="disp" style={{ fontSize: 28, fontWeight: 700, color: "#24272B", margin: "4px 0 4px" }}>Daftar toko baru</h1>
      <p style={{ color: "#6B6F75", fontSize: 13, marginBottom: 24 }}>Perlu persetujuan Owner sebelum bisa order.</p>

      {wilayahError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBEAEA", color: "#C0392B", padding: "10px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} /> {wilayahError}
        </div>
      )}

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
        disabled={!canSubmit}
        onClick={onSubmit}
        style={{ width: "100%", marginTop: 12, padding: "16px", borderRadius: 12, border: "none", background: canSubmit ? "#24272B" : "#D8D6D0", color: canSubmit ? "#fff" : "#9CA0A6", fontSize: 15, fontWeight: 700 }}
      >
        Kirim Pendaftaran
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
              style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", background: "none", border: "none", fontSize: 13.5, color: "#24272B", borderBottom: "1px solid #F2F0EA" }}
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
function CatalogScreen({ toko, isGuest, products, activeCategory, setActiveCategory, searchQuery, setSearchQuery, cart, addToCart, onOpenProduct, onRequireLogin }) {
  const categories = ["Semua", ...Object.keys(CATEGORY_META)];
  return (
    <div>
      <div style={{ background: "#24272B", padding: "20px 20px 16px", borderBottomLeftRadius: 22, borderBottomRightRadius: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ color: "#9CA0A6", fontSize: 12, margin: 0 }}>{isGuest ? "Mode tamu" : "Masuk sebagai"}</p>
            <p className="disp" style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: "2px 0 0" }}>{isGuest ? "Lihat-lihat dulu" : toko?.nama}</p>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#E8A426", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Store size={19} color="#24272B" />
          </div>
        </div>
        {isGuest && (
          <button onClick={onRequireLogin} style={{ marginTop: 12, width: "100%", padding: "10px", borderRadius: 9, border: "none", background: "#E8A426", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}>
            Login / Daftar untuk lihat harga & order
          </button>
        )}
        <div style={{ marginTop: 16, position: "relative" }}>
          <Search size={17} color="#6B6F75" style={{ position: "absolute", left: 14, top: 13 }} />
          <input
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari barang..."
            style={{ width: "100%", padding: "12px 14px 12px 40px", borderRadius: 10, border: "none", fontSize: 14, outline: "none" }}
          />
        </div>
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
          const meta = CATEGORY_META[p.kategori];
          const Icon = meta.icon;
          const qty = cart[p.kode] || 0;
          return (
            <div key={p.kode} style={{ background: "#fff", borderRadius: 16, padding: 14, border: "1px solid #EDEAE3" }}>
              <button onClick={() => onOpenProduct(p)} style={{ background: "none", border: "none", padding: 0, width: "100%", textAlign: "left" }}>
                <div style={{ width: "100%", aspectRatio: "1", background: meta.bg, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                  <Icon size={30} color={meta.fg} strokeWidth={1.8} />
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
                        <p style={{ fontSize: 10, color: "#28685D", fontWeight: 700, margin: "4px 0 0", lineHeight: 1.3, display: "flex", alignItems: "center", gap: 3 }}>
                          <Check size={11} /> Diskon tambahan 5% aktif (1 koli)
                        </p>
                      ) : (
                        <p style={{ fontSize: 10, color: "#B8860B", fontWeight: 600, margin: "4px 0 0", lineHeight: 1.3 }}>
                          Tambah {p.isiPerKoli - qty} {p.satuan} lagi untuk diskon 5% (1 koli = {p.isiPerKoli} {p.satuan})
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
function ProductScreen({ product, qty, isGuest, onChangeQty, onBack, onRequireLogin }) {
  const meta = CATEGORY_META[product.kategori];
  const Icon = meta.icon;
  return (
    <div style={{ minHeight: "100vh", paddingBottom: 90 }}>
      <div style={{ padding: "18px 20px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14 }}>
          <ChevronLeft size={18} /> Kembali
        </button>
      </div>
      <div style={{ padding: "0 20px" }}>
        <div style={{ width: "100%", aspectRatio: "1.4", background: meta.bg, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Icon size={70} color={meta.fg} strokeWidth={1.5} />
        </div>
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
                <div style={{ background: "#D8E9E6", color: "#28685D", padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
                  <Check size={15} /> Diskon tambahan 5% aktif — sudah 1 koli ({product.isiPerKoli} {product.satuan})
                </div>
              ) : (
                <div style={{ background: "#FBF0D9", color: "#8A6A1A", padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
                  🎉 Tambah {product.isiPerKoli - qty} {product.satuan} lagi untuk diskon tambahan 5% (1 koli = {product.isiPerKoli} {product.satuan})
                </div>
              )
            )}
          </>
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
            <span style={{ fontWeight: 700, fontSize: 16, minWidth: 20, textAlign: "center" }}>{qty}</span>
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
function CartScreen({ toko, useAltAddress, setUseAltAddress, editingAlt, setEditingAlt, altAddress, setAltAddress, savedAddresses, onSaveAddress, onPickAddress, isDropship, setIsDropship, dropshipPrices, setDropshipPrices, dropshipSender, setDropshipSender, savedSenderNames, cart, products, rincian, belowMinimum, checkedItems, setCheckedItems, addToCart, onBack, onCheckout }) {
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
      <div style={{ padding: "20px 20px 8px" }}>
        <h1 className="disp" style={{ fontSize: 26, fontWeight: 700, color: "#24272B", margin: 0 }}>Keranjang</h1>
        <p style={{ color: "#9CA0A6", fontSize: 13, marginTop: 2 }}>{items.length} jenis barang</p>
      </div>

      {toko && (
        <div style={{ margin: "8px 20px 4px", background: "#fff", border: "1px solid #EDEAE3", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#EFE1BE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Store size={17} color="#8A6A1A" />
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
          const meta = CATEGORY_META[p.kategori];
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
              <div style={{ width: 54, height: 54, borderRadius: 12, background: meta.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={24} color={meta.fg} />
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
                  <p style={{ fontSize: 11.5, color: "#28685D", fontWeight: 600, margin: "4px 0 0" }}>
                    Hemat {rupiah(Math.round(r.totalDiskon))} {r.kenaKoli && "(termasuk bonus koli)"}
                  </p>
                )}
                {!r.kenaKoli && p.isiPerKoli > 0 && (
                  <p style={{ fontSize: 11.5, color: "#B8860B", fontWeight: 600, margin: "4px 0 0" }}>
                    Tambah {p.isiPerKoli - p.qty} {p.satuan} lagi (jadi {p.isiPerKoli} = 1 koli) untuk diskon tambahan 5%
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
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{p.qty}</span>
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
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#28685D", fontWeight: 600, marginBottom: 3 }}>
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
                <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#8A6A1A", background: "#EFE1BE", padding: "2px 8px", borderRadius: 999 }}>
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
  return (
    <div style={{ minHeight: "100vh", padding: "20px 20px 20px" }}>
      <h1 className="disp" style={{ fontSize: 26, fontWeight: 700, color: "#24272B", margin: "0 0 16px" }}>Riwayat Order</h1>
      {orders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9CA0A6" }}>
          <ClipboardList size={40} color="#D8D6D0" />
          <p style={{ marginTop: 12, fontSize: 14 }}>Belum ada order yang dikirim.</p>
        </div>
      ) : (
        orders.map((o) => (
          <div key={o.id} style={{ background: "#fff", borderRadius: 14, padding: 16, marginBottom: 12, border: "1px solid #EDEAE3" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span className="disp" style={{ fontWeight: 700, fontSize: 16, color: "#24272B" }}>{o.id}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#B8860B", background: "#FBF0D9", padding: "4px 10px", borderRadius: 999 }}>{o.status}</span>
            </div>
            <p style={{ fontSize: 12, color: "#9CA0A6", margin: "0 0 10px" }}>
              {o.tanggal.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} · {o.items.length} jenis barang
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#6B6F75" }}>{o.items.map((i) => i.nama).join(", ")}</span>
            </div>
            <div style={{ textAlign: "right", marginTop: 8 }}>
              <span className="disp" style={{ fontWeight: 700, fontSize: 17, color: "#24272B" }}>{rupiah(o.total)}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================
// AKUN
// ============================================================
function AccountScreen({ toko, orders, onReorder, onAdvance, onMarkPaid, pointsBalance, onOpenRekening, onOpenCS, onOpenBantuan, onOpenPoin, onLogout }) {
  const [filter, setFilter] = useState(null); // null | "pesanan" | "kirim" | "konfirmasi" | "bayar"
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const counts = {
    pesanan: orders.filter((o) => o.status === "Menunggu Persetujuan").length,
    kirim: orders.filter((o) => o.status === "Menunggu Pengiriman").length,
    konfirmasi: orders.filter((o) => o.status === "Dikirim").length,
    bayar: orders.filter((o) => !o.sudahBayar).length,
  };
  const tiles = [
    { key: "pesanan", label: "Pesanan", icon: ClipboardList, count: counts.pesanan, matchStatus: "Menunggu Persetujuan" },
    { key: "kirim", label: "Menunggu Pengiriman", icon: Truck, count: counts.kirim, matchStatus: "Menunggu Pengiriman" },
    { key: "konfirmasi", label: "Konfirmasi Penerimaan", icon: PackageCheck, count: counts.konfirmasi, matchStatus: "Dikirim" },
    { key: "bayar", label: "Belum Bayar", icon: Wallet, count: counts.bayar, matchStatus: null },
  ];

  const filteredOrders = !filter
    ? []
    : filter === "bayar"
    ? orders.filter((o) => !o.sudahBayar)
    : orders.filter((o) => o.status === tiles.find((t) => t.key === filter).matchStatus);

  return (
    <div style={{ minHeight: "100vh", paddingBottom: 88 }}>
      <div style={{ background: "#24272B", padding: "20px 20px 22px", borderBottomLeftRadius: 22, borderBottomRightRadius: 22 }}>
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
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setFilter(active ? null : t.key)}
              style={{ background: active ? "#24272B" : "#fff", border: active ? "none" : "1px solid #EDEAE3", borderRadius: 14, padding: 14, textAlign: "left" }}
            >
              <Icon size={20} color={active ? "#E8A426" : "#8A6A1A"} strokeWidth={1.8} />
              <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: active ? "#fff" : "#24272B", margin: "8px 0 0" }}>{t.count}</p>
              <p style={{ fontSize: 11.5, color: active ? "#9CA0A6" : "#6B6F75", margin: "2px 0 0", lineHeight: 1.3 }}>{t.label}</p>
            </button>
          );
        })}
      </div>

      {filter && (
        <div style={{ padding: "12px 20px 4px" }}>
          {filteredOrders.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "#9CA0A6", textAlign: "center", padding: "20px 0" }}>Tidak ada order di kategori ini.</p>
          ) : (
            filteredOrders.map((o) => (
              <div key={o.id} style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 12, padding: 14, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span className="disp" style={{ fontWeight: 700, fontSize: 14 }}>{o.id}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#24272B" }}>{rupiah(o.total)}</span>
                </div>
                {o.status === "Dikirim" && (
                  <button onClick={() => onAdvance(o.id, "Selesai")} style={{ width: "100%", marginTop: 4, padding: "9px", borderRadius: 9, border: "none", background: "#E8A426", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}>
                    Konfirmasi Penerimaan
                  </button>
                )}
                {!o.sudahBayar && filter === "bayar" && (
                  <button onClick={() => onMarkPaid(o.id)} style={{ width: "100%", marginTop: 4, padding: "9px", borderRadius: 9, border: "1.5px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}>
                    (Demo) Tandai Sudah Bayar
                  </button>
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
        </div>
      )}

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

      <div style={{ padding: "16px 20px 8px" }}>
        <h2 className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>Order Ulang</h2>
        <p style={{ fontSize: 12, color: "#9CA0A6", margin: "0 0 10px" }}>Salin order sebelumnya, tidak perlu pilih barang dari awal.</p>
        {orders.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "#9CA0A6", padding: "12px 0" }}>Belum ada riwayat order.</p>
        ) : (
          orders.slice(0, 5).map((o) => (
            <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #EDEAE3", borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{o.id}</p>
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

      <div style={{ padding: "8px 20px 4px" }}>
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
      <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, marginBottom: 8 }}>
        <ChevronLeft size={18} /> Kembali
      </button>
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
      <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, marginBottom: 8 }}>
        <ChevronLeft size={18} /> Kembali
      </button>
      <h1 className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: "4px 0 16px" }}>Service Centre</h1>

      <div style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 14, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <Clock size={17} color="#8A6A1A" />
          <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: 0 }}>Jam Operasional</p>
        </div>
        <p style={{ fontSize: 13, color: "#6B6F75", margin: 0, paddingLeft: 27 }}>{CS_INFO.jamOperasional}</p>
      </div>

      <div style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 14, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <MessageCircle size={17} color="#28685D" />
          <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: 0 }}>WhatsApp Customer Service</p>
        </div>
        <p className="disp" style={{ fontSize: 19, fontWeight: 700, color: "#24272B", margin: "0 0 12px", paddingLeft: 27 }}>{CS_INFO.whatsappDisplay}</p>
        <a
          href={`https://wa.me/${CS_INFO.whatsapp}`}
          target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, textDecoration: "none", background: "#28685D", color: "#fff", padding: "12px", borderRadius: 10, fontSize: 13.5, fontWeight: 700 }}
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
      <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, marginBottom: 8 }}>
        <ChevronLeft size={18} /> Kembali
      </button>
      <h1 className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: "4px 0 4px" }}>Bantuan</h1>
      <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 18px" }}>Cara menggunakan aplikasi ini, langkah demi langkah.</p>

      {HELP_STEPS.map((s, i) => {
        const Visual = visuals[i];
        return (
          <div key={i} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#EFE1BE", color: "#8A6A1A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>
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
          <div style={{ width: "100%", aspectRatio: "1.6", background: "#DCE6F0", borderRadius: 6, marginBottom: 5 }} />
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
          <div style={{ height: 5, width: "50%", background: "#4A4E54", borderRadius: 3, marginTop: 6 }} />
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
    { points: 250, color: "#D8E9E6", text: "#28685D" },
    { points: 350, color: "#EFE1BE", text: "#8A6A1A" },
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
      <button onClick={onBack} style={{ background: "none", border: "none", display: "flex", alignItems: "center", gap: 4, color: "#6B6F75", fontSize: 14, marginBottom: 8 }}>
        <ChevronLeft size={18} /> Kembali
      </button>

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
          if (claimed !== undefined) { bg = isSabtu ? "#EFE1BE" : "#D8E9E6"; fg = isSabtu ? "#8A6A1A" : "#28685D"; }
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#D8E9E6", color: "#28685D", padding: "14px", borderRadius: 12, fontSize: 13.5, fontWeight: 700 }}>
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
            <p style={{ fontSize: 13, fontWeight: 700, color: "#28685D", margin: 0 }}>🎉 Selamat! Anda dapat {lastWin} poin</p>
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
