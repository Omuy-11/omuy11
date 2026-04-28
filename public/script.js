let keranjang = [];
let currentOrderId = null;

/* =================================================
   🔥 BASE CONFIG (DEV / PROD AUTO DETECT)
================================================= */

const IS_LOCAL = window.location.hostname === "localhost";

const BASE_URL = IS_LOCAL 
  ? "http://localhost:3000"
  : "https://omuy11-production.up.railway.app";

/* =================================================
   ALAMAT TOGGLE
================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const alamatSelect = document.getElementById("alamat");
  const box = document.getElementById("alamatLengkapBox");

  if (!alamatSelect || !box) return;

  function toggleAlamat() {
    const val = alamatSelect.value;

    if (val === "Pacet" || val === "Majalaya") {
      box.style.display = "block";
    } else {
      box.style.display = "none";
    }
  }

  alamatSelect.addEventListener("change", toggleAlamat);
  toggleAlamat();
});

/* =================================================
   TAMBAH ITEM
================================================= */

function tambah(nama, harga) {

  let stokText;

  if (nama === "Mie Jebew Porsi Normal") {
    stokText = document.getElementById("stokNormal")?.innerText;
  } else if (nama === "Mie Jebew Porsi Mini") {
    stokText = document.getElementById("stokMini")?.innerText;
  }

  let stok = parseInt((stokText || "").replace("Stok: ", "")) || 0;

  let jumlahDiKeranjang = keranjang.filter(i => i.nama === nama).length;

  if (jumlahDiKeranjang >= stok) {
    alert("Stok tidak cukup!");
    return;
  }

  keranjang.push({
    nama,
    harga: parseInt(harga)
  });

  renderKeranjang();
}

/* =================================================
   RENDER KERANJANG
================================================= */

function renderKeranjang() {
  const list = document.getElementById("keranjang");
  const totalEl = document.getElementById("total");

  if (!list || !totalEl) return;

  list.innerHTML = "";

  let total = 0;

  keranjang.forEach((item) => {
    total += Number(item.harga);

    const li = document.createElement("li");
    li.innerHTML = `${item.nama} - Rp ${item.harga}`;
    list.appendChild(li);
  });

  totalEl.innerText = "Rp " + total;
}

/* =================================================
   CHECKOUT
================================================= */

function checkout() {
  const nama = document.getElementById("nama").value;
  const alamatSelect = document.getElementById("alamat");
  const alamat = alamatSelect.value;
  const pembayaran = document.getElementById("pembayaran").value;
  const alamatLengkap = document.getElementById("alamatLengkap")?.value || "";

  let noTelp = document.getElementById("telp").value;

  if (noTelp.startsWith("08")) {
    noTelp = "62" + noTelp.slice(1);
  }

  if (!nama || !alamat || !pembayaran || !noTelp || keranjang.length === 0) {
    alert("Lengkapi data dulu!");
    return;
  }

  if (noTelp.length < 10) {
    alert("No telepon tidak valid!");
    return;
  }

  if ((alamat === "Pacet" || alamat === "Majalaya") && !alamatLengkap) {
    alert("Alamat lengkap wajib diisi!");
    return;
  }

  const ongkir = parseInt(alamatSelect.selectedOptions[0]?.dataset.ongkir || 0);

  let total = keranjang.reduce((sum, item) => sum + item.harga, 0);
  total += parseInt(ongkir);

  kirimOrder(nama, noTelp, alamat, alamatLengkap, pembayaran, total);
}

/* =================================================
   KIRIM ORDER (DEV SAFE MODE ACTIVE)
================================================= */

function kirimOrder(nama, telp, alamat, alamatLengkap, pembayaran, total) {

  fetch(BASE_URL + "/order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
body: JSON.stringify({
  nama: nama,
  telp,
  items: keranjang,
  total,
  ongkir: total - keranjang.reduce((s, i) => s + i.harga, 0), // 🔥 TAMBAHAN
  alamat,
  alamatLengkap,
  pembayaran,
  isTest: IS_LOCAL
})
  })
    .then(res => {
      if (!res.ok) throw new Error("Server error");
      return res.json();
    })
    .then(data => {
      currentOrderId = data.id;

      let nomor = data.antrian || 0;

      alert("Nomor Antrian Kamu: A" + String(nomor).padStart(3, "0"));

      keranjang = [];
      renderKeranjang();
      mulaiPantauStatus();
    })
    .catch(err => {
      console.error("ERROR:", err);
      alert("Gagal kirim order!");
    });
}

/* =================================================
   STATUS MONITOR
================================================= */

let intervalStatus = null;

function mulaiPantauStatus() {
  if (intervalStatus) clearInterval(intervalStatus);

  intervalStatus = setInterval(() => {
    fetch(BASE_URL + "/public-orders")
      .then(res => res.json())
      .then(data => {
        const order = data.find(o => o.id == currentOrderId);
        if (!order) return;

        tampilkanStatus(order.status);
      });
  }, 2000);
}

function tampilkanStatus(status) {
  const box = document.getElementById("statusBox");
  if (!box) return;

  let className = "";

  if (status === "menunggu") className = "menunggu";
  if (status === "diproses") className = "diproses";
  if (status === "diantar") className = "diantar"
  if (status === "selesai") className = "selesai";

  box.innerHTML = `<div class="status ${className}">${status}</div>`;
}

/* =================================================
   ADMIN PANEL
================================================= */

