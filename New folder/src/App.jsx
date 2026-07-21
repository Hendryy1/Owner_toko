import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutDashboard, ClipboardCheck, Store, TrendingUp, Wallet, Package,
  Users, LogOut, Check, X, ChevronRight, ChevronLeft, AlertCircle, Loader2, RefreshCw, Printer, FileEdit, History, Download, Boxes, PackagePlus, Receipt, Eye, Truck, UploadCloud, Table2, Gift, Navigation, Clock, MessageCircle, Menu, User, MapPin, Camera, Image as ImageIcon
} from "lucide-react";

const COMPANY_NAME = "PT Nama Perusahaan Anda";

// ============================================================
// KONEKSI SUPABASE
// ============================================================
const SUPABASE_URL = "https://bzlktpveupyxtcuhrmgg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6bGt0cHZldXB5eHRjdWhybWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMTIwNjQsImV4cCI6MjA5OTc4ODA2NH0.DKvaQ-_Gdi5nj5DFkhu-8IttPCztYuKCoMoXxcIUdEI";

async function supabaseAuth(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Login gagal");
  return data; // { access_token, refresh_token, user, ... }
}

// Perpanjang sesi pakai refresh_token - access_token Supabase cuma berlaku
// ±1 jam, tapi refresh_token bisa dipakai berkali-kali buat dapat
// access_token baru tanpa perlu login ulang, sampai user klik Keluar sendiri.
async function supabaseRefreshToken(refreshToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Sesi berakhir, silakan login ulang.");
  return data; // { access_token, refresh_token baru, ... }
}

async function supabaseFetch(token, path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const rupiah = (n) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");

// ============================================================
// APP UTAMA
// ============================================================
const DASHBOARD_SESSION_KEY = "dashboard_session_v1";
function saveDashboardSession(session) {
  try { localStorage.setItem(DASHBOARD_SESSION_KEY, JSON.stringify(session)); } catch (e) {}
}
function loadDashboardSession() {
  try {
    const raw = localStorage.getItem(DASHBOARD_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function clearDashboardSession() {
  try { localStorage.removeItem(DASHBOARD_SESSION_KEY); } catch (e) {}
}

export default function OwnerDashboard() {
  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [page, setPage] = useState("overview");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [restoringSession, setRestoringSession] = useState(true);

  async function loadProfileAndEnter(userId, accessToken, refreshToken) {
    const profRows = await supabaseFetch(accessToken, `profiles?select=*&id=eq.${userId}`);
    if (!profRows || profRows.length === 0) {
      throw new Error("Akun ini belum terhubung sebagai staff (cek tabel profiles).");
    }
    setToken(accessToken);
    setProfile(profRows[0]);
    saveDashboardSession({ userId, token: accessToken, refreshToken });
  }

  useEffect(() => {
    const session = loadDashboardSession();
    if (!session) { setRestoringSession(false); return; }

    async function restoreWithRefresh() {
      // access_token lama mungkin sudah kedaluwarsa (±1 jam) - selalu coba
      // refresh dulu pakai refresh_token supaya dapat yang segar, biar staff
      // tetap login terus sampai benar-benar klik Keluar, bukan expired sendiri.
      if (session.refreshToken) {
        const refreshed = await supabaseRefreshToken(session.refreshToken);
        await loadProfileAndEnter(session.userId, refreshed.access_token, refreshed.refresh_token);
        return;
      }
      // Sesi lama (sebelum fitur ini ada) belum punya refresh_token
      await loadProfileAndEnter(session.userId, session.token);
    }

    restoreWithRefresh()
      .catch(() => clearDashboardSession())
      .finally(() => setRestoringSession(false));
  }, []);

  // Refresh token berkala di latar belakang (tiap 45 menit) selama tab
  // dibiarkan terbuka, supaya tidak sempat kedaluwarsa di tengah pemakaian.
  useEffect(() => {
    if (!profile) return;
    const interval = setInterval(async () => {
      const session = loadDashboardSession();
      if (!session?.refreshToken) return;
      try {
        const refreshed = await supabaseRefreshToken(session.refreshToken);
        setToken(refreshed.access_token);
        saveDashboardSession({ ...session, token: refreshed.access_token, refreshToken: refreshed.refresh_token });
      } catch (e) {
        console.log("Gagal refresh token di latar belakang:", e.message);
      }
    }, 45 * 60 * 1000);
    return () => clearInterval(interval);
  }, [profile]);

  async function handleLogin() {
    setLoginError("");
    setLoggingIn(true);
    try {
      const auth = await supabaseAuth(loginForm.email, loginForm.password);
      await loadProfileAndEnter(auth.user.id, auth.access_token, auth.refresh_token);
    } catch (e) {
      setLoginError(e.message);
    }
    setLoggingIn(false);
  }

  function handleLogout() {
    clearDashboardSession();
    setToken(null);
    setProfile(null);
    setPage("overview");
  }

  if (restoringSession) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#24272B" }}>
        <p style={{ color: "#9CA0A6", fontSize: 13 }}>Memuat...</p>
      </div>
    );
  }

  if (!token) {
    return (
      <LoginScreen
        form={loginForm} setForm={setLoginForm}
        onLogin={handleLogin} error={loginError} loading={loggingIn}
      />
    );
  }

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", display: "flex", minHeight: "100vh", background: "#F7F5F1" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        .disp { font-family: 'Barlow Condensed', sans-serif; }
        button { font-family: inherit; cursor: pointer; }
      `}</style>
      <Sidebar page={page} setPage={setPage} profile={profile} onLogout={handleLogout} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} isMobile={isMobile} />
      <div style={{ flex: 1, padding: isMobile ? "16px 16px 28px" : "28px 36px", overflowY: "auto", overflowX: "hidden", minWidth: 0 }}>
        {isMobile && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "#24272B", border: "none", borderRadius: 9, padding: "9px 14px", color: "#fff", fontSize: 12.5, fontWeight: 600, marginBottom: 18 }}
          >
            <Menu size={16} /> Menu
          </button>
        )}
        {page === "overview" && <OverviewPage token={token} setPage={setPage} />}
        {page === "chat_sales" && <ChatSalesPage token={token} profile={profile} />}
        {page === "profil_sales" && <ProfilSalesPage token={token} profile={profile} />}
        {page === "omzet_sales" && <OmzetSalesPage token={token} profile={profile} />}
        {page === "kunjungan_sales" && <KunjunganSalesPage token={token} profile={profile} />}
        {page === "orders" && <OrdersPage token={token} />}
        {page === "konfirmasi_bayar" && <KonfirmasiPembayaranPage token={token} />}
        {page === "proses_kirim" && <ProsesPengirimanPage token={token} />}
        {page === "riwayat" && <RiwayatOrderPage token={token} />}
        {page === "transaksi" && <TransaksiPage token={token} />}
        {page === "rekap_nota" && <RekapNotaPage token={token} />}
        {page === "clients" && <ClientsPage token={token} />}
        {page === "verifikasi_toko" && <VerifikasiTokoPage token={token} />}
        {page === "keuangan" && <KeuanganPage token={token} />}
        {page === "biaya_operasional" && <BiayaOperasionalPage token={token} />}
        {page === "pajak" && <PajakPage token={token} />}
        {page === "bunga_investor" && <BungaInvestorPage token={token} />}
        {page === "piutang" && <PiutangPage token={token} />}
        {page === "saldo_va" && <SaldoVaPage token={token} />}
        {page === "barang" && <BarangTerlarisPage token={token} />}
        {page === "produk" && <ProductPage token={token} />}
        {page === "stock" && <StockItemPage token={token} />}
        {page === "inbound" && <InboundPage token={token} />}
        {page === "cashback" && <CashbackPage token={token} />}
        {page === "ongkir" && <FreeOngkirPage token={token} />}
        {page === "rekap_toko" && <RekapTokoPage token={token} />}
        {page === "sales" && <SalesPage token={token} />}
        {page === "format_nota" && <FormatNotaPage token={token} />}
        {page === "banner_promo" && <BannerPromoPage token={token} />}
      </div>
    </div>
  );
}

// ============================================================
// LOGIN
// ============================================================
function LoginScreen({ form, setForm, onLogin, error, loading }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#24272B", fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&family=Inter:wght@400;600;700&display=swap');
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
      `}</style>
      <div style={{ width: 360, padding: 32, background: "#2E3237", borderRadius: 18 }}>
        <div style={{ width: 48, height: 48, background: "#E8A426", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <LayoutDashboard size={24} color="#24272B" />
        </div>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "#fff", fontSize: 28, fontWeight: 700, margin: "0 0 4px" }}>Dashboard Owner</h1>
        <p style={{ color: "#9CA0A6", fontSize: 13, marginBottom: 24 }}>Login khusus staff (Owner / Admin)</p>

        <label style={{ color: "#9CA0A6", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 6, display: "block" }}>Email</label>
        <input
          type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "none", marginBottom: 14, fontSize: 14, outline: "none" }}
        />
        <label style={{ color: "#9CA0A6", fontSize: 11, fontWeight: 600, textTransform: "uppercase", marginBottom: 6, display: "block" }}>Password</label>
        <input
          type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && onLogin()}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "none", marginBottom: error ? 10 : 20, fontSize: 14, outline: "none" }}
        />
        {error && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", color: "#E8A426", fontSize: 12.5, marginBottom: 16 }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <button
          onClick={onLogin} disabled={loading}
          style={{ width: "100%", padding: 14, borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          {loading ? <Loader2 size={16} className="spin" /> : "Masuk"}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// SIDEBAR
// ============================================================
function Sidebar({ page, setPage, profile, onLogout, collapsed, setCollapsed, isMobile }) {
  const allItems = [
    { key: "overview", label: "Ringkasan", icon: LayoutDashboard, roles: ["owner", "admin_transaksi", "admin_keuangan"] },
    { key: "chat_sales", label: "Chat Toko", icon: MessageCircle, roles: ["owner", "admin_transaksi", "sales"] },
    { key: "profil_sales", label: "Profil Saya", icon: User, roles: ["sales"] },
    { key: "omzet_sales", label: "Omzet Saya", icon: TrendingUp, roles: ["sales"] },
    { key: "kunjungan_sales", label: "Laporan Kunjungan", icon: MapPin, roles: ["sales"] },
    { key: "orders", label: "Approve Pesanan", icon: ClipboardCheck, roles: ["owner", "admin_transaksi"] },
    { key: "konfirmasi_bayar", label: "Konfirmasi Pembayaran", icon: Wallet, roles: ["owner", "admin_keuangan"] },
    { key: "proses_kirim", label: "Proses Pengiriman", icon: Truck, roles: ["owner", "admin_transaksi"] },
    { key: "riwayat", label: "Riwayat Order", icon: History, roles: ["owner", "admin_transaksi", "admin_keuangan"] },
    { key: "transaksi", label: "Transaksi", icon: Table2, roles: ["owner", "admin_transaksi", "admin_keuangan"] },
    { key: "rekap_nota", label: "Rekap Nota", icon: Receipt, roles: ["owner", "admin_keuangan"] },
    { key: "clients", label: "Approve Toko Baru", icon: Store, roles: ["owner", "admin_keuangan"] },
    { key: "verifikasi_toko", label: "Verifikasi Toko", icon: Eye, roles: ["owner", "admin_transaksi"] },
    { key: "keuangan", label: "Laporan Keuangan", icon: Wallet, roles: ["owner", "admin_keuangan"] },
    { key: "biaya_operasional", label: "Biaya Operasional", icon: Receipt, roles: ["owner", "admin_keuangan"] },
    { key: "pajak", label: "Pajak", icon: FileEdit, roles: ["owner", "admin_keuangan"] },
    { key: "bunga_investor", label: "Bunga Investor", icon: TrendingUp, roles: ["owner"] },
    { key: "piutang", label: "Piutang", icon: AlertCircle, roles: ["owner", "admin_keuangan"] },
    { key: "saldo_va", label: "Saldo & VA Toko", icon: Wallet, roles: ["owner", "admin_keuangan"] },
    { key: "barang", label: "Barang Terlaris", icon: Package, roles: ["owner", "admin_keuangan"] },
    { key: "produk", label: "Product", icon: Package, roles: ["owner"] },
    { key: "stock", label: "Stock Item", icon: Boxes, roles: ["owner"] },
    { key: "inbound", label: "Inbound", icon: PackagePlus, roles: ["owner"] },
    { key: "cashback", label: "Cashback", icon: Gift, roles: ["owner"] },
    { key: "ongkir", label: "Free Ongkir", icon: Navigation, roles: ["owner", "admin_transaksi"] },
    { key: "rekap_toko", label: "Rekap Toko", icon: Store, roles: ["owner", "admin_keuangan"] },
    { key: "sales", label: "Rekap Sales", icon: Users, roles: ["owner", "admin_transaksi", "admin_keuangan"] },
    { key: "format_nota", label: "Format Nota", icon: FileEdit, roles: ["owner"] },
    { key: "banner_promo", label: "Banner Promo", icon: ImageIcon, roles: ["owner"] },
  ];
  const items = allItems.filter((it) => it.roles.includes(profile?.role));

  if (collapsed) {
    if (isMobile) return null; // di HP, pakai tombol "Menu" terpisah di konten, bukan strip
    return (
      <div style={{ width: 56, background: "#24272B", padding: "24px 8px", display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <button
          onClick={() => setCollapsed(false)}
          title="Tampilkan menu"
          style={{ width: 36, height: 36, borderRadius: 9, border: "none", background: "#E8A426", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <ChevronRight size={18} color="#24272B" />
        </button>
      </div>
    );
  }

  return (
    <>
      {isMobile && (
        <div
          onClick={() => setCollapsed(true)}
          style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.5)", zIndex: 90 }}
        />
      )}
      <div
        style={
          isMobile
            ? { position: "fixed", top: 0, left: 0, bottom: 0, width: 240, background: "#24272B", padding: "24px 16px", display: "flex", flexDirection: "column", zIndex: 100, overflowY: "auto" }
            : { width: 240, background: "#24272B", padding: "24px 16px", display: "flex", flexDirection: "column", flexShrink: 0 }
        }
      >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, padding: "0 8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, background: "#E8A426", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <LayoutDashboard size={18} color="#24272B" />
          </div>
          <span className="disp" style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>Dashboard</span>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          title="Sembunyikan menu"
          style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "#33373C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
        >
          <ChevronLeft size={15} color="#9CA0A6" />
        </button>
      </div>

      {items.map((it) => {
        const Icon = it.icon;
        const active = page === it.key;
        return (
          <button
            key={it.key} onClick={() => { setPage(it.key); if (isMobile) setCollapsed(true); }}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 10, border: "none", background: active ? "#E8A426" : "none", color: active ? "#24272B" : "#9CA0A6", fontSize: 13.5, fontWeight: 600, marginBottom: 4, textAlign: "left" }}
          >
            <Icon size={17} /> {it.label}
          </button>
        );
      })}

      <div style={{ flex: 1 }} />
      <div style={{ padding: "12px 8px", borderTop: "1px solid #3A3E44" }}>
        <p style={{ color: "#fff", fontSize: 13, fontWeight: 600, margin: "8px 0 2px" }}>{profile?.nama || "Staff"}</p>
        <p style={{ color: "#6B6F75", fontSize: 11, margin: "0 0 10px", textTransform: "capitalize" }}>{profile?.role?.replace("_", " ")}</p>
        <button onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: "#C0392B", fontSize: 12.5, fontWeight: 600, padding: 0 }}>
          <LogOut size={14} /> Keluar
        </button>
      </div>
      </div>
    </>
  );
}

// ============================================================
// HELPER UI KECIL
// ============================================================
function PageHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h1 className="disp" style={{ fontSize: 28, fontWeight: 700, color: "#24272B", margin: 0 }}>{title}</h1>
      {subtitle && <p style={{ color: "#9CA0A6", fontSize: 13, margin: "4px 0 0" }}>{subtitle}</p>}
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA0A6", fontSize: 13.5 }}>{text}</div>;
}

function LoadingState() {
  return <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA0A6", fontSize: 13.5 }}>Memuat data...</div>;
}

function Card({ children, style }) {
  return <div style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 14, padding: 18, ...style }}>{children}</div>;
}

// ============================================================
// RINGKASAN (OVERVIEW)
// ============================================================
function OverviewPage({ token, setPage }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const now = new Date();
      const startBulan = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const nextMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
      const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
      const endBulan = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

      const [pendingOrders, pendingClients, keuanganBulanIni, piutang, allSales, allClients, kunjunganBulanIni, rekapOmzetSales, semuaTokoKota, keuangan12Bulan, pajakPembayaran, investorsAktif, bungaPembayaran, chatCasesOpen, semuaOrderTanggal] = await Promise.all([
        supabaseFetch(token, "orders?select=id&status=eq.menunggu_persetujuan"),
        supabaseFetch(token, "clients?select=id&status=eq.pending"),
        supabaseFetch(token, "v_laporan_keuangan_bulanan?select=*&order=bulan.desc&limit=1"),
        supabaseFetch(token, "v_piutang_client?select=total_piutang,melebihi_limit"),
        supabaseFetch(token, "sales?select=id,kode,nama&order=nama.asc"),
        supabaseFetch(token, "clients?select=id,sales_id,kota&sales_id=not.is.null"),
        supabaseFetch(token, `kunjungan_sales?select=id,sales_id&created_at=gte.${startBulan}&created_at=lt.${endBulan}`),
        supabaseFetch(token, `v_rekap_sales_bulanan?select=sales_id,omzet_bulan&bulan=eq.${startBulan}`),
        supabaseFetch(token, "clients?select=id,kota&status=eq.aktif"),
        supabaseFetch(token, `v_laporan_keuangan_bulanan?select=bulan,pph_final_umkm&order=bulan.desc&limit=12`),
        supabaseFetch(token, "pajak_pembayaran?select=bulan,sudah_dibayar"),
        supabaseFetch(token, "investors?select=id,nama,modal_investasi,bunga_persen,tanggal_mulai&aktif=eq.true"),
        supabaseFetch(token, "bunga_investor_pembayaran?select=investor_id,bulan,sudah_dibayar"),
        supabaseFetch(token, "chat_cases?select=id,no_case,client_id,updated_at,clients(nama)&status=eq.open"),
        supabaseFetch(token, "orders?select=client_id,tanggal&status=neq.ditolak&order=tanggal.desc"),
      ]);
      const totalPiutang = piutang.reduce((a, b) => a + Number(b.total_piutang || 0), 0);
      const melebihiLimit = piutang.filter((p) => p.melebihi_limit).length;

      // ---------- Analisa "Yang Perlu Dikerjakan" ----------
      const todoList = [];

      if (pendingOrders.length > 0) {
        todoList.push({ label: `${pendingOrders.length} pesanan menunggu persetujuan`, urgent: true, page: "orders" });
      }
      if (pendingClients.length > 0) {
        todoList.push({ label: `${pendingClients.length} toko baru menunggu approval`, urgent: true, page: "clients" });
      }
      if (melebihiLimit > 0) {
        todoList.push({ label: `${melebihiLimit} toko melebihi limit piutang`, urgent: true, page: "piutang" });
      }
      // Toko yang sudah lama tidak order (>30 hari sejak order terakhir)
      const tanggalTerakhirPerToko = {};
      semuaOrderTanggal.forEach((o) => {
        if (!tanggalTerakhirPerToko[o.client_id]) tanggalTerakhirPerToko[o.client_id] = o.tanggal;
      });
      const jumlahTokoTidakAktif = semuaTokoKota.filter((c) => {
        const tgl = tanggalTerakhirPerToko[c.id];
        if (!tgl) return false; // toko yang belum PERNAH order tidak dihitung "tidak aktif" di sini
        const hari = Math.floor((Date.now() - new Date(tgl).getTime()) / (1000 * 60 * 60 * 24));
        return hari > 30;
      }).length;
      if (jumlahTokoTidakAktif > 0) {
        todoList.push({ label: `${jumlahTokoTidakAktif} toko sudah >30 hari tidak order`, urgent: false, page: "rekap_toko" });
      }
      // Pajak bulan yang belum dibayar (dari bulan-bulan yang sudah ada transaksinya)
      keuangan12Bulan.forEach((k) => {
        const status = pajakPembayaran.find((p) => p.bulan === k.bulan);
        if (!status?.sudah_dibayar && Number(k.pph_final_umkm) > 0) {
          todoList.push({
            label: `Bayar Pajak PPh Final ${new Date(k.bulan).toLocaleDateString("id-ID", { month: "long", year: "numeric" })} (${rupiah(k.pph_final_umkm)})`,
            urgent: false, page: "pajak",
          });
        }
      });
      // Bunga investor bulan berjalan yang belum dibayar
      investorsAktif.forEach((inv) => {
        const sudahMulai = !inv.tanggal_mulai || inv.tanggal_mulai <= startBulan || inv.tanggal_mulai.slice(0, 7) === startBulan.slice(0, 7);
        if (!sudahMulai) return;
        const status = bungaPembayaran.find((p) => p.investor_id === inv.id && p.bulan === startBulan);
        if (!status?.sudah_dibayar) {
          const bunga = Number(inv.modal_investasi) * (Number(inv.bunga_persen) / 100);
          todoList.push({ label: `Bayar bunga investor ${inv.nama} bulan ini (${rupiah(bunga)})`, urgent: false, page: "bunga_investor" });
        }
      });
      // Chat toko yang masih terbuka (belum ditutup, kemungkinan perlu tindak lanjut)
      if (chatCasesOpen.length > 0) {
        todoList.push({ label: `${chatCasesOpen.length} chat toko masih terbuka (belum ditutup)`, urgent: false, page: "chat_sales" });
      }

      // Kelompokkan toko per kota/daerah
      const kotaMap = {};
      semuaTokoKota.forEach((c) => {
        const namaKota = c.kota && c.kota.trim() ? c.kota.trim() : "Tidak Diketahui";
        kotaMap[namaKota] = (kotaMap[namaKota] || 0) + 1;
      });
      const ringkasanKota = Object.entries(kotaMap)
        .map(([kota, jumlah]) => ({ kota, jumlah }))
        .sort((a, b) => b.jumlah - a.jumlah);

      const ringkasanKunjungan = allSales.map((s) => {
        const tokoSales = allClients.filter((c) => c.sales_id === s.id);
        const jumlahToko = tokoSales.length;
        const totalKunjungan = kunjunganBulanIni.filter((k) => k.sales_id === s.id).length;
        const omzetRow = rekapOmzetSales.find((r) => r.sales_id === s.id);
        const daftarKota = Array.from(new Set(tokoSales.map((c) => (c.kota && c.kota.trim()) || "Tidak Diketahui")));
        return { ...s, jumlahToko, targetKunjungan: jumlahToko * TARGET_KUNJUNGAN_PER_BULAN, totalKunjungan, totalOmzet: Number(omzetRow?.omzet_bulan || 0), daftarKota };
      });

      setData({
        pendingOrders: pendingOrders.length,
        pendingClients: pendingClients.length,
        bulanIni: keuanganBulanIni[0] || null,
        totalPiutang, melebihiLimit,
        ringkasanKunjungan,
        ringkasanKota,
        todoList,
      });
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Ringkasan" subtitle="Gambaran cepat bisnis Anda hari ini" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard label="Pesanan Menunggu" value={data.pendingOrders} color="#B8860B" bg="#FBF0D9" />
        <StatCard label="Toko Baru Menunggu" value={data.pendingClients} color="#8A6A1A" bg="#EFE1BE" />
        <StatCard label="Total Piutang" value={rupiah(data.totalPiutang)} color="#C0392B" bg="#FBEAEA" small />
        <StatCard label="Toko Lebihi Limit" value={data.melebihiLimit} color="#C0392B" bg="#FBEAEA" />
      </div>

      {data.bulanIni && (
        <Card>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 14px" }}>
            Laporan Keuangan Bulan Ini
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
            <MiniStat label="Omzet Bersih" value={rupiah(data.bulanIni.omzet_bersih)} />
            <MiniStat label="Laba Kotor" value={rupiah(data.bulanIni.laba_kotor)} />
            <MiniStat label="Biaya Operasional" value={rupiah(data.bulanIni.biaya_operasional)} />
            <MiniStat label="PPh Final UMKM" value={rupiah(data.bulanIni.pph_final_umkm)} />
          </div>
        </Card>
      )}

      {data.ringkasanKunjungan && data.ringkasanKunjungan.length > 0 && (
        <>
          <h2 className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "24px 0 12px" }}>Ringkasan Omzet dan Kunjungan Sales Bulan Ini</h2>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#F7F5F1" }}>
                  {["Sales", "Kota", "Total Omzet", "Jumlah Toko", "Target Kunjungan", "Total Kunjungan", "Pencapaian"].map((h) => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.ringkasanKunjungan.map((s) => {
                  const persen = s.targetKunjungan > 0 ? (s.totalKunjungan / s.targetKunjungan) * 100 : 0;
                  const tercapai = persen >= 100;
                  return (
                    <tr key={s.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                      <td style={{ padding: "12px 14px", fontWeight: 700 }}>{s.nama}</td>
                      <td style={{ padding: "12px 14px", color: "#6B6F75" }}>{s.daftarKota && s.daftarKota.length > 0 ? s.daftarKota.join(", ") : "-"}</td>
                      <td style={{ padding: "12px 14px", fontWeight: 700 }}>{rupiah(s.totalOmzet)}</td>
                      <td style={{ padding: "12px 14px" }}>{s.jumlahToko}</td>
                      <td style={{ padding: "12px 14px" }}>{s.targetKunjungan}</td>
                      <td style={{ padding: "12px 14px", fontWeight: 700 }}>{s.totalKunjungan}</td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: tercapai ? "#D8E9E6" : "#FBF0D9", color: tercapai ? "#28685D" : "#B8860B" }}>
                          {persen.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {data.ringkasanKota && data.ringkasanKota.length > 0 && (
        <>
          <h2 className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "24px 0 12px" }}>Sebaran Toko per Kota/Daerah</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {data.ringkasanKota.map((k) => (
              <Card key={k.kota} style={{ padding: 16 }}>
                <p style={{ fontSize: 12, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>{k.kota}</p>
                <p className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: 0 }}>{k.jumlah} <span style={{ fontSize: 12, fontWeight: 500, color: "#9CA0A6" }}>toko</span></p>
              </Card>
            ))}
          </div>
        </>
      )}

      <h2 className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "24px 0 12px" }}>Yang Perlu Dikerjakan</h2>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {data.todoList && data.todoList.length > 0 ? (
          data.todoList.map((t, i) => (
            <button
              key={i}
              onClick={() => setPage?.(t.page)}
              style={{
                width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12,
                padding: "14px 18px", background: "none", border: "none", borderTop: i > 0 ? "1px solid #EDEAE3" : "none",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.urgent ? "#C0392B" : "#E8A426", flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: "#24272B", flex: 1 }}>{t.label}</span>
              <ChevronRight size={16} color="#9CA0A6" />
            </button>
          ))
        ) : (
          <EmptyState text="Tidak ada pekerjaan tertunda - semua sudah beres!" />
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value, color, bg, small }) {
  return (
    <Card>
      <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 8px", fontWeight: 600 }}>{label}</p>
      <p className="disp" style={{ fontSize: small ? 20 : 30, fontWeight: 700, color, margin: 0 }}>{value}</p>
    </Card>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 4px" }}>{label}</p>
      <p className="disp" style={{ fontSize: 19, fontWeight: 700, color: "#24272B", margin: 0 }}>{value}</p>
    </div>
  );
}

function ErrorBox({ error, onRetry }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#FBEAEA", color: "#C0392B", padding: 16, borderRadius: 12, fontSize: 13 }}>
      <AlertCircle size={18} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{error}</span>
      <button onClick={onRetry} style={{ background: "none", border: "1px solid #C0392B", borderRadius: 8, padding: "6px 10px", color: "#C0392B", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
        <RefreshCw size={13} /> Coba lagi
      </button>
    </div>
  );
}

// ============================================================
// APPROVE PESANAN
// ============================================================
function OrdersPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [checkingOrder, setCheckingOrder] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      // Ambil SEMUA order (limit wajar) - supaya ada riwayat permanen di sini,
      // bukan cuma yang masih di tahap ini. Nanti dipisah jadi 2 bagian:
      // "Menunggu Persetujuan" (aktif) dan "Riwayat" (sudah pernah diproses).
      const rows = await supabaseFetch(token, "orders?select=*,clients(nama,kode,alamat,telp,jenis_pembayaran),order_items(*,products(kode,nama,satuan))&order=created_at.desc&limit=200");
      setOrders(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function updateStatus(orderId, status) {
    setProcessingId(orderId);
    try {
      await supabaseFetch(token, `orders?id=eq.${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ status, disetujui_pada: new Date().toISOString() }),
      });
      // Tetap tampil di daftar, cuma statusnya diperbarui (bukan dihapus)
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    } catch (e) {
      alert("Gagal update: " + e.message);
    }
    setProcessingId(null);
  }

  async function confirmStock(orderId, confirmation) {
    setProcessingId(orderId);
    try {
      await supabaseFetch(token, `orders?id=eq.${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ stock_confirmation: confirmation }),
      });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, stock_confirmation: confirmation } : o)));
      setCheckingOrder(null);
    } catch (e) {
      alert("Gagal simpan konfirmasi: " + e.message);
    }
    setProcessingId(null);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const pending = orders.filter((o) => o.status === "menunggu_persetujuan");
  const riwayat = orders.filter((o) => o.status !== "menunggu_persetujuan");

  function renderOrderCard(o) {
    const isPending = o.status === "menunggu_persetujuan";
    const isRejected = o.status === "ditolak";
    const isChecked = !!o.stock_confirmation;
    const isReady = o.stock_confirmation === "ready";
    const isHabis = o.stock_confirmation === "stok_habis";
    return (
      <Card key={o.id} style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>
              {o.no_nota}
              {o.metode_bayar === "cod" && (
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#FBF0D9", color: "#8A6A1A", verticalAlign: "middle" }}>COD</span>
              )}
            </p>
            <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>{o.clients?.nama} ({o.clients?.kode})</p>
            <p style={{ fontSize: 12, color: "#9CA0A6", margin: "4px 0 0" }}>
              {new Date(o.created_at).toLocaleString("id-ID")} · Channel: {o.channel}
              {o.is_dropship && <span style={{ marginLeft: 6, color: "#B8860B", fontWeight: 700 }}>DROPSHIP</span>}
              {isChecked && isPending && (
                <span style={{ marginLeft: 6, fontWeight: 700, color: isReady ? "#28685D" : "#C0392B" }}>
                  · Konfirmasi: {isReady ? "Ready" : "Stok Habis"}
                </span>
              )}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {!isPending && !isRejected && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 9, background: "#D8E9E6", color: "#28685D", fontSize: 12.5, fontWeight: 700 }}>
                <Check size={14} /> Disetujui
              </span>
            )}
            {isRejected && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 9, background: "#FBEAEA", color: "#C0392B", fontSize: 12.5, fontWeight: 700 }}>
                <X size={14} /> Ditolak
              </span>
            )}
            {isPending && (
              <>
                <button
                  onClick={() => setCheckingOrder(o)}
                  style={{
                    padding: "8px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 5,
                    border: isChecked ? "1.5px solid #B8E0C8" : "1.5px solid #E4E1DA",
                    background: isChecked ? "#D8E9E6" : "#fff",
                    color: isChecked ? "#28685D" : "#24272B",
                  }}
                >
                  {isChecked ? <Check size={14} /> : <Eye size={14} />} Cek Pesanan
                </button>
                <button
                  disabled={processingId === o.id || !isChecked || isReady}
                  onClick={() => updateStatus(o.id, "ditolak")}
                  style={{ padding: "8px 14px", borderRadius: 9, border: "1.5px solid #F0CFC7", background: (!isChecked || isReady) ? "#F7F5F1" : "#fff", color: (!isChecked || isReady) ? "#B5B2AA" : "#C0392B", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}
                >
                  <X size={14} /> Tolak
                </button>
                <button
                  disabled={processingId === o.id || !isChecked || isHabis}
                  onClick={() => updateStatus(o.id, "menunggu_pembayaran")}
                  style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: (!isChecked || isHabis) ? "#E4E1DA" : "#E8A426", color: (!isChecked || isHabis) ? "#9CA0A6" : "#24272B", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}
                >
                  <Check size={14} /> Setujui
                </button>
              </>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Approve Pesanan" subtitle={`${pending.length} menunggu persetujuan`} />
      {pending.length === 0 ? (
        <EmptyState text="Tidak ada pesanan yang menunggu persetujuan saat ini." />
      ) : (
        pending.map(renderOrderCard)
      )}

      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "28px 0 12px" }}>Riwayat</h2>
      {riwayat.length === 0 ? (
        <EmptyState text="Belum ada riwayat pesanan yang diproses." />
      ) : (
        riwayat.map(renderOrderCard)
      )}

      {checkingOrder && (
        <CekPesananModal
          order={checkingOrder}
          onConfirm={(confirmation) => confirmStock(checkingOrder.id, confirmation)}
          onClose={() => setCheckingOrder(null)}
          processing={processingId === checkingOrder.id}
        />
      )}
    </div>
  );
}

