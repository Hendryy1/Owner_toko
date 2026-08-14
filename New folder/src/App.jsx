import React, { useState, useEffect, useMemo, useRef } from "react";
import ReactDOMServer from "react-dom/server";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { createClient } from "@supabase/supabase-js";
import {
  LayoutDashboard, ClipboardCheck, Store, TrendingUp, Wallet, Package,
  Users, LogOut, Check, X, ChevronRight, ChevronLeft, AlertCircle, Loader2, RefreshCw, Printer, FileEdit, History, Download, Boxes, PackagePlus, Receipt, Eye, Truck, UploadCloud, Table2, Gift, Navigation, Clock, MessageCircle, Menu, User, MapPin, Camera, Image as ImageIcon, Barcode, ScanLine, BarChart3, Star, CalendarDays, CreditCard, Phone, Lock
} from "lucide-react";

const COMPANY_NAME = "PT INDO GARUDA ABADI";
// Print server lokal (Node.js) yang jalan di komputer yang sama dengan
// Dashboard - dipakai buat cetak otomatis ke printer tanpa dialog print.
// Pakai "localhost" (bukan IP jaringan) supaya browser anggap koneksi
// AMAN meski Dashboard sendiri diakses lewat HTTPS.
// Pakai HTTPS + alamat IP jaringan (bukan localhost) supaya bisa diakses
// dari HP/perangkat lain juga, tidak cuma dari komputer print server itu
// sendiri. Sebelum ini bisa dipakai, tiap perangkat (termasuk HP) WAJIB
// buka dulu https://[ip-print-server]:9100/ping langsung di browser-nya,
// klik "Advanced" -> "Proceed" untuk terima sertifikatnya (sekali saja).
// CATATAN: alamat IP ini BISA BERUBAH kalau komputer pindah/reconnect
// WiFi - cek ulang dengan "ipconfig" di CMD kalau print berhenti jalan.
//
// Ada LEBIH DARI SATU komputer print server (misal kantor pusat & cabang) -
// staff pilih sendiri mau cetak ke yang mana lewat dropdown di Dashboard
// (tombol "Ping"). Pilihan disimpan di localStorage, jadi tidak perlu
// pilih ulang tiap buka Dashboard - cuma perlu ganti kalau memang mau
// pindah ke print server lain.
const DAFTAR_PRINT_SERVER = [
  { nama: "Laptop Lenovo", url: "https://192.168.1.11:9100" },
  { nama: "PC Asus", url: "https://192.168.1.33:9100" },
];
function getPrintServerUrl() {
  const tersimpan = localStorage.getItem("printServerUrl");
  if (tersimpan && DAFTAR_PRINT_SERVER.some((s) => s.url === tersimpan)) return tersimpan;
  return DAFTAR_PRINT_SERVER[0].url;
}
function setPrintServerUrl(url) {
  localStorage.setItem("printServerUrl", url);
}

// Render JSX jadi PDF (persis tampilan aslinya - warna, tabel, font),
// lalu kirim ke print server untuk dicetak otomatis lewat SumatraPDF,
// tanpa dialog print browser sama sekali.
async function cetakPdfOtomatis(jsxContent, ukuranKertas, namaPrinter = "atas", modeFit = false) {
  const kontainer = document.createElement("div");
  // Taruh di luar layar (bukan display:none) - html2pdf butuh elemen benar2
  // ter-render untuk baca ukuran/style-nya dengan akurat.
  const [lebarIn] = parseUkuranKertas(ukuranKertas);
  // PENTING: taruh di posisi (0,0) - JANGAN jauh di luar layar (misal
  // -9999px) karena browser modern bisa "malas" benar2 nge-render elemen
  // yang dianggap tidak akan pernah terlihat sama sekali, hasilnya PDF
  // jadi kosong/blank. Sembunyikan pakai opacity 0 + z-index rendah
  // sebagai gantinya - elemen tetap dianggap "ada di layar" oleh browser,
  // jadi tetap di-render penuh, tapi user tidak akan melihatnya.
  kontainer.style.position = "fixed";
  kontainer.style.left = "0";
  kontainer.style.top = "0";
  kontainer.style.zIndex = "-9999";
  kontainer.style.pointerEvents = "none";
  kontainer.style.width = `${lebarIn * 96}px`; // 1 inch = 96px (standar CSS)
  kontainer.style.background = "#fff";
  document.body.appendChild(kontainer);

  // PENTING: render REACT SUNGGUHAN (bukan ReactDOMServer.renderToStaticMarkup)
  // - supaya useEffect di dalam komponen (misal BarcodeLabel/QRCodeLabel yang
  // load library dari CDN lalu gambar barcode/QR) BENAR-BENAR jalan. Static
  // markup TIDAK menjalankan useEffect sama sekali, hasilnya barcode/QR
  // kosong walau teks lain tampil normal.
  const root = createRoot(kontainer);
  root.render(jsxContent);

  // Kasih jeda lebih lama (bukan cuma 2 frame) - beberapa komponen (barcode/QR)
  // perlu load library dari CDN dulu (async) baru gambar - proses ini bisa
  // makan waktu lebih dari beberapa frame render biasa.
  await new Promise((r) => setTimeout(r, 1200));

  try {
    console.log("[cetakPdfOtomatis] Mulai capture kanvas, ukuran kontainer:", kontainer.offsetWidth, "x", kontainer.offsetHeight);
    // scale 3 (bukan 2) + format PNG (bukan JPEG) - JPEG kompresi lossy
    // bikin teks halus jadi blur/bayangan, PNG lossless jaga ketajaman
    // teks & garis tipis, penting buat hasil print yang jelas dibaca.
    const canvas = await html2canvas(kontainer, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    console.log("[cetakPdfOtomatis] Kanvas selesai, ukuran:", canvas.width, "x", canvas.height);

    const [lebarPdf, tinggiPdf] = parseUkuranKertas(ukuranKertas);
    const pdf = new jsPDF({ unit: "in", format: [lebarPdf, tinggiPdf], orientation: "portrait" });
    const dataUrlGambar = canvas.toDataURL("image/jpeg", 0.95);

    if (modeFit) {
      // Mode FIT - sesuaikan supaya SEMUA konten pasti kelihatan penuh
      // (tidak terpotong), sisa ruang (kalau ada) dibiarkan kosong &
      // konten di-tengah-kan. Cocok kalau proporsi konten beda dari
      // proporsi kertas fisik.
      const rasioKonten = canvas.width / canvas.height;
      const rasioKertas = lebarPdf / tinggiPdf;
      let lebarGambar, tinggiGambar;
      if (rasioKonten > rasioKertas) {
        lebarGambar = lebarPdf;
        tinggiGambar = lebarPdf / rasioKonten;
      } else {
        tinggiGambar = tinggiPdf;
        lebarGambar = tinggiPdf * rasioKonten;
      }
      const offsetX = (lebarPdf - lebarGambar) / 2;
      const offsetY = (tinggiPdf - tinggiGambar) / 2;
      pdf.addImage(dataUrlGambar, "JPEG", offsetX, offsetY, lebarGambar, tinggiGambar);
    } else {
      // Mode STRETCH (default) - lebar diregangkan penuh, tinggi ikut
      // proporsi asli kanvas.
      const tinggiGambarDiPdf = (canvas.height * lebarPdf) / canvas.width;
      pdf.addImage(dataUrlGambar, "JPEG", 0, 0, lebarPdf, tinggiGambarDiPdf);
    }

    const pdfBlob = pdf.output("blob");
    console.log("[cetakPdfOtomatis] Ukuran PDF akhir (byte):", pdfBlob.size);
    const base64Pdf = await blobKeBase64(pdfBlob);

    const res = await fetch(`${getPrintServerUrl()}/print-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfBase64: base64Pdf, printer: namaPrinter }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Gagal cetak.");
    return true;
  } finally {
    root.unmount();
    document.body.removeChild(kontainer);
  }
}

// Cetak Nota/Surat Jalan sebagai TEKS POLOS (bukan render gambar/PDF) -
// khusus buat printer dot matrix (misal Epson LX-310) yang hasilnya jauh
// lebih tajam & cepat kalau dikirimi teks asli, bukan bitmap gambar hasil
// screenshot tampilan (yang jadi buram/pecah di resolusi dot matrix
// rendah).
async function cetakNotaTeksOtomatis({ order, type, settings, printer = "atas" }) {
  const res = await fetch(`${getPrintServerUrl()}/print-nota`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order, type, settings, printer }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Gagal cetak.");
  return true;
}

// Cetak BANYAK nota sekaligus sebagai 1 job print - supaya di kertas
// continuous form, nota-nota langsung tersambung berurutan tanpa ada
// halaman baru/kertas kosong terbuang di antaranya (beda dari cetak
// satu-satu yang bikin printer anggap tiap nota dokumen terpisah).
async function cetakNotaMassalTeksOtomatis({ orders, settings, printer = "atas" }) {
  const res = await fetch(`${getPrintServerUrl()}/print-nota-massal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orders, settings, printer }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Gagal cetak.");
  return data.totalDicetak;
}

function parseUkuranKertas(ukuranKertas) {
  // Contoh input: "9.5in 11in" atau "8.5in 11in" - ubah jadi [lebar, tinggi] dalam inch buat jsPDF
  const bagian = String(ukuranKertas).split(" ").map((s) => parseFloat(s));
  return bagian.length === 2 ? bagian : [8.5, 11];
}

function blobKeBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1]); // buang prefix "data:application/pdf;base64,"
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}


// Ubah daftar order jadi ARRAY data siap kirim ke print server (endpoint
// /print-massal) - urutan & jenis label (inti utuh vs per-kemasan) sesuai
// logika bukaTabPreviewBarcode di atas, cuma keluarannya data buat print
// server bukan HTML preview.
function konversiOrdersKeDataBarcode(orders) {
  const hasil = [];
  orders.forEach((o) => {
    const kotaTujuanAsli = o.tujuan_kota || o.clients?.kota;
    const isPekanbaru = !!(kotaTujuanAsli && kotaTujuanAsli.trim().toLowerCase().includes("pekanbaru"));
    const teleponPenerima = o.tujuan_telp || o.clients?.telp;
    const alamatPenerima = o.tujuan_alamat || o.clients?.alamat;
    const namaPenerima = o.is_dropship ? (o.tujuan_nama || o.clients?.nama) : o.clients?.nama;

    if (!isPekanbaru) {
      // Label INTI - 1 label per order, semua barang, buat serah terima ke kurir luar kota
      hasil.push({
        penerima: namaPenerima, noHp: teleponPenerima, alamat: alamatPenerima,
        noNota: o.no_nota, isQR: false,
        items: (o.order_items || []).map((it) => ({ kode: it.products?.kode || "-", nama: it.products?.nama || "-", qty: it.qty })),
      });
    }

    // Total box dihitung dari GABUNGAN semua jenis barang dalam order ini
    // (misal KZ-01 6pcs + KZ-02 6pcs = 12 box total, bukan 6+6 terpisah).
    const totalBoxOrder = (o.order_items || []).reduce((sum, it) => sum + (Number(it.qty || 0) || 1), 0);
    let counterBox = 0;
    (o.order_items || []).forEach((item) => {
      const qty = Number(item.qty || 0) || 1;
      for (let i = 0; i < qty; i++) {
        counterBox++;
        // Label KEMASAN - per unit barang, ditempel di kemasan fisik
        hasil.push({
          penerima: namaPenerima, noNota: o.no_nota, noBox: counterBox, totalBox: totalBoxOrder, isQR: true,
          items: [{ kode: item.products?.kode || "-", nama: item.products?.nama || "-", qty: item.qty }],
        });
      }
    });
  });
  return hasil;
}

// Sama logikanya seperti konversiOrdersKeDataBarcode di atas (label INTI
// buat luar kota + label KEMASAN per unit barang), tapi keluarannya
// {order, noBox, totalBox} - dipakai buat loop cetak PDF (BarcodeLabelContent)
// satu per satu, BUKAN buat generate TSPL lagi.
function hitungEntriesLabelBarcode(orders) {
  const hasil = [];
  orders.forEach((o) => {
    const kotaTujuanAsli = o.tujuan_kota || o.clients?.kota;
    const isPekanbaru = !!(kotaTujuanAsli && kotaTujuanAsli.trim().toLowerCase().includes("pekanbaru"));

    if (!isPekanbaru) {
      // Label INTI - 1 label per order, buat serah terima ke kurir luar kota
      hasil.push({ order: o, noBox: null, totalBox: null });
    }

    // Total box dihitung dari GABUNGAN semua jenis barang dalam order ini
    // (misal KZ-01 6pcs + KZ-02 6pcs = 12 box total, bukan 6+6 terpisah),
    // dan penomoran box lanjut berurutan lintas jenis barang (1-12, bukan
    // reset ke 1 tiap ganti jenis barang).
    const totalBoxOrder = (o.order_items || []).reduce((sum, item) => sum + (Number(item.qty || 0) || 1), 0);
    let counterBox = 0;
    (o.order_items || []).forEach((item) => {
      const qty = Number(item.qty || 0) || 1;
      for (let i = 0; i < qty; i++) {
        counterBox++;
        // Label KEMASAN - per unit barang, ditempel di kemasan fisik
        hasil.push({ order: o, noBox: counterBox, totalBox: totalBoxOrder, item });
      }
    });
  });
  return hasil;
}


// ============================================================
// BUKA TAB BARU UNTUK PREVIEW SEBELUM PRINT - render konten JSX jadi
// HTML statis, tampilkan di tab baru dengan tombol Cetak sendiri, supaya
// pengguna bisa review dulu sebelum benar-benar mencetak.
// ============================================================
function bukaTabPreviewCetak(jsxContent, judulTab, ukuranKertas) {
  const htmlKonten = ReactDOMServer.renderToStaticMarkup(jsxContent);
  const win = window.open("", "_blank");
  if (!win) {
    alert("Gagal buka tab baru - pastikan pop-up tidak diblokir browser.");
    return;
  }
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${judulTab}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: ${ukuranKertas}; margin: 0; }
          body { font-family: 'Inter', Arial, sans-serif; margin: 0; padding: 20px; background: #F7F5F1; }
          .tombol-cetak-bar { position: sticky; top: 0; display: flex; justify-content: center; gap: 10px; padding: 14px; background: #24272B; margin: -20px -20px 20px; z-index: 10; }
          .tombol-cetak-bar button { padding: 11px 24px; border-radius: 10px; border: none; font-weight: 700; font-size: 13.5px; cursor: pointer; }
          .btn-cetak { background: #E8A426; color: #24272B; }
          .btn-tutup { background: #fff; color: #24272B; }
          @media print {
            .tombol-cetak-bar { display: none !important; }
            body { padding: 0; background: #fff; }
          }
        </style>
      </head>
      <body>
        <div class="tombol-cetak-bar">
          <button class="btn-cetak" onclick="window.print()">Cetak Sekarang</button>
          <button class="btn-tutup" onclick="window.close()">Tutup Tab Ini</button>
        </div>
        ${htmlKonten}
      </body>
    </html>
  `);
  win.document.close();
}

// ============================================================
// BUKA TAB BARU KHUSUS BARCODE/QR - barcode digambar oleh library JS
// SETELAH elemen muncul, jadi tidak bisa dipakai cara "render ke HTML
// statis" biasa. Di sini kita tulis placeholder kosong + script untuk
// menggambar ulang barcode/QR-nya LANGSUNG DI DALAM tab baru itu.
// ============================================================
function bukaTabPreviewBarcode(orders, ukuranLabel) {
  const lebarMm = ukuranLabel?.lebar || 100;
  const tinggiMm = ukuranLabel?.tinggi || 150;
  const win = window.open("", "_blank");
  if (!win) {
    alert("Gagal buka tab baru - pastikan pop-up tidak diblokir browser.");
    return;
  }

  // Ratakan daftar dulu. Tiap order menghasilkan:
  // - Label KEMASAN: per unit barang di tiap item (Pekanbaru MAUPUN luar
  //   kota), nomor box KHUSUS produk itu (misal KZ-01 box 1/5), kode
  //   barcode-nya menyertakan nomor produk (NONOTA-NN-NOMORPRODUK) - buat
  //   ditempel di tiap kemasan fisik, dipakai Checker Produk.
  // - Label INTI: cuma untuk order LUAR KOTA (Baraka) - 1 label per order,
  //   barcode polos (CODE128 besar + QR kecil, tanpa nomor box/produk) -
  //   dipakai buat serah terima ke kurir seperti biasa. Pekanbaru TIDAK
  //   perlu label inti terpisah (kemasannya sudah dipakai langsung).
  const entries = [];
  orders.forEach((o) => {
    const kotaTujuanAsli = o.tujuan_kota || o.clients?.kota;
    const isPekanbaru = !!(kotaTujuanAsli && kotaTujuanAsli.trim().toLowerCase().includes("pekanbaru"));

    if (!isPekanbaru) {
      entries.push({ order: o, isPekanbaru: false, jenis: "inti", noBox: null, totalBox: null, item: null });
    }

    // Total box dihitung dari GABUNGAN semua jenis barang dalam order ini
    // (misal KZ-01 6pcs + KZ-02 6pcs = 12 box total, bukan 6+6 terpisah),
    // dan penomoran box lanjut berurutan lintas jenis barang.
    const totalBoxOrder = (o.order_items || []).reduce((sum, it) => sum + (Number(it.qty || 0) || 1), 0);
    let counterBox = 0;
    (o.order_items || []).forEach((item) => {
      const qty = Number(item.qty || 0) || 1;
      for (let i = 0; i < qty; i++) {
        counterBox++;
        entries.push({ order: o, isPekanbaru, jenis: "kemasan", noBox: counterBox, totalBox: totalBoxOrder, item });
      }
    });
  });

  const itemsHtml = entries.map((entry, i) => {
    const o = entry.order;
    const jumlahBarang = (o.order_items || []).reduce((sum, it) => sum + Number(it.qty || 0), 0);
    const teleponPenerima = o.tujuan_telp || o.clients?.telp;
    const alamatPenerima = o.tujuan_alamat || o.clients?.alamat;
    const namaPenerima = o.is_dropship ? (o.tujuan_nama || o.clients?.nama) : o.clients?.nama;
    const baris = (o.order_items || []).map((it) => `
      <tr style="border-bottom:1px solid #EDEAE3${entry.item && it.id === entry.item.id ? ";background:#FBF0D9" : ""}">
        <td style="padding:4px;color:#24272B;font-weight:700">${it.products?.kode || "-"}</td>
        <td style="padding:4px;color:#24272B;font-weight:700">${it.products?.nama || "-"}</td>
        <td style="padding:4px;color:#24272B;font-weight:700;text-align:right">${it.qty}</td>
      </tr>`).join("");
    const infoAtas = entry.jenis === "kemasan"
      ? `<p style="font-size:17px;font-weight:700;color:#24272B;margin:0 0 3px;text-align:left;padding:0 10px">Penerima: ${namaPenerima}</p>
        <p style="font-size:14px;font-weight:700;color:#24272B;margin:0 0 3px;text-align:left;padding:0 10px">No.Telp: ${teleponPenerima || "-"}</p>
        <p style="font-size:15px;font-weight:700;color:#24272B;margin:0 0 10px;text-align:left;padding:0 10px">Alamat: ${alamatPenerima || "-"}</p>`
      : `
        <p style="font-size:13.5px;color:#24272B;margin:0 0 4px;font-weight:700;text-align:left;padding:0 10px">Pengirim: PT INDO GARUDA ABADI</p>
        ${o.is_dropship ? `<p style="font-size:13.5px;color:#8A6A1A;margin:0 0 4px;font-weight:700;text-align:left;padding:0 10px">Pengirim Barang: ${o.nama_pengirim_dropship || o.clients?.nama}</p>` : ""}
        <p style="font-size:17px;font-weight:700;color:#24272B;margin:0 0 3px;text-align:left;padding:0 10px">Penerima: ${namaPenerima}</p>
        <p style="font-size:14px;font-weight:700;color:#24272B;margin:0 0 3px;text-align:left;padding:0 10px">No.Telp: ${teleponPenerima || "-"}</p>
        <p style="font-size:15px;font-weight:700;color:#24272B;margin:0 0 10px;text-align:left;padding:0 10px">Alamat: ${alamatPenerima || "-"}</p>`;
    const infoBox = entry.noBox
      ? `<p style="font-size:16px;font-weight:700;color:#24272B;margin:0 0 10px;padding:4px 14px;background:#FBF0D9;display:inline-block;border-radius:6px">${entry.item?.products?.kode || ""} - No. Box: ${entry.noBox} / ${entry.totalBox}</p>`
      : `<p style="font-size:16px;font-weight:700;color:#24272B;margin:0 0 10px;padding:4px 14px;background:#FBF0D9;display:inline-block;border-radius:6px">Total Box: ${jumlahBarang}</p>`;
    const infoBawah = entry.noBox
      ? `<p style="font-size:15px;font-weight:700;color:#24272B;margin:0;text-align:left;padding:0 10px">No. Pesanan: ${o.no_nota}</p>`
      : `<table style="width:100%;border-collapse:collapse;font-size:11.5px;text-align:left">
          <thead>
            <tr style="border-bottom:1.5px solid #24272B">
              <th style="padding:4px;font-weight:700">Kode</th>
              <th style="padding:4px;font-weight:700">Nama Barang</th>
              <th style="padding:4px;font-weight:700;text-align:right">Pcs</th>
            </tr>
          </thead>
          <tbody>${baris}</tbody>
        </table>`;
    return `
      <div class="barcode-item" style="text-align:center;padding:10px 0;${i < entries.length - 1 ? "page-break-after:always;" : ""}">
        ${infoAtas}
        ${infoBox}
        <div style="display:flex;justify-content:center;align-items:flex-end;gap:20px;margin-bottom:16px">
          ${entry.jenis === "kemasan"
            ? `<div style="display:flex;flex-direction:column;align-items:center"><div id="qr-${i}"></div></div>`
            : `<svg id="barcode-${i}"></svg><div style="display:flex;flex-direction:column;align-items:center"><div id="qr-kecil-${i}"></div></div>`}
        </div>
        ${infoBawah}
      </div>`;
  }).join("");

  // Data yang dibutuhkan script inisialisasi (nomor nota + apakah Pekanbaru)
  const dataBarcode = entries.map((entry, i) => ({ idx: i, noNota: entry.order.no_nota, jenis: entry.jenis, noBox: entry.noBox || null, nomorProduk: entry.item?.products?.nomor_produk || null }));

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${entries.length > 1 ? "Barcode Massal" : "Barcode"}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: ${lebarMm}mm ${tinggiMm}mm; margin: 5mm; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #F7F5F1; }
          .tombol-cetak-bar { position: sticky; top: 0; display: flex; justify-content: center; gap: 10px; padding: 14px; background: #24272B; margin: -20px -20px 20px; z-index: 10; }
          .tombol-cetak-bar button { padding: 11px 24px; border-radius: 10px; border: none; font-weight: 700; font-size: 13.5px; cursor: pointer; }
          .btn-cetak { background: #E8A426; color: #24272B; }
          .btn-tutup { background: #fff; color: #24272B; }
          @media print {
            .tombol-cetak-bar { display: none !important; }
            body { padding: 0; background: #fff; }
          }
        </style>
      </head>
      <body>
        <div class="tombol-cetak-bar">
          <button class="btn-cetak" onclick="window.print()">Cetak Sekarang</button>
          <button class="btn-tutup" onclick="window.close()">Tutup Tab Ini</button>
        </div>
        ${itemsHtml}
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.12.3/JsBarcode.all.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
        <script>
          window.onload = function () {
            var data = ${JSON.stringify(dataBarcode)};
            data.forEach(function (d) {
              if (d.jenis === "kemasan") {
                var kodeUnik = d.noNota + "-" + String(d.noBox).padStart(2, "0") + (d.nomorProduk ? ("-" + d.nomorProduk) : "");
                new QRCode(document.getElementById("qr-" + d.idx), { text: kodeUnik, width: 120, height: 120 });
              } else {
                JsBarcode("#barcode-" + d.idx, d.noNota, { format: "CODE128", width: 3, height: 60, displayValue: true, fontSize: 14, margin: 6 });
                new QRCode(document.getElementById("qr-kecil-" + d.idx), { text: d.noNota, width: 65, height: 65 });
              }
            });
          };
        </script>
      </body>
    </html>
  `);
  win.document.close();
}

// ============================================================
// KONEKSI SUPABASE
// ============================================================
const SUPABASE_URL = "https://bzlktpveupyxtcuhrmgg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6bGt0cHZldXB5eHRjdWhybWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMTIwNjQsImV4cCI6MjA5OTc4ODA2NH0.DKvaQ-_Gdi5nj5DFkhu-8IttPCztYuKCoMoXxcIUdEI";

// Client Supabase JS (dipakai KHUSUS untuk Realtime - fetch data biasa
// tetap pakai supabaseFetch/fetch langsung seperti sebelumnya, tidak ada
// yang berubah di situ).
const supabaseRealtimeClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  const text = await res.text();
  if (!res.ok) throw new Error(`Error ${res.status}: ${text}`);
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    throw new Error(`Gagal baca respons server: ${e.message}`);
  }
}

const rupiah = (n) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");

// Kompresi gambar sebelum upload (resize + re-encode JPEG kualitas wajar) -
// dipakai di semua tempat upload foto di Dashboard, supaya file lebih
// kecil/cepat tapi masih enak dilihat.
function compressImage(file, maxDimension = 1280, quality = 0.8) {
  return new Promise((resolve) => {
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
        canvas.toBlob((blob) => resolve(blob || file), "image/webp", quality);
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// Tentukan ekstensi & Content-Type file YANG SEBENARNYA dihasilkan
// compressImage - biasanya WebP, tapi browser lama bisa fallback ke
// PNG/JPEG kalau WebP tidak didukung. Jangan asumsikan selalu satu format.
function infoFileTerkompresi(compressed, fileAsli) {
  const adalahGambar = fileAsli.type?.startsWith("image/");
  if (!adalahGambar || compressed === fileAsli) {
    return { ext: fileAsli.name.split(".").pop(), contentType: fileAsli.type || "application/octet-stream" };
  }
  const petaExt = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };
  const ext = petaExt[compressed.type] || fileAsli.name.split(".").pop();
  return { ext, contentType: compressed.type || fileAsli.type };
}

function loadImageFromFileGlobal(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Tempel watermark peta mini + pin lokasi + label + waktu + koordinat ke
// sebuah foto - dipakai bareng oleh Absen, Laporan Kunjungan, dan Bukti
// Barang Sampai supaya semuanya konsisten formatnya. Mengembalikan blob
// hasil watermark siap upload.
async function buatFotoDenganWatermark(file, coords, labelUtama) {
  const img = await loadImageFromFileGlobal(file);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const mapSize = Math.round(Math.min(img.width, img.height) * 0.32);
  try {
    const mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${coords.lat},${coords.lng}&zoom=16&size=${mapSize}x${mapSize}&maptype=mapnik`;
    const mapRes = await fetch(mapUrl, { mode: "cors" });
    if (!mapRes.ok) throw new Error("gagal ambil peta");
    const mapBlob = await mapRes.blob();
    const mapImg = await loadImageFromFileGlobal(mapBlob);
    const mx = img.width - mapSize - 14;
    const my = 14;
    ctx.fillStyle = "#fff";
    ctx.fillRect(mx - 4, my - 4, mapSize + 8, mapSize + 8);
    ctx.drawImage(mapImg, mx, my, mapSize, mapSize);
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

  const barHeight = Math.max(90, img.height * 0.12);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, img.height - barHeight, img.width, barHeight);

  const pinSize = barHeight * 0.55;
  const pinCenterX = 14 + pinSize / 2;
  const pinCenterY = img.height - barHeight / 2;
  ctx.save();
  ctx.translate(pinCenterX, pinCenterY - pinSize * 0.15);
  ctx.beginPath();
  ctx.arc(0, 0, pinSize / 2, Math.PI * 1.15, Math.PI * 1.85);
  ctx.lineTo(0, pinSize * 0.75);
  ctx.closePath();
  ctx.fillStyle = "#E4453A";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -pinSize * 0.05, pinSize * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.restore();

  const textX = 14 + pinSize + 14;
  ctx.fillStyle = "#fff";
  const fontSize = Math.max(14, Math.round(img.width / 40));
  ctx.font = `bold ${fontSize}px sans-serif`;
  const waktu = new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  ctx.fillText(labelUtama, textX, img.height - barHeight + fontSize + 10);
  ctx.font = `${Math.round(fontSize * 0.82)}px sans-serif`;
  ctx.fillText(`${waktu}`, textX, img.height - barHeight + fontSize * 2 + 14);
  ctx.fillText(`Lat: ${coords.lat.toFixed(6)}, Long: ${coords.lng.toFixed(6)}`, textX, img.height - barHeight + fontSize * 3 + 18);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  const extBlob = blob?.type === "image/webp" ? "webp" : "png";
  return { blob, extBlob };
}

function ambilLokasiSekarang() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("HP/browser ini tidak mendukung deteksi lokasi.")); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error("Gagal ambil lokasi: " + err.message + " - pastikan izin lokasi diizinkan.")),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

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

// Catat error ke database (tabel error_logs) - dipakai baik oleh Error
// Boundary (React crash, penyebab "blank putih") maupun window.onerror/
// unhandledrejection (error JS umum, termasuk Promise gagal yang tidak
// ditangani). Best-effort - kalau gagal kirim log-nya sendiri, diamkan
// saja (jangan sampai proses catat error malah bikin error baru).
async function catatErrorKeServer(pesanError, detailStack) {
  try {
    const session = loadDashboardSession();
    if (!session?.token) return; // belum login - tidak ada token buat kirim log
    let namaUser = null, roleUser = null;
    try {
      const raw = localStorage.getItem("dashboard_last_profile");
      if (raw) { const p = JSON.parse(raw); namaUser = p.nama; roleUser = p.role; }
    } catch (e) {}
    await fetch(`${SUPABASE_URL}/rest/v1/error_logs`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        sumber: "dashboard",
        pesan_error: String(pesanError).slice(0, 2000),
        detail_stack: String(detailStack || "").slice(0, 4000),
        halaman: window.location.href,
        user_id: session.userId || null,
        nama_user: namaUser,
        role_user: roleUser,
        user_agent: navigator.userAgent,
      }),
    });
  } catch (e) { /* gagal catat error - diamkan, jangan sampai bikin error baru */ }
}

// Tangkap error JS umum yang tidak ketangkep Error Boundary (Error
// Boundary CUMA nangkep error saat proses render React - bukan error di
// dalam event handler biasa, setTimeout, atau Promise yang gagal).
if (typeof window !== "undefined" && !window.__errorLoggerTerpasang) {
  window.__errorLoggerTerpasang = true;
  window.addEventListener("error", (e) => {
    catatErrorKeServer(e.message, e.error?.stack || `${e.filename}:${e.lineno}:${e.colno}`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    catatErrorKeServer("Promise gagal (unhandled): " + (e.reason?.message || e.reason), e.reason?.stack || "");
  });
}

// Error Boundary - React CUMA punya cara ini (class component) untuk
// nangkep error yang terjadi SAAT PROSES RENDER komponen (penyebab utama
// "blank putih" - error di render bikin React berhenti total tanpa
// fallback). Begitu ketangkep, tampilkan halaman fallback yang ramah
// (bukan blank putih), DAN catat errornya ke server otomatis.
class DashboardErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    catatErrorKeServer(error?.message || String(error), error?.stack || info?.componentStack || "");
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#F7F5F1" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 440, textAlign: "center" }}>
            <p style={{ fontSize: 40, margin: "0 0 12px" }}>⚠️</p>
            <p style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 8px" }}>Ada Masalah Teknis</p>
            <p style={{ fontSize: 13, color: "#6B6F75", margin: "0 0 20px", lineHeight: 1.5 }}>
              Halaman ini mengalami error dan sudah otomatis dilaporkan ke tim. Coba refresh halaman.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "11px 24px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}
            >
              Refresh Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function OwnerDashboardInner() {
  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);
  const [salesTerverifikasi, setSalesTerverifikasi] = useState(true); // default true supaya role lain tidak kena batasan
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.innerWidth < 768);
  const [notifCounts, setNotifCounts] = useState({});
  const prevNotifCountsRef = useRef(null);

  // Banner "Install Aplikasi" - browser TIDAK mengizinkan popup install
  // muncul otomatis tanpa ada interaksi user sama sekali (kebijakan
  // keamanan) - tapi kita bisa tangkap event ini lalu tampilkan banner
  // sendiri yang otomatis muncul saat Dashboard dibuka (jadi staff tidak
  // perlu cari-cari ke menu titik tiga lagi, cukup tekan 1 tombol di
  // banner ini untuk munculkan popup install asli dari browser).
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installBannerDitutup, setInstallBannerDitutup] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    setIsStandalone(standalone);
    function handleBeforeInstallPrompt(e) {
      e.preventDefault();
      setInstallPromptEvent(e);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  async function handleInstallClick() {
    if (installPromptEvent) {
      installPromptEvent.prompt();
      const { outcome } = await installPromptEvent.userChoice;
      if (outcome === "accepted") setInstallPromptEvent(null);
      else setInstallBannerDitutup(true);
    }
  }

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!token) return;
    supabaseFetch(token, "pengaturan_urutan_menu?select=urutan,grup_owner&id=eq.1")
      .then((rows) => { setUrutanMenu(rows?.[0]?.urutan || []); setGrupOwner(rows?.[0]?.grup_owner || null); })
      .catch(() => {});
  }, [token]);
  const [page, setPage] = useState(() => {
    try {
      return localStorage.getItem("dashboard_last_page") || "overview";
    } catch (e) {
      return "overview";
    }
  });

  // Simpan halaman yang lagi dibuka - supaya kalau di-refresh, tetap
  // kembali ke halaman yang sama (tidak loncat ke Ringkasan).
  useEffect(() => {
    try {
      localStorage.setItem("dashboard_last_page", page);
    } catch (e) { /* diamkan kalau localStorage tidak tersedia */ }
  }, [page]);
  const [urutanMenu, setUrutanMenu] = useState([]);
  const [grupOwner, setGrupOwner] = useState(null); // null = pakai default bawaan kode
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [restoringSession, setRestoringSession] = useState(true);

  async function loadProfileAndEnter(userId, accessToken, refreshToken, isManualLogin) {
    const profRows = await supabaseFetch(accessToken, `profiles?select=*&id=eq.${userId}`);
    if (!profRows || profRows.length === 0) {
      throw new Error("Akun ini belum terhubung sebagai staff (cek tabel profiles).");
    }
    setToken(accessToken);
    setProfile(profRows[0]);
    try { localStorage.setItem("dashboard_last_profile", JSON.stringify({ nama: profRows[0].nama, role: profRows[0].role })); } catch (e) {}
    saveDashboardSession({ userId, token: accessToken, refreshToken });

    // Catat log aktivitas login - CUMA kalau ini benar-benar login manual
    // (isi email+password), BUKAN saat sesi dipulihkan otomatis karena
    // refresh halaman - diamkan kalau gagal simpan.
    if (isManualLogin) {
      supabaseFetch(accessToken, "rpc/catat_login", {
        method: "POST",
        body: JSON.stringify({
          p_user_id: userId, p_nama: profRows[0]?.nama || "-", p_role: profRows[0]?.role || "-",
        }),
      }).catch((e) => console.error("[catat log login] Gagal:", e.message));
    }
    // Kurir cuma bisa akses Proses Pengiriman - langsung arahkan ke situ,
    // karena halaman default (Ringkasan) tidak bisa diakses kurir.
    if (profRows[0].role === "kurir") setPage("proses_kirim");
    if (profRows[0].role === "staff_gudang") setPage("picking_list");
    // admin_transaksi tidak lagi bisa akses Ringkasan (halaman default) -
    // arahkan ke Approve Pesanan sebagai gantinya.
    if (profRows[0].role === "admin_transaksi") setPage("orders");

    // Sales WAJIB terverifikasi (KTP/NPWP/KK) dulu sebelum bisa akses fitur
    // lain - kalau belum, kunci ke halaman Profil Saya saja. Kalau SUDAH
    // terverifikasi, arahkan ke "Omzet Saya" - BUKAN dibiarkan di halaman
    // default (Ringkasan), yang sebenarnya tidak diizinkan untuk role sales
    // (menu-nya memang disembunyikan di sidebar, tapi tanpa redirect ini
    // sales tetap bisa "nyangkut" melihat isinya begitu saja).
    if (profRows[0].role === "sales" && profRows[0].sales_id) {
      try {
        const salesRows = await supabaseFetch(accessToken, `sales?select=status_verifikasi&id=eq.${profRows[0].sales_id}`);
        const terverifikasi = salesRows[0]?.status_verifikasi === "terverifikasi";
        setSalesTerverifikasi(terverifikasi);
        setPage(terverifikasi ? "omzet_sales" : "profil_sales");
      } catch (e) {
        setSalesTerverifikasi(false);
        setPage("profil_sales");
      }
    }
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

  // Polling notifikasi pesanan baru di semua tahap proses - kalau ada
  // kategori yang jumlahnya BERTAMBAH sejak pengecekan terakhir, mainkan
  // suara notifikasi. Badge merah di sidebar selalu tampilkan jumlah
  // TERKINI, terlepas dari suara (suara cuma nanda ada yang BARU).
  function mainkanSuaraNotif() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.15].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.001, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + delay + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.3);
      });
    } catch (e) { /* browser tidak izinkan audio otomatis - abaikan */ }
  }

  async function cekNotifikasiPesanan() {
    if (!token || !profile?.role) return;
    try {
      const hitung = async (query) => {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, Prefer: "count=exact" },
        });
        const range = res.headers.get("content-range"); // format "0-0/N"
        return Number(range?.split("/")[1] || 0);
      };
      // Cuma hitung kategori yang memang MUNCUL di sidebar role ini -
      // supaya Kurir/Sales/dll tidak dengar notifikasi untuk menu yang
      // bahkan tidak mereka punya aksesnya.
      const role = profile.role;
      const kategoriUntukRole = {
        orders: ["owner", "admin_transaksi"],
        konfirmasi_bayar: ["owner", "admin_keuangan", "admin_transaksi"],
        picking_list: ["owner", "admin_transaksi", "staff_gudang"],
        siap_dikirim_baru: ["owner", "admin_transaksi", "kurir", "staff_gudang"],
        proses_kirim: ["owner", "kurir", "staff_gudang"],
        review_stok_kurang: ["owner", "admin_transaksi"],
      };
      const queryPerKategori = {
        orders: "orders?select=id&status=eq.menunggu_persetujuan&limit=1",
        picking_list: "orders?select=id&status=eq.menunggu_pengiriman&picking_selesai_at=is.null&limit=1",
        siap_dikirim_baru: "orders?select=id&status=eq.siap_dikirim&limit=1",
        proses_kirim: "orders?select=id&status=eq.proses_dikirim&bukti_barang_sampai_url=is.null&limit=1",
        konfirmasi_bayar: "orders?select=id&status=eq.proses_dikirim&dikonfirmasi_toko_at=not.is.null&limit=1",
        review_stok_kurang: "orders?select=id&stok_kurang_menunggu_admin_at=not.is.null&stok_kurang_disetujui_admin_at=is.null&stok_kurang_ditolak_admin_at=is.null&limit=1",
      };
      const kategoriRelevan = Object.keys(kategoriUntukRole).filter((key) => kategoriUntukRole[key].includes(role));
      const hasil = await Promise.all(kategoriRelevan.map((key) => hitung(queryPerKategori[key])));
      const counts = {};
      kategoriRelevan.forEach((key, i) => { counts[key] = hasil[i]; });
      // Cek NAIK per kategori (bukan total gabungan) - order yang cuma
      // "pindah tahap" (misal dari Approve ke Picking List) bikin satu
      // kategori turun & satu naik, totalnya bisa tetap sama walau
      // sebenarnya ada perubahan berarti di kategori itu.
      const prev = prevNotifCountsRef.current;
      if (prev !== null) {
        const adaKenaikan = Object.keys(counts).some((key) => counts[key] > (prev[key] || 0));
        if (adaKenaikan) mainkanSuaraNotif();
      }
      prevNotifCountsRef.current = counts;
      setNotifCounts(counts);
    } catch (e) { console.log("Gagal cek notifikasi:", e.message); }
  }

  useEffect(() => {
    if (!profile || !token) return;
    cekNotifikasiPesanan(); // hitung sekali di awal

    // Realtime - database langsung "kabari" begitu ada baris orders yang
    // berubah (insert/update/delete), jadi notifikasi kerasa INSTAN tanpa
    // perlu terus-menerus nanya ke server tiap detik (lebih ringan).
    const channel = supabaseRealtimeClient
      .channel("notif-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        cekNotifikasiPesanan();
      })
      .subscribe();

    return () => { supabaseRealtimeClient.removeChannel(channel); };
  }, [profile, token]);

  // Tracking durasi Dashboard "aktif di layar depan" (bukan di-minimize/
  // pindah ke home screen atau aplikasi lain) - buat Owner lihat gambaran
  // durasi kerja staff. Detik ditambahkan cuma selagi tab ini BENAR-BENAR
  // di layar depan (Page Visibility API), lalu dikirim ke database
  // berkala (bukan tiap detik, supaya tidak bikin banyak request).
  useEffect(() => {
    if (!profile?.id || !token) return;
    let detikBelumTersimpan = 0;

    async function kirimKeServer() {
      if (detikBelumTersimpan <= 0) return;
      const tambahan = detikBelumTersimpan;
      detikBelumTersimpan = 0;
      const todayStr = new Date().toISOString().slice(0, 10);
      try {
        const existing = await supabaseFetch(token, `aktivitas_layar?select=id,detik_aktif&user_id=eq.${profile.id}&tanggal=eq.${todayStr}`);
        if (existing.length > 0) {
          await supabaseFetch(token, `aktivitas_layar?id=eq.${existing[0].id}`, {
            method: "PATCH",
            body: JSON.stringify({ detik_aktif: existing[0].detik_aktif + tambahan, updated_at: new Date().toISOString() }),
          });
        } else {
          await supabaseFetch(token, "aktivitas_layar", {
            method: "POST",
            body: JSON.stringify({ user_id: profile.id, nama_user: profile.nama, role_user: profile.role, tanggal: todayStr, detik_aktif: tambahan }),
          });
        }
      } catch (e) {
        detikBelumTersimpan += tambahan; // gagal kirim - coba lagi nanti
        console.log("Gagal simpan durasi aktif:", e.message);
      }
    }

    const tickInterval = setInterval(() => {
      if (document.visibilityState === "visible") detikBelumTersimpan += 5;
    }, 5000);
    const kirimInterval = setInterval(kirimKeServer, 60000);
    window.addEventListener("beforeunload", kirimKeServer);

    return () => {
      clearInterval(tickInterval);
      clearInterval(kirimInterval);
      window.removeEventListener("beforeunload", kirimKeServer);
      kirimKeServer();
    };
  }, [profile?.id, token]);

  async function handleLogin() {
    setLoginError("");
    setLoggingIn(true);
    try {
      const auth = await supabaseAuth(loginForm.email, loginForm.password);
      await loadProfileAndEnter(auth.user.id, auth.access_token, auth.refresh_token, true);
    } catch (e) {
      setLoginError(e.message);
    }
    setLoggingIn(false);
  }

  function handleLogout() {
    // Catat log aktivitas logout dulu SEBELUM token dihapus (kalau
    // dihapus duluan, tidak akan punya akses buat insert log lagi)
    if (token && profile) {
      supabaseFetch(token, "log_aktivitas", {
        method: "POST",
        body: JSON.stringify({
          user_id: profile.id, nama_user: profile.nama, role_user: profile.role,
          aksi: "logout", deskripsi: `${profile.nama} logout dari Dashboard`,
        }),
      }).catch(() => {});
    }
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
      {!isStandalone && installPromptEvent && !installBannerDitutup && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 999, background: "#24272B", color: "#fff", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, boxShadow: "0 -2px 12px rgba(0,0,0,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div style={{ width: 34, height: 34, background: "#E8A426", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 700, color: "#24272B", fontSize: 13 }}>IGA</div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Install Portal I.G.A</p>
              <p style={{ margin: 0, fontSize: 11.5, color: "#9CA0A6" }}>Akses lebih cepat, seperti aplikasi biasa</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={() => setInstallBannerDitutup(true)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: "transparent", color: "#9CA0A6", fontSize: 12, fontWeight: 600 }}>
              Nanti
            </button>
            <button onClick={handleInstallClick} style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: "#E8A426", color: "#24272B", fontSize: 12, fontWeight: 700 }}>
              Install
            </button>
          </div>
        </div>
      )}
      <Sidebar page={page} setPage={setPage} profile={profile} onLogout={handleLogout} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} isMobile={isMobile} salesTerverifikasi={salesTerverifikasi} urutanMenu={urutanMenu} setUrutanMenu={setUrutanMenu} token={token} notifCounts={notifCounts} grupOwner={grupOwner} setGrupOwner={setGrupOwner} />
      <div style={{ flex: 1, padding: isMobile ? "16px 16px 28px" : "28px 36px", overflowY: "auto", overflowX: "hidden", minWidth: 0 }}>
        {isMobile && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "#24272B", border: "none", borderRadius: 9, padding: "9px 14px", color: "#fff", fontSize: 12.5, fontWeight: 600, marginBottom: 18 }}
          >
            <Menu size={16} /> Menu
          </button>
        )}
        {profile?.role === "sales" && !salesTerverifikasi ? (
          <ProfilSalesPage token={token} profile={profile} />
        ) : (
          <>
        {page === "overview" && <OverviewPage token={token} setPage={setPage} />}
        {page === "chat_sales" && <ChatSalesPage token={token} profile={profile} isMobile={isMobile} />}
        {page === "profil_sales" && <ProfilSalesPage token={token} profile={profile} />}
        {page === "omzet_sales" && <OmzetSalesPage token={token} profile={profile} />}
        {page === "kunjungan_sales" && <KunjunganSalesPage token={token} profile={profile} />}
        {page === "toko_sales" && <TokoSalesPage token={token} profile={profile} />}
        {page === "absen_sales" && <AbsenSalesPage token={token} profile={profile} />}
        {page === "area_sales" && <AreaSalesPage token={token} profile={profile} />}
        {page === "request_area" && <RequestAreaOwnerPage token={token} />}
        {page === "rekap_absen" && <RekapAbsenPage token={token} setPage={setPage} />}
        {page === "aktivitas_layar" && <AktivitasLayarPage token={token} />}
        {page === "log_error" && <LogErrorSistemPage token={token} />}
        {page === "calendar" && <CalendarPage token={token} />}
        {page === "orders" && <OrdersPage token={token} />}
        {page === "review_stok_kurang" && <ReviewStokKurangPage token={token} userId={profile?.id} />}
        {page === "konfirmasi_bayar" && <KonfirmasiPembayaranPage token={token} />}
        {page === "laporan_pesanan" && <LaporanPesananPage token={token} />}
        {page === "laporan_performa" && <LaporanPerformaPage token={token} />}
        {page === "log_aktivitas" && <LogAktivitasPage token={token} />}
        {page === "rating_komplain" && <RatingKomplainPage token={token} />}
        {page === "backup_data" && <BackupDataPage token={token} />}
        {page === "pin_atasan" && <PinAtasanPage token={token} />}
        {page === "permintaan_hapus_akun" && <PermintaanHapusAkunPage token={token} />}
        {page === "program_loyalitas" && <ProgramLoyalitasPage token={token} />}
        {page === "kelola_gudang" && <KelolaGudangPage token={token} />}
        {page === "picking_list" && <PickingListPage token={token} role={profile?.role} userId={profile?.id} />}
        {page === "pesanan_siap" && <SiapDikirimPage token={token} role={profile?.role} />}
        {page === "siap_dikirim_baru" && <SiapDikirimBaruPage token={token} role={profile?.role} />}
        {page === "proses_kirim" && <ProsesPengirimanPage token={token} role={profile?.role} />}
        {page === "outbound" && <OutboundPage token={token} />}
        {page === "riwayat" && <RiwayatOrderPage token={token} />}
        {page === "transaksi" && <TransaksiPage token={token} />}
        {page === "rekap_nota" && <RekapNotaPage token={token} />}
        {page === "clients" && <ClientsPage token={token} />}
        {page === "verifikasi_toko" && <VerifikasiTokoPage token={token} />}
        {page === "keuangan" && <KeuanganPage token={token} />}
        {page === "biaya_operasional" && <BiayaOperasionalPage token={token} role={profile?.role} />}
        {page === "pajak" && <PajakPage token={token} />}
        {page === "bunga_investor" && <BungaInvestorPage token={token} />}
        {page === "piutang" && <PiutangPage token={token} />}
        {page === "saldo_va" && <SaldoVaPage token={token} />}
        {page === "barang" && <BarangTerlarisPage token={token} />}
        {page === "produk" && <ProductPage token={token} />}
        {page === "stock" && <StockItemPage token={token} role={profile?.role} />}
        {page === "inbound" && <InboundPage token={token} />}
        {page === "penyesuaian_stok" && <PenyesuaianStokPage token={token} />}
        {page === "cashback" && <CashbackPage token={token} />}
        {page === "ongkir" && <FreeOngkirPage token={token} />}
        {page === "rekap_toko" && <RekapTokoPage token={token} />}
        {page === "sales" && <SalesPage token={token} />}
        {page === "format_nota" && <FormatNotaPage token={token} />}
        {page === "rekening_bank" && <RekeningBankPage token={token} />}
        {page === "maintenance" && <MaintenancePage token={token} />}
        {page === "akun_staff" && <AkunStaffPage token={token} />}
        {page === "verifikasi_sales" && <VerifikasiSalesPage token={token} />}
        {page === "laporan_kunjungan_owner" && <LaporanKunjunganOwnerPage token={token} />}
        {page === "laporan_periodik_sales" && <LaporanPeriodikSalesOwnerPage token={token} />}
        {page === "laporan_kurir" && <LaporanKurirPage token={token} />}
        {page === "buat_laporan_kurir" && <BuatLaporanKurirPage token={token} role={profile?.role} userId={profile?.id} namaAkun={profile?.nama} />}
        {page === "banner_promo" && <BannerPromoPage token={token} />}
          </>
        )}
      </div>
    </div>
  );
}

// Bungkus dengan Error Boundary - kalau ada error saat render (penyebab
// utama "blank putih"), otomatis tampilkan halaman fallback yang ramah
// dan catat errornya ke server, bukan crash total tanpa penjelasan.
export default function OwnerDashboard() {
  return (
    <DashboardErrorBoundary>
      <OwnerDashboardInner />
    </DashboardErrorBoundary>
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
        .sidebar-scroll::-webkit-scrollbar { width: 5px; }
        .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
        .sidebar-scroll::-webkit-scrollbar-thumb { background: #454951; border-radius: 999px; }
        .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: #565b64; }
        .sidebar-scroll { scrollbar-width: thin; scrollbar-color: #454951 transparent; }
      `}</style>
      <div style={{ width: 360, padding: 32, background: "#2E3237", borderRadius: 18 }}>
        <div style={{ width: 48, height: 48, background: "#E8A426", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <LayoutDashboard size={24} color="#24272B" />
        </div>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "#fff", fontSize: 28, fontWeight: 700, margin: "0 0 4px" }}>Portal I.G.A</h1>
        <p style={{ color: "#9CA0A6", fontSize: 13, marginBottom: 24 }}>Login khusus staff</p>

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
function Sidebar({ page, setPage, profile, onLogout, collapsed, setCollapsed, isMobile, salesTerverifikasi, urutanMenu, setUrutanMenu, token, notifCounts, grupOwner, setGrupOwner }) {
  const [modeAturUrutan, setModeAturUrutan] = useState(false);
  const [modeAturGrup, setModeAturGrup] = useState(false);
  const [grupSementara, setGrupSementara] = useState(null); // draft yang lagi diedit, null = belum mulai edit
  const [namaKategoriBaru, setNamaKategoriBaru] = useState(""); // input inline, ganti prompt() yang kadang tidak jalan di HP/browser tertentu
  const [grupTerbuka, setGrupTerbuka] = useState({}); // { "Admin Transaksi": true, ... }

  // Dipakai bareng tombol toggle "Selesai Atur Grup" (di atas) dan bisa
  // juga dipanggil dari dalam UI pengaturan itu sendiri.
  async function simpanGrup(draftUntukDisimpan) {
    const bersih = draftUntukDisimpan.filter((g) => g.items.length > 0); // buang kategori kosong
    try {
      await supabaseFetch(token, "pengaturan_urutan_menu?id=eq.1", {
        method: "PATCH",
        body: JSON.stringify({ grup_owner: bersih, updated_at: new Date().toISOString() }),
      });
      setGrupOwner(bersih);
      setGrupSementara(null);
      setModeAturGrup(false);
    } catch (e) {
      alert("Gagal simpan ke server: " + e.message + "\n\nPengaturan BELUM tersimpan - coba lagi.");
    }
  }

  function geserGrup(draft, index, arah) {
    const tujuan = index + arah;
    if (tujuan < 0 || tujuan >= draft.length) return draft;
    const draftBaru = [...draft];
    [draftBaru[index], draftBaru[tujuan]] = [draftBaru[tujuan], draftBaru[index]];
    setGrupSementara(draftBaru);
    return draftBaru;
  }

  // Geser urutan MENU di DALAM satu kategori tertentu (bukan geser urutan
  // kategorinya sendiri - itu fungsi geserGrup di atas).
  function geserItemDalamGrup(draft, labelGrup, indexItem, arah) {
    const draftBaru = draft.map((g) => {
      if (g.label !== labelGrup) return g;
      const tujuan = indexItem + arah;
      if (tujuan < 0 || tujuan >= g.items.length) return g;
      const itemsBaru = [...g.items];
      [itemsBaru[indexItem], itemsBaru[tujuan]] = [itemsBaru[tujuan], itemsBaru[indexItem]];
      return { ...g, items: itemsBaru };
    });
    setGrupSementara(draftBaru);
  }


  // ============================================================
  // GRUP MENU KHUSUS TAMPILAN OWNER (slide down per kategori) -
  // EDIT BEBAS di sini: pindahkan/tambah/kurangi "key" menu di tiap
  // grup sesuai kebutuhan Anda. "key" yang dipakai harus sama persis
  // dengan "key" yang ada di daftar allItems di bawah (lihat kolom
  // "key:" masing-masing menu).
  //
  // Menu yang key-nya TIDAK dimasukkan ke grup manapun di bawah ini
  // akan otomatis tetap tampil di ATAS (di luar grup, flat seperti
  // biasa) - jadi aman, tidak ada menu yang "hilang" walau belum
  // sempat dikelompokkan.
  // ============================================================
  const GRUP_MENU_OWNER_DEFAULT = [
    {
      label: "Admin Transaksi",
      items: ["orders", "review_stok_kurang", "picking_list", "siap_dikirim_baru", "proses_kirim", "outbound", "rekap_nota"],
    },
    {
      label: "Admin Keuangan",
      items: ["konfirmasi_bayar", "keuangan", "biaya_operasional", "pajak", "bunga_investor", "piutang", "saldo_va", "cashback"],
    },
    {
      label: "Sales",
      items: ["laporan_kunjungan_owner", "rekap_absen", "laporan_periodik_sales", "area_sales", "request_area"],
    },
    {
      label: "Kurir",
      items: ["laporan_kurir", "buat_laporan_kurir"],
    },
    {
      label: "Staff Gudang",
      items: ["kelola_gudang", "stock", "inbound", "penyesuaian_stok"],
    },
    {
      label: "Produk & Katalog",
      items: ["produk", "barang", "ongkir", "format_nota", "banner_promo"],
    },
    {
      label: "Pengaturan & Lainnya",
      items: ["clients", "verifikasi_toko", "akun_staff", "verifikasi_sales", "rekening_bank", "pin_atasan", "maintenance", "permintaan_hapus_akun", "program_loyalitas", "rating_komplain", "backup_data", "log_aktivitas", "log_error", "aktivitas_layar"],
    },
  ];
  // Pakai pengaturan tersimpan dari database kalau Owner sudah pernah atur
  // sendiri lewat tombol "Atur Grup Menu" - kalau belum pernah, pakai
  // default bawaan kode di atas.
  const GRUP_MENU_OWNER = grupOwner && grupOwner.length > 0 ? grupOwner : GRUP_MENU_OWNER_DEFAULT;

  const allItems = [
    { key: "overview", label: "Ringkasan", icon: LayoutDashboard, roles: ["owner", "admin_keuangan"] },
    { key: "chat_sales", label: "Chat Toko", icon: MessageCircle, roles: ["owner", "sales", "admin_transaksi"] },
    { key: "profil_sales", label: "Profil Saya", icon: User, roles: ["sales"] },
    { key: "omzet_sales", label: "Omzet Saya", icon: TrendingUp, roles: ["sales"] },
    { key: "kunjungan_sales", label: "Laporan Kunjungan", icon: MapPin, roles: ["sales"] },
    { key: "toko_sales", label: "Toko", icon: Store, roles: ["sales"] },
    { key: "absen_sales", label: "Absen", icon: Clock, roles: ["sales"] },
    { key: "area_sales", label: "Area", icon: MapPin, roles: ["sales"] },
    { key: "request_area", label: "Request Area Sales", icon: MapPin, roles: ["owner"] },
    { key: "rekap_absen", label: "Rekap Absen Sales", icon: Clock, roles: ["owner"] },
    { key: "aktivitas_layar", label: "Aktivitas Layar Staff", icon: Eye, roles: ["owner"] },
    { key: "log_error", label: "Log Error Sistem", icon: AlertCircle, roles: ["owner"] },
    { key: "calendar", label: "Calendar", icon: CalendarDays, roles: ["owner"] },
    { key: "orders", label: "Approve Pesanan", icon: ClipboardCheck, roles: ["owner", "admin_transaksi"] },
    { key: "review_stok_kurang", label: "Review Stock Kurang", icon: AlertCircle, roles: ["owner", "admin_transaksi"] },
    { key: "konfirmasi_bayar", label: "Review Pengiriman", icon: Wallet, roles: ["owner", "admin_keuangan", "admin_transaksi"] },
    { key: "laporan_pesanan", label: "Laporan Pesanan", icon: BarChart3, roles: ["owner", "admin_transaksi", "admin_keuangan"] },
    { key: "laporan_performa", label: "Laporan Performa", icon: TrendingUp, roles: ["owner"] },
    { key: "log_aktivitas", label: "Log Aktivitas", icon: History, roles: ["owner"] },
    { key: "rating_komplain", label: "Rating & Komplain Toko", icon: Star, roles: ["owner", "admin_transaksi"] },
    { key: "backup_data", label: "Backup Data", icon: Download, roles: ["owner"] },
    { key: "pin_atasan", label: "PIN Atasan", icon: Lock, roles: ["owner"] },
    { key: "permintaan_hapus_akun", label: "Permintaan Hapus Akun", icon: X, roles: ["owner", "admin_transaksi"] },
    { key: "program_loyalitas", label: "Program Loyalitas", icon: Gift, roles: ["owner"] },
    { key: "kelola_gudang", label: "Kelola Gudang", icon: Boxes, roles: ["owner"] },
    { key: "picking_list", label: "Picking List", icon: ClipboardCheck, roles: ["owner", "admin_transaksi", "staff_gudang"] },
    { key: "pesanan_siap", label: "Pesanan", icon: PackagePlus, roles: ["owner", "admin_transaksi", "staff_gudang"] },
    { key: "siap_dikirim_baru", label: "Siap Dikirim", icon: Truck, roles: ["owner", "admin_transaksi", "kurir", "staff_gudang"] },
    { key: "proses_kirim", label: "Proses Pengiriman", icon: Truck, roles: ["owner", "kurir", "staff_gudang"] },
    { key: "outbound", label: "Outbound", icon: ScanLine, roles: ["owner", "staff_gudang"] },
    { key: "riwayat", label: "Riwayat Order", icon: History, roles: ["owner", "admin_transaksi", "admin_keuangan"] },
    { key: "transaksi", label: "Transaksi", icon: Table2, roles: ["owner", "admin_transaksi", "admin_keuangan"] },
    { key: "rekap_nota", label: "Rekap Nota", icon: Receipt, roles: ["owner", "admin_keuangan", "admin_transaksi"] },
    { key: "clients", label: "Approve Toko Baru", icon: Store, roles: ["owner", "admin_keuangan"] },
    { key: "verifikasi_toko", label: "Verifikasi Toko", icon: Eye, roles: ["owner"] },
    { key: "keuangan", label: "Laporan Keuangan", icon: Wallet, roles: ["owner", "admin_keuangan"] },
    { key: "biaya_operasional", label: "Biaya Operasional", icon: Receipt, roles: ["owner", "admin_keuangan", "admin_transaksi"] },
    { key: "pajak", label: "Pajak", icon: FileEdit, roles: ["owner", "admin_keuangan"] },
    { key: "bunga_investor", label: "Bunga Investor", icon: TrendingUp, roles: ["owner"] },
    { key: "piutang", label: "Piutang", icon: AlertCircle, roles: ["owner", "admin_keuangan", "admin_transaksi"] },
    { key: "saldo_va", label: "Saldo & VA Toko", icon: Wallet, roles: ["owner", "admin_keuangan", "admin_transaksi"] },
    { key: "barang", label: "Barang Terlaris", icon: Package, roles: ["owner", "admin_keuangan"] },
    { key: "produk", label: "Product", icon: Package, roles: ["owner"] },
    { key: "stock", label: "Stock Item", icon: Boxes, roles: ["owner", "admin_transaksi"] },
    { key: "inbound", label: "Inbound", icon: PackagePlus, roles: ["owner"] },
    { key: "penyesuaian_stok", label: "Penyesuaian Stok", icon: Boxes, roles: ["owner"] },
    { key: "cashback", label: "Cashback", icon: Gift, roles: ["owner"] },
    { key: "ongkir", label: "Free Ongkir", icon: Navigation, roles: ["owner"] },
    { key: "rekap_toko", label: "Rekap Toko", icon: Store, roles: ["owner", "admin_keuangan"] },
    { key: "sales", label: "Rekap Sales", icon: Users, roles: ["owner", "admin_keuangan"] },
    { key: "format_nota", label: "Format Nota", icon: FileEdit, roles: ["owner"] },
    { key: "rekening_bank", label: "Rekening Bank Perusahaan", icon: CreditCard, roles: ["owner"] },
    { key: "maintenance", label: "Mode Maintenance", icon: AlertCircle, roles: ["owner"] },
    { key: "akun_staff", label: "Kelola Akun Staff", icon: Users, roles: ["owner"] },
    { key: "verifikasi_sales", label: "Verifikasi Sales", icon: Eye, roles: ["owner"] },
    { key: "laporan_kunjungan_owner", label: "Laporan Kunjungan Sales", icon: MapPin, roles: ["owner"] },
    { key: "laporan_periodik_sales", label: "Laporan Mingguan/Bulanan", icon: FileEdit, roles: ["owner"] },
    { key: "laporan_kurir", label: "Laporan Kurir", icon: Truck, roles: ["owner", "admin_transaksi"] },
    { key: "buat_laporan_kurir", label: "Buat Laporan Kurir", icon: ScanLine, roles: ["owner", "admin_transaksi", "kurir"] },
    { key: "banner_promo", label: "Banner Promo", icon: ImageIcon, roles: ["owner"] },
  ];
  const daftarSemuaRole = ["owner", "admin_keuangan", "admin_transaksi", "sales", "kurir", "staff_gudang"];
  const [roleTabAktif, setRoleTabAktif] = useState(profile?.role || "owner");

  // Daftar key menu untuk role TERTENTU - pakai pengaturan tersimpan kalau
  // ADA, kalau belum diatur sama sekali pakai default bawaan kode (roles
  // array di masing-masing item).
  function keyUntukRole(role) {
    if (urutanMenu && urutanMenu[role] && urutanMenu[role].length > 0) return urutanMenu[role];
    return allItems.filter((it) => it.roles.includes(role)).map((it) => it.key);
  }

  const items = keyUntukRole(profile?.role)
    .map((key) => allItems.find((it) => it.key === key))
    .filter(Boolean)
    // Sales yang BELUM terverifikasi cuma boleh lihat menu Profil Saya -
    // semua menu lain disembunyikan sampai Owner approve verifikasinya.
    .filter((it) => !(profile?.role === "sales" && !salesTerverifikasi) || it.key === "profil_sales");

  const itemsUrut = items; // sudah terurut dari keyUntukRole

  async function simpanUrutanRole(role, keyArrayBaru) {
    const urutanBaru = { ...(urutanMenu || {}), [role]: keyArrayBaru };
    setUrutanMenu(urutanBaru);
    try {
      await supabaseFetch(token, "pengaturan_urutan_menu?id=eq.1", {
        method: "PATCH",
        body: JSON.stringify({ urutan: urutanBaru, updated_at: new Date().toISOString() }),
      });
    } catch (e) { /* diamkan - tampilan lokal tetap berubah walau simpan gagal */ }
  }

  function geserMenu(index, arah) {
    const key = keyUntukRole(roleTabAktif);
    const tujuan = index + arah;
    if (tujuan < 0 || tujuan >= key.length) return;
    const baru = [...key];
    [baru[index], baru[tujuan]] = [baru[tujuan], baru[index]];
    simpanUrutanRole(roleTabAktif, baru);
  }

  function toggleMenuUntukRole(menuKey) {
    const key = keyUntukRole(roleTabAktif);
    const sudahAda = key.includes(menuKey);
    const baru = sudahAda ? key.filter((k) => k !== menuKey) : [...key, menuKey];
    simpanUrutanRole(roleTabAktif, baru);
  }


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
        className="sidebar-scroll"
        style={
          isMobile
            ? { position: "fixed", top: 0, left: 0, bottom: 0, width: 240, background: "#24272B", padding: "24px 16px", display: "flex", flexDirection: "column", zIndex: 100, overflowY: "auto" }
            : { width: 240, height: "100vh", background: "#24272B", padding: "24px 16px", display: "flex", flexDirection: "column", flexShrink: 0, overflowY: "auto", position: "sticky", top: 0 }
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

      {profile?.role === "owner" && (
        <button
          onClick={() => setModeAturUrutan((prev) => !prev)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px", borderRadius: 8, border: "1px solid #3A3E44", background: modeAturUrutan ? "#E8A426" : "none", color: modeAturUrutan ? "#24272B" : "#9CA0A6", fontSize: 11.5, fontWeight: 700, marginBottom: 8 }}
        >
          {modeAturUrutan ? <Check size={13} /> : <FileEdit size={13} />} {modeAturUrutan ? "Selesai Atur Urutan" : "Atur Urutan Menu"}
        </button>
      )}
      {profile?.role === "owner" && !modeAturUrutan && (
        <button
          onClick={() => {
            if (modeAturGrup) {
              // Lagi di mode edit, sekarang klik "Selesai" - simpan dulu.
              const draft = grupSementara || GRUP_MENU_OWNER.map((g) => ({ ...g, items: [...g.items] }));
              simpanGrup(draft);
            } else {
              setModeAturGrup(true);
            }
          }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 10px", borderRadius: 8, border: "1px solid #3A3E44", background: modeAturGrup ? "#E8A426" : "none", color: modeAturGrup ? "#24272B" : "#9CA0A6", fontSize: 11.5, fontWeight: 700, marginBottom: 12 }}
        >
          {modeAturGrup ? <Check size={13} /> : <ChevronRight size={13} />} {modeAturGrup ? "Selesai Atur Grup" : "Atur Grup Menu"}
        </button>
      )}

      {modeAturUrutan ? (
        <div style={{ overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
            {daftarSemuaRole.map((r) => (
              <button
                key={r}
                onClick={() => setRoleTabAktif(r)}
                style={{ padding: "5px 9px", borderRadius: 6, border: "none", background: roleTabAktif === r ? "#E8A426" : "#3A3E44", color: roleTabAktif === r ? "#24272B" : "#9CA0A6", fontSize: 10.5, fontWeight: 700, textTransform: "capitalize" }}
              >
                {r.replace("_", " ")}
              </button>
            ))}
          </div>
          {(() => {
            const keyAktif = keyUntukRole(roleTabAktif);
            const itemTermasuk = keyAktif.map((k) => allItems.find((it) => it.key === k)).filter(Boolean);
            const itemBelumTermasuk = allItems.filter((it) => !keyAktif.includes(it.key));
            return (
              <>
                {itemTermasuk.map((it, i) => {
                  const Icon = it.icon;
                  return (
                    <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 9px", borderRadius: 9, background: "#2C3035", marginBottom: 4 }}>
                      <input type="checkbox" checked={true} onChange={() => toggleMenuUntukRole(it.key)} style={{ width: 14, height: 14, flexShrink: 0 }} />
                      <Icon size={14} color="#9CA0A6" style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1, color: "#fff", fontSize: 12, fontWeight: 600 }}>{it.label}</span>
                      <button
                        onClick={() => geserMenu(i, -1)}
                        disabled={i === 0}
                        style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: "#3A3E44", color: i === 0 ? "#5A5E64" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                      >
                        <ChevronLeft size={12} style={{ transform: "rotate(90deg)" }} />
                      </button>
                      <button
                        onClick={() => geserMenu(i, 1)}
                        disabled={i === itemTermasuk.length - 1}
                        style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: "#3A3E44", color: i === itemTermasuk.length - 1 ? "#5A5E64" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                      >
                        <ChevronRight size={12} style={{ transform: "rotate(90deg)" }} />
                      </button>
                    </div>
                  );
                })}
                {itemBelumTermasuk.length > 0 && (
                  <>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#5A5E64", textTransform: "uppercase", margin: "10px 0 6px", paddingTop: 8, borderTop: "1px solid #3A3E44" }}>Belum ditampilkan untuk role ini</p>
                    {itemBelumTermasuk.map((it) => {
                      const Icon = it.icon;
                      return (
                        <div key={it.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 9px", borderRadius: 9, marginBottom: 4, opacity: 0.55 }}>
                          <input type="checkbox" checked={false} onChange={() => toggleMenuUntukRole(it.key)} style={{ width: 14, height: 14, flexShrink: 0 }} />
                          <Icon size={14} color="#6B6F75" style={{ flexShrink: 0 }} />
                          <span style={{ flex: 1, color: "#9CA0A6", fontSize: 12, fontWeight: 600 }}>{it.label}</span>
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            );
          })()}
        </div>
      ) : modeAturGrup ? (
        <div style={{ overflowY: "auto" }}>
          {(() => {
            const draft = grupSementara || GRUP_MENU_OWNER.map((g) => ({ ...g, items: [...g.items] }));
            const semuaKeyOwner = allItems.filter((it) => it.roles.includes("owner")).sort((a, b) => a.label.localeCompare(b.label)).map((it) => it.key);
            function grupDariKey(key) {
              const g = draft.find((g) => g.items.includes(key));
              return g ? g.label : "";
            }
            function pindahKeGrup(key, labelGrupBaru) {
              const draftBaru = draft.map((g) => ({ ...g, items: g.items.filter((k) => k !== key) }));
              if (labelGrupBaru) {
                const target = draftBaru.find((g) => g.label === labelGrupBaru);
                if (target) target.items.push(key);
              }
              setGrupSementara(draftBaru);
            }
            function tambahGrupBaru() {
              const nama = namaKategoriBaru.trim();
              if (!nama) return;
              if (draft.some((g) => g.label === nama)) { alert("Nama kategori ini sudah ada."); return; }
              setGrupSementara([...draft, { label: nama, items: [] }]);
              setNamaKategoriBaru("");
            }
            return (
              <>
                {draft.length > 0 && (
                  <>
                    <p style={{ fontSize: 10.5, fontWeight: 700, color: "#5A5E64", textTransform: "uppercase", margin: "0 0 8px" }}>Urutan Kategori</p>
                    {draft.map((g, i) => (
                      <div key={g.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 9px", borderRadius: 8, background: "#24272B", marginBottom: 6 }}>
                        <span style={{ flex: 1, color: "#fff", fontSize: 12, fontWeight: 600 }}>{g.label}</span>
                        <button onClick={() => geserGrup(draft, i, -1)} disabled={i === 0} style={{ width: 24, height: 24, borderRadius: 6, border: "none", background: "#33373C", color: i === 0 ? "#5A5E64" : "#C7C4BC", display: "flex", alignItems: "center", justifyContent: "center" }}>▲</button>
                        <button onClick={() => geserGrup(draft, i, 1)} disabled={i === draft.length - 1} style={{ width: 24, height: 24, borderRadius: 6, border: "none", background: "#33373C", color: i === draft.length - 1 ? "#5A5E64" : "#C7C4BC", display: "flex", alignItems: "center", justifyContent: "center" }}>▼</button>
                      </div>
                    ))}
                  </>
                )}

                {draft.filter((g) => g.items.length > 0).length > 0 && (
                  <>
                    <p style={{ fontSize: 10.5, fontWeight: 700, color: "#5A5E64", textTransform: "uppercase", margin: "14px 0 8px" }}>Urutan Menu dalam Kategori</p>
                    {draft.filter((g) => g.items.length > 0).map((g) => (
                      <div key={g.label} style={{ marginBottom: 14 }}>
                        <p style={{ fontSize: 11, color: "#8A8E94", margin: "0 0 6px", fontWeight: 700 }}>{g.label}</p>
                        {g.items.map((key, i) => {
                          const it = allItems.find((x) => x.key === key);
                          if (!it) return null;
                          return (
                            <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 9px", borderRadius: 8, background: "#24272B", marginBottom: 5 }}>
                              <span style={{ flex: 1, color: "#fff", fontSize: 12, fontWeight: 600 }}>{it.label}</span>
                              <button onClick={() => geserItemDalamGrup(draft, g.label, i, -1)} disabled={i === 0} style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: "#33373C", color: i === 0 ? "#5A5E64" : "#C7C4BC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>▲</button>
                              <button onClick={() => geserItemDalamGrup(draft, g.label, i, 1)} disabled={i === g.items.length - 1} style={{ width: 22, height: 22, borderRadius: 6, border: "none", background: "#33373C", color: i === g.items.length - 1 ? "#5A5E64" : "#C7C4BC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>▼</button>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </>
                )}

                <p style={{ fontSize: 10.5, fontWeight: 700, color: "#5A5E64", textTransform: "uppercase", margin: "14px 0 8px" }}>Tambah Kategori</p>
                <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                  <input
                    type="text"
                    value={namaKategoriBaru}
                    onChange={(e) => setNamaKategoriBaru(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") tambahGrupBaru(); }}
                    placeholder="Nama kategori baru..."
                    style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #3A3E44", background: "#24272B", color: "#fff", fontSize: 12 }}
                  />
                  <button
                    onClick={tambahGrupBaru}
                    disabled={!namaKategoriBaru.trim()}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "1px dashed #E8A426", background: "none", color: namaKategoriBaru.trim() ? "#E8A426" : "#5A5E64", fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}
                  >
                    + Tambah
                  </button>
                </div>

                <p style={{ fontSize: 10.5, fontWeight: 700, color: "#5A5E64", textTransform: "uppercase", margin: "0 0 8px" }}>Pilih Kategori Tiap Menu</p>
                {semuaKeyOwner.map((key) => {
                  const it = allItems.find((x) => x.key === key);
                  if (!it) return null;
                  return (
                    <div key={key} style={{ marginBottom: 8 }}>
                      <p style={{ fontSize: 11.5, color: "#C7C4BC", margin: "0 0 3px", fontWeight: 600 }}>{it.label}</p>
                      <select
                        value={grupDariKey(key)}
                        onChange={(e) => pindahKeGrup(key, e.target.value)}
                        style={{ width: "100%", padding: "7px 8px", borderRadius: 7, border: "1px solid #3A3E44", background: "#24272B", color: "#fff", fontSize: 12 }}
                      >
                        <option value="">Tidak dikelompokkan (tampil flat)</option>
                        {draft.map((g) => (
                          <option key={g.label} value={g.label}>{g.label}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                <p style={{ fontSize: 11, color: "#9CA0A6", margin: "14px 0 0", lineHeight: 1.5, textAlign: "center" }}>
                  Klik "Selesai Atur Grup" di atas untuk menyimpan.
                </p>
              </>
            );
          })()}
        </div>
      ) : (
        (() => {
          // Fungsi render 1 tombol menu - dipakai ulang baik untuk menu
          // "flat" (di luar grup) maupun menu di dalam grup yang di-slide-down.
          function renderTombolMenu(it) {
            const Icon = it.icon;
            const active = page === it.key;
            const jumlahNotif = notifCounts?.[it.key] || 0;
            return (
              <button
                key={it.key} onClick={() => { setPage(it.key); if (isMobile) setCollapsed(true); }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 10, border: "none", background: active ? "#E8A426" : "none", color: active ? "#24272B" : "#9CA0A6", fontSize: 13.5, fontWeight: 600, marginBottom: 4, textAlign: "left", position: "relative", width: "100%" }}
              >
                <Icon size={17} /> {it.label}
                {jumlahNotif > 0 && (
                  <span style={{ marginLeft: "auto", background: "#C0392B", color: "#fff", fontSize: 10.5, fontWeight: 700, borderRadius: 999, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", flexShrink: 0 }}>
                    {jumlahNotif > 99 ? "99+" : jumlahNotif}
                  </span>
                )}
              </button>
            );
          }

          // Cuma Owner yang lihat tampilan berkelompok (slide down) - role
          // lain tetap lihat menu flat seperti biasa (menu mereka memang
          // sudah sedikit, tidak perlu dikelompokkan).
          if (profile?.role !== "owner") {
            return itemsUrut.map((it) => renderTombolMenu(it));
          }

          const keyDalamGrup = new Set(GRUP_MENU_OWNER.flatMap((g) => g.items));
          const menuFlat = itemsUrut.filter((it) => !keyDalamGrup.has(it.key));
          const menuPerGrup = GRUP_MENU_OWNER.map((g) => ({
            ...g,
            itemsAda: g.items.map((key) => itemsUrut.find((it) => it.key === key)).filter(Boolean),
          })).filter((g) => g.itemsAda.length > 0);

          return (
            <>
              {menuFlat.map((it) => renderTombolMenu(it))}
              {menuPerGrup.map((g) => {
                const terbuka = !!grupTerbuka[g.label];
                const notifDalamGrup = g.itemsAda.reduce((sum, it) => sum + (notifCounts?.[it.key] || 0), 0);
                return (
                  <div key={g.label} style={{ marginBottom: 4 }}>
                    <button
                      onClick={() => setGrupTerbuka((prev) => ({ ...prev, [g.label]: !prev[g.label] }))}
                      style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "11px 12px", borderRadius: 10, border: "none", background: "none", color: "#C7C4BC", fontSize: 12.5, fontWeight: 700, textAlign: "left", textTransform: "uppercase", letterSpacing: "0.03em" }}
                    >
                      <ChevronRight size={14} style={{ transform: terbuka ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{g.label}</span>
                      {notifDalamGrup > 0 && (
                        <span style={{ background: "#C0392B", color: "#fff", fontSize: 10, fontWeight: 700, borderRadius: 999, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", flexShrink: 0 }}>
                          {notifDalamGrup > 99 ? "99+" : notifDalamGrup}
                        </span>
                      )}
                    </button>
                    <div style={{ maxHeight: terbuka ? 1000 : 0, overflow: "hidden", transition: "max-height 0.25s ease", paddingLeft: 8 }}>
                      {g.itemsAda.map((it) => renderTombolMenu(it))}
                    </div>
                  </div>
                );
              })}
            </>
          );
        })()
      )}

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
function PageHeader({ title, subtitle, onRefresh, refreshing, showPingPrinter }) {
  const [printServerAktif, setPrintServerAktif] = useState(getPrintServerUrl());
  return (
    <div style={{ marginBottom: 22, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div>
        <h1 className="disp" style={{ fontSize: 28, fontWeight: 700, color: "#24272B", margin: 0 }}>{title}</h1>
        {subtitle && <p style={{ color: "#9CA0A6", fontSize: 13, margin: "4px 0 0" }}>{subtitle}</p>}
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        {showPingPrinter && (
          <select
            value={printServerAktif}
            onChange={(e) => { setPrintServerAktif(e.target.value); setPrintServerUrl(e.target.value); }}
            title="Pilih print server mana yang dipakai untuk cetak"
            style={{ height: 36, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 12, fontWeight: 700, padding: "0 10px", marginTop: 2 }}
          >
            {DAFTAR_PRINT_SERVER.map((s) => (
              <option key={s.url} value={s.url}>{s.nama}</option>
            ))}
          </select>
        )}
        {showPingPrinter && (
          <button
            onClick={() => window.open(`${getPrintServerUrl()}/ping`, "_blank")}
            title="Buka halaman ping print server - klik ini kalau print tiba-tiba tidak jalan (browser minta konfirmasi keamanan lagi)"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "0 12px", height: 36, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontSize: 12, fontWeight: 700, marginTop: 2 }}
          >
            <Printer size={15} /> Ping
          </button>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh halaman ini"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", flexShrink: 0, marginTop: 2 }}
          >
            <RefreshCw size={16} className={refreshing ? "spin" : ""} />
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA0A6", fontSize: 13.5 }}>{text}</div>;
}

function LoadingState() {
  return <div style={{ padding: "40px 0", textAlign: "center", color: "#9CA0A6", fontSize: 13.5 }}>Memuat data...</div>;
}

// ============================================================
// BARCODE LABEL - render barcode CODE128 pakai library JsBarcode
// (dimuat dari CDN, bukan bikin sendiri - supaya dijamin bisa di-scan)
// ============================================================
let jsBarcodeLoadPromise = null;
function loadJsBarcode() {
  if (window.JsBarcode) return Promise.resolve();
  if (jsBarcodeLoadPromise) return jsBarcodeLoadPromise;
  jsBarcodeLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.12.3/JsBarcode.all.min.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return jsBarcodeLoadPromise;
}

function BarcodeLabel({ value, width = 3, height = 80 }) {
  const svgRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadJsBarcode().then(() => { if (!cancelled) setReady(true); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (ready && svgRef.current && value) {
      try {
        window.JsBarcode(svgRef.current, value, {
          format: "CODE128", width, height, displayValue: true, fontSize: 14, margin: 6,
        });
      } catch (e) { /* value tidak valid buat CODE128 (karakter tidak didukung) */ }
    }
  }, [ready, value, width, height]);

  return <svg ref={svgRef} />;
}

// ============================================================
// QR CODE LABEL - render QR Code pakai library qrcodejs (dari CDN)
// ============================================================
let qrCodeJsLoadPromise = null;
function loadQrCodeJs() {
  if (window.QRCode) return Promise.resolve();
  if (qrCodeJsLoadPromise) return qrCodeJsLoadPromise;
  qrCodeJsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return qrCodeJsLoadPromise;
}

function QRCodeLabel({ value, size = 160 }) {
  const containerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadQrCodeJs().then(() => { if (!cancelled) setReady(true); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (ready && containerRef.current && value) {
      containerRef.current.innerHTML = ""; // bersihkan dulu kalau render ulang
      try {
        new window.QRCode(containerRef.current, { text: value, width: size, height: size });
      } catch (e) { /* abaikan kalau gagal generate */ }
    }
  }, [ready, value, size]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div ref={containerRef} />
    </div>
  );
}

// ============================================================
// KONTEN LABEL BARCODE - dipakai untuk cetak satuan maupun massal
// ============================================================
function BarcodeLabelContent({ order: o, noBox, totalBox, item }) {
  const jumlahBarang = (o.order_items || []).reduce((sum, it) => sum + Number(it.qty || 0), 0);
  const teleponPenerima = o.tujuan_telp || o.clients?.telp;
  const alamatPenerima = o.tujuan_alamat || o.clients?.alamat;
  const kotaTujuanAsli = o.tujuan_kota || o.clients?.kota;
  const isPekanbaru = !!(kotaTujuanAsli && kotaTujuanAsli.trim().toLowerCase().includes("pekanbaru"));
  const namaPenerima = o.is_dropship ? (o.tujuan_nama || o.clients?.nama) : o.clients?.nama;
  return (
    <div className="barcode-label-content" style={{ textAlign: "center", padding: "10px 0" }}>
      {!noBox && (
        <p style={{ fontSize: 13.5, color: "#24272B", margin: "0 0 4px", fontWeight: 700, textAlign: "left", padding: "0 10px" }}>Pengirim: PT INDO GARUDA ABADI</p>
      )}
      {o.is_dropship && (
        <p style={{ fontSize: 13.5, color: "#8A6A1A", margin: "0 0 4px", fontWeight: 700, textAlign: "left", padding: "0 10px" }}>{noBox ? "Pengirim" : "Pengirim Barang"}: {o.nama_pengirim_dropship || o.clients?.nama}</p>
      )}
      <p style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 3px", textAlign: "left", padding: "0 10px" }}>Penerima: {namaPenerima}</p>
      <p style={{ fontSize: 14, fontWeight: 700, color: "#24272B", margin: "0 0 3px", textAlign: "left", padding: "0 10px" }}>No.Telp: {teleponPenerima || "-"}</p>
      <p style={{ fontSize: 15, fontWeight: 700, color: "#24272B", margin: "0 0 10px", textAlign: "left", padding: "0 10px" }}>Alamat: {alamatPenerima || "-"}</p>
      {noBox && totalBox ? (
        <p style={{ fontSize: 16, fontWeight: 700, color: "#24272B", margin: "0 0 10px", padding: "4px 14px", background: "#FBF0D9", display: "inline-block", borderRadius: 6 }}>
          {item?.products?.kode ? `${item.products.kode} - ` : ""}No. Box: {noBox} / {totalBox}
        </p>
      ) : !isPekanbaru ? (
        // Label INTI (luar kota) - tidak ada nomor box spesifik, tampilkan
        // total box sebagai gantinya, buat info kurir berapa box yang
        // harus diterima untuk 1 order ini.
        <p style={{ fontSize: 16, fontWeight: 700, color: "#24272B", margin: "0 0 10px", padding: "4px 14px", background: "#FBF0D9", display: "inline-block", borderRadius: 6 }}>
          Total Box: {jumlahBarang}
        </p>
      ) : null}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 20, marginBottom: 16 }}>
        {noBox ? (
          // Label KEMASAN (per box) - QR saja, sertakan nomor produk di
          // belakangnya (kalau ada) supaya "Checker Produk" bisa mengenali
          // kode ini sebagai barcode-nya-sendiri (format 3 bagian). Ukuran
          // diperkecil (dari 160 -> 120) supaya muat dengan info penerima
          // lengkap di atasnya (nama/HP/alamat/jumlah barang).
          <QRCodeLabel value={item?.products?.nomor_produk ? `${o.no_nota}-${String(noBox).padStart(2, "0")}-${item.products.nomor_produk}` : `${o.no_nota}-${String(noBox).padStart(2, "0")}`} size={120} />
        ) : (
          // Label INTI (cuma muncul untuk luar kota) - Barcode128 + QR
          // bersamaan, ukuran diperkecil supaya seimbang dengan teks yang
          // sekarang lebih besar.
          <>
            <BarcodeLabel value={o.no_nota} height={60} />
            <QRCodeLabel value={o.no_nota} size={65} />
          </>
        )}
      </div>

      {noBox ? (
        <p style={{ fontSize: 15, fontWeight: 700, color: "#24272B", margin: 0, textAlign: "left", padding: "0 10px" }}>No. Pesanan: {o.no_nota}</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1.5px solid #24272B" }}>
              <th style={{ padding: "4px 4px", fontWeight: 700 }}>Kode</th>
              <th style={{ padding: "4px 4px", fontWeight: 700 }}>Nama Barang</th>
              <th style={{ padding: "4px 4px", fontWeight: 700, textAlign: "right" }}>Pcs</th>
            </tr>
          </thead>
          <tbody>
            {(o.order_items || []).map((it, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #EDEAE3" }}>
                <td style={{ padding: "4px 4px", color: "#24272B", fontWeight: 700 }}>{it.products?.kode || "-"}</td>
                <td style={{ padding: "4px 4px", color: "#24272B", fontWeight: 700 }}>{it.products?.nama || "-"}</td>
                <td style={{ padding: "4px 4px", color: "#24272B", fontWeight: 700, textAlign: "right" }}>{it.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ============================================================
// MODAL CETAK BARCODE MASSAL - beberapa label sekaligus, halaman terpisah
// ============================================================
function BulkBarcodeModal({ orders, onClose, onSelesaiCetak, mencetak, error, ukuranLabel }) {
  const lebarMm = ukuranLabel?.lebar || 100;
  const tinggiMm = ukuranLabel?.tinggi || 150;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
      <style>{`
        @media print {
          @page { size: ${lebarMm}mm ${tinggiMm}mm; margin: 5mm; }
          body * { visibility: hidden; }
          .barcode-label-content, .barcode-label-content * { visibility: visible; }
          .barcode-label-content { position: static !important; top: auto !important; left: auto !important; right: auto !important; }
          .barcode-bulk-item { page-break-after: always; break-after: page; position: relative !important; }
          .barcode-bulk-item:last-child { page-break-after: auto; break-after: auto; }
          .barcode-bulk-container { max-height: none !important; overflow: visible !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="barcode-bulk-container" style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 460, maxHeight: "85vh", overflowY: "auto", padding: 26 }}>
        <p className="no-print" style={{ fontSize: 13, color: "#6B6F75", margin: "0 0 14px" }}>
          {mencetak ? "Mengirim ke printer..." : `${orders.length} label siap dicetak.`}
        </p>
        {error && (
          <div className="no-print" style={{ marginBottom: 14, padding: 12, borderRadius: 9, background: "#FBEAEA", color: "#C0392B", fontSize: 12, lineHeight: 1.5 }}>
            {error}
          </div>
        )}
        {orders.map((o) => (
          <div key={o.id} className="barcode-bulk-item" style={{ borderTop: "1px dashed #E4E1DA", paddingTop: 12, marginTop: 12 }}>
            <BarcodeLabelContent order={o} />
          </div>
        ))}
        <div className="no-print" style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
            Tutup
          </button>
          <button
            onClick={() => bukaTabPreviewBarcode(orders, ukuranLabel)}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#24272B", fontWeight: 600, fontSize: 12 }}
          >
            Cetak Manual
          </button>
          <button
            onClick={onSelesaiCetak}
            disabled={mencetak}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Printer size={15} /> {mencetak ? "Mencetak..." : `Cetak Otomatis (${orders.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Card({ children, style, onClick }) {
  return <div onClick={onClick} style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 14, padding: 18, ...style }}>{children}</div>;
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
        supabaseFetch(token, "sales?select=id,kode,nama&status_verifikasi=eq.terverifikasi&order=nama.asc"),
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
// ============================================================
// REVIEW STOCK KURANG - Admin review order yang stocknya kurang saat
// picking, wajib isi catatan (hasil konfirmasi ke toko) sebelum bisa
// Setuju/Tolak.
// ============================================================
function ReviewStokKurangPage({ token, userId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);
  const [catatanForm, setCatatanForm] = useState({}); // { order_id: text }
  const [processingId, setProcessingId] = useState(null);
  const [tab, setTab] = useState("menunggu"); // "menunggu" | "riwayat"
  const [riwayat, setRiwayat] = useState([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token,
        "orders?select=id,no_nota,created_at,clients(nama,kode,telp),order_items(id,qty,qty_diajukan_staff,stock_kurang_dikonfirmasi,products(kode,nama,satuan))&stok_kurang_menunggu_admin_at=not.is.null&stok_kurang_disetujui_admin_at=is.null&stok_kurang_ditolak_admin_at=is.null&order=stok_kurang_menunggu_admin_at.asc"
      );
      setOrders(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function loadRiwayat() {
    setLoadingRiwayat(true);
    try {
      const rows = await supabaseFetch(token,
        "orders?select=id,no_nota,created_at,stok_kurang_menunggu_admin_at,stok_kurang_disetujui_admin_at,stok_kurang_ditolak_admin_at,stok_kurang_catatan_admin,clients(nama,kode),profiles!orders_stok_kurang_approved_by_fkey(nama),order_items(id,qty,qty_pesanan_asli,qty_diajukan_staff,stock_kurang_dikonfirmasi,products(kode,nama,satuan))&stok_kurang_menunggu_admin_at=not.is.null&or=(stok_kurang_disetujui_admin_at.not.is.null,stok_kurang_ditolak_admin_at.not.is.null)&order=stok_kurang_menunggu_admin_at.desc&limit=100"
      );
      setRiwayat(rows);
    } catch (e) { console.log("Gagal load riwayat:", e.message); }
    setLoadingRiwayat(false);
  }
  useEffect(() => { if (tab === "riwayat") loadRiwayat(); }, [tab]);

  async function setujui(order) {
    const catatan = (catatanForm[order.id] || "").trim();
    if (!catatan) { alert("Isi catatan dulu (misal hasil konfirmasi ke toko) sebelum menyetujui."); return; }
    setProcessingId(order.id);
    try {
      await supabaseFetch(token, "rpc/setujui_stok_kurang", {
        method: "POST",
        body: JSON.stringify({ p_order_id: order.id, p_catatan: catatan, p_admin_id: userId }),
      });
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    } catch (e) {
      alert("Gagal setujui: " + e.message);
    }
    setProcessingId(null);
  }

  async function tolak(order) {
    const catatan = (catatanForm[order.id] || "").trim();
    if (!catatan) { alert("Isi catatan dulu (alasan penolakan) sebelum menolak."); return; }
    if (!confirm("Yakin tolak? Ini akan MEMBATALKAN SELURUH pesanan, refund PENUH ke saldo toko, dan stok yang sempat terpotong akan dikembalikan.")) return;
    setProcessingId(order.id);
    try {
      await supabaseFetch(token, "rpc/tolak_stok_kurang", {
        method: "POST",
        body: JSON.stringify({ p_order_id: order.id, p_catatan: catatan, p_admin_id: userId }),
      });
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
    } catch (e) {
      alert("Gagal tolak: " + e.message);
    }
    setProcessingId(null);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Review Stock Kurang" subtitle={tab === "menunggu" ? `${orders.length} pesanan menunggu review` : `${riwayat.length} riwayat keputusan`} onRefresh={tab === "menunggu" ? load : loadRiwayat} refreshing={tab === "menunggu" ? loading : loadingRiwayat} />

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={() => setTab("menunggu")} style={{ padding: "9px 18px", borderRadius: 9, border: tab === "menunggu" ? "1.5px solid #28685D" : "1.5px solid #E4E1DA", background: tab === "menunggu" ? "#D8E9E6" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}>
          Menunggu Review
        </button>
        <button onClick={() => setTab("riwayat")} style={{ padding: "9px 18px", borderRadius: 9, border: tab === "riwayat" ? "1.5px solid #28685D" : "1.5px solid #E4E1DA", background: tab === "riwayat" ? "#D8E9E6" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}>
          Riwayat
        </button>
      </div>

      {tab === "menunggu" && (
        orders.length === 0 ? (
          <EmptyState text="Tidak ada pesanan yang perlu direview saat ini." />
        ) : (
          orders.map((o) => {
            const itemsKurang = (o.order_items || []).filter((it) => it.stock_kurang_dikonfirmasi);
            return (
              <Card key={o.id} style={{ marginBottom: 16, maxWidth: 560 }}>
                <p className="disp" style={{ fontSize: 16, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{o.no_nota}</p>
                <p style={{ fontSize: 13, color: "#6B6F75", margin: "0 0 4px" }}>{o.clients?.nama} ({o.clients?.kode}) - {o.clients?.telp}</p>
                <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 14px" }}>{new Date(o.created_at).toLocaleString("id-ID")}</p>

                <div style={{ background: "#FBEAEA", borderRadius: 10, padding: 12, marginBottom: 14 }}>
                  {itemsKurang.map((it) => (
                    <p key={it.id} style={{ fontSize: 12.5, color: "#C0392B", margin: "0 0 4px", fontWeight: 600 }}>
                      {it.products?.kode} - {it.products?.nama}: pesan {it.qty}, ready {it.qty_diajukan_staff} {it.products?.satuan} (kurang {it.qty - it.qty_diajukan_staff})
                    </p>
                  ))}
                </div>

                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" }}>
                  Catatan (wajib - misal hasil konfirmasi ke toko)
                </label>
                <textarea
                  value={catatanForm[o.id] || ""}
                  onChange={(e) => setCatatanForm((prev) => ({ ...prev, [o.id]: e.target.value }))}
                  placeholder='Misal: "Toko setuju dikirim barang ready, sisa direfund" (kalau Setujui) atau "Toko tidak setuju, minta dibatalkan semua" (kalau Tolak)'
                  rows={2}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, marginBottom: 14, resize: "vertical", fontFamily: "inherit" }}
                />

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setujui(o)}
                    disabled={processingId === o.id}
                    style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "#28685D", color: "#fff", fontWeight: 700, fontSize: 13.5 }}
                  >
                    {processingId === o.id ? "Memproses..." : "Setujui"}
                  </button>
                  <button
                    onClick={() => tolak(o)}
                    disabled={processingId === o.id}
                    style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#C0392B", fontWeight: 700, fontSize: 13.5 }}
                  >
                    Tolak (Batalkan & Refund Penuh)
                  </button>
                </div>
              </Card>
            );
          })
        )
      )}

      {tab === "riwayat" && (
        loadingRiwayat ? <LoadingState /> : riwayat.length === 0 ? (
          <EmptyState text="Belum ada riwayat keputusan." />
        ) : (
          riwayat.map((o) => {
            const itemsKurang = (o.order_items || []).filter((it) => it.stock_kurang_dikonfirmasi);
            const disetujui = !!o.stok_kurang_disetujui_admin_at;
            return (
              <Card key={o.id} style={{ marginBottom: 16, maxWidth: 560 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                  <p className="disp" style={{ fontSize: 16, fontWeight: 700, color: "#24272B", margin: 0 }}>{o.no_nota}</p>
                  <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: disetujui ? "#D8E9E6" : "#FBEAEA", color: disetujui ? "#28685D" : "#C0392B" }}>
                    {disetujui ? "Disetujui" : "Ditolak - Dibatalkan Penuh"}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "#6B6F75", margin: "0 0 4px" }}>{o.clients?.nama} ({o.clients?.kode})</p>
                <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 14px" }}>
                  Diproses oleh {o.profiles?.nama || "-"} pada {new Date(o.stok_kurang_disetujui_admin_at || o.stok_kurang_ditolak_admin_at).toLocaleString("id-ID")}
                </p>

                {itemsKurang.length > 0 && (
                  <div style={{ background: "#F7F5F1", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                    {itemsKurang.map((it) => (
                      <p key={it.id} style={{ fontSize: 12, color: "#6B6F75", margin: "0 0 4px" }}>
                        {it.products?.kode} - {it.products?.nama}: pesan {it.qty_pesanan_asli ?? it.qty}, {disetujui ? `dikirim ${it.qty}` : `diajukan ${it.qty_diajukan_staff}`} {it.products?.satuan}
                      </p>
                    ))}
                  </div>
                )}

                {o.stok_kurang_catatan_admin && (
                  <div style={{ background: disetujui ? "#D8E9E6" : "#FBEAEA", borderRadius: 10, padding: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 4px" }}>Catatan Admin</p>
                    <p style={{ fontSize: 12.5, color: "#24272B", margin: 0, fontStyle: "italic" }}>"{o.stok_kurang_catatan_admin}"</p>
                  </div>
                )}
              </Card>
            );
          })
        )
      )}
    </div>
  );
}

function OrdersPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [checkingOrder, setCheckingOrder] = useState(null);
  const [namaSalesMap, setNamaSalesMap] = useState({}); // { sales_id: nama }
  const [pinModal, setPinModal] = useState(null); // { orderId } - order yang butuh PIN atasan
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [verifyingPin, setVerifyingPin] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      // Ambil SEMUA order (limit wajar) - supaya ada riwayat permanen di sini,
      // bukan cuma yang masih di tahap ini. Nanti dipisah jadi 2 bagian:
      // "Menunggu Persetujuan" (aktif) dan "Riwayat" (sudah pernah diproses).
      const [rows, salesRows] = await Promise.all([
        supabaseFetch(token, "orders?select=*,clients(nama,kode,alamat,telp,jenis_pembayaran),order_items(*,products(kode,nama,satuan,nomor_produk))&order=created_at.desc&limit=200"),
        supabaseFetch(token, "sales?select=id,nama"),
      ]);
      const salesMap = {};
      salesRows.forEach((s) => { salesMap[s.id] = s.nama; });
      setNamaSalesMap(salesMap);
      setOrders(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const pinResolveRef = useRef(null);

  // Tampilkan modal PIN dan tunggu (via Promise) sampai user submit PIN
  // yang benar (true) atau batal (false).
  function mintaPinAtasan() {
    return new Promise((resolve) => {
      pinResolveRef.current = resolve;
      setPinInput("");
      setPinError("");
      setPinModal(true);
    });
  }

  async function submitPinAtasan() {
    setVerifyingPin(true);
    setPinError("");
    try {
      const rows = await supabaseFetch(token, "pengaturan_pin_atasan?select=pin&id=eq.1");
      if (rows[0]?.pin === pinInput) {
        setPinModal(null);
        pinResolveRef.current?.(true);
      } else {
        setPinError("PIN salah. Coba lagi.");
      }
    } catch (e) {
      setPinError("Gagal cek PIN: " + e.message);
    }
    setVerifyingPin(false);
  }

  function batalkanPinAtasan() {
    setPinModal(null);
    pinResolveRef.current?.(false);
  }

  async function updateStatus(orderId, status) {
    setProcessingId(orderId);
    try {
      const order = orders.find((o) => o.id === orderId);
      let statusFinal = status;
      let bodyPatch = { status, disetujui_pada: new Date().toISOString() };

      if (status === "menunggu_pembayaran" && order?.metode_bayar === "cod") {
        // Kalau toko ini punya order COD LAIN yang belum "Selesai" (masih
        // dalam proses apapun), approve order COD ini perlu PIN atasan
        // dulu - supaya Admin tidak sembarangan approve COD berulang kalau
        // COD sebelumnya belum jelas beres/terbayarkan.
        const codBelumSelesai = await supabaseFetch(
          token,
          `orders?select=id&client_id=eq.${order.client_id}&metode_bayar=eq.cod&status=neq.selesai&id=neq.${orderId}&limit=1`
        );
        if (codBelumSelesai.length > 0) {
          const pinBenar = await mintaPinAtasan();
          if (!pinBenar) {
            setProcessingId(null);
            return;
          }
        }
        // Order COD tidak perlu tahap "Menunggu Pembayaran" sama sekali -
        // uangnya baru diterima kurir saat barang sampai (dikonfirmasi lewat
        // menu Proses Pengiriman), jadi begitu di-approve langsung lompat ke
        // "Menunggu Pengiriman".
        statusFinal = "menunggu_pengiriman";
        bodyPatch = { status: statusFinal, disetujui_pada: new Date().toISOString() };
      } else if (status === "menunggu_pembayaran" && order?.metode_bayar === "transfer") {
        // Transfer - cek dulu saldo toko. Kalau CUKUP, otomatis bayar pakai
        // saldo (potong saldo_ledger) dan langsung lompat ke "Menunggu
        // Pengiriman". Kalau TIDAK cukup, tetap "Menunggu Pembayaran" -
        // toko perlu upload bukti transfer manual (direview di sini juga).
        const totalOrder = (order.order_items || []).reduce((sum, it) => sum + Number(it.subtotal_setelah_diskon || 0), 0);
        const saldoRows = await supabaseFetch(token, `v_saldo_toko?select=saldo&client_id=eq.${order.client_id}`);
        const saldoToko = Number(saldoRows[0]?.saldo || 0);

        if (saldoToko >= totalOrder) {
          await supabaseFetch(token, "saldo_ledger", {
            method: "POST",
            body: JSON.stringify({ client_id: order.client_id, jenis: "pakai_bayar_order", jumlah: -totalOrder, order_id: orderId, keterangan: "Bayar otomatis - saldo toko cukup saat approve" }),
          });
          statusFinal = "menunggu_pengiriman";
          bodyPatch = { status: statusFinal, status_bayar: "lunas", disetujui_pada: new Date().toISOString() };
        }
      }

      await supabaseFetch(token, `orders?id=eq.${orderId}`, {
        method: "PATCH",
        body: JSON.stringify(bodyPatch),
      });
      // Tetap tampil di daftar, cuma statusnya diperbarui (bukan dihapus)
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: statusFinal, status_bayar: bodyPatch.status_bayar || o.status_bayar } : o)));
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

  // Konfirmasi manual bukti transfer yang diupload toko (untuk kasus saldo
  // tidak cukup saat approve) - sekaligus memajukan order ke tahap
  // "menunggu_pengiriman".
  // Konfirmasi ini CUMA menandai admin sudah verifikasi bukti transfer -
  // TIDAK langsung menyelesaikan order. Order baru benar-benar lanjut
  // (otomatis) setelah Owner isi saldo toko (menu Saldo & VA Toko) dan
  // saldonya jadi cukup - biar pencatatan saldo tetap rapi/tercatat.
  async function confirmPayment(orderId) {
    setProcessingId(orderId);
    try {
      await supabaseFetch(token, `orders?id=eq.${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ dikonfirmasi_admin_at: new Date().toISOString() }),
      });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, dikonfirmasi_admin_at: new Date().toISOString() } : o)));
    } catch (e) { alert("Gagal update: " + e.message); }
    setProcessingId(null);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const pending = orders.filter((o) => o.status === "menunggu_persetujuan");
  const menungguBuktiTransfer = orders.filter((o) => o.status === "menunggu_pembayaran" && o.metode_bayar === "transfer");
  const riwayat = orders.filter((o) => o.status !== "menunggu_persetujuan" && o.status !== "menunggu_pembayaran");

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
              {Number(o.diskon_tambahan_nilai || 0) > 0 && (
                <span style={{ marginLeft: 6, color: "#8A6A1A", fontWeight: 700 }}>
                  · Pakai Poin: {rupiah(Number(o.diskon_tambahan_nilai))}
                </span>
              )}
              {o.dibuat_oleh_sales && (
                <span style={{ marginLeft: 6, color: "#8A6A1A", fontWeight: 700 }}>
                  · Dibuat oleh Sales: {namaSalesMap[o.dibuat_oleh_sales] || "Tidak diketahui"}
                </span>
              )}
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
              <div style={{ textAlign: "right" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 9, background: "#FBEAEA", color: "#C0392B", fontSize: 12.5, fontWeight: 700 }}>
                  <X size={14} /> {o.alasan_dibatalkan ? "Dibatalkan Toko" : "Ditolak Admin"}
                </span>
                {o.alasan_dibatalkan && (
                  <p style={{ fontSize: 10.5, color: "#9CA0A6", margin: "4px 0 0" }}>{o.alasan_dibatalkan}</p>
                )}
              </div>
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
      <PageHeader title="Approve Pesanan" subtitle={`${pending.length} menunggu persetujuan`} onRefresh={load} refreshing={loading} />
      {pending.length === 0 ? (
        <EmptyState text="Tidak ada pesanan yang menunggu persetujuan saat ini." />
      ) : (
        pending.map(renderOrderCard)
      )}

      {menungguBuktiTransfer.length > 0 && (
        <>
          <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "28px 0 12px" }}>Menunggu Bukti Transfer</h2>
          {menungguBuktiTransfer.map((o) => {
            const totalOrder = (o.order_items || []).reduce((sum, it) => sum + Number(it.subtotal_setelah_diskon || 0), 0);
            const hasProof = !!o.bukti_transfer_url;
            return (
              <Card key={o.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{o.no_nota}</p>
                    <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>{o.clients?.nama} ({o.clients?.kode})</p>
                    <p className="disp" style={{ fontSize: 16, fontWeight: 700, color: "#24272B", margin: "4px 0 0" }}>{rupiah(totalOrder)}</p>
                  </div>
                  {hasProof ? (
                    <a href={o.bukti_transfer_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#B8860B", fontWeight: 700, textDecoration: "underline" }}>
                      Lihat Bukti Transfer
                    </a>
                  ) : (
                    <span style={{ fontSize: 12, color: "#9CA0A6", fontStyle: "italic" }}>Menunggu bukti transfer</span>
                  )}
                </div>
                {o.dikonfirmasi_admin_at ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px", background: "#FBF0D9", borderRadius: 9, fontSize: 12, color: "#8A6A1A", fontWeight: 600 }}>
                    <Check size={14} /> Sudah dikonfirmasi admin - menunggu Owner isi saldo (menu Saldo & VA Toko)
                  </div>
                ) : (
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
          })}
        </>
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
          allOrders={orders}
          token={token}
          onConfirm={(confirmation) => confirmStock(checkingOrder.id, confirmation)}
          onClose={() => setCheckingOrder(null)}
          processing={processingId === checkingOrder.id}
        />
      )}

      {pinModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500 }}>
          <div style={{ background: "#fff", borderRadius: 18, width: "90%", maxWidth: 360, padding: 24 }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#24272B", margin: "0 0 6px" }}>PIN Atasan Diperlukan</p>
            <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "0 0 16px", lineHeight: 1.5 }}>
              Toko ini masih punya pesanan COD lain yang belum selesai. Masukkan PIN 6 angka dari atasan untuk lanjut approve pesanan COD ini.
            </p>
            <input
              type="password" inputMode="numeric" maxLength={6} value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
              placeholder="Masukkan PIN 6 angka"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E4E1DA", fontSize: 18, letterSpacing: "0.3em", textAlign: "center", marginBottom: 8 }}
              autoFocus
            />
            {pinError && <p style={{ fontSize: 12, color: "#C0392B", margin: "0 0 8px" }}>{pinError}</p>}
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button onClick={batalkanPinAtasan} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
                Batalkan
              </button>
              <button
                onClick={submitPinAtasan}
                disabled={pinInput.length !== 6 || verifyingPin}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: pinInput.length === 6 ? "#28685D" : "#E4E1DA", color: pinInput.length === 6 ? "#fff" : "#9CA0A6", fontWeight: 700, fontSize: 13.5 }}
              >
                {verifyingPin ? "Memeriksa..." : "Konfirmasi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MODAL CEK PESANAN (konfirmasi stock sebelum approve/tolak)
// ============================================================
function CekPesananModal({ order, allOrders, token, onConfirm, onClose, processing }) {
  const items = order.order_items || [];
  const [saldoToko, setSaldoToko] = useState(null);
  const [loadingSaldo, setLoadingSaldo] = useState(true);

  useEffect(() => {
    if (order.metode_bayar !== "transfer") { setLoadingSaldo(false); return; }
    supabaseFetch(token, `v_saldo_toko?select=saldo&client_id=eq.${order.client_id}`)
      .then((rows) => setSaldoToko(Number(rows[0]?.saldo || 0)))
      .catch(() => setSaldoToko(0))
      .finally(() => setLoadingSaldo(false));
  }, [order.id]);

  const totalOrder = items.reduce((sum, it) => sum + Number(it.subtotal_setelah_diskon || 0), 0);
  const saldoCukup = saldoToko !== null && saldoToko >= totalOrder;

  // Kalau pesanan ini COD, cek apakah toko yang sama masih punya pesanan COD
  // LAIN yang belum terselesaikan (belum lunas & belum selesai) - buat
  // Owner jadi pertimbangan sebelum approve COD baru lagi ke toko ini.
  const codBelumSelesai = order.metode_bayar === "cod"
    ? (allOrders || []).filter((o) =>
        o.id !== order.id &&
        o.client_id === order.client_id &&
        o.metode_bayar === "cod" &&
        o.status !== "selesai" &&
        o.status !== "ditolak"
      )
    : [];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 14, width: 460, maxHeight: "85vh", overflowY: "auto", padding: 24 }}>
        <p style={{ fontSize: 12, color: "#9CA0A6", margin: "0 0 2px", fontWeight: 700, textTransform: "uppercase" }}>Cek Pesanan</p>
        <h2 className="disp" style={{ fontSize: 20, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>{order.no_nota}</h2>
        <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "0 0 16px" }}>{order.clients?.nama}</p>

        {codBelumSelesai.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FBEAEA", borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <AlertCircle size={16} color="#C0392B" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: "#C0392B", margin: 0, fontWeight: 600, lineHeight: 1.5 }}>
              Perhatian: toko ini masih punya <strong>{codBelumSelesai.length} pesanan COD</strong> yang belum terselesaikan ({codBelumSelesai.map((o) => o.no_nota).join(", ")}). Pertimbangkan dulu sebelum approve COD baru.
            </p>
          </div>
        )}

        {order.metode_bayar === "transfer" && !loadingSaldo && saldoToko !== null && (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: saldoCukup ? "#D8E9E6" : "#FFFBF0", borderRadius: 10, padding: 12, marginBottom: 16 }}>
            {saldoCukup ? <Check size={16} color="#28685D" style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertCircle size={16} color="#8A6A1A" style={{ flexShrink: 0, marginTop: 1 }} />}
            <p style={{ fontSize: 12, color: saldoCukup ? "#28685D" : "#8A6A1A", margin: 0, fontWeight: 600, lineHeight: 1.5 }}>
              {saldoCukup
                ? "Saldo toko ini cukup - pesanan akan otomatis lunas begitu di-approve."
                : "Saldo toko ini belum cukup untuk melunasi total pesanan secara penuh."}
            </p>
          </div>
        )}

        {order.metode_bayar === "transfer" && order.bukti_transfer_url && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, background: "#FBF0D9", borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "#8A6A1A", margin: 0, fontWeight: 600 }}>Toko sudah upload bukti transfer.</p>
            <a href={order.bukti_transfer_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#8A6A1A", fontWeight: 700, textDecoration: "underline", flexShrink: 0 }}>
              Lihat Bukti
            </a>
          </div>
        )}

        {Number(order.diskon_tambahan_nilai || 0) > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBF0D9", borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: "#8A6A1A", margin: 0, fontWeight: 600 }}>
              {order.diskon_tambahan_keterangan || `Toko pakai potongan poin sebesar ${rupiah(Number(order.diskon_tambahan_nilai))}`}
            </p>
          </div>
        )}

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
function NotaPrintContent({ order, type, settings }) {
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
              <td style={{ padding: "2px 0", color: "#1B8A3D", fontWeight: 600 }}>{order.metode_bayar === "cod" ? "COD" : (order.clients?.jenis_pembayaran || "-")}</td>
            </tr>
            <tr>
              <td style={{ padding: "2px 8px 2px 0", fontWeight: 700, whiteSpace: "nowrap" }}>Jatuh Tempo:</td>
              <td style={{ padding: "2px 0", color: "#1B8A3D", fontWeight: 600 }}>{order.jatuh_tempo ? new Date(order.jatuh_tempo).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-"}</td>
            </tr>
            <tr>
              <td style={{ padding: "2px 8px 2px 0", fontWeight: 700, whiteSpace: "nowrap" }}>Status:</td>
              <td style={{ padding: "2px 0", color: order.metode_bayar === "cod" ? "#8A6A1A" : (isLunas ? "#1B8A3D" : "#C0392B"), fontWeight: 700 }}>
                {order.metode_bayar === "cod" ? "COD (Bayar di Tempat)" : (isLunas ? "Lunas" : "Belum Lunas")}
              </td>
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

      {/* CATATAN / REKENING - kalau COD pakai catatan khusus COD, kalau
          bukan (transfer, dsb) pakai catatan/info rekening seperti biasa.
          Cuma salah satu yang tampil, tidak berbarengan. */}
      {!isSuratJalan && order.metode_bayar === "cod" ? (
        s.catatan_cod && (
          <p style={{ fontSize: 11.5, fontWeight: 700, whiteSpace: "pre-line", lineHeight: 1.6, margin: "0 0 30px" }}>{s.catatan_cod}</p>
        )
      ) : (
        !isSuratJalan && s.catatan_tambahan && (
          <p style={{ fontSize: 11.5, fontWeight: 700, whiteSpace: "pre-line", lineHeight: 1.6, margin: "0 0 30px" }}>{s.catatan_tambahan}</p>
        )
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
  );
}

function NotaPrintModal({ order, type, settings, onClose }) {
  const [mencetak, setMencetak] = useState(false);
  const [errorCetak, setErrorCetak] = useState("");

  async function cetakOtomatis() {
    setMencetak(true);
    setErrorCetak("");
    try {
      await cetakNotaTeksOtomatis({ order, type, settings });
      onClose();
    } catch (e) {
      setErrorCetak("Gagal cetak otomatis: " + e.message + " - pastikan print server (di komputer ini) sedang jalan. Anda tetap bisa pakai tombol \"Cetak Manual\" di bawah sebagai cadangan.");
    }
    setMencetak(false);
  }

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
        <NotaPrintContent order={order} type={type} settings={settings} />
        {errorCetak && (
          <div className="no-print" style={{ margin: "0 36px", padding: 12, borderRadius: 9, background: "#FBEAEA", color: "#C0392B", fontSize: 12, lineHeight: 1.5 }}>
            {errorCetak}
          </div>
        )}
        <div className="no-print" style={{ display: "flex", gap: 10, padding: "16px 36px 24px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13 }}>
            Tutup
          </button>
          <button
            onClick={() => bukaTabPreviewCetak(<NotaPrintContent order={order} type={type} settings={settings} />, type === "surat_jalan" ? "Surat Jalan" : "Nota", "9.5in 11in")}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#24272B", fontWeight: 600, fontSize: 12.5 }}
          >
            Cetak Manual
          </button>
          <button
            onClick={cetakOtomatis}
            disabled={mencetak}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "#24272B", color: "#fff", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Printer size={15} /> {mencetak ? "Mencetak..." : "Cetak Otomatis"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// BULK PRINT MODAL - cetak nota/surat jalan banyak order sekaligus,
// masing-masing di halaman terpisah (page-break)
// ============================================================
function BulkPrintModal({ orders, type, settings, onClose }) {
  const [mencetak, setMencetak] = useState(false);
  const [progresCetak, setProgresCetak] = useState(0);
  const [errorCetak, setErrorCetak] = useState("");

  async function cetakOtomatisSemua() {
    setMencetak(true);
    setErrorCetak("");
    setProgresCetak(0);
    try {
      // Kalau lagi cetak massal NOTA, otomatis sisipkan Surat Jalan tepat
      // setelah Nota-nya untuk pesanan tujuan Pekanbaru saja (luar kota
      // tidak perlu Surat Jalan) - supaya 1 kali cetak massal langsung
      // jadi: Nota A, Surat Jalan A (kalau Pekanbaru), Nota B, Nota C,
      // Surat Jalan C (kalau Pekanbaru), dst - bukan dipisah per jenis.
      let daftarCetak;
      if (type === "nota") {
        daftarCetak = [];
        orders.forEach((o) => {
          daftarCetak.push({ order: o, type: "nota" });
          const kotaTujuan = o.tujuan_kota || o.clients?.kota;
          const isPekanbaru = !!(kotaTujuan && kotaTujuan.trim().toLowerCase().includes("pekanbaru"));
          if (isPekanbaru) daftarCetak.push({ order: o, type: "surat_jalan" });
        });
      } else {
        daftarCetak = orders.map((o) => ({ order: o, type }));
      }
      const totalDicetak = await cetakNotaMassalTeksOtomatis({
        orders: daftarCetak,
        settings,
      });
      setProgresCetak(totalDicetak);
    } catch (e) {
      setMencetak(false);
      setErrorCetak(`Gagal cetak massal: ${e.message} - pastikan print server jalan.`);
      return;
    }
    setMencetak(false);
    onClose();
  }

  return (
    <div className="nota-print-overlay" style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <style>{`
        @media print {
          @page { size: 9.5in 11in; margin: 0.4in; }
          body * { visibility: hidden; }
          .nota-print-area, .nota-print-area * { visibility: visible; }
          .nota-print-area { position: static !important; top: auto !important; left: auto !important; width: auto !important; }
          .bulk-print-item { page-break-after: always; break-after: page; position: relative !important; }
          .bulk-print-item:last-child { page-break-after: auto; break-after: auto; }
          .bulk-print-container { max-height: none !important; overflow: visible !important; }
          .nota-print-overlay { position: static !important; background: none !important; padding: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="bulk-print-container" style={{ background: "#fff", borderRadius: 14, width: 620, maxHeight: "90vh", overflowY: "auto", padding: 0 }}>
        <div className="no-print" style={{ padding: "20px 36px 0" }}>
          <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>
            {mencetak ? `Mencetak ${progresCetak}/${orders.length}...` : `${orders.length} dokumen siap dicetak.`}
          </p>
          {errorCetak && (
            <div style={{ marginTop: 10, padding: 12, borderRadius: 9, background: "#FBEAEA", color: "#C0392B", fontSize: 12, lineHeight: 1.5 }}>
              {errorCetak}
            </div>
          )}
        </div>
        {orders.map((o) => (
          <div key={o.id} className="bulk-print-item" style={{ borderTop: "1px dashed #E4E1DA", marginTop: 12 }}>
            <NotaPrintContent order={o} type={type} settings={settings} />
          </div>
        ))}
        <div className="no-print" style={{ display: "flex", gap: 10, padding: "16px 36px 24px" }}>
          <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13 }}>
            Tutup
          </button>
          <button
            onClick={() => bukaTabPreviewCetak(
              <>
                {orders.map((o) => (
                  <div key={o.id} style={{ marginBottom: "10mm" }}>
                    <NotaPrintContent order={o} type={type} settings={settings} />
                  </div>
                ))}
              </>,
              type === "surat_jalan" ? "Surat Jalan Massal" : "Nota Massal",
              "9.5in 11in"
            )}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#24272B", fontWeight: 600, fontSize: 12 }}
          >
            Cetak Manual
          </button>
          <button
            onClick={cetakOtomatisSemua}
            disabled={mencetak}
            style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "#24272B", color: "#fff", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Printer size={15} /> {mencetak ? `Mencetak ${progresCetak}/${orders.length}...` : `Cetak Otomatis (${orders.length})`}
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
    setProcessingId(id);
    try {
      await supabaseFetch(token, `clients?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "aktif" }),
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
            <p style={{ fontSize: 12.5, fontWeight: 700, color: "#28685D", margin: "0 0 4px" }}>Kode Toko: {c.kode}</p>
            <p style={{ fontSize: 13, color: "#6B6F75", margin: "0 0 2px" }}>{c.telp}</p>
            <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 14px" }}>{c.alamat}</p>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
  const [expandedId, setExpandedId] = useState(null); // client_id yang lagi dibuka
  const [detailMap, setDetailMap] = useState({}); // { client_id: [order,...] }
  const [loadingDetail, setLoadingDetail] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await supabaseFetch(token, "v_piutang_client?select=*&total_piutang=gt.0&order=total_piutang.desc");
      // Ambil SEMUA order COD yang jadi piutang sekaligus di awal (bukan
      // pas expand doang) - supaya bisa tahu toko mana yang SUDAH lewat
      // jatuh tempo tanpa perlu klik buka dulu.
      const semuaOrderPiutang = await supabaseFetch(token, "orders?select=id,client_id,jatuh_tempo&metode_bayar=eq.cod&status_bayar=eq.belum_lunas&status=in.(menunggu_pengiriman,proses_dikirim)&jatuh_tempo=not.is.null");
      const sekarang = new Date();
      const terlambatMap = {}; // { client_id: hari paling lama terlambat }
      (semuaOrderPiutang || []).forEach((o) => {
        const jt = new Date(o.jatuh_tempo);
        if (jt < sekarang) {
          const hari = Math.floor((sekarang - jt) / (1000 * 60 * 60 * 24));
          if (!terlambatMap[o.client_id] || hari > terlambatMap[o.client_id]) terlambatMap[o.client_id] = hari;
        }
      });
      setRows(data.map((r) => ({ ...r, hariTerlambat: terlambatMap[r.client_id] || null })));
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggleExpand(clientId) {
    if (expandedId === clientId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(clientId);
    if (!detailMap[clientId]) {
      setLoadingDetail(clientId);
      try {
        const orders = await supabaseFetch(
          token,
          `orders?select=id,no_nota,created_at,jatuh_tempo,order_items(subtotal_setelah_diskon)&client_id=eq.${clientId}&metode_bayar=eq.cod&status_bayar=eq.belum_lunas&status=in.(menunggu_pengiriman,proses_dikirim)&order=created_at.asc`
        );
        setDetailMap((prev) => ({ ...prev, [clientId]: orders }));
      } catch (e) {
        alert("Gagal muat rincian: " + e.message);
      }
      setLoadingDetail(null);
    }
  }

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
              <React.Fragment key={r.client_id}>
              <tr style={{ borderTop: "1px solid #EDEAE3" }}>
                <td style={{ padding: "12px 14px", fontWeight: 600 }}>
                  <button
                    onClick={() => toggleExpand(r.client_id)}
                    style={{ background: "none", border: "none", padding: 0, color: "#24272B", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {expandedId === r.client_id ? <ChevronRight size={14} style={{ transform: "rotate(90deg)", transition: "transform 0.15s" }} /> : <ChevronRight size={14} />}
                    {r.nama}
                  </button>
                </td>
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
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                    {r.melebihi_limit ? (
                      <span style={{ background: "#FBEAEA", color: "#C0392B", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>MELEBIHI LIMIT</span>
                    ) : (
                      <span style={{ background: "#D8E9E6", color: "#28685D", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>Aman</span>
                    )}
                    {r.hariTerlambat !== null && (
                      <span style={{ background: "#FBEAEA", color: "#C0392B", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                        Terlambat Bayar {r.hariTerlambat} hari
                      </span>
                    )}
                  </div>
                </td>
              </tr>
              {expandedId === r.client_id && (
                <tr>
                  <td colSpan={4} style={{ padding: 0, background: "#FAFAF8" }}>
                    <div style={{ padding: "14px 14px 14px 34px" }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 10px" }}>
                        Pesanan COD yang termasuk piutang ini
                      </p>
                      {loadingDetail === r.client_id ? (
                        <p style={{ fontSize: 12.5, color: "#9CA0A6" }}>Memuat...</p>
                      ) : (detailMap[r.client_id] || []).length === 0 ? (
                        <p style={{ fontSize: 12.5, color: "#9CA0A6" }}>Tidak ada rincian pesanan (kemungkinan data sudah berubah, coba refresh).</p>
                      ) : (
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr>
                              {["No. Nota", "Tanggal Dibuat", "Jatuh Tempo", "Nilai"].map((h) => (
                                <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "#9CA0A6", fontWeight: 700, fontSize: 10.5 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(detailMap[r.client_id] || []).map((o) => {
                              const nilai = (o.order_items || []).reduce((sum, it) => sum + Number(it.subtotal_setelah_diskon || 0), 0);
                              const jt = o.jatuh_tempo ? new Date(o.jatuh_tempo) : null;
                              const hariTerlambatOrder = jt && jt < new Date() ? Math.floor((new Date() - jt) / (1000 * 60 * 60 * 24)) : null;
                              return (
                                <tr key={o.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                                  <td style={{ padding: "6px 10px", fontWeight: 700 }}>{o.no_nota}</td>
                                  <td style={{ padding: "6px 10px", color: "#6B6F75" }}>
                                    {new Date(o.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                  </td>
                                  <td style={{ padding: "6px 10px" }}>
                                    {jt ? (
                                      <span style={{ color: hariTerlambatOrder !== null ? "#C0392B" : "#6B6F75", fontWeight: hariTerlambatOrder !== null ? 700 : 400 }}>
                                        {jt.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                        {hariTerlambatOrder !== null && (
                                          <span style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#C0392B" }}>Terlambat {hariTerlambatOrder} hari</span>
                                        )}
                                      </span>
                                    ) : "-"}
                                  </td>
                                  <td style={{ padding: "6px 10px", fontWeight: 600 }}>{rupiah(nilai)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
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
  const now = new Date();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [filterBulan, setFilterBulan] = useState(now.getMonth() + 1); // 0 = semua bulan
  const [filterTahun, setFilterTahun] = useState(now.getFullYear());

  async function load() {
    setLoading(true);
    setError("");
    try {
      const awalTahun = filterBulan === 0 ? `${filterTahun}-01-01` : `${filterTahun}-${String(filterBulan).padStart(2, "0")}-01`;
      // PENTING: hitung string tanggal akhir LANGSUNG (bukan lewat Date +
      // toISOString) - toISOString() konversi ke UTC, yang di timezone
      // Indonesia (UTC+7) bisa bikin tanggal MUNDUR 1 hari, jadi data
      // tanggal terakhir bulan itu (misal 31 Juli) ikut terpotong/hilang.
      const akhirStr = filterBulan === 0
        ? `${filterTahun + 1}-01-01`
        : filterBulan === 12
          ? `${filterTahun + 1}-01-01`
          : `${filterTahun}-${String(filterBulan + 1).padStart(2, "0")}-01`;

      // Hitung langsung di database (RPC) - lebih akurat & cepat daripada
      // fetch semua baris mentah lalu jumlahkan manual di JavaScript.
      const hasil = await supabaseFetch(token, "rpc/barang_terlaris_periode", {
        method: "POST",
        body: JSON.stringify({ tgl_mulai: awalTahun, tgl_akhir: akhirStr }),
      });
      setRows(hasil.map((r, i) => ({ ...r, peringkat: i + 1 })));
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [filterBulan, filterTahun]);

  if (error) return <ErrorBox error={error} onRetry={load} />;

  const NAMA_BULAN = ["Semua Bulan", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const daftarTahun = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div>
      <PageHeader title="Barang Terlaris" subtitle="Diurutkan dari qty terjual tertinggi" />

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <select value={filterBulan} onChange={(e) => setFilterBulan(Number(e.target.value))} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13 }}>
          {NAMA_BULAN.map((b, i) => (
            <option key={i} value={i}>{b}</option>
          ))}
        </select>
        <select value={filterTahun} onChange={(e) => setFilterTahun(Number(e.target.value))} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13 }}>
          {daftarTahun.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading ? <LoadingState /> : (
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
        {rows.length === 0 && <EmptyState text="Belum ada data penjualan di periode ini." />}
      </Card>
      )}
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
        supabaseFetch(token, "sales?select=id,kode,nama,target_omzet_bulanan&status_verifikasi=eq.terverifikasi&order=kode.asc"),
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
      const [orders, daftarToko] = await Promise.all([
        supabaseFetch(token, `orders?select=created_at,order_items(subtotal_setelah_diskon)&sales_id=eq.${salesId}&status=neq.ditolak`),
        supabaseFetch(token, `clients?select=nama,kode,kota,status&sales_id=eq.${salesId}&order=nama.asc`),
      ]);
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
          daftarToko,
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

                  {detail && !detail.loading && !detail.error && (
                    <div style={{ marginTop: 16, borderTop: "1px solid #EDEAE3", paddingTop: 14 }}>
                      <p style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 10px" }}>
                        Toko yang Ditangani ({detail.daftarToko?.length || 0})
                      </p>
                      {!detail.daftarToko || detail.daftarToko.length === 0 ? (
                        <p style={{ fontSize: 12, color: "#9CA0A6", margin: 0 }}>Belum ada toko yang ditangani.</p>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          {detail.daftarToko.map((t, i) => (
                            <div key={i} style={{ padding: "8px 10px", background: "#F7F5F1", borderRadius: 8 }}>
                              <p style={{ fontSize: 12.5, fontWeight: 600, color: "#24272B", margin: "0 0 2px" }}>{t.nama}</p>
                              <p style={{ fontSize: 11, color: "#9CA0A6", margin: 0 }}>{t.kode} - {t.kota || "-"}{t.status !== "aktif" && ` (${t.status})`}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
// ============================================================
// PREVIEW KERTAS - tampilkan bingkai persis ukuran kertas asli (inch),
// diperkecil (scale) supaya muat di layar, biar bisa lihat tata letak &
// ukuran SEBELUM benar-benar cetak ke printer.
// ============================================================
function PreviewKertas({ lebarIn, tinggiIn, children }) {
  const LEBAR_MAKS_LAYAR = 380; // px - lebar maksimal area preview di layar
  const lebarPx = lebarIn * 96; // 1 inch = 96px standar CSS
  const tinggiPx = tinggiIn * 96;
  const skala = Math.min(1, LEBAR_MAKS_LAYAR / lebarPx);

  return (
    <div style={{ marginTop: 14, padding: 16, background: "#F7F5F1", borderRadius: 12 }}>
      <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 10px", textAlign: "center" }}>
        Ukuran asli: {lebarIn.toFixed(2)}in x {tinggiIn.toFixed(2)}in - ditampilkan diperkecil ({Math.round(skala * 100)}%) supaya muat di layar
      </p>
      <div style={{ display: "flex", justifyContent: "center", overflowX: "auto" }}>
        <div
          style={{
            width: lebarPx, height: tinggiPx, transform: `scale(${skala})`, transformOrigin: "top center",
            background: "#fff", boxShadow: "0 2px 12px rgba(0,0,0,0.15)", overflow: "hidden", flexShrink: 0,
            marginBottom: (tinggiPx - tinggiPx * skala) * -1, // kompensasi ruang kosong dari scale
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}


// ============================================================
// REKENING BANK PERUSAHAAN - Owner kelola daftar rekening bank yang
// ditampilkan ke toko ASLI (bukan demo) untuk transfer manual, sementara
// integrasi Xendit VA masih dalam proses verifikasi.
// ============================================================
// ============================================================
// MODE MAINTENANCE - Owner aktifkan saat perlu update mendadak. Toko yang
// sedang buka Web App akan lihat info maintenance (dicek berkala), begitu
// dimatikan lagi, Web App toko OTOMATIS refresh paksa tanpa perlu klik apapun.
// ============================================================
function MaintenancePage({ token }) {
  const [loading, setLoading] = useState(true);
  const [aktif, setAktif] = useState(false);
  const [pesan, setPesan] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const rows = await supabaseFetch(token, "pengaturan_maintenance?select=*&id=eq.1");
      if (rows[0]) { setAktif(rows[0].aktif); setPesan(rows[0].pesan || ""); }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function simpan(aktifBaru) {
    setSaving(true);
    setError("");
    try {
      await supabaseFetch(token, "pengaturan_maintenance?id=eq.1", {
        method: "PATCH",
        body: JSON.stringify({ aktif: aktifBaru, pesan: pesan.trim() || null, updated_at: new Date().toISOString() }),
      });
      setAktif(aktifBaru);
    } catch (e) {
      setError("Gagal simpan: " + e.message);
    }
    setSaving(false);
  }

  if (loading) return <LoadingState />;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 560 }}>
      <h1 className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: "4px 0 6px" }}>Mode Maintenance</h1>
      <p style={{ fontSize: 13, color: "#6B6F75", margin: "0 0 20px", lineHeight: 1.6 }}>
        Aktifkan saat perlu update mendadak - Web App toko akan menampilkan info maintenance (dicek otomatis tiap beberapa detik). Begitu Anda matikan lagi, Web App toko akan <strong>otomatis refresh paksa</strong> tanpa perlu klik apapun dari mereka.
      </p>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBEAEA", color: "#C0392B", padding: 10, borderRadius: 9, fontSize: 12.5, marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #EDEAE3", borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>Status Saat Ini</p>
            <p style={{ fontSize: 12.5, color: aktif ? "#C0392B" : "#28685D", margin: 0, fontWeight: 600 }}>
              {aktif ? "AKTIF - Web App toko menampilkan maintenance" : "Nonaktif - Web App berjalan normal"}
            </p>
          </div>
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: aktif ? "#C0392B" : "#28685D" }} />
        </div>

        <label style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Pesan untuk Toko</label>
        <textarea
          value={pesan} onChange={(e) => setPesan(e.target.value)}
          rows={3}
          placeholder="Sistem sedang dalam pemeliharaan. Mohon tunggu sebentar..."
          style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, resize: "vertical", marginBottom: 16 }}
        />

        {aktif ? (
          <button
            onClick={() => simpan(false)} disabled={saving}
            style={{ width: "100%", padding: 13, borderRadius: 10, border: "none", background: "#28685D", color: "#fff", fontWeight: 700, fontSize: 14 }}
          >
            {saving ? "Menyimpan..." : "Matikan Maintenance (Refresh Paksa Toko)"}
          </button>
        ) : (
          <button
            onClick={() => simpan(true)} disabled={saving}
            style={{ width: "100%", padding: 13, borderRadius: 10, border: "none", background: "#C0392B", color: "#fff", fontWeight: 700, fontSize: 14 }}
          >
            {saving ? "Menyimpan..." : "Aktifkan Maintenance Sekarang"}
          </button>
        )}
      </div>

      <p style={{ fontSize: 11.5, color: "#9CA0A6", lineHeight: 1.6 }}>
        <strong>Alur yang disarankan:</strong> Aktifkan maintenance → lakukan update kode/database Anda → setelah semua beres, matikan maintenance di sini. Toko yang sedang membuka Web App akan otomatis ter-refresh dengan versi terbaru.
      </p>
    </div>
  );
}


function RekeningBankPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [daftar, setDaftar] = useState([]);
  const [namaBank, setNamaBank] = useState("");
  const [noRekening, setNoRekening] = useState("");
  const [atasNama, setAtasNama] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const rows = await supabaseFetch(token, "rekening_bank_perusahaan?select=*&order=urutan.asc");
      setDaftar(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function tambah() {
    if (!namaBank.trim() || !noRekening.trim() || !atasNama.trim()) {
      setError("Isi dulu nama bank, nomor rekening, dan atas nama.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await supabaseFetch(token, "rekening_bank_perusahaan", {
        method: "POST",
        body: JSON.stringify({ nama_bank: namaBank.trim(), no_rekening: noRekening.trim(), atas_nama: atasNama.trim(), urutan: daftar.length }),
      });
      setNamaBank(""); setNoRekening(""); setAtasNama("");
      await load();
    } catch (e) {
      setError("Gagal simpan: " + e.message);
    }
    setSaving(false);
  }

  async function toggleAktif(id, statusSaatIni) {
    try {
      await supabaseFetch(token, `rekening_bank_perusahaan?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ aktif: !statusSaatIni, updated_at: new Date().toISOString() }) });
      setDaftar((prev) => prev.map((r) => (r.id === id ? { ...r, aktif: !statusSaatIni } : r)));
    } catch (e) {
      alert("Gagal ubah status: " + e.message);
    }
  }

  async function hapus(id) {
    if (!confirm("Hapus rekening ini?")) return;
    try {
      await supabaseFetch(token, `rekening_bank_perusahaan?id=eq.${id}`, { method: "DELETE" });
      setDaftar((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      alert("Gagal hapus: " + e.message);
    }
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 640 }}>
      <h1 className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: "4px 0 6px" }}>Rekening Bank Perusahaan</h1>
      <p style={{ fontSize: 13, color: "#6B6F75", margin: "0 0 20px", lineHeight: 1.6 }}>
        Ditampilkan ke toko untuk transfer manual, sementara integrasi Xendit VA masih dalam proses verifikasi. Cuma akun demo Xendit yang tetap pakai VA otomatis.
      </p>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBEAEA", color: "#C0392B", padding: 10, borderRadius: 9, fontSize: 12.5, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#9CA0A6", fontSize: 13 }}>Memuat...</p>
      ) : daftar.length === 0 ? (
        <p style={{ color: "#9CA0A6", fontSize: 12.5, marginBottom: 20 }}>Belum ada rekening ditambahkan.</p>
      ) : (
        daftar.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, padding: "12px 14px", background: "#fff", border: "1px solid #EDEAE3", borderRadius: 12 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{r.nama_bank}</p>
              <p style={{ fontSize: 12.5, color: "#6B6F75", margin: 0, fontFamily: "monospace" }}>{r.no_rekening}</p>
              <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "2px 0 0" }}>a.n. {r.atas_nama}</p>
            </div>
            <button
              onClick={() => toggleAktif(r.id, r.aktif)}
              style={{ padding: "5px 10px", borderRadius: 999, border: "none", background: r.aktif ? "#D8E9E6" : "#F7F5F1", color: r.aktif ? "#28685D" : "#9CA0A6", fontSize: 11, fontWeight: 700 }}
            >
              {r.aktif ? "Aktif" : "Nonaktif"}
            </button>
            <button onClick={() => hapus(r.id)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #F0CFC7", background: "#fff", color: "#C0392B", fontSize: 11.5, fontWeight: 600 }}>
              Hapus
            </button>
          </div>
        ))
      )}

      <div style={{ marginTop: 24, padding: 18, background: "#F7F5F1", borderRadius: 14 }}>
        <p style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 12px" }}>Tambah Rekening Baru</p>
        <div style={{ marginBottom: 10 }}>
          <input value={namaBank} onChange={(e) => setNamaBank(e.target.value)} placeholder="Nama Bank (misal: BCA)" style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13 }} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <input value={noRekening} onChange={(e) => setNoRekening(e.target.value)} placeholder="Nomor Rekening" style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13 }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <input value={atasNama} onChange={(e) => setAtasNama(e.target.value)} placeholder="Atas Nama (misal: PT Indo Garuda Abadi)" style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13 }} />
        </div>
        <button onClick={tambah} disabled={saving} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: "#24272B", color: "#fff", fontWeight: 700, fontSize: 13.5 }}>
          {saving ? "Menyimpan..." : "+ Tambah Rekening"}
        </button>
      </div>
    </div>
  );
}

function FormatNotaPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [id, setId] = useState(null);
  const [previewAktif, setPreviewAktif] = useState(null); // "nota" | "surat_jalan" | "kurir" | "barcode" | null

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
          whatsapp_cs: form.whatsapp_cs,
          teks_subjudul_nota: form.teks_subjudul_nota,
          teks_subjudul_surat_jalan: form.teks_subjudul_surat_jalan,
          teks_footer_nota: form.teks_footer_nota,
          catatan_tambahan: form.catatan_tambahan,
          catatan_cod: form.catatan_cod,
          label_ttd_kiri: form.label_ttd_kiri,
          label_ttd_kanan: form.label_ttd_kanan,
          lebar_kertas_nota: Number(form.lebar_kertas_nota) || 9.5,
          tinggi_kertas_nota: Number(form.tinggi_kertas_nota) || 11,
          lebar_kertas_kurir: Number(form.lebar_kertas_kurir) || 8.5,
          tinggi_kertas_kurir: Number(form.tinggi_kertas_kurir) || 11,
          lebar_label_barcode_mm: Number(form.lebar_label_barcode_mm) || 100,
          tinggi_label_barcode_mm: Number(form.tinggi_label_barcode_mm) || 150,
          mode_fit_barcode: !!form.mode_fit_barcode,
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

  // Data contoh (dummy) buat preview - tidak nyata, cuma buat lihat tata letak
  const dummyOrder = {
    no_nota: "NT01202601000123",
    created_at: new Date().toISOString(),
    clients: { nama: "Toko Contoh Jaya", alamat: "Jl. Contoh Raya No. 45, Pekanbaru" },
    tujuan_alamat: "Jl. Contoh Raya No. 45, Pekanbaru",
    jenis_pembayaran: "Transfer",
    metode_bayar: "transfer",
    status_bayar: "belum_lunas",
    jatuh_tempo: new Date(Date.now() + 7 * 86400000).toISOString(),
    diskon_tambahan_nilai: 0,
    order_items: [
      { id: "1", qty: 2, harga_satuan: 120000, subtotal_setelah_diskon: 240000, products: { nama: "Contoh Barang A", satuan: "Dus" } },
      { id: "2", qty: 5, harga_satuan: 45000, subtotal_setelah_diskon: 202500, products: { nama: "Contoh Barang B", satuan: "Pcs" } },
    ],
  };
  const dummyLaporanKurir = {
    jenis_kurir: "baraka", jenis_laporan: "kirim", created_at: new Date().toISOString(),
    nama_kurir: "Contoh Nama Kurir", no_hp_kurir: "0812xxxxxxx", jumlah_koli: 3,
  };
  const dummyItemsKurir = [
    { id: "1", no_nota: "NT01202601000123", jumlah_box: 2, catatan: "-" },
    { id: "2", no_nota: "NT01202601000124", jumlah_box: 1, catatan: "Pecah belah" },
  ];

  function tombolPreview(kunci, label) {
    return (
      <button
        type="button"
        onClick={() => setPreviewAktif(previewAktif === kunci ? null : kunci)}
        style={{ marginTop: 8, padding: "7px 14px", borderRadius: 8, border: "1.5px solid #E4E1DA", background: previewAktif === kunci ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 12, fontWeight: 700 }}
      >
        <Eye size={12} style={{ verticalAlign: -1, marginRight: 4 }} /> {previewAktif === kunci ? "Tutup Preview" : label}
      </button>
    );
  }

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
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>No. WhatsApp Customer Service</label>
          <input value={form.whatsapp_cs || ""} onChange={set("whatsapp_cs")} placeholder="6281234567890 (pakai kode negara 62, tanpa spasi/tanda hubung)" style={fieldStyle} />
          <p style={{ fontSize: 11, color: "#9CA0A6", margin: "6px 0 0" }}>Ini nomor yang dipakai tombol WhatsApp CS di Service Center Web App.</p>
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
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Catatan Khusus COD (menggantikan Catatan/Info Rekening di atas, khusus untuk order COD)</label>
          <textarea
            value={form.catatan_cod || ""} onChange={set("catatan_cod")} rows={3}
            placeholder={"Mohon siapkan uang pas.\nPembayaran diterima kurir saat barang diterima."}
            style={{ ...fieldStyle, resize: "vertical" }}
          />
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

        <div style={{ borderTop: "1px solid #EDEAE3", paddingTop: 18, marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>Ukuran Kertas "Cetak Otomatis"</p>
          <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 14px" }}>Cuma berlaku untuk tombol "Cetak Otomatis" (langsung ke printer, tanpa dialog) - dalam satuan inch.</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Nota/Surat Jalan - Lebar</label>
              <input type="number" step="0.1" min="1" value={form.lebar_kertas_nota ?? 9.5} onChange={set("lebar_kertas_nota")} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Nota/Surat Jalan - Tinggi</label>
              <input type="number" step="0.1" min="1" value={form.tinggi_kertas_nota ?? 11} onChange={set("tinggi_kertas_nota")} style={fieldStyle} />
            </div>
          </div>
          {tombolPreview("nota", "Lihat Preview Nota")}
          {previewAktif === "nota" && (
            <PreviewKertas lebarIn={Number(form.lebar_kertas_nota) || 9.5} tinggiIn={Number(form.tinggi_kertas_nota) || 11}>
              <NotaPrintContent order={dummyOrder} type="nota" settings={form} />
            </PreviewKertas>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Dokumen Kurir - Lebar</label>
              <input type="number" step="0.1" min="1" value={form.lebar_kertas_kurir ?? 8.5} onChange={set("lebar_kertas_kurir")} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Dokumen Kurir - Tinggi</label>
              <input type="number" step="0.1" min="1" value={form.tinggi_kertas_kurir ?? 11} onChange={set("tinggi_kertas_kurir")} style={fieldStyle} />
            </div>
          </div>
          {tombolPreview("kurir", "Lihat Preview Dokumen Kurir")}
          {previewAktif === "kurir" && (
            <PreviewKertas lebarIn={Number(form.lebar_kertas_kurir) || 8.5} tinggiIn={Number(form.tinggi_kertas_kurir) || 11}>
              <LaporanKurirDocContent laporan={dummyLaporanKurir} items={dummyItemsKurir} />
            </PreviewKertas>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
            <div>
              <label style={labelStyle}>Label Barcode - Lebar (mm)</label>
              <input type="number" step="1" min="10" value={form.lebar_label_barcode_mm ?? 100} onChange={set("lebar_label_barcode_mm")} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>Label Barcode - Tinggi (mm)</label>
              <input type="number" step="1" min="10" value={form.tinggi_label_barcode_mm ?? 150} onChange={set("tinggi_label_barcode_mm")} style={fieldStyle} />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 12.5, color: "#24272B", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={!!form.mode_fit_barcode}
              onChange={(e) => setForm({ ...form, mode_fit_barcode: e.target.checked })}
            />
            Mode "Fit" - sesuaikan konten supaya pasti kelihatan penuh (tidak terpotong), bisa ada spasi kosong. Kalau tidak dicentang, konten diregangkan penuh mengikuti lebar kertas.
          </label>
          {tombolPreview("barcode", "Lihat Preview Label Barcode")}
          {previewAktif === "barcode" && (
            <PreviewKertas lebarIn={(Number(form.lebar_label_barcode_mm) || 100) / 25.4} tinggiIn={(Number(form.tinggi_label_barcode_mm) || 150) / 25.4}>
              <BarcodeLabelContent order={dummyOrder} noBox={1} totalBox={2} />
            </PreviewKertas>
          )}
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

  function statusInfo(o) {
    if (o.status === "dikirim") return { label: "Terkirim", bg: "#D8E9E6", fg: "#28685D" };
    if (o.status === "selesai" && o.alasan_retur) return { label: "Retur Selesai", bg: "#FBEAEA", fg: "#C0392B" };
    if (o.status === "selesai") return { label: "Selesai", bg: "#EFE1BE", fg: "#8A6A1A" };
    return o.alasan_dibatalkan ? { label: "Dibatalkan Toko", bg: "#FBEAEA", fg: "#C0392B" } : { label: "Ditolak Admin", bg: "#FBEAEA", fg: "#C0392B" };
  }

  function exportCSV() {
    const header = ["No Nota", "Tanggal", "Kode Toko", "Nama Toko", "Status", "Channel", "Dropship", "Total"];
    const rows = filtered.map((o) => [
      o.no_nota,
      new Date(o.created_at).toLocaleDateString("id-ID"),
      o.clients?.kode || "",
      o.clients?.nama || "",
      statusInfo(o).label,
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
              const st = statusInfo(o);
              return (
                <tr key={o.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 700 }}>{o.no_nota}</td>
                  <td style={{ padding: "12px 14px" }}>{new Date(o.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                  <td style={{ padding: "12px 14px" }}>{o.clients?.nama} ({o.clients?.kode})</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: st.bg, color: st.fg, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                      {o.alasan_dibatalkan ? <Clock size={11} /> : <Check size={11} />} {o.alasan_dibatalkan ? "Dibatalkan" : st.label}
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
  const [editForm, setEditForm] = useState({ alamat: "", telp: "", kodeSales: "", catatan: "", namaOwner: "", tanggalLahir: "", jenisUsaha: "", provinsi: "", email: "" });
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
      email: c.email || "",
    });
  }

  function matchedSales(kode) {
    return salesList.find((s) => s.kode.toUpperCase() === kode.trim().toUpperCase());
  }

  // Aktifkan/nonaktifkan toko ini buat bisa dibantu order-kan sales (mode
  // sales di Web App) - toko baru muncul di layar "Pilih Toko" sales kalau
  // ini AKTIF.
  async function toggleModeSales(clientId, statusSaatIni) {
    try {
      await supabaseFetch(token, `clients?id=eq.${clientId}`, {
        method: "PATCH",
        body: JSON.stringify({ mode_sales_aktif: !statusSaatIni }),
      });
      setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, mode_sales_aktif: !statusSaatIni } : c)));
    } catch (e) {
      alert("Gagal ubah status mode sales: " + e.message);
    }
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
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 900 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Nama Toko", "Alamat", "No HP", "Email", "Kode Sales", "Nama Sales", "Mode Sales", "Terakhir Order", "Catatan", ""].map((h) => (
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
              .sort((a, b) => (a.kode || "").localeCompare(b.kode || ""))
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
                  <td style={{ padding: "12px 14px" }}>
                    <button
                      onClick={() => toggleModeSales(c.id, c.mode_sales_aktif)}
                      disabled={!c.sales_id}
                      title={!c.sales_id ? "Toko ini belum punya sales - tidak relevan diaktifkan" : ""}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 999, border: "none",
                        background: c.mode_sales_aktif ? "#D8E9E6" : "#F7F5F1",
                        color: c.mode_sales_aktif ? "#28685D" : "#9CA0A6",
                        fontSize: 11, fontWeight: 700, opacity: !c.sales_id ? 0.5 : 1,
                      }}
                    >
                      {c.mode_sales_aktif ? "Aktif" : "Nonaktif"}
                    </button>
                  </td>
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
        </div>
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

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Email</label>
                <p style={{ padding: "10px 12px", background: "#F7F5F1", borderRadius: 9, fontSize: 13.5, color: editForm.email ? "#24272B" : "#C0392B", margin: 0 }}>
                  {editForm.email || "Belum ada email terdaftar"}
                </p>
                <p style={{ fontSize: 11, color: "#9CA0A6", margin: "6px 0 0" }}>Email ini sama dengan yang dipakai toko login (sudah diverifikasi OTP saat daftar) - tidak bisa diubah dari sini.</p>
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
function StockItemPage({ token, role }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [products, stock] = await Promise.all([
        supabaseFetch(token, "products?select=id,kode,nama,kategori,satuan,harga_modal,stock_minimum&aktif=eq.true&order=kode.asc"),
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
  const sembunyikanModal = role === "admin_transaksi";
  const kolomTabel = sembunyikanModal ? ["Kode", "Nama Barang", "Kategori", "Satuan", "Stock"] : ["Kode", "Nama Barang", "Kategori", "Satuan", "Stock", "Harga Modal", "Total Modal"];
  const rowsMenipis = rows.filter((r) => Number(r.stock_minimum) > 0 && r.stock_akhir <= Number(r.stock_minimum));

  return (
    <div>
      <PageHeader title="Stock Item" subtitle={sembunyikanModal ? "Stock akhir tiap barang" : "Nilai modal barang berdasarkan stock akhir - data rahasia, hanya Owner"} />

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 16 }}>
        {!sembunyikanModal && (
          <Card style={{ display: "inline-block" }}>
            <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Total Modal Seluruh Stock</p>
            <p className="disp" style={{ fontSize: 26, fontWeight: 700, color: "#24272B", margin: 0 }}>{rupiah(grandTotal)}</p>
          </Card>
        )}
        {rowsMenipis.length > 0 && (
          <Card style={{ display: "inline-block", background: "#FBEAEA", border: "1.5px solid #F0CFC7" }}>
            <p style={{ fontSize: 11.5, color: "#C0392B", margin: "0 0 6px", fontWeight: 700 }}>⚠️ Stock Menipis</p>
            <p className="disp" style={{ fontSize: 26, fontWeight: 700, color: "#C0392B", margin: 0 }}>{rowsMenipis.length} produk</p>
          </Card>
        )}
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {kolomTabel.map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows].sort((a, b) => {
              const aMenipis = Number(a.stock_minimum) > 0 && a.stock_akhir <= Number(a.stock_minimum);
              const bMenipis = Number(b.stock_minimum) > 0 && b.stock_akhir <= Number(b.stock_minimum);
              if (aMenipis === bMenipis) return 0;
              return aMenipis ? -1 : 1;
            }).map((r) => {
              const menipis = Number(r.stock_minimum) > 0 && r.stock_akhir <= Number(r.stock_minimum) && r.stock_akhir >= 0;
              return (
              <tr key={r.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                <td style={{ padding: "12px 14px", fontWeight: 700 }}>{r.kode}</td>
                <td style={{ padding: "12px 14px" }}>{r.nama}</td>
                <td style={{ padding: "12px 14px", color: "#6B6F75" }}>{r.kategori}</td>
                <td style={{ padding: "12px 14px", color: "#6B6F75" }}>{r.satuan}</td>
                <td style={{ padding: "12px 14px", fontWeight: 600, color: r.stock_akhir < 0 ? "#C0392B" : "#24272B" }}>
                  {r.stock_akhir}
                  {r.stock_akhir < 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#C0392B" }}>MINUS!</span>}
                  {menipis && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#FBEAEA", color: "#C0392B" }}>Stock Menipis</span>}
                </td>
                {!sembunyikanModal && (
                  <>
                    <td style={{ padding: "12px 14px" }}>{rupiah(r.harga_modal)}</td>
                    <td style={{ padding: "12px 14px", fontWeight: 700 }}>{rupiah(r.total_modal)}</td>
                  </>
                )}
              </tr>
              );
            })}
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
// ============================================================
// PENYESUAIAN STOK (STOCK OPNAME) - Owner input stok fisik SEBENARNYA di
// gudang per produk, sistem otomatis hitung selisih dari stok sistem dan
// catat sebagai riwayat penyesuaian (bisa nambah atau kurangi).
// ============================================================
function PenyesuaianStokPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [productId, setProductId] = useState("");
  const [stokFisik, setStokFisik] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [productRows, stockRows, historyRows] = await Promise.all([
        supabaseFetch(token, "products?select=id,kode,nama,satuan&aktif=eq.true&order=kode.asc"),
        supabaseFetch(token, "v_stock_akhir?select=product_id,stock_akhir"),
        supabaseFetch(token, "stock_movements?select=*,products(kode,nama,satuan)&jenis=eq.penyesuaian&order=created_at.desc&limit=30"),
      ]);
      const stockMap = {};
      stockRows.forEach((s) => { stockMap[s.product_id] = s.stock_akhir; });
      setProducts(productRows.map((p) => ({ ...p, stock_sistem: stockMap[p.id] ?? 0 })));
      setHistory(historyRows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const produkTerpilih = products.find((p) => p.id === productId);
  const selisih = produkTerpilih && stokFisik !== "" ? Number(stokFisik) - produkTerpilih.stock_sistem : null;

  async function submit() {
    if (!productId || stokFisik === "") {
      alert("Pilih barang dan isi jumlah stok fisik dulu.");
      return;
    }
    if (selisih === 0) {
      alert("Stok fisik sama dengan stok sistem - tidak ada yang perlu disesuaikan.");
      return;
    }
    setSaving(true);
    setSaveMsg("");
    try {
      const [inserted] = await supabaseFetch(token, "stock_movements", {
        method: "POST",
        body: JSON.stringify({
          product_id: productId,
          tanggal: new Date().toISOString().slice(0, 10),
          jenis: "penyesuaian",
          qty: selisih,
          keterangan: keterangan || `Stock opname - stok fisik ${stokFisik}, sistem ${produkTerpilih.stock_sistem}, selisih ${selisih > 0 ? "+" : ""}${selisih}`,
        }),
      });
      setHistory((prev) => [{ ...inserted, products: produkTerpilih }, ...prev]);
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, stock_sistem: Number(stokFisik) } : p)));
      setProductId("");
      setStokFisik("");
      setKeterangan("");
      setSaveMsg("Penyesuaian stok berhasil dicatat.");
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
      <PageHeader title="Penyesuaian Stok" subtitle="Cocokkan stok sistem dengan hasil hitung fisik di gudang (stock opname)" />

      <Card style={{ maxWidth: 520, marginBottom: 24 }}>
        <label style={labelStyle}>Pilih Barang</label>
        <select value={productId} onChange={(e) => { setProductId(e.target.value); setStokFisik(""); }} style={{ ...fieldStyle, marginBottom: 14 }}>
          <option value="">-- Pilih Barang --</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>{p.kode} - {p.nama}</option>
          ))}
        </select>

        {produkTerpilih && (
          <div style={{ background: "#F7F5F1", borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: "#6B6F75", margin: 0 }}>
              Stok sistem saat ini: <strong style={{ color: "#24272B" }}>{produkTerpilih.stock_sistem} {produkTerpilih.satuan}</strong>
            </p>
          </div>
        )}

        <label style={labelStyle}>Stok Fisik Sebenarnya (Hasil Hitung di Gudang)</label>
        <input
          type="number" value={stokFisik} onChange={(e) => setStokFisik(e.target.value)}
          placeholder="Isi jumlah stok fisik yang sebenarnya"
          style={{ ...fieldStyle, marginBottom: 14 }}
          disabled={!productId}
        />

        {selisih !== null && (
          <div style={{ background: selisih === 0 ? "#D8E9E6" : selisih > 0 ? "#D8E9E6" : "#FBEAEA", borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <p style={{ fontSize: 12.5, color: selisih === 0 ? "#28685D" : selisih > 0 ? "#28685D" : "#C0392B", margin: 0, fontWeight: 700 }}>
              Selisih: {selisih > 0 ? "+" : ""}{selisih} {produkTerpilih?.satuan}
              {selisih !== 0 && (selisih > 0 ? " (stok akan bertambah)" : " (stok akan berkurang)")}
            </p>
          </div>
        )}

        <label style={labelStyle}>Keterangan (Opsional)</label>
        <textarea
          value={keterangan} onChange={(e) => setKeterangan(e.target.value)}
          placeholder="Misal: hasil stock opname bulanan, ada barang rusak, dll"
          rows={2}
          style={{ ...fieldStyle, marginBottom: 16, resize: "vertical", fontFamily: "inherit" }}
        />

        <button
          onClick={submit}
          disabled={saving || !productId || stokFisik === ""}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: "#28685D", color: "#fff", fontWeight: 700, fontSize: 13.5 }}
        >
          {saving ? "Menyimpan..." : "Simpan Penyesuaian"}
        </button>
        {saveMsg && <p style={{ fontSize: 12.5, color: "#28685D", margin: "10px 0 0", textAlign: "center" }}>{saveMsg}</p>}
      </Card>

      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>Riwayat Penyesuaian</h2>
      {history.length === 0 ? (
        <EmptyState text="Belum ada riwayat penyesuaian stok." />
      ) : (
        history.map((h) => (
          <Card key={h.id} style={{ marginBottom: 8, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: 0 }}>{h.products?.nama}</p>
                <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "2px 0 6px" }}>{h.products?.kode}</p>
                {h.keterangan && <p style={{ fontSize: 12, color: "#6B6F75", margin: 0 }}>{h.keterangan}</p>}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: Number(h.qty) >= 0 ? "#28685D" : "#C0392B" }}>
                  {Number(h.qty) >= 0 ? "+" : ""}{h.qty} {h.products?.satuan}
                </span>
                <p style={{ fontSize: 11, color: "#9CA0A6", margin: "4px 0 0" }}>
                  {new Date(h.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

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
        "orders?select=id,no_nota,created_at,jatuh_tempo,status,status_bayar,metode_bayar,is_dropship,nama_pengirim_dropship,tujuan_nama,tujuan_telp,tujuan_alamat,diskon_tambahan_jenis,diskon_tambahan_nilai,diskon_tambahan_keterangan,alasan_retur,alasan_dibatalkan,picking_selesai_at,outbound_verified_at,clients(nama,kode,alamat,telp,jenis_pembayaran),order_items(*,products(kode,nama,satuan,nomor_produk)),cashback_ledger(id,nilai_cashback,status)&order=created_at.desc&limit=500"
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
  function exportCSV() {
    const header = ["No Nota", "Tanggal", "Kode Toko", "Nama Toko", "Status", "Metode Bayar", "Status Bayar", "Total"];
    const rows = filtered.map((o) => {
      const total = (o.order_items || []).reduce((sum, it) => sum + Number(it.subtotal_setelah_diskon || 0), 0);
      return [
        o.no_nota,
        new Date(o.created_at).toLocaleDateString("id-ID"),
        o.clients?.kode || "",
        o.clients?.nama || "",
        statusPerjalanan(o).label,
        o.metode_bayar || "",
        o.status_bayar || "",
        total,
      ];
    });
    const csvContent = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rekap-nota-${filterYear}${filterMonth ? "-" + String(filterMonth).padStart(2, "0") : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function statusPerjalanan(o) {
    if (o.status === "ditolak") return o.alasan_dibatalkan ? { label: "Dibatalkan Toko", bg: "#FBEAEA", fg: "#C0392B" } : { label: "Ditolak Admin", bg: "#FBEAEA", fg: "#C0392B" };
    if (o.status === "menunggu_persetujuan") return { label: "Menunggu Persetujuan", bg: "#F7F5F1", fg: "#6B6F75" };
    if (o.status === "menunggu_pembayaran" && o.metode_bayar !== "cod" && o.status_bayar !== "lunas") return { label: "Menunggu Pembayaran", bg: "#FBEAEA", fg: "#C0392B" };
    // Sudah lunas (atau COD, yang tidak perlu tunggu bukti transfer) tapi
    // belum masuk Picking List sama sekali - masih di antrean pengemasan.
    if ((o.status === "menunggu_pembayaran" || o.status === "menunggu_pengiriman") && !o.picking_selesai_at) return { label: "Menunggu Pengemasan", bg: "#FBF0D9", fg: "#8A6A1A" };
    // Sudah picking selesai tapi belum upload bukti pengemasan (masih di
    // Picking List, tinggal upload foto).
    if ((o.status === "menunggu_pembayaran" || o.status === "menunggu_pengiriman") && o.picking_selesai_at && !o.outbound_verified_at) return { label: "Menunggu Upload Bukti Pengemasan", bg: "#FBF0D9", fg: "#8A6A1A" };
    if (o.status === "siap_dikirim") return { label: "Siap Dikirim", bg: "#D8E9E6", fg: "#28685D" };
    if (o.status === "proses_dikirim" || o.status === "dikirim") return { label: "Proses Pengiriman", bg: "#D8E9E6", fg: "#28685D" };
    if (o.status === "diretur") return { label: "Diretur", bg: "#FBEAEA", fg: "#C0392B" };
    if (o.status === "selesai" && o.alasan_retur) return { label: "Retur Selesai", bg: "#FBEAEA", fg: "#C0392B" };
    if (o.status === "selesai") return { label: "Telah Diselesaikan", bg: "#EFE1BE", fg: "#8A6A1A" };
    return { label: o.status, bg: "#F7F5F1", fg: "#6B6F75" };
  }

  const filtered = orders.filter((o) => {
    const d = new Date(o.created_at);
    if (d.getFullYear() !== Number(filterYear)) return false;
    if (filterMonth !== 0 && d.getMonth() + 1 !== Number(filterMonth)) return false;
    if (filterStatus !== "semua" && o.status !== filterStatus) return false;
    return true;
  }); // urutan mengikuti query asli (created_at.desc) - pesanan terbaru duluan

  const totalCashbackBelumDibayar = filtered.reduce((s, o) => {
    const cb = o.cashback_ledger?.[0];
    return s + (cb && cb.status === "belum_dibayar" ? Number(cb.nilai_cashback) : 0);
  }, 0);
  const totalCashbackTerbayarkan = filtered.reduce((s, o) => {
    const cb = o.cashback_ledger?.[0];
    return s + (cb && cb.status === "sudah_dibayar" ? Number(cb.nilai_cashback) : 0);
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

  const [activeTab, setActiveTab] = useState("nota"); // "nota" | "cashback"

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const cashbackTerbayarkan = filtered.filter((o) => o.cashback_ledger?.[0]?.status === "sudah_dibayar");

  return (
    <div>
      <PageHeader title="Rekap Nota" subtitle="Status perjalanan tiap nota, dari pengecekan stock sampai selesai" />

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={() => setActiveTab("nota")} style={{ padding: "9px 18px", borderRadius: 9, border: activeTab === "nota" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: activeTab === "nota" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}>
          Rekap Nota
        </button>
        <button onClick={() => setActiveTab("cashback")} style={{ padding: "9px 18px", borderRadius: 9, border: activeTab === "cashback" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: activeTab === "cashback" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}>
          Cashback Terbayarkan
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        <StatCard label="Total Omzet (sesuai filter)" value={rupiah(totalOmzet)} color="#24272B" bg="#F7F5F1" small />
        <StatCard label="Telah Diselesaikan" value={rupiah(totalSelesai)} color="#28685D" bg="#D8E9E6" small />
        <StatCard label="Cashback Belum Dibayar" value={rupiah(totalCashbackBelumDibayar)} color="#B8860B" bg="#FBF0D9" small />
        <StatCard label="Cashback Terbayarkan" value={rupiah(totalCashbackTerbayarkan)} color="#28685D" bg="#D8E9E6" small />
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, background: "#fff" }}>
          {yearsAvailable.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, background: "#fff" }}>
          {BULAN.map((b, i) => <option key={i} value={i}>{b}</option>)}
        </select>
        {activeTab === "nota" && (
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, background: "#fff" }}>
            <option value="semua">Semua Status</option>
            <option value="menunggu_persetujuan">Menunggu Persetujuan</option>
            <option value="menunggu_pembayaran">Menunggu Pembayaran / Pengemasan</option>
            <option value="menunggu_pengiriman">Menunggu Pengemasan</option>
            <option value="siap_dikirim">Siap Dikirim</option>
            <option value="proses_dikirim">Proses Pengiriman</option>
            <option value="diretur">Diretur</option>
            <option value="selesai">Telah Diselesaikan</option>
            <option value="ditolak">Ditolak</option>
          </select>
        )}
        <div style={{ flex: 1 }} />
        {activeTab === "nota" && (
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "none", background: "#24272B", color: "#fff", fontSize: 13, fontWeight: 700 }}
          >
            <Download size={14} /> Export CSV
          </button>
        )}
      </div>

      {activeTab === "cashback" ? (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#F7F5F1" }}>
                {["No. Nota", "Toko", "Alamat", "Cashback", "Tanggal Dibayar"].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cashbackTerbayarkan.map((o) => {
                const cb = o.cashback_ledger?.[0];
                return (
                  <tr key={o.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 700 }}>{o.no_nota}</td>
                    <td style={{ padding: "12px 14px" }}>{o.clients?.nama}</td>
                    <td style={{ padding: "12px 14px", color: "#6B6F75", fontSize: 12 }}>{o.clients?.alamat}</td>
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "#28685D" }}>{rupiah(cb?.nilai_cashback)}</td>
                    <td style={{ padding: "12px 14px", color: "#9CA0A6", fontSize: 11.5 }}>
                      {new Date(o.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {cashbackTerbayarkan.length === 0 && <EmptyState text="Belum ada cashback yang terbayarkan sesuai filter ini." />}
        </Card>
      ) : (
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 720 }}>
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
                  <td style={{ padding: "12px 14px", fontWeight: 700 }}>
                    {o.no_nota}
                    {Number(o.diskon_tambahan_nilai || 0) > 0 && (
                      <span style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#8A6A1A" }}>Pakai Poin: {rupiah(Number(o.diskon_tambahan_nilai))}</span>
                    )}
                  </td>
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
                      {["siap_dikirim", "proses_dikirim", "diretur", "selesai"].includes(o.status) && (
                        <button onClick={() => openPrint(o, "nota")} style={{ padding: "6px 10px", borderRadius: 7, border: "none", background: "#E8A426", color: "#24272B", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <Printer size={12} /> Nota
                        </button>
                      )}
                      {["siap_dikirim", "proses_dikirim", "diretur", "selesai"].includes(o.status) && (
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
        </div>
        {filtered.length === 0 && <EmptyState text="Tidak ada nota pada periode/filter ini." />}
      </Card>
      )}

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
  const [reviewingCod, setReviewingCod] = useState(null); // order id yang lagi direview
  const [infoKurirOrder, setInfoKurirOrder] = useState(null); // { nama_kurir, jenis_kurir } | null | "loading"
  const [returReviewList, setReturReviewList] = useState([]);
  const [refundMetodeTerpilih, setRefundMetodeTerpilih] = useState(null); // "saldo" | "manual" | null
  const [viewingRetur, setViewingRetur] = useState(null);
  const [processingReturId, setProcessingReturId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      // 3 kelompok order yang perlu tampil di sini:
      // 1. Transfer - masih menunggu_pembayaran (perlu konfirmasi bukti transfer)
      // 2. Transfer/COD - status_bayar sudah lunas (riwayat)
      // 3. COD - sudah dikonfirmasi kurir (status_bayar lunas, tapi status masih
      //    proses_dikirim) - perlu DIREVIEW Owner dulu sebelum benar-benar selesai
      // Ambil order yang relevan buat halaman ini:
      // 1. Transfer - masih menunggu_pembayaran (perlu konfirmasi bukti transfer)
      // 2. Sudah lunas (riwayat)
      // 3. COD/Transfer-Pekanbaru yang statusnya proses_dikirim - SEMUA,
      //    walau dokumennya BELUM lengkap - supaya Owner bisa lihat progres
      //    upload kapan saja, meski belum bisa selesaikan sampai lengkap.
      const rows = await supabaseFetch(token, "orders?select=id,no_nota,status,status_bayar,metode_bayar,tujuan_kota,dikonfirmasi_toko_at,bukti_transfer_url,bukti_pengiriman_url,bukti_serah_terima_kurir_url,bukti_barang_sampai_url,bukti_barang_sampai_perlu_review,bukti_barang_sampai_jarak_meter,bukti_nota_ttd_url,bukti_nota_cod_url,bukti_cash_cod_url,clients(nama,kode,jenis_pembayaran,kota),order_items(subtotal_setelah_diskon)&or=(status_bayar.eq.lunas,status.eq.proses_dikirim)&order=created_at.desc&limit=200");
      setOrders(rows);

      // Order retur yang SUDAH dikonfirmasi (ada bukti+alasan) di Proses
      // Pengiriman - tinggal direview Owner sebelum ditutup
      const returRows = await supabaseFetch(token, "orders?select=id,no_nota,alasan_retur,bukti_retur_url,tanggal_retur,status_bayar,metode_bayar,client_id,refund_metode,refund_diproses_at,clients(nama,kode),order_items(qty,subtotal_setelah_diskon,products(kode,nama,satuan))&status=eq.diretur&bukti_retur_url=not.is.null&order=tanggal_retur.desc");
      setReturReviewList(returRows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function bukaReview(orderId) {
    setReviewingCod(orderId);
    setInfoKurirOrder("loading");
    try {
      const itemRows = await supabaseFetch(token, `laporan_kurir_items?select=laporan_kurir(nama_kurir,jenis_kurir,jenis_laporan)&order_id=eq.${orderId}&order=created_at.desc&limit=1`);
      if (itemRows && itemRows.length > 0 && itemRows[0].laporan_kurir) {
        setInfoKurirOrder(itemRows[0].laporan_kurir);
      } else {
        setInfoKurirOrder(null);
      }
    } catch (e) {
      setInfoKurirOrder(null);
    }
  }

  async function bukaViewRetur(order) {
    setViewingRetur(order);
    setRefundMetodeTerpilih(order.refund_metode || null);
    setInfoKurirOrder("loading");
    try {
      const itemRows = await supabaseFetch(token, `laporan_kurir_items?select=laporan_kurir(nama_kurir,jenis_kurir,jenis_laporan)&order_id=eq.${order.id}&order=created_at.desc&limit=1`);
      if (itemRows && itemRows.length > 0 && itemRows[0].laporan_kurir) {
        setInfoKurirOrder(itemRows[0].laporan_kurir);
      } else {
        setInfoKurirOrder(null);
      }
    } catch (e) {
      setInfoKurirOrder(null);
    }
  }

  async function selesaikanRetur(orderId, refundMetode, totalRefund, clientId) {
    setProcessingReturId(orderId);
    try {
      if (refundMetode === "saldo") {
        await supabaseFetch(token, "saldo_ledger", {
          method: "POST",
          body: JSON.stringify({ client_id: clientId, jenis: "refund", jumlah: totalRefund, order_id: orderId, keterangan: "Refund otomatis dari retur pesanan" }),
        });
      }
      await supabaseFetch(token, `orders?id=eq.${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "selesai",
          ...(refundMetode ? { refund_metode: refundMetode, refund_diproses_at: new Date().toISOString() } : {}),
        }),
      });
      setReturReviewList((prev) => prev.filter((o) => o.id !== orderId));
      setViewingRetur(null);
    } catch (e) {
      alert("Gagal selesaikan retur: " + e.message);
    }
    setProcessingReturId(null);
  }

  // confirmPayment (konfirmasi bukti transfer manual) sudah DIPINDAH ke
  // menu Approve Pesanan (OrdersPage) - halaman ini sekarang cuma review
  // pengiriman.

  async function selesaikanPesananCod(orderId) {
    setProcessingId(orderId);
    try {
      await supabaseFetch(token, `orders?id=eq.${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "selesai" }),
      });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "selesai" } : o)));
      setReviewingCod(null);
    } catch (e) { alert("Gagal update: " + e.message); }
    setProcessingId(null);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  // Halaman ini sekarang CUMA review pengiriman - konfirmasi bukti transfer
  // manual sudah dipindah ke menu Approve Pesanan.
  // Bisa direview KAPAN SAJA: SEMUA order yang statusnya masih proses_dikirim
  // (belum selesai) - baik COD maupun Transfer, di kota manapun (Pekanbaru
  // atau luar kota) - baik dokumennya sudah lengkap maupun belum, supaya
  // Owner bisa pantau progres semua pesanan sebelum ditutup jadi Selesai.
  const perluReviewCod = orders.filter((o) => o.status === "proses_dikirim");
  const riwayat = orders.filter((o) => o.status_bayar === "lunas" && !perluReviewCod.includes(o));

  function renderCard(o) {
    const total = (o.order_items || []).reduce((sum, it) => sum + Number(it.subtotal_setelah_diskon || 0), 0);
    return (
      <Card key={o.id} style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{o.no_nota}</p>
            <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>{o.clients?.nama} ({o.clients?.kode}) · {o.clients?.jenis_pembayaran}</p>
            <p className="disp" style={{ fontSize: 16, fontWeight: 700, color: "#24272B", margin: "4px 0 0" }}>{rupiah(total)}</p>
          </div>
          <span style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 9, background: "#D8E9E6", color: "#28685D", fontSize: 12.5, fontWeight: 700 }}>
            <Check size={14} /> Pembayaran Diterima
          </span>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <PageHeader title="Review Pengiriman" subtitle={`${perluReviewCod.length} pesanan perlu direview`} onRefresh={load} refreshing={loading} />

      {returReviewList.length > 0 && (
        <>
          <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#C0392B", margin: "0 0 12px" }}>Review Retur ({returReviewList.length})</h2>
          {returReviewList.map((o) => (
            <Card key={o.id} style={{ marginBottom: 12, border: "1.5px solid #FBEAEA" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{o.no_nota}</p>
                  <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>{o.clients?.nama} ({o.clients?.kode})</p>
                  <p style={{ fontSize: 12, color: "#C0392B", margin: "4px 0 0" }}>{o.alasan_retur}</p>
                </div>
                <button
                  onClick={() => bukaViewRetur(o)}
                  style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
                >
                  Lihat Detail
                </button>
              </div>
            </Card>
          ))}
          <div style={{ height: 8 }} />
        </>
      )}

      {perluReviewCod.length > 0 && (
        <>
          <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "28px 0 12px" }}>Perlu Review Pengiriman</h2>
          {perluReviewCod.map((o) => {
            const total = (o.order_items || []).reduce((sum, it) => sum + Number(it.subtotal_setelah_diskon || 0), 0);
            const kotaTujuanAsli = o.tujuan_kota || o.clients?.kota;
            const isPekanbaru = !!(kotaTujuanAsli && kotaTujuanAsli.trim().toLowerCase().includes("pekanbaru"));
            const docsLengkap = o.metode_bayar === "cod"
              ? !!o.bukti_barang_sampai_url && !!o.bukti_nota_ttd_url && !!o.bukti_nota_cod_url && !!o.bukti_cash_cod_url
              : !!o.bukti_barang_sampai_url && !!o.bukti_nota_ttd_url;
            return (
              <Card key={o.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>
                      {o.no_nota}
                      {o.metode_bayar === "cod" ? (
                        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#FBF0D9", color: "#8A6A1A", verticalAlign: "middle" }}>COD</span>
                      ) : (
                        <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#D8E9E6", color: "#28685D", verticalAlign: "middle" }}>Transfer - {isPekanbaru ? "Pekanbaru" : "Luar Kota"}</span>
                      )}
                      {docsLengkap ? (
                        <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#D8E9E6", color: "#28685D", verticalAlign: "middle" }}>Dokumen Lengkap</span>
                      ) : (
                        <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#FBEAEA", color: "#C0392B", verticalAlign: "middle" }}>Dokumen Belum Lengkap</span>
                      )}
                      {o.dikonfirmasi_toko_at && (
                        <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#FBF0D9", color: "#8A6A1A", verticalAlign: "middle" }}>Sudah Dikonfirmasi Toko</span>
                      )}
                    </p>
                    <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>{o.clients?.nama} ({o.clients?.kode})</p>
                    <p className="disp" style={{ fontSize: 16, fontWeight: 700, color: "#24272B", margin: "4px 0 0" }}>{rupiah(total)}</p>
                  </div>
                  <button
                    onClick={() => bukaReview(o.id)}
                    style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: "#E8A426", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
                  >
                    Review Pesanan
                  </button>
                </div>
              </Card>
            );
          })}
        </>
      )}

      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "28px 0 12px" }}>Riwayat</h2>
      {riwayat.length === 0 ? (
        <EmptyState text="Belum ada riwayat pembayaran yang dikonfirmasi." />
      ) : (
        riwayat.map(renderCard)
      )}

      {/* MODAL REVIEW PESANAN - lihat nota + semua bukti sebelum selesaikan */}
      {reviewingCod && (() => {
        const o = orders.find((x) => x.id === reviewingCod);
        if (!o) return null;
        const total = (o.order_items || []).reduce((sum, it) => sum + Number(it.subtotal_setelah_diskon || 0), 0);
        const isCodOrder = o.metode_bayar === "cod";
        // Transfer (Pekanbaru maupun luar kota) cuma butuh 3 dokumen (bukti
        // pengiriman + barang sampai + nota TTD), tidak perlu bukti nota/cash
        // COD (itu memang khusus COD)
        const dokumen = isCodOrder
          ? [
              { label: "Bukti Pengemasan", url: o.bukti_pengiriman_url },
              { label: "Bukti Serah Terima Kurir", url: o.bukti_serah_terima_kurir_url },
              { label: "Bukti Barang Sampai", url: o.bukti_barang_sampai_url },
              { label: "Nota TTD Penerima", url: o.bukti_nota_ttd_url },
              { label: "Bukti Nota COD", url: o.bukti_nota_cod_url },
              { label: "Bukti Cash COD", url: o.bukti_cash_cod_url },
            ]
          : [
              { label: "Bukti Pengemasan", url: o.bukti_pengiriman_url },
              { label: "Bukti Serah Terima Kurir", url: o.bukti_serah_terima_kurir_url },
              { label: "Bukti Barang Sampai", url: o.bukti_barang_sampai_url },
              { label: "Nota TTD Penerima", url: o.bukti_nota_ttd_url },
            ];
        const docsLengkap = dokumen.every((d) => !!d.url);
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
            <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "88vh", overflowY: "auto", padding: 26 }}>
              <h2 className="disp" style={{ fontSize: 19, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>Review Pesanan {isCodOrder ? "COD" : "Transfer"}</h2>
              <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 4px" }}>{o.no_nota} · {o.clients?.nama} ({o.clients?.kode})</p>
              <p className="disp" style={{ fontSize: 20, fontWeight: 700, color: "#24272B", margin: "0 0 16px" }}>{rupiah(total)}</p>

              {o.dikonfirmasi_toko_at ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBF0D9", padding: "10px 12px", borderRadius: 10, marginBottom: 16 }}>
                  <Check size={15} color="#8A6A1A" />
                  <p style={{ fontSize: 12.5, color: "#8A6A1A", margin: 0, fontWeight: 600 }}>
                    Toko sudah konfirmasi penerimaan pada {new Date(o.dikonfirmasi_toko_at).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F7F5F1", padding: "10px 12px", borderRadius: 10, marginBottom: 16 }}>
                  <AlertCircle size={15} color="#9CA0A6" />
                  <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: 0 }}>Toko belum konfirmasi penerimaan barang.</p>
                </div>
              )}

              {infoKurirOrder === "loading" ? (
                <p style={{ fontSize: 12, color: "#9CA0A6", margin: "0 0 16px" }}>Memuat info kurir...</p>
              ) : infoKurirOrder ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F7F5F1", borderRadius: 9, padding: 10, marginBottom: 16 }}>
                  <Truck size={15} color="#8A6A1A" style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 12.5, color: "#24272B", margin: 0 }}>
                    Ditangani: <strong>{infoKurirOrder.nama_kurir}</strong> ({infoKurirOrder.jenis_kurir === "toko" ? "Kurir Toko" : "Kurir Baraka"})
                  </p>
                </div>
              ) : null}

              <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 10px" }}>Dokumen & Bukti</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                {dokumen.map((d) => (
                  <div key={d.label}>
                    <p style={{ fontSize: 10.5, color: "#9CA0A6", margin: "0 0 4px", fontWeight: 700 }}>{d.label}</p>
                    {d.url ? (
                      <a href={d.url} target="_blank" rel="noopener noreferrer">
                        <img src={d.url} alt={d.label} style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 8, border: "1px solid #EDEAE3" }} />
                      </a>
                    ) : (
                      <div style={{ width: "100%", height: 110, borderRadius: 8, background: "#FBEAEA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#C0392B", fontWeight: 600 }}>Belum diupload</div>
                    )}
                  </div>
                ))}
              </div>

              {o.bukti_barang_sampai_perlu_review && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#FBEAEA", borderRadius: 10, padding: 12, marginBottom: 16 }}>
                  <AlertCircle size={15} color="#C0392B" style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: "#C0392B", margin: 0, fontWeight: 600 }}>
                    Cek GPS Bukti Barang Sampai - titik ini {Math.round(o.bukti_barang_sampai_jarak_meter)}m dari pengiriman sebelumnya ke toko ini.
                  </p>
                </div>
              )}

              {!docsLengkap && (
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FBEAEA", borderRadius: 10, padding: 12, marginBottom: 16 }}>
                  <AlertCircle size={15} color="#C0392B" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 12, color: "#C0392B", margin: 0, fontWeight: 600, lineHeight: 1.5 }}>
                    Dokumen belum lengkap - pesanan belum bisa diselesaikan. Anda cuma bisa lihat progresnya dulu.
                  </p>
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setReviewingCod(null); setInfoKurirOrder(null); }} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
                  Tutup
                </button>
                <button
                  onClick={() => selesaikanPesananCod(o.id)}
                  disabled={processingId === o.id || !docsLengkap}
                  title={!docsLengkap ? "Dokumen belum lengkap" : ""}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: (processingId === o.id || !docsLengkap) ? "#E4E1DA" : "#28685D", color: (processingId === o.id || !docsLengkap) ? "#9CA0A6" : "#fff", fontWeight: 700, fontSize: 13.5 }}
                >
                  {processingId === o.id ? "Menyimpan..." : !docsLengkap ? "Dokumen Belum Lengkap" : "Selesaikan Pesanan"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL DETAIL RETUR - review bukti + alasan, lalu selesaikan */}
      {viewingRetur && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 460, maxHeight: "88vh", overflowY: "auto", padding: 26 }}>
            <h2 className="disp" style={{ fontSize: 19, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>Detail Retur</h2>
            <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 16px" }}>{viewingRetur.no_nota} - {viewingRetur.clients?.nama}</p>

            <div style={{ background: "#F7F5F1", borderRadius: 9, padding: 12, marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 8px" }}>Jumlah Pesanan</p>
              <p style={{ fontSize: 13, color: "#24272B", margin: "0 0 6px", fontWeight: 700 }}>
                {(viewingRetur.order_items || []).reduce((sum, it) => sum + Number(it.qty || 0), 0)} total unit/box
              </p>
              {(viewingRetur.order_items || []).map((it, i) => (
                <p key={i} style={{ fontSize: 12, color: "#6B6F75", margin: "2px 0" }}>
                  {it.products?.kode ? `${it.products.kode} - ` : ""}{it.products?.nama || "Barang"}: {it.qty} {it.products?.satuan || ""}
                </p>
              ))}
            </div>

            {infoKurirOrder === "loading" ? (
              <p style={{ fontSize: 12, color: "#9CA0A6", margin: "0 0 16px" }}>Memuat info kurir...</p>
            ) : infoKurirOrder ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F7F5F1", borderRadius: 9, padding: 10, marginBottom: 18 }}>
                <Truck size={15} color="#8A6A1A" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: 12.5, color: "#24272B", margin: 0 }}>
                  Diretur oleh: <strong>{infoKurirOrder.nama_kurir}</strong> ({infoKurirOrder.jenis_kurir === "toko" ? "Kurir Toko" : "Kurir Baraka"})
                </p>
              </div>
            ) : null}

            <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 8px" }}>Bukti Retur</p>
            <img src={viewingRetur.bukti_retur_url} alt="Bukti retur" style={{ width: "100%", borderRadius: 10, marginBottom: 18 }} />

            <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 8px" }}>Alasan Retur</p>
            <p style={{ fontSize: 13.5, color: "#24272B", margin: "0 0 22px", lineHeight: 1.5 }}>{viewingRetur.alasan_retur}</p>

            {(() => {
              const sudahDibayar = viewingRetur.status_bayar === "lunas";
              const totalRefund = (viewingRetur.order_items || []).reduce((sum, it) => sum + Number(it.subtotal_setelah_diskon || 0), 0);
              if (!sudahDibayar) return null;
              return (
                <div style={{ background: "#FBF0D9", borderRadius: 10, padding: 14, marginBottom: 22 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#8A6A1A", textTransform: "uppercase", margin: "0 0 4px" }}>Pesanan Ini Sudah Dibayar - Perlu Refund</p>
                  <p className="disp" style={{ fontSize: 20, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>{rupiah(totalRefund)}</p>
                  <p style={{ fontSize: 12, color: "#8A6A1A", margin: "0 0 10px" }}>Pilih cara pengembalian dana ke toko:</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => setRefundMetodeTerpilih("saldo")}
                      style={{ flex: 1, padding: 10, borderRadius: 9, border: refundMetodeTerpilih === "saldo" ? "1.5px solid #28685D" : "1.5px solid #E4E1DA", background: refundMetodeTerpilih === "saldo" ? "#D8E9E6" : "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
                    >
                      Refund ke Saldo Toko
                    </button>
                    <button
                      onClick={() => setRefundMetodeTerpilih("manual")}
                      style={{ flex: 1, padding: 10, borderRadius: 9, border: refundMetodeTerpilih === "manual" ? "1.5px solid #28685D" : "1.5px solid #E4E1DA", background: refundMetodeTerpilih === "manual" ? "#D8E9E6" : "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
                    >
                      Sudah Dikembalikan Manual (Tunai/Transfer)
                    </button>
                  </div>
                </div>
              );
            })()}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setViewingRetur(null); setInfoKurirOrder(null); setRefundMetodeTerpilih(null); }} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
                Tutup
              </button>
              <button
                onClick={() => {
                  const sudahDibayar = viewingRetur.status_bayar === "lunas";
                  const totalRefund = (viewingRetur.order_items || []).reduce((sum, it) => sum + Number(it.subtotal_setelah_diskon || 0), 0);
                  if (sudahDibayar && !refundMetodeTerpilih) {
                    alert("Pilih dulu cara pengembalian dana sebelum menyelesaikan retur ini.");
                    return;
                  }
                  selesaikanRetur(viewingRetur.id, sudahDibayar ? refundMetodeTerpilih : null, totalRefund, viewingRetur.client_id);
                }}
                disabled={processingReturId === viewingRetur.id}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "#28685D", color: "#fff", fontWeight: 700, fontSize: 13.5 }}
              >
                {processingReturId === viewingRetur.id ? "Menyimpan..." : "Selesaikan Retur"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PROSES PENGIRIMAN
// ============================================================
// ============================================================
// SIAP DIKIRIM - order menunggu_pengiriman, cetak barcode & mulai kirim
// ============================================================
function SiapDikirimPage({ token, role }) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [showBarcode, setShowBarcode] = useState(null); // order id
  const [markingPrinted, setMarkingPrinted] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [notaSettings, setNotaSettings] = useState(null);
  const [printingOrder, setPrintingOrder] = useState(null);
  const [printingType, setPrintingType] = useState("nota"); // "nota" | "surat_jalan"
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkPrint, setBulkPrint] = useState(null); // { orders, type } | null
  const [bulkBarcode, setBulkBarcode] = useState(null); // array order | null
  const [ukuranLabelBarcode, setUkuranLabelBarcode] = useState({ lebar: 100, tinggi: 150, modeFit: false });

  useEffect(() => {
    supabaseFetch(token, "nota_settings?select=lebar_label_barcode_mm,tinggi_label_barcode_mm,mode_fit_barcode&limit=1")
      .then((rows) => {
        if (rows[0]) setUkuranLabelBarcode({ lebar: rows[0].lebar_label_barcode_mm ?? 100, tinggi: rows[0].tinggi_label_barcode_mm ?? 150, modeFit: !!rows[0].mode_fit_barcode });
      })
      .catch(() => {}); // biarkan pakai default kalau gagal muat
  }, []);
  const [mencetakBarcode, setMencetakBarcode] = useState(false);
  const [errorCetakBarcode, setErrorCetakBarcode] = useState("");
  const [activeTab, setActiveTab] = useState("baru"); // tab pengemasan lama + tab baru siklus penuh
  const [filterCetakSiapKirim, setFilterCetakSiapKirim] = useState("semua"); // "semua" | "nota_belum" | "nota_sudah" | "sj_belum" | "sj_sudah"
  const [detailOrder, setDetailOrder] = useState(null); // order yang lagi dibuka "Lihat Detail"-nya (tahap siap_dikirim ke atas)
  const [showCetakOptions, setShowCetakOptions] = useState(false); // toggle slide-down opsi cetak massal

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.size === orders.length ? new Set() : new Set(orders.map((o) => o.id))));
  }

  function cetakMassal(jenisType, isUlang) {
    let dipilih = orders.filter((o) => selectedIds.has(o.id));
    if (jenisType === "nota" || jenisType === "surat_jalan") {
      // Nota & Surat Jalan cuma berlaku untuk pesanan yang statusnya
      // sudah "Siap Kirim" - selain itu dilewati diam-diam dari bulk ini.
      dipilih = dipilih.filter((o) => o.status === "siap_dikirim");
    }
    if (jenisType === "surat_jalan") {
      dipilih = dipilih.filter((o) => {
        const kotaTujuanAsli = o.tujuan_kota || o.clients?.kota;
        return !!(kotaTujuanAsli && kotaTujuanAsli.trim().toLowerCase().includes("pekanbaru"));
      });
    }

    const totalTerpilihAwal = dipilih.length;
    const kolom = jenisType === "nota" ? "nota_dicetak_at" : "surat_jalan_dicetak_at";
    if (!isUlang) {
      // Bukan cetak ulang - lewati diam-diam pesanan yang SUDAH pernah
      // dicetak, walau tetap kecentang.
      dipilih = dipilih.filter((o) => !o[kolom]);
    }

    if (dipilih.length === 0) {
      const namaDokumen = jenisType === "nota" ? "Nota" : "Surat Jalan";
      if (totalTerpilihAwal > 0 && !isUlang) {
        alert(`Semua pesanan terpilih sudah pernah dicetak ${namaDokumen}-nya. Pakai "Cetak Ulang ${namaDokumen}" kalau tetap mau cetak lagi.`);
      } else {
        alert(jenisType === "surat_jalan" ? "Tidak ada pesanan terpilih yang berstatus Siap Kirim & tujuannya Pekanbaru." : "Tidak ada pesanan terpilih yang berstatus Siap Kirim.");
      }
      return;
    }
    if (!isUlang && dipilih.length < totalTerpilihAwal) {
      const namaDokumen = jenisType === "nota" ? "Nota" : "Surat Jalan";
      alert(`${totalTerpilihAwal - dipilih.length} pesanan dilewati karena sudah pernah dicetak ${namaDokumen}-nya. Cuma ${dipilih.length} pesanan baru yang akan dicetak.`);
    }

    setBulkPrint({ orders: dipilih, type: jenisType });
    const now = new Date().toISOString();
    const ids = dipilih.map((o) => o.id);
    supabaseFetch(token, `orders?id=in.(${ids.join(",")})`, { method: "PATCH", body: JSON.stringify({ [kolom]: now }) }).catch(() => {});
    setOrders((prev) => prev.map((o) => (ids.includes(o.id) ? { ...o, [kolom]: now } : o)));
  }

  useEffect(() => {
    supabaseFetch(token, "nota_settings?select=*&limit=1")
      .then((rows) => setNotaSettings(rows[0] || null))
      .catch(() => {});
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, "orders?select=*,clients(nama,kode,alamat,telp,kota,jenis_pembayaran),order_items(*,products(kode,nama,satuan,nomor_produk,harga_jual))&status=in.(menunggu_pembayaran,menunggu_pengiriman,siap_dikirim,proses_dikirim,diretur,selesai)&order=created_at.asc");
      setOrders(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function uploadBuktiPengiriman(order, file) {
    setUploadingId(order.id);
    try {
      const compressed = await compressImage(file);
      const { ext, contentType } = infoFileTerkompresi(compressed, file);
      const filePath = `bukti_pengiriman_url-${order.id}-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/bukti-pengiriman/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": contentType },
        body: compressed,
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

  async function tandaiSudahDicetak(orderId) {
    setMarkingPrinted(true);
    try {
      const now = new Date().toISOString();
      await supabaseFetch(token, `orders?id=eq.${orderId}`, { method: "PATCH", body: JSON.stringify({ barcode_dicetak_at: now }) });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, barcode_dicetak_at: now } : o)));
    } catch (e) {
      alert("Gagal tandai sudah dicetak: " + e.message);
    }
    setMarkingPrinted(false);
  }

  // Aturan 1: order masuk SEBELUM jam 13:00 - wajib upload bukti pengiriman
  // di HARI YANG SAMA. Aturan 2: order masuk SETELAH jam 13:00 - wajib
  // upload bukti paling lambat jam 13:00 keesokan harinya. Kalau lewat dari
  // batas itu dan order INI MASIH ada di Siap Dikirim (artinya belum
  // di-outbound, walau bukti pengiriman sudah diupload sekalipun), tetap
  // dianggap terlambat pengemasannya.
  function cekTerlambatPengemasan(o) {
    const dibuat = new Date(o.created_at);
    const sekarang = new Date();

    if (dibuat.getHours() < 13) {
      // Aturan 1 - batas waktunya di hari yang sama (tengah malam)
      const sameDay = dibuat.getFullYear() === sekarang.getFullYear() && dibuat.getMonth() === sekarang.getMonth() && dibuat.getDate() === sekarang.getDate();
      return !sameDay;
    } else {
      // Aturan 2 - batas waktunya jam 13:00 keesokan harinya
      const batasWaktu = new Date(dibuat);
      batasWaktu.setDate(batasWaktu.getDate() + 1);
      batasWaktu.setHours(13, 0, 0, 0);
      return sekarang > batasWaktu;
    }
  }

  // Order sudah outbound (siap dikirim) tapi belum juga masuk Proses
  // Pengiriman - aturan jam 13:00 yang sama.
  function cekTerlambatDiambilKurir(o) {
    if (!o.outbound_verified_at) return false;
    const outbound = new Date(o.outbound_verified_at);
    const sekarang = new Date();
    if (outbound.getHours() < 13) {
      const sameDay = outbound.getFullYear() === sekarang.getFullYear() && outbound.getMonth() === sekarang.getMonth() && outbound.getDate() === sekarang.getDate();
      return !sameDay;
    } else {
      const batasWaktu = new Date(outbound);
      batasWaktu.setDate(batasWaktu.getDate() + 1);
      batasWaktu.setHours(23, 59, 59, 999);
      return sekarang > batasWaktu;
    }
  }

  // Order sudah "Proses Dikirim" tapi belum selesai - Pekanbaru harus
  // selesai hari yang sama, luar kota toleransi 3 hari.
  function cekTerlambatDikirimKurir(o) {
    if (!o.tanggal_dikirim) return false;
    const kotaTujuanAsli = o.tujuan_kota || o.clients?.kota;
    const isPekanbaru = !!(kotaTujuanAsli && kotaTujuanAsli.trim().toLowerCase().includes("pekanbaru"));
    const dikirim = new Date(o.tanggal_dikirim);
    const sekarang = new Date();
    if (isPekanbaru) {
      const sameDay = dikirim.getFullYear() === sekarang.getFullYear() && dikirim.getMonth() === sekarang.getMonth() && dikirim.getDate() === sekarang.getDate();
      return !sameDay;
    }
    const elapsedDays = (sekarang - dikirim) / (1000 * 60 * 60 * 24);
    return elapsedDays >= 3;
  }

  async function handleCetak(order) {
    setMencetakBarcode(true);
    setErrorCetakBarcode("");
    try {
      const lebarIn = ukuranLabelBarcode.lebar / 25.4;
      const tinggiIn = ukuranLabelBarcode.tinggi / 25.4;
      const entries = hitungEntriesLabelBarcode([order]);
      for (const entry of entries) {
        await cetakPdfOtomatis(<BarcodeLabelContent order={entry.order} noBox={entry.noBox} totalBox={entry.totalBox} item={entry.item} />, `${lebarIn}in ${tinggiIn}in`, "bawah", true); // selalu pakai Mode Fit - cegah konten meluber ke label fisik berikutnya
      }
      await tandaiSudahDicetak(order.id);
    } catch (e) {
      setErrorCetakBarcode("Gagal cetak otomatis: " + e.message + " - pastikan print server jalan. Coba tombol cetak manual sebagai cadangan, atau ulangi.");
    }
    setMencetakBarcode(false);
  }

  async function handleCetakMassalBarcode() {
    setMencetakBarcode(true);
    setErrorCetakBarcode("");
    try {
      const lebarIn = ukuranLabelBarcode.lebar / 25.4;
      const tinggiIn = ukuranLabelBarcode.tinggi / 25.4;
      const entries = hitungEntriesLabelBarcode(bulkBarcode);
      for (const entry of entries) {
        await cetakPdfOtomatis(<BarcodeLabelContent order={entry.order} noBox={entry.noBox} totalBox={entry.totalBox} item={entry.item} />, `${lebarIn}in ${tinggiIn}in`, "bawah", true); // selalu pakai Mode Fit - cegah konten meluber ke label fisik berikutnya
      }

      setMarkingPrinted(true);
      const now = new Date().toISOString();
      const ids = bulkBarcode.map((o) => o.id);
      await supabaseFetch(token, `orders?id=in.(${ids.join(",")})`, { method: "PATCH", body: JSON.stringify({ barcode_dicetak_at: now }) });
      setOrders((prev) => prev.map((o) => (ids.includes(o.id) ? { ...o, barcode_dicetak_at: now } : o)));
      setMarkingPrinted(false);
      setBulkBarcode(null);
    } catch (e) {
      setErrorCetakBarcode("Gagal cetak otomatis: " + e.message + " - pastikan print server jalan.");
    }
    setMencetakBarcode(false);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  // Order tahap PENGEMASAN (belum di-picking/outbound) - tab lama
  const orderPengemasanSemua = orders.filter((o) => o.status === "menunggu_pengiriman");
  const ordersUrut = [...orderPengemasanSemua].sort((a, b) => {
    const aTerlambat = cekTerlambatPengemasan(a);
    const bTerlambat = cekTerlambatPengemasan(b);
    if (aTerlambat === bTerlambat) return 0;
    return aTerlambat ? -1 : 1;
  });

  const orderBaru = ordersUrut.filter((o) => !cekTerlambatPengemasan(o));
  // orderTerlambat dihapus - sudah digabung ke tab "Proses Pengemasan"
  // (badge "Keterlambatan Pengemasan" tetap muncul di dalam kartu masing-masing)

  // Order tahap-tahap LAIN (siklus setelah pengemasan) - tab baru
  const orderSiapKirim = orders.filter((o) => o.status === "siap_dikirim");
  const orderProsesKirim = orders.filter((o) => o.status === "proses_dikirim");
  const orderTerlambatDiambil = orderSiapKirim.filter((o) => cekTerlambatDiambilKurir(o));
  const orderTerlambatDikirimKurir = orderProsesKirim.filter((o) => cekTerlambatDikirimKurir(o));
  const orderProsesRetur = orders.filter((o) => o.status === "diretur");
  const orderTerselesaikan = orders.filter((o) => o.status === "selesai");

  const tabLainMap = {
    proses_pengemasan: orderPengemasanSemua,
    siap_kirim: orderSiapKirim,
    proses_kirim: orderProsesKirim,
    // terlambat_diambil dihapus - sudah digabung ke tab "Siap Kirim" (badge muncul di dalam kartu)
    // terlambat_dikirim_kurir dihapus - sudah digabung ke tab "Proses Pengiriman" (badge muncul di dalam kartu)
    proses_retur: orderProsesRetur,
    terselesaikan: orderTerselesaikan,
  };
  const isTabLain = Object.keys(tabLainMap).includes(activeTab);
  const orderTampilRaw = isTabLain ? tabLainMap[activeTab] : (activeTab === "baru" ? orderBaru : ordersUrut);
  // Filter tambahan khusus tab "Siap Kirim" - berdasarkan status cetak Nota/Surat Jalan
  const orderTampil = activeTab === "siap_kirim"
    ? orderTampilRaw.filter((o) => {
        if (filterCetakSiapKirim === "nota_belum") return !o.nota_dicetak_at;
        if (filterCetakSiapKirim === "nota_sudah") return !!o.nota_dicetak_at;
        if (filterCetakSiapKirim === "sj_belum") return !o.surat_jalan_dicetak_at;
        if (filterCetakSiapKirim === "sj_sudah") return !!o.surat_jalan_dicetak_at;
        return true;
      })
    : orderTampilRaw;

  return (
    <div>
      <PageHeader title="Pesanan" subtitle={`${orders.length} pesanan siap diproses - cetak barcode untuk masing-masing`} showPingPrinter />

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          onClick={() => setActiveTab("semua")}
          style={{ padding: "9px 18px", borderRadius: 9, border: activeTab === "semua" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: activeTab === "semua" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}
        >
          Semua ({orderPengemasanSemua.length})
        </button>
        <button
          onClick={() => setActiveTab("baru")}
          style={{ padding: "9px 18px", borderRadius: 9, border: activeTab === "baru" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: activeTab === "baru" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}
        >
          Pesanan Baru ({orderBaru.length})
        </button>
        <button
          onClick={() => setActiveTab("proses_pengemasan")}
          style={{ padding: "9px 18px", borderRadius: 9, border: activeTab === "proses_pengemasan" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: activeTab === "proses_pengemasan" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}
        >
          Proses Pengemasan ({orderPengemasanSemua.length})
        </button>
        <button
          onClick={() => setActiveTab("siap_kirim")}
          style={{ padding: "9px 18px", borderRadius: 9, border: activeTab === "siap_kirim" ? "1.5px solid #28685D" : "1.5px solid #E4E1DA", background: activeTab === "siap_kirim" ? "#D8E9E6" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}
        >
          Siap Kirim ({orderSiapKirim.length})
        </button>
        <button
          onClick={() => setActiveTab("proses_kirim")}
          style={{ padding: "9px 18px", borderRadius: 9, border: activeTab === "proses_kirim" ? "1.5px solid #28685D" : "1.5px solid #E4E1DA", background: activeTab === "proses_kirim" ? "#D8E9E6" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}
        >
          Proses Pengiriman ({orderProsesKirim.length})
        </button>
        <button
          onClick={() => setActiveTab("proses_retur")}
          style={{ padding: "9px 18px", borderRadius: 9, border: activeTab === "proses_retur" ? "1.5px solid #8A6A1A" : "1.5px solid #E4E1DA", background: activeTab === "proses_retur" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}
        >
          Proses Retur ({orderProsesRetur.length})
        </button>
        <button
          onClick={() => setActiveTab("terselesaikan")}
          style={{ padding: "9px 18px", borderRadius: 9, border: activeTab === "terselesaikan" ? "1.5px solid #28685D" : "1.5px solid #E4E1DA", background: activeTab === "terselesaikan" ? "#D8E9E6" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}
        >
          Pesanan Terselesaikan ({orderTerselesaikan.length})
        </button>
      </div>

      {activeTab === "siap_kirim" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            { key: "semua", label: "Semua" },
            { key: "nota_belum", label: "Nota Belum Dicetak" },
            { key: "nota_sudah", label: "Nota Sudah Dicetak" },
            { key: "sj_belum", label: "Surat Jalan Belum Dicetak" },
            { key: "sj_sudah", label: "Surat Jalan Sudah Dicetak" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterCetakSiapKirim(f.key)}
              style={{ padding: "7px 14px", borderRadius: 8, border: filterCetakSiapKirim === f.key ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: filterCetakSiapKirim === f.key ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 12, fontWeight: 700 }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {(activeTab === "siap_kirim" || activeTab === "proses_pengemasan") && orderTampil.length > 0 && role !== "kurir" && role !== "staff_gudang" && (
        <Card style={{ marginBottom: 16, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#24272B", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={orderTampil.length > 0 && orderTampil.every((o) => selectedIds.has(o.id))}
                onChange={() => {
                  const semuaTerpilih = orderTampil.length > 0 && orderTampil.every((o) => selectedIds.has(o.id));
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    orderTampil.forEach((o) => (semuaTerpilih ? next.delete(o.id) : next.add(o.id)));
                    return next;
                  });
                }}
                style={{ width: 16, height: 16 }}
              />
              Pilih Semua ({selectedIds.size} terpilih)
            </label>
            <button
              onClick={() => setShowCetakOptions((prev) => !prev)}
              disabled={selectedIds.size === 0}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "1px solid #E4E1DA", background: selectedIds.size === 0 ? "#F7F5F1" : "#fff", color: selectedIds.size === 0 ? "#9CA0A6" : "#24272B", fontSize: 12.5, fontWeight: 700 }}
            >
              <Printer size={14} /> Mencetak {showCetakOptions ? <ChevronLeft size={14} style={{ transform: "rotate(-90deg)" }} /> : <ChevronRight size={14} style={{ transform: "rotate(90deg)" }} />}
            </button>
          </div>

          <div style={{ maxHeight: showCetakOptions ? 400 : 0, overflow: "hidden", transition: "max-height 0.25s ease" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12, paddingTop: 12, borderTop: "1px solid #EDEAE3" }}>
              {activeTab === "siap_kirim" && (
                <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => cetakMassal("nota", false)}
                  disabled={selectedIds.size === 0}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "1px solid #E4E1DA", background: selectedIds.size === 0 ? "#F7F5F1" : "#fff", color: selectedIds.size === 0 ? "#9CA0A6" : "#24272B", fontSize: 12.5, fontWeight: 700 }}
                >
                  <Receipt size={14} /> Cetak Nota Terpilih
                </button>
                <button
                  onClick={() => { if (confirm("Cetak ulang Nota untuk semua pesanan terpilih (termasuk yang sudah pernah dicetak)?")) cetakMassal("nota", true); }}
                  disabled={selectedIds.size === 0}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "1px solid #E4E1DA", background: selectedIds.size === 0 ? "#F7F5F1" : "#FBF0D9", color: selectedIds.size === 0 ? "#9CA0A6" : "#8A6A1A", fontSize: 12.5, fontWeight: 700 }}
                >
                  <RefreshCw size={14} /> Cetak Ulang Nota
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => cetakMassal("surat_jalan", false)}
                  disabled={selectedIds.size === 0}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "1px solid #E4E1DA", background: selectedIds.size === 0 ? "#F7F5F1" : "#fff", color: selectedIds.size === 0 ? "#9CA0A6" : "#24272B", fontSize: 12.5, fontWeight: 700 }}
                >
                  <FileEdit size={14} /> Cetak Surat Jalan Terpilih
                </button>
                <button
                  onClick={() => { if (confirm("Cetak ulang Surat Jalan untuk semua pesanan terpilih (termasuk yang sudah pernah dicetak)?")) cetakMassal("surat_jalan", true); }}
                  disabled={selectedIds.size === 0}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "1px solid #E4E1DA", background: selectedIds.size === 0 ? "#F7F5F1" : "#FBF0D9", color: selectedIds.size === 0 ? "#9CA0A6" : "#8A6A1A", fontSize: 12.5, fontWeight: 700 }}
                >
                  <RefreshCw size={14} /> Cetak Ulang Surat Jalan
                </button>
              </div>
                </>
              )}
              {activeTab === "proses_pengemasan" && role !== "staff_gudang" && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => {
                      const totalTerpilihAwal = orders.filter((o) => selectedIds.has(o.id)).length;
                      const dipilih = orders.filter((o) => selectedIds.has(o.id) && !o.barcode_dicetak_at);
                      if (dipilih.length === 0) {
                        alert(totalTerpilihAwal > 0 ? 'Semua pesanan terpilih sudah pernah dicetak Barcode-nya. Pakai "Cetak Ulang Barcode" kalau tetap mau cetak lagi.' : "Pilih dulu minimal 1 pesanan.");
                        return;
                      }
                      if (dipilih.length < totalTerpilihAwal) {
                        alert(`${totalTerpilihAwal - dipilih.length} pesanan dilewati karena sudah pernah dicetak Barcode-nya. Cuma ${dipilih.length} pesanan baru yang akan dicetak.`);
                      }
                      setBulkBarcode(dipilih);
                    }}
                    disabled={selectedIds.size === 0}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "1px solid #E4E1DA", background: selectedIds.size === 0 ? "#F7F5F1" : "#fff", color: selectedIds.size === 0 ? "#9CA0A6" : "#24272B", fontSize: 12.5, fontWeight: 700 }}
                  >
                    <Barcode size={14} /> Cetak Barcode Terpilih
                  </button>
                  <button
                    onClick={() => {
                      const dipilih = orders.filter((o) => selectedIds.has(o.id));
                      if (dipilih.length === 0) { alert("Pilih dulu minimal 1 pesanan."); return; }
                      if (!confirm("Cetak ulang Barcode untuk semua pesanan terpilih (termasuk yang sudah pernah dicetak)?")) return;
                      setBulkBarcode(dipilih);
                    }}
                    disabled={selectedIds.size === 0}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: "1px solid #E4E1DA", background: selectedIds.size === 0 ? "#F7F5F1" : "#FBF0D9", color: selectedIds.size === 0 ? "#9CA0A6" : "#8A6A1A", fontSize: 12.5, fontWeight: 700 }}
                  >
                    <RefreshCw size={14} /> Cetak Ulang Barcode
                  </button>
                </div>
              )}
            </div>
          </div>
          {activeTab === "siap_kirim" && (
            <p style={{ fontSize: 11, color: "#9CA0A6", margin: "8px 0 0" }}>
              Surat Jalan cuma akan tercetak untuk yang tujuannya Pekanbaru (yang di luar Pekanbaru otomatis dilewati).
            </p>
          )}
        </Card>
      )}

      {isTabLain ? (
        orderTampil.length === 0 ? (
          <EmptyState text="Tidak ada pesanan di kategori ini." />
        ) : (
          orderTampil.map((o) => {
            const isCod = o.metode_bayar === "cod";
            const terlambatDiambil = o.status === "siap_dikirim" && cekTerlambatDiambilKurir(o);
            const terlambatDikirimKurir = o.status === "proses_dikirim" && cekTerlambatDikirimKurir(o);
            const terlambatPengemasan = activeTab === "proses_pengemasan" && cekTerlambatPengemasan(o);
            const isRetur = o.status === "diretur" || !!o.alasan_retur;
            return (
              <Card key={o.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    {(activeTab === "siap_kirim" || activeTab === "proses_pengemasan") && role !== "kurir" && role !== "staff_gudang" && (
                      <input
                        type="checkbox" checked={selectedIds.has(o.id)} onChange={() => toggleSelect(o.id)}
                        style={{ width: 16, height: 16, marginTop: 4 }}
                      />
                    )}
                    <div>
                      <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>
                        {o.no_nota}
                        {isCod && (
                          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#FBF0D9", color: "#8A6A1A", verticalAlign: "middle" }}>COD</span>
                        )}
                        {terlambatDiambil && (
                          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#FBEAEA", color: "#C0392B", verticalAlign: "middle" }}>Terlambat Diambil Kurir</span>
                        )}
                        {terlambatDikirimKurir && (
                          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#FBEAEA", color: "#C0392B", verticalAlign: "middle" }}>Terlambat Dikirim Kurir</span>
                        )}
                        {isRetur && (
                          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#FBF0D9", color: "#8A6A1A", verticalAlign: "middle" }}>Retur</span>
                        )}
                      </p>
                      <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>{o.clients?.nama} ({o.clients?.kode})</p>
                      {terlambatPengemasan && (
                        <p style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#C0392B", fontWeight: 700, margin: "4px 0 0" }}>
                          <AlertCircle size={13} /> Keterlambatan Pengemasan
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setDetailOrder(o)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 9, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
                  >
                    <Eye size={15} /> Lihat Detail
                  </button>
                </div>
              </Card>
            );
          })
        )
      ) : null}


      {!isTabLain && (orderTampil.length === 0 ? (
        <EmptyState text="Tidak ada pesanan di kategori ini saat ini." />
      ) : (
        orderTampil.map((o) => {
          const isCod = o.metode_bayar === "cod";
          const sudahDicetak = !!o.barcode_dicetak_at;
          const hasProofKirim = !!o.bukti_pengiriman_url;
          const kotaTujuanAsli = o.tujuan_kota || o.clients?.kota;
          const isPekanbaru = !!(kotaTujuanAsli && kotaTujuanAsli.trim().toLowerCase().includes("pekanbaru"));
          const terlambatPengemasan = cekTerlambatPengemasan(o);
          return (
            <Card key={o.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div>
                  <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>
                    {o.no_nota}
                    {isCod && (
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#FBF0D9", color: "#8A6A1A", verticalAlign: "middle" }}>COD</span>
                    )}
                  </p>
                  <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>{o.clients?.nama} ({o.clients?.kode})</p>
                  {terlambatPengemasan && (
                    <p style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "#C0392B", fontWeight: 700, margin: "4px 0 0" }}>
                      <AlertCircle size={13} /> Keterlambatan Pengemasan
                    </p>
                  )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {role !== "kurir" && role !== "staff_gudang" && (
                    <button
                      onClick={() => setDetailOrder(o)}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 9, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
                    >
                      <Eye size={15} /> Lihat Detail
                    </button>
                  )}
                </div>
              </div>
            </Card>
          );
        })
      ))}

      {printingOrder && <NotaPrintModal order={printingOrder} type={printingType} settings={notaSettings} onClose={() => setPrintingOrder(null)} />}
      {bulkPrint && <BulkPrintModal orders={bulkPrint.orders} type={bulkPrint.type} settings={notaSettings} onClose={() => setBulkPrint(null)} />}
      {bulkBarcode && <BulkBarcodeModal orders={bulkBarcode} onClose={() => setBulkBarcode(null)} onSelesaiCetak={handleCetakMassalBarcode} mencetak={mencetakBarcode} error={errorCetakBarcode} ukuranLabel={ukuranLabelBarcode} />}

      {/* MODAL LIHAT DETAIL - untuk tab siap_kirim/proses_kirim/retur/selesai */}
      {detailOrder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", padding: 26 }}>
            <h2 className="disp" style={{ fontSize: 19, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>{detailOrder.no_nota}</h2>
            <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 20px" }}>
              {new Date(detailOrder.created_at).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>Toko</p>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: 0 }}>{detailOrder.clients?.nama} ({detailOrder.clients?.kode})</p>
              </div>
              <div>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>Metode Bayar</p>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: 0, textTransform: "capitalize" }}>{detailOrder.metode_bayar}</p>
              </div>
              <div>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>Tujuan</p>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: 0 }}>{detailOrder.tujuan_alamat || detailOrder.clients?.alamat}</p>
              </div>
              <div>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>Status</p>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: 0 }}>
                  {{
                    siap_dikirim: "Siap Dikirim",
                    proses_dikirim: "Proses Dikirim",
                    diretur: "Diretur",
                    selesai: "Selesai",
                  }[detailOrder.status] || detailOrder.status}
                </p>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 8px" }}>Barang Dipesan</p>
              {(detailOrder.order_items || []).map((it, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0", borderBottom: "1px solid #EDEAE3" }}>
                  <span style={{ color: "#24272B" }}>{it.products?.kode} - {it.products?.nama}</span>
                  <span style={{ fontWeight: 700, color: "#24272B" }}>{it.qty} {it.products?.satuan}</span>
                </div>
              ))}
            </div>

            {detailOrder.alasan_retur && (
              <div style={{ background: "#FBEAEA", borderRadius: 9, padding: 12, marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#C0392B", textTransform: "uppercase", margin: "0 0 4px" }}>Alasan Retur</p>
                <p style={{ fontSize: 12.5, color: "#C0392B", margin: 0 }}>{detailOrder.alasan_retur}</p>
              </div>
            )}

            <button onClick={() => setDetailOrder(null)} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* MODAL CETAK BARCODE - barcode no_nota + nama toko + rincian barang */}
      {showBarcode && (() => {
        const o = orders.find((x) => x.id === showBarcode);
        if (!o) return null;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
            <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 460, maxHeight: "85vh", overflowY: "auto", padding: 26 }}>
              <BarcodeLabelContent order={o} />

              <style>{`
                @media print {
                  @page { size: ${ukuranLabelBarcode.lebar}mm ${ukuranLabelBarcode.tinggi}mm; margin: 5mm; }
                  body * { visibility: hidden; }
                  .barcode-label-content, .barcode-label-content * { visibility: visible; }
                  .barcode-label-content { position: fixed; top: 30px; left: 0; right: 0; }
                }
              `}</style>

              {errorCetakBarcode && (
                <div className="no-print" style={{ marginTop: 10, padding: 12, borderRadius: 9, background: "#FBEAEA", color: "#C0392B", fontSize: 12, lineHeight: 1.5 }}>
                  {errorCetakBarcode}
                </div>
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button onClick={() => setShowBarcode(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
                  Tutup
                </button>
                <button
                  onClick={() => bukaTabPreviewBarcode([o], ukuranLabelBarcode)}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#24272B", fontWeight: 600, fontSize: 12 }}
                >
                  Cetak Manual
                </button>
                <button
                  onClick={() => handleCetak(o)}
                  disabled={markingPrinted || mencetakBarcode}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: (markingPrinted || mencetakBarcode) ? "#E4E1DA" : "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <Printer size={15} /> {mencetakBarcode ? "Mencetak..." : "Cetak Otomatis"}
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
// PROSES PENGIRIMAN - order proses_dikirim (kurir sudah bawa jalan)
// ============================================================
function ProsesPengirimanPage({ token, role }) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadingField, setUploadingField] = useState(null); // "barang_sampai" | "nota_ttd" | null
  const [uploadModalOrder, setUploadModalOrder] = useState(null); // order yang lagi dibuka modal upload buktinya
  const [showKonfirmasiCod, setShowKonfirmasiCod] = useState(null); // order id
  const [buktiNotaCod, setBuktiNotaCod] = useState(null);
  const [buktiCashCod, setBuktiCashCod] = useState(null);
  const [uploadingCod, setUploadingCod] = useState(null); // "nota" | "cash" | null
  const [confirmingCodId, setConfirmingCodId] = useState(null);
  const [loadingRuteId, setLoadingRuteId] = useState(null);
  const [clientIdsWithGps, setClientIdsWithGps] = useState(new Set());
  const [returOrders, setReturOrders] = useState([]);
  const [konfirmasiReturId, setKonfirmasiReturId] = useState(null);
  const [buktiRetur, setBuktiRetur] = useState(null);
  const [alasanRetur, setAlasanRetur] = useState("");
  const [uploadingBuktiRetur, setUploadingBuktiRetur] = useState(false);
  const [savingRetur, setSavingRetur] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, "orders?select=*,clients(nama,kode,alamat,kota),order_items(qty,products(kode,nama))&status=eq.proses_dikirim&order=created_at.asc");
      // Kurir cuma boleh lihat order tujuan Pekanbaru saja
      const rowsFiltered = role === "kurir"
        ? rows.filter((o) => {
            const kotaTujuanAsli = o.tujuan_kota || o.clients?.kota;
            return !!(kotaTujuanAsli && kotaTujuanAsli.trim().toLowerCase().includes("pekanbaru"));
          })
        : rows;
      setOrders(rowsFiltered);

      // Order yang statusnya "diretur" tapi belum ada bukti+alasan - perlu
      // dikonfirmasi kurir/admin di sini sebelum lanjut ke review Owner
      const returRows = await supabaseFetch(token, "orders?select=*,clients(nama,kode,alamat,kota)&status=eq.diretur&bukti_retur_url=is.null&order=tanggal_retur.asc");
      setReturOrders(role === "kurir"
        ? returRows.filter((o) => {
            const kotaTujuanAsli = o.tujuan_kota || o.clients?.kota;
            return !!(kotaTujuanAsli && kotaTujuanAsli.trim().toLowerCase().includes("pekanbaru"));
          })
        : returRows);

      // Cek toko mana saja yang PUNYA titik GPS tersimpan dari kunjungan
      // sales - dipakai buat nyala/matiin tombol Rute per order
      const clientIds = [...new Set(rowsFiltered.map((o) => o.client_id))];
      if (clientIds.length > 0) {
        const kunjunganRows = await supabaseFetch(
          token,
          `kunjungan_sales?select=client_id&client_id=in.(${clientIds.join(",")})&latitude=not.is.null`
        );
        setClientIdsWithGps(new Set(kunjunganRows.map((k) => k.client_id)));
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Buka rute dari lokasi HP kurir SAAT INI ke alamat toko tujuan, langsung
  // di Google Maps (bukan bikin navigasi sendiri - terlalu berat & berisiko
  // kalau dibuat dari nol). Titik tujuan pakai koordinat GPS dari kunjungan
  // sales terakhir kalau ada (lebih presisi), kalau belum pernah dikunjungi
  // pakai alamat teks toko saja (Google Maps yang cari sendiri).
  async function bukaRute(order) {
    setLoadingRuteId(order.id);
    try {
      // Cek dulu apakah toko ini pernah dikunjungi sales & punya koordinat GPS tersimpan
      const kunjungan = await supabaseFetch(
        token,
        `kunjungan_sales?select=latitude,longitude&client_id=eq.${order.client_id}&order=created_at.desc&limit=1`
      );

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const originLat = pos.coords.latitude;
          const originLng = pos.coords.longitude;
          let destinationParam;
          if (kunjungan && kunjungan.length > 0) {
            destinationParam = `${kunjungan[0].latitude},${kunjungan[0].longitude}`;
          } else {
            destinationParam = encodeURIComponent(order.clients?.alamat || order.tujuan_alamat || "");
          }
          const url = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destinationParam}&travelmode=driving`;
          window.open(url, "_blank");
          setLoadingRuteId(null);
        },
        (err) => {
          alert("Gagal ambil lokasi HP Anda: " + err.message + " (pastikan izinkan akses lokasi di browser)");
          setLoadingRuteId(null);
        }
      );
    } catch (e) {
      alert("Gagal siapkan rute: " + e.message);
      setLoadingRuteId(null);
    }
  }

  async function uploadFotoOrder(order, file, kolom, fieldKey) {
    setUploadingId(order.id);
    setUploadingField(fieldKey);
    try {
      const isBarangSampai = kolom === "bukti_barang_sampai_url";
      let fileUntukUpload = file;
      let coords = null;

      if (isBarangSampai) {
        // Ambil GPS + tempel watermark peta+koordinat, sama seperti Absen/
        // Laporan Kunjungan - supaya ada bukti lokasi asli saat barang
        // benar-benar sampai, dan bisa dideteksi kalau lokasinya janggal.
        coords = await ambilLokasiSekarang();
        const { blob } = await buatFotoDenganWatermark(file, coords, `Barang Sampai - ${order.clients?.nama || "-"} (${order.no_nota})`);
        fileUntukUpload = blob;
      }

      const compressed = isBarangSampai ? fileUntukUpload : await compressImage(file);
      const { ext, contentType } = isBarangSampai
        ? { ext: "webp", contentType: "image/webp" }
        : infoFileTerkompresi(compressed, file);
      const filePath = `${kolom}-${order.id}-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/bukti-pengiriman/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": contentType },
        body: compressed,
      });
      if (!res.ok) throw new Error(await res.text());
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/bukti-pengiriman/${filePath}`;
      const bodyPatch = isBarangSampai
        ? { [kolom]: publicUrl, bukti_barang_sampai_lat: coords.lat, bukti_barang_sampai_lng: coords.lng }
        : { [kolom]: publicUrl };
      await supabaseFetch(token, `orders?id=eq.${order.id}`, { method: "PATCH", body: JSON.stringify(bodyPatch) });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, ...bodyPatch } : o)));
      setUploadModalOrder((prev) => (prev && prev.id === order.id ? { ...prev, ...bodyPatch } : prev));
    } catch (e) {
      alert("Gagal upload: " + e.message);
    }
    setUploadingId(null);
    setUploadingField(null);
  }

  async function konfirmasiPembayaranCod(order) {
    if (!buktiNotaCod || !buktiCashCod) {
      alert("Upload dulu kedua bukti (Nota dan Cash) sebelum konfirmasi.");
      return;
    }
    setConfirmingCodId(order.id);
    try {
      // Cuma tandai LUNAS di sini - status order TETAP proses_dikirim,
      // supaya Owner masih bisa REVIEW dulu di menu Konfirmasi Pembayaran
      // (lihat nota + semua bukti) sebelum benar-benar diselesaikan.
      await supabaseFetch(token, `orders?id=eq.${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          bukti_nota_cod_url: buktiNotaCod, bukti_cash_cod_url: buktiCashCod,
          status_bayar: "lunas",
        }),
      });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, bukti_nota_cod_url: buktiNotaCod, bukti_cash_cod_url: buktiCashCod, status_bayar: "lunas" } : o)));
      setShowKonfirmasiCod(null);
      setBuktiNotaCod(null);
      setBuktiCashCod(null);
    } catch (e) {
      alert("Gagal konfirmasi: " + e.message);
    }
    setConfirmingCodId(null);
  }

  async function uploadFotoCod(order, file, jenis) {
    setUploadingCod(jenis);
    try {
      const compressed = await compressImage(file);
      const { ext, contentType } = infoFileTerkompresi(compressed, file);
      const filePath = `cod-${jenis}-${order.id}-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/bukti-pengiriman/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": contentType },
        body: compressed,
      });
      if (!res.ok) throw new Error(await res.text());
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/bukti-pengiriman/${filePath}`;
      if (jenis === "nota") setBuktiNotaCod(publicUrl);
      else setBuktiCashCod(publicUrl);
    } catch (e) {
      alert("Gagal upload: " + e.message);
    }
    setUploadingCod(null);
  }

  async function confirmTelahSampai(orderId) {
    setProcessingId(orderId);
    try {
      await supabaseFetch(token, `orders?id=eq.${orderId}`, { method: "PATCH", body: JSON.stringify({ status: "selesai" }) });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } catch (e) { alert("Gagal update: " + e.message); }
    setProcessingId(null);
  }

  async function uploadBuktiRetur(file) {
    setUploadingBuktiRetur(true);
    try {
      const compressed = await compressImage(file);
      const { ext, contentType } = infoFileTerkompresi(compressed, file);
      const filePath = `bukti-retur-${konfirmasiReturId}-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/produk-gambar/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": contentType },
        body: compressed,
      });
      if (!res.ok) throw new Error(await res.text());
      setBuktiRetur(`${SUPABASE_URL}/storage/v1/object/public/produk-gambar/${filePath}`);
    } catch (e) {
      alert("Gagal upload bukti: " + e.message);
    }
    setUploadingBuktiRetur(false);
  }

  async function submitKonfirmasiRetur() {
    if (!buktiRetur) {
      alert("Upload dulu bukti retur.");
      return;
    }
    if (!alasanRetur.trim()) {
      alert("Isi dulu alasan retur.");
      return;
    }
    setSavingRetur(true);
    try {
      await supabaseFetch(token, `orders?id=eq.${konfirmasiReturId}`, {
        method: "PATCH",
        body: JSON.stringify({ bukti_retur_url: buktiRetur, alasan_retur: alasanRetur.trim() }),
      });
      setReturOrders((prev) => prev.filter((o) => o.id !== konfirmasiReturId));
      setKonfirmasiReturId(null);
      setBuktiRetur(null);
      setAlasanRetur("");
    } catch (e) {
      alert("Gagal simpan konfirmasi retur: " + e.message);
    }
    setSavingRetur(false);
  }

  // Cek apakah order yang SEDANG "Proses Dikirim" ini sudah TERLAMBAT -
  // dalam kota (Pekanbaru) harus sampai/selesai di hari yang sama saat
  // discan kurir; luar kota dikasih toleransi minimal 3 hari.
  function cekTerlambatDikirimKurir(o) {
    if (!o.tanggal_dikirim) return false;
    const kotaTujuanAsli = o.tujuan_kota || o.clients?.kota;
    const isPekanbaru = !!(kotaTujuanAsli && kotaTujuanAsli.trim().toLowerCase().includes("pekanbaru"));
    const dikirim = new Date(o.tanggal_dikirim);
    const sekarang = new Date();
    if (isPekanbaru) {
      const sameDay = dikirim.getFullYear() === sekarang.getFullYear() && dikirim.getMonth() === sekarang.getMonth() && dikirim.getDate() === sekarang.getDate();
      return !sameDay;
    }
    const elapsedDays = (sekarang - dikirim) / (1000 * 60 * 60 * 24);
    return elapsedDays >= 3;
  }

  function daysSince(dateStr) {
    if (!dateStr) return 0;
    return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  }


  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  // Order yang statusnya "Menunggu Review Owner" (COD/Transfer-Pekanbaru
  // yang dokumennya sudah lengkap & lunas) otomatis diletakkan paling
  // bawah daftar, supaya yang masih perlu diproses tampil duluan di atas.
  function isMenungguReviewOwner(o) {
    const isCodOrder = o.metode_bayar === "cod";
    const kotaTujuanAsli = o.tujuan_kota || o.clients?.kota;
    const isPekanbaruOrder = !!(kotaTujuanAsli && kotaTujuanAsli.trim().toLowerCase().includes("pekanbaru"));
    const wajibUploadBuktiOrder = isCodOrder || (o.metode_bayar === "transfer" && isPekanbaruOrder);
    const docsLengkapOrder = !!o.bukti_barang_sampai_url && !!o.bukti_nota_ttd_url;
    return o.status === "proses_dikirim" && wajibUploadBuktiOrder && docsLengkapOrder && o.status_bayar === "lunas";
  }
  const ordersUrut = [...orders].sort((a, b) => {
    const aReview = isMenungguReviewOwner(a);
    const bReview = isMenungguReviewOwner(b);
    if (aReview === bReview) return 0;
    return aReview ? 1 : -1;
  });

  return (
    <div>
      <PageHeader title="Proses Pengiriman" subtitle={`${orders.length} pesanan dalam proses pengiriman`} onRefresh={load} refreshing={loading} />

      {returOrders.length > 0 && (
        <>
          <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#C0392B", margin: "0 0 12px" }}>Perlu Konfirmasi Retur ({returOrders.length})</h2>
          {returOrders.map((o) => (
            <Card key={o.id} style={{ marginBottom: 12, border: "1.5px solid #FBEAEA" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{o.no_nota}</p>
                  <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>{o.clients?.nama} ({o.clients?.kode})</p>
                </div>
                <button
                  onClick={() => { setKonfirmasiReturId(o.id); setBuktiRetur(null); setAlasanRetur(""); }}
                  style={{ padding: "10px 18px", borderRadius: 9, border: "none", background: "#C0392B", color: "#fff", fontSize: 12.5, fontWeight: 700 }}
                >
                  Konfirmasi Retur
                </button>
              </div>
            </Card>
          ))}
          <div style={{ height: 8 }} />
        </>
      )}

      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "12px 0 12px" }}>Dalam Pengiriman</h2>
      {orders.length === 0 ? (
        <EmptyState text="Tidak ada pesanan dalam proses pengiriman saat ini." />
      ) : (
        ordersUrut.map((o) => {
          const isDikirim = o.status === "proses_dikirim";
          const isCod = o.metode_bayar === "cod";
          const hasProofKirim = !!o.bukti_pengiriman_url;
          const elapsedDays = daysSince(o.tanggal_dikirim);
          const canConfirmArrived = elapsedDays >= 3;
          const hasBarangSampai = !!o.bukti_barang_sampai_url;
          const hasNotaTtd = !!o.bukti_nota_ttd_url;
          const codDocsLengkap = hasBarangSampai && hasNotaTtd;
          const kotaTujuanAsli = o.tujuan_kota || o.clients?.kota;
          const isPekanbaru = !!(kotaTujuanAsli && kotaTujuanAsli.trim().toLowerCase().includes("pekanbaru"));
          // Transfer yang tujuannya Pekanbaru WAJIB pakai alur upload bukti
          // yang sama seperti COD (barang sampai + nota TTD), lalu tetap
          // direview di menu Konfirmasi Pembayaran sebelum benar-benar
          // selesai - bedanya, Transfer TIDAK perlu langkah "Konfirmasi
          // Pembayaran COD" lagi (karena sudah lunas dari awal, sebelum
          // dikirim), begitu 2 dokumen lengkap langsung "Menunggu Review Owner".
          const wajibUploadBukti = isCod || (o.metode_bayar === "transfer" && isPekanbaru);
          // Staff Gudang cuma bisa LIHAT (tidak upload apapun) untuk order
          // tujuan Pekanbaru - itu tugas Kurir. Untuk luar kota, Staff
          // Gudang tetap boleh upload (karena biasanya mereka yang serahkan
          // ke ekspedisi/cargo, bukan kurir internal).
          const bolehUpload = !(role === "staff_gudang" && isPekanbaru);
          return (
            <Card key={o.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>
                    {o.no_nota}
                    {isCod && (
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#FBF0D9", color: "#8A6A1A", verticalAlign: "middle" }}>COD</span>
                    )}
                    {cekTerlambatDikirimKurir(o) && (
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#FBEAEA", color: "#C0392B", verticalAlign: "middle" }}>Terlambat Dikirim Kurir</span>
                    )}
                  </p>
                  <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>{o.clients?.nama} ({o.clients?.kode})</p>
                  {isDikirim && (
                    <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "4px 0 0" }}>
                      Dikirim {Math.floor(elapsedDays)} hari lalu
                      {!wajibUploadBukti && !canConfirmArrived && ` - tunggu ${Math.ceil(3 - elapsedDays)} hari lagi untuk konfirmasi sampai`}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {isPekanbaru && (
                    <button
                      onClick={() => bukaRute(o)}
                      disabled={loadingRuteId === o.id || !clientIdsWithGps.has(o.client_id)}
                      title={!clientIdsWithGps.has(o.client_id) ? "Belum ada titik GPS dari kunjungan sales untuk toko ini" : ""}
                      style={{
                        display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 9,
                        border: clientIdsWithGps.has(o.client_id) ? "1px solid #E4E1DA" : "1px solid #EDEAE3",
                        background: clientIdsWithGps.has(o.client_id) ? "#fff" : "#F7F5F1",
                        color: clientIdsWithGps.has(o.client_id) ? "#24272B" : "#B5B2AA",
                        fontSize: 12, fontWeight: 700,
                      }}
                    >
                      <Navigation size={14} /> {loadingRuteId === o.id ? "Mencari lokasi..." : "Rute"}
                    </button>
                  )}
                  <span style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 9, background: "#D8E9E6", color: "#28685D", fontSize: 12.5, fontWeight: 700 }}>
                    <Truck size={14} /> Proses Dikirim
                  </span>

                  {wajibUploadBukti ? (
                    <>
                      {(!hasBarangSampai || !hasNotaTtd) && bolehUpload && (
                        <button
                          onClick={() => setUploadModalOrder(o)}
                          style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 9, border: "1.5px dashed #E8A426", background: "#FFFBF0", color: "#8A6A1A", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                        >
                          <UploadCloud size={13} /> Upload Bukti Pengiriman
                        </button>
                      )}
                      {(!hasBarangSampai || !hasNotaTtd) && !bolehUpload && (
                        <span style={{ fontSize: 11.5, color: "#9CA0A6", fontStyle: "italic" }}>Menunggu upload dari Kurir</span>
                      )}
                      {hasBarangSampai && bolehUpload && (
                        <a href={o.bukti_barang_sampai_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: "#28685D", fontWeight: 700, textDecoration: "underline" }}>
                          Lihat Bukti Sampai
                        </a>
                      )}
                      {hasNotaTtd && bolehUpload && (
                        <a href={o.bukti_nota_ttd_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: "#28685D", fontWeight: 700, textDecoration: "underline" }}>
                          Lihat Nota TTD
                        </a>
                      )}
                      {hasBarangSampai && hasNotaTtd && !bolehUpload && (
                        <span style={{ fontSize: 11.5, color: "#28685D", fontWeight: 700 }}>Dokumen sudah lengkap (oleh Kurir)</span>
                      )}
                      {codDocsLengkap && (
                        o.status_bayar === "lunas" ? (
                          <span style={{ padding: "8px 14px", borderRadius: 9, background: "#D8E9E6", color: "#28685D", fontSize: 12.5, fontWeight: 700 }}>
                            Menunggu Review Owner
                          </span>
                        ) : bolehUpload ? (
                          <button
                            onClick={() => setShowKonfirmasiCod(o.id)}
                            style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: "#E8A426", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
                          >
                            Konfirmasi Pembayaran COD
                          </button>
                        ) : (
                          <span style={{ fontSize: 11.5, color: "#9CA0A6", fontStyle: "italic" }}>Menunggu konfirmasi dari Kurir</span>
                        )
                      )}
                    </>
                  ) : (
                    <button
                      disabled={processingId === o.id || !canConfirmArrived}
                      onClick={() => confirmTelahSampai(o.id)}
                      style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: canConfirmArrived ? "#E8A426" : "#E4E1DA", color: canConfirmArrived ? "#24272B" : "#9CA0A6", fontSize: 12.5, fontWeight: 700 }}
                    >
                      Telah Sampai
                    </button>
                  )}
                </div>
              </div>
            </Card>
          );
        })
      )}

      {/* MODAL KONFIRMASI PEMBAYARAN COD */}
      {showKonfirmasiCod && (() => {
        const order = orders.find((o) => o.id === showKonfirmasiCod);
        if (!order) return null;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
            <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, padding: 26 }}>
              <h2 className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>Konfirmasi Pembayaran COD</h2>
              <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 20px" }}>{order.no_nota} · {order.clients?.nama}</p>

              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 8px" }}>Bukti Nota</p>
                <label style={{ display: "block", width: "100%", height: 120, borderRadius: 10, border: buktiNotaCod ? "none" : "1.5px dashed #E8A426", background: buktiNotaCod ? `url(${buktiNotaCod}) center/cover` : "#FFFBF0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  {!buktiNotaCod && (uploadingCod === "nota" ? <span style={{ fontSize: 12, color: "#8A6A1A" }}>Mengupload...</span> : <span style={{ fontSize: 12, color: "#8A6A1A", fontWeight: 700 }}>Tap untuk upload foto nota</span>)}
                  <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={!!uploadingCod} onChange={(e) => { if (e.target.files[0]) uploadFotoCod(order, e.target.files[0], "nota"); }} />
                </label>
              </div>

              <div style={{ marginBottom: 22 }}>
                <p style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 8px" }}>Bukti Cash</p>
                <label style={{ display: "block", width: "100%", height: 120, borderRadius: 10, border: buktiCashCod ? "none" : "1.5px dashed #E8A426", background: buktiCashCod ? `url(${buktiCashCod}) center/cover` : "#FFFBF0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  {!buktiCashCod && (uploadingCod === "cash" ? <span style={{ fontSize: 12, color: "#8A6A1A" }}>Mengupload...</span> : <span style={{ fontSize: 12, color: "#8A6A1A", fontWeight: 700 }}>Tap untuk upload foto uang cash</span>)}
                  <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={!!uploadingCod} onChange={(e) => { if (e.target.files[0]) uploadFotoCod(order, e.target.files[0], "cash"); }} />
                </label>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => { setShowKonfirmasiCod(null); setBuktiNotaCod(null); setBuktiCashCod(null); }}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}
                >
                  Batal
                </button>
                <button
                  onClick={() => konfirmasiPembayaranCod(order)}
                  disabled={confirmingCodId === order.id || !buktiNotaCod || !buktiCashCod}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: (buktiNotaCod && buktiCashCod) ? "#E8A426" : "#E4E1DA", color: (buktiNotaCod && buktiCashCod) ? "#24272B" : "#9CA0A6", fontWeight: 700, fontSize: 13.5 }}
                >
                  {confirmingCodId === order.id ? "Menyimpan..." : "Konfirmasi"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL UPLOAD BUKTI PENGIRIMAN - gabungan Bukti Barang Sampai + Nota TTD */}
      {uploadModalOrder && (() => {
        const o = uploadModalOrder;
        const sudahBarangSampai = !!o.bukti_barang_sampai_url;
        const sudahNotaTtd = !!o.bukti_nota_ttd_url;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
            <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 400, padding: 26 }}>
              <h2 className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>Upload Bukti Pengiriman</h2>
              <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 20px" }}>{o.no_nota}</p>

              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 8px" }}>Bukti Barang Sampai</p>
                {sudahBarangSampai ? (
                  <a href={o.bukti_barang_sampai_url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#28685D", fontWeight: 700, textDecoration: "underline" }}>
                    <Check size={14} /> Sudah diupload - Lihat
                  </a>
                ) : (
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 9, border: "1.5px dashed #E8A426", background: "#FFFBF0", color: "#8A6A1A", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                    {uploadingId === o.id && uploadingField === "barang_sampai" ? "Mengupload..." : <><UploadCloud size={15} /> Upload Foto</>}
                    <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={uploadingId === o.id} onChange={(e) => { if (e.target.files[0]) uploadFotoOrder(o, e.target.files[0], "bukti_barang_sampai_url", "barang_sampai"); }} />
                  </label>
                )}
              </div>

              <div style={{ marginBottom: 22 }}>
                <p style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 8px" }}>Nota TTD Penerima</p>
                {sudahNotaTtd ? (
                  <a href={o.bukti_nota_ttd_url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#28685D", fontWeight: 700, textDecoration: "underline" }}>
                    <Check size={14} /> Sudah diupload - Lihat
                  </a>
                ) : (
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 9, border: "1.5px dashed #E8A426", background: "#FFFBF0", color: "#8A6A1A", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                    {uploadingId === o.id && uploadingField === "nota_ttd" ? "Mengupload..." : <><UploadCloud size={15} /> Upload Foto</>}
                    <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={uploadingId === o.id} onChange={(e) => { if (e.target.files[0]) uploadFotoOrder(o, e.target.files[0], "bukti_nota_ttd_url", "nota_ttd"); }} />
                  </label>
                )}
              </div>

              <button onClick={() => setUploadModalOrder(null)} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
                Tutup
              </button>
            </div>
          </div>
        );
      })()}
      {konfirmasiReturId && (() => {
        const o = returOrders.find((x) => x.id === konfirmasiReturId);
        if (!o) return null;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
            <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, maxHeight: "88vh", overflowY: "auto", padding: 26 }}>
              <h2 className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>Konfirmasi Retur</h2>
              <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 20px" }}>{o.no_nota} - {o.clients?.nama}</p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Bukti Retur (Foto)</label>
                {buktiRetur ? (
                  <img src={buktiRetur} alt="Bukti retur" style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 9 }} />
                ) : (
                  <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 20, borderRadius: 9, border: "1.5px dashed #E8A426", background: "#FFFBF0", color: "#8A6A1A", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                    {uploadingBuktiRetur ? "Mengupload..." : <><UploadCloud size={16} /> Tap untuk upload foto</>}
                    <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={uploadingBuktiRetur} onChange={(e) => { if (e.target.files[0]) uploadBuktiRetur(e.target.files[0]); }} />
                  </label>
                )}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Alasan Retur</label>
                <textarea
                  value={alasanRetur} onChange={(e) => setAlasanRetur(e.target.value)}
                  placeholder="Contoh: toko tutup, barang tidak sesuai pesanan, dll..."
                  rows={3}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setKonfirmasiReturId(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
                  Batal
                </button>
                <button
                  onClick={submitKonfirmasiRetur}
                  disabled={savingRetur || !buktiRetur || !alasanRetur.trim()}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: (savingRetur || !buktiRetur || !alasanRetur.trim()) ? "#E4E1DA" : "#C0392B", color: (savingRetur || !buktiRetur || !alasanRetur.trim()) ? "#9CA0A6" : "#fff", fontWeight: 700, fontSize: 13.5 }}
                >
                  {savingRetur ? "Menyimpan..." : "Konfirmasi"}
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
  const [riwayatCashback, setRiwayatCashback] = useState([]);
  const [editingTanggalId, setEditingTanggalId] = useState(null);
  const [editTanggalMap, setEditTanggalMap] = useState({}); // { ruleId: { mulai, selesai } }
  const [savingTanggalId, setSavingTanggalId] = useState(null);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    jenisRule: "nominal_bulanan",
    minimalOmzetBulan: "", productId: "", minimalQty: "",
    jenisCashback: "persen", nilaiCashback: "", tanggalMulai: "", tanggalSelesai: "",
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
      const [ruleRows, productRows, riwayatRows] = await Promise.all([
        supabaseFetch(token, "cashback_rules?select=*,products(kode,nama,satuan)&order=created_at.desc"),
        supabaseFetch(token, "products?select=id,kode,nama,satuan,isi_per_koli,diskon_koli_pct&aktif=eq.true&order=kode.asc"),
        supabaseFetch(token, "cashback_ledger?select=*,orders(no_nota),clients(nama,alamat)&order=created_at.desc&limit=200"),
      ]);
      setRules(ruleRows);
      setProducts(productRows);
      setRiwayatCashback(riwayatRows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function resetForm() {
    setForm({ jenisRule: "nominal_bulanan", minimalOmzetBulan: "", productId: "", minimalQty: "", jenisCashback: "persen", nilaiCashback: "", tanggalMulai: "", tanggalSelesai: "" });
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
          tanggal_mulai: form.tanggalMulai || null,
          tanggal_selesai: form.tanggalSelesai || null,
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

  async function simpanTanggalRule(ruleId) {
    const edit = editTanggalMap[ruleId];
    if (!edit) return;
    setSavingTanggalId(ruleId);
    try {
      await supabaseFetch(token, `cashback_rules?id=eq.${ruleId}`, {
        method: "PATCH",
        body: JSON.stringify({ tanggal_mulai: edit.mulai || null, tanggal_selesai: edit.selesai || null }),
      });
      setRules((prev) => prev.map((r) => (r.id === ruleId ? { ...r, tanggal_mulai: edit.mulai || null, tanggal_selesai: edit.selesai || null } : r)));
      setEditingTanggalId(null);
    } catch (e) {
      alert("Gagal simpan tanggal: " + e.message);
    }
    setSavingTanggalId(null);
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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Berlaku Mulai (opsional)</label>
            <input type="date" value={form.tanggalMulai} onChange={(e) => setForm({ ...form, tanggalMulai: e.target.value })} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Berlaku Sampai (opsional)</label>
            <input type="date" value={form.tanggalSelesai} onChange={(e) => setForm({ ...form, tanggalSelesai: e.target.value })} style={fieldStyle} />
          </div>
        </div>
        <p style={{ fontSize: 11, color: "#9CA0A6", margin: "-10px 0 16px" }}>Kosongkan kalau aturan ini berlaku tanpa batas waktu.</p>

        <button onClick={submitRule} disabled={saving} style={{ padding: "11px 22px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", gap: 6 }}>
          <Gift size={16} /> {saving ? "Menyimpan..." : "Tambah Aturan"}
        </button>
      </Card>

      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>Daftar Aturan</h2>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Jenis", "Syarat", "Cashback", "Masa Berlaku", "Status", ""].map((h) => (
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
                <td style={{ padding: "12px 14px", fontSize: 11.5, color: "#6B6F75" }}>
                  {editingTanggalId === r.id ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 150 }}>
                      <input
                        type="date"
                        value={editTanggalMap[r.id]?.mulai ?? (r.tanggal_mulai || "")}
                        onChange={(e) => setEditTanggalMap((prev) => ({ ...prev, [r.id]: { ...prev[r.id], mulai: e.target.value } }))}
                        style={{ padding: "5px 7px", borderRadius: 6, border: "1.5px solid #E4E1DA", fontSize: 11.5 }}
                      />
                      <input
                        type="date"
                        value={editTanggalMap[r.id]?.selesai ?? (r.tanggal_selesai || "")}
                        onChange={(e) => setEditTanggalMap((prev) => ({ ...prev, [r.id]: { ...prev[r.id], selesai: e.target.value } }))}
                        style={{ padding: "5px 7px", borderRadius: 6, border: "1.5px solid #E4E1DA", fontSize: 11.5 }}
                      />
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => simpanTanggalRule(r.id)}
                          disabled={savingTanggalId === r.id}
                          style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: "none", background: "#E8A426", color: "#24272B", fontSize: 11, fontWeight: 700 }}
                        >
                          {savingTanggalId === r.id ? "..." : "Simpan"}
                        </button>
                        <button onClick={() => setEditingTanggalId(null)} style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: "1px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontSize: 11, fontWeight: 600 }}>
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {r.tanggal_mulai || r.tanggal_selesai
                        ? `${r.tanggal_mulai ? new Date(r.tanggal_mulai + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "..."} - ${r.tanggal_selesai ? new Date(r.tanggal_selesai + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "..."}`
                        : "Tanpa batas waktu"}
                      {" "}
                      <button
                        onClick={() => { setEditingTanggalId(r.id); setEditTanggalMap((prev) => ({ ...prev, [r.id]: { mulai: r.tanggal_mulai || "", selesai: r.tanggal_selesai || "" } })); }}
                        style={{ background: "none", border: "none", color: "#8A6A1A", fontSize: 11, fontWeight: 700, padding: 0, textDecoration: "underline" }}
                      >
                        Edit
                      </button>
                    </>
                  )}
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

      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "28px 0 12px" }}>Riwayat Cashback</h2>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["No. Pesanan", "Toko", "Alamat", "Cashback", "Status", "Tanggal"].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {riwayatCashback.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                <td style={{ padding: "12px 14px", fontWeight: 700 }}>{r.orders?.no_nota || "-"}</td>
                <td style={{ padding: "12px 14px" }}>{r.clients?.nama || "-"}</td>
                <td style={{ padding: "12px 14px", color: "#6B6F75", fontSize: 12 }}>{r.clients?.alamat || "-"}</td>
                <td style={{ padding: "12px 14px", fontWeight: 700, color: "#28685D" }}>{rupiah(r.nilai_cashback)}</td>
                <td style={{ padding: "12px 14px" }}>
                  <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: r.status === "sudah_dibayar" ? "#D8E9E6" : "#FBF0D9", color: r.status === "sudah_dibayar" ? "#28685D" : "#8A6A1A" }}>
                    {r.status === "sudah_dibayar" ? "Sudah Dibayar" : "Menunggu"}
                  </span>
                </td>
                <td style={{ padding: "12px 14px", color: "#9CA0A6", fontSize: 11.5 }}>
                  {new Date(r.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {riwayatCashback.length === 0 && <EmptyState text="Belum ada riwayat cashback." />}
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
// ============================================================
// MODAL HARGA PER PROVINSI - Owner atur harga khusus 1 produk buat
// tiap provinsi (karena beda ongkir). Provinsi yang belum diatur di
// sini otomatis pakai harga default produk.
// ============================================================
function HargaProvinsiModal({ token, product, onClose }) {
  const [loading, setLoading] = useState(true);
  const [daftarHarga, setDaftarHarga] = useState([]); // [{id, provinsi, harga}]
  const [provinsiBaru, setProvinsiBaru] = useState("");
  const [hargaBaru, setHargaBaru] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const rows = await supabaseFetch(token, `harga_produk_provinsi?select=id,provinsi,harga&product_id=eq.${product.id}&order=provinsi.asc`);
      setDaftarHarga(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function tambahHarga() {
    if (!provinsiBaru.trim() || !hargaBaru) {
      setError("Isi dulu nama provinsi dan harganya.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await supabaseFetch(token, `harga_produk_provinsi?on_conflict=product_id,provinsi`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ product_id: product.id, provinsi: provinsiBaru.trim(), harga: Number(hargaBaru) }),
      });
      setProvinsiBaru("");
      setHargaBaru("");
      await load();
    } catch (e) {
      setError("Gagal simpan: " + e.message);
    }
    setSaving(false);
  }

  async function updateHarga(id, hargaBaruNilai) {
    try {
      await supabaseFetch(token, `harga_produk_provinsi?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ harga: Number(hargaBaruNilai), updated_at: new Date().toISOString() }) });
      setDaftarHarga((prev) => prev.map((h) => (h.id === id ? { ...h, harga: Number(hargaBaruNilai) } : h)));
    } catch (e) {
      alert("Gagal update harga: " + e.message);
    }
  }

  async function hapusHarga(id) {
    if (!confirm("Hapus harga khusus provinsi ini? Provinsi ini akan kembali pakai harga default produk.")) return;
    try {
      await supabaseFetch(token, `harga_produk_provinsi?id=eq.${id}`, { method: "DELETE" });
      setDaftarHarga((prev) => prev.filter((h) => h.id !== id));
    } catch (e) {
      alert("Gagal hapus: " + e.message);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", padding: 26 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>Harga per Provinsi</p>
        <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "0 0 4px" }}>{product.nama}</p>
        <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 18px" }}>
          Harga default (dasar): <strong>{rupiah(product.harga_jual)}</strong> - dipakai untuk provinsi yang belum diatur khusus di bawah.
        </p>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBEAEA", color: "#C0392B", padding: 10, borderRadius: 9, fontSize: 12.5, marginBottom: 14 }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ textAlign: "center", color: "#9CA0A6", fontSize: 13, padding: "20px 0" }}>Memuat...</p>
        ) : daftarHarga.length === 0 ? (
          <p style={{ textAlign: "center", color: "#9CA0A6", fontSize: 12.5, padding: "16px 0" }}>Belum ada harga khusus provinsi - semua pakai harga default.</p>
        ) : (
          daftarHarga.map((h) => (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "8px 10px", background: "#F7F5F1", borderRadius: 9 }}>
              <p style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#24272B", margin: 0 }}>{h.provinsi}</p>
              <input
                type="number" defaultValue={h.harga}
                onBlur={(e) => { if (Number(e.target.value) !== h.harga) updateHarga(h.id, e.target.value); }}
                style={{ width: 120, padding: "6px 8px", borderRadius: 7, border: "1.5px solid #E4E1DA", fontSize: 12.5 }}
              />
              <button onClick={() => hapusHarga(h.id)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #F0CFC7", background: "#fff", color: "#C0392B", fontSize: 11.5, fontWeight: 600 }}>
                Hapus
              </button>
            </div>
          ))
        )}

        <div style={{ borderTop: "1px solid #EDEAE3", marginTop: 14, paddingTop: 14 }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 8px" }}>Tambah Harga Provinsi Baru</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={provinsiBaru} onChange={(e) => setProvinsiBaru(e.target.value)}
              placeholder="Nama provinsi (misal: Riau)"
              style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: "1.5px solid #E4E1DA", fontSize: 12.5 }}
            />
            <input
              type="number" value={hargaBaru} onChange={(e) => setHargaBaru(e.target.value)}
              placeholder="Harga"
              style={{ width: 120, padding: "9px 10px", borderRadius: 8, border: "1.5px solid #E4E1DA", fontSize: 12.5 }}
            />
          </div>
          <button
            onClick={tambahHarga} disabled={saving}
            style={{ width: "100%", marginTop: 10, padding: 11, borderRadius: 9, border: "none", background: "#24272B", color: "#fff", fontWeight: 700, fontSize: 13 }}
          >
            {saving ? "Menyimpan..." : "+ Tambah"}
          </button>
        </div>

        <button onClick={onClose} style={{ width: "100%", marginTop: 16, padding: 11, borderRadius: 9, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13 }}>
          Tutup
        </button>
      </div>
    </div>
  );
}

// ============================================================
// MODAL HARGA PER KOTA - Owner atur harga khusus 1 produk buat
// tiap kota (lebih spesifik dari provinsi). Prioritas saat checkout:
// Harga Kota > Harga Provinsi > Harga Default produk. Kota yang belum
// diatur di sini otomatis fallback ke harga provinsi/default.
// ============================================================
function HargaKotaModal({ token, product, onClose }) {
  const [loading, setLoading] = useState(true);
  const [daftarHarga, setDaftarHarga] = useState([]); // [{id, kota, harga}]
  const [kotaBaru, setKotaBaru] = useState("");
  const [hargaBaru, setHargaBaru] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const rows = await supabaseFetch(token, `harga_produk_kota?select=id,kota,harga&product_id=eq.${product.id}&order=kota.asc`);
      setDaftarHarga(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function tambahHarga() {
    if (!kotaBaru.trim() || !hargaBaru) {
      setError("Isi dulu nama kota dan harganya.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await supabaseFetch(token, `harga_produk_kota?on_conflict=product_id,kota`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify({ product_id: product.id, kota: kotaBaru.trim(), harga: Number(hargaBaru) }),
      });
      setKotaBaru("");
      setHargaBaru("");
      await load();
    } catch (e) {
      setError("Gagal simpan: " + e.message);
    }
    setSaving(false);
  }

  async function updateHarga(id, hargaBaruNilai) {
    try {
      await supabaseFetch(token, `harga_produk_kota?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ harga: Number(hargaBaruNilai), updated_at: new Date().toISOString() }) });
      setDaftarHarga((prev) => prev.map((h) => (h.id === id ? { ...h, harga: Number(hargaBaruNilai) } : h)));
    } catch (e) {
      alert("Gagal update harga: " + e.message);
    }
  }

  async function hapusHarga(id) {
    if (!confirm("Hapus harga khusus kota ini? Kota ini akan kembali pakai harga provinsi/default produk.")) return;
    try {
      await supabaseFetch(token, `harga_produk_kota?id=eq.${id}`, { method: "DELETE" });
      setDaftarHarga((prev) => prev.filter((h) => h.id !== id));
    } catch (e) {
      alert("Gagal hapus: " + e.message);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", padding: 26 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>Harga per Kota</p>
        <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "0 0 4px" }}>{product.nama}</p>
        <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 18px" }}>
          Harga default (dasar): <strong>{rupiah(product.harga_jual)}</strong> - kota yang diatur di sini PALING DIUTAMAKAN, mengalahkan harga per provinsi kalau ada keduanya.
        </p>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBEAEA", color: "#C0392B", padding: 10, borderRadius: 9, fontSize: 12.5, marginBottom: 14 }}>
            {error}
          </div>
        )}

        {loading ? (
          <p style={{ textAlign: "center", color: "#9CA0A6", fontSize: 13, padding: "20px 0" }}>Memuat...</p>
        ) : daftarHarga.length === 0 ? (
          <p style={{ textAlign: "center", color: "#9CA0A6", fontSize: 12.5, padding: "16px 0" }}>Belum ada harga khusus kota - semua pakai harga provinsi/default.</p>
        ) : (
          daftarHarga.map((h) => (
            <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "8px 10px", background: "#F7F5F1", borderRadius: 9 }}>
              <p style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#24272B", margin: 0 }}>{h.kota}</p>
              <input
                type="number" defaultValue={h.harga}
                onBlur={(e) => { if (Number(e.target.value) !== h.harga) updateHarga(h.id, e.target.value); }}
                style={{ width: 120, padding: "6px 8px", borderRadius: 7, border: "1.5px solid #E4E1DA", fontSize: 12.5 }}
              />
              <button onClick={() => hapusHarga(h.id)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #F0CFC7", background: "#fff", color: "#C0392B", fontSize: 11.5, fontWeight: 600 }}>
                Hapus
              </button>
            </div>
          ))
        )}

        <div style={{ borderTop: "1px solid #EDEAE3", marginTop: 14, paddingTop: 14 }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 8px" }}>Tambah Harga Kota Baru</p>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={kotaBaru} onChange={(e) => setKotaBaru(e.target.value)}
              placeholder="Nama kota (misal: Pekanbaru)"
              style={{ flex: 1, padding: "9px 10px", borderRadius: 8, border: "1.5px solid #E4E1DA", fontSize: 12.5 }}
            />
            <input
              type="number" value={hargaBaru} onChange={(e) => setHargaBaru(e.target.value)}
              placeholder="Harga"
              style={{ width: 120, padding: "9px 10px", borderRadius: 8, border: "1.5px solid #E4E1DA", fontSize: 12.5 }}
            />
          </div>
          <button
            onClick={tambahHarga} disabled={saving}
            style={{ width: "100%", marginTop: 10, padding: 11, borderRadius: 9, border: "none", background: "#24272B", color: "#fff", fontWeight: 700, fontSize: 13 }}
          >
            {saving ? "Menyimpan..." : "+ Tambah"}
          </button>
        </div>

        <button onClick={onClose} style={{ width: "100%", marginTop: 16, padding: 11, borderRadius: 9, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13 }}>
          Tutup
        </button>
      </div>
    </div>
  );
}

function ProductPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [error, setError] = useState("");
  const [editingProduct, setEditingProduct] = useState(null); // null = tutup modal, {} = tambah baru, {...} = edit
  const [deletingId, setDeletingId] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [editingHargaProvinsi, setEditingHargaProvinsi] = useState(null); // null = tutup, {...product} = buka modal
  const [editingHargaKota, setEditingHargaKota] = useState(null); // null = tutup, {...product} = buka modal

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
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowImport(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}
          >
            <UploadCloud size={16} /> Import CSV
          </button>
          <button
            onClick={() => setEditingProduct({})}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}
          >
            <PackagePlus size={16} /> Tambah Produk
          </button>
        </div>
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
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <button onClick={() => setEditingProduct(p)} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 11.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <FileEdit size={11} /> Edit
              </button>
              <button disabled={deletingId === p.id} onClick={() => hapusProduk(p.id)} style={{ flex: 1, padding: "7px", borderRadius: 8, border: "1px solid #F0CFC7", background: "#fff", color: "#C0392B", fontSize: 11.5, fontWeight: 600 }}>
                Hapus
              </button>
            </div>
            <button onClick={() => setEditingHargaProvinsi(p)} style={{ width: "100%", padding: "7px", borderRadius: 8, border: "1px solid #E4E1DA", background: "#F7F5F1", color: "#24272B", fontSize: 11.5, fontWeight: 600, marginBottom: 6 }}>
              Harga per Provinsi
            </button>
            <button onClick={() => setEditingHargaKota(p)} style={{ width: "100%", padding: "7px", borderRadius: 8, border: "1px solid #E4E1DA", background: "#F7F5F1", color: "#24272B", fontSize: 11.5, fontWeight: 600 }}>
              Harga per Kota
            </button>
          </Card>
        ))}
      </div>
      {products.length === 0 && <EmptyState text="Belum ada produk. Klik 'Tambah Produk' untuk mulai." />}

      {editingProduct !== null && (
        <ProductFormModal token={token} product={editingProduct} onClose={() => setEditingProduct(null)} onSaved={handleSaved} />
      )}

      {showImport && (
        <ImportCSVModal token={token} onClose={() => setShowImport(false)} onSelesai={() => { setShowImport(false); load(); }} />
      )}

      {editingHargaProvinsi && (
        <HargaProvinsiModal token={token} product={editingHargaProvinsi} onClose={() => setEditingHargaProvinsi(null)} />
      )}
      {editingHargaKota && (
        <HargaKotaModal token={token} product={editingHargaKota} onClose={() => setEditingHargaKota(null)} />
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
    stockAwal: product.stock_awal ?? 0, stockMinimum: product.stock_minimum ?? 0, isiPerKoli: product.isi_per_koli || "", diskonKoliPct: product.diskon_koli_pct ? Number(product.diskon_koli_pct) * 100 : "",
    minimalOrder: product.minimal_order ?? 1,
    kelipatanOrder: product.kelipatan_order ?? 1,
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
      const compressed = await compressImage(file);
      const { ext, contentType } = infoFileTerkompresi(compressed, file);
      const filePath = `${form.kode || "produk"}-${tipe}-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/produk-gambar/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": contentType },
        body: compressed,
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
      const compressed = await compressImage(file);
      const { ext, contentType } = infoFileTerkompresi(compressed, file);
      const filePath = `${form.kode || "produk"}-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/produk-gambar/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": contentType },
        body: compressed,
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
    // Validasi angka dasar - cegah kesalahan input umum (harga negatif/nol,
    // stock negatif, diskon di luar rentang wajar)
    if (Number(form.hargaJual) <= 0) {
      setError("Harga Jual harus lebih besar dari 0.");
      return;
    }
    if (product.harga_minimum && Number(form.hargaJual) < Number(product.harga_minimum)) {
      setError(`Harga Jual untuk ${product.kode || form.kode} tidak boleh kurang dari ${rupiah(product.harga_minimum)}.`);
      return;
    }
    if (form.hargaAsli && Number(form.hargaAsli) < 0) {
      setError("Harga Coret tidak boleh negatif.");
      return;
    }
    if (form.hargaModal && Number(form.hargaModal) < 0) {
      setError("Harga Modal tidak boleh negatif.");
      return;
    }
    if (Number(form.stockAwal) < 0) {
      setError("Stock Awal tidak boleh negatif.");
      return;
    }
    if (Number(form.stockMinimum) < 0) {
      setError("Stock Minimum tidak boleh negatif.");
      return;
    }
    if (Number(form.isiPerKoli) < 0) {
      setError("Isi Per Koli tidak boleh negatif.");
      return;
    }
    if (Number(form.diskonKoliPct) < 0 || Number(form.diskonKoliPct) > 100) {
      setError("Diskon Koli harus di antara 0-100%.");
      return;
    }
    if (Number(form.cashbackPerKoli) < 0) {
      setError("Cashback Per Koli tidak boleh negatif.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const body = {
        kode: form.kode.trim().toUpperCase(), nama: form.nama.trim(), kategori: form.kategori || null, satuan: form.satuan.trim(),
        harga_jual: Number(form.hargaJual), harga_asli: form.hargaAsli ? Number(form.hargaAsli) : null,
        harga_modal: form.hargaModal ? Number(form.hargaModal) : null, stock_awal: Number(form.stockAwal) || 0,
        stock_minimum: Number(form.stockMinimum) || 0,
        isi_per_koli: Number(form.isiPerKoli) || 0, diskon_koli_pct: (Number(form.diskonKoliPct) || 0) / 100,
        minimal_order: Number(form.minimalOrder) || 1,
        kelipatan_order: Number(form.kelipatanOrder) || 1,
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
            <input type="number" min="1" value={form.hargaJual} onChange={set("hargaJual")} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Harga Asli (opsional)</label>
            <input type="number" min="0" value={form.hargaAsli} onChange={set("hargaAsli")} style={fieldStyle} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Harga Modal (Rp) - rahasia</label>
            <input type="number" min="0" value={form.hargaModal} onChange={set("hargaModal")} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Stock Awal</label>
            <input type="number" min="0" value={form.stockAwal} onChange={set("stockAwal")} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Stock Minimum (peringatan)</label>
            <input type="number" min="0" value={form.stockMinimum} onChange={set("stockMinimum")} style={fieldStyle} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Minimal Order (satuan)</label>
            <input type="number" min="1" value={form.minimalOrder} onChange={set("minimalOrder")} style={fieldStyle} />
            <p style={{ fontSize: 11, color: "#9CA0A6", margin: "4px 0 0" }}>
              Jumlah minimal wajib dibeli. Isi 1 kalau tidak ada aturan khusus.
            </p>
          </div>
          <div>
            <label style={labelStyle}>Kelipatan Order (satuan)</label>
            <input type="number" min="1" value={form.kelipatanOrder} onChange={set("kelipatanOrder")} style={fieldStyle} />
            <p style={{ fontSize: 11, color: "#9CA0A6", margin: "4px 0 0" }}>
              Qty harus kelipatan angka ini (misal 6 = cuma bisa 6, 12, 18...). Isi 1 kalau bebas.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Jumlah 1 Koli</label>
            <input type="number" min="0" value={form.isiPerKoli} onChange={set("isiPerKoli")} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Diskon Koli (%)</label>
            <input type="number" min="0" max="100" value={form.diskonKoliPct} onChange={set("diskonKoliPct")} style={fieldStyle} />
          </div>
          <div>
            <label style={labelStyle}>Cashback/Koli (Rp)</label>
            <input type="number" min="0" value={form.cashbackPerKoli} onChange={set("cashbackPerKoli")} style={fieldStyle} />
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
// IMPORT CSV - tambah banyak produk sekaligus dari file CSV/Excel
// ============================================================
function parseCSVSederhana(text) {
  const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  function parseBaris(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current);
    return result.map((v) => v.trim());
  }
  const headers = parseBaris(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const values = parseBaris(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
}

function ImportCSVModal({ token, onClose, onSelesai }) {
  const [dataParsed, setDataParsed] = useState([]); // [{ ...kolom, _valid, _error }]
  const [namaFile, setNamaFile] = useState("");
  const [importing, setImporting] = useState(false);
  const [hasilImport, setHasilImport] = useState(null); // { berhasil, gagal }

  function unduhTemplate() {
    const template = [
      "kode,nama,kategori,satuan,harga_jual,harga_asli,harga_modal,stock_awal,isi_per_koli,diskon_koli_pct,cashback_per_koli",
      "KZ-99,Contoh Produk Baru,Kategori Contoh,pcs,50000,60000,35000,100,12,5,2000",
    ].join("\r\n");
    const blob = new Blob(["\uFEFF" + template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-import-produk.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(file) {
    setNamaFile(file.name);
    setHasilImport(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rows = parseCSVSederhana(e.target.result);
        const kodeTerlihat = new Set();
        const divalidasi = rows.map((r) => {
          let error = null;
          if (!r.kode) error = "Kode kosong";
          else if (kodeTerlihat.has(r.kode.toUpperCase())) error = "Kode duplikat di file ini";
          else if (!r.nama) error = "Nama kosong";
          else if (!r.satuan) error = "Satuan kosong";
          else if (!r.harga_jual || isNaN(Number(r.harga_jual)) || Number(r.harga_jual) <= 0) error = "Harga Jual harus angka > 0";
          else if (r.harga_asli && (isNaN(Number(r.harga_asli)) || Number(r.harga_asli) < 0)) error = "Harga Asli tidak valid";
          else if (r.harga_modal && (isNaN(Number(r.harga_modal)) || Number(r.harga_modal) < 0)) error = "Harga Modal tidak valid";
          else if (r.stock_awal && (isNaN(Number(r.stock_awal)) || Number(r.stock_awal) < 0)) error = "Stock Awal tidak valid";
          if (!error) kodeTerlihat.add(r.kode.toUpperCase());
          return { ...r, _valid: !error, _error: error };
        });
        setDataParsed(divalidasi);
      } catch (err) {
        alert("Gagal baca file: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  async function prosesImport() {
    const validRows = dataParsed.filter((r) => r._valid);
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const body = validRows.map((r) => ({
        kode: r.kode.trim().toUpperCase(),
        nama: r.nama.trim(),
        kategori: r.kategori?.trim() || null,
        satuan: r.satuan.trim(),
        harga_jual: Number(r.harga_jual),
        harga_asli: r.harga_asli ? Number(r.harga_asli) : null,
        harga_modal: r.harga_modal ? Number(r.harga_modal) : null,
        stock_awal: r.stock_awal ? Number(r.stock_awal) : 0,
        isi_per_koli: r.isi_per_koli ? Number(r.isi_per_koli) : 0,
        diskon_koli_pct: r.diskon_koli_pct ? Number(r.diskon_koli_pct) / 100 : 0,
        cashback_per_koli: r.cashback_per_koli ? Number(r.cashback_per_koli) : 0,
        aktif: true,
      }));
      const inserted = await supabaseFetch(token, "products", { method: "POST", body: JSON.stringify(body) });
      setHasilImport({ berhasil: inserted.length, gagal: dataParsed.length - validRows.length });
    } catch (e) {
      alert("Gagal import: " + e.message + "\n\nKemungkinan ada Kode yang sudah dipakai produk lain yang sudah ada di sistem.");
    }
    setImporting(false);
  }

  const jumlahValid = dataParsed.filter((r) => r._valid).length;
  const jumlahError = dataParsed.length - jumlahValid;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 720, maxHeight: "88vh", overflowY: "auto", padding: 26 }}>
        <h2 className="disp" style={{ fontSize: 19, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>Import Produk dari CSV</h2>
        <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 20px" }}>Tambah banyak produk sekaligus - buka file di Excel, "Save As" jadi CSV, lalu upload di sini.</p>

        {hasilImport ? (
          <div style={{ textAlign: "center", padding: 30 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#D8E9E6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Check size={26} color="#28685D" />
            </div>
            <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 6px" }}>Import Selesai</p>
            <p style={{ fontSize: 13, color: "#6B6F75", margin: "0 0 24px" }}>
              {hasilImport.berhasil} produk berhasil ditambahkan{hasilImport.gagal > 0 && `, ${hasilImport.gagal} dilewati karena error`}.
            </p>
            <button onClick={onSelesai} style={{ padding: "12px 28px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}>
              Selesai
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={unduhTemplate}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 16px", borderRadius: 9, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700, marginBottom: 16 }}
            >
              <Download size={14} /> Unduh Template CSV
            </button>

            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 24, borderRadius: 12, border: "1.5px dashed #E8A426", background: "#FFFBF0", color: "#8A6A1A", cursor: "pointer", marginBottom: 18 }}>
              <UploadCloud size={24} />
              <span style={{ fontSize: 13, fontWeight: 700 }}>{namaFile || "Tap untuk Pilih File CSV"}</span>
              <input type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
            </label>

            {dataParsed.length > 0 && (
              <>
                <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 999, background: "#D8E9E6", color: "#28685D" }}>{jumlahValid} valid</span>
                  {jumlahError > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 999, background: "#FBEAEA", color: "#C0392B" }}>{jumlahError} error</span>
                  )}
                </div>

                <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #EDEAE3", borderRadius: 10, marginBottom: 20 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#F7F5F1", position: "sticky", top: 0 }}>
                        <th style={{ padding: "8px 10px", textAlign: "left" }}>Kode</th>
                        <th style={{ padding: "8px 10px", textAlign: "left" }}>Nama</th>
                        <th style={{ padding: "8px 10px", textAlign: "right" }}>Harga Jual</th>
                        <th style={{ padding: "8px 10px", textAlign: "left" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataParsed.map((r, i) => (
                        <tr key={i} style={{ borderTop: "1px solid #EDEAE3", background: r._valid ? "transparent" : "#FBEAEA" }}>
                          <td style={{ padding: "8px 10px", fontWeight: 700 }}>{r.kode || "-"}</td>
                          <td style={{ padding: "8px 10px" }}>{r.nama || "-"}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>{r.harga_jual || "-"}</td>
                          <td style={{ padding: "8px 10px", color: r._valid ? "#28685D" : "#C0392B", fontWeight: 600 }}>
                            {r._valid ? "Valid" : r._error}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
                Batal
              </button>
              <button
                onClick={prosesImport}
                disabled={jumlahValid === 0 || importing}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: jumlahValid === 0 ? "#E4E1DA" : "#28685D", color: jumlahValid === 0 ? "#9CA0A6" : "#fff", fontWeight: 700, fontSize: 13.5 }}
              >
                {importing ? "Mengimpor..." : `Import ${jumlahValid} Produk`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CHAT TOKO (Sales, Owner, Admin Transaksi balas chat dari toko)
// ============================================================
function ChatSalesPage({ token, profile, isMobile }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCase, setSelectedCase] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [filterKategori, setFilterKategori] = useState("clara"); // "clara" | "sales" - buat Owner/Admin Transaksi
  const pollRef = useRef(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      let url = "chat_cases?select=*,clients(nama,kode)&order=updated_at.desc";
      if (profile?.role === "sales" && profile?.sales_id) {
        // Sales cuma lihat kasus kategori "sales" yang jadi tanggung jawabnya
        url += `&kategori=eq.sales&sales_id=eq.${profile.sales_id}`;
      } else {
        // Owner/Admin Transaksi - filter berdasarkan tab kategori yang dipilih
        url += `&kategori=eq.${filterKategori}`;
      }
      const rows = await supabaseFetch(token, url);
      setCases(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [filterKategori]);

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
        body: JSON.stringify({ case_id: selectedCase.id, sender_type: selectedCase.kategori === "clara" ? "clara" : "sales", message: text }),
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
            <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: 0 }}>
              {selectedCase.no_case} - {selectedCase.clients?.nama}
              <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: selectedCase.kategori === "clara" ? "#FBF0D9" : "#D8E9E6", color: selectedCase.kategori === "clara" ? "#8A6A1A" : "#28685D", verticalAlign: "middle" }}>
                {selectedCase.kategori === "clara" ? "Clara (CS)" : "Sales"}
              </span>
            </p>
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
            {messages.map((m) => {
              const dariAdmin = m.sender_type === "sales" || m.sender_type === "clara";
              return (
              <div key={m.id} style={{ display: "flex", justifyContent: dariAdmin ? "flex-end" : "flex-start", marginBottom: 12 }}>
                {m.tipe_pesan === "gambar" && m.image_url ? (
                  <img src={m.image_url} alt="Lampiran" style={{ maxWidth: "50%", borderRadius: 14, display: "block" }} />
                ) : (
                  <div style={{
                    maxWidth: "65%", padding: "10px 14px", borderRadius: 14,
                    background: dariAdmin ? "#E8A426" : "#fff",
                    border: dariAdmin ? "none" : "1px solid #EDEAE3",
                    fontSize: 13, lineHeight: 1.5, color: "#24272B", whiteSpace: "pre-line",
                  }}>
                    {m.message}
                  </div>
                )}
              </div>
              );
            })}
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
      {profile?.role !== "sales" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setFilterKategori("clara")}
            style={{ padding: "9px 18px", borderRadius: 9, border: filterKategori === "clara" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: filterKategori === "clara" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}
          >
            Clara (Customer Service)
          </button>
          <button
            onClick={() => setFilterKategori("sales")}
            style={{ padding: "9px 18px", borderRadius: 9, border: filterKategori === "sales" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: filterKategori === "sales" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}
          >
            Ditangani Sales
          </button>
        </div>
      )}
      {isMobile ? (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {cases.map((c, i) => (
            <div key={c.id} onClick={() => openCase(c)} style={{ padding: 14, borderTop: i === 0 ? "none" : "1px solid #EDEAE3", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: 0 }}>{c.no_case}</p>
                <span style={{ background: c.status === "open" ? "#D8E9E6" : "#F7F5F1", color: c.status === "open" ? "#28685D" : "#9CA0A6", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                  {c.status === "open" ? "Terbuka" : "Ditutup"}
                </span>
              </div>
              <p style={{ fontSize: 12.5, color: "#24272B", margin: "0 0 4px" }}>{c.clients?.nama} ({c.clients?.kode})</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ background: c.kategori === "clara" ? "#FBF0D9" : "#D8E9E6", color: c.kategori === "clara" ? "#8A6A1A" : "#28685D", padding: "3px 10px", borderRadius: 999, fontSize: 10.5, fontWeight: 700 }}>
                  {c.kategori === "clara" ? "Clara (CS)" : "Sales"}
                </span>
                <p style={{ fontSize: 11, color: "#9CA0A6", margin: 0 }}>{new Date(c.updated_at).toLocaleString("id-ID")}</p>
              </div>
            </div>
          ))}
          {cases.length === 0 && <EmptyState text="Belum ada chat dari toko." />}
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#F7F5F1" }}>
                {["No Case", "Toko", "Kategori", "Terakhir Update", "Status", ""].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 700 }}>{c.no_case}</td>
                  <td style={{ padding: "12px 14px" }}>{c.clients?.nama} ({c.clients?.kode})</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ background: c.kategori === "clara" ? "#FBF0D9" : "#D8E9E6", color: c.kategori === "clara" ? "#8A6A1A" : "#28685D", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
                      {c.kategori === "clara" ? "Clara (CS)" : "Sales"}
                    </span>
                  </td>
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
      )}
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
  const [form, setForm] = useState({ nama: "", alamat: "", kota: "", provinsi: "", kodePos: "", email: "", noHp: "", fotoUrl: "" });
  const [dataTerkunci, setDataTerkunci] = useState(false);

  const [statusVerifikasi, setStatusVerifikasi] = useState("belum_upload");
  const [alasanDitolak, setAlasanDitolak] = useState("");
  const [fotoKtp, setFotoKtp] = useState(null);
  const [fotoNpwp, setFotoNpwp] = useState(null);
  const [fotoKk, setFotoKk] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(null); // "ktp" | "npwp" | "kk" | null
  const [submittingVerifikasi, setSubmittingVerifikasi] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      if (!profile?.sales_id) throw new Error("Akun ini belum terhubung ke data sales manapun.");
      const rows = await supabaseFetch(token, `sales?select=nama,alamat,kota,provinsi,kode_pos,email,no_hp,foto_url,data_pribadi_terkunci,status_verifikasi,alasan_verifikasi_ditolak,foto_ktp_url,foto_npwp_url,foto_kk_url&id=eq.${profile.sales_id}`);
      const s = rows[0] || {};
      setForm({
        nama: s.nama || "", alamat: s.alamat || "", kota: s.kota || "", provinsi: s.provinsi || "", kodePos: s.kode_pos || "",
        email: s.email || "", noHp: s.no_hp || "", fotoUrl: s.foto_url || "",
      });
      setDataTerkunci(!!s.data_pribadi_terkunci);
      setStatusVerifikasi(s.status_verifikasi || "belum_upload");
      setAlasanDitolak(s.alasan_verifikasi_ditolak || "");
      setFotoKtp(s.foto_ktp_url || null);
      setFotoNpwp(s.foto_npwp_url || null);
      setFotoKk(s.foto_kk_url || null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function uploadFoto(file) {
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const { ext, contentType } = infoFileTerkompresi(compressed, file);
      const filePath = `sales-${profile.sales_id}-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/produk-gambar/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": contentType },
        body: compressed,
      });
      if (!res.ok) throw new Error(await res.text());
      const url = `${SUPABASE_URL}/storage/v1/object/public/produk-gambar/${filePath}`;
      // Simpan LANGSUNG ke database - sebelumnya cuma update tampilan
      // sementara (state React), jadi foto hilang lagi setelah refresh
      // karena tidak pernah benar-benar tersimpan.
      await supabaseFetch(token, `sales?id=eq.${profile.sales_id}`, {
        method: "PATCH",
        body: JSON.stringify({ foto_url: url }),
      });
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
          nama: form.nama, alamat: form.alamat || null, kota: form.kota || null,
          provinsi: form.provinsi || null, kode_pos: form.kodePos || null, email: form.email || null,
          no_hp: form.noHp || null, foto_url: form.fotoUrl || null,
          // Begitu disimpan PERTAMA KALI, kunci data pribadi (nama/alamat/
          // email/no HP) - kalau mau ubah lagi ke depannya harus hubungi Owner
          data_pribadi_terkunci: true,
        }),
      });
      setDataTerkunci(true);
      setSaved(true);
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  }

  // ---------- DOKUMEN VERIFIKASI (KTP, NPWP, KK) ----------
  async function uploadDokumen(file, jenis) {
    setUploadingDoc(jenis);
    try {
      const compressed = await compressImage(file);
      const { ext, contentType } = infoFileTerkompresi(compressed, file);
      const filePath = `verifikasi-sales-${jenis}-${profile.sales_id}-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/dokumen-verifikasi/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": contentType },
        body: compressed,
      });
      if (!res.ok) throw new Error(await res.text());
      if (jenis === "ktp") setFotoKtp(filePath);
      else if (jenis === "npwp") setFotoNpwp(filePath);
      else setFotoKk(filePath);
    } catch (e) {
      alert("Gagal upload dokumen: " + e.message);
    }
    setUploadingDoc(null);
  }

  async function kirimVerifikasiSales() {
    if (!fotoKtp || !fotoNpwp || !fotoKk) {
      alert("Upload ketiga dokumen (KTP, NPWP, Kartu Keluarga) dulu sebelum kirim.");
      return;
    }
    setSubmittingVerifikasi(true);
    try {
      await supabaseFetch(token, `sales?id=eq.${profile.sales_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          foto_ktp_url: fotoKtp, foto_npwp_url: fotoNpwp, foto_kk_url: fotoKk,
          status_verifikasi: "menunggu_review", alasan_verifikasi_ditolak: null,
        }),
      });
      setStatusVerifikasi("menunggu_review");
    } catch (e) {
      alert("Gagal kirim verifikasi: " + e.message);
    }
    setSubmittingVerifikasi(false);
  }

  if (loading) return <LoadingState />;
  if (error && !form.nama) return <ErrorBox error={error} onRetry={load} />;

  const fieldStyle = { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, outline: "none" };
  const fieldStyleLocked = { ...fieldStyle, background: "#F7F5F1", color: "#9CA0A6", cursor: "not-allowed" };
  const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" };

  const statusBadge = {
    belum_upload: { text: "Belum Verifikasi", bg: "#FBEAEA", color: "#C0392B" },
    menunggu_review: { text: "Menunggu Review Owner", bg: "#FBF0D9", color: "#8A6A1A" },
    terverifikasi: { text: "Terverifikasi", bg: "#D8E9E6", color: "#28685D" },
    ditolak: { text: "Ditolak", bg: "#FBEAEA", color: "#C0392B" },
  }[statusVerifikasi];

  return (
    <div>
      <PageHeader title="Profil Saya" subtitle="Kelola informasi profil Anda sebagai sales" />

      <Card style={{ maxWidth: 480, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <div style={{ width: 84, height: 84, borderRadius: "50%", background: form.fotoUrl ? `url(${form.fotoUrl}) center/cover` : "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {!form.fotoUrl && <User size={32} color="#D8D6D0" />}
          </div>
          {form.fotoUrl ? (
            <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: 0, lineHeight: 1.5 }}>
              Foto profil cuma bisa dipasang <strong>1 kali</strong>. Hubungi Owner kalau perlu diganti.
            </p>
          ) : (
            <label style={{ padding: "9px 16px", borderRadius: 9, border: "1.5px dashed #E8A426", background: "#FFFBF0", color: "#8A6A1A", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              {uploading ? "Mengupload..." : "Pasang Foto"}
              <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploading} onChange={(e) => { if (e.target.files[0]) uploadFoto(e.target.files[0]); }} />
            </label>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FFFBF0", borderRadius: 10, padding: 12, marginBottom: 20 }}>
          <AlertCircle size={15} color="#8A6A1A" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12, color: "#8A6A1A", margin: 0, lineHeight: 1.5 }}>
            Untuk perubahan data profil, silakan hubungi Owner.
          </p>
        </div>

        {dataTerkunci ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>Nama Lengkap</p>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "#24272B", margin: "0 0 14px" }}>{form.nama || "-"}</p>
            </div>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>No. HP</p>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "#24272B", margin: "0 0 14px" }}>{form.noHp || "-"}</p>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>Alamat</p>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "#24272B", margin: "0 0 14px" }}>{form.alamat || "-"}</p>
            </div>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>Kota/Kabupaten</p>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "#24272B", margin: "0 0 14px" }}>{form.kota || "-"}</p>
            </div>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>Provinsi</p>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "#24272B", margin: "0 0 14px" }}>{form.provinsi || "-"}</p>
            </div>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>Kode Pos</p>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "#24272B", margin: "0 0 14px" }}>{form.kodePos || "-"}</p>
            </div>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>Email</p>
              <p style={{ fontSize: 13.5, fontWeight: 600, color: "#24272B", margin: "0 0 14px" }}>{form.email || "-"}</p>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { key: "nama", label: "Nama Lengkap", full: false },
              { key: "noHp", label: "No. HP", full: false },
              { key: "alamat", label: "Alamat", full: true },
              { key: "kota", label: "Kota/Kabupaten", full: false },
              { key: "provinsi", label: "Provinsi", full: false },
              { key: "kodePos", label: "Kode Pos", full: false },
              { key: "email", label: "Email", full: false },
            ].map((f) => (
              <div key={f.key} style={f.full ? { gridColumn: "1 / -1" } : undefined}>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>{f.label}</p>
                <input
                  type="text"
                  value={form[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={`Isi ${f.label.toLowerCase()}...`}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, marginBottom: 14, boxSizing: "border-box" }}
                />
              </div>
            ))}
            <div style={{ gridColumn: "1 / -1" }}>
              {error && <p style={{ fontSize: 12, color: "#C0392B", margin: "0 0 10px" }}>{error}</p>}
              {saved && <p style={{ fontSize: 12, color: "#28685D", margin: "0 0 10px" }}>Berhasil disimpan!</p>}
              <button
                onClick={simpan}
                disabled={saving || !form.nama.trim()}
                style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: saving || !form.nama.trim() ? "#E4E1DA" : "#28685D", color: saving || !form.nama.trim() ? "#9CA0A6" : "#fff", fontWeight: 700, fontSize: 13.5 }}
              >
                {saving ? "Menyimpan..." : "Simpan Data Profil"}
              </button>
              <p style={{ fontSize: 11, color: "#9CA0A6", margin: "8px 0 0", textAlign: "center" }}>
                Data ini cuma bisa diisi <strong>1 kali</strong> - setelah disimpan, untuk perubahan berikutnya harus hubungi Owner.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* VERIFIKASI DOKUMEN */}
      <Card style={{ maxWidth: 480 }}>
        <h2 className="disp" style={{ fontSize: 16, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>Verifikasi Dokumen</h2>
        <p style={{ fontSize: 12, color: "#9CA0A6", margin: "0 0 14px" }}>Wajib diverifikasi Owner sebelum bisa akses semua fitur.</p>

        <span style={{ display: "inline-block", padding: "5px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: statusBadge.bg, color: statusBadge.color, marginBottom: 16 }}>
          {statusBadge.text}
        </span>

        {statusVerifikasi === "ditolak" && alasanDitolak && (
          <div style={{ background: "#FBEAEA", borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 4px", fontWeight: 700 }}>ALASAN DITOLAK</p>
            <p style={{ fontSize: 12.5, color: "#C0392B", margin: 0 }}>{alasanDitolak}</p>
          </div>
        )}

        {statusVerifikasi === "terverifikasi" ? (
          <p style={{ fontSize: 12.5, color: "#28685D", fontWeight: 600 }}>Dokumen Anda sudah terverifikasi. Semua fitur sudah bisa diakses.</p>
        ) : statusVerifikasi === "menunggu_review" ? (
          <p style={{ fontSize: 12.5, color: "#8A6A1A" }}>Dokumen sudah dikirim, sedang ditinjau Owner. Mohon tunggu.</p>
        ) : (
          <>
            {[
              { key: "ktp", label: "Foto KTP", val: fotoKtp, setVal: setFotoKtp },
              { key: "npwp", label: "Foto NPWP", val: fotoNpwp, setVal: setFotoNpwp },
              { key: "kk", label: "Foto Kartu Keluarga", val: fotoKk, setVal: setFotoKk },
            ].map((d) => (
              <div key={d.key} style={{ marginBottom: 14 }}>
                <label style={labelStyle}>{d.label}</label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 9, border: d.val ? "1.5px solid #28685D" : "1.5px dashed #E8A426", background: d.val ? "#D8E9E6" : "#FFFBF0", color: d.val ? "#28685D" : "#8A6A1A", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  {d.val ? <Check size={15} /> : <UploadCloud size={15} />}
                  {uploadingDoc === d.key ? "Mengupload..." : d.val ? "Sudah diupload - tap untuk ganti" : "Tap untuk upload"}
                  <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={!!uploadingDoc} onChange={(e) => { if (e.target.files[0]) uploadDokumen(e.target.files[0], d.key); }} />
                </label>
              </div>
            ))}
            <button
              onClick={kirimVerifikasiSales}
              disabled={submittingVerifikasi || !fotoKtp || !fotoNpwp || !fotoKk}
              style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: (fotoKtp && fotoNpwp && fotoKk) ? "#E8A426" : "#E4E1DA", color: (fotoKtp && fotoNpwp && fotoKk) ? "#24272B" : "#9CA0A6", fontWeight: 700, fontSize: 13.5, marginTop: 4 }}
            >
              {submittingVerifikasi ? "Mengirim..." : "Kirim untuk Verifikasi"}
            </button>
          </>
        )}
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

// ============================================================
// TOKO (Sales) - daftar toko yang ditangani sales ini, lengkap dengan
// titik GPS terakhir (diambil dari laporan kunjungan sebelumnya) supaya
// sales tidak bingung cari alamat toko, atau saat pergantian anggota sales.
// ============================================================
function TokoSalesPage({ token, profile }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [daftarToko, setDaftarToko] = useState([]);
  const [gpsMap, setGpsMap] = useState({}); // { client_id: { latitude, longitude } }
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const clients = await supabaseFetch(token, `clients?select=id,kode,nama,alamat,telp,kota,nama_owner&sales_id=eq.${profile.sales_id}&order=nama.asc`);
      setDaftarToko(clients);

      if (clients.length > 0) {
        const clientIds = clients.map((c) => c.id);
        // Ambil titik GPS TERBARU per toko dari riwayat kunjungan - kalau
        // toko yang sama dikunjungi berkali-kali, pakai yang paling baru.
        const kunjungan = await supabaseFetch(
          token,
          `kunjungan_sales?select=client_id,latitude,longitude,created_at&client_id=in.(${clientIds.join(",")})&latitude=not.is.null&order=created_at.desc`
        );
        const map = {};
        kunjungan.forEach((k) => {
          if (!map[k.client_id]) map[k.client_id] = { latitude: k.latitude, longitude: k.longitude };
        });
        setGpsMap(map);
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const filtered = daftarToko.filter((c) => c.nama.toLowerCase().includes(search.toLowerCase()) || c.kode.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="Toko" subtitle={`${daftarToko.length} toko yang Anda tangani`} />

      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari nama/kode toko..."
        style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, width: 260, marginBottom: 16 }}
      />

      {filtered.length === 0 ? (
        <EmptyState text="Belum ada toko yang Anda tangani." />
      ) : (
        filtered.map((c) => {
          const gps = gpsMap[c.id];
          return (
            <Card key={c.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 2px", fontWeight: 700 }}>{c.kode}</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{c.nama}</p>
                  {c.nama_owner && (
                    <p style={{ fontSize: 12, color: "#8A6A1A", margin: "0 0 6px", fontWeight: 600 }}>Pemilik: {c.nama_owner}</p>
                  )}
                  <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "0 0 2px" }}>{c.alamat || "-"}{c.kota ? `, ${c.kota}` : ""}</p>
                  <p style={{ fontSize: 12.5, color: "#6B6F75", margin: 0 }}>{c.telp || "-"}</p>
                </div>
                {gps ? (
                  <a
                    href={`https://www.google.com/maps?q=${gps.latitude},${gps.longitude}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ width: 44, height: 44, borderRadius: "50%", background: "#D8E9E6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    title="Buka lokasi di Google Maps"
                  >
                    <Navigation size={20} color="#28685D" />
                  </a>
                ) : (
                  <div
                    style={{ width: 44, height: 44, borderRadius: "50%", background: "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
                    title="Belum ada titik GPS - kunjungi toko ini dulu lewat Laporan Kunjungan"
                  >
                    <Navigation size={20} color="#B5B2AA" />
                  </div>
                )}
              </div>
              {!gps && (
                <p style={{ fontSize: 11, color: "#9CA0A6", margin: "8px 0 0" }}>
                  Belum ada titik GPS - akan otomatis tersimpan setelah Anda buat Laporan Kunjungan ke toko ini.
                </p>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}

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
  const [fotoSiapKirim, setFotoSiapKirim] = useState(null); // { url } - foto sudah diupload, tinggal isi catatan
  const [catatanKunjungan, setCatatanKunjungan] = useState("");
  const [menyimpanKunjungan, setMenyimpanKunjungan] = useState(false);

  const [laporanMingguIni, setLaporanMingguIni] = useState(null);
  const [laporanBulanIni, setLaporanBulanIni] = useState(null);
  const [hambatanMinggu, setHambatanMinggu] = useState("");
  const [hambatanBulan, setHambatanBulan] = useState("");
  const [savingMinggu, setSavingMinggu] = useState(false);
  const [savingBulan, setSavingBulan] = useState(false);
  const [checkinTab, setCheckinTab] = useState("foto"); // "foto" | "catatan"
  const [catatanTokoIni, setCatatanTokoIni] = useState([]);
  const [catatanBaruToko, setCatatanBaruToko] = useState("");
  const [loadingCatatanToko, setLoadingCatatanToko] = useState(false);
  const [savingCatatanToko, setSavingCatatanToko] = useState(false);

  // Senin di minggu berjalan (patokan laporan mingguan)
  function getSeninMingguIni() {
    const d = new Date();
    const day = d.getDay(); // 0=Minggu
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const seninMingguIni = getSeninMingguIni();

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

      const [clientsRows, kunjunganRows, mingguRows, bulanRows] = await Promise.all([
        supabaseFetch(token, `clients?select=id,nama,kode,alamat&sales_id=eq.${profile.sales_id}&order=nama.asc`),
        supabaseFetch(token, `kunjungan_sales?select=*&sales_id=eq.${profile.sales_id}&created_at=gte.${startBulan}&created_at=lt.${endBulan}&order=created_at.desc`),
        supabaseFetch(token, `laporan_mingguan_sales?select=*&sales_id=eq.${profile.sales_id}&minggu_mulai=eq.${getSeninMingguIni()}`),
        supabaseFetch(token, `laporan_bulanan_sales?select=*&sales_id=eq.${profile.sales_id}&bulan=eq.${now.getMonth() + 1}&tahun=eq.${now.getFullYear()}`),
      ]);
      setHandledClients(clientsRows);
      setKunjunganBulanIni(kunjunganRows);
      setLaporanMingguIni(mingguRows[0] || null);
      setLaporanBulanIni(bulanRows[0] || null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function simpanLaporanMingguan() {
    if (!hambatanMinggu.trim()) {
      alert("Isi dulu laporan hambatan minggu ini.");
      return;
    }
    setSavingMinggu(true);
    try {
      const [inserted] = await supabaseFetch(token, "laporan_mingguan_sales", {
        method: "POST",
        body: JSON.stringify({ sales_id: profile.sales_id, minggu_mulai: seninMingguIni, hambatan: hambatanMinggu.trim() }),
      });
      setLaporanMingguIni(inserted);
      setHambatanMinggu("");
    } catch (e) {
      alert("Gagal simpan laporan mingguan: " + e.message);
    }
    setSavingMinggu(false);
  }

  async function simpanLaporanBulanan() {
    if (!hambatanBulan.trim()) {
      alert("Isi dulu laporan hambatan bulan ini.");
      return;
    }
    setSavingBulan(true);
    try {
      const [inserted] = await supabaseFetch(token, "laporan_bulanan_sales", {
        method: "POST",
        body: JSON.stringify({ sales_id: profile.sales_id, bulan: now.getMonth() + 1, tahun: now.getFullYear(), hambatan: hambatanBulan.trim() }),
      });
      setLaporanBulanIni(inserted);
      setHambatanBulan("");
    } catch (e) {
      alert("Gagal simpan laporan bulanan: " + e.message);
    }
    setSavingBulan(false);
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

  async function loadCatatanToko(clientId) {
    setLoadingCatatanToko(true);
    try {
      const rows = await supabaseFetch(token, `catatan_toko_sales?select=*&client_id=eq.${clientId}&sales_id=eq.${profile.sales_id}&order=created_at.desc`);
      setCatatanTokoIni(rows);
    } catch (e) {
      console.log("Gagal muat catatan toko:", e.message);
    }
    setLoadingCatatanToko(false);
  }

  async function simpanCatatanToko() {
    if (!catatanBaruToko.trim()) return;
    setSavingCatatanToko(true);
    try {
      const [inserted] = await supabaseFetch(token, "catatan_toko_sales", {
        method: "POST",
        body: JSON.stringify({ client_id: selectedClient.id, sales_id: profile.sales_id, catatan: catatanBaruToko.trim() }),
      });
      setCatatanTokoIni((prev) => [inserted, ...prev]);
      setCatatanBaruToko("");
    } catch (e) {
      alert("Gagal simpan catatan: " + e.message);
    }
    setSavingCatatanToko(false);
  }

  async function hapusCatatanToko(id) {
    if (!confirm("Hapus catatan ini?")) return;
    try {
      await supabaseFetch(token, `catatan_toko_sales?id=eq.${id}`, { method: "DELETE" });
      setCatatanTokoIni((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      alert("Gagal hapus: " + e.message);
    }
  }

  function mulaiCheckin(client) {
    if (sudahKunjunganHariIni(client.id)) {
      alert(`Anda sudah membuat laporan kunjungan untuk ${client.nama} hari ini. Silakan coba lagi besok.`);
      return;
    }
    setSelectedClient(client);
    setMode("checkin");
    setCheckinTab("foto");
    loadCatatanToko(client.id);
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

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
      const extBlob = blob?.type === "image/webp" ? "webp" : "png"; // fallback kalau browser tidak dukung WebP
      const filePath = `kunjungan-${profile.sales_id}-${selectedClient.id}-${Date.now()}.${extBlob}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/produk-gambar/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": blob?.type || "image/png" },
        body: blob,
      });
      if (!res.ok) throw new Error(await res.text());
      const url = `${SUPABASE_URL}/storage/v1/object/public/produk-gambar/${filePath}`;

      // Foto sudah tersimpan - JANGAN langsung insert kunjungan dulu, sales
      // wajib isi catatan kunjungan terlebih dahulu sebelum benar-benar
      // dikonfirmasi.
      setFotoSiapKirim({ url });
    } catch (e) {
      alert("Gagal upload foto: " + e.message);
    }
    setUploading(false);
  }

  async function konfirmasiKunjungan() {
    if (!catatanKunjungan.trim()) {
      alert("Isi dulu catatan kunjungan sebelum konfirmasi.");
      return;
    }
    setMenyimpanKunjungan(true);
    try {
      await supabaseFetch(token, "kunjungan_sales", {
        method: "POST",
        body: JSON.stringify({
          sales_id: profile.sales_id, client_id: selectedClient.id,
          foto_url: fotoSiapKirim.url, latitude: coords.lat, longitude: coords.lng,
          catatan: catatanKunjungan.trim(),
        }),
      });

      await load();
      setMode(null);
      setSelectedClient(null);
      setFotoSiapKirim(null);
      setCatatanKunjungan("");
    } catch (e) {
      alert("Gagal simpan kunjungan: " + e.message);
    }
    setMenyimpanKunjungan(false);
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
        <button onClick={() => { setMode(null); setSelectedClient(null); setFotoSiapKirim(null); setCatatanKunjungan(""); }} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#6B6F75", fontSize: 13, marginBottom: 14, padding: 0 }}>
          <ChevronLeft size={16} /> Batal
        </button>
        <PageHeader title={`Kunjungi ${selectedClient.nama}`} subtitle={selectedClient.alamat || selectedClient.kode} />

        <div style={{ display: "flex", gap: 8, marginBottom: 16, maxWidth: 420 }}>
          <button
            onClick={() => setCheckinTab("foto")}
            style={{ flex: 1, padding: "10px", borderRadius: 9, border: checkinTab === "foto" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: checkinTab === "foto" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
          >
            Ambil Foto
          </button>
          <button
            onClick={() => setCheckinTab("catatan")}
            style={{ flex: 1, padding: "10px", borderRadius: 9, border: checkinTab === "catatan" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: checkinTab === "catatan" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
          >
            Catatan Toko
          </button>
        </div>

        {checkinTab === "catatan" ? (
          <Card style={{ maxWidth: 420 }}>
            <textarea
              value={catatanBaruToko}
              onChange={(e) => setCatatanBaruToko(e.target.value)}
              placeholder="Tulis catatan baru tentang toko ini..."
              rows={3}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, resize: "vertical", marginBottom: 10 }}
            />
            <button
              onClick={simpanCatatanToko}
              disabled={savingCatatanToko || !catatanBaruToko.trim()}
              style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: (savingCatatanToko || !catatanBaruToko.trim()) ? "#E4E1DA" : "#E8A426", color: (savingCatatanToko || !catatanBaruToko.trim()) ? "#9CA0A6" : "#24272B", fontWeight: 700, fontSize: 13.5, marginBottom: 18 }}
            >
              {savingCatatanToko ? "Menyimpan..." : "Simpan Catatan"}
            </button>

            <p style={{ fontSize: 12, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 10px" }}>Riwayat Catatan</p>
            {loadingCatatanToko ? (
              <p style={{ fontSize: 12.5, color: "#9CA0A6" }}>Memuat...</p>
            ) : catatanTokoIni.length === 0 ? (
              <p style={{ fontSize: 12.5, color: "#9CA0A6" }}>Belum ada catatan untuk toko ini.</p>
            ) : (
              catatanTokoIni.map((c) => (
                <div key={c.id} style={{ borderTop: "1px solid #EDEAE3", paddingTop: 10, marginTop: 10 }}>
                  <p style={{ fontSize: 12.5, color: "#24272B", margin: "0 0 6px", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.catatan}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ fontSize: 10.5, color: "#9CA0A6", margin: 0 }}>
                      {new Date(c.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                    <button onClick={() => hapusCatatanToko(c.id)} style={{ background: "none", border: "none", color: "#C0392B", fontSize: 11, fontWeight: 600, padding: 0 }}>
                      Hapus
                    </button>
                  </div>
                </div>
              ))
            )}
          </Card>
        ) : (
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
            fotoSiapKirim ? (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#D8E9E6", color: "#28685D", padding: 12, borderRadius: 9, fontSize: 12.5, marginBottom: 14, fontWeight: 600 }}>
                  <Check size={16} /> Foto berhasil diambil.
                </div>
                <img src={fotoSiapKirim.url} alt="Foto kunjungan" style={{ width: "100%", borderRadius: 10, marginBottom: 14 }} />
                <label style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Catatan Kunjungan (wajib diisi)</label>
                <textarea
                  value={catatanKunjungan}
                  onChange={(e) => setCatatanKunjungan(e.target.value)}
                  placeholder="Contoh: toko stok mulai menipis, mau order minggu depan..."
                  rows={3}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, resize: "vertical", marginBottom: 14 }}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => { setFotoSiapKirim(null); setCatatanKunjungan(""); }}
                    style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13 }}
                  >
                    Ambil Ulang
                  </button>
                  <button
                    onClick={konfirmasiKunjungan}
                    disabled={menyimpanKunjungan || !catatanKunjungan.trim()}
                    style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: (menyimpanKunjungan || !catatanKunjungan.trim()) ? "#E4E1DA" : "#E8A426", color: (menyimpanKunjungan || !catatanKunjungan.trim()) ? "#9CA0A6" : "#24272B", fontWeight: 700, fontSize: 13 }}
                  >
                    {menyimpanKunjungan ? "Menyimpan..." : "Konfirmasi Kunjungan"}
                  </button>
                </div>
              </div>
            ) : (
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
            )
          ) : null}
        </Card>
        )}
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

      {/* LAPORAN MINGGUAN - wajib diisi tiap minggu */}
      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "32px 0 12px" }}>Laporan Mingguan</h2>
      <Card style={{ marginBottom: 24 }}>
        {laporanMingguIni ? (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#D8E9E6", borderRadius: 10, padding: 12 }}>
            <Check size={16} color="#28685D" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 12.5, color: "#28685D", fontWeight: 700, margin: "0 0 4px" }}>Sudah diisi minggu ini.</p>
              <p style={{ fontSize: 12.5, color: "#24272B", margin: 0, whiteSpace: "pre-wrap" }}>{laporanMingguIni.hambatan}</p>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FBF0D9", borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <AlertCircle size={15} color="#8A6A1A" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: "#8A6A1A", margin: 0, lineHeight: 1.5 }}>
                <strong>Wajib diisi</strong> - ceritakan hambatan minggu ini (misal prospek yang tertahan/gagal beserta alasannya).
              </p>
            </div>
            <textarea
              value={hambatanMinggu}
              onChange={(e) => setHambatanMinggu(e.target.value)}
              placeholder="Contoh: Toko A masih pertimbangkan harga, Toko B gagal karena sudah pakai supplier lain..."
              rows={4}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, resize: "vertical", marginBottom: 12 }}
            />
            <button
              onClick={simpanLaporanMingguan}
              disabled={savingMinggu || !hambatanMinggu.trim()}
              style={{ padding: "11px 24px", borderRadius: 10, border: "none", background: (savingMinggu || !hambatanMinggu.trim()) ? "#E4E1DA" : "#E8A426", color: (savingMinggu || !hambatanMinggu.trim()) ? "#9CA0A6" : "#24272B", fontWeight: 700, fontSize: 13.5 }}
            >
              {savingMinggu ? "Menyimpan..." : "Kirim Laporan Mingguan"}
            </button>
          </div>
        )}
      </Card>

      {/* LAPORAN BULANAN - wajib diisi tiap bulan */}
      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>Laporan Bulanan</h2>
      <Card>
        {laporanBulanIni ? (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#D8E9E6", borderRadius: 10, padding: 12 }}>
            <Check size={16} color="#28685D" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 12.5, color: "#28685D", fontWeight: 700, margin: "0 0 4px" }}>Sudah diisi bulan ini.</p>
              <p style={{ fontSize: 12.5, color: "#24272B", margin: 0, whiteSpace: "pre-wrap" }}>{laporanBulanIni.hambatan}</p>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FBF0D9", borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <AlertCircle size={15} color="#8A6A1A" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: "#8A6A1A", margin: 0, lineHeight: 1.5 }}>
                <strong>Wajib diisi</strong> - rangkum hambatan bulan ini (prospek yang tertahan/gagal beserta alasannya).
              </p>
            </div>
            <textarea
              value={hambatanBulan}
              onChange={(e) => setHambatanBulan(e.target.value)}
              placeholder="Contoh: Bulan ini 3 prospek gagal deal karena masalah harga & jarak pengiriman..."
              rows={4}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, resize: "vertical", marginBottom: 12 }}
            />
            <button
              onClick={simpanLaporanBulanan}
              disabled={savingBulan || !hambatanBulan.trim()}
              style={{ padding: "11px 24px", borderRadius: 10, border: "none", background: (savingBulan || !hambatanBulan.trim()) ? "#E4E1DA" : "#E8A426", color: (savingBulan || !hambatanBulan.trim()) ? "#9CA0A6" : "#24272B", fontWeight: 700, fontSize: 13.5 }}
            >
              {savingBulan ? "Menyimpan..." : "Kirim Laporan Bulanan"}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================
// BIAYA OPERASIONAL (hitung laba kotor & kelola biaya operasional)
// ============================================================
function BiayaOperasionalPage({ token, role }) {
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

  // Admin Transaksi cuma boleh lihat TOTAL biaya operasional bulan itu,
  // tidak boleh lihat rincian per item ataupun tambah/ubah/hapus.
  // Catatan: admin_transaksi sekarang lihat tampilan LENGKAP yang sama
  // seperti Owner (termasuk daftar rincian) - tapi tombol Edit/Hapus
  // disembunyikan untuk role ini di bagian render tabel di bawah, karena
  // izin RLS admin_transaksi cuma SELECT + INSERT (belum UPDATE/DELETE).

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

      <div style={{ display: "grid", gridTemplateColumns: role === "admin_transaksi" ? "1fr" : "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
        {role !== "admin_transaksi" && (
          <Card>
            <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Laba Kotor</p>
            <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#24272B", margin: 0 }}>{rupiah(labaKotorBulanIni)}</p>
          </Card>
        )}
        <Card>
          <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Total Biaya Operasional</p>
          <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: "#C0392B", margin: 0 }}>{rupiah(totalBiayaBulanIni)}</p>
        </Card>
        {role !== "admin_transaksi" && (
          <Card>
            <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Laba Bersih</p>
            <p className="disp" style={{ fontSize: 22, fontWeight: 700, color: labaBersih >= 0 ? "#28685D" : "#C0392B", margin: 0 }}>{rupiah(labaBersih)}</p>
          </Card>
        )}
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
                  {role !== "admin_transaksi" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => startEdit(b)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 11, fontWeight: 600 }}>
                        Edit
                      </button>
                      <button onClick={() => hapusBiaya(b.id)} style={{ padding: "6px 10px", borderRadius: 7, border: "none", background: "none", color: "#C0392B", fontSize: 11, fontWeight: 700 }}>
                        Hapus
                      </button>
                    </div>
                  )}
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
  const [form, setForm] = useState({ gambarUrl: "", judul: "", deskripsi: "", aktif: false, judulBeranda: "", subjudulBeranda: "" });
  const [galeri, setGaleri] = useState([]); // popup - dipakai widget mengambang
  const [galeriBeranda, setGaleriBeranda] = useState([]); // beranda - tab tersendiri di Web App
  const [uploadingGaleri, setUploadingGaleri] = useState(false);
  const [uploadingGaleriBeranda, setUploadingGaleriBeranda] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rows, galeriRows, galeriBerandaRows] = await Promise.all([
        supabaseFetch(token, "campaign_banner?select=*&limit=1"),
        supabaseFetch(token, "campaign_banner_images?select=*&tipe=eq.popup&order=urutan.asc"),
        supabaseFetch(token, "campaign_banner_images?select=*&tipe=eq.beranda&order=urutan.asc"),
      ]);
      const b = rows[0];
      if (b) {
        setBannerId(b.id);
        setForm({ gambarUrl: b.gambar_url || "", judul: b.judul || "", deskripsi: b.deskripsi || "", aktif: b.aktif, judulBeranda: b.teks_judul_beranda || "", subjudulBeranda: b.teks_subjudul_beranda || "" });
      }
      setGaleri(galeriRows);
      setGaleriBeranda(galeriBerandaRows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function uploadFotoGaleri(file, tipe) {
    const setterUploading = tipe === "beranda" ? setUploadingGaleriBeranda : setUploadingGaleri;
    const setterGaleri = tipe === "beranda" ? setGaleriBeranda : setGaleri;
    const jumlahSaatIni = tipe === "beranda" ? galeriBeranda.length : galeri.length;
    setterUploading(true);
    try {
      // Galeri Beranda dikecilkan lebih agresif dari biasanya (900px,
      // kualitas 65%) - foto ini ditampilkan berurutan/scroll di halaman
      // pertama yang dibuka toko, jadi ukuran file kecil = lebih cepat
      // tampil. Galeri Popup tetap pakai kualitas default seperti biasa.
      const compressed = tipe === "beranda" ? await compressImage(file, 640, 0.45) : await compressImage(file);
      const { ext, contentType } = infoFileTerkompresi(compressed, file);
      const filePath = `banner-galeri-${tipe}-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/produk-gambar/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": contentType },
        body: compressed,
      });
      if (!res.ok) throw new Error(await res.text());
      const url = `${SUPABASE_URL}/storage/v1/object/public/produk-gambar/${filePath}`;
      const [inserted] = await supabaseFetch(token, "campaign_banner_images", {
        method: "POST",
        body: JSON.stringify({ url, urutan: jumlahSaatIni, tipe }),
      });
      setterGaleri((prev) => [...prev, inserted]);
    } catch (e) {
      alert("Gagal upload foto: " + e.message);
    }
    setterUploading(false);
  }

  async function hapusFotoGaleri(id, tipe) {
    const setterGaleri = tipe === "beranda" ? setGaleriBeranda : setGaleri;
    try {
      await supabaseFetch(token, `campaign_banner_images?id=eq.${id}`, { method: "DELETE" });
      setterGaleri((prev) => prev.filter((g) => g.id !== id));
    } catch (e) {
      alert("Gagal hapus foto: " + e.message);
    }
  }

  async function uploadGambar(file) {
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const { ext, contentType } = infoFileTerkompresi(compressed, file);
      const filePath = `banner-promo-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/produk-gambar/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": contentType },
        body: compressed,
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
        teks_judul_beranda: form.judulBeranda || null, teks_subjudul_beranda: form.subjudulBeranda || null,
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
          <label style={labelStyle}>Galeri Foto Popup (tampil di widget mengambang, full-width tanpa jarak antar foto)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {galeri.map((img) => (
              <div key={img.id} style={{ position: "relative", width: 60, height: 60 }}>
                <div style={{ width: 60, height: 60, borderRadius: 8, background: `url(${img.url}) center/cover` }} />
                <button
                  onClick={() => hapusFotoGaleri(img.id, "popup")}
                  style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#C0392B", border: "2px solid #fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            <label style={{ width: 60, height: 60, borderRadius: 8, border: "1.5px dashed #E8A426", background: "#FFFBF0", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {uploadingGaleri ? <Loader2 size={16} color="#8A6A1A" /> : <PackagePlus size={18} color="#8A6A1A" />}
              <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingGaleri} onChange={(e) => { if (e.target.files[0]) uploadFotoGaleri(e.target.files[0], "popup"); }} />
            </label>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Judul Halaman Beranda</label>
          <input value={form.judulBeranda} onChange={(e) => setForm({ ...form, judulBeranda: e.target.value })} placeholder="Promo & Program" style={fieldStyle} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Subjudul Halaman Beranda</label>
          <input value={form.subjudulBeranda} onChange={(e) => setForm({ ...form, subjudulBeranda: e.target.value })} placeholder="Info promo terbaru dari kami" style={fieldStyle} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Galeri Foto Beranda (tampil di tab "Beranda" Web App - terpisah dari popup di atas)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {galeriBeranda.map((img) => (
              <div key={img.id} style={{ position: "relative", width: 60, height: 60 }}>
                <div style={{ width: 60, height: 60, borderRadius: 8, background: `url(${img.url}) center/cover` }} />
                <button
                  onClick={() => hapusFotoGaleri(img.id, "beranda")}
                  style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#C0392B", border: "2px solid #fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            <label style={{ width: 60, height: 60, borderRadius: 8, border: "1.5px dashed #28685D", background: "#F0F8F6", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {uploadingGaleriBeranda ? <Loader2 size={16} color="#28685D" /> : <PackagePlus size={18} color="#28685D" />}
              <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingGaleriBeranda} onChange={(e) => { if (e.target.files[0]) uploadFotoGaleri(e.target.files[0], "beranda"); }} />
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
const DAFTAR_BANK_VA = ["BNI", "MANDIRI", "BRI"];

function SaldoVaPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clients, setClients] = useState([]);
  const [vaList, setVaList] = useState([]);
  const [saldoList, setSaldoList] = useState([]);
  const [creatingVaFor, setCreatingVaFor] = useState(null); // `${clientId}-${bank}`
  const [search, setSearch] = useState("");
  const [isiSaldoModal, setIsiSaldoModal] = useState(null); // client yang lagi diisi saldonya
  const [jumlahIsi, setJumlahIsi] = useState("");
  const [keteranganIsi, setKeteranganIsi] = useState("");
  const [savingIsi, setSavingIsi] = useState(false);

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

  // Isi/koreksi saldo manual - dipakai selagi Xendit VA belum full verified,
  // Owner terima transfer manual lalu catat ke saldo toko di sini. Bisa
  // juga isi angka NEGATIF untuk koreksi/kurangi saldo kalau perlu.
  async function simpanIsiSaldo() {
    const jumlah = Number(jumlahIsi);
    if (!jumlah) {
      alert("Isi dulu jumlahnya.");
      return;
    }
    setSavingIsi(true);
    try {
      await supabaseFetch(token, "saldo_ledger", {
        method: "POST",
        body: JSON.stringify({
          client_id: isiSaldoModal.id,
          jenis: "adjustment_manual",
          jumlah,
          keterangan: keteranganIsi.trim() || (jumlah > 0 ? "Isi saldo manual oleh Owner" : "Koreksi/kurangi saldo manual oleh Owner"),
        }),
      });
      setIsiSaldoModal(null);
      setJumlahIsi("");
      setKeteranganIsi("");
      await load();
    } catch (e) {
      alert("Gagal simpan: " + e.message);
    }
    setSavingIsi(false);
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
                  <p style={{ fontSize: 16, fontWeight: 700, color: saldo > 0 ? "#28685D" : "#9CA0A6", margin: "0 0 6px" }}>{rupiah(saldo)}</p>
                  <button
                    onClick={() => setIsiSaldoModal(c)}
                    style={{ padding: "5px 10px", borderRadius: 7, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 11, fontWeight: 700 }}
                  >
                    Isi Saldo
                  </button>
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

      {isiSaldoModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, padding: 26 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>Isi Saldo Manual</p>
            <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "0 0 4px" }}>{isiSaldoModal.nama} ({isiSaldoModal.kode})</p>
            <p style={{ fontSize: 12, color: "#9CA0A6", margin: "0 0 18px" }}>
              Saldo saat ini: <strong>{rupiah(saldoToko(isiSaldoModal.id))}</strong>
            </p>

            <label style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Jumlah</label>
            <input
              type="number" value={jumlahIsi} onChange={(e) => setJumlahIsi(e.target.value)}
              placeholder="Isi angka positif untuk tambah, negatif untuk kurangi"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 14, marginBottom: 12 }}
            />

            <label style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Keterangan (opsional)</label>
            <input
              value={keteranganIsi} onChange={(e) => setKeteranganIsi(e.target.value)}
              placeholder="Misal: Transfer manual BCA 5 Agustus"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, marginBottom: 20 }}
            />

            <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 16px", lineHeight: 1.5 }}>
              Kalau toko punya order transfer yang sedang menunggu pembayaran dan saldo baru ini membuatnya cukup, order tersebut akan otomatis lunas dan lanjut ke Menunggu Pengiriman.
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setIsiSaldoModal(null); setJumlahIsi(""); setKeteranganIsi(""); }}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}
              >
                Batal
              </button>
              <button
                onClick={simpanIsiSaldo} disabled={savingIsi}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "#24272B", color: "#fff", fontWeight: 700, fontSize: 13.5 }}
              >
                {savingIsi ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
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
      const rows = await supabaseFetch(token, "clients?select=id,kode,nama,alamat,telp,email,provinsi,kota,jenis_usaha,nama_owner,tanggal_lahir,jenis_pembayaran,foto_toko_url,foto_ktp_url,foto_toko_url_pending,foto_ktp_url_pending,status_verifikasi,alasan_verifikasi_ditolak,status_perubahan_verifikasi,alasan_perubahan_ditolak&status_verifikasi=neq.belum_upload&order=nama.asc");
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
      if (c.foto_ktp_url_pending && !ktpSignedUrls[`${c.id}_pending`]) {
        getSignedKtpUrl(c.foto_ktp_url_pending).then((url) => {
          if (url) setKtpSignedUrls((prev) => ({ ...prev, [`${c.id}_pending`]: url }));
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

  // Approve PENGAJUAN PERUBAHAN - pindahkan foto pending jadi foto utama
  // (yang lama otomatis "diganti"/dianggap jadi arsip lama), kosongkan
  // kolom pending, status utama tetap "terverifikasi".
  async function approvePerubahan(client) {
    setProcessingId(client.id);
    try {
      await supabaseFetch(token, `clients?id=eq.${client.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          foto_toko_url: client.foto_toko_url_pending,
          foto_ktp_url: client.foto_ktp_url_pending,
          foto_toko_url_pending: null,
          foto_ktp_url_pending: null,
          status_perubahan_verifikasi: null,
          alasan_perubahan_ditolak: null,
        }),
      });
      setClients((prev) => prev.map((c) => (c.id === client.id ? {
        ...c,
        foto_toko_url: c.foto_toko_url_pending, foto_ktp_url: c.foto_ktp_url_pending,
        foto_toko_url_pending: null, foto_ktp_url_pending: null,
        status_perubahan_verifikasi: null, alasan_perubahan_ditolak: null,
      } : c)));
    } catch (e) { alert("Gagal approve perubahan: " + e.message); }
    setProcessingId(null);
  }

  // Tolak PENGAJUAN PERUBAHAN - foto lama (utama) TETAP tidak berubah,
  // cuma kolom pending yang dibersihkan + catat alasan penolakan.
  async function tolakPerubahan(client) {
    if (!rejectReason.trim()) {
      alert("Isi dulu alasan penolakannya.");
      return;
    }
    setProcessingId(client.id);
    try {
      await supabaseFetch(token, `clients?id=eq.${client.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status_perubahan_verifikasi: "ditolak", alasan_perubahan_ditolak: rejectReason.trim() }),
      });
      setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, status_perubahan_verifikasi: "ditolak", alasan_perubahan_ditolak: rejectReason.trim() } : c)));
      setRejectingId(null);
      setRejectReason("");
    } catch (e) { alert("Gagal tolak perubahan: " + e.message); }
    setProcessingId(null);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const filtered = filter === "perubahan"
    ? clients.filter((c) => c.status_perubahan_verifikasi === "menunggu_review")
    : clients.filter((c) => filter === "semua" || c.status_verifikasi === filter);
  const jumlahPerubahan = clients.filter((c) => c.status_perubahan_verifikasi === "menunggu_review").length;
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
          { key: "perubahan", label: `Perubahan${jumlahPerubahan > 0 ? ` (${jumlahPerubahan})` : ""}` },
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
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span>
                  {filter !== "perubahan" && c.status_perubahan_verifikasi === "menunggu_review" && (
                    <span style={{ padding: "3px 8px", borderRadius: 999, fontSize: 9.5, fontWeight: 700, background: "#FBF0D9", color: "#8A6A1A" }}>Ada Pengajuan Perubahan</span>
                  )}
                </div>
              </div>

              <div style={{ background: "#F7F5F1", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 5 }}>
                  <MapPin size={13} color="#9CA0A6" style={{ marginTop: 2, flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: "#24272B", margin: 0, lineHeight: 1.4 }}>{c.alamat || "-"}{c.kota ? `, ${c.kota}` : ""}{c.provinsi ? `, ${c.provinsi}` : ""}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <Phone size={13} color="#9CA0A6" style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: "#24272B", margin: 0 }}>{c.telp || "-"}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <MessageCircle size={13} color="#9CA0A6" style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: "#24272B", margin: 0 }}>{c.email || "-"}</p>
                </div>
                {c.nama_owner && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                    <User size={13} color="#9CA0A6" style={{ flexShrink: 0 }} />
                    <p style={{ fontSize: 12, color: "#24272B", margin: 0 }}>Owner: {c.nama_owner}{c.tanggal_lahir ? ` (lahir ${new Date(c.tanggal_lahir).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })})` : ""}</p>
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                  {c.jenis_usaha && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: "#fff", color: "#6B6F75" }}>{c.jenis_usaha}</span>
                  )}
                  {c.jenis_pembayaran && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: "#fff", color: "#6B6F75" }}>{c.jenis_pembayaran}</span>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 10.5, color: "#9CA0A6", margin: "0 0 4px", fontWeight: 700 }}>
                    FOTO TOKO{filter === "perubahan" ? " (BARU)" : ""}
                  </p>
                  {(filter === "perubahan" ? c.foto_toko_url_pending : c.foto_toko_url) ? (
                    <img
                      src={filter === "perubahan" ? c.foto_toko_url_pending : c.foto_toko_url} alt="Foto Toko"
                      onClick={() => setLightboxUrl(filter === "perubahan" ? c.foto_toko_url_pending : c.foto_toko_url)}
                      style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8, cursor: "pointer" }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: 120, borderRadius: 8, background: "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#9CA0A6" }}>Belum ada</div>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: 10.5, color: "#9CA0A6", margin: "0 0 4px", fontWeight: 700 }}>
                    FOTO KTP{filter === "perubahan" ? " (BARU)" : ""}
                  </p>
                  {(filter === "perubahan" ? c.foto_ktp_url_pending : c.foto_ktp_url) ? (
                    ktpSignedUrls[filter === "perubahan" ? `${c.id}_pending` : c.id] ? (
                      <img
                        src={ktpSignedUrls[filter === "perubahan" ? `${c.id}_pending` : c.id]} alt="Foto KTP"
                        onClick={() => setLightboxUrl(ktpSignedUrls[filter === "perubahan" ? `${c.id}_pending` : c.id])}
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

              {(filter === "perubahan" ? c.status_perubahan_verifikasi === "menunggu_review" : c.status_verifikasi === "menunggu_review") && (
                rejectingId === c.id ? (
                  <div>
                    <textarea
                      value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Alasan penolakan..."
                      rows={2}
                      style={{ width: "100%", padding: 9, borderRadius: 8, border: "1.5px solid #E4E1DA", fontSize: 12.5, marginBottom: 8, resize: "vertical" }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => (filter === "perubahan" ? tolakPerubahan(c) : tolak(c))} disabled={processingId === c.id} style={{ flex: 1, padding: 9, borderRadius: 8, border: "none", background: "#C0392B", color: "#fff", fontSize: 12, fontWeight: 700 }}>
                        Kirim Penolakan
                      </button>
                      <button onClick={() => { setRejectingId(null); setRejectReason(""); }} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontSize: 12, fontWeight: 600 }}>
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => (filter === "perubahan" ? approvePerubahan(c) : approve(c))} disabled={processingId === c.id} style={{ flex: 1, padding: 10, borderRadius: 9, border: "none", background: "#28685D", color: "#fff", fontSize: 12.5, fontWeight: 700 }}>
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

// ============================================================
// KELOLA AKUN STAFF - buat akun baru & reset password
// (Sales, Admin Transaksi, Admin Keuangan, Kurir)
// ============================================================
function AkunStaffPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nama: "", email: "", password: "", role: "sales", kodeSales: "", alamat: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [resetTargetId, setResetTargetId] = useState(null);
  const [passwordBaru, setPasswordBaru] = useState("");
  const [resetting, setResetting] = useState(false);

  const ROLE_LABEL = {
    owner: "Owner", admin_transaksi: "Admin Transaksi", admin_keuangan: "Admin Keuangan",
    sales: "Sales", kurir: "Kurir", staff_gudang: "Staff Gudang",
  };

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, "profiles?select=id,nama,email,role,sales(kode,nama)&role=neq.owner&order=role.asc");

      // Ambil waktu login TERAKHIR tiap staff, buat pengingat "akun tidak
      // aktif" - bukan auto-nonaktifkan, cuma peringatan buat Owner.
      const loginRows = await supabaseFetch(token, "log_aktivitas?select=user_id,created_at&aksi=eq.login&order=created_at.desc&limit=2000");
      const loginTerakhirMap = {};
      (loginRows || []).forEach((l) => {
        if (!loginTerakhirMap[l.user_id]) loginTerakhirMap[l.user_id] = l.created_at; // yang pertama ketemu = paling baru (sudah diurutkan desc)
      });
      const rowsWithLogin = rows.map((s) => ({ ...s, loginTerakhir: loginTerakhirMap[s.id] || null }));
      setStaffList(rowsWithLogin);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function hariSejakLogin(loginTerakhir) {
    if (!loginTerakhir) return null;
    return Math.floor((new Date() - new Date(loginTerakhir)) / (1000 * 60 * 60 * 24));
  }

  async function panggilFungsi(body) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/kelola-akun-staff`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Terjadi kesalahan.");
    return data;
  }

  async function buatAkun() {
    setFormError("");
    if (!form.nama.trim() || !form.email.trim() || !form.password.trim()) {
      setFormError("Nama, email, dan password wajib diisi.");
      return;
    }
    if (form.password.length < 6) {
      setFormError("Password minimal 6 karakter.");
      return;
    }
    if (form.role !== "sales" && !form.alamat.trim()) {
      setFormError("Alamat wajib diisi untuk role ini.");
      return;
    }
    setSaving(true);
    try {
      await panggilFungsi({
        action: "create", email: form.email.trim(), password: form.password,
        nama: form.nama.trim(), role: form.role, kodeSales: form.kodeSales.trim() || null,
        alamat: form.role !== "sales" ? form.alamat.trim() : null,
      });
      setShowForm(false);
      setForm({ nama: "", email: "", password: "", role: "sales", kodeSales: "", alamat: "" });
      load();
    } catch (e) {
      setFormError(e.message);
    }
    setSaving(false);
  }

  async function resetPassword(userId) {
    if (!passwordBaru.trim() || passwordBaru.length < 6) {
      alert("Password baru minimal 6 karakter.");
      return;
    }
    setResetting(true);
    try {
      await panggilFungsi({ action: "reset_password", user_id: userId, password_baru: passwordBaru });
      alert("Password berhasil diubah.");
      setResetTargetId(null);
      setPasswordBaru("");
    } catch (e) {
      alert("Gagal ubah password: " + e.message);
    }
    setResetting(false);
  }

  async function hapusAkun(userId, nama) {
    if (!confirm(`Yakin hapus akun "${nama}"? Akun ini tidak akan bisa login lagi.`)) return;
    try {
      await panggilFungsi({ action: "delete", user_id: userId });
      setStaffList((prev) => prev.filter((s) => s.id !== userId));
    } catch (e) {
      alert("Gagal hapus akun: " + e.message);
    }
  }

  const fieldStyle = { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, outline: "none" };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" };

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <PageHeader title="Kelola Akun Staff" subtitle="Buat akun baru & reset password untuk Sales, Admin, dan Kurir" />
        <button
          onClick={() => setShowForm(true)}
          style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 4 }}
        >
          + Tambah Akun
        </button>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Nama", "Email", "Role", "Kode Sales", "Login Terakhir", ""].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staffList.map((s) => (
              <tr key={s.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                <td style={{ padding: "12px 14px", fontWeight: 600 }}>{s.nama}</td>
                <td style={{ padding: "12px 14px", color: "#6B6F75" }}>{s.email || "-"}</td>
                <td style={{ padding: "12px 14px" }}>{ROLE_LABEL[s.role] || s.role}</td>
                <td style={{ padding: "12px 14px" }}>{s.sales?.kode || "-"}</td>
                <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                  {(() => {
                    const hari = hariSejakLogin(s.loginTerakhir);
                    const tidakAktif = hari === null || hari >= 60;
                    return (
                      <div>
                        <p style={{ margin: 0, color: "#6B6F75", fontSize: 12 }}>
                          {s.loginTerakhir ? new Date(s.loginTerakhir).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "Belum pernah login"}
                        </p>
                        {tidakAktif && (
                          <span style={{ display: "inline-block", marginTop: 3, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#FBEAEA", color: "#C0392B" }}>
                            {hari === null ? "Pertimbangkan nonaktifkan" : `${hari} hari tidak aktif`}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </td>
                <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                  <button
                    onClick={() => { setResetTargetId(s.id); setPasswordBaru(""); }}
                    style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 11.5, fontWeight: 600, marginRight: 6 }}
                  >
                    Reset Password
                  </button>
                  <button
                    onClick={() => hapusAkun(s.id, s.nama)}
                    style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #F0CFC7", background: "#fff", color: "#C0392B", fontSize: 11.5, fontWeight: 600 }}
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {staffList.length === 0 && <EmptyState text="Belum ada akun staff." />}
      </Card>

      {/* MODAL TAMBAH AKUN */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, padding: 26 }}>
            <h2 className="disp" style={{ fontSize: 19, fontWeight: 700, color: "#24272B", margin: "0 0 20px" }}>Tambah Akun Staff</h2>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Nama</label>
              <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} style={fieldStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Email (buat login)</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={fieldStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Password Awal</label>
              <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Minimal 6 karakter" style={fieldStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={fieldStyle}>
                <option value="sales">Sales</option>
                <option value="admin_transaksi">Admin Transaksi</option>
                <option value="admin_keuangan">Admin Keuangan</option>
                <option value="kurir">Kurir</option>
                <option value="staff_gudang">Staff Gudang</option>
              </select>
            </div>
            {form.role === "sales" ? (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Kode Sales (opsional, misal S004)</label>
                <input value={form.kodeSales} onChange={(e) => setForm({ ...form, kodeSales: e.target.value })} style={fieldStyle} />
                <p style={{ fontSize: 11.5, color: "#9CA0A6", marginTop: 6 }}>Alamat tidak perlu diisi di sini - sales akan mengisi sendiri lewat "Profil Saya" setelah login pertama kali.</p>
              </div>
            ) : (
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Alamat</label>
                <textarea value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} rows={3} style={{ ...fieldStyle, resize: "vertical" }} />
              </div>
            )}

            {formError && <p style={{ fontSize: 12, color: "#C0392B", margin: "0 0 14px" }}>{formError}</p>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
                Batal
              </button>
              <button onClick={buatAkun} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: saving ? "#E4E1DA" : "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}>
                {saving ? "Membuat..." : "Buat Akun"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RESET PASSWORD */}
      {resetTargetId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 380, padding: 24 }}>
            <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 14px" }}>Reset Password</h2>
            <input
              type="text" value={passwordBaru} onChange={(e) => setPasswordBaru(e.target.value)}
              placeholder="Password baru (min. 6 karakter)"
              style={{ ...fieldStyle, marginBottom: 14 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setResetTargetId(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13 }}>
                Batal
              </button>
              <button onClick={() => resetPassword(resetTargetId)} disabled={resetting} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: resetting ? "#E4E1DA" : "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13 }}>
                {resetting ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// OUTBOUND - scan barcode nomor pesanan untuk verifikasi
// (kompatibel dengan alat scanner barcode fisik USB/Bluetooth,
// yang bekerja seperti keyboard - "mengetik" hasil scan + Enter.
// Juga bisa diketik manual kalau tidak ada alat scanner.)
// ============================================================
// Loader library html5-qrcode dari CDN - buat scan barcode pakai kamera HP
let html5QrcodeLoadPromise = null;
// Bunyi "beep" pendek buat feedback tiap kali scan berhasil - dipakai di
// mana saja yang ada fitur scan barcode (bukan cuma satu tempat).
// PENTING: pakai SATU AudioContext yang dipakai ULANG terus-menerus,
// jangan buat baru tiap panggil - browser biasanya batasi jumlah
// AudioContext yang bisa dibuat berturut-turut, jadi kalau selalu bikin
// baru, cuma yang pertama kali yang benar-benar bunyi.
let audioCtxBeepScan = null;
function mainkanBeepScan() {
  try {
    if (!audioCtxBeepScan) {
      audioCtxBeepScan = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtxBeepScan;
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 1400;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  } catch (e) { /* browser tidak izinkan audio otomatis - abaikan */ }
}

function loadHtml5Qrcode() {
  if (window.Html5Qrcode) return Promise.resolve();
  if (html5QrcodeLoadPromise) return html5QrcodeLoadPromise;
  html5QrcodeLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return html5QrcodeLoadPromise;
}

function OutboundPage({ token }) {
  const [inputScan, setInputScan] = useState("");
  const [order, setOrder] = useState(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [riwayat, setRiwayat] = useState([]);
  const inputRef = useRef(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const html5QrRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    loadRiwayat();
  }, []);

  async function mulaiScanKamera() {
    setCameraError("");
    setShowCamera(true);
    try {
      await loadHtml5Qrcode();
      // Kasih waktu sedikit supaya div #reader-kamera sempat ter-render dulu
      setTimeout(async () => {
        try {
          const html5Qr = new window.Html5Qrcode("reader-kamera");
          html5QrRef.current = html5Qr;
          await html5Qr.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 300, height: 150 }, formatsToSupport: [window.Html5QrcodeSupportedFormats.CODE_128, window.Html5QrcodeSupportedFormats.QR_CODE] },
            (decodedText) => {
              setInputScan(decodedText);
              cariPesanan(decodedText);
              tutupKamera();
            },
            () => { /* frame tanpa barcode terdeteksi - normal, diamkan */ }
          );
        } catch (e) {
          setCameraError("Gagal buka kamera: " + e.message + " (pastikan izinkan akses kamera di browser)");
        }
      }, 200);
    } catch (e) {
      setCameraError("Gagal muat library scanner: " + e.message);
    }
  }

  function tutupKamera() {
    if (html5QrRef.current) {
      html5QrRef.current.stop().catch(() => {}).finally(() => {
        html5QrRef.current = null;
      });
    }
    setShowCamera(false);
  }

  useEffect(() => {
    // Pastikan kamera dimatikan kalau komponen ini ditutup/pindah halaman
    return () => {
      if (html5QrRef.current) html5QrRef.current.stop().catch(() => {});
    };
  }, []);

  async function loadRiwayat() {
    try {
      const rows = await supabaseFetch(token, "orders?select=no_nota,outbound_verified_at,clients(nama)&outbound_verified_at=not.is.null&order=outbound_verified_at.desc&limit=10");
      setRiwayat(rows);
    } catch (e) { /* diamkan, tidak kritis */ }
  }

  async function cariPesanan(kode) {
    if (!kode.trim()) return;
    setSearching(true);
    setError("");
    setOrder(null);
    try {
      const rows = await supabaseFetch(token, `orders?select=*,clients(nama,kode,alamat),order_items(qty,products(nama,satuan))&no_nota=eq.${kode.trim()}`);
      if (!rows || rows.length === 0) {
        setError(`Pesanan dengan nomor "${kode.trim()}" tidak ditemukan.`);
      } else {
        setOrder(rows[0]);
      }
    } catch (e) {
      setError("Gagal cari pesanan: " + e.message);
    }
    setSearching(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") {
      cariPesanan(inputScan);
    }
  }

  async function konfirmasiOutbound() {
    setConfirming(true);
    try {
      const now = new Date().toISOString();
      // Konfirmasi scan outbound INI yang jadi pemicu order pindah dari
      // "Pesanan" ke "Siap Dikirim" (BUKAN langsung ke Proses Pengiriman
      // lagi) - kurir/staff masih perlu mulai kirim dari menu Siap Dikirim.
      await supabaseFetch(token, `orders?id=eq.${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ outbound_verified_at: now, status: "siap_dikirim" }),
      });
      setOrder((prev) => ({ ...prev, outbound_verified_at: now, status: "siap_dikirim" }));
      loadRiwayat();
    } catch (e) {
      alert("Gagal konfirmasi: " + e.message);
    }
    setConfirming(false);
  }

  function resetScan() {
    setInputScan("");
    setOrder(null);
    setError("");
    inputRef.current?.focus();
  }

  const jumlahBarang = order ? (order.order_items || []).reduce((sum, it) => sum + Number(it.qty || 0), 0) : 0;

  return (
    <div>
      <PageHeader title="Outbound" subtitle="Scan atau ketik nomor pesanan untuk verifikasi barang keluar" />

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F7F5F1", borderRadius: 10, padding: "10px 14px" }}>
          <ScanLine size={20} color="#8A6A1A" />
          <input
            ref={inputRef}
            value={inputScan}
            onChange={(e) => setInputScan(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scan barcode atau ketik nomor pesanan, lalu Enter..."
            style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 15, fontWeight: 600, color: "#24272B" }}
          />
          {searching && <span style={{ fontSize: 12, color: "#9CA0A6" }}>Mencari...</span>}
        </div>
        <button
          onClick={mulaiScanKamera}
          style={{ width: "100%", marginTop: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}
        >
          <Camera size={16} /> Scan Pakai Kamera HP
        </button>
        <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "8px 0 0" }}>
          Kompatibel dengan alat scanner barcode USB/Bluetooth biasa (bekerja seperti keyboard), atau pakai kamera HP langsung lewat tombol di atas.
        </p>
      </Card>

      {showCamera && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Arahkan kamera ke barcode</p>
          <div id="reader-kamera" style={{ width: "100%", maxWidth: 400, borderRadius: 12, overflow: "hidden" }} />
          {cameraError && <p style={{ color: "#F5A9A0", fontSize: 12.5, marginTop: 14, textAlign: "center" }}>{cameraError}</p>}
          <button
            onClick={tutupKamera}
            style={{ marginTop: 20, padding: "12px 24px", borderRadius: 10, border: "1.5px solid #fff", background: "none", color: "#fff", fontWeight: 700, fontSize: 13.5 }}
          >
            Tutup Kamera
          </button>
        </div>
      )}

      {error && (
        <div style={{ background: "#FBEAEA", borderRadius: 12, padding: 14, marginBottom: 20 }}>
          <p style={{ fontSize: 13, color: "#C0392B", margin: 0, fontWeight: 600 }}>{error}</p>
        </div>
      )}

      {order && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <p className="disp" style={{ fontSize: 19, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{order.no_nota}</p>
              <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>{order.clients?.nama} ({order.clients?.kode})</p>
              <p style={{ fontSize: 12, color: "#9CA0A6", margin: "4px 0 0" }}>{order.clients?.alamat}</p>
            </div>
            {order.metode_bayar === "cod" && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 999, background: "#FBF0D9", color: "#8A6A1A" }}>COD</span>
            )}
          </div>

          <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 8px" }}>
            Rincian Barang ({jumlahBarang} total)
          </p>
          <div style={{ borderTop: "1px solid #EDEAE3", marginBottom: 16 }}>
            {(order.order_items || []).map((it, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #EDEAE3", fontSize: 13 }}>
                <span style={{ color: "#24272B" }}>{it.products?.nama}</span>
                <span style={{ color: "#6B6F75", fontWeight: 700 }}>{it.qty} {it.products?.satuan}</span>
              </div>
            ))}
          </div>

          {order.outbound_verified_at ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#D8E9E6", borderRadius: 10, padding: 12 }}>
              <Check size={18} color="#28685D" />
              <p style={{ fontSize: 13, color: "#28685D", fontWeight: 700, margin: 0 }}>
                Sudah diverifikasi outbound & dipindahkan ke Siap Dikirim - {new Date(order.outbound_verified_at).toLocaleString("id-ID")}
              </p>
            </div>
          ) : (
            <button
              onClick={konfirmasiOutbound}
              disabled={confirming}
              style={{ width: "100%", padding: 13, borderRadius: 10, border: "none", background: confirming ? "#E4E1DA" : "#28685D", color: "#fff", fontWeight: 700, fontSize: 14 }}
            >
              {confirming ? "Menyimpan..." : "Konfirmasi Verifikasi Outbound"}
            </button>
          )}

          <button onClick={resetScan} style={{ width: "100%", marginTop: 10, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13 }}>
            Scan Pesanan Lain
          </button>
        </Card>
      )}

      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "8px 0 12px" }}>Riwayat Verifikasi Terbaru</h2>
      {riwayat.length === 0 ? (
        <EmptyState text="Belum ada pesanan yang diverifikasi outbound." />
      ) : (
        riwayat.map((r, i) => (
          <Card key={i} style={{ marginBottom: 8, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: 0 }}>{r.no_nota}</p>
                <p style={{ fontSize: 12, color: "#6B6F75", margin: "2px 0 0" }}>{r.clients?.nama}</p>
              </div>
              <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: 0 }}>{new Date(r.outbound_verified_at).toLocaleString("id-ID")}</p>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

// ============================================================
// ABSEN SALES - check-in harian, kecuali Minggu & tanggal merah
// ============================================================
function AbsenSalesPage({ token, profile }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sudahAbsenHariIni, setSudahAbsenHariIni] = useState(false);
  const [isLibur, setIsLibur] = useState(false);
  const [keteranganLibur, setKeteranganLibur] = useState("");
  const [riwayat, setRiwayat] = useState([]);
  const [handledClients, setHandledClients] = useState([]);
  const [clientIdSudahKunjunganHariIni, setClientIdSudahKunjunganHariIni] = useState([]);

  const [mode, setMode] = useState(null); // null | "pilih_toko" | "checkin"
  const [selectedClient, setSelectedClient] = useState(null);
  const [namaTokoManual, setNamaTokoManual] = useState("");
  const [alamatTokoManual, setAlamatTokoManual] = useState("");
  const [catatanAbsen, setCatatanAbsen] = useState("");
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [coords, setCoords] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const isMinggu = now.getDay() === 0;

  async function load() {
    // Menu ini KHUSUS buat akun Sales (butuh profile.sales_id buat tahu
    // toko mana yang ditangani). Kalau diakses akun lain (misal Owner yang
    // menambahkan menu ini lewat "Atur Urutan Menu"), sales_id-nya kosong -
    // hentikan di sini, jangan sampai query jalan dengan nilai kosong dan
    // bikin error mentah dari database.
    if (!profile?.sales_id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [absenHariIni, liburRows, riwayatRows, clients, kunjunganHariIni] = await Promise.all([
        supabaseFetch(token, `absen_sales?select=id&sales_id=eq.${profile.sales_id}&tanggal=eq.${todayStr}`),
        supabaseFetch(token, `hari_libur?select=keterangan&tanggal=eq.${todayStr}`),
        supabaseFetch(token, `absen_sales?select=tanggal,waktu_absen,foto_url,nama_toko_manual,clients(nama)&sales_id=eq.${profile.sales_id}&order=tanggal.desc&limit=14`),
        supabaseFetch(token, `clients?select=id,nama,kode&sales_id=eq.${profile.sales_id}&status=eq.aktif&order=nama.asc`),
        supabaseFetch(token, `kunjungan_sales?select=client_id&sales_id=eq.${profile.sales_id}&created_at=gte.${todayStr}T00:00:00&created_at=lte.${todayStr}T23:59:59`),
      ]);
      setSudahAbsenHariIni(absenHariIni.length > 0);
      setIsLibur(liburRows.length > 0);
      setKeteranganLibur(liburRows[0]?.keterangan || "");
      setRiwayat(riwayatRows);
      setHandledClients(clients);
      setClientIdSudahKunjunganHariIni(kunjunganHariIni.map((k) => k.client_id));
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Tampilkan pesan jelas kalau akun ini bukan akun Sales (tidak punya
  // sales_id) - taruh SETELAH semua hook dipanggil, supaya urutan hook
  // tetap konsisten di setiap render (aturan Hooks React).
  if (!profile?.sales_id) {
    return (
      <div>
        <PageHeader title="Absen" subtitle="Menu ini khusus untuk akun Sales" />
        <EmptyState text="Menu ini cuma bisa dipakai oleh akun dengan role Sales (butuh data toko yang ditangani). Akun Anda saat ini tidak punya data Sales terkait." />
      </div>
    );
  }

  function mulaiAbsen(client) {
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

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  // Ambil foto dari kamera, tempel watermark koordinat+waktu+nama toko -
  // persis pola yang sama seperti Laporan Kunjungan, supaya konsisten.
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

      const mapSize = Math.round(Math.min(img.width, img.height) * 0.32);
      try {
        const mapUrl = `https://staticmap.openstreetmap.de/staticmap.php?center=${coords.lat},${coords.lng}&zoom=16&size=${mapSize}x${mapSize}&maptype=mapnik`;
        const mapRes = await fetch(mapUrl, { mode: "cors" });
        if (!mapRes.ok) throw new Error("gagal ambil peta");
        const mapBlob = await mapRes.blob();
        const mapImg = await loadImageFromFile(mapBlob);
        const mx = img.width - mapSize - 14;
        const my = 14;
        ctx.fillStyle = "#fff";
        ctx.fillRect(mx - 4, my - 4, mapSize + 8, mapSize + 8);
        ctx.drawImage(mapImg, mx, my, mapSize, mapSize);
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

      const barHeight = Math.max(90, img.height * 0.12);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(0, img.height - barHeight, img.width, barHeight);

      const pinSize = barHeight * 0.55;
      const pinCenterX = 14 + pinSize / 2;
      const pinCenterY = img.height - barHeight / 2;
      ctx.save();
      ctx.translate(pinCenterX, pinCenterY - pinSize * 0.15);
      ctx.beginPath();
      ctx.arc(0, 0, pinSize / 2, Math.PI * 1.15, Math.PI * 1.85);
      ctx.lineTo(0, pinSize * 0.75);
      ctx.closePath();
      ctx.fillStyle = "#E4453A";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -pinSize * 0.05, pinSize * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.restore();

      const textX = 14 + pinSize + 14;
      ctx.fillStyle = "#fff";
      const fontSize = Math.max(14, Math.round(img.width / 40));
      ctx.font = `bold ${fontSize}px sans-serif`;
      const waktu = new Date().toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
      ctx.fillText(selectedClient ? `Absen - ${selectedClient.nama} (${selectedClient.kode})` : (namaTokoManual.trim() ? `Absen - ${namaTokoManual.trim()}` : "Absen Harian"), textX, img.height - barHeight + fontSize + 10);
      ctx.font = `${Math.round(fontSize * 0.82)}px sans-serif`;
      ctx.fillText(`${waktu}`, textX, img.height - barHeight + fontSize * 2 + 14);
      ctx.fillText(`Lat: ${coords.lat.toFixed(6)}, Long: ${coords.lng.toFixed(6)}`, textX, img.height - barHeight + fontSize * 3 + 18);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
      const extBlob = blob?.type === "image/webp" ? "webp" : "png"; // fallback kalau browser tidak dukung WebP
      const filePath = `absen-${profile.sales_id}-${Date.now()}.${extBlob}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/produk-gambar/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": blob?.type || "image/png" },
        body: blob,
      });
      if (!res.ok) throw new Error(await res.text());
      const url = `${SUPABASE_URL}/storage/v1/object/public/produk-gambar/${filePath}`;

      await supabaseFetch(token, "absen_sales", {
        method: "POST",
        body: JSON.stringify({
          sales_id: profile.sales_id, tanggal: todayStr, client_id: selectedClient?.id || null,
          nama_toko_manual: selectedClient ? null : namaTokoManual.trim(),
          alamat_toko_manual: selectedClient ? null : alamatTokoManual.trim(),
          catatan: catatanAbsen.trim(),
          foto_url: url, latitude: coords.lat, longitude: coords.lng,
        }),
      });

      // Kalau absen ini dipilih di toko yang TERDAFTAR (bukan toko manual) -
      // otomatis catat juga sebagai kunjungan, supaya jumlah kunjungan
      // toko itu (0/3 dst) langsung ikut bertambah tanpa perlu isi laporan
      // kunjungan terpisah lagi.
      if (selectedClient) {
        await supabaseFetch(token, "kunjungan_sales", {
          method: "POST",
          body: JSON.stringify({
            sales_id: profile.sales_id, client_id: selectedClient.id,
            foto_url: url, latitude: coords.lat, longitude: coords.lng,
            catatan: "Kunjungan otomatis tercatat dari absen harian",
          }),
        }).catch((e) => console.log("Gagal catat kunjungan otomatis:", e.message));
      }

      await load();
      setMode(null);
      setSelectedClient(null);
      setNamaTokoManual("");
      setAlamatTokoManual("");
      setCatatanAbsen("");
    } catch (e) {
      alert("Gagal simpan absen: " + e.message);
    }
    setUploading(false);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const liburHariIni = isMinggu || isLibur;
  const namaHari = now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // ---------- MODE PILIH TOKO ----------
  if (mode === "pilih_toko") {
    return (
      <div>
        <button onClick={() => setMode("checkin")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#6B6F75", fontSize: 13, marginBottom: 14, padding: 0 }}>
          <ChevronLeft size={16} /> Batal
        </button>
        <PageHeader title="Pilih Toko" subtitle="Anda sedang di depan toko yang mana sekarang?" />
        {handledClients.length === 0 ? (
          <EmptyState text="Belum ada toko yang ditugaskan ke Anda." />
        ) : (
          handledClients.map((c) => {
            const sudahDikunjungi = clientIdSudahKunjunganHariIni.includes(c.id);
            return (
              <Card key={c.id} style={{ marginBottom: 10, padding: 14, opacity: sudahDikunjungi ? 0.6 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: 0 }}>{c.nama}</p>
                    <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "2px 0 0" }}>{c.kode}</p>
                    {sudahDikunjungi && (
                      <p style={{ fontSize: 11, color: "#8A6A1A", margin: "4px 0 0", fontWeight: 600 }}>Sudah ada kunjungan hari ini</p>
                    )}
                  </div>
                  <button
                    onClick={() => mulaiAbsen(c)}
                    disabled={sudahDikunjungi}
                    style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: sudahDikunjungi ? "#E4E1DA" : "#E8A426", color: sudahDikunjungi ? "#9CA0A6" : "#24272B", fontSize: 12.5, fontWeight: 700 }}
                  >
                    Pilih
                  </button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    );
  }

  // ---------- MODE CHECKIN (ambil lokasi + foto) ----------
  if (mode === "checkin") {
    return (
      <div>
        <button onClick={() => { setMode(null); setSelectedClient(null); setNamaTokoManual(""); setAlamatTokoManual(""); setCatatanAbsen(""); }} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#6B6F75", fontSize: 13, marginBottom: 14, padding: 0 }}>
          <ChevronLeft size={16} /> Batal
        </button>
        <PageHeader title="Absen" subtitle={selectedClient ? `Di depan ${selectedClient.nama}` : "Absen harian"} />
        {!selectedClient && handledClients.length > 0 && (
          <button onClick={() => setMode("pilih_toko")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#8A6A1A", fontSize: 12.5, fontWeight: 600, marginBottom: 14, padding: 0 }}>
            <MapPin size={14} /> Sedang kunjungan ke toko? Pilih toko di sini (opsional)
          </button>
        )}
        {!selectedClient && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B6F75", display: "block", marginBottom: 6 }}>Nama Toko</label>
            <input
              value={namaTokoManual} onChange={(e) => setNamaTokoManual(e.target.value)}
              placeholder="Isi nama toko tempat Anda absen sekarang"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, marginBottom: 12 }}
            />
            <label style={{ fontSize: 12, fontWeight: 700, color: "#6B6F75", display: "block", marginBottom: 6 }}>Alamat</label>
            <input
              value={alamatTokoManual} onChange={(e) => setAlamatTokoManual(e.target.value)}
              placeholder="Isi alamat toko tempat Anda absen sekarang"
              style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5 }}
            />
          </div>
        )}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#6B6F75", display: "block", marginBottom: 6 }}>Catatan</label>
          <textarea
            value={catatanAbsen} onChange={(e) => setCatatanAbsen(e.target.value)}
            placeholder="Isi catatan kunjungan/absen hari ini"
            rows={3}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, resize: "vertical", fontFamily: "inherit" }}
          />
        </div>
        <Card style={{ textAlign: "center", padding: 30 }}>
          {gettingLocation ? (
            <p style={{ fontSize: 13, color: "#6B6F75" }}>Mengambil lokasi GPS Anda...</p>
          ) : locationError ? (
            <>
              <AlertCircle size={30} color="#C0392B" style={{ marginBottom: 10 }} />
              <p style={{ fontSize: 13, color: "#C0392B", marginBottom: 14 }}>{locationError}</p>
              <button onClick={() => mulaiAbsen(selectedClient)} style={{ padding: "10px 20px", borderRadius: 9, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13 }}>
                Coba Lagi
              </button>
            </>
          ) : coords ? (
            <>
              <Check size={30} color="#28685D" style={{ marginBottom: 10 }} />
              <p style={{ fontSize: 13, color: "#28685D", fontWeight: 600, marginBottom: 18 }}>Lokasi berhasil diambil.</p>
              {(() => {
                const belumIsiTokoManual = !selectedClient && (!namaTokoManual.trim() || !alamatTokoManual.trim());
                const belumIsiCatatan = !catatanAbsen.trim();
                const disabledTombol = uploading || belumIsiTokoManual || belumIsiCatatan;
                return (
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 28px", borderRadius: 12, border: "none", background: disabledTombol ? "#E4E1DA" : "#E8A426", color: disabledTombol ? "#9CA0A6" : "#24272B", fontWeight: 700, fontSize: 14, cursor: disabledTombol ? "not-allowed" : "pointer" }}>
                    <Camera size={17} /> {uploading ? "Menyimpan..." : "Ambil Foto & Absen"}
                    <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={disabledTombol} onChange={handleFotoSelfie} />
                  </label>
                );
              })()}
              {!selectedClient && (!namaTokoManual.trim() || !alamatTokoManual.trim()) && (
                <p style={{ fontSize: 11.5, color: "#C0392B", margin: "10px 0 0" }}>Isi dulu nama toko dan alamat di atas.</p>
              )}
              {!catatanAbsen.trim() && !(!selectedClient && (!namaTokoManual.trim() || !alamatTokoManual.trim())) && (
                <p style={{ fontSize: 11.5, color: "#C0392B", margin: "10px 0 0" }}>Isi dulu catatan di atas.</p>
              )}
            </>
          ) : null}
        </Card>
      </div>
    );
  }

  // ---------- TAMPILAN UTAMA ----------
  return (
    <div>
      <PageHeader title="Absen" subtitle="Absen harian - kecuali hari Minggu & tanggal merah" />

      <Card style={{ textAlign: "center", padding: 30, marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: "#9CA0A6", margin: "0 0 6px" }}>{namaHari}</p>

        {liburHariIni ? (
          <>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Clock size={26} color="#9CA0A6" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>
              {isMinggu ? "Hari Minggu - Libur" : `Tanggal Merah${keteranganLibur ? ` (${keteranganLibur})` : ""}`}
            </p>
            <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: 0 }}>Tidak perlu absen hari ini.</p>
          </>
        ) : sudahAbsenHariIni ? (
          <>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#D8E9E6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Check size={28} color="#28685D" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#28685D", margin: "0 0 4px" }}>Sudah Absen Hari Ini</p>
            <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: 0 }}>Sampai jumpa besok!</p>
          </>
        ) : (
          <>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FBF0D9", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Clock size={26} color="#8A6A1A" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#24272B", margin: "0 0 6px" }}>Belum Absen Hari Ini</p>
            <p style={{ fontSize: 12, color: "#9CA0A6", margin: "0 0 16px" }}>Perlu foto saat kunjungan ke toko.</p>
            <button
              onClick={() => mulaiAbsen(null)}
              style={{ padding: "13px 32px", borderRadius: 12, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 14.5 }}
            >
              Absen Sekarang
            </button>
          </>
        )}
      </Card>

      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>Riwayat 14 Hari Terakhir</h2>
      {riwayat.length === 0 ? (
        <EmptyState text="Belum ada riwayat absen." />
      ) : (
        riwayat.map((r, i) => (
          <Card key={i} style={{ marginBottom: 8, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 13, color: "#24272B", fontWeight: 600, margin: 0 }}>
                  {new Date(r.tanggal + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                </p>
                <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "2px 0 0" }}>{r.clients?.nama || r.nama_toko_manual || "Absen Harian"}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <p style={{ fontSize: 12, color: "#9CA0A6", margin: 0 }}>
                  {new Date(r.waktu_absen).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </p>
                {r.foto_url && (
                  <a href={r.foto_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: "#28685D", fontWeight: 700, textDecoration: "underline" }}>
                    Lihat Foto
                  </a>
                )}
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

// ============================================================
// REKAP ABSEN SALES - Owner lihat rekap semua sales + kelola tanggal merah
// ============================================================
// ============================================================
// AKTIVITAS LAYAR STAFF - Owner lihat gambaran durasi Dashboard "aktif
// di layar depan" per staff per hari (murni pemantauan, bukan penguncian).
// ============================================================
// ============================================================
// LOG ERROR SISTEM - Owner lihat semua error JavaScript yang tertangkap
// otomatis (Dashboard maupun Web App), tanpa perlu user screenshot
// Console manual tiap kali ada bug.
// ============================================================
function LogErrorSistemPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState([]);
  const [filterSumber, setFilterSumber] = useState("semua"); // "semua" | "dashboard" | "webapp"
  const [expandedId, setExpandedId] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, "error_logs?select=*&order=created_at.desc&limit=200");
      setLogs(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const filtered = filterSumber === "semua" ? logs : logs.filter((l) => l.sumber === filterSumber);

  return (
    <div>
      <PageHeader title="Log Error Sistem" subtitle={`${filtered.length} error tercatat (200 terbaru)`} onRefresh={load} refreshing={loading} />

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["semua", "dashboard", "webapp"].map((s) => (
          <button
            key={s}
            onClick={() => setFilterSumber(s)}
            style={{ padding: "9px 18px", borderRadius: 9, border: filterSumber === s ? "1.5px solid #C0392B" : "1.5px solid #E4E1DA", background: filterSumber === s ? "#FBEAEA" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700, textTransform: "capitalize" }}
          >
            {s === "semua" ? "Semua" : s === "dashboard" ? "Dashboard" : "Web App"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState text="Belum ada error tercatat. Sistem aman!" />
      ) : (
        filtered.map((l) => (
          <Card key={l.id} style={{ marginBottom: 10, padding: 14 }}>
            <div
              onClick={() => setExpandedId(expandedId === l.id ? null : l.id)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, cursor: "pointer" }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ padding: "2px 9px", borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: l.sumber === "dashboard" ? "#EFE1BE" : "#D8E9E6", color: l.sumber === "dashboard" ? "#8A6A1A" : "#28685D" }}>
                    {l.sumber === "dashboard" ? "Dashboard" : "Web App"}
                  </span>
                  <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: 0 }}>{new Date(l.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>
                </div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#C0392B", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: expandedId === l.id ? "normal" : "nowrap" }}>
                  {l.pesan_error}
                </p>
                <p style={{ fontSize: 11.5, color: "#6B6F75", margin: "4px 0 0" }}>
                  {l.nama_user || "Belum login"} {l.role_user ? `(${l.role_user})` : ""}
                </p>
              </div>
              <ChevronRight size={16} color="#9CA0A6" style={{ flexShrink: 0, transform: expandedId === l.id ? "rotate(90deg)" : "none", transition: "transform 0.15s" }} />
            </div>
            {expandedId === l.id && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #EDEAE3" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 4px" }}>Halaman</p>
                <p style={{ fontSize: 12, color: "#24272B", margin: "0 0 12px", wordBreak: "break-all" }}>{l.halaman}</p>
                {l.detail_stack && (
                  <>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 4px" }}>Detail Teknis</p>
                    <pre style={{ fontSize: 10.5, color: "#6B6F75", background: "#F7F5F1", borderRadius: 8, padding: 10, overflow: "auto", maxHeight: 200, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{l.detail_stack}</pre>
                  </>
                )}
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

function AktivitasLayarPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await supabaseFetch(token, `aktivitas_layar?select=*&tanggal=eq.${tanggal}&order=detik_aktif.desc`);
      setRows(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [tanggal]);

  function formatDurasi(detik) {
    const jam = Math.floor(detik / 3600);
    const menit = Math.floor((detik % 3600) / 60);
    if (jam > 0) return `${jam} jam ${menit} menit`;
    return `${menit} menit`;
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Aktivitas Layar Staff" subtitle="Durasi Dashboard aktif di layar depan HP/laptop staff (bukan di-minimize/ganti aplikasi lain)" onRefresh={load} refreshing={loading} />

      <input
        type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
        style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, marginBottom: 16 }}
      />

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Nama", "Role", "Durasi Aktif"].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                <td style={{ padding: "12px 14px", fontWeight: 600 }}>{r.nama_user}</td>
                <td style={{ padding: "12px 14px", color: "#6B6F75", textTransform: "capitalize" }}>{r.role_user?.replace("_", " ")}</td>
                <td style={{ padding: "12px 14px", fontWeight: 700 }}>{formatDurasi(r.detik_aktif)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState text="Belum ada data aktivitas untuk tanggal ini." />}
      </Card>

      <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "14px 0 0", lineHeight: 1.5 }}>
        Catatan: ini menghitung durasi Dashboard aktif di LAYAR DEPAN saja (bukan di-minimize/pindah ke aplikasi/tab lain) - bukan indikator produktivitas yang pasti, cuma gambaran umum saja.
      </p>
    </div>
  );
}

function RekapAbsenPage({ token, setPage }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [salesList, setSalesList] = useState([]);
  const [absenBulanIni, setAbsenBulanIni] = useState([]);
  const [hariLibur, setHariLibur] = useState([]);
  const [viewDate, setViewDate] = useState(new Date());
  const [detailSales, setDetailSales] = useState(null); // { id, nama } - sales yang lagi dilihat detailnya
  const [detailAbsenList, setDetailAbsenList] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const now = viewDate;
  const isBulanIni = now.getFullYear() === new Date().getFullYear() && now.getMonth() === new Date().getMonth();
  const startBulan = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const endBulan = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  const totalHariBulanIni = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  async function load() {
    setLoading(true);
    setError("");
    try {
      // Data hari libur di sini CUMA dibaca (buat hitung hari kerja) - kelola
      // tanggal merahnya sekarang di menu Calendar terpisah, tapi rekap ini
      // masih terkoneksi/pakai data yang SAMA supaya perhitungannya akurat.
      const [sales, absen, libur] = await Promise.all([
        supabaseFetch(token, "sales?select=id,kode,nama&status_verifikasi=eq.terverifikasi&order=nama.asc"),
        supabaseFetch(token, `absen_sales?select=sales_id,tanggal&tanggal=gte.${startBulan}&tanggal=lt.${endBulan}`),
        supabaseFetch(token, `hari_libur?select=*&tanggal=gte.${startBulan}&tanggal=lt.${endBulan}&order=tanggal.asc`),
      ]);
      setSalesList(sales);
      setAbsenBulanIni(absen);
      setHariLibur(libur);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [viewDate]);

  function gantiBulan(delta) {
    setViewDate(new Date(now.getFullYear(), now.getMonth() + delta, 1));
  }

  async function bukaDetailAbsen(s) {
    setDetailSales(s);
    setLoadingDetail(true);
    try {
      const rows = await supabaseFetch(
        token,
        `absen_sales?select=tanggal,foto_url,nama_toko_manual,alamat_toko_manual,catatan,clients(nama,kode,alamat)&sales_id=eq.${s.id}&tanggal=gte.${startBulan}&tanggal=lt.${endBulan}&order=tanggal.desc`
      );
      setDetailAbsenList(rows);
    } catch (e) {
      setDetailAbsenList([]);
    }
    setLoadingDetail(false);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  // Hitung berapa hari kerja bulan ini (total hari - hari Minggu - tanggal merah)
  // - kalau lagi lihat bulan SEKARANG, cuma hitung sampai hari ini; kalau lihat
  // bulan lain (sudah lewat/akan datang), hitung semua hari kerja di bulan itu.
  const tanggalAsliSekarang = new Date();
  let hariKerja = 0;
  for (let d = 1; d <= totalHariBulanIni; d++) {
    const tgl = new Date(now.getFullYear(), now.getMonth(), d);
    const tglStr = `${tgl.getFullYear()}-${String(tgl.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isLiburTgl = hariLibur.some((h) => h.tanggal === tglStr);
    const sudahLewat = isBulanIni ? tgl <= tanggalAsliSekarang : true;
    if (tgl.getDay() !== 0 && !isLiburTgl && sudahLewat) hariKerja++;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <PageHeader title="Rekap Absen Sales" subtitle={`Bulan ${now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })} - ${hariKerja} hari kerja berjalan`} />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => gantiBulan(-1)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #E4E1DA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronLeft size={15} color="#24272B" />
          </button>
          <button onClick={() => gantiBulan(1)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #E4E1DA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ChevronRight size={15} color="#24272B" />
          </button>
          <button
            onClick={() => setPage("calendar")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "1.5px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
          >
            <CalendarDays size={14} /> Lihat/Atur Kalender
          </button>
        </div>
      </div>

      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              {["Kode", "Nama Sales", "Jumlah Absen Bulan Ini", "Dari Hari Kerja", ""].map((h) => (
                <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B6F75", fontWeight: 700, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {salesList.map((s) => {
              const jumlahAbsen = absenBulanIni.filter((a) => a.sales_id === s.id).length;
              const kurang = hariKerja > 0 && jumlahAbsen < hariKerja;
              return (
                <tr key={s.id} style={{ borderTop: "1px solid #EDEAE3" }}>
                  <td style={{ padding: "12px 14px" }}>{s.kode}</td>
                  <td style={{ padding: "12px 14px", fontWeight: 600 }}>{s.nama}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: kurang ? "#FBEAEA" : "#D8E9E6", color: kurang ? "#C0392B" : "#28685D" }}>
                      {jumlahAbsen} kali
                    </span>
                  </td>
                  <td style={{ padding: "12px 14px", color: "#6B6F75" }}>dari {hariKerja} hari</td>
                  <td style={{ padding: "12px 14px" }}>
                    <button onClick={() => bukaDetailAbsen(s)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 11.5, fontWeight: 700 }}>
                      Detail
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {salesList.length === 0 && <EmptyState text="Belum ada akun sales." />}
      </Card>

      {detailSales && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200 }}>
          <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxWidth: 480, maxHeight: "82vh", overflowY: "auto", padding: "20px 20px 28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 2px", fontWeight: 700, textTransform: "uppercase" }}>Detail Absen</p>
                <h2 className="disp" style={{ fontSize: 19, fontWeight: 700, color: "#24272B", margin: 0 }}>{detailSales.nama}</h2>
              </div>
              <button onClick={() => setDetailSales(null)} style={{ background: "#F7F5F1", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={16} color="#6B6F75" />
              </button>
            </div>

            {loadingDetail ? (
              <p style={{ fontSize: 12.5, color: "#9CA0A6", textAlign: "center", padding: "20px 0" }}>Memuat...</p>
            ) : detailAbsenList.length === 0 ? (
              <EmptyState text="Belum ada riwayat absen bulan ini." />
            ) : (
              detailAbsenList.map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: i < detailAbsenList.length - 1 ? "1px solid #F0EDE6" : "none" }}>
                  {a.foto_url && (
                    <img src={a.foto_url} alt="Bukti absen" style={{ width: 64, height: 64, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 4px" }}>
                      {new Date(a.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                    {a.clients ? (
                      <>
                        <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{a.clients.nama} ({a.clients.kode})</p>
                        <p style={{ fontSize: 12, color: "#6B6F75", margin: 0 }}>{a.clients.alamat || "-"}</p>
                      </>
                    ) : (
                      <>
                        <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{a.nama_toko_manual || "Absen Harian"}</p>
                        {a.alamat_toko_manual && <p style={{ fontSize: 12, color: "#6B6F75", margin: 0 }}>{a.alamat_toko_manual}</p>}
                      </>
                    )}
                    {a.catatan && (
                      <p style={{ fontSize: 12, color: "#8A6A1A", margin: "6px 0 0", fontStyle: "italic" }}>"{a.catatan}"</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CALENDAR - kelola tanggal merah (dipakai bareng oleh Rekap Absen Sales
// untuk hitung hari kerja - masih terkoneksi ke data yang sama)
// ============================================================
function CalendarPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hariLibur, setHariLibur] = useState([]);
  const [showTambahLibur, setShowTambahLibur] = useState(false);
  const [tanggalBaru, setTanggalBaru] = useState("");
  const [keteranganBaru, setKeteranganBaru] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const [togglingTanggal, setTogglingTanggal] = useState(null);

  const now = viewDate;
  const isBulanIni = now.getFullYear() === new Date().getFullYear() && now.getMonth() === new Date().getMonth();
  const startBulan = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const endBulan = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  const totalHariBulanIni = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  async function load() {
    setLoading(true);
    setError("");
    try {
      const libur = await supabaseFetch(token, `hari_libur?select=*&tanggal=gte.${startBulan}&tanggal=lt.${endBulan}&order=tanggal.asc`);
      setHariLibur(libur);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [viewDate]);

  function gantiBulan(delta) {
    setViewDate(new Date(now.getFullYear(), now.getMonth() + delta, 1));
  }

  async function toggleTanggalMerah(tglStr, sudahLibur, liburId) {
    setTogglingTanggal(tglStr);
    try {
      if (sudahLibur) {
        await supabaseFetch(token, `hari_libur?id=eq.${liburId}`, { method: "DELETE" });
        setHariLibur((prev) => prev.filter((h) => h.id !== liburId));
      } else {
        const keterangan = prompt("Keterangan tanggal merah ini (opsional):", "") || null;
        const [inserted] = await supabaseFetch(token, "hari_libur", {
          method: "POST",
          body: JSON.stringify({ tanggal: tglStr, keterangan }),
        });
        setHariLibur((prev) => [...prev, inserted]);
      }
    } catch (e) {
      alert("Gagal ubah tanggal merah: " + e.message);
    }
    setTogglingTanggal(null);
  }

  async function tambahHariLibur() {
    if (!tanggalBaru) {
      alert("Pilih tanggal dulu.");
      return;
    }
    setSaving(true);
    try {
      await supabaseFetch(token, "hari_libur", {
        method: "POST",
        body: JSON.stringify({ tanggal: tanggalBaru, keterangan: keteranganBaru || null }),
      });
      setShowTambahLibur(false);
      setTanggalBaru("");
      setKeteranganBaru("");
      load();
    } catch (e) {
      alert("Gagal tambah: " + e.message);
    }
    setSaving(false);
  }

  async function hapusHariLibur(id) {
    if (!confirm("Hapus tanggal merah ini?")) return;
    try {
      await supabaseFetch(token, `hari_libur?id=eq.${id}`, { method: "DELETE" });
      setHariLibur((prev) => prev.filter((h) => h.id !== id));
    } catch (e) {
      alert("Gagal hapus: " + e.message);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <PageHeader title="Calendar" subtitle="Atur tanggal merah - dipakai juga untuk hitung hari kerja di Rekap Absen Sales" />
        <button
          onClick={() => setShowTambahLibur(true)}
          style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 4 }}
        >
          + Tanggal Merah
        </button>
      </div>

      {/* KALENDER - klik tanggal buat toggle tanggal merah */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ maxWidth: 300, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <button onClick={() => gantiBulan(-1)} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #E4E1DA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronLeft size={13} color="#24272B" />
            </button>
            <p className="disp" style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: 0 }}>
              {now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
            </p>
            <button onClick={() => gantiBulan(1)} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid #E4E1DA", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ChevronRight size={13} color="#24272B" />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 3 }}>
            {["M", "S", "S", "R", "K", "J", "S"].map((h, i) => (
              <p key={i} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "#9CA0A6", margin: 0 }}>{h}</p>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {(() => {
              const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
              const sel = [];
              for (let i = 0; i < firstDay; i++) sel.push(<div key={`kosong-${i}`} />);
              for (let d = 1; d <= totalHariBulanIni; d++) {
                const tglObj = new Date(now.getFullYear(), now.getMonth(), d);
                const tglStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                const libur = hariLibur.find((h) => h.tanggal === tglStr);
                const isMingguTgl = tglObj.getDay() === 0;
                const isHariIni = isBulanIni && d === new Date().getDate();
                sel.push(
                  <button
                    key={d}
                    onClick={() => toggleTanggalMerah(tglStr, !!libur, libur?.id)}
                    disabled={togglingTanggal === tglStr}
                    title={libur?.keterangan || (isMingguTgl ? "Minggu" : "")}
                    style={{
                      aspectRatio: "1", borderRadius: 6, border: isHariIni ? "1.5px solid #E8A426" : "1px solid #EDEAE3",
                      background: libur ? "#FBEAEA" : isMingguTgl ? "#F7F5F1" : "#fff",
                      color: libur ? "#C0392B" : isMingguTgl ? "#9CA0A6" : "#24272B",
                      fontSize: 10.5, fontWeight: isHariIni ? 700 : 600, cursor: "pointer", padding: 0,
                      opacity: togglingTanggal === tglStr ? 0.5 : 1,
                    }}
                  >
                    {d}
                  </button>
                );
              }
              return sel;
            })()}
          </div>
          <p style={{ fontSize: 10, color: "#9CA0A6", margin: "10px 0 0", textAlign: "center" }}>
            Klik tanggal untuk atur tanggal merah
          </p>
        </div>
      </Card>

      <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>Tanggal Merah Bulan Ini</h2>
      {hariLibur.length === 0 ? (
        <EmptyState text="Belum ada tanggal merah bulan ini." />
      ) : (
        hariLibur.map((h) => (
          <Card key={h.id} style={{ marginBottom: 8, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: 0 }}>
                  {new Date(h.tanggal + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <p style={{ fontSize: 12, color: "#6B6F75", margin: "2px 0 0" }}>{h.keterangan || "-"}</p>
              </div>
              <button onClick={() => hapusHariLibur(h.id)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #F0CFC7", background: "#fff", color: "#C0392B", fontSize: 11.5, fontWeight: 600 }}>
                Hapus
              </button>
            </div>
          </Card>
        ))
      )}

      {showTambahLibur && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 380, padding: 24 }}>
            <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 16px" }}>Tambah Tanggal Merah</h2>
            <input type="date" value={tanggalBaru} onChange={(e) => setTanggalBaru(e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, marginBottom: 12 }} />
            <input type="text" value={keteranganBaru} onChange={(e) => setKeteranganBaru(e.target.value)} placeholder="Keterangan (misal: Hari Raya Idul Fitri)" style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowTambahLibur(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
                Batal
              </button>
              <button onClick={tambahHariLibur} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: saving ? "#E4E1DA" : "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}>
                {saving ? "Menyimpan..." : "Tambah"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CATATAN TOKO (Sales) - buat catatan bebas per toko, ada riwayat
// ============================================================
function CatatanTokoSalesPage({ token, profile }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [catatanList, setCatatanList] = useState([]);
  const [catatanBaru, setCatatanBaru] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingCatatan, setLoadingCatatan] = useState(false);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, `clients?select=id,nama,kode&sales_id=eq.${profile.sales_id}&status=eq.aktif&order=nama.asc`);
      setClients(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function bukaToko(client) {
    setSelectedClient(client);
    setLoadingCatatan(true);
    try {
      const rows = await supabaseFetch(token, `catatan_toko_sales?select=*&client_id=eq.${client.id}&sales_id=eq.${profile.sales_id}&order=created_at.desc`);
      setCatatanList(rows);
    } catch (e) {
      alert("Gagal muat catatan: " + e.message);
    }
    setLoadingCatatan(false);
  }

  async function simpanCatatan() {
    if (!catatanBaru.trim()) return;
    setSaving(true);
    try {
      const [inserted] = await supabaseFetch(token, "catatan_toko_sales", {
        method: "POST",
        body: JSON.stringify({ client_id: selectedClient.id, sales_id: profile.sales_id, catatan: catatanBaru.trim() }),
      });
      setCatatanList((prev) => [inserted, ...prev]);
      setCatatanBaru("");
    } catch (e) {
      alert("Gagal simpan catatan: " + e.message);
    }
    setSaving(false);
  }

  async function hapusCatatan(id) {
    if (!confirm("Hapus catatan ini?")) return;
    try {
      await supabaseFetch(token, `catatan_toko_sales?id=eq.${id}`, { method: "DELETE" });
      setCatatanList((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      alert("Gagal hapus: " + e.message);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  // ---------- HALAMAN DETAIL CATATAN 1 TOKO ----------
  if (selectedClient) {
    return (
      <div>
        <button onClick={() => { setSelectedClient(null); setCatatanBaru(""); }} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#6B6F75", fontSize: 13, marginBottom: 14, padding: 0 }}>
          <ChevronLeft size={16} /> Kembali
        </button>
        <PageHeader title={selectedClient.nama} subtitle={`Kode: ${selectedClient.kode}`} />

        <Card style={{ marginBottom: 20 }}>
          <textarea
            value={catatanBaru}
            onChange={(e) => setCatatanBaru(e.target.value)}
            placeholder="Tulis catatan baru tentang toko ini..."
            rows={3}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, resize: "vertical", marginBottom: 10 }}
          />
          <button
            onClick={simpanCatatan}
            disabled={saving || !catatanBaru.trim()}
            style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: (saving || !catatanBaru.trim()) ? "#E4E1DA" : "#E8A426", color: (saving || !catatanBaru.trim()) ? "#9CA0A6" : "#24272B", fontWeight: 700, fontSize: 13.5 }}
          >
            {saving ? "Menyimpan..." : "Simpan Catatan"}
          </button>
        </Card>

        <h2 className="disp" style={{ fontSize: 16, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>Riwayat Catatan</h2>
        {loadingCatatan ? (
          <LoadingState />
        ) : catatanList.length === 0 ? (
          <EmptyState text="Belum ada catatan untuk toko ini." />
        ) : (
          catatanList.map((c) => (
            <Card key={c.id} style={{ marginBottom: 10, padding: 14 }}>
              <p style={{ fontSize: 13, color: "#24272B", margin: "0 0 8px", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{c.catatan}</p>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ fontSize: 11, color: "#9CA0A6", margin: 0 }}>
                  {new Date(c.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                </p>
                <button onClick={() => hapusCatatan(c.id)} style={{ background: "none", border: "none", color: "#C0392B", fontSize: 11.5, fontWeight: 600, padding: 0 }}>
                  Hapus
                </button>
              </div>
            </Card>
          ))
        )}
      </div>
    );
  }

  // ---------- DAFTAR TOKO ----------
  const filteredClients = clients.filter((c) =>
    c.nama.toLowerCase().includes(search.toLowerCase()) || c.kode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="Catatan Toko" subtitle="Pilih toko untuk lihat/tulis catatan" />
      <input
        value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Cari nama/kode toko..."
        style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #E4E1DA", fontSize: 13.5, marginBottom: 16 }}
      />
      {filteredClients.length === 0 ? (
        <EmptyState text="Tidak ada toko yang cocok." />
      ) : (
        filteredClients.map((c) => (
          <div key={c.id} onClick={() => bukaToko(c)} style={{ cursor: "pointer" }}>
            <Card style={{ marginBottom: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: 0 }}>{c.nama}</p>
                  <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "2px 0 0" }}>{c.kode}</p>
                </div>
                <ChevronRight size={17} color="#B5B2AA" />
              </div>
            </Card>
          </div>
        ))
      )}
    </div>
  );
}

// ============================================================
// VERIFIKASI SALES (Owner) - review KTP/NPWP/KK sales baru
// ============================================================
function VerifikasiSalesPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [salesList, setSalesList] = useState([]);
  const [processingId, setProcessingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [filter, setFilter] = useState("menunggu_review");
  const [signedUrls, setSignedUrls] = useState({}); // { "salesId-jenis": url }
  const [editingAlamatId, setEditingAlamatId] = useState(null);
  const [editAlamatForm, setEditAlamatForm] = useState({ alamat: "", kota: "", provinsi: "", kodePos: "" });
  const [savingAlamat, setSavingAlamat] = useState(false);

  function mulaiEditAlamat(s) {
    setEditingAlamatId(s.id);
    setEditAlamatForm({ alamat: s.alamat || "", kota: s.kota || "", provinsi: s.provinsi || "", kodePos: s.kode_pos || "" });
  }

  async function simpanEditAlamat(id) {
    setSavingAlamat(true);
    try {
      await supabaseFetch(token, `sales?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ alamat: editAlamatForm.alamat, kota: editAlamatForm.kota, provinsi: editAlamatForm.provinsi, kode_pos: editAlamatForm.kodePos }),
      });
      setSalesList((prev) => prev.map((s) => (s.id === id ? { ...s, alamat: editAlamatForm.alamat, kota: editAlamatForm.kota, provinsi: editAlamatForm.provinsi, kode_pos: editAlamatForm.kodePos } : s)));
      setEditingAlamatId(null);
    } catch (e) {
      alert("Gagal simpan: " + e.message);
    }
    setSavingAlamat(false);
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, "sales?select=id,kode,nama,alamat,kota,provinsi,kode_pos,email,no_hp,foto_ktp_url,foto_npwp_url,foto_kk_url,status_verifikasi,alasan_verifikasi_ditolak&status_verifikasi=neq.belum_upload&order=nama.asc");
      setSalesList(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Semua dokumen ini di bucket PRIVAT (dokumen-verifikasi), sama seperti
  // foto KTP toko - perlu signed URL sementara buat ditampilkan
  useEffect(() => {
    salesList.forEach((s) => {
      [["ktp", s.foto_ktp_url], ["npwp", s.foto_npwp_url], ["kk", s.foto_kk_url]].forEach(([jenis, path]) => {
        const key = `${s.id}-${jenis}`;
        if (path && !signedUrls[key]) {
          getSignedDocUrl(path).then((url) => {
            if (url) setSignedUrls((prev) => ({ ...prev, [key]: url }));
          });
        }
      });
    });
  }, [salesList]);

  async function getSignedDocUrl(filePath) {
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
      console.log("Gagal ambil signed URL dokumen sales:", e.message);
      return null;
    }
  }

  async function approve(s) {
    setProcessingId(s.id);
    try {
      await supabaseFetch(token, `sales?id=eq.${s.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status_verifikasi: "terverifikasi", alasan_verifikasi_ditolak: null }),
      });
      setSalesList((prev) => prev.map((x) => (x.id === s.id ? { ...x, status_verifikasi: "terverifikasi" } : x)));
    } catch (e) { alert("Gagal approve: " + e.message); }
    setProcessingId(null);
  }

  async function tolak(s) {
    if (!rejectReason.trim()) {
      alert("Isi dulu alasan penolakannya.");
      return;
    }
    setProcessingId(s.id);
    try {
      await supabaseFetch(token, `sales?id=eq.${s.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status_verifikasi: "ditolak", alasan_verifikasi_ditolak: rejectReason.trim() }),
      });
      setSalesList((prev) => prev.map((x) => (x.id === s.id ? { ...x, status_verifikasi: "ditolak", alasan_verifikasi_ditolak: rejectReason.trim() } : x)));
      setRejectingId(null);
      setRejectReason("");
    } catch (e) { alert("Gagal tolak: " + e.message); }
    setProcessingId(null);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const filtered = salesList.filter((s) => filter === "semua" || s.status_verifikasi === filter);
  const badgeStyle = {
    menunggu_review: { bg: "#FBF0D9", color: "#8A6A1A", label: "Menunggu Review" },
    terverifikasi: { bg: "#D8E9E6", color: "#28685D", label: "Terverifikasi" },
    ditolak: { bg: "#FBEAEA", color: "#C0392B", label: "Ditolak" },
  };

  return (
    <div>
      <PageHeader title="Verifikasi Sales" subtitle="Review KTP, NPWP, dan Kartu Keluarga sales baru" />

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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {filtered.map((s) => {
          const badge = badgeStyle[s.status_verifikasi] || { bg: "#F7F5F1", color: "#9CA0A6", label: s.status_verifikasi };
          const dokumen = [
            { label: "KTP", url: signedUrls[`${s.id}-ktp`] },
            { label: "NPWP", url: signedUrls[`${s.id}-npwp`] },
            { label: "KK", url: signedUrls[`${s.id}-kk`] },
          ];
          return (
            <Card key={s.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 2px", fontWeight: 700 }}>{s.kode}</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#24272B", margin: 0 }}>{s.nama}</p>
                </div>
                <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span>
              </div>

              <div style={{ background: "#F7F5F1", borderRadius: 9, padding: 10, marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#9CA0A6" }}>Email</span>
                  <span style={{ fontSize: 11.5, color: "#24272B", fontWeight: 600 }}>{s.email || "-"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#9CA0A6" }}>No. HP</span>
                  <span style={{ fontSize: 11.5, color: "#24272B", fontWeight: 600 }}>{s.no_hp || "-"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "#9CA0A6", flexShrink: 0 }}>Alamat</span>
                  {editingAlamatId !== s.id && (
                    <span style={{ fontSize: 11.5, color: "#24272B", fontWeight: 600, textAlign: "right" }}>
                      {[s.alamat, s.kota, s.provinsi, s.kode_pos].filter(Boolean).join(", ") || "-"}
                    </span>
                  )}
                </div>
                {editingAlamatId === s.id ? (
                  <div style={{ marginTop: 8 }}>
                    <input value={editAlamatForm.alamat} onChange={(e) => setEditAlamatForm({ ...editAlamatForm, alamat: e.target.value })} placeholder="Alamat jalan" style={{ width: "100%", padding: "7px 9px", borderRadius: 7, border: "1.5px solid #E4E1DA", fontSize: 12, marginBottom: 6, boxSizing: "border-box" }} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
                      <input value={editAlamatForm.kota} onChange={(e) => setEditAlamatForm({ ...editAlamatForm, kota: e.target.value })} placeholder="Kota" style={{ padding: "7px 9px", borderRadius: 7, border: "1.5px solid #E4E1DA", fontSize: 12, boxSizing: "border-box" }} />
                      <input value={editAlamatForm.provinsi} onChange={(e) => setEditAlamatForm({ ...editAlamatForm, provinsi: e.target.value })} placeholder="Provinsi" style={{ padding: "7px 9px", borderRadius: 7, border: "1.5px solid #E4E1DA", fontSize: 12, boxSizing: "border-box" }} />
                      <input value={editAlamatForm.kodePos} onChange={(e) => setEditAlamatForm({ ...editAlamatForm, kodePos: e.target.value })} placeholder="Kode Pos" style={{ padding: "7px 9px", borderRadius: 7, border: "1.5px solid #E4E1DA", fontSize: 12, boxSizing: "border-box" }} />
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => simpanEditAlamat(s.id)} disabled={savingAlamat} style={{ flex: 1, padding: 7, borderRadius: 7, border: "none", background: "#24272B", color: "#fff", fontSize: 11.5, fontWeight: 700 }}>
                        {savingAlamat ? "Menyimpan..." : "Simpan"}
                      </button>
                      <button onClick={() => setEditingAlamatId(null)} disabled={savingAlamat} style={{ flex: 1, padding: 7, borderRadius: 7, border: "1px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontSize: 11.5, fontWeight: 600 }}>
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => mulaiEditAlamat(s)} style={{ marginTop: 6, padding: "5px 10px", borderRadius: 7, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 11, fontWeight: 600 }}>
                    ✏️ Edit Alamat
                  </button>
                )}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                {dokumen.map((d) => (
                  <div key={d.label}>
                    <p style={{ fontSize: 10, color: "#9CA0A6", margin: "0 0 4px", fontWeight: 700 }}>{d.label}</p>
                    {d.url ? (
                      <img src={d.url} alt={d.label} style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 8, cursor: "pointer" }} onClick={() => window.open(d.url, "_blank")} />
                    ) : (
                      <div style={{ width: "100%", height: 90, borderRadius: 8, background: "#F7F5F1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#9CA0A6" }}>
                        {d.url === undefined ? "Memuat..." : "Tidak ada"}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {s.status_verifikasi === "ditolak" && s.alasan_verifikasi_ditolak && (
                <div style={{ background: "#FBEAEA", borderRadius: 9, padding: 10, marginBottom: 12 }}>
                  <p style={{ fontSize: 11.5, color: "#C0392B", margin: 0 }}><strong>Alasan ditolak:</strong> {s.alasan_verifikasi_ditolak}</p>
                </div>
              )}

              {s.status_verifikasi === "menunggu_review" && (
                rejectingId === s.id ? (
                  <div>
                    <textarea
                      value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Alasan penolakan..." rows={2}
                      style={{ width: "100%", padding: 9, borderRadius: 8, border: "1.5px solid #E4E1DA", fontSize: 12.5, marginBottom: 8, resize: "vertical" }}
                    />
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => tolak(s)} disabled={processingId === s.id} style={{ flex: 1, padding: 9, borderRadius: 8, border: "none", background: "#C0392B", color: "#fff", fontSize: 12, fontWeight: 700 }}>
                        Kirim Penolakan
                      </button>
                      <button onClick={() => { setRejectingId(null); setRejectReason(""); }} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontSize: 12, fontWeight: 600 }}>
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => approve(s)} disabled={processingId === s.id} style={{ flex: 1, padding: 10, borderRadius: 9, border: "none", background: "#28685D", color: "#fff", fontSize: 12.5, fontWeight: 700 }}>
                      {processingId === s.id ? "..." : "Setujui"}
                    </button>
                    <button onClick={() => setRejectingId(s.id)} style={{ flex: 1, padding: 10, borderRadius: 9, border: "1.5px solid #C0392B", background: "#fff", color: "#C0392B", fontSize: 12.5, fontWeight: 700 }}>
                      Tolak
                    </button>
                  </div>
                )
              )}
            </Card>
          );
        })}
      </div>
      {filtered.length === 0 && <EmptyState text="Tidak ada sales di kategori ini." />}
    </div>
  );
}

// ============================================================
// LAPORAN KUNJUNGAN SALES (Owner) - lihat semua kunjungan + foto + catatan
// ============================================================
function LaporanKunjunganOwnerPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kunjungan, setKunjungan] = useState([]);
  const [salesList, setSalesList] = useState([]);
  const [filterSales, setFilterSales] = useState("");
  const [filterTanggal, setFilterTanggal] = useState("");
  const [hanyaPerluReview, setHanyaPerluReview] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [rows, sales] = await Promise.all([
        supabaseFetch(token, "kunjungan_sales?select=*,sales(nama,kode),clients(nama,kode)&order=created_at.desc&limit=300"),
        supabaseFetch(token, "sales?select=id,nama,kode&order=nama.asc"),
      ]);
      setKunjungan(rows);
      setSalesList(sales);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const filtered = kunjungan.filter((k) => {
    if (filterSales && k.sales_id !== filterSales) return false;
    if (filterTanggal) {
      const tglKunjungan = new Date(k.created_at).toISOString().slice(0, 10);
      if (tglKunjungan !== filterTanggal) return false;
    }
    if (hanyaPerluReview && !k.perlu_review_gps) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Laporan Kunjungan Sales" subtitle={`${filtered.length} kunjungan`} />

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <select value={filterSales} onChange={(e) => setFilterSales(e.target.value)} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13 }}>
          <option value="">Semua Sales</option>
          {salesList.map((s) => (
            <option key={s.id} value={s.id}>{s.nama} ({s.kode})</option>
          ))}
        </select>
        <input type="date" value={filterTanggal} onChange={(e) => setFilterTanggal(e.target.value)} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13 }} />
        <button
          onClick={() => setHanyaPerluReview((v) => !v)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: hanyaPerluReview ? "1.5px solid #C0392B" : "1.5px solid #E4E1DA", background: hanyaPerluReview ? "#FBEAEA" : "#fff", color: hanyaPerluReview ? "#C0392B" : "#24272B", fontSize: 12.5, fontWeight: 700 }}
        >
          <AlertCircle size={14} /> Perlu Review GPS
        </button>
        {(filterSales || filterTanggal || hanyaPerluReview) && (
          <button onClick={() => { setFilterSales(""); setFilterTanggal(""); setHanyaPerluReview(false); }} style={{ padding: "9px 14px", borderRadius: 9, border: "1px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontSize: 12.5, fontWeight: 600 }}>
            Reset Filter
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState text="Belum ada laporan kunjungan." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {filtered.map((k) => (
            <Card key={k.id}>
              {k.foto_url && (
                <img
                  src={k.foto_url} alt="Kunjungan"
                  onClick={() => setLightboxUrl(k.foto_url)}
                  style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 10, marginBottom: 12, cursor: "pointer" }}
                />
              )}
              <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{k.clients?.nama}</p>
              <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 8px" }}>{k.clients?.kode}</p>
              {k.perlu_review_gps && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#FBEAEA", borderRadius: 8, padding: "8px 10px", marginBottom: 10 }}>
                  <AlertCircle size={14} color="#C0392B" style={{ flexShrink: 0 }} />
                  <p style={{ fontSize: 11.5, color: "#C0392B", margin: 0, fontWeight: 600 }}>
                    Cek GPS - titik ini {Math.round(k.jarak_dari_sebelumnya_meter)}m dari kunjungan sebelumnya ke toko ini
                  </p>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <User size={13} color="#8A6A1A" />
                <p style={{ fontSize: 12, color: "#8A6A1A", fontWeight: 600, margin: 0 }}>{k.sales?.nama} ({k.sales?.kode})</p>
              </div>
              {k.catatan && (
                <div style={{ background: "#F7F5F1", borderRadius: 8, padding: 10, marginBottom: 10 }}>
                  <p style={{ fontSize: 12, color: "#24272B", margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{k.catatan}</p>
                </div>
              )}
              <p style={{ fontSize: 11, color: "#9CA0A6", margin: 0 }}>
                {new Date(k.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </Card>
          ))}
        </div>
      )}

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

// ============================================================
// AREA (Sales) - request perluasan daerah ke Owner
// ============================================================
function AreaSalesPage({ token, profile }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [riwayat, setRiwayat] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [areaDiminta, setAreaDiminta] = useState("");
  const [alasan, setAlasan] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, `request_area_sales?select=*&sales_id=eq.${profile.sales_id}&order=created_at.desc`);
      setRiwayat(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function kirimRequest() {
    if (!areaDiminta.trim()) {
      alert("Isi dulu area yang ingin diminta.");
      return;
    }
    setSaving(true);
    try {
      const [inserted] = await supabaseFetch(token, "request_area_sales", {
        method: "POST",
        body: JSON.stringify({ sales_id: profile.sales_id, area_diminta: areaDiminta.trim(), alasan: alasan.trim() || null }),
      });
      setRiwayat((prev) => [inserted, ...prev]);
      setShowForm(false);
      setAreaDiminta("");
      setAlasan("");
    } catch (e) {
      alert("Gagal kirim request: " + e.message);
    }
    setSaving(false);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const statusBadge = {
    menunggu: { text: "Menunggu Review", bg: "#FBF0D9", color: "#8A6A1A" },
    disetujui: { text: "Disetujui", bg: "#D8E9E6", color: "#28685D" },
    ditolak: { text: "Ditolak", bg: "#FBEAEA", color: "#C0392B" },
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <PageHeader title="Area" subtitle="Request perluasan area kerja ke Owner" />
        <button
          onClick={() => setShowForm(true)}
          style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 4 }}
        >
          + Request Area
        </button>
      </div>

      {riwayat.length === 0 ? (
        <EmptyState text="Belum ada request area yang diajukan." />
      ) : (
        riwayat.map((r) => {
          const badge = statusBadge[r.status];
          return (
            <Card key={r.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <p style={{ fontSize: 14.5, fontWeight: 700, color: "#24272B", margin: 0 }}>{r.area_diminta}</p>
                <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color, flexShrink: 0 }}>{badge.text}</span>
              </div>
              {r.alasan && <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "0 0 8px", lineHeight: 1.5 }}>{r.alasan}</p>}
              {r.catatan_owner && (
                <div style={{ background: "#F7F5F1", borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 3px", fontWeight: 700 }}>CATATAN OWNER</p>
                  <p style={{ fontSize: 12, color: "#24272B", margin: 0 }}>{r.catatan_owner}</p>
                </div>
              )}
              <p style={{ fontSize: 11, color: "#9CA0A6", margin: 0 }}>
                {new Date(r.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </Card>
          );
        })
      )}

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 420, padding: 24 }}>
            <h2 className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 16px" }}>Request Perluasan Area</h2>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Area yang Diminta</label>
              <input
                value={areaDiminta} onChange={(e) => setAreaDiminta(e.target.value)}
                placeholder="Contoh: Kecamatan Marpoyan Damai, Pekanbaru"
                style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5 }}
              />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Alasan (opsional)</label>
              <textarea
                value={alasan} onChange={(e) => setAlasan(e.target.value)}
                placeholder="Kenapa ingin memperluas ke area ini..."
                rows={3}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, resize: "vertical" }}
              />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setShowForm(false); setAreaDiminta(""); setAlasan(""); }} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
                Batal
              </button>
              <button onClick={kirimRequest} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: saving ? "#E4E1DA" : "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}>
                {saving ? "Mengirim..." : "Kirim Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// REQUEST AREA SALES (Owner) - review request perluasan area
// ============================================================
function RequestAreaOwnerPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requestList, setRequestList] = useState([]);
  const [filter, setFilter] = useState("menunggu");
  const [processingId, setProcessingId] = useState(null);
  const [catatanMap, setCatatanMap] = useState({}); // { requestId: teks catatan }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, "request_area_sales?select=*,sales(nama,kode)&order=created_at.desc");
      setRequestList(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function proses(id, status) {
    setProcessingId(id);
    try {
      await supabaseFetch(token, `request_area_sales?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, catatan_owner: catatanMap[id] || null, diproses_at: new Date().toISOString() }),
      });
      setRequestList((prev) => prev.map((r) => (r.id === id ? { ...r, status, catatan_owner: catatanMap[id] || null } : r)));
    } catch (e) {
      alert("Gagal proses: " + e.message);
    }
    setProcessingId(null);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const filtered = requestList.filter((r) => filter === "semua" || r.status === filter);
  const statusBadge = {
    menunggu: { text: "Menunggu Review", bg: "#FBF0D9", color: "#8A6A1A" },
    disetujui: { text: "Disetujui", bg: "#D8E9E6", color: "#28685D" },
    ditolak: { text: "Ditolak", bg: "#FBEAEA", color: "#C0392B" },
  };

  return (
    <div>
      <PageHeader title="Request Area Sales" subtitle="Review permintaan perluasan area kerja sales" />

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { key: "menunggu", label: "Menunggu Review" },
          { key: "disetujui", label: "Disetujui" },
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

      {filtered.length === 0 ? (
        <EmptyState text="Tidak ada request di kategori ini." />
      ) : (
        filtered.map((r) => {
          const badge = statusBadge[r.status];
          return (
            <Card key={r.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{r.area_diminta}</p>
                  <p style={{ fontSize: 12, color: "#8A6A1A", fontWeight: 600, margin: 0 }}>{r.sales?.nama} ({r.sales?.kode})</p>
                </div>
                <span style={{ padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.color, flexShrink: 0 }}>{badge.text}</span>
              </div>
              {r.alasan && <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "0 0 10px", lineHeight: 1.5 }}>{r.alasan}</p>}
              <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 12px" }}>
                {new Date(r.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
              </p>

              {r.status === "menunggu" ? (
                <div>
                  <textarea
                    value={catatanMap[r.id] || ""}
                    onChange={(e) => setCatatanMap((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="Catatan untuk sales (opsional)..."
                    rows={2}
                    style={{ width: "100%", padding: 9, borderRadius: 8, border: "1.5px solid #E4E1DA", fontSize: 12.5, marginBottom: 8, resize: "vertical" }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => proses(r.id, "disetujui")} disabled={processingId === r.id} style={{ flex: 1, padding: 10, borderRadius: 9, border: "none", background: "#28685D", color: "#fff", fontSize: 12.5, fontWeight: 700 }}>
                      Setujui
                    </button>
                    <button onClick={() => proses(r.id, "ditolak")} disabled={processingId === r.id} style={{ flex: 1, padding: 10, borderRadius: 9, border: "1.5px solid #C0392B", background: "#fff", color: "#C0392B", fontSize: 12.5, fontWeight: 700 }}>
                      Tolak
                    </button>
                  </div>
                </div>
              ) : (
                r.catatan_owner && (
                  <div style={{ background: "#F7F5F1", borderRadius: 8, padding: 10 }}>
                    <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 3px", fontWeight: 700 }}>CATATAN ANDA</p>
                    <p style={{ fontSize: 12, color: "#24272B", margin: 0 }}>{r.catatan_owner}</p>
                  </div>
                )
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}

// ============================================================
// LAPORAN MINGGUAN/BULANAN SALES (Owner) - lihat semua + siapa belum isi
// ============================================================
function LaporanPeriodikSalesOwnerPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("mingguan"); // "mingguan" | "bulanan"
  const [salesList, setSalesList] = useState([]);
  const [laporanMingguan, setLaporanMingguan] = useState([]);
  const [laporanBulanan, setLaporanBulanan] = useState([]);

  function getSeninMingguIni() {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const seninMingguIni = getSeninMingguIni();
  const now = new Date();

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [sales, mingguan, bulanan] = await Promise.all([
        supabaseFetch(token, "sales?select=id,nama,kode&order=nama.asc"),
        supabaseFetch(token, `laporan_mingguan_sales?select=*,sales(nama,kode)&minggu_mulai=eq.${seninMingguIni}`),
        supabaseFetch(token, `laporan_bulanan_sales?select=*,sales(nama,kode)&bulan=eq.${now.getMonth() + 1}&tahun=eq.${now.getFullYear()}`),
      ]);
      setSalesList(sales);
      setLaporanMingguan(mingguan);
      setLaporanBulanan(bulanan);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const dataAktif = tab === "mingguan" ? laporanMingguan : laporanBulanan;
  const sudahIsiIds = new Set(dataAktif.map((l) => l.sales_id));
  const belumIsi = salesList.filter((s) => !sudahIsiIds.has(s.id));

  return (
    <div>
      <PageHeader
        title="Laporan Mingguan/Bulanan Sales"
        subtitle={tab === "mingguan" ? `Minggu berjalan (mulai ${new Date(seninMingguIni + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "long" })})` : `Bulan ${now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`}
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={() => setTab("mingguan")} style={{ padding: "9px 18px", borderRadius: 9, border: tab === "mingguan" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: tab === "mingguan" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}>
          Mingguan
        </button>
        <button onClick={() => setTab("bulanan")} style={{ padding: "9px 18px", borderRadius: 9, border: tab === "bulanan" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: tab === "bulanan" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}>
          Bulanan
        </button>
      </div>

      {belumIsi.length > 0 && (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FBEAEA", borderRadius: 10, padding: 12, marginBottom: 20 }}>
          <AlertCircle size={16} color="#C0392B" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 12.5, color: "#C0392B", margin: 0, fontWeight: 600, lineHeight: 1.5 }}>
            Belum isi periode ini: {belumIsi.map((s) => s.nama).join(", ")}
          </p>
        </div>
      )}

      {dataAktif.length === 0 ? (
        <EmptyState text={`Belum ada laporan ${tab} untuk periode ini.`} />
      ) : (
        dataAktif.map((l) => (
          <Card key={l.id} style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: "#8A6A1A", margin: "0 0 8px" }}>{l.sales?.nama} ({l.sales?.kode})</p>
            <p style={{ fontSize: 13, color: "#24272B", margin: "0 0 8px", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{l.hambatan}</p>
            <p style={{ fontSize: 11, color: "#9CA0A6", margin: 0 }}>
              {new Date(l.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </Card>
        ))
      )}
    </div>
  );
}

// ============================================================
// SIAP DIKIRIM (BARU) - order sudah discan Outbound, tunggu kurir mulai
// bawa jalan. Tahap ini terpisah dari "Pesanan" (sebelum outbound) dan
// "Proses Pengiriman" (setelah kurir benar-benar mulai jalan).
// ============================================================
// ============================================================
// MODAL SCAN BOX LANGSUNG DARI SIAP KIRIM - kurir scan box per pesanan
// tanpa perlu pindah halaman. Progress tersimpan persisten (bukan cuma
// state React) di orders.box_terscan_siap_kirim, jadi aman kalau app
// ditutup di tengah scan. Begitu box terakhir dikonfirmasi, order
// otomatis ditandai siap_lapor_kurir_at supaya muncul di daftar "siap
// dilaporkan" di menu Laporan Kurir tanpa perlu scan ulang.
// ============================================================
function ScanBoxSiapKirimModal({ order, token, onClose, onSelesai }) {
  const totalBox = order.jumlah_box_konfirmasi || 1;
  const [boxTerscan, setBoxTerscan] = useState(order.box_terscan_siap_kirim || []);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [pesan, setPesan] = useState(null); // { type: "ok"|"error", text }
  const [inputManual, setInputManual] = useState("");
  const [saving, setSaving] = useState(false);
  const [semuaBoxSelesai, setSemuaBoxSelesai] = useState(!!order.siap_lapor_kurir_at || (order.box_terscan_siap_kirim || []).length >= totalBox);
  const [uploadingFotoSerahTerima, setUploadingFotoSerahTerima] = useState(false);
  const html5QrRef = useRef(null);
  const boxTerscanRef = useRef(boxTerscan);
  useEffect(() => { boxTerscanRef.current = boxTerscan; }, [boxTerscan]);

  useEffect(() => {
    return () => { if (html5QrRef.current) html5QrRef.current.stop().catch(() => {}); };
  }, []);

  // Hentikan kamera dengan AMAN - tunggu proses stop() BENAR-BENAR selesai
  // (async) sebelum jalankan callback lanjutan (misal tutup modal/unmount
  // komponen) - kalau tidak ditunggu, komponen bisa keburu dihapus dari
  // layar sementara library kamera masih coba akses elemen yang sudah
  // tidak ada lagi, menyebabkan crash.
  function hentikanKameraLaluLanjut(callback) {
    if (html5QrRef.current) {
      const qr = html5QrRef.current;
      html5QrRef.current = null;
      qr.stop().catch(() => {}).finally(() => { callback(); });
    } else {
      callback();
    }
  }

  // Setelah SEMUA box discan, WAJIB upload foto bukti serah terima dulu
  // di sini juga - baru order benar-benar ditandai "siap dilaporkan"
  // (siap_lapor_kurir_at diisi BARENGAN dengan foto, bukan terpisah) -
  // supaya order yang muncul di "Sudah Discan Lengkap" di Laporan Kurir
  // sudah PASTI ada foto-nya, tidak ada celah lagi.
  async function uploadFotoSerahTerimaDanSelesai(file) {
    if (!file) return;
    setUploadingFotoSerahTerima(true);
    try {
      const compressed = await compressImage(file);
      const { ext, contentType } = infoFileTerkompresi(compressed, file);
      const filePath = `bukti_serah_terima_kurir_url-${order.id}-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/bukti-pengiriman/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": contentType },
        body: compressed,
      });
      if (!res.ok) throw new Error(await res.text());
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/bukti-pengiriman/${filePath}`;
      await supabaseFetch(token, `orders?id=eq.${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ bukti_serah_terima_kurir_url: publicUrl, siap_lapor_kurir_at: new Date().toISOString() }),
      });
      hentikanKameraLaluLanjut(() => onSelesai());
    } catch (e) {
      alert("Gagal upload foto: " + e.message);
    }
    setUploadingFotoSerahTerima(false);
  }

  async function prosesScan(kodeMentah) {
    const kode = kodeMentah.trim();
    // Format: NONOTA-NN atau NONOTA-NN-NOMORPRODUK
    const match = kode.match(/^(.+?)-(\d{2,3})(?:-.+)?$/);
    if (!match) {
      setPesan({ type: "error", text: `Kode "${kode}" tidak dikenali.` });
      return;
    }
    const [, noNotaScan, noBoxStr] = match;
    const noBox = parseInt(noBoxStr, 10);
    if (noNotaScan !== order.no_nota) {
      setPesan({ type: "error", text: `Barcode ini bukan milik pesanan ${order.no_nota} (punya ${noNotaScan}).` });
      return;
    }
    if (noBox > totalBox || noBox < 1) {
      setPesan({ type: "error", text: `Box ${noBox} tidak valid - pesanan ini cuma punya ${totalBox} box.` });
      return;
    }
    if (boxTerscanRef.current.includes(noBox)) {
      setPesan({ type: "error", text: `Box ${noBox} sudah pernah discan sebelumnya.` });
      return;
    }

    const updated = [...boxTerscanRef.current, noBox].sort((a, b) => a - b);
    setBoxTerscan(updated);
    setPesan({ type: "ok", text: `Box ${noBox} berhasil discan (${updated.length}/${totalBox}).` });
    mainkanBeepScan();
    setSaving(true);
    try {
      // PENTING: siap_lapor_kurir_at SENGAJA belum diisi di sini walau box
      // sudah lengkap semua - itu baru diisi BARENGAN foto bukti serah
      // terima (lihat uploadFotoSerahTerimaDanSelesai) supaya order tidak
      // pernah muncul "siap dilaporkan" tanpa foto.
      await supabaseFetch(token, `orders?id=eq.${order.id}`, { method: "PATCH", body: JSON.stringify({ box_terscan_siap_kirim: updated }) });
      if (updated.length >= totalBox) {
        // JANGAN stop() langsung di sini - masih di dalam callback decode
        // milik scanner itu sendiri, hentikan di luar tick ini (setTimeout 0)
        // supaya tidak bentrok dengan proses internal library kamera.
        setTimeout(() => { hentikanKameraLaluLanjut(() => setSemuaBoxSelesai(true)); }, 500);
      }
    } catch (e) {
      setPesan({ type: "error", text: "Gagal simpan: " + e.message });
    }
    setSaving(false);
  }

  async function mulaiScanKamera() {
    setCameraError("");
    setShowCamera(true);
    try {
      await loadHtml5Qrcode();
      setTimeout(async () => {
        try {
          const html5Qr = new window.Html5Qrcode("reader-scan-siap-kirim");
          html5QrRef.current = html5Qr;
          await html5Qr.start(
            { facingMode: "environment" },
            { fps: 5, qrbox: { width: 300, height: 150 }, formatsToSupport: [window.Html5QrcodeSupportedFormats.CODE_128, window.Html5QrcodeSupportedFormats.QR_CODE] },
            (decodedText) => { prosesScan(decodedText); },
            () => {}
          );
        } catch (e) {
          setCameraError("Gagal buka kamera: " + e.message + " (pastikan izinkan akses kamera di browser)");
        }
      }, 200);
    } catch (e) {
      setCameraError("Gagal muat library scanner: " + e.message);
    }
  }

  function tutupKamera() {
    hentikanKameraLaluLanjut(() => setShowCamera(false));
  }

  function tutupModal() {
    hentikanKameraLaluLanjut(() => onClose());
  }


  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, maxWidth: 440, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <p className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: 0 }}>{order.no_nota}</p>
            <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "2px 0 0" }}>{order.clients?.nama}</p>
          </div>
          <button onClick={tutupModal} style={{ background: "none", border: "none", color: "#6B6F75" }}><X size={20} /></button>
        </div>

        <div style={{ background: "#F7F5F1", borderRadius: 10, padding: 12, marginBottom: 14, textAlign: "center" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: 0 }}>{boxTerscan.length} / {totalBox} box discan</p>
        </div>

        {semuaBoxSelesai ? (
          <>
            <div style={{ background: "#D8E9E6", borderRadius: 10, padding: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Check size={16} color="#28685D" />
              <p style={{ fontSize: 12.5, color: "#28685D", margin: 0, fontWeight: 600 }}>Semua box sudah discan. Terakhir, upload foto bukti serah terima ke kurir.</p>
            </div>
            <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: 24, borderRadius: 12, border: "2px dashed #E8A426", background: "#FFFBF0", color: "#8A6A1A", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}>
              <UploadCloud size={28} />
              {uploadingFotoSerahTerima ? "Mengupload..." : "Ambil/Upload Foto Bukti Serah Terima (Wajib)"}
              <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={uploadingFotoSerahTerima} onChange={(e) => { if (e.target.files[0]) uploadFotoSerahTerimaDanSelesai(e.target.files[0]); }} />
            </label>
          </>
        ) : (
          <>
            {!showCamera ? (
              <button onClick={mulaiScanKamera} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: "#28685D", color: "#fff", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 10 }}>
                <Camera size={16} /> Buka Kamera Scan
              </button>
            ) : (
              <div style={{ marginBottom: 10 }}>
                <div id="reader-scan-siap-kirim" style={{ borderRadius: 10, overflow: "hidden", marginBottom: 8 }} />
                <button onClick={tutupKamera} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 700, fontSize: 13 }}>Tutup Kamera</button>
              </div>
            )}
            {cameraError && <p style={{ fontSize: 11.5, color: "#C0392B", margin: "0 0 10px" }}>{cameraError}</p>}

            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input
                type="text" value={inputManual} onChange={(e) => setInputManual(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && inputManual.trim()) { prosesScan(inputManual.trim()); setInputManual(""); } }}
                placeholder="Atau ketik manual kode box..."
                style={{ flex: 1, padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13 }}
              />
            </div>

            {pesan && (
              <div style={{ background: pesan.type === "ok" ? "#D8E9E6" : "#FBEAEA", borderRadius: 10, padding: 10 }}>
                <p style={{ fontSize: 12.5, color: pesan.type === "ok" ? "#28685D" : "#C0392B", margin: 0, fontWeight: 600 }}>{pesan.text}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SiapDikirimBaruPage({ token, role }) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("semua"); // "semua" | "toko" | "baraka"
  const [scanningOrder, setScanningOrder] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, "orders?select=*,clients(nama,kode,alamat,kota)&status=eq.siap_dikirim&order=outbound_verified_at.asc");
      // Kurir cuma boleh lihat order tujuan Pekanbaru saja
      const rowsFiltered = role === "kurir"
        ? rows.filter((o) => {
            const kotaTujuanAsli = o.tujuan_kota || o.clients?.kota;
            return !!(kotaTujuanAsli && kotaTujuanAsli.trim().toLowerCase().includes("pekanbaru"));
          })
        : rows;
      setOrders(rowsFiltered);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  // Kurir Toko = tujuan Pekanbaru (diantar sendiri), Baraka = luar kota
  // (dikirim lewat jasa kurir eksternal Baraka)
  function isPekanbaruOrder(o) {
    const kotaTujuanAsli = o.tujuan_kota || o.clients?.kota;
    return !!(kotaTujuanAsli && kotaTujuanAsli.trim().toLowerCase().includes("pekanbaru"));
  }

  // Cek apakah order ini TERLAMBAT diambil kurir - sudah outbound (siap
  // dikirim) tapi belum juga masuk Proses Pengiriman, pakai aturan jam
  // 13:00 yang sama seperti Terlambat Pengemasan.
  function cekTerlambatDiambilKurir(o) {
    if (!o.outbound_verified_at) return false;
    const outbound = new Date(o.outbound_verified_at);
    const sekarang = new Date();
    if (outbound.getHours() < 13) {
      const sameDay = outbound.getFullYear() === sekarang.getFullYear() && outbound.getMonth() === sekarang.getMonth() && outbound.getDate() === sekarang.getDate();
      return !sameDay;
    } else {
      const batasWaktu = new Date(outbound);
      batasWaktu.setDate(batasWaktu.getDate() + 1);
      batasWaktu.setHours(23, 59, 59, 999);
      return sekarang > batasWaktu;
    }
  }
  const orderToko = orders.filter((o) => isPekanbaruOrder(o));
  const orderBaraka = orders.filter((o) => !isPekanbaruOrder(o));
  const orderTampil = activeTab === "baraka" ? orderBaraka : activeTab === "toko" ? orderToko : orders;

  return (
    <div>
      <PageHeader title="Siap Dikirim" subtitle={`${orders.length} pesanan sudah discan outbound, menunggu diserahkan ke kurir`} onRefresh={load} refreshing={loading} />

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setActiveTab("semua")}
          style={{ padding: "9px 18px", borderRadius: 9, border: activeTab === "semua" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: activeTab === "semua" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}
        >
          Semua ({orders.length})
        </button>
        <button
          onClick={() => setActiveTab("toko")}
          style={{ padding: "9px 18px", borderRadius: 9, border: activeTab === "toko" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: activeTab === "toko" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}
        >
          Kurir Toko ({orderToko.length})
        </button>
        <button
          onClick={() => setActiveTab("baraka")}
          style={{ padding: "9px 18px", borderRadius: 9, border: activeTab === "baraka" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: activeTab === "baraka" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}
        >
          Baraka ({orderBaraka.length})
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FBF0D9", borderRadius: 10, padding: 12, marginBottom: 20 }}>
        <AlertCircle size={15} color="#8A6A1A" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12, color: "#8A6A1A", margin: 0, lineHeight: 1.5 }}>
          Ini cuma tampilan info - pesanan di sini otomatis pindah ke "Proses Pengiriman" begitu diserahkan ke kurir lewat menu <strong>"Buat Laporan Kurir"</strong>.
        </p>
      </div>

      {orderTampil.length === 0 ? (
        <EmptyState text="Tidak ada pesanan yang siap dikirim di kategori ini." />
      ) : (
        orderTampil.map((o) => (
          <Card key={o.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>
                  {o.no_nota}
                  {o.metode_bayar === "cod" && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#FBF0D9", color: "#8A6A1A", verticalAlign: "middle" }}>COD</span>
                  )}
                  {cekTerlambatDiambilKurir(o) && (
                    <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#FBEAEA", color: "#C0392B", verticalAlign: "middle" }}>Terlambat Diambil Kurir</span>
                  )}
                </p>
                <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>{o.clients?.nama} ({o.clients?.kode})</p>
                <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "4px 0 0" }}>{o.tujuan_alamat || o.clients?.alamat}</p>
              </div>
              <button
                onClick={() => setScanningOrder(o)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "11px 20px", borderRadius: 10, border: "none", fontWeight: 700, fontSize: 13.5,
                  background: o.siap_lapor_kurir_at ? "#D8E9E6" : (o.box_terscan_siap_kirim || []).length >= (o.jumlah_box_konfirmasi || 1) ? "#FBEAEA" : "#FBF0D9",
                  color: o.siap_lapor_kurir_at ? "#28685D" : (o.box_terscan_siap_kirim || []).length >= (o.jumlah_box_konfirmasi || 1) ? "#C0392B" : "#8A6A1A",
                }}
              >
                {o.siap_lapor_kurir_at ? <Check size={16} /> : (o.box_terscan_siap_kirim || []).length >= (o.jumlah_box_konfirmasi || 1) ? <UploadCloud size={16} /> : <ScanLine size={16} />}
                {o.siap_lapor_kurir_at ? "Siap Dilaporkan" : (o.box_terscan_siap_kirim || []).length >= (o.jumlah_box_konfirmasi || 1) ? "Upload Foto (Wajib)" : `Scan Kurir (${(o.box_terscan_siap_kirim || []).length}/${o.jumlah_box_konfirmasi || 1})`}
              </button>
            </div>
          </Card>
        ))
      )}

      {scanningOrder && (
        <ScanBoxSiapKirimModal
          order={scanningOrder}
          token={token}
          onClose={() => { setScanningOrder(null); load(); }}
          onSelesai={() => { setScanningOrder(null); load(); }}
        />
      )}
    </div>
  );
}

function LaporanKurirDocContent({ laporan, items }) {
  const isTokoLokal = laporan.jenis_kurir === "toko";
  const isRetur = laporan.jenis_laporan === "retur";
  return (
    <div className="nota-print-area" style={{ padding: "36px 44px", fontFamily: "'Times New Roman', serif" }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{COMPANY_NAME}</p>
        <p style={{ fontSize: 15, fontWeight: 700, margin: "18px 0 0", textDecoration: "underline" }}>{isRetur ? "BUKTI RETUR PAKET" : "BUKTI SERAH TERIMA PAKET"}</p>
        <p style={{ fontSize: 13, margin: "4px 0 0" }}>{isTokoLokal ? "Kurir Toko" : "Kurir Baraka"}</p>
      </div>

      <table style={{ marginBottom: 20, fontSize: 13 }}><tbody>
        <tr><td style={{ padding: "2px 14px 2px 0", fontWeight: 700 }}>Tanggal</td><td>: {new Date(laporan.created_at).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}</td></tr>
        <tr><td style={{ padding: "2px 14px 2px 0", fontWeight: 700 }}>Dikonfirmasi Oleh</td><td>: {laporan.nama_kurir}</td></tr>
        {isRetur ? null : isTokoLokal ? (
          <tr><td style={{ padding: "2px 14px 2px 0", fontWeight: 700 }}>Trip Ke</td><td>: {laporan.trip || 1}</td></tr>
        ) : (
          <tr><td style={{ padding: "2px 14px 2px 0", fontWeight: 700 }}>No. HP</td><td>: {laporan.no_hp_kurir || "-"}</td></tr>
        )}
        <tr><td style={{ padding: "2px 14px 2px 0", fontWeight: 700 }}>Jumlah Box</td><td>: {laporan.jumlah_koli}</td></tr>
      </tbody></table>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 30 }}>
        <thead>
          <tr>
            <th style={{ border: "1px solid #24272B", padding: "6px 10px", width: 50 }}>No</th>
            <th style={{ border: "1px solid #24272B", padding: "6px 10px", textAlign: "left" }}>Nomor Nota</th>
            <th style={{ border: "1px solid #24272B", padding: "6px 10px", width: 80 }}>Jumlah Box</th>
            <th style={{ border: "1px solid #24272B", padding: "6px 10px", textAlign: "left" }}>Catatan</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.id}>
              <td style={{ border: "1px solid #24272B", padding: "6px 10px", textAlign: "center" }}>{i + 1}</td>
              <td style={{ border: "1px solid #24272B", padding: "6px 10px" }}>{it.no_nota}</td>
              <td style={{ border: "1px solid #24272B", padding: "6px 10px", textAlign: "center" }}>{it.jumlah_box || 1}</td>
              <td style={{ border: "1px solid #24272B", padding: "6px 10px" }}>{it.catatan || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!isTokoLokal && !isRetur && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ textAlign: "center", width: 220 }}>
            <p style={{ fontSize: 13, margin: "0 0 10px" }}>Yang Menerima,</p>
            {laporan.ttd_kurir_url ? (
              <img src={laporan.ttd_kurir_url} alt="Tanda tangan" style={{ height: 80, objectFit: "contain", margin: "0 auto" }} />
            ) : (
              <div style={{ height: 80 }} />
            )}
            <p style={{ fontSize: 13, margin: "6px 0 0", borderTop: "1px solid #24272B", paddingTop: 6 }}>{laporan.nama_kurir}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function LaporanKurirPage({ token }) {
  const [activeTab, setActiveTab] = useState("baraka"); // "baraka" | "toko"
  const [loading, setLoading] = useState(true);
  const [laporanList, setLaporanList] = useState([]);
  const [error, setError] = useState("");
  const [viewingLaporan, setViewingLaporan] = useState(null); // { laporan, items } | null
  const [mencetakKurir, setMencetakKurir] = useState(false);
  const [errorCetakKurir, setErrorCetakKurir] = useState("");
  const [ukuranKertasKurir, setUkuranKertasKurir] = useState("8.5in 11in");

  useEffect(() => {
    supabaseFetch(token, "nota_settings?select=lebar_kertas_kurir,tinggi_kertas_kurir&limit=1")
      .then((rows) => {
        if (rows[0]) setUkuranKertasKurir(`${rows[0].lebar_kertas_kurir ?? 8.5}in ${rows[0].tinggi_kertas_kurir ?? 11}in`);
      })
      .catch(() => {}); // biarkan pakai default kalau gagal muat
  }, []);

  async function cetakOtomatisKurir() {
    setMencetakKurir(true);
    setErrorCetakKurir("");
    try {
      await cetakPdfOtomatis(<LaporanKurirDocContent laporan={viewingLaporan.laporan} items={viewingLaporan.items} />, ukuranKertasKurir, "atas");
      setViewingLaporan(null);
    } catch (e) {
      setErrorCetakKurir("Gagal cetak otomatis: " + e.message + " - pastikan print server jalan. Bisa pakai tombol \"Cetak Manual\" sebagai cadangan.");
    }
    setMencetakKurir(false);
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, `laporan_kurir?select=*&jenis_kurir=eq.${activeTab}&order=created_at.desc`);
      setLaporanList(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [activeTab]);

  async function bukaDokumen(laporan) {
    try {
      const items = await supabaseFetch(token, `laporan_kurir_items?select=*&laporan_kurir_id=eq.${laporan.id}&order=created_at.asc`);
      setViewingLaporan({ laporan, items });
    } catch (e) {
      alert("Gagal muat detail: " + e.message);
    }
  }

  return (
    <div>
      <PageHeader title="Laporan Kurir" subtitle="Laporan pengiriman per jenis kurir" />

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab("baraka")}
          style={{ padding: "9px 18px", borderRadius: 9, border: activeTab === "baraka" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: activeTab === "baraka" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}
        >
          Kurir Baraka
        </button>
        <button
          onClick={() => setActiveTab("toko")}
          style={{ padding: "9px 18px", borderRadius: 9, border: activeTab === "toko" ? "1.5px solid #E8A426" : "1.5px solid #E4E1DA", background: activeTab === "toko" ? "#FBF0D9" : "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}
        >
          Kurir Toko
        </button>
      </div>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorBox error={error} onRetry={load} />
      ) : laporanList.length === 0 ? (
        <EmptyState text="Belum ada laporan untuk kategori ini." />
      ) : (
        laporanList.map((l) => (
          <Card key={l.id} style={{ marginBottom: 12, border: l.jenis_laporan === "retur" ? "1.5px solid #FBEAEA" : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <p style={{ fontSize: 14.5, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>
                  {l.nama_kurir}
                  {l.jenis_laporan === "retur" && (
                    <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#FBEAEA", color: "#C0392B", verticalAlign: "middle" }}>RETUR</span>
                  )}
                </p>
                <p style={{ fontSize: 12, color: "#6B6F75", margin: 0 }}>
                  {l.jenis_laporan !== "retur" && l.jenis_kurir === "toko" && `Trip ${l.trip || 1} - `}{l.jumlah_koli} box - {new Date(l.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <button
                onClick={() => bukaDokumen(l)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
              >
                <FileEdit size={14} /> Lihat / Cetak
              </button>
            </div>
          </Card>
        ))
      )}

      {viewingLaporan && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 620, maxHeight: "88vh", overflowY: "auto", padding: 0 }}>
            <LaporanKurirDocContent laporan={viewingLaporan.laporan} items={viewingLaporan.items} />
            {errorCetakKurir && (
              <div style={{ margin: "0 36px 12px", padding: 12, borderRadius: 9, background: "#FBEAEA", color: "#C0392B", fontSize: 12, lineHeight: 1.5 }}>
                {errorCetakKurir}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, padding: "16px 36px 24px" }}>
              <button onClick={() => setViewingLaporan(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13 }}>
                Tutup
              </button>
              <button
                onClick={() => bukaTabPreviewCetak(<LaporanKurirDocContent laporan={viewingLaporan.laporan} items={viewingLaporan.items} />, "Bukti Serah Terima Paket", "8.5in 11in")}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#24272B", fontWeight: 600, fontSize: 12 }}
              >
                Cetak Manual
              </button>
              <button
                onClick={cetakOtomatisKurir}
                disabled={mencetakKurir}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "#24272B", color: "#fff", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                <Printer size={15} /> {mencetakKurir ? "Mencetak..." : "Cetak Otomatis"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// BUAT LAPORAN KURIR - pilih kurir -> scan paket -> isi form -> konfirmasi
// ============================================================
function BuatLaporanKurirPage({ token, role, userId, namaAkun }) {
  const isKurirAkun = role === "kurir";
  const [modeUtama, setModeUtama] = useState("serah_terima"); // "serah_terima" | "retur"
  const [step, setStep] = useState(isKurirAkun ? "scan" : "pilih_kurir"); // "pilih_kurir" | "scan" | "form"
  const [jenisKurir, setJenisKurir] = useState(isKurirAkun ? "toko" : null); // "baraka" | "toko"
  const [scannedList, setScannedList] = useState([]); // [{ no_nota, order_id }]
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanMsg, setScanMsg] = useState([]); // array riwayat pesan scan, terbaru di depan - supaya info lama tidak hilang tertimpa
  const [confirmingScan, setConfirmingScan] = useState(null); // order hasil scan (+ info box kalau relevan), nunggu konfirmasi tambah
  const [uploadingFotoScan, setUploadingFotoScan] = useState(false);
  const [boxProgress, setBoxProgress] = useState({}); // { [order_id]: [nomor box yang sudah dikonfirmasi, ...] } - khusus Kurir Toko + Pekanbaru
  const [orderSedangProses, setOrderSedangProses] = useState(null); // { orderId, noNota, totalBox } - order yang box-nya BELUM lengkap semua
  const [scanDitolakMsg, setScanDitolakMsg] = useState(null); // pesan penolakan terpisah, supaya tidak menimpa info scan order yang sedang aktif
  // Pesanan yang SUDAH discan lengkap dari halaman Siap Kirim (siap_lapor_kurir_at
  // terisi) - kurir bisa langsung tambahkan dari daftar ini tanpa scan ulang.
  const [siapDilaporkan, setSiapDilaporkan] = useState([]);
  const [loadingSiapDilaporkan, setLoadingSiapDilaporkan] = useState(true);
  async function loadSiapDilaporkan() {
    setLoadingSiapDilaporkan(true);
    try {
      const rows = await supabaseFetch(token, "orders?select=id,no_nota,jumlah_box_konfirmasi,bukti_serah_terima_kurir_url,clients(nama,kode)&status=eq.siap_dikirim&siap_lapor_kurir_at=not.is.null&order=siap_lapor_kurir_at.asc");
      setSiapDilaporkan(rows);
    } catch (e) { console.log("Gagal load siap dilaporkan:", e.message); }
    setLoadingSiapDilaporkan(false);
  }
  useEffect(() => { loadSiapDilaporkan(); }, []);

  // Tambahkan pesanan yang sudah discan lengkap sebelumnya (dari Siap
  // Kirim) langsung ke daftar scan, tanpa perlu scan ulang barcode-nya.
  function tambahDariSiapDilaporkan(o) {
    if (scannedListRef.current.some((s) => s.order_id === o.id)) {
      tambahPesanScan({ type: "error", text: `${o.no_nota} sudah ada di daftar.` });
      return;
    }
    setScannedList((prev) => [...prev, { no_nota: o.no_nota, order_id: o.id, jumlah_box: o.jumlah_box_konfirmasi || 1, bukti_serah_terima_kurir_url: o.bukti_serah_terima_kurir_url || null }]);
    setSiapDilaporkan((prev) => prev.filter((x) => x.id !== o.id));
    tambahPesanScan({ type: "ok", text: `${o.no_nota} ditambahkan (sudah discan lengkap ${o.jumlah_box_konfirmasi || 1} box dari Siap Kirim).` });
  }


  // Tambah pesan baru ke ATAS riwayat (bukan menimpa) - supaya kurir masih
  // bisa lihat info box sebelumnya sebagai pengingat, maksimal 8 terakhir.
  function tambahPesanScan(pesanBaru) {
    setScanMsg((prev) => [pesanBaru, ...prev].slice(0, 8));
  }
  const [viewingBoxDetail, setViewingBoxDetail] = useState(null); // { orderId, noNota, totalBox } | null
  const [inputManual, setInputManual] = useState("");
  const manualInputRef = useRef(null);
  const html5QrRef = useRef(null);

  const [namaKurir, setNamaKurir] = useState(isKurirAkun ? (namaAkun || "") : "");
  const [noHpKurir, setNoHpKurir] = useState("");
  const [saving, setSaving] = useState(false);
  const [berhasilData, setBerhasilData] = useState(null); // laporan yang baru dibuat, buat konfirmasi sukses
  const [tripKe, setTripKe] = useState(1);

  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  // Callback kamera (html5-qrcode) cuma didaftarkan SEKALI saat kamera
  // dibuka, jadi kalau baca state React langsung, ia akan pegang versi LAMA
  // terus (stale closure) - makanya baca dari ref ini yang selalu disinkron
  // ke nilai TERBARU lewat useEffect di bawah.
  const boxProgressRef = useRef(boxProgress);
  const scannedListRef = useRef(scannedList);
  const orderSedangProsesRef = useRef(orderSedangProses);
  useEffect(() => { boxProgressRef.current = boxProgress; }, [boxProgress]);
  useEffect(() => { scannedListRef.current = scannedList; }, [scannedList]);
  useEffect(() => { orderSedangProsesRef.current = orderSedangProses; }, [orderSedangProses]);

  useEffect(() => {
    return () => {
      if (html5QrRef.current) html5QrRef.current.stop().catch(() => {});
    };
  }, []);

  function pilihKurir(jenis) {
    setJenisKurir(jenis);
    setScannedList([]);
    setStep("scan");
  }

  function tutupKamera() {
    if (html5QrRef.current) {
      html5QrRef.current.stop().catch(() => {}).finally(() => {
        html5QrRef.current = null;
      });
    }
    setShowCamera(false);
  }

  async function mulaiScanKamera() {
    setCameraError("");
    setShowCamera(true);
    try {
      await loadHtml5Qrcode();
      setTimeout(async () => {
        try {
          const html5Qr = new window.Html5Qrcode("reader-kamera-laporan-kurir");
          html5QrRef.current = html5Qr;
          await html5Qr.start(
            { facingMode: "environment" },
            {
              fps: 5, qrbox: { width: 300, height: 150 },
              formatsToSupport: [window.Html5QrcodeSupportedFormats.CODE_128, window.Html5QrcodeSupportedFormats.QR_CODE],
            },
            (decodedText) => {
              tambahScan(decodedText);
            },
            () => { /* frame tanpa barcode terdeteksi - normal, diamkan */ }
          );
        } catch (e) {
          setCameraError("Gagal buka kamera: " + e.message + " (pastikan izinkan akses kamera di browser)");
        }
      }, 200);
    } catch (e) {
      setCameraError("Gagal muat library scanner: " + e.message);
    }
  }

  async function tambahScan(decodedText) {
    const rawKode = decodedText.trim();

    // Tutup kamera dulu setiap kali berhasil scan (sama seperti alur
    // konfirmasi biasa) - supaya video kamera tidak macet/freeze karena
    // terus aktif berbarengan sama perubahan tampilan lain.
    tutupKamera();

    // Parse kode unik per box - sekarang ada 2 kemungkinan format:
    // Format 1: "NOMOR_INDUK-NN-NOMORPRODUK" - barcode terbaru, sudah
    // sematkan nomor produk juga, misal NT...-01-888260601
    // Format 2: "NOMOR_INDUK-NN" - barcode versi lama, tanpa nomor produk
    // Kalau tidak ada pemisah "-NN" sama sekali, berarti kode polos
    // (non-boxed, misal Baraka) - pakai apa adanya.
    let kode = rawKode;
    let noBoxScan = null;
    const match3 = rawKode.match(/^(.+)-(\d{2,3})-(.+)$/);
    const match2 = rawKode.match(/^(.+)-(\d{2,3})$/);
    if (match3) {
      kode = match3[1];
      noBoxScan = parseInt(match3[2], 10);
    } else if (match2) {
      kode = match2[1];
      noBoxScan = parseInt(match2[2], 10);
    }

    if (scannedListRef.current.some((s) => s.no_nota === kode)) {
      tambahPesanScan({ type: "error", text: `${kode} sudah discan sebelumnya.` });
      return;
    }
    try {
      // Cuma boleh pesanan yang statusnya "Siap Dikirim" (sudah di-scan
      // outbound, tapi belum "Mulai Kirim") yang bisa diserahkan ke kurir.
      const rows = await supabaseFetch(token, `orders?select=id,no_nota,status,tujuan_kota,bukti_serah_terima_kurir_url,clients(nama,kota),order_items(qty),picking_selesai_at&no_nota=eq.${kode}`);
      if (!rows || rows.length === 0) {
        tambahPesanScan({ type: "error", text: `Nomor "${kode}" tidak ditemukan.` });
        return;
      }
      if (rows[0].status !== "siap_dikirim") {
        const posisiSekarang = {
          menunggu_persetujuan: "masih menunggu persetujuan admin",
          ditolak: "sudah ditolak",
          menunggu_pembayaran: "masih menunggu pembayaran",
          menunggu_pengiriman: rows[0].picking_selesai_at ? "masih di Picking List (sudah picking, belum upload bukti pengemasan)" : "masih di Picking List (belum di-picking)",
          proses_dikirim: "sudah dalam proses pengiriman (sudah diserahkan ke kurir sebelumnya)",
          diretur: "sedang dalam proses retur",
          selesai: "sudah selesai/terkirim",
        }[rows[0].status] || `statusnya "${rows[0].status}"`;
        tambahPesanScan({ type: "error", text: `${rows[0].no_nota} belum bisa discan di sini - paket ${posisiSekarang}.` });
        return;
      }

      // Kalau masih ada order LAIN yang box-nya belum lengkap semua, tolak
      // scan order berbeda ini - tapi JANGAN timpa scanMsg (info progress
      // order yang sedang aktif tetap harus tampil, cuma pesan tolaknya
      // ditaruh terpisah).
      const sedangProses = orderSedangProsesRef.current;
      if (sedangProses && sedangProses.orderId !== rows[0].id) {
        setScanDitolakMsg(`Selesaikan dulu semua box ${sedangProses.noNota} sebelum scan order lain.`);
        return;
      }

      const kotaTujuanAsli = rows[0].tujuan_kota || rows[0].clients?.kota;
      const isPekanbaru = !!(kotaTujuanAsli && kotaTujuanAsli.trim().toLowerCase().includes("pekanbaru"));

      if (jenisKurir === "toko" && isPekanbaru) {
        // Order Pekanbaru + Kurir Toko - tiap box punya kode unik sendiri
        // (NOMOR_INDUK-01, -02, dst), jadi box mana yang discan bisa
        // dipastikan LANGSUNG dari kodenya, tidak perlu tebak urutan lagi.
        const totalBox = (rows[0].order_items || []).reduce((sum, it) => sum + Number(it.qty || 0), 0) || 1;
        if (noBoxScan === null) {
          tambahPesanScan({ type: "error", text: `Barcode ini belum punya nomor box - cetak ulang barcode untuk order ini.` });
          return;
        }
        if (noBoxScan < 1 || noBoxScan > totalBox) {
          tambahPesanScan({ type: "error", text: `Nomor box ${noBoxScan} tidak valid (order ini cuma punya ${totalBox} box).` });
          return;
        }
        const sudahScan = boxProgressRef.current[rows[0].id] || [];
        if (sudahScan.includes(noBoxScan)) {
          tambahPesanScan({ type: "error", text: `Box ${noBoxScan} sudah discan sebelumnya.` });
          return;
        }
        setScanDitolakMsg(null);
        setOrderSedangProses({ orderId: rows[0].id, noNota: rows[0].no_nota, totalBox });
        setConfirmingScan({ ...rows[0], noBox: noBoxScan, totalBox });
        mainkanBeepScan();
      } else {
        setConfirmingScan(rows[0]);
        mainkanBeepScan();
      }
    } catch (e) {
      tambahPesanScan({ type: "error", text: "Gagal cek nomor: " + e.message });
    }
  }

  // Upload foto bukti pengiriman WAJIB sebelum bisa konfirmasi order hasil
  // scan - disimpan ke kolom bukti_serah_terima_kurir_url (kolom TERPISAH
  // dari bukti_pengiriman_url yang dipakai buat foto pengemasan/Outbound,
  // supaya tidak saling menimpa), lalu ditampilkan di menu Review
  // Pengiriman sebagai "Bukti Serah Terima Kurir".
  async function uploadFotoBuktiScan(file) {
    if (!confirmingScan || !file) return;
    setUploadingFotoScan(true);
    try {
      const compressed = await compressImage(file);
      const { ext, contentType } = infoFileTerkompresi(compressed, file);
      const filePath = `bukti_serah_terima_kurir_url-${confirmingScan.id}-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/bukti-pengiriman/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": contentType },
        body: compressed,
      });
      if (!res.ok) throw new Error(await res.text());
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/bukti-pengiriman/${filePath}`;
      await supabaseFetch(token, `orders?id=eq.${confirmingScan.id}`, { method: "PATCH", body: JSON.stringify({ bukti_serah_terima_kurir_url: publicUrl }) });
      setConfirmingScan((prev) => (prev ? { ...prev, bukti_serah_terima_kurir_url: publicUrl } : prev));
    } catch (e) {
      alert("Gagal upload foto: " + e.message);
    }
    setUploadingFotoScan(false);
  }

  // Sama seperti uploadFotoBuktiScan, tapi bisa dipakai buat paket
  // MANAPUN di scannedList (bukan cuma confirmingScan) - dipakai di step
  // terakhir untuk paket yang "terlewat" foto-nya (misal dari jalur Siap
  // Kirim yang tidak pernah lewat validasi wajib foto).
  const [uploadingFotoPaket, setUploadingFotoPaket] = useState(null); // order_id yang lagi diupload
  async function uploadFotoUntukPaket(orderId, file) {
    if (!file) return;
    setUploadingFotoPaket(orderId);
    try {
      const compressed = await compressImage(file);
      const { ext, contentType } = infoFileTerkompresi(compressed, file);
      const filePath = `bukti_serah_terima_kurir_url-${orderId}-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/bukti-pengiriman/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": contentType },
        body: compressed,
      });
      if (!res.ok) throw new Error(await res.text());
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/bukti-pengiriman/${filePath}`;
      await supabaseFetch(token, `orders?id=eq.${orderId}`, { method: "PATCH", body: JSON.stringify({ bukti_serah_terima_kurir_url: publicUrl }) });
      setScannedList((prev) => prev.map((s) => (s.order_id === orderId ? { ...s, bukti_serah_terima_kurir_url: publicUrl } : s)));
    } catch (e) {
      alert("Gagal upload foto: " + e.message);
    }
    setUploadingFotoPaket(null);
  }

  function konfirmasiTambahScan() {
    if (!confirmingScan) return;
    if (confirmingScan.totalBox) {
      // Order Pekanbaru + Kurir Toko - tambahkan nomor box ini ke daftar
      // box yang sudah dikonfirmasi untuk order tersebut
      const daftarBoxBaru = [...(boxProgress[confirmingScan.id] || []), confirmingScan.noBox];
      setBoxProgress((prev) => ({ ...prev, [confirmingScan.id]: daftarBoxBaru }));
      if (daftarBoxBaru.length >= confirmingScan.totalBox) {
        // Semua box sudah dikonfirmasi - baru order-nya benar-benar
        // ditambahkan ke daftar serah terima, dan buka lagi kesempatan
        // scan order LAIN (tidak terkunci ke order ini lagi)
        setScannedList((prev) => [...prev, { no_nota: confirmingScan.no_nota, order_id: confirmingScan.id, jumlah_box: confirmingScan.totalBox, bukti_serah_terima_kurir_url: confirmingScan.bukti_serah_terima_kurir_url }]);
        tambahPesanScan({ type: "ok", text: `${confirmingScan.no_nota} lengkap (${confirmingScan.totalBox} box) - ditambahkan ke daftar.` });
        setOrderSedangProses(null);
      } else {
        tambahPesanScan({ type: "ok", text: `${confirmingScan.no_nota} - box ${confirmingScan.noBox}/${confirmingScan.totalBox} tercatat (${daftarBoxBaru.length}/${confirmingScan.totalBox} total). Scan box lain.`, orderId: confirmingScan.id, noNota: confirmingScan.no_nota, totalBox: confirmingScan.totalBox });
      }
    } else {
      setScannedList((prev) => [...prev, { no_nota: confirmingScan.no_nota, order_id: confirmingScan.id, bukti_serah_terima_kurir_url: confirmingScan.bukti_serah_terima_kurir_url }]);
      tambahPesanScan({ type: "ok", text: `${confirmingScan.no_nota} berhasil ditambahkan.` });
    }
    setConfirmingScan(null);
  }

  function hapusScan(no_nota) {
    setScannedList((prev) => prev.filter((s) => s.no_nota !== no_nota));
  }

  // ---------- CANVAS TANDA TANGAN ----------
  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }
  function mulaiGambar(e) {
    isDrawingRef.current = true;
    lastPosRef.current = getPos(e);
  }
  function gambar(e) {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const pos = getPos(e);
    ctx.strokeStyle = "#24272B";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPosRef.current = pos;
  }
  function selesaiGambar() {
    isDrawingRef.current = false;
  }
  function bersihkanTtd() {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }

  async function lanjutKeForm() {
    if (isKurirAkun) {
      // Hitung trip otomatis - berapa laporan yang SUDAH dibuat akun ini hari
      // ini, trip berikutnya = jumlah itu + 1.
      try {
        const awalHari = new Date();
        awalHari.setHours(0, 0, 0, 0);
        const rows = await supabaseFetch(token, `laporan_kurir?select=id&dibuat_oleh=eq.${userId}&created_at=gte.${awalHari.toISOString()}`);
        setTripKe((rows?.length || 0) + 1);
      } catch (e) {
        setTripKe(1);
      }
    }
    setStep("form");
  }

  async function submitLaporan() {
    if (!isKurirAkun && !namaKurir.trim()) {
      alert("Isi dulu nama kurir.");
      return;
    }
    if (scannedList.length === 0) {
      alert("Belum ada paket yang discan.");
      return;
    }
    // Lapisan pengaman terakhir - pastikan SEMUA paket di daftar sudah
    // punya foto bukti serah terima, termasuk yang ditambahkan lewat
    // jalur "Sudah Discan Lengkap di Siap Kirim" (yang tidak pernah
    // lewat validasi wajib foto sebelumnya).
    const belumAdaFoto = scannedList.filter((s) => !s.bukti_serah_terima_kurir_url);
    if (belumAdaFoto.length > 0) {
      alert(`Belum bisa kirim laporan - ${belumAdaFoto.length} paket belum ada foto bukti serah terima: ${belumAdaFoto.map((s) => s.no_nota).join(", ")}. Upload dulu foto untuk paket-paket ini di bawah.`);
      return;
    }
    setSaving(true);
    try {
      // Akun kurir toko tidak perlu tanda tangan - cuma untuk Baraka/kurir
      // eksternal yang diinput manual oleh admin/owner.
      let ttdUrl = null;
      if (!isKurirAkun) {
        const canvas = canvasRef.current;
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        if (blob) {
          const filePath = `ttd-kurir-${Date.now()}.png`;
          const res = await fetch(`${SUPABASE_URL}/storage/v1/object/produk-gambar/${filePath}`, {
            method: "POST",
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "image/png" },
            body: blob,
          });
          if (res.ok) ttdUrl = `${SUPABASE_URL}/storage/v1/object/public/produk-gambar/${filePath}`;
        }
      }

      const [laporan] = await supabaseFetch(token, "laporan_kurir", {
        method: "POST",
        body: JSON.stringify({
          jenis_kurir: jenisKurir,
          nama_kurir: isKurirAkun ? (namaAkun || "Kurir Toko") : namaKurir.trim(),
          no_hp_kurir: isKurirAkun ? null : (noHpKurir.trim() || null),
          ttd_kurir_url: ttdUrl, jumlah_koli: totalBoxKeseluruhan,
          trip: isKurirAkun ? tripKe : 1,
          dibuat_oleh: isKurirAkun ? userId : null,
        }),
      });

      await supabaseFetch(token, "laporan_kurir_items", {
        method: "POST",
        body: JSON.stringify(scannedList.map((s) => ({ laporan_kurir_id: laporan.id, order_id: s.order_id, no_nota: s.no_nota, catatan: s.catatan || null, jumlah_box: s.jumlah_box || 1 }))),
      });

      // Bikin laporan kurir = serah terima paket ke kurir - jadi semua order
      // yang tercantum di laporan ini ikut dipindah statusnya ke
      // "Proses Pengiriman" (sama seperti tombol "Mulai Kirim" biasa).
      const now = new Date().toISOString();
      const orderIds = scannedList.map((s) => s.order_id);
      await supabaseFetch(token, `orders?id=in.(${orderIds.join(",")})`, {
        method: "PATCH",
        body: JSON.stringify({ status: "proses_dikirim", tanggal_dikirim: now }),
      });

      setBerhasilData(laporan);
    } catch (e) {
      alert("Gagal simpan laporan: " + e.message);
    }
    setSaving(false);
  }

  function mulaiLagi() {
    setStep(isKurirAkun ? "scan" : "pilih_kurir");
    setJenisKurir(isKurirAkun ? "toko" : null);
    setScannedList([]);
    setNamaKurir("");
    setNoHpKurir("");
    setBerhasilData(null);
    setScanMsg([]);
  }

  // ---------- MODE RETUR (terpisah total dari alur serah terima) ----------
  if (modeUtama === "retur") {
    return <BuatReturPage token={token} role={role} userId={userId} namaAkun={namaAkun} onGantiMode={() => setModeUtama("serah_terima")} />;
  }

  // ---------- TAMPILAN SUKSES ----------
  if (berhasilData) {
    return (
      <div>
        <Card style={{ textAlign: "center", padding: 40, maxWidth: 440, margin: "0 auto" }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#D8E9E6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
            <Check size={28} color="#28685D" />
          </div>
          <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 6px" }}>Laporan Berhasil Dibuat</p>
          <p style={{ fontSize: 13, color: "#6B6F75", margin: "0 0 24px" }}>
            {scannedList.reduce((sum, s) => sum + (s.jumlah_box || 1), 0)} koli tercatat untuk {jenisKurir === "baraka" ? "Kurir Baraka" : "Kurir Toko"} - {namaKurir}
          </p>
          <button onClick={mulaiLagi} style={{ padding: "12px 28px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}>
            Buat Laporan Baru
          </button>
        </Card>
      </div>
    );
  }

  // ---------- STEP 1: PILIH KURIR ----------
  if (step === "pilih_kurir") {
    return (
      <div>
        <PageHeader title="Buat Laporan Kurir" subtitle="Pilih jenis kurir untuk mulai serah terima paket" />

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button
            onClick={() => setModeUtama("serah_terima")}
            style={{ padding: "9px 18px", borderRadius: 9, border: "1.5px solid #E8A426", background: "#FBF0D9", color: "#24272B", fontSize: 13, fontWeight: 700 }}
          >
            Serah Terima Paket
          </button>
          <button
            onClick={() => setModeUtama("retur")}
            style={{ padding: "9px 18px", borderRadius: 9, border: "1.5px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}
          >
            Retur Paket
          </button>
        </div>

        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div onClick={() => pilihKurir("baraka")} style={{ cursor: "pointer" }}>
            <Card style={{ width: 220, textAlign: "center", padding: 28 }}>
              <Truck size={30} color="#8A6A1A" style={{ marginBottom: 10 }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: "#24272B", margin: 0 }}>Kurir Baraka</p>
            </Card>
          </div>
          <div onClick={() => pilihKurir("toko")} style={{ cursor: "pointer" }}>
            <Card style={{ width: 220, textAlign: "center", padding: 28 }}>
              <Truck size={30} color="#28685D" style={{ marginBottom: 10 }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: "#24272B", margin: 0 }}>Kurir Toko</p>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ---------- STEP 2: SCAN PAKET ----------
  if (step === "scan") {
    return (
      <div>
        {!isKurirAkun && (
          <button onClick={() => setStep("pilih_kurir")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#6B6F75", fontSize: 13, marginBottom: 14, padding: 0 }}>
            <ChevronLeft size={16} /> Ganti Kurir
          </button>
        )}
        <PageHeader title={`Scan Paket - ${jenisKurir === "baraka" ? "Kurir Baraka" : "Kurir Toko"}`} subtitle="Scan barcode/QR tiap paket yang diserahkan" />

        {isKurirAkun && (
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button
              onClick={() => setModeUtama("serah_terima")}
              style={{ padding: "9px 18px", borderRadius: 9, border: "1.5px solid #E8A426", background: "#FBF0D9", color: "#24272B", fontSize: 13, fontWeight: 700 }}
            >
              Serah Terima Paket
            </button>
            <button
              onClick={() => setModeUtama("retur")}
              style={{ padding: "9px 18px", borderRadius: 9, border: "1.5px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 13, fontWeight: 700 }}
            >
              Retur Paket
            </button>
          </div>
        )}

        {modeUtama === "serah_terima" && siapDilaporkan.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 10px" }}>
              Sudah Discan Lengkap di Siap Kirim ({siapDilaporkan.length}) - Tap Buat Tambahkan
            </p>
            {siapDilaporkan.map((o) => (
              <button
                key={o.id}
                onClick={() => tambahDariSiapDilaporkan(o)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #D8E9E6", background: "#F0F8F6", marginBottom: 8, textAlign: "left" }}
              >
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: 0 }}>{o.no_nota}</p>
                  <p style={{ fontSize: 11.5, color: "#6B6F75", margin: "2px 0 0" }}>{o.clients?.nama} - {o.jumlah_box_konfirmasi} box</p>
                </div>
                <Check size={16} color="#28685D" />
              </button>
            ))}
          </Card>
        )}

        <Card style={{ marginBottom: 16 }}>
          <button
            onClick={mulaiScanKamera}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: 13, borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 14, marginBottom: 14 }}
          >
            <Camera size={17} /> Scan Pakai Kamera HP
          </button>

          <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 8px", textAlign: "center" }}>atau</p>

          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F7F5F1", borderRadius: 10, padding: "10px 14px" }}>
            <ScanLine size={20} color="#8A6A1A" />
            <input
              ref={manualInputRef}
              value={inputManual}
              onChange={(e) => setInputManual(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && inputManual.trim()) { tambahScan(inputManual); setInputManual(""); } }}
              placeholder="Scan pakai alat scanner fisik, atau ketik manual lalu Enter..."
              style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 14, fontWeight: 600, color: "#24272B" }}
            />
          </div>
          <p style={{ fontSize: 11, color: "#9CA0A6", margin: "8px 0 0", textAlign: "center" }}>
            Kompatibel dengan alat scanner barcode USB/Bluetooth (bekerja seperti keyboard) - lebih akurat untuk barcode CODE128 dibanding kamera HP.
          </p>

          {scanMsg.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {scanMsg.map((m, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: 10, borderRadius: 9, background: m.type === "ok" ? "#D8E9E6" : "#FBEAEA", color: m.type === "ok" ? "#28685D" : "#C0392B", fontSize: 12.5, fontWeight: 600, opacity: i === 0 ? 1 : 0.7 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {m.type === "ok" ? <Check size={15} /> : <AlertCircle size={15} />} {m.text}
                  </span>
                  {m.totalBox && (
                    <button
                      onClick={() => setViewingBoxDetail({ orderId: m.orderId, noNota: m.noNota, totalBox: m.totalBox })}
                      style={{ background: "none", border: "none", color: "#28685D", fontSize: 11.5, fontWeight: 700, textDecoration: "underline", flexShrink: 0, padding: 0 }}
                    >
                      Lihat Detail
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {scanDitolakMsg && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: 10, borderRadius: 9, background: "#FBEAEA", color: "#C0392B", fontSize: 12.5, fontWeight: 600 }}>
              <X size={15} /> {scanDitolakMsg}
            </div>
          )}
        </Card>

        <Card style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 4px" }}>Jumlah Box</p>
          <p className="disp" style={{ fontSize: 32, fontWeight: 700, color: "#24272B", margin: 0 }}>
            {scannedList.reduce((sum, s) => sum + (s.jumlah_box || boxProgress[s.order_id]?.length || 1), 0)}
          </p>
        </Card>

        {scannedList.length > 0 && (
          <Card style={{ marginBottom: 20, padding: 0, overflow: "hidden" }}>
            {scannedList.map((s, i) => (
              <div key={s.no_nota} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderTop: i > 0 ? "1px solid #EDEAE3" : "none" }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#24272B" }}>{s.no_nota}</span>
                  {s.catatan && <p style={{ fontSize: 11, color: "#9CA0A6", margin: "2px 0 0" }}>{s.catatan}</p>}
                </div>
                <button onClick={() => hapusScan(s.no_nota)} style={{ background: "none", border: "none", color: "#C0392B", fontSize: 11.5, fontWeight: 700 }}>Hapus</button>
              </div>
            ))}
          </Card>
        )}

        <button
          onClick={lanjutKeForm}
          disabled={scannedList.length === 0}
          style={{ width: "100%", padding: 13, borderRadius: 10, border: "none", background: scannedList.length === 0 ? "#E4E1DA" : "#28685D", color: scannedList.length === 0 ? "#9CA0A6" : "#fff", fontWeight: 700, fontSize: 14 }}
        >
          Lanjut Isi Form ({scannedList.reduce((sum, s) => sum + (s.jumlah_box || 1), 0)} koli)
        </button>

        {showCamera && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Arahkan kamera ke barcode/QR paket</p>
            <div id="reader-kamera-laporan-kurir" style={{ width: "100%", maxWidth: 400, borderRadius: 12, overflow: "hidden" }} />
            {scanMsg.length > 0 && !confirmingScan && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, padding: "10px 14px", borderRadius: 9, background: scanMsg[0].type === "ok" ? "#D8E9E6" : "#FBEAEA", color: scanMsg[0].type === "ok" ? "#28685D" : "#C0392B", fontSize: 12.5, fontWeight: 600, maxWidth: 400, textAlign: "center" }}>
                {scanMsg[0].type === "ok" ? <Check size={15} /> : <AlertCircle size={15} />} {scanMsg[0].text}
              </div>
            )}
            {cameraError && <p style={{ color: "#F5A9A0", fontSize: 12.5, marginTop: 14, textAlign: "center" }}>{cameraError}</p>}
            <button onClick={tutupKamera} style={{ marginTop: 20, padding: "12px 24px", borderRadius: 10, border: "1.5px solid #fff", background: "none", color: "#fff", fontWeight: 700, fontSize: 13.5 }}>
              Tutup Kamera
            </button>
          </div>
        )}

        {/* POPUP KONFIRMASI SETELAH SCAN COCOK */}
        {confirmingScan && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 20 }}>
            <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 380, padding: 26 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#D8E9E6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <ScanLine size={20} color="#28685D" />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: "#9CA0A6", margin: 0, fontWeight: 700, textTransform: "uppercase" }}>Scan Berhasil</p>
                  <p className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: 0 }}>{confirmingScan.no_nota}</p>
                </div>
              </div>
              <p style={{ fontSize: 13, color: "#6B6F75", margin: "0 0 8px" }}>{confirmingScan.clients?.nama}</p>
              {confirmingScan.totalBox && (
                <p style={{ fontSize: 15, fontWeight: 700, color: "#8A6A1A", margin: "0 0 16px", padding: "8px 12px", background: "#FBF0D9", borderRadius: 8, display: "inline-block" }}>
                  No. Box: {confirmingScan.noBox} / {confirmingScan.totalBox}
                </p>
              )}
              <p style={{ fontSize: 13, color: "#24272B", fontWeight: 600, margin: "0 0 12px" }}>
                {confirmingScan.totalBox
                  ? `Konfirmasi box ke-${confirmingScan.noBox} paket ini?`
                  : "Tambahkan paket ini ke daftar serah terima?"}
              </p>

              {(() => {
                // Untuk order multi-box (Kurir Toko + Pekanbaru) - foto CUMA
                // wajib di box TERAKHIR (saat semua box sudah terkumpul),
                // bukan di setiap box. Box-box sebelumnya boleh langsung
                // dikonfirmasi tanpa foto.
                const adalahBoxTerakhir = confirmingScan.totalBox
                  ? (boxProgress[confirmingScan.id]?.length || 0) + 1 >= confirmingScan.totalBox
                  : true;
                const fotoWajib = adalahBoxTerakhir;
                const fotoSudahAda = !!confirmingScan.bukti_serah_terima_kurir_url;
                const bolehLanjut = !fotoWajib || fotoSudahAda;

                return (
                  <>
                    {fotoWajib && (
                      <>
                        <label style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" }}>
                          Foto Bukti Pengiriman (wajib)
                        </label>
                        {fotoSudahAda ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                            <img src={confirmingScan.bukti_serah_terima_kurir_url} alt="Bukti" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} />
                            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "#28685D", fontSize: 12, fontWeight: 700 }}>
                              <Check size={14} /> Foto terupload
                            </span>
                          </div>
                        ) : (
                          <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "12px", borderRadius: 9, border: "1.5px dashed #E8A426", background: "#FFFBF0", color: "#8A6A1A", fontSize: 12.5, fontWeight: 700, cursor: "pointer", marginBottom: 18 }}>
                            <UploadCloud size={15} /> {uploadingFotoScan ? "Mengupload..." : "Ambil/Upload Foto"}
                            <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={uploadingFotoScan} onChange={(e) => { if (e.target.files[0]) uploadFotoBuktiScan(e.target.files[0]); }} />
                          </label>
                        )}
                      </>
                    )}

                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => setConfirmingScan(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
                        Batalkan
                      </button>
                      <button
                        onClick={konfirmasiTambahScan}
                        disabled={!bolehLanjut}
                        style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: bolehLanjut ? "#28685D" : "#E4E1DA", color: bolehLanjut ? "#fff" : "#9CA0A6", fontWeight: 700, fontSize: 13.5 }}
                      >
                        {confirmingScan.totalBox ? "Konfirmasi" : "Tambahkan"}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* MODAL DETAIL BOX - lihat mana yang sudah/belum discan */}
        {viewingBoxDetail && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 20 }}>
            <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 380, maxHeight: "80vh", overflowY: "auto", padding: 26 }}>
              <p className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{viewingBoxDetail.noNota}</p>
              <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "0 0 16px" }}>
                {(boxProgress[viewingBoxDetail.orderId] || []).length} / {viewingBoxDetail.totalBox} box sudah discan
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 20 }}>
                {Array.from({ length: viewingBoxDetail.totalBox }, (_, i) => i + 1).map((noBox) => {
                  const sudahDiscan = (boxProgress[viewingBoxDetail.orderId] || []).includes(noBox);
                  return (
                    <div
                      key={noBox}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
                        padding: "9px 4px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                        background: sudahDiscan ? "#D8E9E6" : "#FBEAEA",
                        color: sudahDiscan ? "#28685D" : "#C0392B",
                        border: sudahDiscan ? "1.5px solid #28685D" : "1.5px solid #F5B7B1",
                      }}
                    >
                      {sudahDiscan ? <Check size={12} /> : <X size={12} />} {noBox}
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setViewingBoxDetail(null)} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
                Tutup
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- STEP 3: FORM KURIR + TTD ----------
  const fieldStyle = { width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, outline: "none" };
  const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" };

  const totalBoxKeseluruhan = scannedList.reduce((sum, s) => sum + (s.jumlah_box || boxProgress[s.order_id]?.length || 1), 0);

  return (
    <div>
      <button onClick={() => setStep("scan")} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#6B6F75", fontSize: 13, marginBottom: 14, padding: 0 }}>
        <ChevronLeft size={16} /> Kembali ke Scan
      </button>
      <PageHeader title={isKurirAkun ? "Konfirmasi Laporan" : "Data Kurir & Tanda Tangan"} subtitle={`${totalBoxKeseluruhan} box - ${jenisKurir === "baraka" ? "Kurir Baraka" : "Kurir Toko"}`} />

      {isKurirAkun ? (
        <Card style={{ maxWidth: 460 }}>
          <div style={{ display: "flex", gap: 14, marginBottom: 20 }}>
            <div style={{ flex: 1, background: "#F7F5F1", borderRadius: 10, padding: 16, textAlign: "center" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 6px" }}>Trip Ke</p>
              <p className="disp" style={{ fontSize: 28, fontWeight: 700, color: "#24272B", margin: 0 }}>{tripKe}</p>
            </div>
            <div style={{ flex: 1, background: "#F7F5F1", borderRadius: 10, padding: 16, textAlign: "center" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 6px" }}>Jumlah Box</p>
              <p className="disp" style={{ fontSize: 28, fontWeight: 700, color: "#24272B", margin: 0 }}>{totalBoxKeseluruhan}</p>
            </div>
          </div>
          <p style={{ fontSize: 12.5, color: "#6B6F75", margin: "0 0 20px", textAlign: "center" }}>
            Atas nama: <strong>{namaAkun || "Kurir Toko"}</strong>
          </p>

          {scannedList.some((s) => !s.bukti_serah_terima_kurir_url) && (
            <div style={{ background: "#FBEAEA", borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#C0392B", margin: "0 0 10px" }}>
                Wajib upload foto bukti serah terima untuk paket berikut sebelum bisa kirim laporan:
              </p>
              {scannedList.filter((s) => !s.bukti_serah_terima_kurir_url).map((s) => (
                <div key={s.order_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: "#24272B" }}>{s.no_nota}</span>
                  <label style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: "1.5px dashed #C0392B", background: "#fff", color: "#C0392B", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                    <UploadCloud size={13} /> {uploadingFotoPaket === s.order_id ? "Mengupload..." : "Upload Foto"}
                    <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={uploadingFotoPaket === s.order_id} onChange={(e) => { if (e.target.files[0]) uploadFotoUntukPaket(s.order_id, e.target.files[0]); }} />
                  </label>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={submitLaporan}
            disabled={saving || scannedList.some((s) => !s.bukti_serah_terima_kurir_url)}
            style={{ width: "100%", padding: 13, borderRadius: 10, border: "none", background: saving || scannedList.some((s) => !s.bukti_serah_terima_kurir_url) ? "#E4E1DA" : "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 14 }}
          >
            {saving ? "Menyimpan..." : "Konfirmasi Laporan"}
          </button>
        </Card>
      ) : (
      <Card style={{ maxWidth: 460 }}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Nama Kurir</label>
          <input value={namaKurir} onChange={(e) => setNamaKurir(e.target.value)} style={fieldStyle} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>No. HP Kurir</label>
          <input value={noHpKurir} onChange={(e) => setNoHpKurir(e.target.value)} style={fieldStyle} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>Tanda Tangan Kurir</label>
        </div>
        <canvas
          ref={canvasRef}
          width={400} height={160}
          style={{ width: "100%", height: 160, border: "1.5px dashed #E4E1DA", borderRadius: 9, background: "#FAFAF8", touchAction: "none" }}
          onMouseDown={mulaiGambar} onMouseMove={gambar} onMouseUp={selesaiGambar} onMouseLeave={selesaiGambar}
          onTouchStart={mulaiGambar} onTouchMove={gambar} onTouchEnd={selesaiGambar}
        />
        <button onClick={bersihkanTtd} style={{ marginTop: 8, padding: "6px 12px", borderRadius: 7, border: "1px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontSize: 11.5, fontWeight: 600 }}>
          Hapus Tanda Tangan
        </button>

        {scannedList.some((s) => !s.bukti_serah_terima_kurir_url) && (
          <div style={{ background: "#FBEAEA", borderRadius: 10, padding: 14, marginTop: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#C0392B", margin: "0 0 10px" }}>
              Wajib upload foto bukti serah terima untuk paket berikut sebelum bisa kirim laporan:
            </p>
            {scannedList.filter((s) => !s.bukti_serah_terima_kurir_url).map((s) => (
              <div key={s.order_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#24272B" }}>{s.no_nota}</span>
                <label style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 7, border: "1.5px dashed #C0392B", background: "#fff", color: "#C0392B", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                  <UploadCloud size={13} /> {uploadingFotoPaket === s.order_id ? "Mengupload..." : "Upload Foto"}
                  <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={uploadingFotoPaket === s.order_id} onChange={(e) => { if (e.target.files[0]) uploadFotoUntukPaket(s.order_id, e.target.files[0]); }} />
                </label>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={submitLaporan}
          disabled={saving || scannedList.some((s) => !s.bukti_serah_terima_kurir_url)}
          style={{ width: "100%", marginTop: 20, padding: 13, borderRadius: 10, border: "none", background: saving || scannedList.some((s) => !s.bukti_serah_terima_kurir_url) ? "#E4E1DA" : "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 14 }}
        >
          {saving ? "Menyimpan..." : "Konfirmasi Laporan"}
        </button>
      </Card>
      )}
    </div>
  );
}

// ============================================================
// BUAT RETUR - scan paket yang mau diretur, status order langsung
// jadi "diretur" (perlu konfirmasi bukti+alasan nanti di Proses Pengiriman)
// ============================================================
function BuatReturPage({ token, role, userId, namaAkun, onGantiMode }) {
  const [scannedList, setScannedList] = useState([]); // [{ no_nota, order_id, nama }]
  const [boxProgress, setBoxProgress] = useState({}); // { [order_id]: [nomor box yang sudah discan retur, ...] }
  const [orderSedangProses, setOrderSedangProses] = useState(null); // { orderId, noNota, totalBox } - order multi-box yang belum lengkap semua di-scan
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanMsg, setScanMsg] = useState(null);
  const [confirmingScan, setConfirmingScan] = useState(null);
  const [inputManual, setInputManual] = useState("");
  const [saving, setSaving] = useState(false);
  const [berhasil, setBerhasil] = useState(false);
  const html5QrRef = useRef(null);

  // Callback kamera (html5-qrcode) cuma didaftarkan SEKALI saat kamera
  // dibuka, jadi kalau baca state React langsung, ia akan pegang versi LAMA
  // terus (stale closure) kalau scan berturut-turut cepat - makanya baca
  // dari ref ini yang selalu disinkron ke nilai TERBARU.
  const boxProgressRef = useRef(boxProgress);
  const scannedListRef = useRef(scannedList);
  const orderSedangProsesRef = useRef(orderSedangProses);
  useEffect(() => { boxProgressRef.current = boxProgress; }, [boxProgress]);
  useEffect(() => { scannedListRef.current = scannedList; }, [scannedList]);
  useEffect(() => { orderSedangProsesRef.current = orderSedangProses; }, [orderSedangProses]);

  useEffect(() => {
    return () => {
      if (html5QrRef.current) html5QrRef.current.stop().catch(() => {});
    };
  }, []);

  function tutupKamera() {
    if (html5QrRef.current) {
      html5QrRef.current.stop().catch(() => {}).finally(() => { html5QrRef.current = null; });
    }
    setShowCamera(false);
  }

  async function mulaiScanKamera() {
    setCameraError("");
    setShowCamera(true);
    try {
      await loadHtml5Qrcode();
      setTimeout(async () => {
        try {
          const html5Qr = new window.Html5Qrcode("reader-kamera-retur");
          html5QrRef.current = html5Qr;
          await html5Qr.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 300, height: 150 }, formatsToSupport: [window.Html5QrcodeSupportedFormats.CODE_128, window.Html5QrcodeSupportedFormats.QR_CODE] },
            (decodedText) => { tambahScan(decodedText); },
            () => {}
          );
        } catch (e) {
          setCameraError("Gagal buka kamera: " + e.message);
        }
      }, 200);
    } catch (e) {
      setCameraError("Gagal muat library scanner: " + e.message);
    }
  }

  async function tambahScan(decodedText) {
    const rawKode = decodedText.trim();
    // Parse kode unik per box - sama seperti mode serah terima. Format
    // barcode: "NOMOR_INDUK-NN-NOMORPRODUK" atau "NOMOR_INDUK-NN" (versi
    // lama) atau kode polos tanpa box (non-boxed, misal Baraka).
    let kode = rawKode;
    let noBoxScan = null;
    const match3 = rawKode.match(/^(.+)-(\d{2,3})-(.+)$/);
    const match2 = rawKode.match(/^(.+)-(\d{2,3})$/);
    if (match3) {
      kode = match3[1];
      noBoxScan = parseInt(match3[2], 10);
    } else if (match2) {
      kode = match2[1];
      noBoxScan = parseInt(match2[2], 10);
    }

    if (scannedListRef.current.some((s) => s.no_nota === kode)) {
      setScanMsg({ type: "error", text: `${kode} sudah discan sebelumnya.` });
      return;
    }
    // Kalau masih ada order LAIN yang box-nya belum lengkap semua, tolak
    // scan order berbeda dulu (sama seperti mode serah terima).
    const sedangProses = orderSedangProsesRef.current;
    if (sedangProses && sedangProses.orderId && kode !== sedangProses.noNota) {
      setScanMsg({ type: "error", text: `Selesaikan dulu semua box ${sedangProses.noNota} sebelum scan order lain.` });
      return;
    }
    try {
      const rows = await supabaseFetch(token, `orders?select=id,no_nota,status,tujuan_kota,clients(nama,kota),order_items(qty)&no_nota=eq.${kode}`);
      if (!rows || rows.length === 0) {
        setScanMsg({ type: "error", text: `Nomor "${kode}" tidak ditemukan.` });
        return;
      }
      if (!["proses_dikirim", "siap_dikirim"].includes(rows[0].status)) {
        setScanMsg({ type: "error", text: `${rows[0].no_nota} tidak bisa diretur (statusnya "${rows[0].status}").` });
        return;
      }

      const kotaTujuanAsli = rows[0].tujuan_kota || rows[0].clients?.kota;
      const isPekanbaru = !!(kotaTujuanAsli && kotaTujuanAsli.trim().toLowerCase().includes("pekanbaru"));
      const totalBox = (rows[0].order_items || []).reduce((sum, it) => sum + Number(it.qty || 0), 0) || 1;

      if (isPekanbaru && totalBox > 1) {
        // Order Pekanbaru multi-box - tiap box punya kode unik sendiri,
        // wajib scan SEMUA box sebelum order ini masuk daftar retur.
        if (noBoxScan === null) {
          setScanMsg({ type: "error", text: `Barcode ini belum punya nomor box - cetak ulang barcode untuk order ini.` });
          return;
        }
        if (noBoxScan < 1 || noBoxScan > totalBox) {
          setScanMsg({ type: "error", text: `Nomor box ${noBoxScan} tidak valid (order ini cuma punya ${totalBox} box).` });
          return;
        }
        const sudahScan = boxProgressRef.current[rows[0].id] || [];
        if (sudahScan.includes(noBoxScan)) {
          setScanMsg({ type: "error", text: `Box ${noBoxScan} sudah discan sebelumnya.` });
          return;
        }
        setScanMsg(null);
        setOrderSedangProses({ orderId: rows[0].id, noNota: rows[0].no_nota, totalBox });
        setConfirmingScan({ ...rows[0], noBox: noBoxScan, totalBox });
        mainkanBeepScan();
      } else {
        setScanMsg(null);
        setConfirmingScan(rows[0]);
        mainkanBeepScan();
      }
    } catch (e) {
      setScanMsg({ type: "error", text: "Gagal cek nomor: " + e.message });
    }
  }

  function konfirmasiTambahScan() {
    if (!confirmingScan) return;
    if (confirmingScan.totalBox) {
      const daftarBoxBaru = [...(boxProgressRef.current[confirmingScan.id] || []), confirmingScan.noBox];
      setBoxProgress((prev) => ({ ...prev, [confirmingScan.id]: daftarBoxBaru }));
      if (daftarBoxBaru.length >= confirmingScan.totalBox) {
        // Semua box sudah discan - baru order-nya benar-benar masuk
        // daftar retur, dan buka lagi kesempatan scan order LAIN.
        setScannedList((prev) => [...prev, { no_nota: confirmingScan.no_nota, order_id: confirmingScan.id, nama: confirmingScan.clients?.nama, totalBox: confirmingScan.totalBox }]);
        setScanMsg({ type: "ok", text: `${confirmingScan.no_nota} lengkap (${confirmingScan.totalBox} box) - ditambahkan ke daftar retur.` });
        setOrderSedangProses(null);
      } else {
        setScanMsg({ type: "ok", text: `${confirmingScan.no_nota} - box ${confirmingScan.noBox}/${confirmingScan.totalBox} tercatat (${daftarBoxBaru.length}/${confirmingScan.totalBox} total). Scan box lain.` });
      }
    } else {
      setScannedList((prev) => [...prev, { no_nota: confirmingScan.no_nota, order_id: confirmingScan.id, nama: confirmingScan.clients?.nama, totalBox: 1 }]);
      setScanMsg({ type: "ok", text: `${confirmingScan.no_nota} ditambahkan ke daftar retur.` });
    }
    setConfirmingScan(null);
  }

  function hapusScan(no_nota) {
    setScannedList((prev) => prev.filter((s) => s.no_nota !== no_nota));
  }

  async function konfirmasiRetur() {
    if (scannedList.length === 0) return;
    if (!confirm(`Yakin retur ${totalPaketRetur} paket ini? Statusnya akan berubah jadi "Diretur".`)) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const orderIds = scannedList.map((s) => s.order_id);
      await supabaseFetch(token, `orders?id=in.(${orderIds.join(",")})`, {
        method: "PATCH",
        body: JSON.stringify({ status: "diretur", tanggal_retur: now }),
      });

      // Catat juga sebagai laporan_kurir (jenis_laporan="retur") supaya
      // Owner bisa lihat riwayatnya di menu Laporan Kurir.
      const [laporan] = await supabaseFetch(token, "laporan_kurir", {
        method: "POST",
        body: JSON.stringify({
          jenis_kurir: "toko", jenis_laporan: "retur",
          nama_kurir: namaAkun || "Tidak diketahui",
          jumlah_koli: totalPaketRetur,
          dibuat_oleh: role === "kurir" ? userId : null,
        }),
      });
      await supabaseFetch(token, "laporan_kurir_items", {
        method: "POST",
        body: JSON.stringify(scannedList.map((s) => ({ laporan_kurir_id: laporan.id, order_id: s.order_id, no_nota: s.no_nota, catatan: s.catatan || null }))),
      });

      setBerhasil(true);
    } catch (e) {
      alert("Gagal proses retur: " + e.message);
    }
    setSaving(false);
  }

  // Jumlah PAKET/BOX fisik (bukan jumlah order) - 1 order bisa punya
  // beberapa box, jadi dihitung dari total box tiap order yang sudah lengkap.
  const totalPaketRetur = scannedList.reduce((sum, s) => sum + (s.totalBox || 1), 0);

  if (berhasil) {
    return (
      <div>
        <Card style={{ textAlign: "center", padding: 40, maxWidth: 440, margin: "0 auto" }}>
          <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#FBEAEA", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
            <Check size={28} color="#C0392B" />
          </div>
          <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 6px" }}>Retur Berhasil Dicatat</p>
          <p style={{ fontSize: 13, color: "#6B6F75", margin: "0 0 24px" }}>
            {totalPaketRetur} paket sudah ditandai retur. Owner/Admin perlu konfirmasi bukti & alasan retur di menu Proses Pengiriman.
          </p>
          <button onClick={() => { setScannedList([]); setBerhasil(false); }} style={{ padding: "12px 28px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}>
            Retur Paket Lain
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <button onClick={onGantiMode} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#6B6F75", fontSize: 13, marginBottom: 14, padding: 0 }}>
        <ChevronLeft size={16} /> Kembali ke Serah Terima
      </button>
      <PageHeader title="Retur Paket" subtitle="Scan paket yang mau diretur" />

      <Card style={{ marginBottom: 16 }}>
        <button
          onClick={mulaiScanKamera}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: 13, borderRadius: 10, border: "none", background: "#C0392B", color: "#fff", fontWeight: 700, fontSize: 14, marginBottom: 14 }}
        >
          <Camera size={17} /> Scan Pakai Kamera HP
        </button>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 8px", textAlign: "center" }}>atau</p>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F7F5F1", borderRadius: 10, padding: "10px 14px" }}>
          <ScanLine size={20} color="#C0392B" />
          <input
            value={inputManual}
            onChange={(e) => setInputManual(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && inputManual.trim()) { tambahScan(inputManual); setInputManual(""); } }}
            placeholder="Scan pakai alat scanner fisik, atau ketik manual lalu Enter..."
            style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 14, fontWeight: 600, color: "#24272B" }}
          />
        </div>
        {scanMsg && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: 10, borderRadius: 9, background: scanMsg.type === "ok" ? "#D8E9E6" : "#FBEAEA", color: scanMsg.type === "ok" ? "#28685D" : "#C0392B", fontSize: 12.5, fontWeight: 600 }}>
            {scanMsg.type === "ok" ? <Check size={15} /> : <AlertCircle size={15} />} {scanMsg.text}
          </div>
        )}
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 4px" }}>Jumlah Paket Retur</p>
        <p className="disp" style={{ fontSize: 32, fontWeight: 700, color: "#C0392B", margin: 0 }}>{totalPaketRetur}</p>
      </Card>

      {scannedList.length > 0 && (
        <Card style={{ marginBottom: 20, padding: 0, overflow: "hidden" }}>
          {scannedList.map((s, i) => (
            <div key={s.no_nota} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderTop: i > 0 ? "1px solid #EDEAE3" : "none" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#24272B", margin: 0 }}>{s.no_nota}</p>
                <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: 0 }}>{s.nama}</p>
              </div>
              <button onClick={() => hapusScan(s.no_nota)} style={{ background: "none", border: "none", color: "#C0392B", fontSize: 11.5, fontWeight: 700 }}>Hapus</button>
            </div>
          ))}
        </Card>
      )}

      <button
        onClick={konfirmasiRetur}
        disabled={scannedList.length === 0 || saving}
        style={{ width: "100%", padding: 13, borderRadius: 10, border: "none", background: (scannedList.length === 0 || saving) ? "#E4E1DA" : "#C0392B", color: (scannedList.length === 0 || saving) ? "#9CA0A6" : "#fff", fontWeight: 700, fontSize: 14 }}
      >
        {saving ? "Memproses..." : `Konfirmasi Retur (${totalPaketRetur} paket)`}
      </button>

      {showCamera && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Arahkan kamera ke barcode/QR paket</p>
          <div id="reader-kamera-retur" style={{ width: "100%", maxWidth: 400, borderRadius: 12, overflow: "hidden" }} />
          {scanMsg && !confirmingScan && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, padding: "10px 14px", borderRadius: 9, background: scanMsg.type === "ok" ? "#D8E9E6" : "#FBEAEA", color: scanMsg.type === "ok" ? "#28685D" : "#C0392B", fontSize: 12.5, fontWeight: 600, maxWidth: 400, textAlign: "center" }}>
              {scanMsg.type === "ok" ? <Check size={15} /> : <AlertCircle size={15} />} {scanMsg.text}
            </div>
          )}
          {cameraError && <p style={{ color: "#F5A9A0", fontSize: 12.5, marginTop: 14, textAlign: "center" }}>{cameraError}</p>}
          <button onClick={tutupKamera} style={{ marginTop: 20, padding: "12px 24px", borderRadius: 10, border: "1.5px solid #fff", background: "none", color: "#fff", fontWeight: 700, fontSize: 13.5 }}>
            Tutup Kamera
          </button>
        </div>
      )}

      {confirmingScan && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 380, padding: 26 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#FBEAEA", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ScanLine size={20} color="#C0392B" />
              </div>
              <div>
                <p style={{ fontSize: 11, color: "#9CA0A6", margin: 0, fontWeight: 700, textTransform: "uppercase" }}>Scan Berhasil</p>
                <p className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: 0 }}>{confirmingScan.no_nota}</p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "#6B6F75", margin: "0 0 8px" }}>{confirmingScan.clients?.nama}</p>
            {confirmingScan.totalBox && (
              <p style={{ fontSize: 15, fontWeight: 700, color: "#8A6A1A", margin: "0 0 16px", padding: "8px 12px", background: "#FBF0D9", borderRadius: 8, display: "inline-block" }}>
                No. Box: {confirmingScan.noBox} / {confirmingScan.totalBox}
              </p>
            )}
            <p style={{ fontSize: 13, color: "#24272B", fontWeight: 600, margin: "0 0 18px" }}>
              {confirmingScan.totalBox ? `Konfirmasi box ke-${confirmingScan.noBox} paket retur ini?` : "Tambahkan paket ini ke daftar retur?"}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmingScan(null)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
                Batalkan
              </button>
              <button onClick={konfirmasiTambahScan} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "#C0392B", color: "#fff", fontWeight: 700, fontSize: 13.5 }}>
                {confirmingScan.totalBox ? "Konfirmasi" : "Tambahkan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PICKING LIST (Staff Gudang) - setelah order di-approve, staff ambil
// barang fisik dan WAJIB isi jumlah manual sesuai fisik yang diambil.
// Kalau tidak cocok dengan pesanan, tidak bisa dikonfirmasi.
// ============================================================
function PickingListPage({ token, role, userId }) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null); // order yang lagi dipicking
  const [inputJumlah, setInputJumlah] = useState({}); // { order_item_id: string }
  const [stockKurangConfirmed, setStockKurangConfirmed] = useState({}); // { order_item_id: true }
  const [saving, setSaving] = useState(false);
  const [mencetakBarcode, setMencetakBarcode] = useState(false);
  const [errorCetakBarcode, setErrorCetakBarcode] = useState("");
  const [ukuranLabelBarcode, setUkuranLabelBarcode] = useState({ lebar: 100, tinggi: 150, modeFit: false });

  useEffect(() => {
    supabaseFetch(token, "nota_settings?select=lebar_label_barcode_mm,tinggi_label_barcode_mm,mode_fit_barcode&limit=1")
      .then((rows) => {
        if (rows[0]) setUkuranLabelBarcode({ lebar: rows[0].lebar_label_barcode_mm ?? 100, tinggi: rows[0].tinggi_label_barcode_mm ?? 150, modeFit: !!rows[0].mode_fit_barcode });
      })
      .catch(() => {}); // biarkan pakai default kalau gagal muat
  }, []);

  const [confirmingBoxOrder, setConfirmingBoxOrder] = useState(null); // order yang picking-nya baru selesai, nunggu konfirmasi jumlah box
  const [jumlahBoxInput, setJumlahBoxInput] = useState("");
  const [savingBox, setSavingBox] = useState(false);
  const [packingSelesaiOrder, setPackingSelesaiOrder] = useState(null); // order yang box-nya sudah dikonfirmasi, nunggu upload bukti pengemasan
  const [uploadingBukti, setUploadingBukti] = useState(false);
  const [ordersTertunda, setOrdersTertunda] = useState([]); // sudah picking+box, TAPI belum upload bukti - buat lanjut kalau sempat putus
  const [scanTerakhir, setScanTerakhir] = useState(null); // null | "barcode" | "produk" - tipe scan yang lagi menunggu pasangannya
  const scanTerakhirRef = useRef(null); // kamera sekarang tetap terbuka terus (tidak didaftar ulang tiap scan), jadi WAJIB baca dari ref ini di dalam callback, bukan langsung dari state (stale closure)
  useEffect(() => { scanTerakhirRef.current = scanTerakhir; }, [scanTerakhir]);
  const [pasanganSelesai, setPasanganSelesai] = useState(0); // jumlah box yang sudah diverifikasi lengkap (barcode+produk cocok)
  const pasanganSelesaiRef = useRef(0); // sama kayak scanTerakhirRef - wajib dipakai di dalam callback kamera supaya tidak stale
  useEffect(() => { pasanganSelesaiRef.current = pasanganSelesai; }, [pasanganSelesai]);
  const [checkerInput, setCheckerInput] = useState(""); // input manual/scanner fisik
  const [checkerPesan, setCheckerPesan] = useState(null);
  const [showCameraChecker, setShowCameraChecker] = useState(false);
  const lastScanCheckerRef = useRef({ kode: null, waktu: 0 }); // debounce - kamera tidak lagi auto-tutup tiap scan, jadi cegah kode yang sama kepencet berkali-kali selagi kamera masih mengarah ke situ
  const [cameraErrorChecker, setCameraErrorChecker] = useState("");
  const html5QrCheckerRef = useRef(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(
        token,
        "orders?select=id,no_nota,created_at,tujuan_kota,tujuan_telp,tujuan_alamat,tujuan_nama,is_dropship,nama_pengirim_dropship,metode_bayar,stok_kurang_menunggu_admin_at,stok_kurang_disetujui_admin_at,stok_kurang_ditolak_admin_at,stok_kurang_catatan_admin,clients(nama,kode,kota,alamat,telp),order_items(id,qty,products(kode,nama,satuan,nomor_produk))&status=eq.menunggu_pengiriman&picking_selesai_at=is.null&order=created_at.asc"
      );
      setOrders(rows);

      // Order yang picking+box-nya SUDAH dikonfirmasi tapi belum sempat
      // upload bukti pengemasan (misal jaringan putus/HP mati di tengah
      // jalan) - supaya bisa dilanjutkan, bukan hilang begitu saja.
      const tertunda = await supabaseFetch(
        token,
        "orders?select=id,no_nota,jumlah_box_konfirmasi,tujuan_kota,tujuan_telp,tujuan_alamat,tujuan_nama,is_dropship,nama_pengirim_dropship,metode_bayar,clients(nama,kode,kota,alamat,telp),order_items(id,qty,products(kode,nama,satuan,nomor_produk))&picking_selesai_at=not.is.null&outbound_verified_at=is.null&order=picking_selesai_at.asc"
      );
      setOrdersTertunda(tertunda);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Cek keterlambatan pengemasan - order masuk sebelum jam 13:00 wajib
  // di-picking hari itu juga; setelah jam 13:00 wajib besok.
  function cekTerlambatPengemasan(o) {
    const dibuat = new Date(o.created_at);
    const sekarang = new Date();
    if (dibuat.getHours() < 13) {
      const sameDay = dibuat.getFullYear() === sekarang.getFullYear() && dibuat.getMonth() === sekarang.getMonth() && dibuat.getDate() === sekarang.getDate();
      return !sameDay;
    } else {
      const batasWaktu = new Date(dibuat);
      batasWaktu.setDate(batasWaktu.getDate() + 1);
      batasWaktu.setHours(13, 0, 0, 0);
      return sekarang > batasWaktu;
    }
  }

  function mulaiPicking(order) {
    setSelectedOrder(order);
    const initial = {};
    (order.order_items || []).forEach((it) => { initial[it.id] = ""; });
    setInputJumlah(initial);
  }

  // "Valid" = jumlah aktual PERSIS cocok, ATAU sudah dikonfirmasi sebagai
  // stock kurang (staff sengaja akui kurang, bukan salah ketik).
  function semuaCocok() {
    if (!selectedOrder) return false;
    return (selectedOrder.order_items || []).every((it) => {
      const val = inputJumlah[it.id];
      if (val === "" || val === undefined) return false;
      if (Number(val) === Number(it.qty)) return true;
      // Kurang dari pesanan DAN sudah dikonfirmasi lewat tombol "Stock Kurang"
      return Number(val) < Number(it.qty) && !!stockKurangConfirmed[it.id];
    });
  }

  // Ada minimal 1 item yang stock-nya dikonfirmasi kurang - kalau ada,
  // order ini perlu persetujuan Admin dulu (bukan langsung lanjut picking).
  function adaStockKurang() {
    if (!selectedOrder) return false;
    return (selectedOrder.order_items || []).some((it) => stockKurangConfirmed[it.id]);
  }

  async function konfirmasiPicking() {
    // Kalau sudah disetujui Admin sebelumnya, qty di database sudah FINAL
    // (sudah diupdate RPC setujui_stok_kurang) - langsung lanjut, tidak
    // perlu cek input lokal lagi (yang mungkin sudah kosong/tidak relevan).
    const sudahDisetujuiAdmin = !!selectedOrder.stok_kurang_disetujui_admin_at;
    if (!sudahDisetujuiAdmin && !semuaCocok()) return;
    if (!sudahDisetujuiAdmin && adaStockKurang()) {
      await konfirmasiAdmin();
      return;
    }
    setSaving(true);
    try {
      await supabaseFetch(token, `orders?id=eq.${selectedOrder.id}`, {
        method: "PATCH",
        body: JSON.stringify({ picking_selesai_at: new Date().toISOString(), picking_oleh: userId }),
      });
      setOrders((prev) => prev.filter((o) => o.id !== selectedOrder.id));
      // Total qty sebagai perkiraan awal jumlah box - staff bisa ubah manual
      // di popup kalau ternyata beda (misal digabung jadi lebih sedikit box)
      const perkiraanBox = (selectedOrder.order_items || []).reduce((sum, it) => sum + Number(it.qty || 0), 0) || 1;
      setJumlahBoxInput(String(perkiraanBox));
      setConfirmingBoxOrder(selectedOrder);
      setSelectedOrder(null);
      setInputJumlah({});
    } catch (e) {
      alert("Gagal konfirmasi picking: " + e.message);
    }
    setSaving(false);
  }

  // Ada stock kurang - kirim ke Admin untuk direview, JANGAN lanjut ke
  // tahap box/pengemasan dulu. Staff "tertahan" di halaman ini sampai
  // Admin memutuskan (Setuju/Tolak) di menu Review terpisah.
  async function konfirmasiAdmin() {
    setSaving(true);
    try {
      const itemsPayload = (selectedOrder.order_items || []).map((it) => {
        const val = inputJumlah[it.id];
        const isKurang = !!stockKurangConfirmed[it.id];
        return {
          id: it.id,
          stock_kurang_dikonfirmasi: isKurang,
          qty_diajukan_staff: isKurang ? Number(val) : null,
        };
      });
      await Promise.all(itemsPayload.map((p) =>
        supabaseFetch(token, `order_items?id=eq.${p.id}`, {
          method: "PATCH",
          body: JSON.stringify({ stock_kurang_dikonfirmasi: p.stock_kurang_dikonfirmasi, qty_diajukan_staff: p.qty_diajukan_staff }),
        })
      ));
      await supabaseFetch(token, `orders?id=eq.${selectedOrder.id}`, {
        method: "PATCH",
        body: JSON.stringify({ stok_kurang_menunggu_admin_at: new Date().toISOString() }),
      });
      setOrders((prev) => prev.map((o) => (o.id === selectedOrder.id ? { ...o, stok_kurang_menunggu_admin_at: new Date().toISOString() } : o)));
      setSelectedOrder((prev) => ({ ...prev, stok_kurang_menunggu_admin_at: new Date().toISOString() }));
    } catch (e) {
      alert("Gagal kirim ke Admin: " + e.message);
    }
    setSaving(false);
  }

  async function simpanJumlahBox() {
    const jumlahBox = Number(jumlahBoxInput);
    if (!jumlahBox || jumlahBox < 1) {
      alert("Isi jumlah box yang valid (minimal 1).");
      return;
    }
    setSavingBox(true);
    try {
      await supabaseFetch(token, `orders?id=eq.${confirmingBoxOrder.id}`, {
        method: "PATCH",
        body: JSON.stringify({ jumlah_box_konfirmasi: jumlahBox }),
      });
      setPackingSelesaiOrder({ ...confirmingBoxOrder, jumlah_box_konfirmasi: jumlahBox });
      setScanTerakhir(null); setPasanganSelesai(0);
      scanTerakhirRef.current = null; pasanganSelesaiRef.current = 0;
      setCheckerPesan(null);
      setConfirmingBoxOrder(null);
      setJumlahBoxInput("");
    } catch (e) {
      alert("Gagal simpan jumlah box: " + e.message);
    }
    setSavingBox(false);
  }

  // ---------- CHECKER PRODUK - verifikasi barcode kemasan fisik ----------
  function semuaItemSudahDicek() {
    if (!packingSelesaiOrder) return false;
    return pasanganSelesai >= (packingSelesaiOrder.jumlah_box_konfirmasi || 1);
  }

  // Parse kode: kalau formatnya NONOTA-NN-NOMORPRODUK (barcode label kita,
  // sudah menyematkan nomor produk di dalamnya) -> kembalikan info barcode.
  // Kalau kodenya POLOS (angka/kode manufaktur) -> anggap scan kode produk
  // fisik di kemasan.
  function parseKode(kode) {
    const match = kode.match(/^(.+)-(\d{2,3})-(.+)$/);
    if (match) {
      if (match[1] === packingSelesaiOrder.no_nota) {
        return { tipe: "barcode", nomorProduk: match[3] };
      }
      // Formatnya persis format barcode kita, tapi nomor pesanannya BEDA -
      // ini barcode dari order lain, harus ditolak jelas.
      return { tipe: "barcode_lain", noNotaLain: match[1] };
    }
    // Bukan format barcode kita - anggap kode produk fisik. Tapi harus
    // benar-benar salah satu produk yang ADA di pesanan ini, kalau tidak
    // ada sama sekali berarti kode asing/salah scan.
    const itemCocok = (packingSelesaiOrder.order_items || []).some((it) => it.products?.nomor_produk === kode);
    if (!itemCocok) {
      return { tipe: "tidak_dikenali" };
    }
    return { tipe: "produk", nomorProduk: kode };
  }

  function prosesCheckerScan(kodeScan) {
    const kode = kodeScan.trim();
    if (!kode) return;
    // Debounce - kalau kode PERSIS sama baru saja diproses (dalam 1.5
    // detik terakhir), abaikan diam-diam - kamera tidak lagi auto-tutup
    // tiap scan, jadi kode yang sama bisa kebaca berkali-kali selagi
    // kamera masih mengarah ke barcode yang sama.
    const sekarang = Date.now();
    if (lastScanCheckerRef.current.kode === kode && sekarang - lastScanCheckerRef.current.waktu < 1500) {
      return;
    }
    lastScanCheckerRef.current = { kode, waktu: sekarang };
    const hasil = parseKode(kode);

    if (hasil.tipe === "barcode_lain") {
      setCheckerPesan({ type: "error", text: `Barcode ini untuk pesanan ${hasil.noNotaLain}, BUKAN untuk pesanan ${packingSelesaiOrder.no_nota} yang sedang diproses. Scan barcode/kode produk pesanan ini saja.` });
      return;
    }

    if (hasil.tipe === "tidak_dikenali") {
      setCheckerPesan({ type: "error", text: `Kode "${kode}" tidak dikenali - bukan barcode pesanan ini atau kode produk yang terdaftar di pesanan ini.` });
      return;
    }

    if (scanTerakhirRef.current === null) {
      // Scan PERTAMA dari satu pasangan (box) baru - simpan dulu, tunggu
      // pasangannya buat dicocokkan
      scanTerakhirRef.current = hasil;
      setScanTerakhir(hasil);
      setCheckerPesan({ type: "ok", text: `${hasil.tipe === "barcode" ? "Barcode" : "Kode produk"} terbaca. Sekarang scan ${hasil.tipe === "barcode" ? "kode produk" : "barcode"} di kemasan yang sama.` });
      return;
    }

    if (scanTerakhirRef.current.tipe === hasil.tipe) {
      // Scan tipe yang SAMA lagi berturut-turut - ditolak
      setCheckerPesan({ type: "error", text: `Harus scan ${hasil.tipe === "barcode" ? "kode produk" : "barcode"} dulu, jangan ${hasil.tipe === "barcode" ? "barcode" : "kode produk"} lagi.` });
      return;
    }

    // Tipe BEDA dari scan sebelumnya - sekarang COCOKKAN nomor produknya
    if (scanTerakhirRef.current.nomorProduk !== hasil.nomorProduk) {
      const kodeBarcode = scanTerakhirRef.current.tipe === "barcode" ? scanTerakhirRef.current.nomorProduk : hasil.nomorProduk;
      const kodeFisik = scanTerakhirRef.current.tipe === "produk" ? scanTerakhirRef.current.nomorProduk : hasil.nomorProduk;
      setCheckerPesan({ type: "error", text: `Salah produk! Barcode ini untuk kode "${kodeBarcode}", tapi kode di kemasan fisik "${kodeFisik}" - cek lagi barangnya.` });
      scanTerakhirRef.current = null;
      setScanTerakhir(null);
      return;
    }

    // Cocok! 1 pasangan (1 box) lengkap dan BENAR produknya
    scanTerakhirRef.current = null;
    const pasanganBaru = pasanganSelesaiRef.current + 1;
    pasanganSelesaiRef.current = pasanganBaru;
    setPasanganSelesai(pasanganBaru);
    setScanTerakhir(null);
    setCheckerPesan({ type: "ok", text: `Box ${pasanganBaru}/${packingSelesaiOrder.jumlah_box_konfirmasi} terverifikasi cocok!` });
  }

  function tutupKameraChecker() {
    if (html5QrCheckerRef.current) {
      html5QrCheckerRef.current.stop().catch(() => {}).finally(() => { html5QrCheckerRef.current = null; });
    }
    setShowCameraChecker(false);
  }

  async function mulaiScanChecker() {
    setCameraErrorChecker("");
    setShowCameraChecker(true);
    try {
      await loadHtml5Qrcode();
      setTimeout(async () => {
        try {
          const html5Qr = new window.Html5Qrcode("reader-kamera-checker");
          html5QrCheckerRef.current = html5Qr;
          await html5Qr.start(
            { facingMode: "environment" },
            { fps: 5, qrbox: { width: 300, height: 150 }, formatsToSupport: [window.Html5QrcodeSupportedFormats.CODE_128, window.Html5QrcodeSupportedFormats.CODE_39, window.Html5QrcodeSupportedFormats.QR_CODE] },
            (decodedText) => {
              mainkanBeepScan();
              prosesCheckerScan(decodedText);
            },
            () => {}
          );
        } catch (e) {
          setCameraErrorChecker("Gagal buka kamera: " + e.message);
        }
      }, 200);
    } catch (e) {
      setCameraErrorChecker("Gagal muat library scanner: " + e.message);
    }
  }

  async function cetakBarcodeDariPacking() {
    if (!packingSelesaiOrder) return;
    setMencetakBarcode(true);
    setErrorCetakBarcode("");
    try {
      const lebarIn = ukuranLabelBarcode.lebar / 25.4;
      const tinggiIn = ukuranLabelBarcode.tinggi / 25.4;
      const entries = hitungEntriesLabelBarcode([packingSelesaiOrder]);
      for (const entry of entries) {
        await cetakPdfOtomatis(<BarcodeLabelContent order={entry.order} noBox={entry.noBox} totalBox={entry.totalBox} item={entry.item} />, `${lebarIn}in ${tinggiIn}in`, "bawah", true); // selalu pakai Mode Fit - cegah konten meluber ke label fisik berikutnya
      }
    } catch (e) {
      setErrorCetakBarcode("Gagal cetak otomatis: " + e.message + " - pastikan print server jalan. Coba tombol cetak manual sebagai cadangan, atau ulangi.");
    }
    setMencetakBarcode(false);
  }

  // Upload bukti pengemasan = foto pesanan di area penjemputan. Begitu
  // berhasil upload, order LANGSUNG otomatis dianggap "outbound" (skip
  // scan manual di menu Outbound) dan masuk ke Siap Dikirim.
  async function uploadBuktiPengemasan(file) {
    setUploadingBukti(true);
    try {
      const compressed = await compressImage(file);
      const { ext, contentType } = infoFileTerkompresi(compressed, file);
      const filePath = `bukti-pengemasan-${packingSelesaiOrder.id}-${Date.now()}.${ext}`;
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/produk-gambar/${filePath}`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": contentType },
        body: compressed,
      });
      if (!res.ok) throw new Error(await res.text());
      const url = `${SUPABASE_URL}/storage/v1/object/public/produk-gambar/${filePath}`;

      const now = new Date().toISOString();
      await supabaseFetch(token, `orders?id=eq.${packingSelesaiOrder.id}`, {
        method: "PATCH",
        body: JSON.stringify({ bukti_pengiriman_url: url, outbound_verified_at: now, status: "siap_dikirim" }),
      });
      setOrdersTertunda((prev) => prev.filter((o) => o.id !== packingSelesaiOrder.id));
      setPackingSelesaiOrder(null);
    } catch (e) {
      alert("Gagal upload bukti pengemasan: " + e.message);
    }
    setUploadingBukti(false);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const labelStyle = { fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" };

  // ---------- TAMPILAN DETAIL PICKING SATU ORDER ----------
  if (selectedOrder) {
    const kotaTujuanAsli = selectedOrder.tujuan_kota || selectedOrder.clients?.kota;
    const isPekanbaru = !!(kotaTujuanAsli && kotaTujuanAsli.trim().toLowerCase().includes("pekanbaru"));
    const jumlahJenisBarang = (selectedOrder.order_items || []).length;
    return (
      <div>
        <button onClick={() => { setSelectedOrder(null); setInputJumlah({}); }} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#6B6F75", fontSize: 13, marginBottom: 14, padding: 0 }}>
          <ChevronLeft size={16} /> Kembali
        </button>
        <PageHeader title="Picking List" subtitle="Isi jumlah aktual sesuai barang yang benar-benar diambil" />

        <Card style={{ maxWidth: 520, marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>No. Pesanan</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#24272B", margin: 0 }}>{selectedOrder.no_nota}</p>
            </div>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>Toko Tujuan</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#24272B", margin: 0 }}>{selectedOrder.clients?.nama}, {kotaTujuanAsli || "-"}</p>
            </div>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>Metode Pengiriman</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: isPekanbaru ? "#28685D" : "#8A6A1A", margin: 0 }}>{isPekanbaru ? "Kurir Toko" : "Baraka"}</p>
            </div>
            <div>
              <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>Total Jenis Barang</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#24272B", margin: 0 }}>{jumlahJenisBarang} jenis</p>
            </div>
          </div>
        </Card>

        <Card style={{ maxWidth: 520 }}>
          {(selectedOrder.order_items || []).map((it, i) => {
            const val = inputJumlah[it.id] ?? "";
            const sudahDiisi = val !== "";
            const cocok = sudahDiisi && Number(val) === Number(it.qty);
            const kurangDariPesanan = sudahDiisi && Number(val) < Number(it.qty);
            const lebihDariPesanan = sudahDiisi && Number(val) > Number(it.qty);
            const sudahKonfirmasiKurang = !!stockKurangConfirmed[it.id];
            const salah = sudahDiisi && Number(val) !== Number(it.qty) && !sudahKonfirmasiKurang;
            const selisih = kurangDariPesanan ? Number(it.qty) - Number(val) : 0;
            return (
              <div key={it.id} style={{ paddingBottom: 16, marginBottom: 16, borderBottom: i < selectedOrder.order_items.length - 1 ? "1px solid #EDEAE3" : "none" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div>
                    <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 3px" }}>Nama Produk</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#24272B", margin: 0 }}>{it.products?.nama}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 3px" }}>Kode Produk</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#24272B", margin: 0 }}>{it.products?.kode}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 3px" }}>Jumlah Pesanan</p>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#24272B", margin: 0 }}>{it.qty} {it.products?.satuan}</p>
                  </div>
                  {kurangDariPesanan && (
                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => setStockKurangConfirmed((prev) => ({ ...prev, [it.id]: !prev[it.id] }))}
                        style={{
                          display: "flex", alignItems: "center", gap: 5, padding: "8px 12px", borderRadius: 9, fontSize: 12, fontWeight: 700, width: "100%", justifyContent: "center",
                          border: sudahKonfirmasiKurang ? "1.5px solid #8A6A1A" : "1.5px solid #E4E1DA",
                          background: sudahKonfirmasiKurang ? "#FBF0D9" : "#fff",
                          color: sudahKonfirmasiKurang ? "#8A6A1A" : "#6B6F75",
                        }}
                      >
                        {sudahKonfirmasiKurang ? <Check size={13} /> : null} Stock Kurang
                      </button>
                    </div>
                  )}
                </div>
                <label style={labelStyle}>Jumlah Aktual</label>
                <input
                  type="number"
                  value={val}
                  onChange={(e) => { setInputJumlah((prev) => ({ ...prev, [it.id]: e.target.value })); setStockKurangConfirmed((prev) => ({ ...prev, [it.id]: false })); }}
                  placeholder={`Isi jumlah ${it.products?.satuan}...`}
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: 9, fontSize: 14, fontWeight: 700, outline: "none",
                    border: salah ? "1.5px solid #C0392B" : sudahKonfirmasiKurang ? "1.5px solid #8A6A1A" : cocok ? "1.5px solid #28685D" : "1.5px solid #E4E1DA",
                    background: salah ? "#FBEAEA" : sudahKonfirmasiKurang ? "#FBF0D9" : cocok ? "#D8E9E6" : "#fff",
                    color: salah ? "#C0392B" : sudahKonfirmasiKurang ? "#8A6A1A" : cocok ? "#28685D" : "#24272B",
                  }}
                />
                {lebihDariPesanan && <p style={{ fontSize: 11.5, color: "#C0392B", margin: "6px 0 0", fontWeight: 600 }}>Tidak cocok - seharusnya {it.qty} {it.products?.satuan}</p>}
                {kurangDariPesanan && !sudahKonfirmasiKurang && <p style={{ fontSize: 11.5, color: "#C0392B", margin: "6px 0 0", fontWeight: 600 }}>Tidak cocok - seharusnya {it.qty} {it.products?.satuan} (kalau memang stock kurang, klik tombol "Stock Kurang" di atas)</p>}
                {kurangDariPesanan && sudahKonfirmasiKurang && <p style={{ fontSize: 11.5, color: "#8A6A1A", margin: "6px 0 0", fontWeight: 600 }}>Stock {it.products?.kode} kurang {selisih} {it.products?.satuan}</p>}
              </div>
            );
          })}

          {selectedOrder.stok_kurang_menunggu_admin_at && !selectedOrder.stok_kurang_disetujui_admin_at && !selectedOrder.stok_kurang_ditolak_admin_at && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FBF0D9", borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <Clock size={15} color="#8A6A1A" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12.5, color: "#8A6A1A", margin: 0, fontWeight: 600, lineHeight: 1.5 }}>
                Menunggu Persetujuan Admin - ada barang yang stocknya kurang. Admin akan menghubungi toko dulu sebelum bisa lanjut.
              </p>
            </div>
          )}
          {selectedOrder.stok_kurang_disetujui_admin_at && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#D8E9E6", borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <Check size={15} color="#28685D" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12.5, color: "#28685D", margin: 0, fontWeight: 600, lineHeight: 1.5 }}>
                Telah Disetujui Admin{selectedOrder.stok_kurang_catatan_admin ? ` - "${selectedOrder.stok_kurang_catatan_admin}"` : ""}. Silakan lanjutkan proses pengemasan.
              </p>
            </div>
          )}
          {selectedOrder.stok_kurang_ditolak_admin_at && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FBEAEA", borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <X size={15} color="#C0392B" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12.5, color: "#C0392B", margin: 0, fontWeight: 600, lineHeight: 1.5 }}>
                Ditolak Admin{selectedOrder.stok_kurang_catatan_admin ? ` - "${selectedOrder.stok_kurang_catatan_admin}"` : ""}. Silakan ulangi isi jumlah aktual di bawah.
              </p>
            </div>
          )}

          <button
            onClick={konfirmasiPicking}
            disabled={
              saving
              || !!(selectedOrder.stok_kurang_menunggu_admin_at && !selectedOrder.stok_kurang_disetujui_admin_at && !selectedOrder.stok_kurang_ditolak_admin_at)
              || (!selectedOrder.stok_kurang_disetujui_admin_at && !semuaCocok())
            }
            style={{ width: "100%", padding: 13, borderRadius: 10, border: "none", fontWeight: 700, fontSize: 14, background: (!semuaCocok() && !selectedOrder.stok_kurang_disetujui_admin_at || saving) ? "#E4E1DA" : "#28685D", color: (!semuaCocok() && !selectedOrder.stok_kurang_disetujui_admin_at || saving) ? "#9CA0A6" : "#fff" }}
          >
            {saving ? "Menyimpan..."
              : selectedOrder.stok_kurang_disetujui_admin_at ? "Lanjutkan ke Pengemasan"
              : (selectedOrder.stok_kurang_menunggu_admin_at && !selectedOrder.stok_kurang_ditolak_admin_at) ? "Menunggu Persetujuan Admin"
              : !semuaCocok() ? "Isi Semua Jumlah dengan Benar Dulu"
              : adaStockKurang() ? "Konfirmasi Admin"
              : "Konfirmasi Picking"}
          </button>
        </Card>
      </div>
    );
  }

  // ---------- TAMPILAN SETELAH BOX DIKONFIRMASI - upload bukti pengemasan ----------
  if (packingSelesaiOrder) {
    return (
      <div>
        <button onClick={() => setPackingSelesaiOrder(null)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#6B6F75", fontSize: 13, marginBottom: 14, padding: 0 }}>
          <ChevronLeft size={16} /> Kembali (progres tetap tersimpan)
        </button>
        <PageHeader title="Pengemasan Selesai" subtitle={`${packingSelesaiOrder.no_nota} - ${packingSelesaiOrder.jumlah_box_konfirmasi} box`} />

        <Card style={{ maxWidth: 460, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#D8E9E6", borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <Check size={16} color="#28685D" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12.5, color: "#28685D", margin: 0, fontWeight: 600, lineHeight: 1.5 }}>
              Picking & jumlah box sudah dikonfirmasi. Cetak barcode dulu kalau perlu, lalu upload bukti pengemasan di bawah.
            </p>
          </div>
          <button
            onClick={cetakBarcodeDariPacking}
            disabled={mencetakBarcode}
            style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Barcode size={16} /> {mencetakBarcode ? "Mencetak..." : `Cetak Barcode (${packingSelesaiOrder.jumlah_box_konfirmasi} box)`}
          </button>
          {errorCetakBarcode && (
            <p style={{ fontSize: 11.5, color: "#C0392B", margin: "8px 0 0", lineHeight: 1.5 }}>{errorCetakBarcode}</p>
          )}
        </Card>

        <Card style={{ maxWidth: 460, marginBottom: 16 }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 4px" }}>Checker Produk</p>
          <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 16px", lineHeight: 1.5 }}>
            Scan barcode di kemasan DAN kode produk di kemasan secara bergantian (bebas mana dulu) - untuk pastikan barang yang diambil benar dan mencegah salah picking.
          </p>

          <button
            onClick={mulaiScanChecker}
            style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: "#C0392B", color: "#fff", fontWeight: 700, fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 10 }}
          >
            <Camera size={16} /> Scan Barcode / Kode Produk
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#F7F5F1", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
            <ScanLine size={18} color="#C0392B" />
            <input
              value={checkerInput}
              onChange={(e) => setCheckerInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && checkerInput.trim()) { prosesCheckerScan(checkerInput); setCheckerInput(""); } }}
              placeholder="Atau scan pakai scanner fisik / ketik manual..."
              style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13.5, fontWeight: 600, color: "#24272B" }}
            />
          </div>

          {checkerPesan && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 10, borderRadius: 9, background: checkerPesan.type === "ok" ? "#D8E9E6" : "#FBEAEA", color: checkerPesan.type === "ok" ? "#28685D" : "#C0392B", fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>
              {checkerPesan.type === "ok" ? <Check size={15} /> : <AlertCircle size={15} />} {checkerPesan.text}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, background: semuaItemSudahDicek() ? "#D8E9E6" : "#FBF0D9", borderRadius: 9, padding: 10, marginBottom: 12 }}>
            {semuaItemSudahDicek() ? <Check size={16} color="#28685D" /> : <ScanLine size={16} color="#8A6A1A" />}
            <p style={{ fontSize: 12.5, fontWeight: 700, color: semuaItemSudahDicek() ? "#28685D" : "#8A6A1A", margin: 0 }}>
              {pasanganSelesai} / {packingSelesaiOrder.jumlah_box_konfirmasi} box terverifikasi
              {scanTerakhir && ` - menunggu scan ${scanTerakhir.tipe === "barcode" ? "kode produk" : "barcode"}`}
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
            {Array.from({ length: packingSelesaiOrder.jumlah_box_konfirmasi || 1 }, (_, i) => i + 1).map((noBox) => {
              const sudahCentang = noBox <= pasanganSelesai;
              return (
                <div key={noBox} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, padding: "8px 2px", borderRadius: 6, fontSize: 11, fontWeight: 700, background: sudahCentang ? "#D8E9E6" : "#F7F5F1", color: sudahCentang ? "#28685D" : "#9CA0A6", border: sudahCentang ? "1.5px solid #28685D" : "1.5px solid #E4E1DA" }}>
                  {sudahCentang && <Check size={10} />} {noBox}
                </div>
              );
            })}
          </div>

          {showCameraChecker && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}>
              <p style={{ color: "#fff", fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Arahkan kamera ke barcode ATAU kode produk di kemasan</p>
              <div id="reader-kamera-checker" style={{ width: "100%", maxWidth: 400, borderRadius: 12, overflow: "hidden" }} />
              {cameraErrorChecker && <p style={{ color: "#F5A9A0", fontSize: 12.5, marginTop: 14, textAlign: "center" }}>{cameraErrorChecker}</p>}
              {checkerPesan && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 9, background: checkerPesan.type === "ok" ? "#28685D" : "#C0392B", color: "#fff", fontSize: 13, fontWeight: 600, marginTop: 16, maxWidth: 400, width: "100%" }}>
                  {checkerPesan.type === "ok" ? <Check size={16} /> : <AlertCircle size={16} />} {checkerPesan.text}
                </div>
              )}
              <button onClick={tutupKameraChecker} style={{ marginTop: 20, padding: "12px 24px", borderRadius: 10, border: "1.5px solid #fff", background: "none", color: "#fff", fontWeight: 700, fontSize: 13.5 }}>
                Tutup Kamera
              </button>
            </div>
          )}
        </Card>

        {semuaItemSudahDicek() ? (
        <Card style={{ maxWidth: 460 }}>
          <p style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 6px" }}>Bukti Pengemasan</p>
          <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 16px", lineHeight: 1.5 }}>
            Upload foto saat pesanan berada di area penjemputan. Begitu diupload, pesanan otomatis masuk ke "Siap Dikirim".
          </p>
          <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 32, borderRadius: 12, border: "1.5px dashed #E8A426", background: "#FFFBF0", color: "#8A6A1A", cursor: "pointer" }}>
            {uploadingBukti ? (
              <>
                <Loader2 size={28} className="spin" />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Mengupload...</span>
              </>
            ) : (
              <>
                <Camera size={28} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Tap untuk Upload Foto</span>
              </>
            )}
            <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} disabled={uploadingBukti} onChange={(e) => { if (e.target.files[0]) uploadBuktiPengemasan(e.target.files[0]); }} />
          </label>
        </Card>
        ) : (
          <Card style={{ maxWidth: 460, textAlign: "center", padding: 24 }}>
            <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: 0 }}>Selesaikan Checker Produk di atas dulu (semua item harus "Cocok") sebelum bisa upload bukti pengemasan.</p>
          </Card>
        )}
      </div>
    );
  }

  // ---------- TAMPILAN DAFTAR ORDER ----------
  return (
    <div>
      <PageHeader title="Picking List" subtitle={`${orders.length} pesanan menunggu diambil barangnya`} onRefresh={load} refreshing={loading} showPingPrinter />

      {ordersTertunda.length > 0 && (
        <>
          <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#C0392B", margin: "0 0 12px" }}>Menunggu Upload Bukti Pengemasan ({ordersTertunda.length})</h2>
          {ordersTertunda.map((o) => (
            <Card key={o.id} style={{ marginBottom: 12, border: "1.5px solid #FBEAEA" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{o.no_nota}</p>
                  <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>{o.clients?.nama} ({o.clients?.kode})</p>
                  <p style={{ fontSize: 11.5, color: "#C0392B", margin: "4px 0 0", fontWeight: 600 }}>Picking sudah selesai - {o.jumlah_box_konfirmasi} box, tinggal upload foto</p>
                </div>
                <button
                  onClick={() => { setPackingSelesaiOrder(o); setScanTerakhir(null); setPasanganSelesai(0); scanTerakhirRef.current = null; pasanganSelesaiRef.current = 0; setCheckerPesan(null); }}
                  style={{ padding: "11px 20px", borderRadius: 10, border: "none", background: "#C0392B", color: "#fff", fontWeight: 700, fontSize: 13.5 }}
                >
                  Lanjutkan
                </button>
              </div>
            </Card>
          ))}
          <div style={{ height: 8 }} />
        </>
      )}

      {orders.length === 0 ? (
        <EmptyState text="Tidak ada pesanan yang perlu di-picking saat ini." />
      ) : (
        [...orders].sort((a, b) => (cekTerlambatPengemasan(b) ? 1 : 0) - (cekTerlambatPengemasan(a) ? 1 : 0)).map((o) => {
          const totalItem = (o.order_items || []).reduce((sum, it) => sum + Number(it.qty || 0), 0);
          return (
            <Card key={o.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <p className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>
                    {o.no_nota}
                    {cekTerlambatPengemasan(o) && (
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#FBEAEA", color: "#C0392B", verticalAlign: "middle" }}>Terlambat Pengemasan</span>
                    )}
                  </p>
                  <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>{o.clients?.nama} ({o.clients?.kode})</p>
                  <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "4px 0 0" }}>{(o.order_items || []).length} jenis barang - {totalItem} total pcs</p>
                </div>
                <button
                  onClick={() => mulaiPicking(o)}
                  style={{ padding: "11px 20px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5 }}
                >
                  Mulai Picking
                </button>
              </div>
            </Card>
          );
        })
      )}

      {/* MODAL KONFIRMASI JUMLAH BOX - muncul setelah picking dikonfirmasi */}
      {confirmingBoxOrder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 380, padding: 26 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#D8E9E6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Check size={20} color="#28685D" />
              </div>
              <div>
                <p style={{ fontSize: 11, color: "#9CA0A6", margin: 0, fontWeight: 700, textTransform: "uppercase" }}>Picking Selesai</p>
                <p className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: 0 }}>{confirmingBoxOrder.no_nota}</p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "#24272B", fontWeight: 600, margin: "0 0 10px" }}>Konfirmasi jumlah box untuk order ini:</p>
            <input
              type="number"
              value={jumlahBoxInput}
              onChange={(e) => setJumlahBoxInput(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E4E1DA", fontSize: 18, fontWeight: 700, textAlign: "center", marginBottom: 8 }}
            />
            <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 20px", textAlign: "center" }}>Bisa diubah kalau barangnya digabung jadi lebih sedikit/lebih banyak box.</p>
            <button
              onClick={simpanJumlahBox}
              disabled={savingBox}
              style={{ width: "100%", padding: 13, borderRadius: 10, border: "none", background: savingBox ? "#E4E1DA" : "#28685D", color: "#fff", fontWeight: 700, fontSize: 14 }}
            >
              {savingBox ? "Menyimpan..." : "Konfirmasi Jumlah Box"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// LAPORAN PESANAN - kartu ringkasan status pesanan keseluruhan
// ============================================================
function LaporanPesananPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [selectedKartu, setSelectedKartu] = useState(null); // index kartu yang lagi dibuka daftarnya
  const [detailOrder, setDetailOrder] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(
        token,
        "orders?select=id,no_nota,status,created_at,tanggal_dikirim,picking_selesai_at,outbound_verified_at,alasan_retur,tujuan_kota,tujuan_alamat,tujuan_telp,metode_bayar,clients(nama,kode,alamat,telp,kota),order_items(qty,products(kode,nama,satuan))&order=created_at.desc&limit=2000"
      );
      setOrders(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function cekTerlambatPengemasan(o) {
    const dibuat = new Date(o.created_at);
    const sekarang = new Date();
    if (dibuat.getHours() < 13) {
      const sameDay = dibuat.getFullYear() === sekarang.getFullYear() && dibuat.getMonth() === sekarang.getMonth() && dibuat.getDate() === sekarang.getDate();
      return !sameDay;
    } else {
      const batasWaktu = new Date(dibuat);
      batasWaktu.setDate(batasWaktu.getDate() + 1);
      batasWaktu.setHours(13, 0, 0, 0);
      return sekarang > batasWaktu;
    }
  }

  function cekTerlambatDikirim(o) {
    // Berlaku untuk order yang MASIH di "Siap Dikirim" (sudah outbound,
    // tapi belum masuk Proses Pengiriman) - pakai aturan jam 13:00 yang
    // sama seperti Terlambat Pengemasan, tapi acuannya outbound_verified_at.
    if (o.status !== "siap_dikirim" || !o.outbound_verified_at) return false;
    const outbound = new Date(o.outbound_verified_at);
    const sekarang = new Date();
    if (outbound.getHours() < 13) {
      // Outbound sebelum jam 13:00 -> wajib kirim hari itu juga
      const sameDay = outbound.getFullYear() === sekarang.getFullYear() && outbound.getMonth() === sekarang.getMonth() && outbound.getDate() === sekarang.getDate();
      return !sameDay;
    } else {
      // Outbound setelah jam 13:00 -> wajib kirim besok (belum terlambat
      // hari ini), baru terlambat kalau besoknya JUGA belum dikirim
      const batasWaktu = new Date(outbound);
      batasWaktu.setDate(batasWaktu.getDate() + 1);
      batasWaktu.setHours(23, 59, 59, 999);
      return sekarang > batasWaktu;
    }
  }

  // Order yang SEDANG "Proses Dikirim" - Pekanbaru harus selesai hari
  // yang sama, luar kota toleransi minimal 3 hari.
  function cekTerlambatDikirimKurir(o) {
    if (o.status !== "proses_dikirim" || !o.tanggal_dikirim) return false;
    const kotaTujuanAsli = o.tujuan_kota || o.clients?.kota;
    const isPekanbaru = !!(kotaTujuanAsli && kotaTujuanAsli.trim().toLowerCase().includes("pekanbaru"));
    const dikirim = new Date(o.tanggal_dikirim);
    const sekarang = new Date();
    if (isPekanbaru) {
      const sameDay = dikirim.getFullYear() === sekarang.getFullYear() && dikirim.getMonth() === sekarang.getMonth() && dikirim.getDate() === sekarang.getDate();
      return !sameDay;
    }
    const elapsedDays = (sekarang - dikirim) / (1000 * 60 * 60 * 24);
    return elapsedDays >= 3;
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const statusPengemasan = ["menunggu_pembayaran", "menunggu_pengiriman"];
  const orderPengemasan = orders.filter((o) => statusPengemasan.includes(o.status));
  const orderSiapKirim = orders.filter((o) => o.status === "siap_dikirim");
  const orderProsesKirim = orders.filter((o) => o.status === "proses_dikirim");
  const orderSelesai = orders.filter((o) => o.status === "selesai");
  const orderTerlambatPengemasan = orderPengemasan.filter((o) => cekTerlambatPengemasan(o));
  const orderTerlambatDiambil = orderSiapKirim.filter((o) => cekTerlambatDikirim(o));
  const orderTerlambatDikirimKurir = orderProsesKirim.filter((o) => cekTerlambatDikirimKurir(o));
  const orderProsesRetur = orders.filter((o) => o.status === "diretur");

  const kartu = [
    { label: "Total Pesanan Pengemasan", nilai: orderPengemasan.length, bg: "#F7F5F1", fg: "#24272B", icon: Package, data: orderPengemasan },
    { label: "Total Siap Kirim", nilai: orderSiapKirim.length, bg: "#D8E9E6", fg: "#28685D", icon: Truck, data: orderSiapKirim },
    { label: "Total Proses Kirim", nilai: orderProsesKirim.length, bg: "#D8E9E6", fg: "#28685D", icon: Navigation, data: orderProsesKirim },
    { label: "Total Terlambat Pengemasan", nilai: orderTerlambatPengemasan.length, bg: "#FBEAEA", fg: "#C0392B", icon: Clock, data: orderTerlambatPengemasan },
    { label: "Terlambat Diambil Kurir", nilai: orderTerlambatDiambil.length, bg: "#FBEAEA", fg: "#C0392B", icon: Clock, data: orderTerlambatDiambil },
    { label: "Terlambat Dikirim Kurir", nilai: orderTerlambatDikirimKurir.length, bg: "#FBEAEA", fg: "#C0392B", icon: Clock, data: orderTerlambatDikirimKurir },
    { label: "Total Proses Retur", nilai: orderProsesRetur.length, bg: "#FBF0D9", fg: "#8A6A1A", icon: RefreshCw, data: orderProsesRetur },
    { label: "Total Pesanan Terselesaikan", nilai: orderSelesai.length, bg: "#EFE1BE", fg: "#8A6A1A", icon: Check, data: orderSelesai },
  ];

  const kartuAktif = selectedKartu !== null ? kartu[selectedKartu] : null;

  function exportCSVKartu() {
    if (!kartuAktif) return;
    const header = ["No Nota", "Tanggal", "Toko", "Status", "Tujuan"];
    const rows = kartuAktif.data.map((o) => [
      o.no_nota,
      new Date(o.created_at).toLocaleDateString("id-ID"),
      o.clients?.nama || "",
      o.status,
      o.tujuan_alamat || o.clients?.alamat || "",
    ]);
    const csvContent = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-pesanan-${kartuAktif.label.toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader title="Laporan Pesanan" subtitle={`Ringkasan dari ${orders.length} pesanan (2000 terakhir)`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 20 }}>
        {kartu.map((k, i) => (
          <Card
            key={i}
            onClick={() => setSelectedKartu(selectedKartu === i ? null : i)}
            style={{ padding: 20, cursor: "pointer", border: selectedKartu === i ? "1.5px solid #E8A426" : "1.5px solid transparent" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: k.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <k.icon size={19} color={k.fg} />
              </div>
            </div>
            <p className="disp" style={{ fontSize: 30, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>{k.nilai}</p>
            <p style={{ fontSize: 12.5, color: "#6B6F75", margin: 0, fontWeight: 600 }}>{k.label}</p>
          </Card>
        ))}
      </div>

      {kartuAktif && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: 0 }}>{kartuAktif.label} ({kartuAktif.data.length})</h2>
            {kartuAktif.data.length > 0 && (
              <button
                onClick={exportCSVKartu}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "none", background: "#24272B", color: "#fff", fontSize: 12.5, fontWeight: 700 }}
              >
                <Download size={13} /> Export CSV
              </button>
            )}
          </div>
          {kartuAktif.data.length === 0 ? (
            <EmptyState text="Tidak ada pesanan di kategori ini." />
          ) : (
            kartuAktif.data.map((o) => (
              <Card key={o.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <p className="disp" style={{ fontSize: 16, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{o.no_nota}</p>
                    <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>{o.clients?.nama} ({o.clients?.kode})</p>
                  </div>
                  <button
                    onClick={() => setDetailOrder(o)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
                  >
                    <Eye size={15} /> Lihat Detail
                  </button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* MODAL LIHAT DETAIL */}
      {detailOrder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", padding: 26 }}>
            <h2 className="disp" style={{ fontSize: 19, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>{detailOrder.no_nota}</h2>
            <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 20px" }}>
              {new Date(detailOrder.created_at).toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>Toko</p>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: 0 }}>{detailOrder.clients?.nama} ({detailOrder.clients?.kode})</p>
              </div>
              <div>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>Metode Bayar</p>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: 0, textTransform: "capitalize" }}>{detailOrder.metode_bayar}</p>
              </div>
              <div>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>Tujuan</p>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: 0 }}>{detailOrder.tujuan_alamat || detailOrder.clients?.alamat}</p>
              </div>
              <div>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA0A6", textTransform: "uppercase", margin: "0 0 4px" }}>Status</p>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: 0 }}>
                  {{
                    menunggu_pembayaran: "Menunggu Pembayaran",
                    menunggu_pengiriman: "Menunggu Pengiriman",
                    siap_dikirim: "Siap Dikirim",
                    proses_dikirim: "Proses Dikirim",
                    diretur: "Diretur",
                    selesai: "Selesai",
                  }[detailOrder.status] || detailOrder.status}
                </p>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 8px" }}>Barang Dipesan</p>
              {(detailOrder.order_items || []).map((it, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "6px 0", borderBottom: "1px solid #EDEAE3" }}>
                  <span style={{ color: "#24272B" }}>{it.products?.kode} - {it.products?.nama}</span>
                  <span style={{ fontWeight: 700, color: "#24272B" }}>{it.qty} {it.products?.satuan}</span>
                </div>
              ))}
            </div>

            {detailOrder.alasan_retur && (
              <div style={{ background: "#FBEAEA", borderRadius: 9, padding: 12, marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#C0392B", textTransform: "uppercase", margin: "0 0 4px" }}>Alasan Retur</p>
                <p style={{ fontSize: 12.5, color: "#C0392B", margin: 0 }}>{detailOrder.alasan_retur}</p>
              </div>
            )}

            <button onClick={() => setDetailOrder(null)} style={{ width: "100%", padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// LAPORAN PERFORMA - waktu penyelesaian tiap tahap (pengemasan,
// tunggu diambil kurir, pengiriman) - buat evaluasi kebutuhan tim
// ============================================================
function LaporanPerformaPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [staffMap, setStaffMap] = useState({}); // { user_id: nama }
  const [kunjunganList, setKunjunganList] = useState([]);
  const [salesList, setSalesList] = useState([]);
  const [clientsList, setClientsList] = useState([]);
  const [ordersSemuaStatus, setOrdersSemuaStatus] = useState([]); // buat closing rate - order APAPUN statusnya (bukan cuma yg selesai)
  const [laporanKurirList, setLaporanKurirList] = useState([]);
  const [laporanKurirItemsList, setLaporanKurirItemsList] = useState([]);
  const [ordersKurirMap, setOrdersKurirMap] = useState({}); // { order_id: order } - buat cek tepat waktu kurir
  const [hariLiburSet, setHariLiburSet] = useState(new Set()); // Set of "YYYY-MM-DD" - buat skip Minggu & tanggal merah
  const [tanggalMulai, setTanggalMulai] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [tanggalSelesai, setTanggalSelesai] = useState(() => new Date().toISOString().slice(0, 10));

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(
        token,
        `orders?select=id,no_nota,created_at,picking_selesai_at,picking_oleh,outbound_verified_at,tanggal_dikirim,selesai_at,tujuan_kota,clients(kota)&status=eq.selesai&selesai_at=gte.${tanggalMulai}T00:00:00&selesai_at=lte.${tanggalSelesai}T23:59:59&order=selesai_at.desc&limit=3000`
      );
      setOrders(rows);

      const staffRows = await supabaseFetch(token, "profiles?select=id,nama&role=eq.staff_gudang");
      const map = {};
      (staffRows || []).forEach((s) => { map[s.id] = s.nama; });
      setStaffMap(map);

      // --- Data buat performa SALES (kunjungan + closing rate) ---
      const kunjRows = await supabaseFetch(token, `kunjungan_sales?select=id,sales_id,client_id,created_at&created_at=gte.${tanggalMulai}T00:00:00&created_at=lte.${tanggalSelesai}T23:59:59`);
      setKunjunganList(kunjRows);
      const salesRows = await supabaseFetch(token, "sales?select=id,nama,kode&order=nama.asc");
      setSalesList(salesRows);
      const clientRows = await supabaseFetch(token, "clients?select=id,sales_id&sales_id=not.is.null");
      setClientsList(clientRows);
      const orderSemuaRows = await supabaseFetch(token, `orders?select=id,client_id,created_at&created_at=gte.${tanggalMulai}T00:00:00&created_at=lte.${tanggalSelesai}T23:59:59&status=not.in.(ditolak)`);
      setOrdersSemuaStatus(orderSemuaRows);

      // --- Data buat performa KURIR (persentase tepat waktu per kurir) ---
      const lapKurirRows = await supabaseFetch(token, `laporan_kurir?select=id,dibuat_oleh,nama_kurir,jenis_kurir,jenis_laporan&created_at=gte.${tanggalMulai}T00:00:00&created_at=lte.${tanggalSelesai}T23:59:59&jenis_laporan=eq.serah_terima`);
      setLaporanKurirList(lapKurirRows);
      const idLapKurir = (lapKurirRows || []).map((l) => l.id);
      let itemRows = [];
      if (idLapKurir.length > 0) {
        itemRows = await supabaseFetch(token, `laporan_kurir_items?select=laporan_kurir_id,order_id&laporan_kurir_id=in.(${idLapKurir.join(",")})`);
      }
      setLaporanKurirItemsList(itemRows);
      const idOrderKurir = [...new Set((itemRows || []).map((it) => it.order_id))];
      let orderKurirRows = [];
      if (idOrderKurir.length > 0) {
        orderKurirRows = await supabaseFetch(token, `orders?select=id,tanggal_dikirim,selesai_at,status,tujuan_kota,clients(kota)&id=in.(${idOrderKurir.join(",")})`);
      }
      const omap = {};
      (orderKurirRows || []).forEach((o) => { omap[o.id] = o; });
      setOrdersKurirMap(omap);

      // Ambil SEMUA tanggal merah (tidak dibatasi rentang filter) - karena
      // order bisa saja MULAI (created_at) jauh sebelum rentang tanggal
      // yang difilter, jadi butuh data hari libur yang lebih luas.
      const liburRows = await supabaseFetch(token, "hari_libur?select=tanggal");
      setHariLiburSet(new Set((liburRows || []).map((h) => h.tanggal)));
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [tanggalMulai, tanggalSelesai]);

  // Hitung selisih waktu dalam JAM antara 2 timestamp - TAPI skip jam yang
  // jatuh di hari Minggu atau tanggal merah, karena hari itu toko/staff
  // memang tidak kerja, jadi tidak adil dihitung sebagai "lambat".
  function selisihJam(dari, sampai) {
    if (!dari || !sampai) return null;
    const mulai = new Date(dari);
    const akhir = new Date(sampai);
    if (akhir <= mulai) return 0;

    function tglStr(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    function hariLiburAtauMinggu(d) {
      return d.getDay() === 0 || hariLiburSet.has(tglStr(d));
    }

    let totalJam = 0;
    let kursor = new Date(mulai);
    while (kursor < akhir) {
      const akhirHariIni = new Date(kursor.getFullYear(), kursor.getMonth(), kursor.getDate(), 23, 59, 59, 999);
      const batasSegmen = akhir < akhirHariIni ? akhir : akhirHariIni;
      if (!hariLiburAtauMinggu(kursor)) {
        totalJam += (batasSegmen - kursor) / (1000 * 60 * 60);
      }
      kursor = new Date(kursor.getFullYear(), kursor.getMonth(), kursor.getDate() + 1, 0, 0, 0, 0);
    }
    return totalJam;
  }

  function rataRata(arr) {
    const valid = arr.filter((v) => v !== null && !isNaN(v));
    if (valid.length === 0) return null;
    return valid.reduce((sum, v) => sum + v, 0) / valid.length;
  }

  function formatJam(jam) {
    if (jam === null) return "-";
    if (jam < 1) return `${Math.round(jam * 60)} menit`;
    if (jam < 24) return `${jam.toFixed(1)} jam`;
    return `${(jam / 24).toFixed(1)} hari`;
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const waktuPengemasan = orders.map((o) => selisihJam(o.created_at, o.picking_selesai_at));
  const waktuTungguKurir = orders.map((o) => selisihJam(o.outbound_verified_at, o.tanggal_dikirim));
  const waktuPengiriman = orders.map((o) => selisihJam(o.tanggal_dikirim, o.selesai_at));
  const waktuTotal = orders.map((o) => selisihJam(o.created_at, o.selesai_at));

  // Menilai rata-rata terhadap target: "baik" (hijau, di bawah target sangat
  // baik), "cukup" (kuning, di bawah target cukup baik), "perhatian" (merah,
  // di atas keduanya) - buat bantu baca cepat tanpa perlu hitung manual.
  function nilaiStatus(rataRataJam, targetSangatBaik, targetCukupBaik) {
    if (rataRataJam === null) return { warna: "#9CA0A6", teks: "Belum ada data" };
    if (rataRataJam <= targetSangatBaik) return { warna: "#28685D", teks: "Sangat Baik" };
    if (rataRataJam <= targetCukupBaik) return { warna: "#8A6A1A", teks: "Cukup Baik" };
    return { warna: "#C0392B", teks: "Perlu Perhatian" };
  }

  const rrPengemasan = rataRata(waktuPengemasan);
  const rrTungguKurir = rataRata(waktuTungguKurir);
  const rrPengiriman = rataRata(waktuPengiriman);
  const rrTotal = rataRata(waktuTotal);

  const kartu = [
    { label: "Rata-rata Waktu Pengemasan", nilai: formatJam(rrPengemasan), sub: "dari pesanan dibuat sampai selesai di-picking", icon: Package, bg: "#F7F5F1", target: "Target: < 4 jam (sangat baik), < 12 jam (cukup baik)", status: nilaiStatus(rrPengemasan, 4, 12) },
    { label: "Rata-rata Tunggu Diambil Kurir", nilai: formatJam(rrTungguKurir), sub: "dari siap dikirim sampai diambil kurir", icon: Clock, bg: "#FBF0D9", target: "Target: < 2 jam (sangat baik), < 6 jam (cukup baik)", status: nilaiStatus(rrTungguKurir, 2, 6) },
    { label: "Rata-rata Waktu Pengiriman", nilai: formatJam(rrPengiriman), sub: "dari diambil kurir sampai selesai", icon: Truck, bg: "#D8E9E6", target: "Target: < 24 jam (sangat baik), < 72 jam (cukup baik)", status: nilaiStatus(rrPengiriman, 24, 72) },
    { label: "Rata-rata Total (Ujung ke Ujung)", nilai: formatJam(rrTotal), sub: "dari pesanan dibuat sampai benar-benar selesai", icon: TrendingUp, bg: "#EFE1BE", target: "Target: < 1-2 hari (sangat baik), < 3-4 hari (cukup baik)", status: nilaiStatus(rrTotal, 48, 96) },
  ];

  // Breakdown per staff gudang - buat evaluasi performa individual
  const perStaff = {};
  orders.forEach((o) => {
    if (!o.picking_oleh) return;
    const jam = selisihJam(o.created_at, o.picking_selesai_at);
    if (jam === null) return;
    if (!perStaff[o.picking_oleh]) perStaff[o.picking_oleh] = [];
    perStaff[o.picking_oleh].push(jam);
  });
  const daftarStaff = Object.entries(perStaff)
    .map(([userId, jamArr]) => ({ userId, nama: staffMap[userId] || "Staff (tidak diketahui)", jumlahOrder: jamArr.length, rataRata: rataRata(jamArr) }))
    .sort((a, b) => a.rataRata - b.rataRata);

  // ---------- PERFORMA SALES: kunjungan + closing rate ----------
  const daftarSales = salesList.map((s) => {
    const kunjunganSales = kunjunganList.filter((k) => k.sales_id === s.id);
    const tokoDikunjungi = [...new Set(kunjunganSales.map((k) => k.client_id))];
    const idTokoSalesIni = new Set(clientsList.filter((c) => c.sales_id === s.id).map((c) => c.id));
    // "Closing" = toko yang DIKUNJUNGI sales ini DAN punya order baru di
    // rentang tanggal yang sama (proxy sederhana kunjungan efektif)
    const tokoClosing = tokoDikunjungi.filter((clientId) =>
      idTokoSalesIni.has(clientId) && ordersSemuaStatus.some((o) => o.client_id === clientId)
    );
    const closingRate = tokoDikunjungi.length > 0 ? (tokoClosing.length / tokoDikunjungi.length) * 100 : null;
    return {
      id: s.id, nama: s.nama, kode: s.kode,
      totalKunjungan: kunjunganSales.length,
      tokoDikunjungi: tokoDikunjungi.length,
      tokoClosing: tokoClosing.length,
      closingRate,
    };
  }).filter((s) => s.totalKunjungan > 0)
    .sort((a, b) => (b.closingRate || 0) - (a.closingRate || 0));

  // ---------- PERFORMA KURIR: persentase tepat waktu per kurir ----------
  const perKurir = {};
  laporanKurirList.forEach((lap) => {
    const namaKey = lap.dibuat_oleh || lap.nama_kurir; // kurir toko pakai akun (dibuat_oleh), Baraka pakai nama manual
    const itemsLaporanIni = laporanKurirItemsList.filter((it) => it.laporan_kurir_id === lap.id);
    itemsLaporanIni.forEach((it) => {
      const o = ordersKurirMap[it.order_id];
      if (!o || !o.tanggal_dikirim || !o.selesai_at) return; // cuma hitung yang sudah benar-benar selesai
      const kotaTujuan = o.tujuan_kota || o.clients?.kota;
      const isPekanbaru = !!(kotaTujuan && kotaTujuan.trim().toLowerCase().includes("pekanbaru"));
      const dikirim = new Date(o.tanggal_dikirim);
      const selesai = new Date(o.selesai_at);
      const tepatWaktu = isPekanbaru
        ? dikirim.toDateString() === selesai.toDateString()
        : (selesai - dikirim) / (1000 * 60 * 60 * 24) < 3;
      if (!perKurir[namaKey]) perKurir[namaKey] = { nama: lap.dibuat_oleh ? (staffMap[lap.dibuat_oleh] || lap.nama_kurir) : lap.nama_kurir, jenis: lap.jenis_kurir, total: 0, tepat: 0 };
      perKurir[namaKey].total += 1;
      if (tepatWaktu) perKurir[namaKey].tepat += 1;
    });
  });
  const daftarKurir = Object.values(perKurir)
    .map((k) => ({ ...k, persentase: k.total > 0 ? (k.tepat / k.total) * 100 : null }))
    .sort((a, b) => (b.persentase || 0) - (a.persentase || 0));

  function exportCSV() {
    const header = ["No Nota", "Dibuat", "Picking Selesai", "Outbound", "Dikirim", "Selesai", "Waktu Pengemasan (jam)", "Waktu Tunggu Kurir (jam)", "Waktu Pengiriman (jam)"];
    const rows = orders.map((o, i) => [
      o.no_nota,
      o.created_at ? new Date(o.created_at).toLocaleString("id-ID") : "",
      o.picking_selesai_at ? new Date(o.picking_selesai_at).toLocaleString("id-ID") : "",
      o.outbound_verified_at ? new Date(o.outbound_verified_at).toLocaleString("id-ID") : "",
      o.tanggal_dikirim ? new Date(o.tanggal_dikirim).toLocaleString("id-ID") : "",
      o.selesai_at ? new Date(o.selesai_at).toLocaleString("id-ID") : "",
      waktuPengemasan[i] !== null ? waktuPengemasan[i].toFixed(1) : "",
      waktuTungguKurir[i] !== null ? waktuTungguKurir[i].toFixed(1) : "",
      waktuPengiriman[i] !== null ? waktuPengiriman[i].toFixed(1) : "",
    ]);
    const csvContent = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-performa-${tanggalMulai}-${tanggalSelesai}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader title="Laporan Performa" subtitle={`Berdasarkan ${orders.length} pesanan selesai - jam Minggu & tanggal merah tidak ikut dihitung`} />

      <Card style={{ marginBottom: 20, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Dari Tanggal</label>
            <input type="date" value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E4E1DA", fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Sampai Tanggal</label>
            <input type="date" value={tanggalSelesai} onChange={(e) => setTanggalSelesai(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E4E1DA", fontSize: 13 }} />
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={exportCSV}
            disabled={orders.length === 0}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "none", background: "#24272B", color: "#fff", fontSize: 13, fontWeight: 700, alignSelf: "flex-end" }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 24 }}>
        {kartu.map((k, i) => (
          <Card key={i} style={{ padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: k.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <k.icon size={19} color={k.status.warna} />
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: k.status.warna + "22", color: k.status.warna }}>{k.status.teks}</span>
            </div>
            <p className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>{k.nilai}</p>
            <p style={{ fontSize: 12.5, color: "#24272B", margin: "0 0 4px", fontWeight: 700 }}>{k.label}</p>
            <p style={{ fontSize: 11, color: "#9CA0A6", margin: "0 0 8px" }}>{k.sub}</p>
            <p style={{ fontSize: 10.5, color: "#9CA0A6", margin: 0, fontStyle: "italic", borderTop: "1px solid #EDEAE3", paddingTop: 8 }}>{k.target}</p>
          </Card>
        ))}
      </div>

      {daftarStaff.length > 0 && (
        <>
          <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>Performa Picking per Staff Gudang</h2>
          <Card style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F7F5F1" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase" }}>Nama Staff</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase" }}>Jumlah Order</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase" }}>Rata-rata Waktu Picking</th>
                </tr>
              </thead>
              <tbody>
                {daftarStaff.map((s, i) => (
                  <tr key={s.userId} style={{ borderTop: i > 0 ? "1px solid #EDEAE3" : "none" }}>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#24272B" }}>{s.nama}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, textAlign: "center", color: "#6B6F75" }}>{s.jumlahOrder}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, textAlign: "right", fontWeight: 700, color: "#24272B" }}>{formatJam(s.rataRata)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {daftarSales.length > 0 && (
        <>
          <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>Performa Sales - Kunjungan & Closing Rate</h2>
          <Card style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F7F5F1" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase" }}>Sales</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase" }}>Total Kunjungan</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase" }}>Toko Dikunjungi</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase" }}>Toko Closing</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase" }}>Closing Rate</th>
                </tr>
              </thead>
              <tbody>
                {daftarSales.map((s, i) => (
                  <tr key={s.id} style={{ borderTop: i > 0 ? "1px solid #EDEAE3" : "none" }}>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#24272B" }}>{s.nama} <span style={{ color: "#9CA0A6", fontWeight: 600 }}>({s.kode})</span></td>
                    <td style={{ padding: "12px 16px", fontSize: 13, textAlign: "center", color: "#6B6F75" }}>{s.totalKunjungan}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, textAlign: "center", color: "#6B6F75" }}>{s.tokoDikunjungi}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, textAlign: "center", color: "#6B6F75" }}>{s.tokoClosing}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, textAlign: "right", fontWeight: 700, color: s.closingRate >= 50 ? "#28685D" : "#C0392B" }}>
                      {s.closingRate !== null ? s.closingRate.toFixed(0) + "%" : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p style={{ fontSize: 11, color: "#9CA0A6", margin: "-16px 0 24px", lineHeight: 1.6 }}>
            Closing Rate = persentase toko yang dikunjungi DAN memesan (order apapun statusnya, kecuali ditolak) dalam rentang tanggal yang sama - perkiraan sederhana kunjungan efektif, bukan sebab-akibat pasti.
          </p>
        </>
      )}

      {daftarKurir.length > 0 && (
        <>
          <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>Performa Kurir - Persentase Tepat Waktu</h2>
          <Card style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#F7F5F1" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase" }}>Kurir</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase" }}>Jenis</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase" }}>Total Kirim</th>
                  <th style={{ padding: "12px 16px", textAlign: "center", fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase" }}>Tepat Waktu</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase" }}>Persentase</th>
                </tr>
              </thead>
              <tbody>
                {daftarKurir.map((k, i) => (
                  <tr key={i} style={{ borderTop: i > 0 ? "1px solid #EDEAE3" : "none" }}>
                    <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: "#24272B" }}>{k.nama}</td>
                    <td style={{ padding: "12px 16px", fontSize: 12.5, color: "#6B6F75", textTransform: "capitalize" }}>{k.jenis}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, textAlign: "center", color: "#6B6F75" }}>{k.total}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, textAlign: "center", color: "#6B6F75" }}>{k.tepat}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, textAlign: "right", fontWeight: 700, color: k.persentase >= 80 ? "#28685D" : "#C0392B" }}>
                      {k.persentase !== null ? k.persentase.toFixed(0) + "%" : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p style={{ fontSize: 11, color: "#9CA0A6", margin: "-16px 0 24px", lineHeight: 1.6 }}>
            Tepat waktu = Pekanbaru selesai di hari yang sama saat dikirim; luar kota selesai dalam waktu kurang dari 3 hari. Cuma menghitung pengiriman yang sudah benar-benar Selesai.
          </p>
        </>
      )}

      <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "20px 0 0", lineHeight: 1.6 }}>
        Catatan: data ini cuma dari pesanan yang statusnya sudah "Selesai" dalam rentang tanggal terpilih (berdasarkan tanggal selesai). Pesanan yang masih berjalan tidak dihitung supaya rata-ratanya tidak bias.
      </p>
    </div>
  );
}

// ============================================================
// LOG AKTIVITAS - audit trail terpusat "siapa ngapain kapan"
// ============================================================
function LogAktivitasPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");
  const [filterAksi, setFilterAksi] = useState("semua");
  const [filterUser, setFilterUser] = useState("semua");
  const [tanggalMulai, setTanggalMulai] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [tanggalSelesai, setTanggalSelesai] = useState(() => new Date().toISOString().slice(0, 10));
  const [detailLog, setDetailLog] = useState(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(
        token,
        `log_aktivitas?select=*&created_at=gte.${tanggalMulai}T00:00:00&created_at=lte.${tanggalSelesai}T23:59:59&order=created_at.desc&limit=500`
      );
      setLogs(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [tanggalMulai, tanggalSelesai]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const daftarAksi = [...new Set(logs.map((l) => l.aksi))];
  const daftarUser = [...new Set(logs.map((l) => l.nama_user).filter(Boolean))];

  const logTampil = logs
    .filter((l) => filterAksi === "semua" || l.aksi === filterAksi)
    .filter((l) => filterUser === "semua" || l.nama_user === filterUser);

  const labelAksi = {
    ubah_status_order: "Ubah Status Order",
    ubah_harga_produk: "Ubah Harga Produk",
    login: "Login",
    logout: "Logout",
  };

  return (
    <div>
      <PageHeader title="Log Aktivitas" subtitle={`${logTampil.length} aktivitas tercatat dalam rentang tanggal terpilih`} />

      <Card style={{ marginBottom: 20, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Dari Tanggal</label>
            <input type="date" value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E4E1DA", fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Sampai Tanggal</label>
            <input type="date" value={tanggalSelesai} onChange={(e) => setTanggalSelesai(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E4E1DA", fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Jenis Aksi</label>
            <select value={filterAksi} onChange={(e) => setFilterAksi(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E4E1DA", fontSize: 13 }}>
              <option value="semua">Semua Aksi</option>
              {daftarAksi.map((a) => <option key={a} value={a}>{labelAksi[a] || a}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Staff</label>
            <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E4E1DA", fontSize: 13 }}>
              <option value="semua">Semua Staff</option>
              {daftarUser.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => {
              const header = ["Waktu", "Staff", "Role", "Aksi", "Deskripsi"];
              const rows = logTampil.map((l) => [
                new Date(l.created_at).toLocaleString("id-ID"),
                l.nama_user || "",
                l.role_user || "",
                labelAksi[l.aksi] || l.aksi,
                l.deskripsi,
              ]);
              const csvContent = [header, ...rows]
                .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
                .join("\r\n");
              const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `log-aktivitas-${tanggalMulai}-${tanggalSelesai}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            disabled={logTampil.length === 0}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 9, border: "none", background: "#24272B", color: "#fff", fontSize: 13, fontWeight: 700, alignSelf: "flex-end" }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </Card>

      {logTampil.length === 0 ? (
        <EmptyState text="Tidak ada aktivitas tercatat di rentang & filter ini." />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F7F5F1" }}>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase" }}>Waktu</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase" }}>Staff</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase" }}>Aksi</th>
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase" }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {logTampil.map((l, i) => (
                <tr key={l.id} style={{ borderTop: i > 0 ? "1px solid #EDEAE3" : "none", cursor: (l.data_sebelum || l.data_sesudah) ? "pointer" : "default" }} onClick={() => (l.data_sebelum || l.data_sesudah) && setDetailLog(l)}>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6B6F75", whiteSpace: "nowrap" }}>
                    {new Date(l.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12.5, fontWeight: 700, color: "#24272B" }}>
                    {l.nama_user || "-"}
                    <span style={{ display: "block", fontSize: 10.5, color: "#9CA0A6", fontWeight: 600, textTransform: "capitalize" }}>{(l.role_user || "").replace("_", " ")}</span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#F7F5F1", color: "#6B6F75" }}>{labelAksi[l.aksi] || l.aksi}</span>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12.5, color: "#24272B" }}>{l.deskripsi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* MODAL DETAIL - tampilkan data sebelum/sesudah kalau ada */}
      {detailLog && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, padding: 26 }}>
            <h2 className="disp" style={{ fontSize: 17, fontWeight: 700, color: "#24272B", margin: "0 0 4px" }}>{labelAksi[detailLog.aksi] || detailLog.aksi}</h2>
            <p style={{ fontSize: 12.5, color: "#9CA0A6", margin: "0 0 18px" }}>{detailLog.deskripsi}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div style={{ background: "#FBEAEA", borderRadius: 9, padding: 12 }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: "#C0392B", textTransform: "uppercase", margin: "0 0 6px" }}>Sebelum</p>
                <pre style={{ fontSize: 11.5, color: "#C0392B", margin: 0, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>{JSON.stringify(detailLog.data_sebelum, null, 2)}</pre>
              </div>
              <div style={{ background: "#D8E9E6", borderRadius: 9, padding: 12 }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, color: "#28685D", textTransform: "uppercase", margin: "0 0 6px" }}>Sesudah</p>
                <pre style={{ fontSize: 11.5, color: "#28685D", margin: 0, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>{JSON.stringify(detailLog.data_sesudah, null, 2)}</pre>
              </div>
            </div>
            <button onClick={() => setDetailLog(null)} style={{ width: "100%", marginTop: 18, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// KELOLA GUDANG - fondasi dasar multi gudang (persiapan jangka panjang,
// belum terhubung ke alur stock/order - cuma kelola daftar gudang dulu)
// ============================================================
function KelolaGudangPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [gudangList, setGudangList] = useState([]);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ nama: "", kota: "", alamat: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, "gudang?select=*&order=created_at.asc");
      setGudangList(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function bukaTambah() {
    setForm({ nama: "", kota: "", alamat: "" });
    setEditingId(null);
    setShowForm(true);
  }

  function bukaEdit(g) {
    setForm({ nama: g.nama, kota: g.kota || "", alamat: g.alamat || "" });
    setEditingId(g.id);
    setShowForm(true);
  }

  async function simpan() {
    if (!form.nama.trim()) { alert("Isi dulu nama gudang."); return; }
    setSaving(true);
    try {
      if (editingId) {
        await supabaseFetch(token, `gudang?id=eq.${editingId}`, { method: "PATCH", body: JSON.stringify(form) });
      } else {
        await supabaseFetch(token, "gudang", { method: "POST", body: JSON.stringify(form) });
      }
      setShowForm(false);
      load();
    } catch (e) {
      alert("Gagal simpan: " + e.message);
    }
    setSaving(false);
  }

  async function toggleAktif(g) {
    try {
      await supabaseFetch(token, `gudang?id=eq.${g.id}`, { method: "PATCH", body: JSON.stringify({ aktif: !g.aktif }) });
      load();
    } catch (e) {
      alert("Gagal ubah status: " + e.message);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Kelola Gudang" subtitle="Fondasi dasar untuk persiapan multi gudang di masa depan" />

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "#FBF0D9", borderRadius: 10, padding: 12, marginBottom: 20 }}>
        <AlertCircle size={15} color="#8A6A1A" style={{ flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: 12, color: "#8A6A1A", margin: 0, lineHeight: 1.5 }}>
          Menu ini baru fondasi dasar - data gudang di sini <strong>belum terhubung otomatis</strong> ke stock/picking/order. Kalau nanti benar-benar buka gudang kedua, hubungi saya lagi untuk kembangkan integrasinya sesuai kebutuhan operasional saat itu.
        </p>
      </div>

      <button
        onClick={bukaTambah}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5, marginBottom: 20 }}
      >
        + Tambah Gudang
      </button>

      {gudangList.map((g) => (
        <Card key={g.id} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <p className="disp" style={{ fontSize: 16, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>
                {g.nama}
                {!g.aktif && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#F7F5F1", color: "#9CA0A6", verticalAlign: "middle" }}>Nonaktif</span>
                )}
              </p>
              <p style={{ fontSize: 13, color: "#6B6F75", margin: 0 }}>{g.kota || "-"}</p>
              {g.alamat && <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "4px 0 0" }}>{g.alamat}</p>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => bukaEdit(g)} style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}>
                Edit
              </button>
              <button onClick={() => toggleAktif(g)} style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid #E4E1DA", background: "#fff", color: g.aktif ? "#C0392B" : "#28685D", fontSize: 12.5, fontWeight: 700 }}>
                {g.aktif ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </div>
          </div>
        </Card>
      ))}

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(36,39,43,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 400, padding: 26 }}>
            <h2 className="disp" style={{ fontSize: 18, fontWeight: 700, color: "#24272B", margin: "0 0 20px" }}>{editingId ? "Edit Gudang" : "Tambah Gudang"}</h2>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Nama Gudang</label>
              <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5 }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Kota</label>
              <input value={form.kota} onChange={(e) => setForm({ ...form, kota: e.target.value })} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5 }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", marginBottom: 6, display: "block" }}>Alamat</label>
              <textarea value={form.alamat} onChange={(e) => setForm({ ...form, alamat: e.target.value })} rows={2} style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13.5, resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 13.5 }}>
                Batal
              </button>
              <button onClick={simpan} disabled={saving} style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: "#28685D", color: "#fff", fontWeight: 700, fontSize: 13.5 }}>
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
// RATING & KOMPLAIN TOKO - lihat ulasan/keluhan yang masuk dari toko
// ============================================================
function RatingKomplainPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [ratingList, setRatingList] = useState([]);
  const [error, setError] = useState("");
  const [filterKategori, setFilterKategori] = useState("semua");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, "rating_pesanan?select=*,orders(no_nota),clients(nama,kode)&order=created_at.desc&limit=500");
      setRatingList(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function tandaiDibaca(id) {
    try {
      await supabaseFetch(token, `rating_pesanan?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ dibaca_owner: true }) });
      setRatingList((prev) => prev.map((r) => (r.id === id ? { ...r, dibaca_owner: true } : r)));
    } catch (e) { /* diamkan */ }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const KATEGORI_LABEL = {
    kualitas_barang: "Kualitas Barang", salah_kirim: "Salah Kirim", kemasan_rusak: "Kemasan Rusak",
    pengiriman_lambat: "Pengiriman Lambat", lainnya: "Lainnya",
  };

  const rataRata = ratingList.length > 0 ? ratingList.reduce((sum, r) => sum + r.rating, 0) / ratingList.length : null;
  const totalKomplain = ratingList.filter((r) => r.rating <= 3).length;
  const belumDibaca = ratingList.filter((r) => !r.dibaca_owner).length;

  const listTampil = filterKategori === "semua" ? ratingList : ratingList.filter((r) => r.kategori_komplain === filterKategori);

  return (
    <div>
      <PageHeader title="Rating & Komplain Toko" subtitle={`${ratingList.length} ulasan masuk`} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 20 }}>
        <Card style={{ padding: 18 }}>
          <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Rata-rata Rating</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <p className="disp" style={{ fontSize: 26, fontWeight: 700, color: "#24272B", margin: 0 }}>{rataRata !== null ? rataRata.toFixed(1) : "-"}</p>
            <Star size={18} fill="#E8A426" color="#E8A426" />
          </div>
        </Card>
        <Card style={{ padding: 18, background: totalKomplain > 0 ? "#FBEAEA" : "#fff" }}>
          <p style={{ fontSize: 11.5, color: totalKomplain > 0 ? "#C0392B" : "#9CA0A6", margin: "0 0 6px", fontWeight: 700 }}>Total Komplain (≤3 bintang)</p>
          <p className="disp" style={{ fontSize: 26, fontWeight: 700, color: totalKomplain > 0 ? "#C0392B" : "#24272B", margin: 0 }}>{totalKomplain}</p>
        </Card>
        <Card style={{ padding: 18 }}>
          <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Belum Dibaca</p>
          <p className="disp" style={{ fontSize: 26, fontWeight: 700, color: "#24272B", margin: 0 }}>{belumDibaca}</p>
        </Card>
      </div>

      <select value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)} style={{ padding: "9px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, background: "#fff", marginBottom: 16 }}>
        <option value="semua">Semua Kategori</option>
        {Object.entries(KATEGORI_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>

      {listTampil.length === 0 ? (
        <EmptyState text="Belum ada rating/komplain masuk." />
      ) : (
        listTampil.map((r) => (
          <Card key={r.id} style={{ marginBottom: 12, border: !r.dibaca_owner ? "1.5px solid #E8A426" : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: "flex", gap: 2, marginBottom: 6 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={15} fill={n <= r.rating ? "#E8A426" : "none"} color={n <= r.rating ? "#E8A426" : "#D8D6D0"} />
                  ))}
                  {!r.dibaca_owner && (
                    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#FBF0D9", color: "#8A6A1A" }}>BARU</span>
                  )}
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{r.clients?.nama} ({r.clients?.kode})</p>
                <p style={{ fontSize: 12, color: "#6B6F75", margin: "0 0 8px" }}>{r.orders?.no_nota}</p>
                {r.kategori_komplain && (
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: "#FBEAEA", color: "#C0392B", marginBottom: 8, display: "inline-block" }}>
                    {KATEGORI_LABEL[r.kategori_komplain] || r.kategori_komplain}
                  </span>
                )}
                {r.catatan && <p style={{ fontSize: 13, color: "#24272B", margin: "6px 0 0", lineHeight: 1.5 }}>{r.catatan}</p>}
                <p style={{ fontSize: 11, color: "#9CA0A6", margin: "8px 0 0" }}>
                  {new Date(r.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              {!r.dibaca_owner && (
                <button
                  onClick={() => tandaiDibaca(r.id)}
                  style={{ padding: "8px 14px", borderRadius: 9, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 12, fontWeight: 700, flexShrink: 0 }}
                >
                  Tandai Dibaca
                </button>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

// ============================================================
// BACKUP DATA - lihat & download backup terjadwal, atau backup manual
// ============================================================
// ============================================================
// PIN ATASAN - PIN 6 angka yang diminta saat Admin approve pesanan COD
// berulang untuk toko yang masih punya COD lain belum selesai.
// ============================================================
function PinAtasanPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [pinLama, setPinLama] = useState("000000");
  const [pinBaru, setPinBaru] = useState("");
  const [pinKonfirmasi, setPinKonfirmasi] = useState("");
  const [saving, setSaving] = useState(false);
  const [pesan, setPesan] = useState(null);

  useEffect(() => {
    supabaseFetch(token, "pengaturan_pin_atasan?select=pin&id=eq.1")
      .then((rows) => setPinLama(rows[0]?.pin || "000000"))
      .finally(() => setLoading(false));
  }, []);

  async function simpanPin() {
    if (pinBaru.length !== 6) { setPesan({ type: "error", text: "PIN harus 6 angka." }); return; }
    if (pinBaru !== pinKonfirmasi) { setPesan({ type: "error", text: "Konfirmasi PIN tidak cocok." }); return; }
    setSaving(true);
    setPesan(null);
    try {
      await supabaseFetch(token, "pengaturan_pin_atasan?id=eq.1", {
        method: "PATCH",
        body: JSON.stringify({ pin: pinBaru, updated_at: new Date().toISOString() }),
      });
      setPinLama(pinBaru);
      setPinBaru("");
      setPinKonfirmasi("");
      setPesan({ type: "ok", text: "PIN berhasil diperbarui." });
    } catch (e) {
      setPesan({ type: "error", text: "Gagal simpan: " + e.message });
    }
    setSaving(false);
  }

  if (loading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="PIN Atasan" subtitle="PIN ini diminta saat Admin approve pesanan COD berulang untuk toko yang masih punya COD lain belum selesai." />

      <Card style={{ maxWidth: 420 }}>
        <p style={{ fontSize: 12, color: "#9CA0A6", margin: "0 0 4px", fontWeight: 700, textTransform: "uppercase" }}>PIN Saat Ini</p>
        <p className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", letterSpacing: "0.3em", margin: "0 0 20px" }}>{pinLama}</p>

        <label style={{ fontSize: 12, fontWeight: 700, color: "#6B6F75", display: "block", marginBottom: 6 }}>PIN Baru (6 Angka)</label>
        <input
          type="text" inputMode="numeric" maxLength={6} value={pinBaru}
          onChange={(e) => setPinBaru(e.target.value.replace(/\D/g, ""))}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 16, letterSpacing: "0.2em", marginBottom: 14 }}
        />

        <label style={{ fontSize: 12, fontWeight: 700, color: "#6B6F75", display: "block", marginBottom: 6 }}>Konfirmasi PIN Baru</label>
        <input
          type="text" inputMode="numeric" maxLength={6} value={pinKonfirmasi}
          onChange={(e) => setPinKonfirmasi(e.target.value.replace(/\D/g, ""))}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 16, letterSpacing: "0.2em", marginBottom: 16 }}
        />

        {pesan && (
          <p style={{ fontSize: 12.5, color: pesan.type === "ok" ? "#28685D" : "#C0392B", margin: "0 0 12px" }}>{pesan.text}</p>
        )}

        <button
          onClick={simpanPin}
          disabled={saving}
          style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: "#28685D", color: "#fff", fontWeight: 700, fontSize: 13.5 }}
        >
          {saving ? "Menyimpan..." : "Simpan PIN Baru"}
        </button>
      </Card>
    </div>
  );
}

function BackupDataPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [fileList, setFileList] = useState([]);
  const [error, setError] = useState("");
  const [backingUp, setBackingUp] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/backups`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: "", limit: 100, sortBy: { column: "created_at", order: "desc" } }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
      const data = await res.json();
      setFileList(data || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function downloadFile(namaFile) {
    try {
      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/backups/${namaFile}`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = namaFile;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Gagal download: " + e.message);
    }
  }

  async function backupSekarang() {
    setBackingUp(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/backup-database`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
      await load();
      alert("Backup berhasil dibuat.");
    } catch (e) {
      alert("Gagal backup: " + e.message);
    }
    setBackingUp(false);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Backup Data" subtitle="Salinan data penting - dibuat otomatis tiap hari, tersimpan 30 hari terakhir" />

      <button
        onClick={backupSekarang}
        disabled={backingUp}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "none", background: "#E8A426", color: "#24272B", fontWeight: 700, fontSize: 13.5, marginBottom: 20 }}
      >
        <RefreshCw size={16} /> {backingUp ? "Membuat Backup..." : "Backup Sekarang"}
      </button>

      {fileList.length === 0 ? (
        <EmptyState text="Belum ada backup tersimpan." />
      ) : (
        fileList.map((f) => (
          <Card key={f.name} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{f.name}</p>
                <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: 0 }}>
                  {new Date(f.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                  {f.metadata?.size && ` - ${(f.metadata.size / 1024).toFixed(0)} KB`}
                </p>
              </div>
              <button
                onClick={() => downloadFile(f.name)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 9, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
              >
                <Download size={14} /> Download
              </button>
            </div>
          </Card>
        ))
      )}

      <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "20px 0 0", lineHeight: 1.6 }}>
        Backup berisi data tabel-tabel penting (pesanan, toko, produk, saldo, dll) dalam format JSON. Ini bukan pengganti backup Supabase bawaan, tapi lapis tambahan yang bisa Anda unduh dan simpan sendiri kapan saja.
      </p>
    </div>
  );
}

// ============================================================
// PERMINTAAN HAPUS AKUN - toko ajukan, Owner/Admin proses
// ============================================================
function PermintaanHapusAkunPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [permintaanList, setPermintaanList] = useState([]);
  const [error, setError] = useState("");
  const [prosesId, setProsesId] = useState(null);
  const [catatanInput, setCatatanInput] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const rows = await supabaseFetch(token, "permintaan_hapus_akun?select=*,clients(nama,kode,telp)&order=created_at.desc");
      setPermintaanList(rows);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function prosesPermintaan(id, statusBaru) {
    setSaving(true);
    try {
      await supabaseFetch(token, `permintaan_hapus_akun?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: statusBaru, catatan_admin: catatanInput || null, diproses_at: new Date().toISOString() }),
      });
      setProsesId(null);
      setCatatanInput("");
      load();
    } catch (e) {
      alert("Gagal proses: " + e.message);
    }
    setSaving(false);
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const STATUS_LABEL = {
    menunggu: { label: "Menunggu", bg: "#FBF0D9", fg: "#8A6A1A" },
    diproses: { label: "Sudah Diproses", bg: "#D8E9E6", fg: "#28685D" },
    ditolak: { label: "Ditolak", bg: "#FBEAEA", fg: "#C0392B" },
  };

  const menunggu = permintaanList.filter((p) => p.status === "menunggu");
  const selesai = permintaanList.filter((p) => p.status !== "menunggu");

  return (
    <div>
      <PageHeader title="Permintaan Hapus Akun" subtitle={`${menunggu.length} permintaan menunggu diproses`} />

      {menunggu.length === 0 ? (
        <EmptyState text="Tidak ada permintaan hapus akun yang menunggu." />
      ) : (
        menunggu.map((p) => (
          <Card key={p.id} style={{ marginBottom: 12, border: "1.5px solid #E8A426" }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{p.clients?.nama} ({p.clients?.kode})</p>
            <p style={{ fontSize: 12, color: "#6B6F75", margin: "0 0 10px" }}>{p.clients?.telp} - diajukan {new Date(p.created_at).toLocaleDateString("id-ID", { dateStyle: "medium" })}</p>
            {p.alasan && (
              <div style={{ background: "#F7F5F1", borderRadius: 9, padding: 10, marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", margin: "0 0 4px" }}>Alasan</p>
                <p style={{ fontSize: 12.5, color: "#24272B", margin: 0 }}>{p.alasan}</p>
              </div>
            )}

            {prosesId === p.id ? (
              <>
                <textarea
                  value={catatanInput} onChange={(e) => setCatatanInput(e.target.value)}
                  placeholder="Catatan (opsional)..." rows={2}
                  style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: "1.5px solid #E4E1DA", fontSize: 13, resize: "vertical", marginBottom: 10 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setProsesId(null)} style={{ flex: 1, padding: 10, borderRadius: 9, border: "1.5px solid #E4E1DA", background: "#fff", color: "#6B6F75", fontWeight: 600, fontSize: 12.5 }}>
                    Batal
                  </button>
                  <button onClick={() => prosesPermintaan(p.id, "ditolak")} disabled={saving} style={{ flex: 1, padding: 10, borderRadius: 9, border: "none", background: "#FBEAEA", color: "#C0392B", fontWeight: 700, fontSize: 12.5 }}>
                    Tolak
                  </button>
                  <button onClick={() => prosesPermintaan(p.id, "diproses")} disabled={saving} style={{ flex: 1, padding: 10, borderRadius: 9, border: "none", background: "#28685D", color: "#fff", fontWeight: 700, fontSize: 12.5 }}>
                    {saving ? "Menyimpan..." : "Setujui & Proses"}
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setProsesId(p.id)}
                style={{ padding: "9px 16px", borderRadius: 9, border: "1px solid #E4E1DA", background: "#fff", color: "#24272B", fontSize: 12.5, fontWeight: 700 }}
              >
                Proses Permintaan
              </button>
            )}
          </Card>
        ))
      )}

      {selesai.length > 0 && (
        <>
          <h2 className="disp" style={{ fontSize: 16, fontWeight: 700, color: "#24272B", margin: "24px 0 12px" }}>Riwayat</h2>
          {selesai.map((p) => (
            <Card key={p.id} style={{ marginBottom: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{p.clients?.nama} ({p.clients?.kode})</p>
                  {p.catatan_admin && <p style={{ fontSize: 11.5, color: "#6B6F75", margin: 0 }}>{p.catatan_admin}</p>}
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: STATUS_LABEL[p.status].bg, color: STATUS_LABEL[p.status].fg }}>
                  {STATUS_LABEL[p.status].label}
                </span>
              </div>
            </Card>
          ))}
        </>
      )}

      <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "20px 0 0", lineHeight: 1.6 }}>
        Catatan: menekan "Setujui & Proses" cuma mencatat status permintaan ini sebagai selesai - TIDAK otomatis menghapus data toko dari sistem (data pesanan/transaksi harus tetap tersimpan untuk keperluan pembukuan). Untuk nonaktifkan akun tokonya, lakukan itu terpisah lewat menu Kelola Toko.
      </p>
    </div>
  );
}

// ============================================================
// PROGRAM LOYALITAS - overview poin, spin ticket, daily check-in
// ============================================================
function ProgramLoyalitasPage({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pointsList, setPointsList] = useState([]);
  const [spinList, setSpinList] = useState([]);
  const [checkinList, setCheckinList] = useState([]);
  const [tanggalMulai, setTanggalMulai] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [tanggalSelesai, setTanggalSelesai] = useState(() => new Date().toISOString().slice(0, 10));

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [points, spin, checkin] = await Promise.all([
        supabaseFetch(token, `points_ledger?select=*,clients(nama,kode)&created_at=gte.${tanggalMulai}T00:00:00&created_at=lte.${tanggalSelesai}T23:59:59&order=created_at.desc&limit=1000`),
        supabaseFetch(token, `spin_tickets?select=*,clients(nama,kode)&created_at=gte.${tanggalMulai}T00:00:00&created_at=lte.${tanggalSelesai}T23:59:59&order=created_at.desc&limit=1000`),
        supabaseFetch(token, `daily_checkins?select=*,clients(nama,kode)&tanggal=gte.${tanggalMulai}&tanggal=lte.${tanggalSelesai}&order=tanggal.desc&limit=1000`),
      ]);
      setPointsList(points);
      setSpinList(spin);
      setCheckinList(checkin);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }
  useEffect(() => { load(); }, [tanggalMulai, tanggalSelesai]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorBox error={error} onRetry={load} />;

  const poinDiperoleh = pointsList.filter((p) => p.poin > 0).reduce((sum, p) => sum + p.poin, 0);
  const poinDipakai = Math.abs(pointsList.filter((p) => p.poin < 0).reduce((sum, p) => sum + p.poin, 0));
  const totalSpinDipakai = spinList.filter((s) => s.dipakai).length;
  const totalSpinBelumDipakai = spinList.filter((s) => !s.dipakai).length;
  const totalCheckin = checkinList.length;
  const tokoAktifCheckin = new Set(checkinList.map((c) => c.client_id)).size;

  const bySumber = {};
  pointsList.forEach((p) => {
    if (!bySumber[p.sumber]) bySumber[p.sumber] = 0;
    bySumber[p.sumber] += p.poin;
  });

  const SUMBER_LABEL = { checkin: "Daily Check-in", lucky_wheel: "Lucky Wheel/Spin", redeem: "Penukaran Hadiah" };

  return (
    <div>
      <PageHeader title="Program Loyalitas" subtitle="Ringkasan poin, spin ticket, dan daily check-in toko" />

      <Card style={{ marginBottom: 20, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Dari Tanggal</label>
            <input type="date" value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E4E1DA", fontSize: 13 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#6B6F75", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Sampai Tanggal</label>
            <input type="date" value={tanggalSelesai} onChange={(e) => setTanggalSelesai(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid #E4E1DA", fontSize: 13 }} />
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 24 }}>
        <Card style={{ padding: 18 }}>
          <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Poin Diperoleh</p>
          <p className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#28685D", margin: 0 }}>+{poinDiperoleh}</p>
        </Card>
        <Card style={{ padding: 18 }}>
          <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Poin Ditukar/Dipakai</p>
          <p className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#C0392B", margin: 0 }}>-{poinDipakai}</p>
        </Card>
        <Card style={{ padding: 18 }}>
          <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Spin Ticket Dipakai</p>
          <p className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: 0 }}>{totalSpinDipakai} <span style={{ fontSize: 13, color: "#9CA0A6", fontWeight: 600 }}>/ {totalSpinDipakai + totalSpinBelumDipakai}</span></p>
        </Card>
        <Card style={{ padding: 18 }}>
          <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: "0 0 6px", fontWeight: 600 }}>Toko Aktif Check-in</p>
          <p className="disp" style={{ fontSize: 24, fontWeight: 700, color: "#24272B", margin: 0 }}>{tokoAktifCheckin} <span style={{ fontSize: 13, color: "#9CA0A6", fontWeight: 600 }}>({totalCheckin}x)</span></p>
        </Card>
      </div>

      <h2 className="disp" style={{ fontSize: 16, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>Poin per Sumber</h2>
      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F7F5F1" }}>
              <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6B6F75" }}>Sumber</th>
              <th style={{ padding: "10px 14px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#6B6F75" }}>Total Poin</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(bySumber).map(([sumber, total], i) => (
              <tr key={sumber} style={{ borderTop: i > 0 ? "1px solid #EDEAE3" : "none" }}>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>{SUMBER_LABEL[sumber] || sumber}</td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: total >= 0 ? "#28685D" : "#C0392B" }}>{total >= 0 ? "+" : ""}{total}</td>
              </tr>
            ))}
            {Object.keys(bySumber).length === 0 && (
              <tr><td colSpan={2} style={{ padding: 20, textAlign: "center", color: "#9CA0A6" }}>Belum ada data.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <h2 className="disp" style={{ fontSize: 16, fontWeight: 700, color: "#24272B", margin: "0 0 12px" }}>Riwayat Poin Terbaru</h2>
      {pointsList.length === 0 ? (
        <EmptyState text="Belum ada aktivitas poin di rentang ini." />
      ) : (
        pointsList.slice(0, 50).map((p) => (
          <Card key={p.id} style={{ marginBottom: 8, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#24272B", margin: "0 0 2px" }}>{p.clients?.nama} ({p.clients?.kode})</p>
                <p style={{ fontSize: 11.5, color: "#9CA0A6", margin: 0 }}>
                  {SUMBER_LABEL[p.sumber] || p.sumber} - {new Date(p.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                  {p.keterangan && ` - ${p.keterangan}`}
                </p>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: p.poin >= 0 ? "#28685D" : "#C0392B" }}>{p.poin >= 0 ? "+" : ""}{p.poin}</span>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
