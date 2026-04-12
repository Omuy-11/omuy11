let keranjang = [];
let currentOrderId = null;

const BASE_URL = "https://omuy11-production.up.railway.app";

/* ================= TAMBAH ITEM ================= */

function tambah(nama, harga) {
  keranjang.push({ nama, harga });
  renderKeranjang();
}

/* ================= RENDER ================= */

function renderKeranjang() {
  const list = document.getElementById("keranjang");
  const totalEl = document.getElementById("total");

  if (!list || !totalEl) return;

  list.innerHTML = "";

  let total = 0;

  keranjang.forEach((item) => {
    total += item.harga;

    const li = document.createElement("li");
    li.innerHTML = `${item.nama} - Rp ${item.harga}`;
    list.appendChild(li);
  });

  totalEl.innerText = "Rp " + total;
}

/* ================= CHECKOUT ================= */

function checkout() {
  const nama = document.getElementById("nama").value;
  const alamatSelect = document.getElementById("alamat");
  const alamat = alamatSelect.value;
  const ongkir = alamatSelect.selectedOptions[0]?.dataset.ongkir || 0;
  const pembayaran = document.getElementById("pembayaran").value;

  if (!nama || !alamat || !pembayaran || keranjang.length === 0) {
    alert("Lengkapi data dulu!");
    return;
  }

  let total = keranjang.reduce((sum, item) => sum + item.harga, 0);
  total += parseInt(ongkir);

  if (pembayaran === "QRIS") {
    document.getElementById("qrisBox").style.display = "flex";
    document.getElementById("totalBayar").innerText = "Total: Rp " + total;
  } else {
    kirimOrder(nama, alamat, pembayaran, total);
  }
}

function lanjutOrder() {
  const cek = document.getElementById("konfirmasi").checked;
  if (!cek) return alert("Konfirmasi dulu!");

  const nama = document.getElementById("nama").value;
  const alamatSelect = document.getElementById("alamat");
  const alamat = alamatSelect.value;
  const ongkir = alamatSelect.selectedOptions[0]?.dataset.ongkir || 0;
  const pembayaran = document.getElementById("pembayaran").value;

  let total = keranjang.reduce((sum, item) => sum + item.harga, 0);
  total += parseInt(ongkir);

  kirimOrder(nama, alamat, pembayaran, total);

  document.getElementById("qrisBox").style.display = "none";
}

/* ================= KIRIM ORDER ================= */

function kirimOrder(nama, alamat, pembayaran, total) {
  fetch(BASE_URL + "/order", {   // ✅ FIX ENDPOINT
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      nama,
      items: keranjang,
      total,
      alamat,
      pembayaran
    })
  })
    .then(res => res.json())
    .then(data => {
      console.log("ORDER MASUK:", data);

      currentOrderId = data.id;

      let nomor = data.antrian || 0;

      alert("Nomor Antrian Kamu: A" + String(nomor).padStart(3, "0"));

      setTimeout(() => {
        window.open("antrian.html", "_blank");
      }, 500);

      keranjang = [];
      renderKeranjang();
      mulaiPantauStatus();
    })
    .catch(err => console.error("ERROR:", err));
}

/* ================= STATUS ================= */

function mulaiPantauStatus() {
  setInterval(() => {
    fetch(BASE_URL + "/public-orders") // ini public jadi ga perlu auth
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

  if (status === "Menunggu") className = "menunggu";
  if (status === "Diproses") className = "diproses";
  if (status === "Diantar") className = "diantar";
  if (status === "Selesai") className = "selesai";

  box.innerHTML = `<div class="status ${className}">${status}</div>`;
}

/* ================= ADMIN ================= */

function initAdmin() {
  loadOrders();
  setInterval(loadOrders, 2000);
}

function loadOrders() {
  fetch(BASE_URL + "/public-orders", {
    headers: {
      "Authorization": localStorage.getItem("token") || ""
    }
  })
    .then(res => {
      if (res.status === 401) {
        logout();
        return null;
      }
      return res.json();
    })
    .then(data => {
      if (!data) return;

      const container = document.getElementById("orders");
      if (!container) return;

      container.innerHTML = "";

      data.forEach(o => {
        let items = [];
        try {
          items = JSON.parse(o.items || "[]");
        } catch {
          items = [];
        }

        const div = document.createElement("div");
        div.className = "card";

        div.innerHTML = `
          <b>🧾 A${String(o.antrian).padStart(3,"0")}</b><br>
          <b>${o.nama || "-"}</b><br>
          ${items.map(i => i.nama).join(", ")}<br>
          Rp ${o.total}<br>

          <div class="status-btns">
            <button onclick="updateStatus(${o.id}, 'Menunggu')">Menunggu</button>
            <button onclick="updateStatus(${o.id}, 'Diproses')">Diproses</button>
            <button onclick="updateStatus(${o.id}, 'Diantar')">Diantar</button>
            <button onclick="updateStatus(${o.id}, 'Selesai')">Selesai</button>
          </div>

          <button onclick="hapus(${o.id})" style="background:red;">Hapus</button>
        `;

        container.appendChild(div);
      });
    });
}

function updateStatus(id, status) {
  fetch(BASE_URL + "/order/" + id, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": localStorage.getItem("token")
    },
    body: JSON.stringify({ status })
  });
}

function hapus(id) {
  fetch(BASE_URL + "/order/" + id, {
    method: "DELETE",
    headers: {
      "Authorization": localStorage.getItem("token")
    }
  });
}

/* ================= LOGIN ================= */

function login() {
  const user = document.getElementById("user").value;
  const pass = document.getElementById("pass").value;

  fetch(BASE_URL + "/login", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
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

/* ================= STATISTIK ================= */

function loadStats() {
  fetch(BASE_URL + "/public-orders")
    .then(res => res.json())
    .then(data => {
      let totalOrder = data.length;
      let totalUang = data.reduce((sum, o) => sum + o.total, 0);

      let selesai = data.filter(o => o.status === "Selesai").length;
      let proses = data.filter(o => o.status === "Diproses").length;
      let menunggu = data.filter(o => o.status === "Menunggu").length;

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