// ============================================================
// MODAL CEK PESANAN (konfirmasi stock sebelum approve/tolak)
// ============================================================
function CekPesananModal({ order, onConfirm, onClose, processing }) {
  const items = order.order_items || [];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 460, maxHeight: "85vh", overflowY: "auto", padding: 24 }}>
        <p style={{ fontSize: 12, color: "#9CA0A6", margin: "0 0 2px", fontWeight: 700, textTransform: "uppercase" }}>Cek Pesanan</p>
        <h2 className="disp" style={{ fontSize: 20, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>{order.no_nota}</h2>
        <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "0 0 16px" }}>{order.clients?.nama}</p>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, marginBottom: 20 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 11, color: "#6B6F75" }}>Kode</th>
              <th style={{ textAlign: "left", padding: "8px 10px", fontSize: 11, color: "#6B6F75" }}>Nama Barang</th>
              <th style={{ textAlign: "center", padding: "8px 10px", fontSize: 11, color: "#6B6F75" }}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                <td style={{ padding: "8px 10px", fontWeight: 700 }}>{it.products?.kode}</td>
                <td style={{ padding: "8px 10px" }}>{it.products?.nama}</td>
                <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700 }}>{it.qty} {it.products?.satuan}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6F75", margin: "0 0 10px" }}>Konfirmasi ketersediaan barang:</p>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button
            disabled={processing}
            onClick={() => onConfirm("ready")}
            style={{ flex: 1, padding: "14px", borderRadius: 10, border: "none", background: "#28685D", color: "#fff", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Check size={16} /> Konfirmasi Ready
          </button>
          <button
            disabled={processing}
            onClick={() => onConfirm("stok_habis")}
            style={{ flex: 1, padding: "14px", borderRadius: 10, border: "none", background: "#C0392B", color: "#fff", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <X size={16} /> Konfirmasi Stok Habis
          </button>
        </div>
        <button onClick={onClose} style={{ width: "100%", padding: 11, borderRadius: 9, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 12.5 }}>
          Tutup
        </button>
      </div>
    </div>
  );
}

// ============================================================
// MODAL CETAK NOTA
// ============================================================
function NotaPrintModal({ order, type, settings, onClose }) {
  const s = settings || {
    nama_perusahaan: COMPANY_NAME, alamat_perusahaan: "", telp_perusahaan: "",
    teks_subjudul_nota: "NOTA PENJUALAN", teks_subjudul_surat_jalan: "SURAT JALAN",
    teks_footer_nota: "Terima kasih atas pesanan Anda", catatan_tambahan: "",
    label_ttd_kiri: "Hormat kami,", label_ttd_kanan: "Penerima,",
  };
  const items = order.order_items || [];
  const subtotalSebelum = items.reduce((sum, it) => sum + Number(it.harga_satuan || 0) * it.qty, 0);
  const totalSebelumDiskonNota = items.reduce((sum, it) => sum + Number(it.subtotal_setelah_diskon || 0), 0);
  const diskonTambahanNilai = Number(order.diskon_tambahan_nilai || 0);
  const diskonTambahanRupiah = order.diskon_tambahan_jenis === "persen"
    ? totalSebelumDiskonNota * (diskonTambahanNilai / 100)
    : diskonTambahanNilai;
  const totalBayar = Math.max(0, totalSebelumDiskonNota - diskonTambahanRupiah);
  const totalDiskon = subtotalSebelum - totalSebelumDiskonNota;
  const isSuratJalan = type === "surat_jalan";
  const isLunas = order.status_bayar === "lunas";

  return (
    <div className="nota-print-overlay" style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <style>{`
        @media print {
          @page { size: 9.5in 11in; margin: 0.4in; }
          body * { visibility: hidden; }
          .nota-print-area, .nota-print-area * { visibility: visible; }
          .nota-print-area { position: fixed; top: 0; left: 0; width: 100%; }
          .nota-print-overlay { position: static !important; background: none !important; padding: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div style={{ background: "#fff", borderRadius: 14, width: 620, maxHeight: "90vh", overflowY: "auto", padding: 0 }}>
        <div className="nota-print-area" style={{ padding: "28px 36px" }}>
          {/* HEADER */}
          <div style={{ textAlign: "center", marginBottom: 6 }}>
            <p className="disp" style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "0.02em" }}>{s.nama_perusahaan}</p>
            <p style={{ fontSize: 10.5, color: "#444", margin: "3px 0 0", fontStyle: "italic" }}>
              {[s.alamat_perusahaan, s.telp_perusahaan].filter(Boolean).join(" - ")}
            </p>
          </div>
          <div style={{ textAlign: "center", borderBottom: "2px solid #24272B", paddingBottom: 10, marginBottom: 14 }}>
            <p style={{ fontSize: 15, fontWeight: 700, margin: "10px 0 0", letterSpacing: "0.03em" }}>
              {isSuratJalan ? s.teks_subjudul_surat_jalan : s.teks_subjudul_nota}
            </p>
          </div>

          {/* INFO 2 KOLOM */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18, fontSize: 12.5 }}>
            <table style={{ borderCollapse: "collapse" }}><tbody>
              <tr>
                <td style={{ padding: "2px 8px 2px 0", fontWeight: 700, whiteSpace: "nowrap" }}>{isSuratJalan ? "No Surat Jalan" : "No Nota"}:</td>
                <td style={{ padding: "2px 0" }}>
                  <span style={{ background: "#FFF59D", padding: "2px 10px", fontWeight: 700, fontFamily: "monospace" }}>{order.no_nota}</span>
                </td>
              </tr>
              <tr>
                <td style={{ padding: "2px 8px 2px 0", fontWeight: 700, whiteSpace: "nowrap" }}>Tanggal:</td>
                <td style={{ padding: "2px 0" }}>{new Date(order.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
              </tr>
              <tr>
                <td style={{ padding: "2px 8px 2px 0", fontWeight: 700, whiteSpace: "nowrap", verticalAlign: "top" }}>Nama Client:</td>
                <td style={{ padding: "2px 0" }}>{order.clients?.nama}{order.is_dropship && <span style={{ color: "#B8860B", fontWeight: 700 }}> (DROPSHIP a/n {order.nama_pengirim_dropship})</span>}</td>
              </tr>
              <tr>
                <td style={{ padding: "2px 8px 2px 0", fontWeight: 700, whiteSpace: "nowrap", verticalAlign: "top" }}>Alamat:</td>
                <td style={{ padding: "2px 0" }}>{order.tujuan_alamat || order.clients?.alamat}</td>
              </tr>
            </tbody></table>

            {!isSuratJalan && (
              <table style={{ borderCollapse: "collapse", height: "fit-content" }}><tbody>
                <tr>
                  <td style={{ padding: "2px 8px 2px 0", fontWeight: 700, whiteSpace: "nowrap" }}>Jenis Bayar:</td>
                  <td style={{ padding: "2px 0", color: "#1B8A3D", fontWeight: 600 }}>{order.clients?.jenis_pembayaran || "-"}</td>
                </tr>
                <tr>
                  <td style={{ padding: "2px 8px 2px 0", fontWeight: 700, whiteSpace: "nowrap" }}>Jatuh Tempo:</td>
                  <td style={{ padding: "2px 0", color: "#1B8A3D", fontWeight: 600 }}>{order.jatuh_tempo ? new Date(order.jatuh_tempo).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-"}</td>
                </tr>
                <tr>
                  <td style={{ padding: "2px 8px 2px 0", fontWeight: 700, whiteSpace: "nowrap" }}>Status:</td>
                  <td style={{ padding: "2px 0", color: isLunas ? "#1B8A3D" : "#C0392B", fontWeight: 700 }}>{isLunas ? "Lunas" : "Belum Lunas"}</td>
                </tr>
              </tbody></table>
            )}
          </div>

          {/* TABEL BARANG */}
          {isSuratJalan ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 16 }}>
              <thead>
                <tr style={{ background: "#EAF0F5" }}>
                  <th style={{ textAlign: "center", padding: "8px 6px", border: "1px solid #B9C6D1", width: 36 }}>No</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", border: "1px solid #B9C6D1" }}>Nama Barang</th>
                  <th style={{ textAlign: "center", padding: "8px 6px", border: "1px solid #B9C6D1" }}>Satuan</th>
                  <th style={{ textAlign: "center", padding: "8px 6px", border: "1px solid #B9C6D1" }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={it.id}>
                    <td style={{ padding: "6px", border: "1px solid #EDEAE3", textAlign: "center" }}>{i + 1}</td>
                    <td style={{ padding: "6px", border: "1px solid #EDEAE3" }}>{it.products?.nama}</td>
                    <td style={{ padding: "6px", border: "1px solid #EDEAE3", textAlign: "center" }}>{it.products?.satuan}</td>
                    <td style={{ padding: "6px", border: "1px solid #EDEAE3", textAlign: "center" }}>{it.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 4 }}>
              <thead>
                <tr style={{ background: "#EAF0F5" }}>
                  <th style={{ textAlign: "center", padding: "8px 6px", border: "1px solid #B9C6D1", width: 32 }}>No</th>
                  <th style={{ textAlign: "left", padding: "8px 6px", border: "1px solid #B9C6D1" }}>Nama Barang</th>
                  <th style={{ textAlign: "center", padding: "8px 6px", border: "1px solid #B9C6D1" }}>Satuan</th>
                  <th style={{ textAlign: "center", padding: "8px 6px", border: "1px solid #B9C6D1" }}>Qty</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", border: "1px solid #B9C6D1" }}>Harga Satuan</th>
                  <th style={{ textAlign: "center", padding: "8px 6px", border: "1px solid #B9C6D1" }}>Diskon</th>
                  <th style={{ textAlign: "right", padding: "8px 6px", border: "1px solid #B9C6D1" }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const hargaSatuan = Number(it.harga_dropship || it.harga_satuan);
                  const subSebelum = hargaSatuan * it.qty;
                  const subSesudah = Number(it.subtotal_setelah_diskon || 0);
                  const diskonPct = subSebelum > 0 ? Math.round((1 - subSesudah / subSebelum) * 100) : 0;
                  return (
                    <tr key={it.id}>
                      <td style={{ padding: "6px", border: "1px solid #EDEAE3", textAlign: "center" }}>{i + 1}</td>
                      <td style={{ padding: "6px", border: "1px solid #EDEAE3" }}>{it.products?.nama}</td>
                      <td style={{ padding: "6px", border: "1px solid #EDEAE3", textAlign: "center" }}>{it.products?.satuan}</td>
                      <td style={{ padding: "6px", border: "1px solid #EDEAE3", textAlign: "center" }}>{it.qty}</td>
                      <td style={{ padding: "6px", border: "1px solid #EDEAE3", textAlign: "right" }}>{Math.round(hargaSatuan).toLocaleString("id-ID")}</td>
                      <td style={{ padding: "6px", border: "1px solid #EDEAE3", textAlign: "center" }}>{diskonPct}%</td>
                      <td style={{ padding: "6px", border: "1px solid #EDEAE3", textAlign: "right" }}>{Math.round(subSesudah).toLocaleString("id-ID")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* RINGKASAN TOTAL (khusus Nota) */}
          {!isSuratJalan && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12.5, width: 300 }}><tbody>
                <tr>
                  <td style={{ padding: "3px 10px 3px 0", textAlign: "right" }}>Subtotal (Sebelum Diskon)</td>
                  <td style={{ padding: "3px 0", textAlign: "right", width: 110 }}>{Math.round(subtotalSebelum).toLocaleString("id-ID")}</td>
                </tr>
                <tr>
                  <td style={{ padding: "3px 10px 3px 0", textAlign: "right" }}>Total Diskon (Promo Koli)</td>
                  <td style={{ padding: "3px 0", textAlign: "right" }}>{Math.round(totalDiskon).toLocaleString("id-ID")}</td>
                </tr>
                {diskonTambahanRupiah > 0 && (
                  <tr>
                    <td style={{ padding: "3px 10px 3px 0", textAlign: "right", color: "#B8860B" }}>
                      Diskon Tambahan{order.diskon_tambahan_keterangan ? ` (${order.diskon_tambahan_keterangan})` : ""}
                      {order.diskon_tambahan_jenis === "persen" ? ` ${diskonTambahanNilai}%` : ""}
                    </td>
                    <td style={{ padding: "3px 0", textAlign: "right", color: "#B8860B" }}>{Math.round(diskonTambahanRupiah).toLocaleString("id-ID")}</td>
                  </tr>
                )}
                <tr style={{ borderTop: "2px solid #24272B" }}>
                  <td style={{ padding: "6px 10px 0 0", textAlign: "right", fontWeight: 700, fontSize: 14 }}>TOTAL BAYAR</td>
                  <td style={{ padding: "6px 0 0", textAlign: "right", fontWeight: 700, fontSize: 15 }}>{Math.round(totalBayar).toLocaleString("id-ID")}</td>
                </tr>
              </tbody></table>
            </div>
          )}

          {/* CATATAN / REKENING (khusus Nota) */}
          {!isSuratJalan && s.catatan_tambahan && (
            <p style={{ fontSize: 11.5, fontWeight: 700, whiteSpace: "pre-line", lineHeight: 1.6, margin: "0 0 30px" }}>{s.catatan_tambahan}</p>
          )}

          {/* TANDA TANGAN */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: isSuratJalan ? 40 : 20, fontSize: 12 }}>
            <div style={{ textAlign: "center", width: "40%" }}>
              <p style={{ margin: "0 0 55px" }}>{isSuratJalan ? "Pengirim," : s.label_ttd_kiri}</p>
              <p style={{ margin: 0, borderTop: "1px solid #24272B", paddingTop: 6 }}>( ......................... )</p>
            </div>
            <div style={{ textAlign: "center", width: "40%" }}>
              <p style={{ margin: "0 0 55px" }}>{isSuratJalan ? "Penerima," : s.label_ttd_kanan}</p>
              <p style={{ margin: 0, borderTop: "1px solid #24272B", paddingTop: 6 }}>( ......................... )</p>
            </div>
          </div>
        </div>

        <div className="no-print" style={{ display: "flex", gap: 10, padding: "16px 36px 24px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13 }}>
            Tutup
          </button>
          <button onClick={() => window.print()} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "#24272B", color: "#fff", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Printer size={15} /> Print
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// APPROVE TOKO BARU
// ============================================================
function ClientsPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [kodeBaru, setKodeBaru] = useState({});

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, "clients?select=*&status=eq.pending&order=created_at.asc");
      setClients(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function approve(id) {
    const kode = (kodeBaru[id] || "").trim();
    if (!kode) { alert("Isi dulu Kode Toko barunya (misal C006)."); return; }
    setProcessingId(id);
    try {
      await supabaseFetch(token, `clients?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ kode, status: "aktif" }),
      });
      setClients((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      alert("Gagal approve: " + e.message);
    }
    setProcessingId(null);
  }

  async function reject(id) {
    setProcessingId(id);
    try {
      await supabaseFetch(token, `clients?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ status: "ditolak" }) });
      setClients((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      alert("Gagal tolak: " + e.message);
    }
    setProcessingId(null);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Approve Toko Baru" subtitle={`${clients.length} pendaftaran menunggu persetujuan`} />
      {clients.length === 0 ? (
        <EmptyState text="Tidak ada pendaftaran toko baru saat ini." />
      ) : (
        clients.map((c) => (
          <Card key={c.id} style={{ marginBottom: 12 }}>
            <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>{c.nama}</p>
            <p style={{ fontSize: 13, color: "#6B6F75", margin: "0 0 2px" }}>{c.telp}</p>
            <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 14px" }}>{c.alamat}</p>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                placeholder="Kode Toko baru, misal C006"
                value={kodeBaru[c.id] || ""}
                onChange={(e) => setKodeBaru({ ...kodeBaru, [c.id]: e.target.value.toUpperCase() })}
                style={{ flex: 1, padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, outline: "none" }}
              />
              <button
                disabled={processingId === c.id}
                onClick={() => reject(c.id)}
                style={{ padding: "9px 14px", borderRadius: 9, border: "1.5px solid #F0CFC7", background: "#fff", color: "#C0392B", fontSize: 12.5, fontWeight: 700 }}
              >
                Tolak
              </button>
              <button
                disabled={processingId === c.id}
                onClick={() => approve(c.id)}
                style={{ padding: "9px 14px", borderRadius: 9, border: "none", background: "#E8A426", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
              >
                Setujui
              </button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

// ============================================================
// LAPORAN KEUANGAN
// ============================================================
function KeuanganPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await supabaseFetch(token, "v_laporan_keuangan_bulanan?select=*&order=bulan.desc&limit=12");
      setRows(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Laporan Keuangan" subtitle="12 bulan terakhir" />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Bulan", "Omzet Kotor", "Diskon", "Omzet Bersih", "HPP", "Laba Kotor", "Biaya Ops.", "PPh Final"].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.bulan} style={{ borderTop: "1px solid #EDEAE3" }}>
                <td style={{ padding: "12px 14px", fontWeight: 600 }}>{new Date(r.bulan).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</td>
                <td style={{ padding: "12px 14px" }}>{rupiah(r.omzet_kotor)}</td>
                <td style={{ padding: "12px 14px", color: "#28685D" }}>{rupiah(r.total_diskon)}</td>
                <td style={{ padding: "12px 14px" }}>{rupiah(r.omzet_bersih)}</td>
                <td style={{ padding: "12px 14px" }}>{rupiah(r.total_hpp)}</td>
                <td style={{ padding: "12px 14px", fontWeight: 700 }}>{rupiah(r.laba_kotor)}</td>
                <td style={{ padding: "12px 14px" }}>{rupiah(r.biaya_operasional)}</td>
                <td style={{ padding: "12px 14px" }}>{rupiah(r.pph_final_umkm)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState text="Belum ada data transaksi." />}
      </Card>
    </div>
  );
}

// ============================================================
// PIUTANG
// ============================================================
function PiutangPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await supabaseFetch(token, "v_piutang_client?select=*&total_piutang=gt.0&order=total_piutang.desc");
      setRows(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function startEdit(r) {
    setEditingId(r.client_id);
    setEditValue(r.limit_kredit || "");
  }

  async function saveLimit(clientId) {
    setSaving(true);
    try {
      await supabaseFetch(token, `clients?id=eq.${clientId}`, {
        method: "PATCH",
        body: JSON.stringify({ limit_kredit: editValue === "" ? null : Number(editValue) }),
      });
      setRows((prev) => prev.map((r) => {
        if (r.client_id !== clientId) return r;
        const newLimit = editValue === "" ? null : Number(editValue);
        return { ...r, limit_kredit: newLimit, melebihi_limit: newLimit !== null && r.total_piutang > newLimit };
      }));
      setEditingId(null);
    } catch (e) {
      alert("Gagal simpan: " + e.message);
    }
    setSaving(false);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Piutang per Toko" subtitle="Toko dengan tagihan belum lunas - klik Limit Kredit untuk ubah" />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Toko", "Total Piutang", "Limit Kredit", "Status"].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.client_id} style={{ borderTop: "1px solid #EDEAE3" }}>
                <td style={{ padding: "12px 14px", fontWeight: 600 }}>{r.nama}</td>
                <td style={{ padding: "12px 14px", fontWeight: 700 }}>{rupiah(r.total_piutang)}</td>
                <td style={{ padding: "12px 14px" }}>
                  {editingId === r.client_id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                        autoFocus
                        style={{ width: 120, padding: "6px 8px", borderRadius: 7, border: "1.5px solid #E4E1DA", fontSize: 12.5 }}
                      />
                      <button onClick={() => saveLimit(r.client_id)} disabled={saving} style={{ padding: "6px 10px", borderRadius: 7, border: "none", background: "#E8A426", color: "#24272B", fontSize: 11.5, fontWeight: 700 }}>
                        Simpan
                      </button>
                      <button onClick={() => setEditingId(null)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontSize: 11.5 }}>
                        Batal
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(r)} style={{ background: "none", border: "none", padding: 0, color: "#24272B", fontSize: 13, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}>
                      {r.limit_kredit ? rupiah(r.limit_kredit) : "Belum diatur"}
                    </button>
                  )}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  {r.melebihi_limit ? (
                    <span style={{ background: "#FBEAEA", color: "#C0392B", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>MELEBIHI LIMIT</span>
                  ) : (
                    <span style={{ background: "#D8E9E6", color: "#28685D", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>Aman</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState text="Tidak ada piutang berjalan saat ini." />}
      </Card>
    </div>
  );
}

// ============================================================
// BARANG TERLARIS
// ============================================================
function BarangTerlarisPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await supabaseFetch(token, "v_barang_terlaris?select=*&order=peringkat.asc&limit=20");
      setRows(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Barang Terlaris" subtitle="Diurutkan dari qty terjual tertinggi" />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Peringkat", "Barang", "Kategori", "Qty Terjual", "Total Omzet"].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.product_id} style={{ borderTop: "1px solid #EDEAE3" }}>
                <td style={{ padding: "12px 14px", fontWeight: 700, color: "#B8860B" }}>#{r.peringkat}</td>
                <td style={{ padding: "12px 14px", fontWeight: 600 }}>{r.nama}</td>
                <td style={{ padding: "12px 14px", color: "#6B6F75" }}>{r.kategori}</td>
                <td style={{ padding: "12px 14px" }}>{r.qty_terjual}</td>
                <td style={{ padding: "12px 14px", fontWeight: 700 }}>{rupiah(r.total_omzet)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState text="Belum ada data penjualan." />}
      </Card>
    </div>
  );
}

// ============================================================
// REKAP SALES
// ============================================================
function SalesPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [error, setError] = useState("");
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [expandedId, setExpandedId] = useState(null);
  const [detailCache, setDetailCache] = useState({}); // { sales_id: {loading, data} }
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rekapData, salesData] = await Promise.all([
        supabaseFetch(token, "v_rekap_sales_bulanan?select=*&order=bulan.desc&limit=300"),
        supabaseFetch(token, "sales?select=id,kode,nama,target_omzet_bulanan&order=kode.asc"),
      ]);
      setRows(rekapData);
      setAllSales(salesData);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const yearsAvailable = Array.from(new Set(rows.map((r) => r.bulan ? new Date(r.bulan).getFullYear() : now.getFullYear()))).sort((a, b) => b - a);
  if (yearsAvailable.length === 0) yearsAvailable.push(now.getFullYear());
  if (!yearsAvailable.includes(Number(filterYear))) yearsAvailable.unshift(Number(filterYear));

  // Gabungkan SEMUA sales dengan data omzet bulan yang difilter - supaya sales
  // yang belum ada order sama sekali di bulan itu tetap muncul (omzet 0),
  // bukan hilang begitu saja karena tidak ada baris di view untuk bulan itu.
  const filtered = allSales.map((s) => {
    const match = rows.find((r) => {
      if (!r.bulan || r.sales_id !== s.id) return false;
      const d = new Date(r.bulan);
      return d.getFullYear() === Number(filterYear) && d.getMonth() + 1 === Number(filterMonth);
    });
    return {
      sales_id: s.id, kode: s.kode, nama: s.nama,
      target_omzet_bulanan: s.target_omzet_bulanan || 0,
      jumlah_toko: match?.jumlah_toko || 0,
      omzet_bulan: match?.omzet_bulan || 0,
    };
  });

  function startEdit(r) {
    setEditingId(r.sales_id);
    setEditValue(r.target_omzet_bulanan || "");
  }

  async function saveTarget(salesId) {
    setSaving(true);
    try {
      await supabaseFetch(token, `sales?id=eq.${salesId}`, {
        method: "PATCH",
        body: JSON.stringify({ target_omzet_bulanan: editValue === "" ? 0 : Number(editValue) }),
      });
      setAllSales((prev) => prev.map((s) => (s.id === salesId ? { ...s, target_omzet_bulanan: Number(editValue) || 0 } : s)));
      setEditingId(null);
    } catch (e) {
      alert("Gagal simpan: " + e.message);
    }
    setSaving(false);
  }

  async function toggleExpand(salesId) {
    if (expandedId === salesId) { setExpandedId(null); return; }
    setExpandedId(salesId);
    if (detailCache[salesId]) return; // sudah pernah dimuat
    setDetailCache((prev) => ({ ...prev, [salesId]: { loading: true } }));
    try {
      const orders = await supabaseFetch(token, `orders?select=created_at,order_items(subtotal_setelah_diskon)&sales_id=eq.${salesId}&status=neq.ditolak`);
      const totalOmzet = orders.reduce((sum, o) => sum + (o.order_items || []).reduce((s, it) => s + Number(it.subtotal_setelah_diskon || 0), 0), 0);
      const hariSet = new Set(), mingguSet = new Set(), bulanSet = new Set(), tahunSet = new Set();
      orders.forEach((o) => {
        const d = new Date(o.created_at);
        const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);
        hariSet.add(d.toISOString().slice(0, 10));
        mingguSet.add(`${d.getFullYear()}-W${Math.ceil(dayOfYear / 7)}`);
        bulanSet.add(`${d.getFullYear()}-${d.getMonth()}`);
        tahunSet.add(d.getFullYear());
      });
      const safeDiv = (a, b) => (b > 0 ? a / b : 0);
      setDetailCache((prev) => ({
        ...prev,
        [salesId]: {
          loading: false,
          totalOmzet, totalOrder: orders.length,
          rataHari: safeDiv(totalOmzet, hariSet.size),
          rataMinggu: safeDiv(totalOmzet, mingguSet.size),
          rataBulan: safeDiv(totalOmzet, bulanSet.size),
          rataTahun: safeDiv(totalOmzet, tahunSet.size),
        },
      }));
    } catch (e) {
      setDetailCache((prev) => ({ ...prev, [salesId]: { loading: false, error: e.message } }));
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Rekap Sales" subtitle="Klik nama sales untuk lihat rata-rata omzet. Target bisa diedit langsung." />

      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, background: "#fff" }}>
          {yearsAvailable.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, background: "#fff" }}>
          {BULAN.map((b, i) => <option key={i + 1} value={i + 1}>{b}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState text="Belum ada data sales pada periode ini." />
      ) : (
        filtered.map((r) => {
          const pencapaian = r.target_omzet_bulanan > 0 ? (r.omzet_bulan / r.target_omzet_bulanan * 100) : 0;
          const expanded = expandedId === r.sales_id;
          const detail = detailCache[r.sales_id];
          return (
            <Card key={r.sales_id} style={{ marginBottom: 12, padding: 0, overflow: "hidden" }}>
              <button
                onClick={() => toggleExpand(r.sales_id)}
                style={{ width: "100%", background: "none", border: "none", padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <ChevronRight size={16} color="#9CA0A6" style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14, margin: 0, color: "#24272B" }}>{r.nama}</p>
                    <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "2px 0 0" }}>{r.jumlah_toko} toko dilayani bulan ini</p>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 10.5, color: "#9CA0A6", margin: "0 0 2px" }}>Omzet Bulan</p>
                    <p style={{ fontWeight: 700, fontSize: 14, margin: 0 }}>{rupiah(r.omzet_bulan)}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 10.5, color: "#9CA0A6", margin: "0 0 2px" }}>Pencapaian</p>
                    <p style={{ fontWeight: 700, fontSize: 14, margin: 0, color: pencapaian >= 100 ? "#28685D" : "#B8860B" }}>{pencapaian.toFixed(0)}%</p>
                  </div>
                </div>
              </button>

              {expanded && (
                <div style={{ padding: "0 16px 16px", borderTop: "1px solid #EDEAE3" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0 10px" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#6B6F75" }}>Target Omzet Bulanan:</span>
                    {editingId === r.sales_id ? (
                      <>
                        <input
                          type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus
                          style={{ width: 150, padding: "6px 8px", borderRadius: 7, border: "1.5px solid #E4E1DA", fontSize: 12.5 }}
                        />
                        <button onClick={() => saveTarget(r.sales_id)} disabled={saving} style={{ padding: "6px 10px", borderRadius: 7, border: "none", background: "#E8A426", color: "#24272B", fontSize: 11.5, fontWeight: 700 }}>Simpan</button>
                        <button onClick={() => setEditingId(null)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontSize: 11.5 }}>Batal</button>
                      </>
                    ) : (
                      <button onClick={() => startEdit(r)} style={{ background: "none", border: "none", padding: 0, color: "#24272B", fontSize: 13, fontWeight: 700, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}>
                        {rupiah(r.target_omzet_bulanan)}
                      </button>
                    )}
                  </div>

                  {!detail || detail.loading ? (
                    <p style={{ fontSize: 12.5, color: "#9CA0A6", padding: "8px 0" }}>Memuat rata-rata omzet...</p>
                  ) : detail.error ? (
                    <p style={{ fontSize: 12.5, color: "#C0392B", padding: "8px 0" }}>Gagal memuat: {detail.error}</p>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                      <MiniStat label="Rata-rata / Hari" value={rupiah(detail.rataHari)} />
                      <MiniStat label="Rata-rata / Minggu" value={rupiah(detail.rataMinggu)} />
                      <MiniStat label="Rata-rata / Bulan" value={rupiah(detail.rataBulan)} />
                      <MiniStat label="Rata-rata / Tahun" value={rupiah(detail.rataTahun)} />
                    </div>
                  )}
                  <p style={{ fontSize: 10.5, color: "#B5B2AA", margin: "10px 0 0" }}>*Dihitung dari rata-rata di periode sales ini aktif berjualan (all-time), bukan cuma bulan yang difilter di atas.</p>
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}

// ============================================================
// FORMAT NOTA (khusus Owner)
// ============================================================
function FormatNotaPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [id, setId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, "nota_settings?select=*&limit=1");
      if (rows[0]) { setForm(rows[0]); setId(rows[0].id); }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await supabaseFetch(token, `nota_settings?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          nama_perusahaan: form.nama_perusahaan,
          alamat_perusahaan: form.alamat_perusahaan,
          telp_perusahaan: form.telp_perusahaan,
          teks_subjudul_nota: form.teks_subjudul_nota,
          teks_subjudul_surat_jalan: form.teks_subjudul_surat_jalan,
          teks_footer_nota: form.teks_footer_nota,
          catatan_tambahan: form.catatan_tambahan,
          label_ttd_kiri: form.label_ttd_kiri,
          label_ttd_kanan: form.label_ttd_kanan,
          updated_at: new Date().toISOString(),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(e.message); }
    setSaving(false);
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const fieldStyle = { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, outline: "none" };
  const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" };

  if (loading) return <LoadingState />;
  if (error && !form) return <ErrorBox error={error} onRetry={load} />;
  if (!form) return <EmptyState text="Pengaturan format belum ada." />;

  return (
    <div>
      <PageHeader title="Format Nota" subtitle="Perubahan di sini otomatis dipakai semua orang saat cetak Nota & Surat Jalan" />

      <Card style={{ maxWidth: 560 }}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Nama Perusahaan</label>
          <input value={form.nama_perusahaan} onChange={set("nama_perusahaan")} style={fieldStyle} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Alamat Perusahaan (opsional)</label>
          <input value={form.alamat_perusahaan || ""} onChange={set("alamat_perusahaan")} placeholder="Jl. Contoh No. 1, Kota" style={fieldStyle} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Telepon Perusahaan (opsional)</label>
          <input value={form.telp_perusahaan || ""} onChange={set("telp_perusahaan")} placeholder="0761-xxxxxx" style={fieldStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Subjudul di Nota</label>
            <input value={form.teks_subjudul_nota} onChange={set("teks_subjudul_nota")} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Subjudul di Surat Jalan</label>
            <input value={form.teks_subjudul_surat_jalan} onChange={set("teks_subjudul_surat_jalan")} style={fieldStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Teks Penutup di Nota</label>
          <input value={form.teks_footer_nota} onChange={set("teks_footer_nota")} style={fieldStyle} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Catatan / Info Rekening (tampil di atas tanda tangan, boleh beberapa baris)</label>
          <textarea value={form.catatan_tambahan || ""} onChange={set("catatan_tambahan")} rows={4} placeholder={"NOTE: Semua Pembayaran hanya ke rekening perusahaan\nBANK: BCA\nA/N: PT Nama Perusahaan Anda\nNO REKENING: 000000"} style={{ ...fieldStyle, resize: "vertical" }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Label Tanda Tangan Kiri</label>
            <input value={form.label_ttd_kiri || ""} onChange={set("label_ttd_kiri")} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Label Tanda Tangan Kanan</label>
            <input value={form.label_ttd_kanan || ""} onChange={set("label_ttd_kanan")} style={fieldStyle} />
          </div>
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBEAEA", color: "#C0392B", padding: 10, borderRadius: 9, fontSize: 12.5, marginBottom: 14 }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}
        {saved && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#D8E9E6", color: "#28685D", padding: 10, borderRadius: 9, fontSize: 12.5, marginBottom: 14, fontWeight: 600 }}>
            <Check size={14} /> Tersimpan. Format baru langsung berlaku untuk semua orang.
          </div>
        )}

        <button
          onClick={save} disabled={saving}
          style={{ padding: "11px 22px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}
        >
          {saving ? "Menyimpan..." : "Simpan Format"}
        </button>
      </Card>
    </div>
  );
}

// ============================================================
// RIWAYAT ORDER
// ============================================================
function RiwayatOrderPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(0); // 0 = semua bulan

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(
        token,
        "orders?select=*,clients(nama,kode),order_items(qty,subtotal_setelah_diskon)&status=in.(dikirim,selesai,ditolak)&order=created_at.desc&limit=500"
      );
      setOrders(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const BULAN = ["Semua Bulan", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  const yearsAvailable = Array.from(new Set(orders.map((o) => new Date(o.created_at).getFullYear()))).sort((a, b) => b - a);
  if (yearsAvailable.length === 0) yearsAvailable.push(now.getFullYear());
  if (!yearsAvailable.includes(Number(filterYear))) yearsAvailable.unshift(Number(filterYear));

  const filtered = orders.filter((o) => {
    const d = new Date(o.created_at);
    if (d.getFullYear() !== Number(filterYear)) return false;
    if (filterMonth !== 0 && d.getMonth() + 1 !== Number(filterMonth)) return false;
    return true;
  });

  function orderTotal(o) {
    return (o.order_items || []).reduce((sum, it) => sum + Number(it.subtotal_setelah_diskon || 0), 0);
  }

  function statusInfo(status) {
    if (status === "dikirim") return { label: "Terkirim", bg: "#D8E9E6", fg: "#28685D" };
    if (status === "selesai") return { label: "Selesai", bg: "#EFE1BE", fg: "#8A6A1A" };
    return { label: "Ditolak", bg: "#FBEAEA", fg: "#C0392B" };
  }

  function exportCSV() {
    const header = ["No Nota", "Tanggal", "Kode Toko", "Nama Toko", "Status", "Channel", "Dropship", "Total"];
    const rows = filtered.map((o) => [
      o.no_nota,
      new Date(o.created_at).toLocaleDateString("id-ID"),
      o.clients?.kode || "",
      o.clients?.nama || "",
      statusInfo(o.status).label,
      o.channel,
      o.is_dropship ? "Ya" : "Tidak",
      orderTotal(o),
    ]);
    const csvContent = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `riwayat-order-${filterYear}${filterMonth ? "-" + String(filterMonth).padStart(2, "0") : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Riwayat Order" subtitle="Pesanan yang sudah terkirim, selesai, atau ditolak" />

      <div style={{ display: "flex", gap: 10, marginBottom: 18, alignItems: "center" }}>
        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, background: "#fff" }}>
          {yearsAvailable.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, background: "#fff" }}>
          {BULAN.map((b, i) => <option key={i} value={i}>{b}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "none", background: "#24272B", color: "#fff", fontSize: 13, fontWeight: 700 }}
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["No Nota", "Tanggal", "Toko", "Status", "Channel", "Total"].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => {
              const st = statusInfo(o.status);
              return (
                <tr key={o.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 700 }}>{o.no_nota}</td>
                  <td style={{ padding: "12px 14px" }}>{new Date(o.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td style={{ padding: "12px 14px" }}>{o.clients?.nama} ({o.clients?.kode})</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: st.bg, color: st.fg, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                      {o.alasan_dibatalkan ? <Clock size={11} /> : <Check size={11} />} {o.alasan_dibatalkan ? "Dibatalkan (Kadaluarsa)" : st.label}
                    </span>
                    {o.alasan_dibatalkan && (
                      <p style={{ fontSize: 10, color: "#9CA0A6", margin: "4px 0 0" }}>{o.alasan_dibatalkan}</p>
                    )}
                  </td>
                  <td style={{ padding: "12px 14px", textTransform: "capitalize" }}>{o.channel}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 700 }}>{rupiah(orderTotal(o))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState text="Tidak ada order pada periode ini." />}
      </Card>
    </div>
  );
}

// ============================================================
// REKAP TOKO
// ============================================================
function RekapTokoPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [salesList, setSalesList] = useState([]);
  const [orderTerakhir, setOrderTerakhir] = useState({}); // { client_id: tanggal }
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ alamat: "", telp: "", kodeSales: "", catatan: "", namaOwner: "", tanggalLahir: "", jenisUsaha: "", provinsi: "" });
  const [saving, setSaving] = useState(false);
  const [hanyaTidakAktif, setHanyaTidakAktif] = useState(false);

  const BATAS_HARI_TIDAK_AKTIF = 30;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [clientRows, salesRows, orderRows] = await Promise.all([
        supabaseFetch(token, "clients?select=*,sales!clients_sales_id_fkey(id,kode,nama)&status=eq.aktif&order=nama.asc"),
        supabaseFetch(token, "sales?select=id,kode,nama&order=kode.asc"),
        supabaseFetch(token, "orders?select=client_id,tanggal&status=neq.ditolak&order=tanggal.desc"),
      ]);
      setClients(clientRows);
      setSalesList(salesRows);
      // Ambil tanggal order PALING BARU per toko (data sudah urut desc, jadi
      // yang pertama ketemu per client_id itu yang paling baru)
      const terakhir = {};
      orderRows.forEach((o) => {
        if (!terakhir[o.client_id]) terakhir[o.client_id] = o.tanggal;
      });
      setOrderTerakhir(terakhir);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function hariSejakOrder(clientId) {
    const tgl = orderTerakhir[clientId];
    if (!tgl) return null; // belum pernah order sama sekali
    const diffMs = Date.now() - new Date(tgl).getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  function startEdit(c) {
    setEditingId(c.id);
    setEditForm({
      alamat: c.alamat || "", telp: c.telp || "", kodeSales: c.sales?.kode || "", catatan: c.catatan_internal || "",
      namaOwner: c.nama_owner || "", tanggalLahir: c.tanggal_lahir || "", jenisUsaha: c.jenis_usaha || "", provinsi: c.provinsi || "",
    });
  }

  function matchedSales(kode) {
    return salesList.find((s) => s.kode.toUpperCase() === kode.trim().toUpperCase());
  }

  async function save(clientId) {
    const kodeSalesTrim = editForm.kodeSales.trim();
    const found = kodeSalesTrim ? matchedSales(kodeSalesTrim) : null;
    if (kodeSalesTrim && !found) {
      alert(`Kode Sales "${kodeSalesTrim}" tidak ditemukan. Cek lagi kodenya.`);
      return;
    }
    setSaving(true);
    try {
      await supabaseFetch(token, `clients?id=eq.${clientId}`, {
        method: "PATCH",
        body: JSON.stringify({
          alamat: editForm.alamat,
          telp: editForm.telp,
          sales_id: found ? found.id : null,
          catatan_internal: editForm.catatan || null,
          nama_owner: editForm.namaOwner || null,
          tanggal_lahir: editForm.tanggalLahir || null,
          jenis_usaha: editForm.jenisUsaha || null,
          provinsi: editForm.provinsi || null,
        }),
      });
      setClients((prev) => prev.map((c) => (
        c.id === clientId
          ? {
              ...c, alamat: editForm.alamat, telp: editForm.telp, catatan_internal: editForm.catatan,
              nama_owner: editForm.namaOwner, tanggal_lahir: editForm.tanggalLahir, jenis_usaha: editForm.jenisUsaha, provinsi: editForm.provinsi,
              sales: found ? { id: found.id, kode: found.kode, nama: found.nama } : null,
            }
          : c
      )));
      setEditingId(null);
    } catch (e) {
      alert("Gagal simpan: " + e.message);
    }
    setSaving(false);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <PageHeader title="Rekap Toko" subtitle="Klik ikon edit untuk ubah Alamat, No HP, Kode Sales, atau Catatan" />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: "#24272B", cursor: "pointer", flexShrink: 0, marginTop: 4 }}>
          <input type="checkbox" checked={hanyaTidakAktif} onChange={(e) => setHanyaTidakAktif(e.target.checked)} />
          Tampilkan yang tidak aktif saja ({">"}{BATAS_HARI_TIDAK_AKTIF} hari)
        </label>
      </div>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Nama Toko", "Alamat", "No HP", "Email", "Kode Sales", "Nama Sales", "Terakhir Order", "Catatan", ""].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients
              .filter((c) => {
                if (!hanyaTidakAktif) return true;
                const hari = hariSejakOrder(c.id);
                return hari === null || hari > BATAS_HARI_TIDAK_AKTIF;
              })
              .map((c) => {
              const hari = hariSejakOrder(c.id);
              const tidakAktif = hari === null || hari > BATAS_HARI_TIDAK_AKTIF;
              return (
                <tr key={c.id} style={{ borderTop: "1px solid #EDEAE3", background: tidakAktif ? "#FFFBF0" : "transparent" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 600 }}>{c.nama} <span style={{ color: "#9CA0A6", fontWeight: 400 }}>({c.kode})</span></td>
                  <td style={{ padding: "12px 14px", minWidth: 180 }}>{c.alamat}</td>
                  <td style={{ padding: "12px 14px", minWidth: 130 }}>{c.telp}</td>
                  <td style={{ padding: "12px 14px", color: "#6B6F75" }}>{c.email || "-"}</td>
                  <td style={{ padding: "12px 14px" }}>{c.sales?.kode || "-"}</td>
                  <td style={{ padding: "12px 14px" }}>{c.sales?.nama || "-"}</td>
                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                    {hari === null ? (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#F7F5F1", color: "#9CA0A6" }}>Belum pernah order</span>
                    ) : tidakAktif ? (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#FBEAEA", color: "#C0392B" }}>{hari} hari lalu</span>
                    ) : (
                      <span style={{ color: "#6B6F75" }}>{hari} hari lalu</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 14px", minWidth: 160, maxWidth: 220 }}>
                    <span style={{ color: c.catatan_internal ? "#24272B" : "#B5B2AA", fontSize: 12 }}>{c.catatan_internal || "-"}</span>
                  </td>
                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                    <button onClick={() => startEdit(c)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 11.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                      <FileEdit size={12} /> Edit
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {clients.length === 0 && <EmptyState text="Belum ada toko aktif." />}
      </Card>

      {editingId && (() => {
        const c = clients.find((x) => x.id === editingId);
        if (!c) return null;
        const previewMatch = editForm.kodeSales.trim() ? matchedSales(editForm.kodeSales) : null;
        const fieldStyle = { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, outline: "none" };
        const labelStyle = { fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" };
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
            <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto", padding: 26 }}>
              <h2 className="disp" style={{ fontSize: 19, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>Edit Toko</h2>
              <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 20px" }}>{c.nama} ({c.kode})</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Nama Owner</label>
                  <input value={editForm.namaOwner} onChange={(e) => setEditForm({ ...editForm, namaOwner: e.target.value })} style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Tanggal Lahir</label>
                  <input type="date" value={editForm.tanggalLahir} onChange={(e) => setEditForm({ ...editForm, tanggalLahir: e.target.value })} style={fieldStyle} />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Jenis Usaha</label>
                <input value={editForm.jenisUsaha} onChange={(e) => setEditForm({ ...editForm, jenisUsaha: e.target.value })} placeholder="misal Toko Bangunan" style={fieldStyle} />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Alamat</label>
                <input value={editForm.alamat} onChange={(e) => setEditForm({ ...editForm, alamat: e.target.value })} style={fieldStyle} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>No. HP</label>
                  <input value={editForm.telp} onChange={(e) => setEditForm({ ...editForm, telp: e.target.value })} style={fieldStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Provinsi</label>
                  <input value={editForm.provinsi} onChange={(e) => setEditForm({ ...editForm, provinsi: e.target.value })} style={fieldStyle} />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Kode Sales</label>
                <input value={editForm.kodeSales} onChange={(e) => setEditForm({ ...editForm, kodeSales: e.target.value })} placeholder="misal S001" style={fieldStyle} />
                <p style={{ fontSize: 11.5, marginTop: 6, fontStyle: "italic", color: editForm.kodeSales.trim() && !previewMatch ? "#C0392B" : "#28685D", fontWeight: 600 }}>
                  {editForm.kodeSales.trim() ? (previewMatch ? previewMatch.nama : "Kode tidak ditemukan") : "-"}
                </p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Catatan Internal</label>
                <textarea value={editForm.catatan} onChange={(e) => setEditForm({ ...editForm, catatan: e.target.value })} rows={3} placeholder="Catatan bebas..." style={{ ...fieldStyle, resize: "vertical" }} />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
                  Batal
                </button>
                <button onClick={() => save(editingId)} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: saving ? "#E4E1DA" : "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}>
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ============================================================
// STOCK ITEM (khusus Owner)
// ============================================================
function StockItemPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [products, stock] = await Promise.all([
        supabaseFetch(token, "products?select=id,kode,nama,kategori,satuan,harga_modal&aktif=eq.true&order=kode.asc"),
        supabaseFetch(token, "v_stock_akhir?select=product_id,stock_akhir"),
      ]);
      const stockMap = {};
      stock.forEach((s) => { stockMap[s.product_id] = s.stock_akhir; });
      const merged = products.map((p) => {
        const stockAkhir = stockMap[p.id] ?? 0;
        const hargaModal = Number(p.harga_modal || 0);
        return { ...p, stock_akhir: stockAkhir, total_modal: stockAkhir * hargaModal };
      });
      setRows(merged);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const grandTotal = rows.reduce((sum, r) => sum + r.total_modal, 0);

  return (
    <div>
      <PageHeader title="Stock Item" subtitle="Nilai modal barang berdasarkan stock akhir - data rahasia, hanya Owner" />

      <Card style={{ marginBottom: 16, display: "inline-block" }}>
        <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Total Modal Seluruh Stock</p>
        <p className="disp" style={{ fontSize: 26, fontWeight: 700, color: "#24272B", margin: 0 }}>{rupiah(grandTotal)}</p>
      </Card>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Kode", "Nama Barang", "Kategori", "Satuan", "Stock", "Harga Modal", "Total Modal"].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                <td style={{ padding: "12px 14px", fontWeight: 700 }}>{r.kode}</td>
                <td style={{ padding: "12px 14px" }}>{r.nama}</td>
                <td style={{ padding: "12px 14px", color: "#6B6F75" }}>{r.kategori}</td>
                <td style={{ padding: "12px 14px", color: "#6B6F75" }}>{r.satuan}</td>
                <td style={{ padding: "12px 14px", fontWeight: 600, color: r.stock_akhir < 0 ? "#C0392B" : "#24272B" }}>
                  {r.stock_akhir}{r.stock_akhir < 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#C0392B" }}>MINUS!</span>}
                </td>
                <td style={{ padding: "12px 14px" }}>{rupiah(r.harga_modal)}</td>
                <td style={{ padding: "12px 14px", fontWeight: 700 }}>{rupiah(r.total_modal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState text="Belum ada data barang." />}
      </Card>
    </div>
  );
}

// ============================================================
// INBOUND (khusus Owner) - catat stock barang masuk
// ============================================================
function InboundPage({ token }) {
  const today = new Date().toISOString().slice(0, 10);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ productId: "", qty: "", tanggal: today, keterangan: "" });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [productRows, historyRows] = await Promise.all([
        supabaseFetch(token, "products?select=id,kode,nama,satuan&aktif=eq.true&order=kode.asc"),
        supabaseFetch(token, "stock_movements?select=*,products(kode,nama,satuan)&jenis=eq.masuk&order=created_at.desc&limit=30"),
      ]);
      setProducts(productRows);
      setHistory(historyRows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function submit() {
    if (!form.productId || !form.qty || Number(form.qty) <= 0) {
      alert("Pilih barang dan isi qty yang benar dulu.");
      return;
    }
    setSaving(true);
    setSaveMsg("");
    try {
      const [inserted] = await supabaseFetch(token, "stock_movements", {
        method: "POST",
        body: JSON.stringify({
          product_id: form.productId,
          tanggal: form.tanggal,
          jenis: "masuk",
          qty: Number(form.qty),
          keterangan: form.keterangan || null,
        }),
      });
      const prod = products.find((p) => p.id === form.productId);
      setHistory((prev) => [{ ...inserted, products: prod }, ...prev]);
      setForm({ productId: "", qty: "", tanggal: today, keterangan: "" });
      setSaveMsg("Stock masuk berhasil dicatat.");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e) {
      alert("Gagal simpan: " + e.message);
    }
    setSaving(false);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const fieldStyle = { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, outline: "none" };
  const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" };

  return (
    <div>
      <PageHeader title="Inbound" subtitle="Catat barang yang baru masuk / restock" />

      <Card style={{ maxWidth: 520, marginBottom: 24 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Pilih Barang</label>
          <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} style={fieldStyle}>
            <option value="">-- Pilih barang --</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.kode} - {p.nama}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Qty Masuk</label>
            <input type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} placeholder="0" style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Tanggal</label>
            <input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} style={fieldStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Keterangan (opsional)</label>
          <input value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} placeholder="Misal: Kiriman dari supplier X" style={fieldStyle} />
        </div>
        {saveMsg && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#D8E9E6", color: "#28685D", padding: 10, borderRadius: 9, fontSize: 12.5, marginBottom: 14, fontWeight: 600 }}>
            <Check size={14} /> {saveMsg}
          </div>
        )}
        <button onClick={submit} disabled={saving} style={{ padding: "11px 22px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}>
          <PackagePlus size={16} /> {saving ? "Menyimpan..." : "Catat Stock Masuk"}
        </button>
      </Card>

      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>Riwayat Inbound Terakhir</h2>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Tanggal", "Barang", "Qty", "Keterangan"].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                <td style={{ padding: "12px 14px" }}>{new Date(h.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                <td style={{ padding: "12px 14px", fontWeight: 600 }}>{h.products?.kode} - {h.products?.nama}</td>
                <td style={{ padding: "12px 14px", fontWeight: 700, color: "#28685D" }}>+{h.qty} {h.products?.satuan}</td>
                <td style={{ padding: "12px 14px", color: "#6B6F75" }}>{h.keterangan || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {history.length === 0 && <EmptyState text="Belum ada riwayat stock masuk." />}
      </Card>
    </div>
  );
}

// ============================================================
// REKAP NOTA (Lunas / Tempo / Cashback)
// ============================================================
function RekapNotaPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(0); // 0 = semua bulan
  const [filterStatus, setFilterStatus] = useState("semua");
  const [processingId, setProcessingId] = useState(null);
  const [printingOrder, setPrintingOrder] = useState(null);
  const [printingType, setPrintingType] = useState("nota");
  const [notaSettings, setNotaSettings] = useState(null);

  useEffect(() => {
    supabaseFetch(token, "nota_settings?select=*&limit=1")
      .then((rows) => setNotaSettings(rows[0] || null))
      .catch(() => setNotaSettings(null));
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(
        token,
        "orders?select=id,no_nota,created_at,jatuh_tempo,status,status_bayar,metode_bayar,is_dropship,nama_pengirim_dropship,tujuan_nama,tujuan_telp,tujuan_alamat,diskon_tambahan_jenis,diskon_tambahan_nilai,diskon_tambahan_keterangan,clients(nama,kode,alamat,telp,jenis_pembayaran),order_items(*,products(kode,nama,satuan)),cashback_ledger(id,nilai_cashback,status)&order=created_at.desc&limit=500"
      );
      setOrders(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openPrint(order, type) {
    setPrintingOrder(order);
    setPrintingType(type);
  }

  async function confirmNotaSiap(orderId) {
    setProcessingId(orderId);
    try {
      await supabaseFetch(token, `orders?id=eq.${orderId}`, { method: "PATCH", body: JSON.stringify({ status: "menunggu_pengiriman" }) });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "menunggu_pengiriman" } : o)));
    } catch (e) { alert("Gagal update: " + e.message); }
    setProcessingId(null);
  }

  const BULAN = ["Semua Bulan", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const yearsAvailable = Array.from(new Set(orders.map((o) => new Date(o.created_at).getFullYear()))).sort((a, b) => b - a);
  if (yearsAvailable.length === 0) yearsAvailable.push(now.getFullYear());
  if (!yearsAvailable.includes(Number(filterYear))) yearsAvailable.unshift(Number(filterYear));

  function orderTotal(o) {
    const sebelum = (o.order_items || []).reduce((sum, it) => sum + Number(it.subtotal_setelah_diskon || 0), 0);
    const nilai = Number(o.diskon_tambahan_nilai || 0);
    const potongan = o.diskon_tambahan_jenis === "persen" ? sebelum * (nilai / 100) : nilai;
    return Math.max(0, sebelum - potongan);
  }

  // Status perjalanan pesanan - satu label yang mewakili semua tahap
  function statusPerjalanan(o) {
    if (o.status === "ditolak") return { label: "Ditolak", bg: "#FBEAEA", fg: "#C0392B" };
    if (o.status === "menunggu_persetujuan") return { label: "Menunggu Pengecekan Stock", bg: "#F7F5F1", fg: "#6B6F75" };
    // COD tidak perlu tunggu bukti transfer/VA - begitu masuk tahap ini,
    // langsung dianggap siap lanjut kirim (uangnya diterima pas barang sampai)
    if (o.metode_bayar === "cod" && o.status === "menunggu_pembayaran") return { label: "COD - Siap Kirim", bg: "#FBF0D9", fg: "#8A6A1A" };
    if (o.status === "menunggu_pembayaran" && o.status_bayar !== "lunas") return { label: "Menunggu Pembayaran", bg: "#FBEAEA", fg: "#C0392B" };
    if (o.status === "menunggu_pembayaran" && o.status_bayar === "lunas") return { label: "Bisa Cetak Nota", bg: "#FBF0D9", fg: "#8A6A1A" };
    if (o.status === "menunggu_pengiriman") return { label: "Menunggu Pengiriman", bg: "#D8E9E6", fg: "#28685D" };
    if (o.status === "proses_dikirim" || o.status === "dikirim") return { label: "Proses Dikirim", bg: "#D8E9E6", fg: "#28685D" };
    if (o.status === "selesai") return { label: "Telah Diselesaikan", bg: "#EFE1BE", fg: "#8A6A1A" };
    return { label: o.status, bg: "#F7F5F1", fg: "#6B6F75" };
  }

  const filtered = orders.filter((o) => {
    const d = new Date(o.created_at);
    if (d.getFullYear() !== Number(filterYear)) return false;
    if (filterMonth !== 0 && d.getMonth() + 1 !== Number(filterMonth)) return false;
    if (filterStatus !== "semua" && o.status !== filterStatus) return false;
    return true;
  });

  const totalCashbackBelumDibayar = filtered.reduce((s, o) => {
    const cb = o.cashback_ledger?.[0];
    return s + (cb && cb.status === "belum_dibayar" ? Number(cb.nilai_cashback) : 0);
  }, 0);
  const totalOmzet = filtered.filter((o) => o.status !== "ditolak").reduce((s, o) => s + orderTotal(o), 0);
  const totalSelesai = filtered.filter((o) => o.status === "selesai").reduce((s, o) => s + orderTotal(o), 0);

  async function tandaiCashbackDibayar(orderId, cashbackId) {
    setProcessingId(orderId);
    try {
      await supabaseFetch(token, `cashback_ledger?id=eq.${cashbackId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "sudah_dibayar", tanggal_dibayar: new Date().toISOString().slice(0, 10) }),
      });
      setOrders((prev) => prev.map((o) => (
        o.id === orderId ? { ...o, cashback_ledger: o.cashback_ledger.map((c) => (c.id === cashbackId ? { ...c, status: "sudah_dibayar" } : c)) } : o
      )));
    } catch (e) { alert("Gagal update: " + e.message); }
    setProcessingId(null);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Rekap Nota" subtitle="Status perjalanan tiap nota, dari pengecekan stock sampai selesai" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
        <StatCard label="Total Omzet (sesuai filter)" value={rupiah(totalOmzet)} color="#24272B" bg="#F7F5F1" small />
        <StatCard label="Telah Diselesaikan" value={rupiah(totalSelesai)} color="#28685D" bg="#D8E9E6" small />
        <StatCard label="Cashback Belum Dibayar" value={rupiah(totalCashbackBelumDibayar)} color="#B8860B" bg="#FBF0D9" small />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, background: "#fff" }}>
          {yearsAvailable.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, background: "#fff" }}>
          {BULAN.map((b, i) => <option key={i} value={i}>{b}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, background: "#fff" }}>
          <option value="semua">Semua Status</option>
          <option value="menunggu_persetujuan">Menunggu Pengecekan Stock</option>
          <option value="menunggu_pembayaran">Menunggu Pembayaran / Bisa Cetak</option>
          <option value="menunggu_pengiriman">Menunggu Pengiriman</option>
          <option value="proses_dikirim">Proses Dikirim</option>
          <option value="selesai">Telah Diselesaikan</option>
          <option value="ditolak">Ditolak</option>
        </select>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["No Nota", "Toko", "Jenis Bayar", "Jatuh Tempo", "Status", "Total", "Cashback", ""].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => {
              const cb = o.cashback_ledger?.[0];
              const st = statusPerjalanan(o);
              return (
                <tr key={o.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 700 }}>{o.no_nota}</td>
                  <td style={{ padding: "12px 14px" }}>{o.clients?.nama}</td>
                  <td style={{ padding: "12px 14px" }}>{o.metode_bayar === "cod" ? "COD" : o.clients?.jenis_pembayaran}</td>
                  <td style={{ padding: "12px 14px" }}>{o.jatuh_tempo ? new Date(o.jatuh_tempo).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-"}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ background: st.bg, color: st.fg, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                      {st.label}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", fontWeight: 700 }}>{rupiah(orderTotal(o))}</td>
                  <td style={{ padding: "12px 14px" }}>
                    {cb ? (
                      <span style={{ background: cb.status === "sudah_dibayar" ? "#D8E9E6" : "#FBF0D9", color: cb.status === "sudah_dibayar" ? "#28685D" : "#8A6A1A", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                        {rupiah(cb.nilai_cashback)} {cb.status === "sudah_dibayar" ? "(Dibayar)" : "(Belum)"}
                      </span>
                    ) : "-"}
                  </td>
                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {o.status !== "ditolak" && o.status !== "menunggu_persetujuan" && (
                        <button onClick={() => openPrint(o, "nota")} style={{ padding: "6px 10px", borderRadius: 7, border: "none", background: "#E8A426", color: "#24272B", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <Printer size={12} /> Nota
                        </button>
                      )}
                      {o.status_bayar === "lunas" && (
                        <button onClick={() => openPrint(o, "surat_jalan")} style={{ padding: "6px 10px", borderRadius: 7, border: "none", background: "#E8A426", color: "#24272B", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <Printer size={12} /> Surat Jalan
                        </button>
                      )}
                      {o.status === "menunggu_pembayaran" && o.status_bayar === "lunas" && (
                        <button disabled={processingId === o.id} onClick={() => confirmNotaSiap(o.id)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 11, fontWeight: 700 }}>
                          Konfirmasi Nota Siap
                        </button>
                      )}
                      {cb && cb.status === "belum_dibayar" && (
                        <button disabled={processingId === o.id} onClick={() => tandaiCashbackDibayar(o.id, cb.id)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 11, fontWeight: 700 }}>
                          Cashback Dibayar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <EmptyState text="Tidak ada nota pada periode/filter ini." />}
      </Card>

      {printingOrder && <NotaPrintModal order={printingOrder} type={printingType} settings={notaSettings} onClose={() => setPrintingOrder(null)} />}
    </div>
  );
}

// ============================================================
// KONFIRMASI PEMBAYARAN
// ============================================================
function KonfirmasiPembayaranPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      // Ambil order yang PERNAH masuk tahap ini: masih menunggu_pembayaran ATAU
      // status_bayar sudah lunas (walau sekarang sudah lanjut ke tahap manapun) -
      // supaya ada riwayat permanen, tidak hilang begitu pindah tahap berikutnya.
      const rows = await supabaseFetch(token, "orders?select=id,no_nota,status,status_bayar,bukti_transfer_url,clients(nama,kode,jenis_pembayaran),order_items(subtotal_setelah_diskon)&or=(status.eq.menunggu_pembayaran,status_bayar.eq.lunas)&order=created_at.desc&limit=200");
      setOrders(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function confirmPayment(orderId) {
    setProcessingId(orderId);
    try {
      // Konfirmasi pembayaran HARUS sekaligus memajukan tahap order ke
      // "menunggu_pengiriman" - dulu cuma update status_bayar saja, jadi
      // order-nya "macet" di tahap menunggu_pembayaran walau sudah dibayar.
      await supabaseFetch(token, `orders?id=eq.${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ status_bayar: "lunas", status: "menunggu_pengiriman" }),
      });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status_bayar: "lunas", status: "menunggu_pengiriman" } : o)));
    } catch (e) { alert("Gagal update: " + e.message); }
    setProcessingId(null);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const menunggu = orders.filter((o) => o.status === "menunggu_pembayaran" && o.status_bayar !== "lunas");
  const riwayat = orders.filter((o) => o.status_bayar === "lunas");

  function renderCard(o) {
    const isLunas = o.status_bayar === "lunas";
    const hasProof = !!o.bukti_transfer_url;
    const total = (o.order_items || []).reduce((sum, it) => sum + Number(it.subtotal_setelah_diskon || 0), 0);
    return (
      <Card key={o.id} style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: isLunas ? 0 : 12 }}>
          <div>
            <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{o.no_nota}</p>
            <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>{o.clients?.nama} ({o.clients?.kode}) · {o.clients?.jenis_pembayaran}</p>
            <p className="disp" style={{ fontSize: 16, fontWeight: 700, color: "#24272B", margin: "4px 0 0" }}>{rupiah(total)}</p>
          </div>
          {isLunas ? (
            <span style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 9, background: "#D8E9E6", color: "#28685D", fontSize: 12.5, fontWeight: 700 }}>
              <Check size={14} /> Pembayaran Diterima
            </span>
          ) : hasProof ? (
            <a href={o.bukti_transfer_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#B8860B", fontWeight: 700, textDecoration: "underline" }}>
              Lihat Bukti Transfer
            </a>
          ) : (
            <span style={{ fontSize: 12, color: "#9CA0A6", fontStyle: "italic" }}>Menunggu bukti transfer</span>
          )}
        </div>

        {!isLunas && (
          <button
            disabled={processingId === o.id || !hasProof}
            onClick={() => confirmPayment(o.id)}
            style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: hasProof ? "#E8A426" : "#E4E1DA", color: hasProof ? "#24272B" : "#9CA0A6", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}
          >
            <Check size={14} /> Pembayaran Diterima
          </button>
        )}
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Konfirmasi Pembayaran" subtitle={`${menunggu.length} pesanan menunggu konfirmasi pembayaran`} />
      {menunggu.length === 0 ? (
        <EmptyState text="Tidak ada pesanan yang perlu diproses saat ini." />
      ) : (
        menunggu.map(renderCard)
      )}

      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "28px 0 12px" }}>Riwayat</h2>
      {riwayat.length === 0 ? (
        <EmptyState text="Belum ada riwayat pembayaran yang dikonfirmasi." />
      ) : (
        riwayat.map(renderCard)
      )}
    </div>
  );
}

// ============================================================
// PROSES PENGIRIMAN
// ============================================================
function ProsesPengirimanPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, "orders?select=*,clients(nama,kode)&status=in.(menunggu_pengiriman,proses_dikirim)&order=created_at.asc");
      setOrders(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function uploadBuktiPengiriman(order, file) {
    setUploadingId(order.id);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${order.id}-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/bukti-pengiriman/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error(await res.text());
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/bukti-pengiriman/${filePath}`;
      await supabaseFetch(token, `orders?id=eq.${order.id}`, { method: "PATCH", body: JSON.stringify({ bukti_pengiriman_url: publicUrl }) });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, bukti_pengiriman_url: publicUrl } : o)));
    } catch (e) {
      alert("Gagal upload: " + e.message);
    }
    setUploadingId(null);
  }

  async function confirmProsesDikirim(orderId) {
    setProcessingId(orderId);
    try {
      const now = new Date().toISOString();
      await supabaseFetch(token, `orders?id=eq.${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "proses_dikirim", tanggal_dikirim: now }),
      });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "proses_dikirim", tanggal_dikirim: now } : o)));
    } catch (e) { alert("Gagal update: " + e.message); }
    setProcessingId(null);
  }

  async function confirmTelahSampai(orderId) {
    setProcessingId(orderId);
    try {
      await supabaseFetch(token, `orders?id=eq.${orderId}`, { method: "PATCH", body: JSON.stringify({ status: "selesai" }) });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (e) { alert("Gagal update: " + e.message); }
    setProcessingId(null);
  }

  function daysSince(dateStr) {
    if (!dateStr) return 0;
    return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Proses Pengiriman" subtitle={`${orders.length} pesanan dalam proses pengiriman`} />
      {orders.length === 0 ? (
        <EmptyState text="Tidak ada pesanan dalam proses pengiriman saat ini." />
      ) : (
        orders.map((o) => {
          const isDikirim = o.status === "proses_dikirim";
          const hasProofKirim = !!o.bukti_pengiriman_url;
          const elapsedDays = daysSince(o.tanggal_dikirim);
          const canConfirmArrived = elapsedDays >= 3;
          return (
            <Card key={o.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{o.no_nota}</p>
                  <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>{o.clients?.nama} ({o.clients?.kode})</p>
                  {isDikirim && (
                    <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "4px 0 0" }}>
                      Dikirim {Math.floor(elapsedDays)} hari lalu {!canConfirmArrived && `- tunggu ${Math.ceil(3 - elapsedDays)} hari lagi untuk konfirmasi sampai`}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {!isDikirim ? (
                    <>
                      {hasProofKirim ? (
                        <a href={o.bukti_pengiriman_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#28685D", fontWeight: 700, textDecoration: "underline", marginRight: 4 }}>
                          Lihat Bukti Pengiriman
                        </a>
                      ) : (
                        <label style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 9, border: "1.5px dashed #E8A426", background: "#FFFBF0", color: "#8A6A1A", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                          {uploadingId === o.id ? "Mengupload..." : <><UploadCloud size={14} /> Upload Bukti Pengiriman</>}
                          <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingId === o.id} onChange={(e) => { if (e.target.files[0]) uploadBuktiPengiriman(o, e.target.files[0]); }} />
                        </label>
                      )}
                      <button
                        disabled={processingId === o.id || !hasProofKirim}
                        onClick={() => confirmProsesDikirim(o.id)}
                        style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: hasProofKirim ? "#E8A426" : "#E4E1DA", color: hasProofKirim ? "#24272B" : "#9CA0A6", fontSize: 12.5, fontWeight: 700 }}
                      >
                        Konfirmasi Proses Dikirim
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 9, background: "#D8E9E6", color: "#28685D", fontSize: 12.5, fontWeight: 700 }}>
                        <Truck size={14} /> Proses Dikirim
                      </span>
                      <button
                        disabled={processingId === o.id || !canConfirmArrived}
                        onClick={() => confirmTelahSampai(o.id)}
                        style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: canConfirmArrived ? "#E8A426" : "#E4E1DA", color: canConfirmArrived ? "#24272B" : "#9CA0A6", fontSize: 12.5, fontWeight: 700 }}
                      >
                        Telah Sampai
                      </button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}

// ============================================================
// TRANSAKSI (detail per item barang)
// ============================================================
function TransaksiPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(0); // 0 = semua bulan
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(
        token,
        "orders?select=no_nota,created_at,clients(nama,kode),order_items(qty,harga_satuan,harga_dropship,subtotal_setelah_diskon,products(kode,nama,satuan))&status=neq.ditolak&status=neq.menunggu_persetujuan&order=created_at.desc&limit=500"
      );
      setOrders(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const BULAN = ["Semua Bulan", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const yearsAvailable = Array.from(new Set(orders.map((o) => new Date(o.created_at).getFullYear()))).sort((a, b) => b - a);
  if (yearsAvailable.length === 0) yearsAvailable.push(now.getFullYear());
  if (!yearsAvailable.includes(Number(filterYear))) yearsAvailable.unshift(Number(filterYear));

  // Ratakan jadi 1 baris per item barang (bukan per order)
  const rows = [];
  orders.forEach((o) => {
    const d = new Date(o.created_at);
    if (d.getFullYear() !== Number(filterYear)) return;
    if (filterMonth !== 0 && d.getMonth() + 1 !== Number(filterMonth)) return;
    (o.order_items || []).forEach((it) => {
      if (search && !it.products?.nama?.toLowerCase().includes(search.toLowerCase()) && !it.products?.kode?.toLowerCase().includes(search.toLowerCase())) return;
      const hargaSatuan = Number(it.harga_dropship || it.harga_satuan);
      const subSebelum = hargaSatuan * it.qty;
      const subSesudah = Number(it.subtotal_setelah_diskon || 0);
      const diskonPct = subSebelum > 0 ? Math.round((1 - subSesudah / subSebelum) * 100) : 0;
      rows.push({
        noNota: o.no_nota, tanggal: o.created_at, toko: o.clients?.nama, kodeToko: o.clients?.kode,
        kodeBarang: it.products?.kode, namaBarang: it.products?.nama, satuan: it.products?.satuan,
        qty: it.qty, hargaSatuan, diskonPct, subtotal: subSesudah,
      });
    });
  });

  const totalSubtotal = rows.reduce((s, r) => s + r.subtotal, 0);

  function exportCSV() {
    const header = ["No Nota", "Tanggal", "Kode Toko", "Nama Toko", "Kode Barang", "Nama Barang", "Qty", "Satuan", "Harga Satuan", "Diskon %", "Subtotal"];
    const csvRows = rows.map((r) => [
      r.noNota, new Date(r.tanggal).toLocaleDateString("id-ID"), r.kodeToko, r.toko,
      r.kodeBarang, r.namaBarang, r.qty, r.satuan, r.hargaSatuan, r.diskonPct, r.subtotal,
    ]);
    const csvContent = [header, ...csvRows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transaksi-${filterYear}${filterMonth ? "-" + String(filterMonth).padStart(2, "0") : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Transaksi" subtitle="Detail penjualan per item barang" />

      <Card style={{ marginBottom: 16, display: "inline-block" }}>
        <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Total Transaksi (sesuai filter)</p>
        <p className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: 0 }}>{rupiah(totalSubtotal)}</p>
      </Card>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, alignItems: "center" }}>
        <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, background: "#fff" }}>
          {yearsAvailable.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, background: "#fff" }}>
          {BULAN.map((b, i) => <option key={i} value={i}>{b}</option>)}
        </select>
        <input
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama/kode barang..."
          style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, width: 220 }}
        />
        <div style={{ flex: 1 }} />
        <button
          onClick={exportCSV} disabled={rows.length === 0}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "none", background: "#24272B", color: "#fff", fontSize: 13, fontWeight: 700 }}
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["No Nota", "Tanggal", "Toko", "Kode Barang", "Nama Barang", "Qty", "Harga Satuan", "Diskon", "Subtotal"].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: "1px solid #EDEAE3" }}>
                <td style={{ padding: "12px 14px", fontWeight: 700 }}>{r.noNota}</td>
                <td style={{ padding: "12px 14px" }}>{new Date(r.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                <td style={{ padding: "12px 14px" }}>{r.toko} ({r.kodeToko})</td>
                <td style={{ padding: "12px 14px" }}>{r.kodeBarang}</td>
                <td style={{ padding: "12px 14px" }}>{r.namaBarang}</td>
                <td style={{ padding: "12px 14px" }}>{r.qty} {r.satuan}</td>
                <td style={{ padding: "12px 14px" }}>{rupiah(r.hargaSatuan)}</td>
                <td style={{ padding: "12px 14px" }}>{r.diskonPct}%</td>
                <td style={{ padding: "12px 14px", fontWeight: 700 }}>{rupiah(r.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState text="Tidak ada transaksi pada periode/filter ini." />}
      </Card>
    </div>
  );
}

// ============================================================
// CASHBACK (khusus Owner) - atur aturan cashback
// ============================================================
function CashbackPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState([]);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    jenisRule: "nominal_bulanan",
    minimalOmzetBulan: "", productId: "", minimalQty: "",
    jenisCashback: "persen", nilaiCashback: "",
  });

  // Diskon tambahan per barang (edit isi_per_koli & diskon_koli_pct langsung)
  const [editingProductId, setEditingProductId] = useState(null);
  const [editProductForm, setEditProductForm] = useState({ isiPerKoli: "", diskonKoliPct: "" });
  const [savingProduct, setSavingProduct] = useState(false);

  // Diskon tambahan per nota tertentu
  const [notaSearch, setNotaSearch] = useState("");
  const [foundOrder, setFoundOrder] = useState(null);
  const [notaSearchError, setNotaSearchError] = useState("");
  const [notaDiskonForm, setNotaDiskonForm] = useState({ jenis: "persen", nilai: "", keterangan: "" });
  const [savingNotaDiskon, setSavingNotaDiskon] = useState(false);
  const [notaDiskonMsg, setNotaDiskonMsg] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [ruleRows, productRows] = await Promise.all([
        supabaseFetch(token, "cashback_rules?select=*,products(kode,nama,satuan)&order=created_at.desc"),
        supabaseFetch(token, "products?select=id,kode,nama,satuan,isi_per_koli,diskon_koli_pct&aktif=eq.true&order=kode.asc"),
      ]);
      setRules(ruleRows);
      setProducts(productRows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function resetForm() {
    setForm({ jenisRule: "nominal_bulanan", minimalOmzetBulan: "", productId: "", minimalQty: "", jenisCashback: "persen", nilaiCashback: "" });
  }

  function startEditProduct(p) {
    setEditingProductId(p.id);
    setEditProductForm({ isiPerKoli: p.isi_per_koli || "", diskonKoliPct: p.diskon_koli_pct ? (Number(p.diskon_koli_pct) * 100) : "" });
  }

  async function saveProductDiskon(productId) {
    setSavingProduct(true);
    try {
      await supabaseFetch(token, `products?id=eq.${productId}`, {
        method: "PATCH",
        body: JSON.stringify({
          isi_per_koli: Number(editProductForm.isiPerKoli) || 0,
          diskon_koli_pct: (Number(editProductForm.diskonKoliPct) || 0) / 100,
        }),
      });
      setProducts((prev) => prev.map((p) => (
        p.id === productId ? { ...p, isi_per_koli: Number(editProductForm.isiPerKoli) || 0, diskon_koli_pct: (Number(editProductForm.diskonKoliPct) || 0) / 100 } : p
      )));
      setEditingProductId(null);
    } catch (e) {
      alert("Gagal simpan: " + e.message);
    }
    setSavingProduct(false);
  }

  async function cariNota() {
    setNotaSearchError("");
    setFoundOrder(null);
    setNotaDiskonMsg("");
    if (!notaSearch.trim()) return;
    try {
      const rows = await supabaseFetch(token, `orders?select=id,no_nota,diskon_tambahan_jenis,diskon_tambahan_nilai,diskon_tambahan_keterangan,clients(nama)&no_nota=eq.${notaSearch.trim().toUpperCase()}`);
      if (rows.length === 0) {
        setNotaSearchError("Nota tidak ditemukan. Cek lagi nomornya.");
        return;
      }
      setFoundOrder(rows[0]);
      setNotaDiskonForm({
        jenis: rows[0].diskon_tambahan_jenis || "persen",
        nilai: rows[0].diskon_tambahan_nilai || "",
        keterangan: rows[0].diskon_tambahan_keterangan || "",
      });
    } catch (e) {
      setNotaSearchError(e.message);
    }
  }

  async function saveNotaDiskon() {
    setSavingNotaDiskon(true);
    try {
      await supabaseFetch(token, `orders?id=eq.${foundOrder.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          diskon_tambahan_jenis: notaDiskonForm.nilai ? notaDiskonForm.jenis : null,
          diskon_tambahan_nilai: Number(notaDiskonForm.nilai) || 0,
          diskon_tambahan_keterangan: notaDiskonForm.keterangan || null,
        }),
      });
      setNotaDiskonMsg("Diskon tambahan untuk nota ini berhasil disimpan.");
    } catch (e) {
      alert("Gagal simpan: " + e.message);
    }
    setSavingNotaDiskon(false);
  }

  async function submitRule() {
    if (form.jenisRule === "nominal_bulanan" && (!form.minimalOmzetBulan || !form.nilaiCashback)) {
      alert("Isi dulu minimal omzet dan nilai cashback-nya.");
      return;
    }
    if (form.jenisRule === "per_barang" && (!form.productId || !form.minimalQty || !form.nilaiCashback)) {
      alert("Pilih barang, isi minimal qty, dan nilai cashback-nya dulu.");
      return;
    }
    setSaving(true);
    try {
      const [inserted] = await supabaseFetch(token, "cashback_rules", {
        method: "POST",
        body: JSON.stringify({
          jenis_rule: form.jenisRule,
          minimal_omzet_bulan: form.jenisRule === "nominal_bulanan" ? Number(form.minimalOmzetBulan) : null,
          product_id: form.jenisRule === "per_barang" ? form.productId : null,
          minimal_qty: form.jenisRule === "per_barang" ? Number(form.minimalQty) : null,
          jenis_cashback: form.jenisCashback,
          nilai_cashback: Number(form.nilaiCashback),
          aktif: true,
        }),
      });
      const prod = products.find((p) => p.id === form.productId);
      setRules((prev) => [{ ...inserted, products: prod }, ...prev]);
      resetForm();
    } catch (e) {
      alert("Gagal simpan: " + e.message);
    }
    setSaving(false);
  }

  async function toggleAktif(ruleId, aktif) {
    try {
      await supabaseFetch(token, `cashback_rules?id=eq.${ruleId}`, { method: "PATCH", body: JSON.stringify({ aktif: !aktif }) });
      setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, aktif: !aktif } : r)));
    } catch (e) { alert("Gagal update: " + e.message); }
  }

  async function hapusRule(ruleId) {
    if (!confirm("Hapus aturan cashback ini?")) return;
    try {
      await supabaseFetch(token, `cashback_rules?id=eq.${ruleId}`, { method: "DELETE" });
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (e) { alert("Gagal hapus: " + e.message); }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const fieldStyle = { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, outline: "none" };
  const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" };

  return (
    <div>
      <PageHeader title="Cashback" subtitle="Atur aturan cashback berdasarkan omzet bulanan atau per barang" />

      <Card style={{ maxWidth: 560, marginBottom: 24 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Jenis Aturan</label>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setForm({ ...form, jenisRule: "nominal_bulanan" })}
              style={{ flex: 1, padding: 10, borderRadius: 9, border: form.jenisRule === "nominal_bulanan" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: form.jenisRule === "nominal_bulanan" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
            >
              Nominal Transaksi/Bulan
            </button>
            <button
              onClick={() => setForm({ ...form, jenisRule: "per_barang" })}
              style={{ flex: 1, padding: 10, borderRadius: 9, border: form.jenisRule === "per_barang" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: form.jenisRule === "per_barang" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
            >
              Per Barang (Qty)
            </button>
          </div>
        </div>

        {form.jenisRule === "nominal_bulanan" ? (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Minimal Transaksi dalam Sebulan (Rp)</label>
            <input type="number" value={form.minimalOmzetBulan} onChange={(e) => setForm({ ...form, minimalOmzetBulan: e.target.value })} placeholder="misal 10000000" style={fieldStyle} />
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Pilih Barang</label>
              <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} style={fieldStyle}>
                <option value="">-- Pilih barang --</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.kode} - {p.nama}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Minimal Qty (pcs/set/koli sesuai satuan barang)</label>
              <input type="number" value={form.minimalQty} onChange={(e) => setForm({ ...form, minimalQty: e.target.value })} placeholder="misal 20" style={fieldStyle} />
            </div>
          </>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Jenis Cashback</label>
            <select value={form.jenisCashback} onChange={(e) => setForm({ ...form, jenisCashback: e.target.value })} style={fieldStyle}>
              <option value="persen">Persen (%)</option>
              <option value="rupiah">Rupiah (Rp)</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Nilai Cashback</label>
            <input type="number" value={form.nilaiCashback} onChange={(e) => setForm({ ...form, nilaiCashback: e.target.value })} placeholder={form.jenisCashback === "persen" ? "misal 5" : "misal 50000"} style={fieldStyle} />
          </div>
        </div>

        <button onClick={submitRule} disabled={saving} style={{ padding: "11px 22px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}>
          <Gift size={16} /> {saving ? "Menyimpan..." : "Tambah Aturan"}
        </button>
      </Card>

      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>Daftar Aturan</h2>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Jenis", "Syarat", "Cashback", "Status", ""].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                <td style={{ padding: "12px 14px", fontWeight: 600 }}>
                  {r.jenis_rule === "nominal_bulanan" ? "Nominal/Bulan" : "Per Barang"}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  {r.jenis_rule === "nominal_bulanan"
                    ? `Transaksi ≥ ${rupiah(r.minimal_omzet_bulan)} / bulan`
                    : `${r.products?.kode} - ${r.products?.nama}, min. ${r.minimal_qty} ${r.products?.satuan}`}
                </td>
                <td style={{ padding: "12px 14px", fontWeight: 700 }}>
                  {r.jenis_cashback === "persen" ? `${r.nilai_cashback}%` : rupiah(r.nilai_cashback)}
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <button
                    onClick={() => toggleAktif(r.id, r.aktif)}
                    style={{ background: r.aktif ? "#D8E9E6" : "#F7F5F1", color: r.aktif ? "#28685D" : "#9CA0A6", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, border: "none" }}
                  >
                    {r.aktif ? "Aktif" : "Nonaktif"}
                  </button>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <button onClick={() => hapusRule(r.id)} style={{ background: "none", border: "none", color: "#C0392B", fontSize: 11.5, fontWeight: 700 }}>
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rules.length === 0 && <EmptyState text="Belum ada aturan cashback." />}
      </Card>

      {/* ============ DISKON TAMBAHAN PER BARANG ============ */}
      <h2 className="disp" style={{ fontSize: 20, fontWeight: 700, color: "#24272B", margin: "36px 0 4px" }}>Diskon Tambahan per Barang</h2>
      <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 14px" }}>
        Diskon standar 20% sudah termasuk di harga jual barang. Atur di sini kalau beli minimal sekian pcs/set/koli,
        dapat diskon tambahan (dipotong dari harga asli, jadi total gabungan diskonnya) - misal standar 20% + tambahan 5% = total 25%.
      </p>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Kode", "Nama Barang", "Minimal Qty", "Diskon Tambahan", ""].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const isEditing = editingProductId === p.id;
              return (
                <tr key={p.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 700 }}>{p.kode}</td>
                  <td style={{ padding: "12px 14px" }}>{p.nama}</td>
                  <td style={{ padding: "12px 14px" }}>
                    {isEditing ? (
                      <input type="number" value={editProductForm.isiPerKoli} onChange={(e) => setEditProductForm({ ...editProductForm, isiPerKoli: e.target.value })} style={{ width: 90, padding: "6px 8px", borderRadius: 7, border: "1.5px solid #E4E1DA", fontSize: 12.5 }} />
                    ) : (
                      p.isi_per_koli > 0 ? `${p.isi_per_koli} ${p.satuan}` : "-"
                    )}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    {isEditing ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <input type="number" value={editProductForm.diskonKoliPct} onChange={(e) => setEditProductForm({ ...editProductForm, diskonKoliPct: e.target.value })} style={{ width: 70, padding: "6px 8px", borderRadius: 7, border: "1.5px solid #E4E1DA", fontSize: 12.5 }} />
                        <span style={{ fontSize: 12 }}>%</span>
                      </div>
                    ) : (
                      p.diskon_koli_pct > 0 ? `+${(Number(p.diskon_koli_pct) * 100).toFixed(0)}%` : "-"
                    )}
                  </td>
                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => saveProductDiskon(p.id)} disabled={savingProduct} style={{ padding: "6px 10px", borderRadius: 7, border: "none", background: "#E8A426", color: "#24272B", fontSize: 11, fontWeight: 700 }}>Simpan</button>
                        <button onClick={() => setEditingProductId(null)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontSize: 11 }}>Batal</button>
                      </div>
                    ) : (
                      <button onClick={() => startEditProduct(p)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                        <FileEdit size={11} /> Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {products.length === 0 && <EmptyState text="Belum ada barang." />}
      </Card>

      {/* ============ DISKON TAMBAHAN PER NOTA TERTENTU ============ */}
      <h2 className="disp" style={{ fontSize: 20, fontWeight: 700, color: "#24272B", margin: "36px 0 4px" }}>Diskon Tambahan per Nota Tertentu</h2>
      <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 14px" }}>
        Cari nomor nota, lalu beri diskon tambahan khusus untuk nota itu saja (misal kompensasi atau promo one-time).
      </p>
      <Card style={{ maxWidth: 560 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <input
            value={notaSearch} onChange={(e) => setNotaSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && cariNota()}
            placeholder="Masukkan No Nota, misal NOTA-0011"
            style={{ flex: 1, padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5 }}
          />
          <button onClick={cariNota} style={{ padding: "10px 18px", borderRadius: 9, border: "none", background: "#24272B", color: "#fff", fontWeight: 700, fontSize: 13 }}>
            Cari
          </button>
        </div>

        {notaSearchError && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBEAEA", color: "#C0392B", padding: 10, borderRadius: 9, fontSize: 12.5, marginBottom: 14 }}>
            <AlertCircle size={14} /> {notaSearchError}
          </div>
        )}

        {foundOrder && (
          <>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: "0 0 14px" }}>
              {foundOrder.no_nota} - {foundOrder.clients?.nama}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Jenis Diskon</label>
                <select value={notaDiskonForm.jenis} onChange={(e) => setNotaDiskonForm({ ...notaDiskonForm, jenis: e.target.value })} style={fieldStyle}>
                  <option value="persen">Persen (%)</option>
                  <option value="rupiah">Rupiah (Rp)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Nilai Diskon</label>
                <input type="number" value={notaDiskonForm.nilai} onChange={(e) => setNotaDiskonForm({ ...notaDiskonForm, nilai: e.target.value })} style={fieldStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Keterangan (opsional)</label>
              <input value={notaDiskonForm.keterangan} onChange={(e) => setNotaDiskonForm({ ...notaDiskonForm, keterangan: e.target.value })} placeholder="misal kompensasi keterlambatan" style={fieldStyle} />
            </div>
            {notaDiskonMsg && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#D8E9E6", color: "#28685D", padding: 10, borderRadius: 9, fontSize: 12.5, marginBottom: 14, fontWeight: 600 }}>
                <Check size={14} /> {notaDiskonMsg}
              </div>
            )}
            <button onClick={saveNotaDiskon} disabled={savingNotaDiskon} style={{ padding: "11px 22px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}>
              {savingNotaDiskon ? "Menyimpan..." : "Simpan Diskon Nota Ini"}
            </button>
          </>
        )}
      </Card>
    </div>
  );
}

// ============================================================
// FREE ONGKIR (tabel tarif manual, base gudang Pekanbaru)
// ============================================================
function FreeOngkirPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [rates, setRates] = useState([]);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ kotaTujuan: "", tarifPerKg: "", estimasiHari: "", keterangan: "" });

  // Kalkulator cek cepat
  const [calcKota, setCalcKota] = useState("");
  const [calcBerat, setCalcBerat] = useState("");

  // Info kemasan barang
  const [editingProductId, setEditingProductId] = useState(null);
  const [productForm, setProductForm] = useState({ isiPerKoli: "", ukuranKoli: "" });
  const [savingProduct, setSavingProduct] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rateRows, productRows] = await Promise.all([
        supabaseFetch(token, "ongkir_rates?select=*&order=kota_tujuan.asc"),
        supabaseFetch(token, "products?select=id,kode,nama,satuan,isi_per_koli,ukuran_koli&aktif=eq.true&order=kode.asc"),
      ]);
      setRates(rateRows);
      setProducts(productRows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function startEditProduct(p) {
    setEditingProductId(p.id);
    setProductForm({ isiPerKoli: p.isi_per_koli || "", ukuranKoli: p.ukuran_koli || "" });
  }

  async function saveProductKemasan(productId) {
    setSavingProduct(true);
    try {
      await supabaseFetch(token, `products?id=eq.${productId}`, {
        method: "PATCH",
        body: JSON.stringify({ isi_per_koli: Number(productForm.isiPerKoli) || 0, ukuran_koli: productForm.ukuranKoli || null }),
      });
      setProducts((prev) => prev.map((p) => (
        p.id === productId ? { ...p, isi_per_koli: Number(productForm.isiPerKoli) || 0, ukuran_koli: productForm.ukuranKoli || null } : p
      )));
      setEditingProductId(null);
    } catch (e) {
      alert("Gagal simpan: " + e.message);
    }
    setSavingProduct(false);
  }

  function resetForm() {
    setForm({ kotaTujuan: "", tarifPerKg: "", estimasiHari: "", keterangan: "" });
    setEditingId(null);
  }

  function startEdit(r) {
    setEditingId(r.id);
    setForm({ kotaTujuan: r.kota_tujuan, tarifPerKg: r.tarif_per_kg, estimasiHari: r.estimasi_hari || "", keterangan: r.keterangan || "" });
  }

  async function submitForm() {
    if (!form.kotaTujuan.trim() || !form.tarifPerKg) {
      alert("Isi dulu kota tujuan dan tarif per kg-nya.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        kota_tujuan: form.kotaTujuan.trim(),
        tarif_per_kg: Number(form.tarifPerKg),
        estimasi_hari: form.estimasiHari || null,
        keterangan: form.keterangan || null,
        updated_at: new Date().toISOString(),
      };
      if (editingId) {
        await supabaseFetch(token, `ongkir_rates?id=eq.${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
        setRates((prev) => prev.map((r) => (r.id === editingId ? { ...r, ...body } : r)));
      } else {
        const [inserted] = await supabaseFetch(token, "ongkir_rates", { method: "POST", body: JSON.stringify(body) });
        setRates((prev) => [...prev, inserted].sort((a, b) => a.kota_tujuan.localeCompare(b.kota_tujuan)));
      }
      resetForm();
    } catch (e) {
      alert("Gagal simpan: " + e.message);
    }
    setSaving(false);
  }

  async function hapusRate(id) {
    if (!confirm("Hapus tarif kota ini?")) return;
    try {
      await supabaseFetch(token, `ongkir_rates?id=eq.${id}`, { method: "DELETE" });
      setRates((prev) => prev.filter((r) => r.id !== id));
    } catch (e) { alert("Gagal hapus: " + e.message); }
  }

  const calcResult = (() => {
    if (!calcKota || !calcBerat) return null;
    const r = rates.find((x) => x.id === calcKota);
    if (!r) return null;
    return { rate: r, total: r.tarif_per_kg * Number(calcBerat) };
  })();

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const fieldStyle = { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, outline: "none" };
  const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" };

  return (
    <div>
      <PageHeader title="Free Ongkir" subtitle="Tabel tarif kirim dari gudang Pekanbaru (diisi manual, referensi dari Baraka Express)" />

      {/* KALKULATOR CEK CEPAT */}
      <Card style={{ maxWidth: 560, marginBottom: 24 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: "0 0 14px" }}>Cek Ongkir Cepat</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Kota Tujuan</label>
            <select value={calcKota} onChange={(e) => setCalcKota(e.target.value)} style={fieldStyle}>
              <option value="">-- Pilih kota --</option>
              {rates.map((r) => <option key={r.id} value={r.id}>{r.kota_tujuan}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Berat (Kg)</label>
            <input type="number" value={calcBerat} onChange={(e) => setCalcBerat(e.target.value)} placeholder="misal 10" style={fieldStyle} />
          </div>
        </div>
        {calcResult && (
          <div style={{ background: "#FBF0D9", borderRadius: 10, padding: 14 }}>
            <p style={{ fontSize: 11.5, color: "#8A6A1A", margin: "0 0 4px" }}>
              Pekanbaru &rarr; {calcResult.rate.kota_tujuan} · {rupiah(calcResult.rate.tarif_per_kg)}/kg
              {calcResult.rate.estimasi_hari && ` · Estimasi ${calcResult.rate.estimasi_hari}`}
            </p>
            <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#24272B", margin: 0 }}>{rupiah(calcResult.total)}</p>
          </div>
        )}
      </Card>

      {/* FORM TAMBAH/EDIT TARIF */}
      <Card style={{ maxWidth: 560, marginBottom: 24 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: "0 0 14px" }}>{editingId ? "Edit Tarif" : "Tambah Tarif Kota Baru"}</p>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Kota Tujuan</label>
          <input value={form.kotaTujuan} onChange={(e) => setForm({ ...form, kotaTujuan: e.target.value })} placeholder="misal Jakarta" style={fieldStyle} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Tarif per Kg (Rp)</label>
            <input type="number" value={form.tarifPerKg} onChange={(e) => setForm({ ...form, tarifPerKg: e.target.value })} placeholder="misal 15000" style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Estimasi Hari (opsional)</label>
            <input value={form.estimasiHari} onChange={(e) => setForm({ ...form, estimasiHari: e.target.value })} placeholder="misal 3-5 hari" style={fieldStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Keterangan (opsional)</label>
          <input value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} placeholder="misal jalur darat, cek terakhir 1 Juli 2026" style={fieldStyle} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={submitForm} disabled={saving} style={{ padding: "11px 22px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}>
            {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Tarif"}
          </button>
          {editingId && (
            <button onClick={resetForm} style={{ padding: "11px 22px", borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
              Batal
            </button>
          )}
        </div>
      </Card>

      {/* DAFTAR TARIF */}
      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>Daftar Tarif</h2>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Kota Tujuan", "Tarif/Kg", "Estimasi", "Keterangan", ""].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                <td style={{ padding: "12px 14px", fontWeight: 700 }}>{r.kota_tujuan}</td>
                <td style={{ padding: "12px 14px" }}>{rupiah(r.tarif_per_kg)}</td>
                <td style={{ padding: "12px 14px", color: "#6B6F75" }}>{r.estimasi_hari || "-"}</td>
                <td style={{ padding: "12px 14px", color: "#6B6F75" }}>{r.keterangan || "-"}</td>
                <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => startEdit(r)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 11, fontWeight: 600 }}>
                      Edit
                    </button>
                    <button onClick={() => hapusRate(r.id)} style={{ padding: "6px 10px", borderRadius: 7, border: "none", background: "none", color: "#C0392B", fontSize: 11, fontWeight: 700 }}>
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rates.length === 0 && <EmptyState text="Belum ada tarif ongkir. Tambahkan dulu di form atas." />}
      </Card>

      {/* INFO KEMASAN BARANG */}
      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "36px 0 4px" }}>Info Kemasan Barang</h2>
      <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 12px" }}>
        Dipakai buat estimasi berat/volume kiriman - berapa pcs jadi 1 koli, dan berapa ukuran/berat 1 koli itu.
      </p>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Kode Barang", "Nama Barang", "Jumlah 1 Koli", "Ukuran Koli", ""].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const isEditing = editingProductId === p.id;
              return (
                <tr key={p.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 700 }}>{p.kode}</td>
                  <td style={{ padding: "12px 14px" }}>{p.nama}</td>
                  <td style={{ padding: "12px 14px" }}>
                    {isEditing ? (
                      <input type="number" value={productForm.isiPerKoli} onChange={(e) => setProductForm({ ...productForm, isiPerKoli: e.target.value })} style={{ width: 90, padding: "6px 8px", borderRadius: 7, border: "1.5px solid #E4E1DA", fontSize: 12.5 }} />
                    ) : (
                      p.isi_per_koli > 0 ? `${p.isi_per_koli} ${p.satuan}` : "-"
                    )}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    {isEditing ? (
                      <input value={productForm.ukuranKoli} onChange={(e) => setProductForm({ ...productForm, ukuranKoli: e.target.value })} placeholder="misal 40x30x20 cm, 15kg" style={{ width: 200, padding: "6px 8px", borderRadius: 7, border: "1.5px solid #E4E1DA", fontSize: 12.5 }} />
                    ) : (
                      p.ukuran_koli || "-"
                    )}
                  </td>
                  <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => saveProductKemasan(p.id)} disabled={savingProduct} style={{ padding: "6px 10px", borderRadius: 7, border: "none", background: "#E8A426", color: "#24272B", fontSize: 11, fontWeight: 700 }}>Simpan</button>
                        <button onClick={() => setEditingProductId(null)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontSize: 11 }}>Batal</button>
                      </div>
                    ) : (
                      <button onClick={() => startEditProduct(p)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                        <FileEdit size={11} /> Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {products.length === 0 && <EmptyState text="Belum ada barang." />}
      </Card>
    </div>
  );
}

// ============================================================
// PRODUCT (khusus Owner) - CRUD lengkap + gambar
// ============================================================
function ProductPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [editingProduct, setEditingProduct] = useState(null); // null = tutup modal, {} = tambah baru, {...} = edit
  const [deletingId, setDeletingId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, "products?select=*&order=kode.asc");
      setProducts(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function hapusProduk(id) {
    if (!confirm("Hapus produk ini? Data yang sudah pernah dipakai di order lama tetap aman, cuma produk ini tidak akan bisa dipesan lagi.")) return;
    setDeletingId(id);
    try {
      await supabaseFetch(token, `products?id=eq.${id}`, { method: "DELETE" });
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      alert("Gagal hapus - produk ini masih punya riwayat (order lama dan/atau catatan stock movement/inbound). Silakan nonaktifkan saja lewat tombol Edit, centang hilangkan 'Produk aktif'.\n\nDetail teknis: " + e.message);
    }
    setDeletingId(null);
  }

  function handleSaved(saved) {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      const next = exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved];
      return next.sort((a, b) => a.kode.localeCompare(b.kode));
    });
    setEditingProduct(null);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
        <PageHeader title="Product" subtitle={`${products.length} produk terdaftar`} />
        <button
          onClick={() => setEditingProduct({})}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}
        >
          <PackagePlus size={16} /> Tambah Produk
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
        {products.map((p) => (
          <Card key={p.id} style={{ padding: 14 }}>
            <div style={{ width: "100%", aspectRatio: "1", borderRadius: 10, background: p.gambar_url ? `url(${p.gambar_url}) center/cover` : "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              {!p.gambar_url && <Package size={32} color="#D8D6D0" />}
            </div>
            <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 2px", fontWeight: 700 }}>{p.kode}</p>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: "0 0 4px", lineHeight: 1.3 }}>{p.nama}</p>
            <p className="disp" style={{ fontSize: 15, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>{rupiah(p.harga_jual)}</p>
            <span style={{ display: "inline-block", background: p.aktif ? "#D8E9E6" : "#F7F5F1", color: p.aktif ? "#28685D" : "#9CA0A6", padding: "2px 9px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, marginBottom: 10 }}>
              {p.aktif ? "Aktif" : "Nonaktif"}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setEditingProduct(p)} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 11.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <FileEdit size={11} /> Edit
              </button>
              <button disabled={deletingId === p.id} onClick={() => hapusProduk(p.id)} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1px solid #F0CFC7", background: "#fff", color: "#C0392B", fontSize: 11.5, fontWeight: 600 }}>
                Hapus
              </button>
            </div>
          </Card>
        ))}
      </div>
      {products.length === 0 && <EmptyState text="Belum ada produk. Klik 'Tambah Produk' untuk mulai." />}

      {editingProduct !== null && (
        <ProductFormModal token={token} product={editingProduct} onClose={() => setEditingProduct(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}

// ============================================================
// MODAL FORM PRODUCT (tambah / edit)
// ============================================================
function ProductFormModal({ token, product, onClose, onSaved }) {
  const isNew = !product.id;
  const [form, setForm] = useState({
    kode: product.kode || "", nama: product.nama || "", kategori: product.kategori || "", satuan: product.satuan || "",
    hargaJual: product.harga_jual || "", hargaAsli: product.harga_asli || "", hargaModal: product.harga_modal || "",
    stockAwal: product.stock_awal ?? 0, isiPerKoli: product.isi_per_koli || "", diskonKoliPct: product.diskon_koli_pct ? Number(product.diskon_koli_pct) * 100 : "",
    cashbackPerKoli: product.cashback_per_koli || "", deskripsi: product.deskripsi || "", aktif: product.aktif ?? true,
  });
  const [gambarUrl, setGambarUrl] = useState(product.gambar_url || "");
  const [fotoUtamaList, setFotoUtamaList] = useState([]); // [{id, url}] - foto tambahan untuk slider utama
  const [galeri, setGaleri] = useState([]); // [{id, url}] - foto tambahan untuk deskripsi
  const [uploadingUtama, setUploadingUtama] = useState(false);
  const [uploadingGaleri, setUploadingGaleri] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!product.id) return;
    supabaseFetch(token, `product_images?select=id,url,tipe&product_id=eq.${product.id}&order=urutan.asc`)
      .then((rows) => {
        setFotoUtamaList(rows.filter((r) => r.tipe === "utama"));
        setGaleri(rows.filter((r) => r.tipe !== "utama"));
      })
      .catch(() => { setFotoUtamaList([]); setGaleri([]); });
  }, [product.id]);

  async function uploadFotoTipe(file, tipe, setUploadingFn, listState, setListFn) {
    setUploadingFn(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${form.kode || "produk"}-${tipe}-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/produk-gambar/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error(await res.text());
      const url = `${SUPABASE_URL}/storage/v1/object/public/produk-gambar/${filePath}`;
      if (isNew) {
        setListFn((prev) => [...prev, { id: `temp-${Date.now()}`, url, tipe, isTemp: true }]);
      } else {
        const [inserted] = await supabaseFetch(token, "product_images", {
          method: "POST",
          body: JSON.stringify({ product_id: product.id, url, tipe, urutan: listState.length }),
        });
        setListFn((prev) => [...prev, inserted]);
      }
    } catch (e) {
      alert("Gagal upload foto: " + e.message);
    }
    setUploadingFn(false);
  }

  async function hapusFoto(img, setListFn) {
    if (img.isTemp) {
      setListFn((prev) => prev.filter((g) => g.id !== img.id));
      return;
    }
    try {
      await supabaseFetch(token, `product_images?id=eq.${img.id}`, { method: "DELETE" });
      setListFn((prev) => prev.filter((g) => g.id !== img.id));
    } catch (e) {
      alert("Gagal hapus foto: " + e.message);
    }
  }

  async function uploadGambar(file) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${form.kode || "produk"}-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/produk-gambar/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error(await res.text());
      setGambarUrl(`${SUPABASE_URL}/storage/v1/object/public/produk-gambar/${filePath}`);
    } catch (e) {
      alert("Gagal upload gambar: " + e.message);
    }
    setUploading(false);
  }

  async function submit() {
    if (!form.kode.trim() || !form.nama.trim() || !form.satuan.trim() || !form.hargaJual) {
      setError("Kode, Nama, Satuan, dan Harga Jual wajib diisi.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const body = {
        kode: form.kode.trim().toUpperCase(), nama: form.nama.trim(), kategori: form.kategori || null, satuan: form.satuan.trim(),
        harga_jual: Number(form.hargaJual), harga_asli: form.hargaAsli ? Number(form.hargaAsli) : null,
        harga_modal: form.hargaModal ? Number(form.hargaModal) : null, stock_awal: Number(form.stockAwal) || 0,
        isi_per_koli: Number(form.isiPerKoli) || 0, diskon_koli_pct: (Number(form.diskonKoliPct) || 0) / 100,
        cashback_per_koli: Number(form.cashbackPerKoli) || 0, deskripsi: form.deskripsi || null,
        gambar_url: gambarUrl || null, aktif: form.aktif,
      };
      let saved;
      if (isNew) {
        const [inserted] = await supabaseFetch(token, "products", { method: "POST", body: JSON.stringify(body) });
        saved = inserted;
        // Simpan galeri yang sempat ditumpuk sementara (sebelum produk ini punya id asli)
        const tempImages = [...fotoUtamaList, ...galeri].filter((g) => g.isTemp);
        if (tempImages.length > 0) {
          await supabaseFetch(token, "product_images", {
            method: "POST",
            body: JSON.stringify(tempImages.map((g, i) => ({ product_id: saved.id, url: g.url, tipe: g.tipe, urutan: i }))),
          });
        }
      } else {
        const [updated] = await supabaseFetch(token, `products?id=eq.${product.id}`, { method: "PATCH", body: JSON.stringify(body) });
        saved = updated;
      }
      onSaved(saved);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  const fieldStyle = { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1.5px solid #E4E1DA", fontSize: 13, outline: "none" };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 5, display: "block" };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 560, maxHeight: "88vh", overflowY: "auto", padding: 28 }}>
        <h2 className="disp" style={{ fontSize: 20, fontWeight: 700, color: "#24272B", margin: "0 0 18px" }}>
          {isNew ? "Tambah Produk" : `Edit Produk - ${product.kode}`}
        </h2>

        {/* GAMBAR */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Gambar Produk (utama, dipakai di katalog & keranjang)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 70, height: 70, borderRadius: 10, background: gambarUrl ? `url(${gambarUrl}) center/cover` : "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {!gambarUrl && <Package size={22} color="#D8D6D0" />}
            </div>
            <label style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px dashed #E8A426", background: "#FFFBF0", color: "#8A6A1A", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {uploading ? "Mengupload..." : "Pilih Gambar"}
              <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploading} onChange={(e) => { if (e.target.files[0]) uploadGambar(e.target.files[0]); }} />
            </label>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Foto Utama Tambahan (buat slider di halaman produk, boleh lebih dari 1)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {fotoUtamaList.map((img) => (
              <div key={img.id} style={{ position: "relative", width: 60, height: 60 }}>
                <div style={{ width: 60, height: 60, borderRadius: 8, background: `url(${img.url}) center/cover` }} />
                <button
                  onClick={() => hapusFoto(img, setFotoUtamaList)}
                  style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#C0392B", border: "2px solid #fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            <label style={{ width: 60, height: 60, borderRadius: 8, border: "1.5px dashed #E8A426", background: "#FFFBF0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {uploadingUtama ? <Loader2 size={16} color="#8A6A1A" /> : <PackagePlus size={18} color="#8A6A1A" />}
              <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingUtama} onChange={(e) => { if (e.target.files[0]) uploadFotoTipe(e.target.files[0], "utama", setUploadingUtama, fotoUtamaList, setFotoUtamaList); }} />
            </label>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Kode Barang</label>
            <input value={form.kode} onChange={set("kode")} placeholder="misal B008" style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Kategori</label>
            <input value={form.kategori} onChange={set("kategori")} placeholder="misal Sparepart" style={fieldStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Nama Barang</label>
          <input value={form.nama} onChange={set("nama")} placeholder="Nama produk" style={fieldStyle} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Deskripsi (opsional)</label>
          <textarea value={form.deskripsi} onChange={set("deskripsi")} rows={3} placeholder="Deskripsi produk untuk ditampilkan ke toko" style={{ ...fieldStyle, resize: "vertical" }} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Galeri Foto Tambahan (opsional, buat lengkapi deskripsi)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {galeri.map((img) => (
              <div key={img.id} style={{ position: "relative", width: 60, height: 60 }}>
                <div style={{ width: 60, height: 60, borderRadius: 8, background: `url(${img.url}) center/cover` }} />
                <button
                  onClick={() => hapusFoto(img, setGaleri)}
                  style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#C0392B", border: "2px solid #fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            <label style={{ width: 60, height: 60, borderRadius: 8, border: "1.5px dashed #E8A426", background: "#FFFBF0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {uploadingGaleri ? <Loader2 size={16} color="#8A6A1A" /> : <PackagePlus size={18} color="#8A6A1A" />}
              <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingGaleri} onChange={(e) => { if (e.target.files[0]) uploadFotoTipe(e.target.files[0], "deskripsi", setUploadingGaleri, galeri, setGaleri); }} />
            </label>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Satuan</label>
            <input value={form.satuan} onChange={set("satuan")} placeholder="misal Set" style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Harga Jual (Rp)</label>
            <input type="number" value={form.hargaJual} onChange={set("hargaJual")} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Harga Asli (opsional)</label>
            <input type="number" value={form.hargaAsli} onChange={set("hargaAsli")} style={fieldStyle} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Harga Modal (Rp) - rahasia</label>
            <input type="number" value={form.hargaModal} onChange={set("hargaModal")} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Stock Awal</label>
            <input type="number" value={form.stockAwal} onChange={set("stockAwal")} style={fieldStyle} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Jumlah 1 Koli</label>
            <input type="number" value={form.isiPerKoli} onChange={set("isiPerKoli")} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Diskon Koli (%)</label>
            <input type="number" value={form.diskonKoliPct} onChange={set("diskonKoliPct")} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Cashback/Koli (Rp)</label>
            <input type="number" value={form.cashbackPerKoli} onChange={set("cashbackPerKoli")} style={fieldStyle} />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#24272B", cursor: "pointer" }}>
            <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} />
            Produk aktif (tampil di katalog Web App)
          </label>
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBEAEA", color: "#C0392B", padding: 10, borderRadius: 9, fontSize: 12.5, marginBottom: 16 }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13 }}>
            Batal
          </button>
          <button onClick={submit} disabled={saving || uploading} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13 }}>
            {saving ? "Menyimpan..." : isNew ? "Tambah Produk" : "Simpan Perubahan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CHAT TOKO (Sales, Owner, Admin Transaksi balas chat dari toko)
// ============================================================
function ChatSalesPage({ token, profile }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCase, setSelectedCase] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const pollRef = useRef(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      let url = "chat_cases?select=*,clients(nama,kode)&order=updated_at.desc";
      if (profile?.role === "sales" && profile?.sales_id) {
        url += `&sales_id=eq.${profile.sales_id}`;
      }
      const rows = await supabaseFetch(token, url);
      setCases(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function openCase(c) {
    setSelectedCase(c);
    await loadMessages(c.id);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => loadMessages(c.id), 4000);
  }

  function closeConversation() {
    setSelectedCase(null);
    if (pollRef.current) clearInterval(pollRef.current);
  }

  async function loadMessages(caseId) {
    try {
      const rows = await supabaseFetch(token, `chat_messages?select=*&case_id=eq.${caseId}&order=created_at.asc`);
      setMessages(rows);
    } catch (e) { /* diamkan, coba lagi di polling berikutnya */ }
  }

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || !selectedCase) return;
    setSending(true);
    setInput("");
    try {
      const [inserted] = await supabaseFetch(token, "chat_messages", {
        method: "POST",
        body: JSON.stringify({ case_id: selectedCase.id, sender_type: "sales", message: text }),
      });
      setMessages((prev) => [...prev, inserted]);
      await supabaseFetch(token, `chat_cases?id=eq.${selectedCase.id}`, {
        method: "PATCH",
        body: JSON.stringify({ updated_at: new Date().toISOString() }),
      });
    } catch (e) {
      alert("Gagal kirim pesan: " + e.message);
    }
    setSending(false);
  }

  async function tutupKasus() {
    if (!confirm("Tutup kasus ini? Toko akan mulai kasus baru kalau chat lagi nanti.")) return;
    try {
      await supabaseFetch(token, `chat_cases?id=eq.${selectedCase.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "closed" }),
      });
      setCases((prev) => prev.map((c) => (c.id === selectedCase.id ? { ...c, status: "closed" } : c)));
      setSelectedCase((prev) => ({ ...prev, status: "closed" }));
    } catch (e) {
      alert("Gagal tutup kasus: " + e.message);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  // ---------- TAMPILAN DETAIL PERCAKAPAN ----------
  if (selectedCase) {
    return (
      <div>
        <button onClick={closeConversation} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#6B6F75", fontSize: 13, marginBottom: 14, padding: 0 }}>
          <ChevronRight size={16} style={{ transform: "rotate(180deg)" }} /> Kembali ke daftar
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: 0 }}>{selectedCase.no_case} - {selectedCase.clients?.nama}</p>
            <p style={{ fontSize: 12, color: "#9CA0A6", margin: "2px 0 0" }}>Kode Toko: {selectedCase.clients?.kode}</p>
          </div>
          {selectedCase.status === "open" ? (
            <button onClick={tutupKasus} style={{ padding: "8px 14px", borderRadius: 9, border: "1.5px solid #F0CFC7", background: "#fff", color: "#C0392B", fontSize: 12, fontWeight: 700 }}>
              Tutup Kasus
            </button>
          ) : (
            <span style={{ padding: "6px 12px", borderRadius: 999, background: "#F7F5F1", color: "#9CA0A6", fontSize: 11.5, fontWeight: 700 }}>Ditutup</span>
          )}
        </div>

        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ height: 420, overflowY: "auto", padding: 18, background: "#F7F5F1" }}>
            {messages.length === 0 && (
              <p style={{ textAlign: "center", fontSize: 12.5, color: "#9CA0A6", padding: "20px 0" }}>Belum ada pesan di kasus ini.</p>
            )}
            {messages.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: m.sender_type === "sales" ? "flex-end" : "flex-start", marginBottom: 12 }}>
                {m.tipe_pesan === "gambar" && m.image_url ? (
                  <img src={m.image_url} alt="Lampiran" style={{ maxWidth: "50%", borderRadius: 14, display: "block" }} />
                ) : (
                  <div style={{
                    maxWidth: "65%", padding: "10px 14px", borderRadius: 14,
                    background: m.sender_type === "sales" ? "#E8A426" : "#fff",
                    border: m.sender_type === "sales" ? "none" : "1px solid #EDEAE3",
                    fontSize: 13, lineHeight: 1.5, color: "#24272B", whiteSpace: "pre-line",
                  }}>
                    {m.message}
                  </div>
                )}
              </div>
            ))}
          </div>
          {selectedCase.status === "open" && (
            <div style={{ padding: 14, display: "flex", gap: 10, borderTop: "1px solid #EDEAE3" }}>
              <input
                value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Tulis balasan..."
                style={{ flex: 1, padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13 }}
              />
              <button onClick={handleSend} disabled={sending || !input.trim()} style={{ padding: "10px 18px", borderRadius: 9, border: "none", background: (sending || !input.trim()) ? "#E4E1DA" : "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13 }}>
                Kirim
              </button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ---------- TAMPILAN DAFTAR KASUS ----------
  return (
    <div>
      <PageHeader title="Chat Toko" subtitle={`${cases.filter((c) => c.status === "open").length} kasus masih terbuka`} />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["No Case", "Toko", "Terakhir Update", "Status", ""].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                <td style={{ padding: "12px 14px", fontWeight: 700 }}>{c.no_case}</td>
                <td style={{ padding: "12px 14px" }}>{c.clients?.nama} ({c.clients?.kode})</td>
                <td style={{ padding: "12px 14px", color: "#6B6F75" }}>{new Date(c.updated_at).toLocaleString("id-ID")}</td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ background: c.status === "open" ? "#D8E9E6" : "#F7F5F1", color: c.status === "open" ? "#28685D" : "#9CA0A6", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                    {c.status === "open" ? "Terbuka" : "Ditutup"}
                  </span>
                </td>
                <td style={{ padding: "12px 14px" }}>
                  <button onClick={() => openCase(c)} style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 11.5, fontWeight: 600 }}>
                    Buka
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {cases.length === 0 && <EmptyState text="Belum ada chat dari toko." />}
      </Card>
    </div>
  );
}

// ============================================================
// PROFIL SAYA (khusus akun Sales)
// ============================================================
function ProfilSalesPage({ token, profile }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ nama: "", alamat: "", email: "", noHp: "", fotoUrl: "" });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      if (!profile?.sales_id) throw new Error("Akun ini belum terhubung ke data sales manapun.");
      const rows = await supabaseFetch(token, `sales?select=nama,alamat,email,no_hp,foto_url&id=eq.${profile.sales_id}`);
      const s = rows[0] || {};
      setForm({
        nama: s.nama || "", alamat: s.alamat || "", email: s.email || "",
        noHp: s.no_hp || "", fotoUrl: s.foto_url || "",
      });
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function uploadFoto(file) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `sales-${profile.sales_id}-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/produk-gambar/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error(await res.text());
      const url = `${SUPABASE_URL}/storage/v1/object/public/produk-gambar/${filePath}`;
      setForm((prev) => ({ ...prev, fotoUrl: url }));
    } catch (e) {
      alert("Gagal upload foto: " + e.message);
    }
    setUploading(false);
  }

  async function simpan() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await supabaseFetch(token, `sales?id=eq.${profile.sales_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          nama: form.nama, alamat: form.alamat || null, email: form.email || null,
          no_hp: form.noHp || null, foto_url: form.fotoUrl || null,
        }),
      });
      setSaved(true);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  if (loading) return <LoadingState />;
  if (error && !form.nama) return <ErrorBox error={error} onRetry={load} />;

  const fieldStyle = { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, outline: "none" };
  const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" };

  return (
    <div>
      <PageHeader title="Profil Saya" subtitle="Kelola informasi profil Anda sebagai sales" />

      <Card style={{ maxWidth: 480 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <div style={{ width: 84, height: 84, borderRadius: "50%", background: form.fotoUrl ? `url(${form.fotoUrl}) center/cover` : "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {!form.fotoUrl && <User size={32} color="#D8D6D0" />}
          </div>
          <label style={{ padding: "9px 16px", borderRadius: 9, border: "1.5px dashed #E8A426", background: "#FFFBF0", color: "#8A6A1A", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
            {uploading ? "Mengupload..." : "Ganti Foto"}
            <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploading} onChange={(e) => { if (e.target.files[0]) uploadFoto(e.target.files[0]); }} />
          </label>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Nama Lengkap</label>
          <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} style={fieldStyle} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Alamat</label>
          <textarea value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} rows={3} style={{ ...fieldStyle, resize: "vertical" }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>No. HP</label>
            <input value={form.noHp} onChange={(e) => setForm({ ...form, noHp: e.target.value })} style={fieldStyle} />
          </div>
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBEAEA", color: "#C0392B", padding: 10, borderRadius: 9, fontSize: 12.5, marginBottom: 16 }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}
        {saved && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#D8E9E6", color: "#28685D", padding: 10, borderRadius: 9, fontSize: 12.5, marginBottom: 16, fontWeight: 600 }}>
            <Check size={14} /> Profil berhasil disimpan.
          </div>
        )}

        <button onClick={simpan} disabled={saving || uploading} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}>
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </Card>
    </div>
  );
}

// ============================================================
// OMZET SAYA (khusus akun Sales)
// ============================================================
function OmzetSalesPage({ token, profile }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [target, setTarget] = useState(0);
  const [handledClients, setHandledClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);

  const BULAN = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  useEffect(() => { load(); }, [filterYear, filterMonth]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      if (!profile?.sales_id) throw new Error("Akun ini belum terhubung ke data sales manapun.");

      const startDate = `${filterYear}-${String(filterMonth).padStart(2, "0")}-01`;
      // Hitung tanggal 1 bulan berikutnya TANPA lewat Date.toISOString() (itu
      // yang kemarin jadi bug - toISOString mengonversi ke UTC, jadi bisa
      // geser mundur/maju satu hari tergantung zona waktu browser).
      const nextMonth = filterMonth === 12 ? 1 : filterMonth + 1;
      const nextYear = filterMonth === 12 ? filterYear + 1 : filterYear;
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

      const [salesRow, clientsRows, ordersRows] = await Promise.all([
        supabaseFetch(token, `sales?select=target_omzet_bulanan&id=eq.${profile.sales_id}`),
        supabaseFetch(token, `clients?select=id,nama,kode&sales_id=eq.${profile.sales_id}&order=nama.asc`),
        supabaseFetch(token, `orders?select=client_id,status,order_items(subtotal_setelah_diskon)&sales_id=eq.${profile.sales_id}&status=neq.ditolak&tanggal=gte.${startDate}&tanggal=lt.${endDate}`),
      ]);

      setTarget(Number(salesRow[0]?.target_omzet_bulanan || 0));
      setHandledClients(clientsRows);
      setOrders(ordersRows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  // Hitung omzet per toko (termasuk yang 0, kalau tidak ada order sama sekali)
  const omzetPerToko = handledClients.map((c) => {
    const ordersToko = orders.filter((o) => o.client_id === c.id);
    const omzet = ordersToko.reduce((sum, o) => sum + (o.order_items || []).reduce((s, it) => s + Number(it.subtotal_setelah_diskon || 0), 0), 0);
    return { ...c, omzet };
  }).sort((a, b) => b.omzet - a.omzet);

  const totalOmzet = orders.reduce((sum, o) => sum + (o.order_items || []).reduce((s, it) => s + Number(it.subtotal_setelah_diskon || 0), 0), 0);
  const persentaseTarget = target > 0 ? Math.min(100, (totalOmzet / target) * 100) : 0;

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const yearsAvailable = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div>
      <PageHeader title="Omzet Saya" subtitle="Rekap omzet bulanan dari toko yang Anda handle" />

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, background: "#fff" }}>
          {yearsAvailable.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, background: "#fff" }}>
          {BULAN.slice(1).map((b, i) => <option key={i + 1} value={i + 1}>{b}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card>
          <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Target Bulan Ini</p>
          <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#24272B", margin: 0 }}>{rupiah(target)}</p>
        </Card>
        <Card>
          <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Omzet Tercapai</p>
          <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#24272B", margin: 0 }}>{rupiah(totalOmzet)}</p>
        </Card>
        <Card>
          <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Jumlah Toko Di-handle</p>
          <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#24272B", margin: 0 }}>{handledClients.length}</p>
        </Card>
      </div>

      {target > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#24272B" }}>Progres Target</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: persentaseTarget >= 100 ? "#28685D" : "#24272B" }}>{persentaseTarget.toFixed(0)}%</span>
          </div>
          <div style={{ width: "100%", height: 10, background: "#F7F5F1", borderRadius: 999, overflow: "hidden" }}>
            <div style={{ width: `${persentaseTarget}%`, height: "100%", background: persentaseTarget >= 100 ? "#28685D" : "#E8A426", borderRadius: 999 }} />
          </div>
        </Card>
      )}

      <h2 className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>Omzet per Toko yang Anda Handle</h2>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Kode", "Nama Toko", "Omzet Bulan Ini"].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {omzetPerToko.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                <td style={{ padding: "12px 14px", fontWeight: 700 }}>{c.kode}</td>
                <td style={{ padding: "12px 14px" }}>{c.nama}</td>
                <td style={{ padding: "12px 14px", fontWeight: 700, color: c.omzet === 0 ? "#9CA0A6" : "#24272B" }}>{rupiah(c.omzet)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {omzetPerToko.length === 0 && <EmptyState text="Belum ada toko yang Anda handle." />}
      </Card>
    </div>
  );
}

// ============================================================
// LAPORAN KUNJUNGAN (khusus akun Sales) - target 3x/bulan/toko, selfie + GPS
// ============================================================
const TARGET_KUNJUNGAN_PER_BULAN = 3;

function KunjunganSalesPage({ token, profile }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [handledClients, setHandledClients] = useState([]);
  const [kunjunganBulanIni, setKunjunganBulanIni] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null); // toko yang mau di-checkin / dilihat riwayatnya
  const [mode, setMode] = useState(null); // "checkin" | "riwayat"
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [coords, setCoords] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const now = new Date();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      if (!profile?.sales_id) throw new Error("Akun ini belum terhubung ke data sales manapun.");
      const startBulan = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const nextMonth = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
      const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
      const endBulan = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

      const [clientsRows, kunjunganRows] = await Promise.all([
        supabaseFetch(token, `clients?select=id,nama,kode,alamat&sales_id=eq.${profile.sales_id}&order=nama.asc`),
        supabaseFetch(token, `kunjungan_sales?select=*&sales_id=eq.${profile.sales_id}&created_at=gte.${startBulan}&created_at=lt.${endBulan}&order=created_at.desc`),
      ]);
      setHandledClients(clientsRows);
      setKunjunganBulanIni(kunjunganRows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  function jumlahKunjungan(clientId) {
    return kunjunganBulanIni.filter((k) => k.client_id === clientId).length;
  }

  function riwayatToko(clientId) {
    return kunjunganBulanIni.filter((k) => k.client_id === clientId);
  }

  // Cek apakah toko ini sudah dikunjungi (difoto) HARI INI juga
  function sudahKunjunganHariIni(clientId) {
    const todayStr = new Date().toDateString();
    return kunjunganBulanIni.some((k) => k.client_id === clientId && new Date(k.created_at).toDateString() === todayStr);
  }

  function mulaiCheckin(client) {
    if (sudahKunjunganHariIni(client.id)) {
      alert(`Anda sudah membuat laporan kunjungan untuk ${client.nama} hari ini. Silakan coba lagi besok.`);
      return;
    }
    setSelectedClient(client);
    setMode("checkin");
    setLocationError("");
    setCoords(null);
    setGettingLocation(true);

    if (!navigator.geolocation) {
      setLocationError("HP/browser ini tidak mendukung deteksi lokasi.");
      setGettingLocation(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGettingLocation(false);
      },
      (err) => {
        setLocationError("Gagal ambil lokasi: " + err.message + " - pastikan izin lokasi diizinkan.");
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  // Ambil foto dari kamera, tempel watermark koordinat+waktu+nama toko di
  // atas fotonya (pakai canvas), baru upload hasilnya.
  async function handleFotoSelfie(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file || !coords) return;
    setUploading(true);
    try {
      const img = await loadImageFromFile(file);
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      // Coba tempel potongan peta asli (real map tile) di pojok kanan atas -
      // pakai layanan komunitas OSM yang gratis tanpa API key. Kalau gagal
      // (server sibuk/CORS/dll), lanjut saja tanpa peta - jangan sampai
      // proses check-in gagal gara-gara ini.
      const mapSize = Math.round(Math.min(img.width, img.height) * 0.32);
      try {
        const mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${coords.lat},${coords.lng}&zoom=16&size=${mapSize}x${mapSize}&maptype=mapnik`;
        const mapRes = await fetch(mapUrl, { mode: "cors" });
        if (!mapRes.ok) throw new Error("gagal ambil peta");
        const mapBlob = await mapRes.blob();
        const mapImg = await loadImageFromFile(mapBlob);
        const mx = img.width - mapSize - 14;
        const my = 14;
        // Bingkai putih + bayangan tipis di sekeliling potongan peta
        ctx.fillStyle = "#fff";
        ctx.fillRect(mx - 4, my - 4, mapSize + 8, mapSize + 8);
        ctx.drawImage(mapImg, mx, my, mapSize, mapSize);
        // Titik penanda merah di TENGAH potongan peta (lokasi persis)
        ctx.beginPath();
        ctx.arc(mx + mapSize / 2, my + mapSize / 2, 7, 0, Math.PI * 2);
        ctx.fillStyle = "#E4453A";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(mx + mapSize / 2, my + mapSize / 2, 7, 0, Math.PI * 2);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
      } catch (mapErr) {
        console.log("Peta asli gagal dimuat, lanjut tanpa peta:", mapErr.message);
      }

      // Watermark di bagian bawah foto (teks + ikon pin peta)
      const barHeight = Math.max(90, img.height * 0.12);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, img.height - barHeight, img.width, barHeight);

      // Gambar ikon pin peta (bentuk teardrop) di kiri watermark
      const pinSize = barHeight * 0.55;
      const pinCenterX = 14 + pinSize / 2;
      const pinCenterY = img.height - barHeight / 2;
      ctx.save();
      ctx.translate(pinCenterX, pinCenterY - pinSize * 0.15);
      ctx.beginPath();
      // Kepala pin (lingkaran)
      ctx.arc(0, 0, pinSize / 2, Math.PI * 1.15, Math.PI * 1.85);
      // Ujung pin lancip ke bawah
      ctx.lineTo(0, pinSize * 0.75);
      ctx.closePath();
      ctx.fillStyle = "#E4453A";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -pinSize * 0.05, pinSize * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.restore();

      // Teks di sebelah kanan ikon pin
      const textX = 14 + pinSize + 14;
      ctx.fillStyle = "#fff";
      const fontSize = Math.max(14, Math.round(img.width / 40));
      ctx.font = `bold ${fontSize}px sans-serif`;
      const waktu = new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
      ctx.fillText(`${selectedClient.nama} (${selectedClient.kode})`, textX, img.height - barHeight + fontSize + 10);
      ctx.font = `${Math.round(fontSize * 0.82)}px sans-serif`;
      ctx.fillText(`${waktu}`, textX, img.height - barHeight + fontSize * 2 + 14);
      ctx.fillText(`Lat: ${coords.lat.toFixed(6)}, Long: ${coords.lng.toFixed(6)}`, textX, img.height - barHeight + fontSize * 3 + 18);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      const filePath = `kunjungan-${profile.sales_id}-${selectedClient.id}-${Date.now()}.jpg`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/produk-gambar/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" },
        body: blob,
      });
      if (!res.ok) throw new Error(await res.text());
      const url = `${SUPABASE_URL}/storage/v1/object/public/produk-gambar/${filePath}`;

      await supabaseFetch(token, "kunjungan_sales", {
        method: "POST",
        body: JSON.stringify({
          sales_id: profile.sales_id, client_id: selectedClient.id,
          foto_url: url, latitude: coords.lat, longitude: coords.lng,
        }),
      });

      await load();
      setMode(null);
      setSelectedClient(null);
    } catch (e) {
      alert("Gagal simpan kunjungan: " + e.message);
    }
    setUploading(false);
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  // ---------- TAMPILAN RIWAYAT KUNJUNGAN 1 TOKO ----------
  if (mode === "riwayat" && selectedClient) {
    const riwayat = riwayatToko(selectedClient.id);
    return (
      <div>
        <button onClick={() => { setMode(null); setSelectedClient(null); }} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#6B6F75", fontSize: 13, marginBottom: 14, padding: 0 }}>
          <ChevronLeft size={16} /> Kembali
        </button>
        <PageHeader title={`Riwayat Kunjungan - ${selectedClient.nama}`} subtitle={`${riwayat.length}/${TARGET_KUNJUNGAN_PER_BULAN} kunjungan bulan ini`} />
        {riwayat.length === 0 && <EmptyState text="Belum ada kunjungan ke toko ini bulan ini." />}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
          {riwayat.map((k) => (
            <Card key={k.id} style={{ padding: 12 }}>
              <img src={k.foto_url} alt="Selfie kunjungan" style={{ width: "100%", borderRadius: 10, marginBottom: 8, display: "block" }} />
              <p style={{ fontSize: 11.5, color: "#6B6F75", margin: "0 0 6px" }}>{new Date(k.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>
              {k.latitude && (
                <a href={`https://www.google.com/maps?q=${k.latitude},${k.longitude}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: "#2C5985", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                  <MapPin size={12} /> Lihat di Maps
                </a>
              )}
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ---------- TAMPILAN PROSES CHECK-IN ----------
  if (mode === "checkin" && selectedClient) {
    return (
      <div>
        <button onClick={() => { setMode(null); setSelectedClient(null); }} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#6B6F75", fontSize: 13, marginBottom: 14, padding: 0 }}>
          <ChevronLeft size={16} /> Batal
        </button>
        <PageHeader title={`Kunjungi ${selectedClient.nama}`} subtitle={selectedClient.alamat || selectedClient.kode} />
        <Card style={{ maxWidth: 420 }}>
          {gettingLocation ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <Loader2 size={28} className="spin" />
              <p style={{ fontSize: 13, color: "#6B6F75", marginTop: 12 }}>Mendeteksi lokasi Anda...</p>
            </div>
          ) : locationError ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBEAEA", color: "#C0392B", padding: 12, borderRadius: 9, fontSize: 12.5, marginBottom: 14 }}>
                <AlertCircle size={16} /> {locationError}
              </div>
              <button onClick={() => mulaiCheckin(selectedClient)} style={{ padding: "10px 18px", borderRadius: 9, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13 }}>
                Coba Lagi
              </button>
            </div>
          ) : coords ? (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#D8E9E6", color: "#28685D", padding: 12, borderRadius: 9, fontSize: 12.5, marginBottom: 18, fontWeight: 600 }}>
                <Check size={16} /> Lokasi terdeteksi: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
              </div>
              <p style={{ fontSize: 12.5, color: "#6B6F75", marginBottom: 14 }}>
                Sekarang ambil foto selfie di lokasi toko ini. Koordinat & waktu akan otomatis ditempel di foto.
              </p>
              <input ref={fileInputRef} type="file" accept="image/*" capture="user" style={{ display: "none" }} onChange={handleFotoSelfie} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: uploading ? "#E4E1DA" : "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                <Camera size={18} /> {uploading ? "Menyimpan..." : "Ambil Foto Selfie"}
              </button>
            </div>
          ) : null}
        </Card>
      </div>
    );
  }

  // ---------- TAMPILAN DAFTAR TOKO ----------
  return (
    <div>
      <PageHeader title="Laporan Kunjungan" subtitle={`Target: setiap toko dikunjungi ${TARGET_KUNJUNGAN_PER_BULAN}x per bulan`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {handledClients.map((c) => {
          const jumlah = jumlahKunjungan(c.id);
          const tercapai = jumlah >= TARGET_KUNJUNGAN_PER_BULAN;
          return (
            <Card key={c.id}>
              <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 2px", fontWeight: 700 }}>{c.kode}</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#24272B", margin: "0 0 10px" }}>{c.nama}</p>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#6B6F75" }}>Kunjungan bulan ini</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: tercapai ? "#28685D" : "#24272B" }}>{jumlah}/{TARGET_KUNJUNGAN_PER_BULAN}</span>
              </div>
              <div style={{ width: "100%", height: 8, background: "#F7F5F1", borderRadius: 999, overflow: "hidden", marginBottom: 14 }}>
                <div style={{ width: `${Math.min(100, (jumlah / TARGET_KUNJUNGAN_PER_BULAN) * 100)}%`, height: "100%", background: tercapai ? "#28685D" : "#E8A426" }} />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => mulaiCheckin(c)}
                  style={{
                    flex: 1, padding: "9px", borderRadius: 9, border: "none",
                    background: sudahKunjunganHariIni(c.id) ? "#F7F5F1" : "#E8A426",
                    color: sudahKunjunganHariIni(c.id) ? "#9CA0A6" : "#24272B",
                    fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  }}
                >
                  <Camera size={13} /> {sudahKunjunganHariIni(c.id) ? "Sudah Hari Ini" : "Kunjungi"}
                </button>
                <button onClick={() => { setSelectedClient(c); setMode("riwayat"); }} style={{ flex: 1, padding: "9px", borderRadius: 9, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 12, fontWeight: 600 }}>
                  Riwayat
                </button>
              </div>
            </Card>
          );
        })}
      </div>
      {handledClients.length === 0 && <EmptyState text="Belum ada toko yang Anda handle." />}
    </div>
  );
}