function loadOrders() {
  fetch(BASE_URL + "/public-orders")
    .then(res => res.json())
    .then(data => {

      const container = document.getElementById("orders");
      container.innerHTML = "";

      const SHOW_TEST = true; // ✅ DI SINI

      data.forEach(o => {

        if (!SHOW_TEST && o.is_test) return; // ✅ DI SINI

let items = [];
try {
  items = JSON.parse(o.items || "[]");
} catch {}

        const div = document.createElement("div");
        div.className = "card";

div.innerHTML = `
  <b>🧾 A${String(o.antrian).padStart(3,"0")}</b><br>
  <b>
    ${o.nama || "-"} 
    ${o.is_test ? "🧪" : ""}
  </b><br>
  ${items.map(i => i.nama).join(", ")}<br>
  Rp ${o.total}<br>

          <div class="status-btns">
            <button onclick="updateStatus(${o.id}, 'menunggu')">menunggu</button>
            <button onclick="updateStatus(${o.id}, 'diproses')">diproses</button>
            <button onclick="updateStatus(${o.id}, 'diantar')">diantar</button>
            <button onclick="updateStatus(${o.id}, 'selesai')">selesai</button>
          </div>

          <button onclick="hapus(${o.id})" style="background:red;">Hapus</button>
        `;

        container.appendChild(div);
      });
    });
}

/* =================================================
   AUTH / ADMIN
================================================= */

function login() {
  const user = document.getElementById("user").value;
  const pass = document.getElementById("pass").value;

  fetch(BASE_URL + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, pass })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        localStorage.setItem("token", data.token);
        window.location = "menu.html";
      } else {
        document.getElementById("msg").innerText = "Login gagal!";
      }
    });
}

function logout() {
  localStorage.removeItem("token");
  window.location = "login.html";
}

function cekLogin() {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Harus login dulu!");
    window.location = "login.html";
    return;
  }

  initAdmin();
}

/* =================================================
   ADMIN INIT
================================================= */

function initAdmin() {
  loadOrders();
  setInterval(loadOrders, 2000);
}

/* =================================================
   STATUS UPDATE / DELETE
================================================= */

function updateStatus(id, status) {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Harus login dulu!");
    window.location = "login.html";
    return;
  }

  fetch(BASE_URL + "/order/" + id, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({ status })
  })
    .then(res => {
      if (res.status === 401) logout();
    });
}

function hapus(id) {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Harus login dulu!");
    window.location = "login.html";
    return;
  }

  fetch(BASE_URL + "/order/" + id, {
    method: "DELETE",
    headers: {
      "Authorization": "Bearer " + token
    }
  })
    .then(res => {
      if (res.status === 401) logout();
    });
}

/* =================================================
   STATISTIK
================================================= */

function loadStats() {
  fetch(BASE_URL + "/public-orders")
    .then(res => res.json())
    .then(data => {

      let totalOrder = data.length;
      let totalUang = data.reduce((sum, o) => sum + o.total, 0);

      let selesai = data.filter(o => o.status === "selesai").length;
      let proses = data.filter(o => o.status === "diproses").length;
      let menunggu = data.filter(o => o.status === "menunggu").length;

      const el = document.getElementById("stats");
      if (!el) return;

      el.innerHTML = `
        <b>Total Order:</b> ${totalOrder}<br>
        <b>Total Pendapatan:</b> Rp ${totalUang}<br><br>

        🟡 Menunggu: ${menunggu}<br>
        🔵 Diproses: ${proses}<br>
        🟢 Selesai: ${selesai}
      `;
    });
}

/* =================================================
   LOGISTIK
================================================= */

function loadLogistik() {
  fetch(BASE_URL + "/public-orders")
    .then(res => res.json())
    .then(data => {

      const container = document.getElementById("logistik");
      if (!container) return;

      container.innerHTML = "";

      data.forEach(o => {

        const div = document.createElement("div");
        div.className = "card";

        div.innerHTML = `
          <b>A${String(o.antrian).padStart(3,"0")}</b><br>
          ${o.nama}<br>
          📞 ${o.telp || "-"}<br>
          📍 ${o.alamat}<br>
          🏠 ${o.alamat_lengkap || "-"}<br>
          💰 Rp ${o.total}<br>
          <b>Status: ${o.status}</b><br><br>

          <a href="https://wa.me/${o.telp}" target="_blank">
            <button style="background:#25D366;">💬 Chat Customer</button>
          </a>
        `;

        container.appendChild(div);
      });

    });
}

/* =================================================
   STOCK USER
================================================= */

function loadStockUser() {
  fetch(BASE_URL + "/stocks")
    .then(res => res.json())
    .then(data => {

      if (!document.getElementById("stokNormal")) return;

      let normal = data.find(s => s.nama === "Mie Jebew Porsi Normal");
      let mini = data.find(s => s.nama === "Mie Jebew Porsi Mini");

      document.getElementById("stokNormal").innerText =
        "Stok: " + (normal?.jumlah ?? 0);

      document.getElementById("stokMini").innerText =
        "Stok: " + (mini?.jumlah ?? 0);

      let jumlahNormal = keranjang.filter(i => i.nama === "Mie Jebew Porsi Normal").length;
      let jumlahMini = keranjang.filter(i => i.nama === "Mie Jebew Porsi Mini").length;

      document.getElementById("btn-normal").disabled =
        !normal || normal.jumlah <= jumlahNormal;

      document.getElementById("btn-mini").disabled =
        !mini || mini.jumlah <= jumlahMini;
    });
}

document.addEventListener("DOMContentLoaded", () => {
  loadStockUser();
  setInterval(loadStockUser, 2000);
});