// Service Worker - menerima push notification walau Web App sudah ditutup,
// DAN cache tampilan app (HTML/JS/CSS) supaya bisa langsung muncul instan
// dari cache saat jaringan sedang transisi (misal pindah WiFi ke 4G),
// bukan blank/"Memuat..." polos. File ini HARUS ditaruh di folder `public/`
// project Vite Anda (bukan di dalam src/), supaya ter-deploy persis di
// /sw.js (bukan di-bundle seperti file JS biasa).

const CACHE_NAME = "app-shell-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting(); // langsung aktifkan versi baru begitu ter-install
});

self.addEventListener("activate", (event) => {
  // Bersihkan cache versi lama kalau ada (waktu nanti update sw.js ini,
  // ganti angka di CACHE_NAME biar cache lama otomatis dibuang)
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Cuma cache file dari DOMAIN KITA SENDIRI (tampilan app: HTML/JS/CSS) -
  // JANGAN sentuh permintaan ke Supabase/API lain, itu harus SELALU ambil
  // data terbaru dari jaringan, tidak boleh pakai cache.
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;

  // Halaman HTML utama (navigasi ke situs, termasuk buka tab baru) -
  // NETWORK-FIRST: selalu coba ambil versi TERBARU dulu dari jaringan,
  // supaya begitu ada update kode, langsung kelihatan tanpa perlu refresh
  // dua kali. Cache cuma dipakai kalau jaringan benar-benar gagal (offline).
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Aset lain (JS/CSS/gambar) - tetap stale-while-revalidate seperti
  // sebelumnya, karena nama filenya biasanya sudah unik per-versi (ada
  // hash), jadi aman dipakai cache-first buat kecepatan.
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse); // jaringan gagal total - pakai cache kalau ada

      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "Notifikasi", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Notifikasi";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