// ============================================================
// BIAYA OPERASIONAL (hitung laba kotor & kelola biaya operasional)
// ============================================================
function BiayaOperasionalPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [biayaList, setBiayaList] = useState([]);
  const [labaKotorBulanIni, setLabaKotorBulanIni] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [form, setForm] = useState({
    tanggal: now.toISOString().slice(0, 10), kategori: "", jumlah: "", keterangan: "", berulang: false,
  });

  const BULAN = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  useEffect(() => { load(); }, [filterYear, filterMonth]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const startBulan = `${filterYear}-${String(filterMonth).padStart(2, "0")}-01`;
      const nextMonth = filterMonth === 12 ? 1 : filterMonth + 1;
      const nextYear = filterMonth === 12 ? filterYear + 1 : filterYear;
      const endBulan = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

      let [biayaRows, keuanganRows] = await Promise.all([
        supabaseFetch(token, `biaya_operasional?select=*&tanggal=gte.${startBulan}&tanggal=lt.${endBulan}&order=tanggal.desc`),
        supabaseFetch(token, `v_laporan_keuangan_bulanan?select=laba_kotor&bulan=eq.${startBulan}`),
      ]);

      // Kalau bulan ini belum ada data sama sekali, cek bulan SEBELUMNYA -
      // salin otomatis semua biaya yang ditandai "berulang" ke bulan ini
      // (sebagai baris baru yang berdiri sendiri, supaya tetap bisa
      // diedit/dihapus per bulan tanpa memengaruhi bulan lain).
      if (biayaRows.length === 0) {
        const prevMonth = filterMonth === 1 ? 12 : filterMonth - 1;
        const prevYear = filterMonth === 1 ? filterYear - 1 : filterYear;
        const prevStart = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
        const prevEnd = startBulan;
        const biayaBerulangBulanLalu = await supabaseFetch(
          token,
          `biaya_operasional?select=*&tanggal=gte.${prevStart}&tanggal=lt.${prevEnd}&berulang=eq.true`
        );
        if (biayaBerulangBulanLalu.length > 0) {
          const salinan = biayaBerulangBulanLalu.map((b) => {
            const tgl = new Date(b.tanggal);
            const tanggalBaru = `${filterYear}-${String(filterMonth).padStart(2, "0")}-${String(tgl.getDate()).padStart(2, "0")}`;
            return { tanggal: tanggalBaru, kategori: b.kategori, jumlah: b.jumlah, keterangan: b.keterangan, berulang: true };
          });
          await supabaseFetch(token, "biaya_operasional", { method: "POST", body: JSON.stringify(salinan) });
          biayaRows = await supabaseFetch(token, `biaya_operasional?select=*&tanggal=gte.${startBulan}&tanggal=lt.${endBulan}&order=tanggal.desc`);
        }
      }

      setBiayaList(biayaRows);
      setLabaKotorBulanIni(Number(keuanganRows[0]?.laba_kotor || 0));
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  function resetForm() {
    setForm({ tanggal: now.toISOString().slice(0, 10), kategori: "", jumlah: "", keterangan: "", berulang: false });
    setEditingId(null);
  }

  function startEdit(b) {
    setEditingId(b.id);
    setForm({ tanggal: b.tanggal, kategori: b.kategori, jumlah: b.jumlah, keterangan: b.keterangan || "", berulang: b.berulang || false });
  }

  async function submitForm() {
    if (!form.tanggal || !form.kategori.trim() || !form.jumlah) {
      alert("Isi dulu tanggal, kategori, dan jumlahnya.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        tanggal: form.tanggal, kategori: form.kategori.trim(),
        jumlah: Number(form.jumlah), keterangan: form.keterangan || null, berulang: form.berulang,
      };
      if (editingId) {
        await supabaseFetch(token, `biaya_operasional?id=eq.${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await supabaseFetch(token, "biaya_operasional", { method: "POST", body: JSON.stringify(body) });
      }
      resetForm();
      await load();
    } catch (e) {
      alert("Gagal simpan: " + e.message);
    }
    setSaving(false);
  }

  async function hapusBiaya(id) {
    if (!confirm("Hapus catatan biaya ini?")) return;
    try {
      await supabaseFetch(token, `biaya_operasional?id=eq.${id}`, { method: "DELETE" });
      setBiayaList((prev) => prev.filter((b) => b.id !== id));
    } catch (e) {
      alert("Gagal hapus: " + e.message);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const totalBiayaBulanIni = biayaList.reduce((sum, b) => sum + Number(b.jumlah || 0), 0);
  const labaBersih = labaKotorBulanIni - totalBiayaBulanIni;
  const yearsAvailable = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const fieldStyle = { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, outline: "none" };
  const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" };

  return (
    <div>
      <PageHeader title="Biaya Operasional" subtitle="Hitung laba kotor & kelola biaya operasional bulanan" />

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, background: "#fff" }}>
          {yearsAvailable.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, background: "#fff" }}>
          {BULAN.slice(1).map((b, i) => <option key={i + 1} value={i + 1}>{b}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card>
          <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Laba Kotor</p>
          <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#24272B", margin: 0 }}>{rupiah(labaKotorBulanIni)}</p>
        </Card>
        <Card>
          <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Total Biaya Operasional</p>
          <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#C0392B", margin: 0 }}>{rupiah(totalBiayaBulanIni)}</p>
        </Card>
        <Card>
          <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Laba Bersih</p>
          <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: labaBersih >= 0 ? "#28685D" : "#C0392B", margin: 0 }}>{rupiah(labaBersih)}</p>
        </Card>
      </div>

      <Card style={{ maxWidth: 560, marginBottom: 24 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: "0 0 14px" }}>{editingId ? "Edit Biaya" : "Tambah Biaya Operasional"}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Tanggal</label>
            <input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Kategori</label>
            <input value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })} placeholder="misal Sewa Gudang, Gaji, Listrik" style={fieldStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Jumlah (Rp)</label>
          <input type="number" value={form.jumlah} onChange={(e) => setForm({ ...form, jumlah: e.target.value })} style={fieldStyle} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Keterangan (opsional)</label>
          <input value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} style={fieldStyle} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#24272B", cursor: "pointer" }}>
            <input type="checkbox" checked={form.berulang} onChange={(e) => setForm({ ...form, berulang: e.target.checked })} />
            Ulangi tiap bulan (otomatis muncul lagi bulan depan, tanpa perlu input ulang)
          </label>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={submitForm} disabled={saving} style={{ padding: "11px 22px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}>
            {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Tambah Biaya"}
          </button>
          {editingId && (
            <button onClick={resetForm} style={{ padding: "11px 22px", borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
              Batal
            </button>
          )}
        </div>
      </Card>

      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>Daftar Biaya {BULAN[filterMonth]} {filterYear}</h2>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Tanggal", "Kategori", "Jumlah", "Keterangan", ""].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {biayaList.map((b) => (
              <tr key={b.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                <td style={{ padding: "12px 14px" }}>{new Date(b.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                <td style={{ padding: "12px 14px", fontWeight: 600 }}>
                  {b.kategori}
                  {b.berulang && (
                    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#4A6B4A", background: "#D8E9E6", padding: "2px 7px", borderRadius: 999 }}>Berulang</span>
                  )}
                </td>
                <td style={{ padding: "12px 14px", fontWeight: 700 }}>{rupiah(b.jumlah)}</td>
                <td style={{ padding: "12px 14px", color: "#6B6F75" }}>{b.keterangan || "-"}</td>
                <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => startEdit(b)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 11, fontWeight: 600 }}>
                      Edit
                    </button>
                    <button onClick={() => hapusBiaya(b.id)} style={{ padding: "6px 10px", borderRadius: 7, border: "none", background: "none", color: "#C0392B", fontSize: 11, fontWeight: 700 }}>
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {biayaList.length === 0 && <EmptyState text="Belum ada biaya operasional bulan ini." />}
      </Card>
    </div>
  );
}

// ============================================================
// PAJAK (PPh Final UMKM 0.5% + status pembayaran per bulan)
// ============================================================
function PajakPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [pembayaran, setPembayaran] = useState([]);
  const [saving, setSaving] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [keuanganRows, pembayaranRows] = await Promise.all([
        supabaseFetch(token, "v_laporan_keuangan_bulanan?select=bulan,omzet_bersih,pph_final_umkm&order=bulan.desc&limit=12"),
        supabaseFetch(token, "pajak_pembayaran?select=*"),
      ]);
      setRows(keuanganRows);
      setPembayaran(pembayaranRows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function statusBulan(bulan) {
    return pembayaran.find((p) => p.bulan === bulan);
  }

  async function toggleBayar(bulan) {
    setSaving(bulan);
    try {
      const existing = statusBulan(bulan);
      const sudahDibayarBaru = !(existing?.sudah_dibayar);
      const body = {
        bulan, sudah_dibayar: sudahDibayarBaru,
        tanggal_bayar: sudahDibayarBaru ? new Date().toISOString().slice(0, 10) : null,
      };
      const [updated] = await supabaseFetch(token, `pajak_pembayaran?on_conflict=bulan`, {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: JSON.stringify(body),
      });
      setPembayaran((prev) => {
        const others = prev.filter((p) => p.bulan !== bulan);
        return [...others, updated];
      });
    } catch (e) {
      alert("Gagal update status: " + e.message);
    }
    setSaving(null);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const tahunIni = new Date().getFullYear();
  const rowsTahunIni = rows.filter((r) => new Date(r.bulan).getFullYear() === tahunIni);
  const totalPajakTahunIni = rowsTahunIni.reduce((sum, r) => sum + Number(r.pph_final_umkm || 0), 0);
  const sudahDibayarCount = rowsTahunIni.filter((r) => statusBulan(r.bulan)?.sudah_dibayar).length;
  const belumDibayarCount = rowsTahunIni.length - sudahDibayarCount;

  return (
    <div>
      <PageHeader title="Pajak" subtitle="Perhitungan PPh Final UMKM (0,5% dari omzet bersih) & status pembayaran" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        <Card>
          <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Total Pajak Tahun {tahunIni}</p>
          <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#24272B", margin: 0 }}>{rupiah(totalPajakTahunIni)}</p>
        </Card>
        <Card>
          <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Bulan Sudah Dibayar</p>
          <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#28685D", margin: 0 }}>{sudahDibayarCount}</p>
        </Card>
        <Card>
          <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Bulan Belum Dibayar</p>
          <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: belumDibayarCount > 0 ? "#C0392B" : "#24272B", margin: 0 }}>{belumDibayarCount}</p>
        </Card>
      </div>

      <p style={{ fontSize: 12, color: "#9CA0A6", marginBottom: 14 }}>
        Perhitungan mengikuti ketentuan <strong>PPh Final UMKM 0,5%</strong> dari omzet bersih bulanan (PP 55/2022) - berlaku untuk UMKM dengan omzet di bawah Rp4,8 miliar/tahun. Ini bukan nasihat pajak resmi; konsultasikan dengan konsultan pajak/kantor pajak untuk kepastian kewajiban perpajakan Anda.
      </p>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Bulan", "Omzet Bersih", "PPh Final (0,5%)", "Status", ""].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const status = statusBulan(r.bulan);
              const lunas = status?.sudah_dibayar;
              return (
                <tr key={r.bulan} style={{ borderTop: "1px solid #EDEAE3" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 600 }}>{new Date(r.bulan).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</td>
                  <td style={{ padding: "12px 14px" }}>{rupiah(r.omzet_bersih)}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 700 }}>{rupiah(r.pph_final_umkm)}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: lunas ? "#D8E9E6" : "#FBEAEA", color: lunas ? "#28685D" : "#C0392B" }}>
                      {lunas ? `Lunas (${new Date(status.tanggal_bayar).toLocaleDateString("id-ID")})` : "Belum Bayar"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <button
                      onClick={() => toggleBayar(r.bulan)}
                      disabled={saving === r.bulan}
                      style={{ padding: "6px 12px", borderRadius: 7, border: lunas ? "1px solid #E4E1DA" : "none", background: lunas ? "#fff" : "#E8A426", color: lunas ? "#6B6F75" : "#24272B", fontSize: 11, fontWeight: 700 }}
                    >
                      {saving === r.bulan ? "..." : lunas ? "Batalkan" : "Tandai Lunas"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState text="Belum ada data transaksi." />}
      </Card>
    </div>
  );
}

// ============================================================
// BUNGA INVESTOR (khusus Owner) - kelola investor & lacak bunga bulanan
// ============================================================
function BungaInvestorPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [investors, setInvestors] = useState([]);
  const [pembayaranSemua, setPembayaranSemua] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState(null);
  const [selectedInvestor, setSelectedInvestor] = useState(null); // buka riwayat bunga investor ini
  const [saving, setSaving] = useState(false);
  const [savingBulan, setSavingBulan] = useState(null);
  const [form, setForm] = useState({ nama: "", modalInvestasi: "", bungaPersen: "", tanggalMulai: "", keterangan: "" });
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const BULAN = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rows, pembayaranRows] = await Promise.all([
        supabaseFetch(token, "investors?select=*&order=nama.asc"),
        supabaseFetch(token, "bunga_investor_pembayaran?select=*"),
      ]);
      setInvestors(rows);
      setPembayaranSemua(pembayaranRows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const bulanTerpilih = `${filterYear}-${String(filterMonth).padStart(2, "0")}-01`;

  // Hitung bunga untuk bulan tertentu - kalau bulan itu adalah bulan
  // PERTAMA investor mulai invest (dan mulainya bukan tanggal 1), bunganya
  // dihitung PRO-RATA sesuai sisa hari di bulan itu, bukan full 1 bulan.
  function hitungBungaBulan(investor, bulan) {
    const bungaFull = Number(investor.modal_investasi) * (Number(investor.bunga_persen) / 100);
    if (!investor.tanggal_mulai) return bungaFull;

    const mulai = new Date(investor.tanggal_mulai + "T00:00:00");
    const bulanDate = new Date(bulan + "T00:00:00");
    const sameMonth = mulai.getFullYear() === bulanDate.getFullYear() && mulai.getMonth() === bulanDate.getMonth();
    if (!sameMonth) return bungaFull;

    const totalHariBulan = new Date(mulai.getFullYear(), mulai.getMonth() + 1, 0).getDate();
    const tanggalMulaiHari = mulai.getDate();
    if (tanggalMulaiHari <= 1) return bungaFull; // mulai tanggal 1, tidak perlu pro-rata

    const sisaHari = totalHariBulan - tanggalMulaiHari + 1;
    return bungaFull * (sisaHari / totalHariBulan);
  }

  function statusInvestorBulan(investorId, bulan) {
    return pembayaranSemua.find((p) => p.investor_id === investorId && p.bulan === bulan);
  }

  async function toggleBayarGabungan(investor, bulan) {
    setSavingBulan(investor.id);
    try {
      const bungaPerBulan = hitungBungaBulan(investor, bulan);
      const existing = statusInvestorBulan(investor.id, bulan);
      const sudahDibayarBaru = !(existing?.sudah_dibayar);
      const body = {
        investor_id: investor.id, bulan, jumlah_bunga: bungaPerBulan,
        sudah_dibayar: sudahDibayarBaru,
        tanggal_bayar: sudahDibayarBaru ? new Date().toISOString().slice(0, 10) : null,
      };
      const [updated] = await supabaseFetch(token, "bunga_investor_pembayaran?on_conflict=investor_id,bulan", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: JSON.stringify(body),
      });
      setPembayaranSemua((prev) => [...prev.filter((p) => !(p.investor_id === investor.id && p.bulan === bulan)), updated]);
    } catch (e) {
      alert("Gagal update status: " + e.message);
    }
    setSavingBulan(null);
  }

  function bukaFormBaru() {
    setEditingInvestor(null);
    setForm({ nama: "", modalInvestasi: "", bungaPersen: "", tanggalMulai: new Date().toISOString().slice(0, 10), keterangan: "" });
    setShowForm(true);
  }

  function bukaFormEdit(inv) {
    setEditingInvestor(inv);
    setForm({
      nama: inv.nama, modalInvestasi: inv.modal_investasi, bungaPersen: inv.bunga_persen,
      tanggalMulai: inv.tanggal_mulai || "", keterangan: inv.keterangan || "",
    });
    setShowForm(true);
  }

  async function simpanInvestor() {
    if (!form.nama.trim() || !form.modalInvestasi || !form.bungaPersen) {
      alert("Isi dulu nama, modal investasi, dan persen bunga.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        nama: form.nama.trim(), modal_investasi: Number(form.modalInvestasi),
        bunga_persen: Number(form.bungaPersen), tanggal_mulai: form.tanggalMulai || null,
        keterangan: form.keterangan || null,
      };
      if (editingInvestor) {
        await supabaseFetch(token, `investors?id=eq.${editingInvestor.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await supabaseFetch(token, "investors", { method: "POST", body: JSON.stringify(body) });
      }
      setShowForm(false);
      await load();
    } catch (e) {
      alert("Gagal simpan: " + e.message);
    }
    setSaving(false);
  }

  async function hapusInvestor(id) {
    if (!confirm("Hapus investor ini? Riwayat pembayaran bunganya juga akan terhapus.")) return;
    try {
      await supabaseFetch(token, `investors?id=eq.${id}`, { method: "DELETE" });
      setInvestors((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      alert("Gagal hapus: " + e.message);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const fieldStyle = { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, outline: "none" };
  const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" };

  // ---------- HALAMAN RIWAYAT BUNGA 1 INVESTOR ----------
  if (selectedInvestor) {
    return <RiwayatBungaInvestorPage token={token} investor={selectedInvestor} onBack={() => setSelectedInvestor(null)} />;
  }

  // ---------- HALAMAN DAFTAR INVESTOR ----------
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
        <PageHeader title="Bunga Investor" subtitle="Kelola investor dan lacak pembayaran bunga bulanan" />
        <button onClick={bukaFormBaru} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5, flexShrink: 0 }}>
          <PackagePlus size={16} /> Tambah Investor
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, background: "#fff" }}>
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, background: "#fff" }}>
          {BULAN.slice(1).map((b, i) => <option key={i + 1} value={i + 1}>{b}</option>)}
        </select>
      </div>

      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>Daftar Bunga {BULAN[filterMonth]} {filterYear}</h2>
      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 28 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Investor", "Modal", "Bunga %", "Jumlah Bunga", "Status", ""].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {investors
              .filter((inv) => !inv.tanggal_mulai || inv.tanggal_mulai <= bulanTerpilih || inv.tanggal_mulai.slice(0, 7) === bulanTerpilih.slice(0, 7))
              .map((inv) => {
              const bungaPerBulan = hitungBungaBulan(inv, bulanTerpilih);
              const status = statusInvestorBulan(inv.id, bulanTerpilih);
              const lunas = status?.sudah_dibayar;
              return (
                <tr key={inv.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 700 }}>{inv.nama}</td>
                  <td style={{ padding: "12px 14px" }}>{rupiah(inv.modal_investasi)}</td>
                  <td style={{ padding: "12px 14px" }}>{inv.bunga_persen}%</td>
                  <td style={{ padding: "12px 14px", fontWeight: 700 }}>{rupiah(bungaPerBulan)}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: lunas ? "#D8E9E6" : "#FBEAEA", color: lunas ? "#28685D" : "#C0392B" }}>
                      {lunas ? `Lunas (${new Date(status.tanggal_bayar).toLocaleDateString("id-ID")})` : "Belum Bayar"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <button
                      onClick={() => toggleBayarGabungan(inv, bulanTerpilih)}
                      disabled={savingBulan === inv.id}
                      style={{ padding: "6px 12px", borderRadius: 7, border: lunas ? "1px solid #E4E1DA" : "none", background: lunas ? "#fff" : "#E8A426", color: lunas ? "#6B6F75" : "#24272B", fontSize: 11, fontWeight: 700 }}
                    >
                      {savingBulan === inv.id ? "..." : lunas ? "Batalkan" : "Tandai Lunas"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {investors.length === 0 && <EmptyState text="Belum ada investor." />}
      </Card>

      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>Kelola Investor</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {investors.map((inv) => {
          const bungaPerBulan = Number(inv.modal_investasi) * (Number(inv.bunga_persen) / 100);
          return (
            <Card key={inv.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#24272B", margin: 0 }}>{inv.nama}</p>
                {!inv.aktif && <span style={{ fontSize: 10, fontWeight: 700, color: "#9CA0A6", background: "#F7F5F1", padding: "2px 8px", borderRadius: 999 }}>Nonaktif</span>}
              </div>
              <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 4px" }}>Modal Investasi</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#24272B", margin: "0 0 10px" }}>{rupiah(inv.modal_investasi)}</p>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 11, color: "#9CA0A6", margin: 0 }}>Bunga/Bulan</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: 0 }}>{inv.bunga_persen}%</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#9CA0A6", margin: 0 }}>Jumlah Bunga</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#28685D", margin: 0 }}>{rupiah(bungaPerBulan)}</p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setSelectedInvestor(inv)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: "#E8A426", color: "#24272B", fontSize: 12, fontWeight: 700 }}>
                  Riwayat Bunga
                </button>
                <button onClick={() => bukaFormEdit(inv)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 12, fontWeight: 600 }}>
                  Edit
                </button>
                <button onClick={() => hapusInvestor(inv.id)} style={{ padding: "8px 12px", borderRadius: 8, border: "none", background: "none", color: "#C0392B", fontSize: 12, fontWeight: 700 }}>
                  Hapus
                </button>
              </div>
            </Card>
          );
        })}
      </div>
      {investors.length === 0 && <EmptyState text="Belum ada investor. Klik 'Tambah Investor' untuk mulai." />}

      {investors.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h2 className="disp" style={{ fontSize: 16, fontWeight: 700, color: "#28685D", margin: "0 0 12px" }}>
            Sudah Dibayar - Tahun {filterYear}
          </h2>
          <Card style={{ padding: 0, overflow: "hidden" }}>
            {(() => {
              const barisLunas = [];
              for (let bulanKe = 1; bulanKe <= 12; bulanKe++) {
                const bulanIni = `${filterYear}-${String(bulanKe).padStart(2, "0")}-01`;
                investors.forEach((inv) => {
                  const sudahMulai = !inv.tanggal_mulai || inv.tanggal_mulai <= bulanIni || inv.tanggal_mulai.slice(0, 7) === bulanIni.slice(0, 7);
                  if (!sudahMulai) return;
                  const status = statusInvestorBulan(inv.id, bulanIni);
                  if (status?.sudah_dibayar) {
                    barisLunas.push({ inv, bulan: bulanIni, status, bunga: hitungBungaBulan(inv, bulanIni) });
                  }
                });
              }
              if (barisLunas.length === 0) {
                return <EmptyState text="Belum ada yang dibayar tahun ini." />;
              }
              return barisLunas.map((r, idx) => (
                <div key={`${r.inv.id}-${r.bulan}`} style={{ padding: "12px 16px", borderTop: idx > 0 ? "1px solid #EDEAE3" : "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: 0 }}>{r.inv.nama} - {new Date(r.bulan).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</p>
                    <p style={{ fontSize: 11, color: "#9CA0A6", margin: 0 }}>Dibayar {new Date(r.status.tanggal_bayar).toLocaleDateString("id-ID")}</p>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#28685D" }}>{rupiah(r.bunga)}</span>
                </div>
              ));
            })()}
          </Card>
        </div>
      )}

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: 480, maxHeight: "88vh", overflowY: "auto", padding: 28 }}>
            <h2 className="disp" style={{ fontSize: 20, fontWeight: 700, color: "#24272B", margin: "0 0 18px" }}>
              {editingInvestor ? `Edit Investor - ${editingInvestor.nama}` : "Tambah Investor"}
            </h2>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Nama Investor</label>
              <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} style={fieldStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Modal Investasi (Rp)</label>
                <input type="number" value={form.modalInvestasi} onChange={(e) => setForm({ ...form, modalInvestasi: e.target.value })} style={fieldStyle} />
              </div>
              <div>
                <label style={labelStyle}>Bunga per Bulan (%)</label>
                <input type="number" step="0.0001" value={form.bungaPersen} onChange={(e) => setForm({ ...form, bungaPersen: e.target.value })} placeholder="misal 0.8333" style={fieldStyle} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Tanggal Mulai Investasi</label>
              <input type="date" value={form.tanggalMulai} onChange={(e) => setForm({ ...form, tanggalMulai: e.target.value })} style={fieldStyle} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Keterangan (opsional)</label>
              <textarea value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} rows={2} style={{ ...fieldStyle, resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13 }}>
                Batal
              </button>
              <button onClick={simpanInvestor} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13 }}>
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// RIWAYAT BUNGA 1 INVESTOR (12 bulan terakhir + status bayar)
// ============================================================
function RiwayatBungaInvestorPage({ token, investor, onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pembayaran, setPembayaran] = useState([]);
  const [saving, setSaving] = useState(null);

  const bulanList = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    return d.toISOString().slice(0, 10).slice(0, 8) + "01";
  }).reverse();

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, `bunga_investor_pembayaran?select=*&investor_id=eq.${investor.id}`);
      setPembayaran(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function hitungBungaBulan(bulan) {
    const bungaFull = Number(investor.modal_investasi) * (Number(investor.bunga_persen) / 100);
    if (!investor.tanggal_mulai) return bungaFull;

    const mulai = new Date(investor.tanggal_mulai + "T00:00:00");
    const bulanDate = new Date(bulan + "T00:00:00");
    const sameMonth = mulai.getFullYear() === bulanDate.getFullYear() && mulai.getMonth() === bulanDate.getMonth();
    if (!sameMonth) return bungaFull;

    const totalHariBulan = new Date(mulai.getFullYear(), mulai.getMonth() + 1, 0).getDate();
    const tanggalMulaiHari = mulai.getDate();
    if (tanggalMulaiHari <= 1) return bungaFull;

    const sisaHari = totalHariBulan - tanggalMulaiHari + 1;
    return bungaFull * (sisaHari / totalHariBulan);
  }

  function statusBulan(bulan) {
    return pembayaran.find((p) => p.bulan === bulan);
  }

  async function toggleBayar(bulan) {
    setSaving(bulan);
    try {
      const bungaPerBulan = hitungBungaBulan(bulan);
      const existing = statusBulan(bulan);
      const sudahDibayarBaru = !(existing?.sudah_dibayar);
      const body = {
        investor_id: investor.id, bulan, jumlah_bunga: bungaPerBulan,
        sudah_dibayar: sudahDibayarBaru,
        tanggal_bayar: sudahDibayarBaru ? new Date().toISOString().slice(0, 10) : null,
      };
      const [updated] = await supabaseFetch(token, "bunga_investor_pembayaran?on_conflict=investor_id,bulan", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: JSON.stringify(body),
      });
      setPembayaran((prev) => [...prev.filter((p) => p.bulan !== bulan), updated]);
    } catch (e) {
      alert("Gagal update status: " + e.message);
    }
    setSaving(null);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#6B6F75", fontSize: 13, marginBottom: 14, padding: 0 }}>
        <ChevronLeft size={16} /> Kembali
      </button>
      <PageHeader title={`Riwayat Bunga - ${investor.nama}`} subtitle={`Modal ${rupiah(investor.modal_investasi)} - Bunga ${investor.bunga_persen}%/bulan (${rupiah(Number(investor.modal_investasi) * (Number(investor.bunga_persen) / 100))})`} />

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Bulan", "Jumlah Bunga", "Status", ""].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bulanList.map((bulan) => {
              const bungaPerBulan = hitungBungaBulan(bulan);
              const status = statusBulan(bulan);
              const lunas = status?.sudah_dibayar;
              return (
                <tr key={bulan} style={{ borderTop: "1px solid #EDEAE3" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 600 }}>{new Date(bulan).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 700 }}>{rupiah(bungaPerBulan)}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: lunas ? "#D8E9E6" : "#FBEAEA", color: lunas ? "#28685D" : "#C0392B" }}>
                      {lunas ? `Lunas (${new Date(status.tanggal_bayar).toLocaleDateString("id-ID")})` : "Belum Bayar"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <button
                      onClick={() => toggleBayar(bulan)}
                      disabled={saving === bulan}
                      style={{ padding: "6px 12px", borderRadius: 7, border: lunas ? "1px solid #E4E1DA" : "none", background: lunas ? "#fff" : "#E8A426", color: lunas ? "#6B6F75" : "#24272B", fontSize: 11, fontWeight: 700 }}
                    >
                      {saving === bulan ? "..." : lunas ? "Batalkan" : "Tandai Lunas"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ============================================================
// BANNER PROMO (khusus Owner) - kelola foto/GIF widget kampanye mengambang
// ============================================================
function BannerPromoPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [bannerId, setBannerId] = useState(null);
  const [form, setForm] = useState({ gambarUrl: "", judul: "", deskripsi: "", aktif: false });
  const [galeri, setGaleri] = useState([]);
  const [uploadingGaleri, setUploadingGaleri] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rows, galeriRows] = await Promise.all([
        supabaseFetch(token, "campaign_banner?select=*&limit=1"),
        supabaseFetch(token, "campaign_banner_images?select=*&order=urutan.asc"),
      ]);
      const b = rows[0];
      if (b) {
        setBannerId(b.id);
        setForm({ gambarUrl: b.gambar_url || "", judul: b.judul || "", deskripsi: b.deskripsi || "", aktif: b.aktif });
      }
      setGaleri(galeriRows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function uploadFotoGaleri(file) {
    setUploadingGaleri(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `banner-galeri-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/produk-gambar/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error(await res.text());
      const url = `${SUPABASE_URL}/storage/v1/object/public/produk-gambar/${filePath}`;
      const [inserted] = await supabaseFetch(token, "campaign_banner_images", {
        method: "POST",
        body: JSON.stringify({ url, urutan: galeri.length }),
      });
      setGaleri((prev) => [...prev, inserted]);
    } catch (e) {
      alert("Gagal upload foto: " + e.message);
    }
    setUploadingGaleri(false);
  }

  async function hapusFotoGaleri(id) {
    try {
      await supabaseFetch(token, `campaign_banner_images?id=eq.${id}`, { method: "DELETE" });
      setGaleri((prev) => prev.filter((g) => g.id !== id));
    } catch (e) {
      alert("Gagal hapus foto: " + e.message);
    }
  }

  async function uploadGambar(file) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `banner-promo-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/produk-gambar/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!res.ok) throw new Error(await res.text());
      const url = `${SUPABASE_URL}/storage/v1/object/public/produk-gambar/${filePath}`;
      setForm((prev) => ({ ...prev, gambarUrl: url }));
    } catch (e) {
      alert("Gagal upload gambar: " + e.message);
    }
    setUploading(false);
  }

  async function simpan() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const body = {
        gambar_url: form.gambarUrl || null, judul: form.judul || null,
        deskripsi: form.deskripsi || null, aktif: form.aktif, updated_at: new Date().toISOString(),
      };
      if (bannerId) {
        await supabaseFetch(token, `campaign_banner?id=eq.${bannerId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        const [inserted] = await supabaseFetch(token, "campaign_banner", { method: "POST", body: JSON.stringify(body) });
        setBannerId(inserted.id);
      }
      setSaved(true);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  if (loading) return <LoadingState />;
  if (error && !bannerId) return <ErrorBox error={error} onRetry={load} />;

  const fieldStyle = { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, outline: "none" };
  const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" };

  return (
    <div>
      <PageHeader title="Banner Promo" subtitle="Kelola foto/GIF widget kampanye mengambang di Web App" />

      <Card style={{ maxWidth: 480 }}>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Foto/GIF Widget</label>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 84, height: 84, borderRadius: 14, background: form.gambarUrl ? `url(${form.gambarUrl}) center/cover` : "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
              {!form.gambarUrl && <ImageIcon size={28} color="#D8D6D0" />}
            </div>
            <label style={{ padding: "9px 16px", borderRadius: 9, border: "1.5px dashed #E8A426", background: "#FFFBF0", color: "#8A6A1A", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              {uploading ? "Mengupload..." : "Pilih Foto/GIF"}
              <input type="file" accept="image/*,.gif" style={{ display: "none" }} disabled={uploading} onChange={(e) => { if (e.target.files[0]) uploadGambar(e.target.files[0]); }} />
            </label>
          </div>
          <p style={{ fontSize: 11, color: "#9CA0A6", margin: "8px 0 0" }}>Upload file .gif untuk widget yang bergerak/animasi.</p>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Judul Kampanye</label>
          <input value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })} placeholder="misal Promo Spesial!" style={fieldStyle} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Deskripsi (tampil di halaman detail kampanye)</label>
          <textarea value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} rows={4} style={{ ...fieldStyle, resize: "vertical" }} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Galeri Foto Deskripsi (tampil full-width, tanpa jarak antar foto)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {galeri.map((img) => (
              <div key={img.id} style={{ position: "relative", width: 60, height: 60 }}>
                <div style={{ width: 60, height: 60, borderRadius: 8, background: `url(${img.url}) center/cover` }} />
                <button
                  onClick={() => hapusFotoGaleri(img.id)}
                  style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#C0392B", border: "2px solid #fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            <label style={{ width: 60, height: 60, borderRadius: 8, border: "1.5px dashed #E8A426", background: "#FFFBF0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {uploadingGaleri ? <Loader2 size={16} color="#8A6A1A" /> : <PackagePlus size={18} color="#8A6A1A" />}
              <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingGaleri} onChange={(e) => { if (e.target.files[0]) uploadFotoGaleri(e.target.files[0]); }} />
            </label>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#24272B", cursor: "pointer" }}>
            <input type="checkbox" checked={form.aktif} onChange={(e) => setForm({ ...form, aktif: e.target.checked })} />
            Tampilkan widget ini di Web App
          </label>
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBEAEA", color: "#C0392B", padding: 10, borderRadius: 9, fontSize: 12.5, marginBottom: 16 }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}
        {saved && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#D8E9E6", color: "#28685D", padding: 10, borderRadius: 9, fontSize: 12.5, marginBottom: 16, fontWeight: 600 }}>
            <Check size={14} /> Banner berhasil disimpan.
          </div>
        )}

        <button onClick={simpan} disabled={saving || uploading} style={{ padding: "12px 24px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}>
          {saving ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </Card>
    </div>
  );
}

// ============================================================
// SALDO & VA TOKO (kelola Virtual Account Xendit + lihat saldo semua toko)
// ============================================================
const DAFTAR_BANK_VA = ["BCA", "MANDIRI", "BRI"];

function SaldoVaPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clients, setClients] = useState([]);
  const [vaList, setVaList] = useState([]);
  const [saldoList, setSaldoList] = useState([]);
  const [creatingVaFor, setCreatingVaFor] = useState(null); // `${clientId}-${bank}`
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [clientRows, vaRows, saldoRows] = await Promise.all([
        supabaseFetch(token, "clients?select=id,kode,nama&status=eq.aktif&order=nama.asc"),
        supabaseFetch(token, "virtual_accounts?select=*"),
        supabaseFetch(token, "v_saldo_toko?select=*"),
      ]);
      setClients(clientRows);
      setVaList(vaRows);
      setSaldoList(saldoRows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function vaTokoBank(clientId, bank) {
    return vaList.find((v) => v.client_id === clientId && v.bank_code === bank);
  }
  function saldoToko(clientId) {
    return Number(saldoList.find((s) => s.client_id === clientId)?.saldo || 0);
  }

  async function buatVa(client, bank) {
    setCreatingVaFor(`${client.id}-${bank}`);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/xendit-create-va`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: client.id, bank_code: bank }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal buat VA");
      await load();
    } catch (e) {
      alert(`Gagal buat VA ${bank}: ` + e.message + "\n\n(Pastikan XENDIT_SECRET_KEY sudah diset sebagai secret Edge Function kalau belum punya, tunggu API Key Xendit-nya dulu ya)");
    }
    setCreatingVaFor(null);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const filteredClients = clients.filter((c) => c.nama.toLowerCase().includes(search.toLowerCase()) || c.kode.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="Saldo & VA Toko" subtitle="Kelola Virtual Account Xendit (BCA, Mandiri, BRI) dan pantau saldo tiap toko" />

      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari nama/kode toko..."
        style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, width: 260, marginBottom: 16 }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filteredClients.map((c) => {
          const saldo = saldoToko(c.id);
          return (
            <Card key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 2px", fontWeight: 700 }}>{c.kode}</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#24272B", margin: 0 }}>{c.nama}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 2px" }}>Saldo</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: saldo > 0 ? "#28685D" : "#9CA0A6", margin: 0 }}>{rupiah(saldo)}</p>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                {DAFTAR_BANK_VA.map((bank) => {
                  const va = vaTokoBank(c.id, bank);
                  const isCreating = creatingVaFor === `${c.id}-${bank}`;
                  return (
                    <div key={bank} style={{ border: "1px solid #EDEAE3", borderRadius: 9, padding: 10 }}>
                      <p style={{ fontSize: 10.5, fontWeight: 700, color: "#6B6F75", margin: "0 0 6px", textTransform: "uppercase" }}>{bank}</p>
                      {va ? (
                        <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: 0 }}>{va.va_number}</p>
                      ) : (
                        <button
                          onClick={() => buatVa(c, bank)}
                          disabled={isCreating}
                          style={{ width: "100%", padding: "6px 8px", borderRadius: 7, border: "none", background: "#E8A426", color: "#24272B", fontSize: 11, fontWeight: 700 }}
                        >
                          {isCreating ? "Membuat..." : "Buat VA"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
      {filteredClients.length === 0 && <EmptyState text="Tidak ada toko yang cocok." />}
    </div>
  );
}

// ============================================================
// VERIFIKASI TOKO (foto toko + KTP wajib sebelum bisa order)
// ============================================================
function VerifikasiTokoPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clients, setClients] = useState([]);
  const [processingId, setProcessingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [filter, setFilter] = useState("menunggu_review"); // menunggu_review | terverifikasi | ditolak | semua
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [ktpSignedUrls, setKtpSignedUrls] = useState({}); // { client_id: signedUrl }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, "clients?select=id,kode,nama,foto_toko_url,foto_ktp_url,status_verifikasi,alasan_verifikasi_ditolak&status_verifikasi=neq.belum_upload&order=nama.asc");
      setClients(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Foto KTP disimpan di bucket privat (foto_ktp_url isinya cuma PATH, bukan
  // URL langsung) - jadi perlu di-generate signed URL sementara dulu buat
  // ditampilkan sebagai thumbnail di kartu.
  useEffect(() => {
    clients.forEach((c) => {
      if (c.foto_ktp_url && !ktpSignedUrls[c.id]) {
        getSignedKtpUrl(c.foto_ktp_url).then((url) => {
          if (url) setKtpSignedUrls((prev) => ({ ...prev, [c.id]: url }));
        });
      }
    });
  }, [clients]);

  async function getSignedKtpUrl(filePath) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-ktp-signed-url`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: filePath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.signedUrl;
    } catch (e) {
      console.log("Gagal ambil signed URL KTP:", e.message);
      return null;
    }
  }

  async function approve(client) {
    setProcessingId(client.id);
    try {
      await supabaseFetch(token, `clients?id=eq.${client.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status_verifikasi: "terverifikasi", alasan_verifikasi_ditolak: null }),
      });
      setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, status_verifikasi: "terverifikasi" } : c)));
    } catch (e) { alert("Gagal approve: " + e.message); }
    setProcessingId(null);
  }

  async function tolak(client) {
    if (!rejectReason.trim()) {
      alert("Isi dulu alasan penolakannya.");
      return;
    }
    setProcessingId(client.id);
    try {
      await supabaseFetch(token, `clients?id=eq.${client.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status_verifikasi: "ditolak", alasan_verifikasi_ditolak: rejectReason.trim() }),
      });
      setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, status_verifikasi: "ditolak", alasan_verifikasi_ditolak: rejectReason.trim() } : c)));
      setRejectingId(null);
      setRejectReason("");
    } catch (e) { alert("Gagal tolak: " + e.message); }
    setProcessingId(null);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const filtered = clients.filter((c) => filter === "semua" || c.status_verifikasi === filter);
  const badgeStyle = {
    menunggu_review: { bg: "#FBF0D9", color: "#8A6A1A", label: "Menunggu Review" },
    terverifikasi: { bg: "#D8E9E6", color: "#28685D", label: "Terverifikasi" },
    ditolak: { bg: "#FBEAEA", color: "#C0392B", label: "Ditolak" },
  };

  return (
    <div>
      <PageHeader title="Verifikasi Toko" subtitle="Cek foto toko & KTP sebelum toko diizinkan order" />

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { key: "menunggu_review", label: "Menunggu Review" },
          { key: "terverifikasi", label: "Terverifikasi" },
          { key: "ditolak", label: "Ditolak" },
          { key: "semua", label: "Semua" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{ padding: "8px 16px", borderRadius: 9, border: filter === f.key ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: filter === f.key ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {filtered.map((c) => {
          const badge = badgeStyle[c.status_verifikasi] || { bg: "#F7F5F1", color: "#9CA0A6", label: c.status_verifikasi };
          return (
            <Card key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 2px", fontWeight: 700 }}>{c.kode}</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#24272B", margin: 0 }}>{c.nama}</p>
                </div>
                <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 10.5, color: "#9CA0A6", margin: "0 0 4px", fontWeight: 700 }}>FOTO TOKO</p>
                  {c.foto_toko_url ? (
                    <img
                      src={c.foto_toko_url} alt="Foto Toko"
                      onClick={() => setLightboxUrl(c.foto_toko_url)}
                      style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8, cursor: "pointer" }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: 120, borderRadius: 8, background: "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#9CA0A6" }}>Belum ada</div>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: 10.5, color: "#9CA0A6", margin: "0 0 4px", fontWeight: 700 }}>FOTO KTP</p>
                  {c.foto_ktp_url ? (
                    ktpSignedUrls[c.id] ? (
                      <img
                        src={ktpSignedUrls[c.id]} alt="Foto KTP"
                        onClick={() => setLightboxUrl(ktpSignedUrls[c.id])}
                        style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8, cursor: "pointer" }}
                      />
                    ) : (
                      <div style={{ width: "100%", height: 120, borderRadius: 8, background: "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#9CA0A6" }}>Memuat...</div>
                    )
                  ) : (
                    <div style={{ width: "100%", height: 120, borderRadius: 8, background: "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#9CA0A6" }}>Belum ada</div>
                  )}
                </div>
              </div>

              {c.status_verifikasi === "ditolak" && c.alasan_verifikasi_ditolak && (
                <div style={{ background: "#FBEAEA", borderRadius: 9, padding: 10, marginBottom: 12 }}>
                  <p style={{ fontSize: 11.5, color: "#C0392B", margin: 0 }}><strong>Alasan ditolak:</strong> {c.alasan_verifikasi_ditolak}</p>
                </div>
              )}

              {c.status_verifikasi === "menunggu_review" && (
                rejectingId === c.id ? (
                  <div>
                    <textarea
                      value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Alasan penolakan..."
                      rows={2}
                      style={{ width: "100%", padding: 9, borderRadius: 8, border: "1.5px solid #E4E1DA", fontSize: 12.5, marginBottom: 8, resize: "vertical" }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => tolak(c)} disabled={processingId === c.id} style={{ flex: 1, padding: 9, borderRadius: 8, border: "none", background: "#C0392B", color: "#fff", fontSize: 12, fontWeight: 700 }}>
                        Kirim Penolakan
                      </button>
                      <button onClick={() => { setRejectingId(null); setRejectReason(""); }} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontSize: 12, fontWeight: 600 }}>
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => approve(c)} disabled={processingId === c.id} style={{ flex: 1, padding: 10, borderRadius: 9, border: "none", background: "#28685D", color: "#fff", fontSize: 12.5, fontWeight: 700 }}>
                      {processingId === c.id ? "..." : "Setujui"}
                    </button>
                    <button onClick={() => setRejectingId(c.id)} style={{ flex: 1, padding: 10, borderRadius: 9, border: "1.5px solid #C0392B", background: "#fff", color: "#C0392B", fontSize: 12.5, fontWeight: 700 }}>
                      Tolak
                    </button>
                  </div>
                )
              )}
            </Card>
          );
        })}
      </div>
      {filtered.length === 0 && <EmptyState text="Tidak ada toko di kategori ini." />}

      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, cursor: "zoom-out" }}
        >
          <img src={lightboxUrl} alt="Full" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8, objectFit: "contain" }} />
          <button
            onClick={() => setLightboxUrl(null)}
            style={{ position: "absolute", top: 20, right: 20, width: 40, height: 40, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.15)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
