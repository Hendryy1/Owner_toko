import React, { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard, ClipboardCheck, Store, TrendingUp, Wallet, Package,
  Users, LogOut, Check, X, ChevronRight, AlertCircle, Loader2, RefreshCw, Printer
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
  return data; // { access_token, user, ... }
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
export default function OwnerDashboard() {
  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);
  const [page, setPage] = useState("overview");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  async function handleLogin() {
    setLoginError("");
    setLoggingIn(true);
    try {
      const auth = await supabaseAuth(loginForm.email, loginForm.password);
      const profRows = await supabaseFetch(auth.access_token, `profiles?select=*&id=eq.${auth.user.id}`);
      if (!profRows || profRows.length === 0) {
        setLoginError("Akun ini belum terhubung sebagai staff (cek tabel profiles).");
        setLoggingIn(false);
        return;
      }
      setToken(auth.access_token);
      setProfile(profRows[0]);
    } catch (e) {
      setLoginError(e.message);
    }
    setLoggingIn(false);
  }

  function handleLogout() {
    setToken(null);
    setProfile(null);
    setPage("overview");
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
      <Sidebar page={page} setPage={setPage} profile={profile} onLogout={handleLogout} />
      <div style={{ flex: 1, padding: "28px 36px", overflowY: "auto" }}>
        {page === "overview" && <OverviewPage token={token} />}
        {page === "orders" && <OrdersPage token={token} />}
        {page === "clients" && <ClientsPage token={token} />}
        {page === "keuangan" && <KeuanganPage token={token} />}
        {page === "piutang" && <PiutangPage token={token} />}
        {page === "barang" && <BarangTerlarisPage token={token} />}
        {page === "sales" && <SalesPage token={token} />}
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
function Sidebar({ page, setPage, profile, onLogout }) {
  const allItems = [
    { key: "overview", label: "Ringkasan", icon: LayoutDashboard, roles: ["owner", "admin_transaksi", "admin_keuangan"] },
    { key: "orders", label: "Approve Pesanan", icon: ClipboardCheck, roles: ["owner", "admin_transaksi"] },
    { key: "clients", label: "Approve Toko Baru", icon: Store, roles: ["owner", "admin_keuangan"] },
    { key: "keuangan", label: "Laporan Keuangan", icon: Wallet, roles: ["owner", "admin_keuangan"] },
    { key: "piutang", label: "Piutang", icon: AlertCircle, roles: ["owner", "admin_keuangan"] },
    { key: "barang", label: "Barang Terlaris", icon: Package, roles: ["owner", "admin_keuangan"] },
    { key: "sales", label: "Rekap Sales", icon: Users, roles: ["owner", "admin_transaksi", "admin_keuangan"] },
  ];
  const items = allItems.filter((it) => it.roles.includes(profile?.role));
  return (
    <div style={{ width: 240, background: "#24272B", padding: "24px 16px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, padding: "0 8px" }}>
        <div style={{ width: 36, height: 36, background: "#E8A426", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LayoutDashboard size={18} color="#24272B" />
        </div>
        <span className="disp" style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>Dashboard</span>
      </div>

      {items.map((it) => {
        const Icon = it.icon;
        const active = page === it.key;
        return (
          <button
            key={it.key} onClick={() => setPage(it.key)}
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
function OverviewPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [pendingOrders, pendingClients, keuanganBulanIni, piutang] = await Promise.all([
        supabaseFetch(token, "orders?select=id&status=eq.menunggu_persetujuan"),
        supabaseFetch(token, "clients?select=id&status=eq.pending"),
        supabaseFetch(token, "v_laporan_keuangan_bulanan?select=*&order=bulan.desc&limit=1"),
        supabaseFetch(token, "v_piutang_client?select=total_piutang,melebihi_limit"),
      ]);
      const totalPiutang = piutang.reduce((a, b) => a + Number(b.total_piutang || 0), 0);
      const melebihiLimit = piutang.filter((p) => p.melebihi_limit).length;
      setData({
        pendingOrders: pendingOrders.length,
        pendingClients: pendingClients.length,
        bulanIni: keuanganBulanIni[0] || null,
        totalPiutang, melebihiLimit,
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
  const [approvedIds, setApprovedIds] = useState({});
  const [printingOrder, setPrintingOrder] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, "orders?select=*,clients(nama,kode,alamat,telp),order_items(*,products(nama,satuan))&status=eq.menunggu_persetujuan&order=created_at.asc");
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
      if (status === "ditolak") {
        setOrders((prev) => prev.filter((o) => o.id !== orderId));
      } else {
        // Jangan langsung hilang - tandai sudah disetujui, tampilkan tombol Cetak Nota dulu
        setApprovedIds((prev) => ({ ...prev, [orderId]: true }));
      }
    } catch (e) {
      alert("Gagal update: " + e.message);
    }
    setProcessingId(null);
  }

  function selesai(orderId) {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Approve Pesanan" subtitle={`${orders.length} pesanan menunggu persetujuan`} />
      {orders.length === 0 ? (
        <EmptyState text="Tidak ada pesanan yang menunggu persetujuan saat ini." />
      ) : (
        orders.map((o) => (
          <Card key={o.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{o.no_nota}</p>
                <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>{o.clients?.nama} ({o.clients?.kode})</p>
                <p style={{ fontSize: 12, color: "#9CA0A6", margin: "4px 0 0" }}>
                  {new Date(o.created_at).toLocaleString("id-ID")} · Channel: {o.channel}
                  {o.is_dropship && <span style={{ marginLeft: 6, color: "#B8860B", fontWeight: 700 }}>DROPSHIP</span>}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {approvedIds[o.id] ? (
                  <>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 9, background: "#D8E9E6", color: "#28685D", fontSize: 12.5, fontWeight: 700 }}>
                      <Check size={14} /> Disetujui
                    </span>
                    <button
                      onClick={() => setPrintingOrder(o)}
                      style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: "#E8A426", color: "#24272B", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <Printer size={14} /> Cetak Nota
                    </button>
                    <button
                      onClick={() => selesai(o.id)}
                      style={{ padding: "8px 14px", borderRadius: 9, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontSize: 12.5, fontWeight: 700 }}
                    >
                      Selesai
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      disabled={processingId === o.id}
                      onClick={() => updateStatus(o.id, "ditolak")}
                      style={{ padding: "8px 14px", borderRadius: 9, border: "1.5px solid #F0CFC7", background: "#fff", color: "#C0392B", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <X size={14} /> Tolak
                    </button>
                    <button
                      disabled={processingId === o.id}
                      onClick={() => updateStatus(o.id, "menunggu_pengiriman")}
                      style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: "#E8A426", color: "#24272B", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <Check size={14} /> Setujui
                    </button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))
      )}

      {printingOrder && <NotaPrintModal order={printingOrder} onClose={() => setPrintingOrder(null)} />}
    </div>
  );
}

// ============================================================
// MODAL CETAK NOTA
// ============================================================
function NotaPrintModal({ order, onClose }) {
  const items = order.order_items || [];
  const total = items.reduce((sum, it) => sum + Number(it.subtotal_setelah_diskon || 0), 0);

  return (
    <div className="nota-print-overlay" style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .nota-print-area, .nota-print-area * { visibility: visible; }
          .nota-print-area { position: fixed; top: 0; left: 0; width: 100%; }
          .nota-print-overlay { position: static !important; background: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div style={{ background: "#fff", borderRadius: 14, width: 480, maxHeight: "90vh", overflowY: "auto", padding: 0 }}>
        <div className="nota-print-area" style={{ padding: 32 }}>
          <div style={{ textAlign: "center", marginBottom: 20, paddingBottom: 16, borderBottom: "2px solid #24272B" }}>
            <p className="disp" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{COMPANY_NAME}</p>
            <p style={{ fontSize: 11, color: "#6B6F75", margin: "2px 0 0" }}>NOTA PENJUALAN</p>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, fontSize: 12.5 }}>
            <div>
              <p style={{ margin: "0 0 3px", fontWeight: 700 }}>{order.clients?.nama}</p>
              <p style={{ margin: "0 0 3px", color: "#6B6F75" }}>{order.tujuan_alamat || order.clients?.alamat}</p>
              <p style={{ margin: 0, color: "#6B6F75" }}>{order.tujuan_telp || order.clients?.telp}</p>
              {order.is_dropship && (
                <p style={{ margin: "4px 0 0", color: "#B8860B", fontWeight: 700 }}>DROPSHIP - a/n {order.nama_pengirim_dropship}</p>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: "0 0 3px" }}><strong>No Nota:</strong> {order.no_nota}</p>
              <p style={{ margin: 0 }}>{new Date(order.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 16 }}>
            <thead>
              <tr style={{ borderBottom: "1.5px solid #24272B" }}>
                <th style={{ textAlign: "left", padding: "6px 4px" }}>Barang</th>
                <th style={{ textAlign: "center", padding: "6px 4px" }}>Qty</th>
                <th style={{ textAlign: "right", padding: "6px 4px" }}>Harga</th>
                <th style={{ textAlign: "right", padding: "6px 4px" }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} style={{ borderBottom: "1px solid #EDEAE3" }}>
                  <td style={{ padding: "6px 4px" }}>{it.products?.nama}</td>
                  <td style={{ padding: "6px 4px", textAlign: "center" }}>{it.qty} {it.products?.satuan}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>{rupiah(it.harga_dropship || it.harga_satuan)}</td>
                  <td style={{ padding: "6px 4px", textAlign: "right" }}>{rupiah((it.harga_dropship || it.harga_satuan) * it.qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
            <div style={{ width: 200, display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1.5px solid #24272B" }}>
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>TOTAL</span>
              <span className="disp" style={{ fontWeight: 700, fontSize: 17 }}>{rupiah(total)}</span>
            </div>
          </div>

          <p style={{ textAlign: "center", fontSize: 10.5, color: "#9CA0A6", margin: 0 }}>Terima kasih atas pesanan Anda</p>
        </div>

        <div className="no-print" style={{ display: "flex", gap: 10, padding: "16px 32px 24px" }}>
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

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Piutang per Toko" subtitle="Toko dengan tagihan belum lunas" />
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
                <td style={{ padding: "12px 14px" }}>{r.limit_kredit ? rupiah(r.limit_kredit) : "-"}</td>
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
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await supabaseFetch(token, "v_rekap_sales_bulanan?select=*&order=bulan.desc&limit=20");
      setRows(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Rekap Sales" subtitle="Performa tiap sales per bulan" />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Bulan", "Sales", "Jumlah Toko", "Omzet Bulan", "Target", "Pencapaian"].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pencapaian = r.target_omzet_bulanan > 0 ? (r.omzet_bulan / r.target_omzet_bulanan * 100) : 0;
              return (
                <tr key={i} style={{ borderTop: "1px solid #EDEAE3" }}>
                  <td style={{ padding: "12px 14px" }}>{r.bulan ? new Date(r.bulan).toLocaleDateString("id-ID", { month: "short", year: "numeric" }) : "-"}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 600 }}>{r.nama}</td>
                  <td style={{ padding: "12px 14px" }}>{r.jumlah_toko}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 700 }}>{rupiah(r.omzet_bulan)}</td>
                  <td style={{ padding: "12px 14px" }}>{rupiah(r.target_omzet_bulanan)}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ color: pencapaian >= 100 ? "#28685D" : "#B8860B", fontWeight: 700 }}>{pencapaian.toFixed(0)}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState text="Belum ada data sales." />}
      </Card>
    </div>
  );
}
