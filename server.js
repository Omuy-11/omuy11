const express = require("express");
const mysql = require("mysql2");
const crypto = require("crypto");

const app = express();

app.use(express.json());
app.use(express.static("public"));

/* ================= DATABASE ================= */

const db = mysql.createPool({
  uri: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

db.getConnection((err, conn) => {
  if (err) {
    console.log("❌ DB ERROR:", err);
  } else {
    console.log("✅ MySQL Connected");
    conn.release();
  }
});

/* ================= LOGIN ================= */

const ADMIN = {
  user: process.env.ADMIN_USER,
  pass: process.env.ADMIN_PASS
};

// 🔥 SESSION SEDERHANA
let sessions = {};

app.post("/login", (req, res) => {
  const { user, pass } = req.body;

  if (user === ADMIN.user && pass === ADMIN.pass) {

    const token = crypto.randomBytes(16).toString("hex");

    sessions[token] = true;

    res.json({ success: true, token });

  } else {
    res.json({ success: false });
  }
});

// 🔥 MIDDLEWARE AUTH
function auth(req, res, next) {
  let token = req.headers["authorization"];

  if (token && token.startsWith("Bearer ")) {
    token = token.slice(7);
  }

  if (!token || !sessions[token]) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

/* ================= ORDER ================= */

// CREATE ORDER (PUBLIC)
app.post("/order", (req, res) => {
  const { nama, telp, items, total, alamat, alamatLengkap, pembayaran } = req.body;

  // 🔥 STEP 8
  if (!telp) {
    return res.status(400).json({ error: "No telp wajib!" });
  }

  // 🔥 CEK STOCK
  db.query("SELECT * FROM stocks", (err, stocks) => {

    if (err) {
      return res.status(500).json({ error: "DB error" });
    }

    for (let item of items) {
      let s = stocks.find(x => x.nama === item.nama);
      let jumlahDiOrder = items.filter(i => i.nama === item.nama).length;

      if (!s || s.jumlah < jumlahDiOrder) {
        return res.status(400).json({ error: "Stock tidak cukup!" });
      }
    }

    // 🔥 KURANGI STOCK
    items.forEach(item => {
      db.query(
        "UPDATE stocks SET jumlah = GREATEST(jumlah - 1, 0) WHERE nama = ?",
        [item.nama]
      );
    });

    // 🔥 INSERT ORDER
    db.query("SELECT MAX(antrian) AS last FROM orders", (err, result) => {

      let last = result[0]?.last || 0;
      let nextAntrian = parseInt(last) + 1;

      db.query(
        "INSERT INTO orders (nama, telp, items, total, alamat, alamat_lengkap, pembayaran, antrian, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          nama,
          telp,
          JSON.stringify(items),
          total,
          alamat,
          alamatLengkap,
          pembayaran,
          nextAntrian,
          "Menunggu"
        ],
        (err2, result2) => {
          if (err2) {
            return res.status(500).json({ error: "DB error (insert)" });
          }

          res.json({
            id: result2.insertId,
            antrian: nextAntrian
          });
        }
      );
    });

  });
});

// PUBLIC ORDERS
app.get("/public-orders", (req, res) => {
  db.query("SELECT * FROM orders ORDER BY id DESC LIMIT 20", (err, results) => {

    if (err) {
      console.log("🔥 ERROR ASLI:", err);
      return res.status(500).json({
        error: err.message
      });
    }

    res.json(results || []);
  });
});

// UPDATE STATUS (ADMIN)
app.put("/order/:id", auth, (req, res) => {
  const { status } = req.body;

  db.query(
    "UPDATE orders SET status=? WHERE id=?",
    [status, req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.sendStatus(200);
    }
  );
});

// DELETE ORDER (ADMIN)
app.delete("/order/:id", auth, (req, res) => {
  db.query(
    "DELETE FROM orders WHERE id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.sendStatus(200);
    }
  );
});

/* ================= STOCK ================= */

// GET STOCK (PUBLIC)
app.get("/stocks", (req, res) => {
  db.query("SELECT * FROM stocks ORDER BY id DESC", (err, results) => {
    if (err) {
      console.log("ERROR STOCK GET:", err);
      return res.status(500).json({ error: "DB error" });
    }
    res.json(results || []);
  });
});

// TAMBAH STOCK (ADMIN)
app.post("/stocks", auth, (req, res) => {
  const { nama, jumlah } = req.body;

  // 🔥 VALIDASI DI SINI
  if (!nama || typeof jumlah !== "number" || jumlah < 0) {
    return res.status(400).json({ error: "Data tidak valid" });
  }

  db.query(
    "INSERT INTO stocks (nama, jumlah) VALUES (?, ?)",
    [nama, jumlah],
    (err) => {
      if (err) {
        console.log("ERROR INSERT STOCK:", err);
        return res.status(500).json({ error: "DB error" });
      }
      res.sendStatus(200);
    }
  );
});

// UPDATE STOCK (➕➖)
app.put("/stocks/update", auth, (req, res) => {
  const { nama, jumlah } = req.body;

  if (!nama || typeof jumlah !== "number") {
    return res.status(400).json({ error: "Data tidak valid" });
  }

  db.query(
    "UPDATE stocks SET jumlah = GREATEST(jumlah + ?, 0) WHERE nama = ?",
    [jumlah, nama],
    (err) => {
      if (err) {
        console.log("ERROR UPDATE STOCK:", err);
        return res.status(500).json({ error: "DB error" });
      }
      res.sendStatus(200);
    }
  );
});

// DELETE STOCK
app.delete("/stocks/:id", auth, (req, res) => {
  db.query(
    "DELETE FROM stocks WHERE id = ?",
    [req.params.id],
    (err) => {
      if (err) {
        console.log("ERROR DELETE STOCK:", err);
        return res.status(500).json({ error: "DB error" });
      }
      res.sendStatus(200);
    }
  );
});

/* ================= PORT ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🔥 Server jalan di port " + PORT);
});