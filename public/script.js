let keranjang = [];
let currentOrderId = null;

/* ================= TAMBAH ITEM ================= */

function tambah(nama, harga) {
  keranjang.push({ nama, harga });
  renderKeranjang();
}

/* ================= RENDER KERANJANG ================= */

function renderKeranjang() {
  const list = document.getElementById("keranjang");
  const totalEl = document.getElementById("total");

  list.innerHTML = "";

  let total = 0;

  keranjang.forEach((item, i) => {
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
  const alamat = document.getElementById("alamat").value;
  const pembayaran = document.getElementById("pembayaran").value;

  let total = keranjang.reduce((sum, item) => sum + item.harga, 0);

  kirimOrder(nama, alamat, pembayaran, total);

  document.getElementById("qrisBox").style.display = "none";
}

/* ================= KIRIM ORDER ================= */

function kirimOrder(nama, alamat, pembayaran, total) {
  fetch("/order", {
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
  if (!data || !data.antrian) {
    alert("Server error, coba lagi!");
    return;
  }

  currentOrderId = data.id;

  alert("Nomor Antrian Kamu: A" + String(data.antrian).padStart(3, "0"));

  keranjang = [];
  renderKeranjang();
  mulaiPantauStatus();
});

function mulaiPantauStatus() {
  setInterval(() => {
    fetch("/orders")
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
  setInterval(loadOrders, 2000); // realtime admin
}

function loadOrders() {
  fetch("/orders")
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById("orders");
      container.innerHTML = "";

      data.forEach(o => {
        const div = document.createElement("div");
        div.className = "card";

        div.innerHTML = `
  <b>🧾 A${String(o.antrian).padStart(3,"0")}</b><br>
  <b>${o.nama}</b><br>
  ${o.items.map(i => i.nama).join(", ")}<br>
  Rp ${o.total}<br>

         <div class="status-btns">
  <button class="btn-menunggu ${o.status=="Menunggu"?"active-status":""}"
    onclick="updateStatus(${o.id}, 'Menunggu')">Menunggu</button>

  <button class="btn-diproses ${o.status=="Diproses"?"active-status":""}"
    onclick="updateStatus(${o.id}, 'Diproses')">Diproses</button>

  <button class="btn-diantar ${o.status=="Diantar"?"active-status":""}"
    onclick="updateStatus(${o.id}, 'Diantar')">Diantar</button>

  <button class="btn-selesai ${o.status=="Selesai"?"active-status":""}"
    onclick="updateStatus(${o.id}, 'Selesai')">Selesai</button>
</div>

          <button onclick="hapus(${o.id})" style="background:red;">Hapus</button>
        `;

        container.appendChild(div);
      });
    });
}

function updateStatus(id, status) {
  fetch("/order/" + id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  });
}

function hapus(id) {
  fetch("/order/" + id, {
    method: "DELETE"
  });
}

/* ================= LOGIN ================= */

function login() {
  const user = document.getElementById("user").value;
  const pass = document.getElementById("pass").value;

  fetch("/login", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ user, pass })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
  localStorage.setItem("isLogin", "true");
  window.location = "menu.html"; // 🔥 masuk dashboard
} else {
      document.getElementById("msg").innerText = "Login gagal!";
    }
  });
}

function logout() {
  localStorage.removeItem("isLogin");
  window.location = "login.html";
}

function cekLogin() {
  const isLogin = localStorage.getItem("isLogin");

  if (!isLogin) {
    alert("Harus login dulu!");
    window.location = "login.html";
    return;
  }

  initAdmin();
}

/* ================= STATISTIK ================= */

function loadStats() {
  fetch("/orders")
    .then(res => res.json())
    .then(data => {
      let totalOrder = data.length;
      let totalUang = data.reduce((sum, o) => sum + o.total, 0);

      let selesai = data.filter(o => o.status === "Selesai").length;
      let proses = data.filter(o => o.status === "Diproses").length;
      let menunggu = data.filter(o => o.status === "Menunggu").length;

      document.getElementById("stats").innerHTML = `
        <b>Total Order:</b> ${totalOrder}<br>
        <b>Total Pendapatan:</b> Rp ${totalUang}<br><br>

        🟡 Menunggu: ${menunggu}<br>
        🔵 Diproses: ${proses}<br>
        🟢 Selesai: ${selesai}
      `;
    });
}

  initAdmin();
}