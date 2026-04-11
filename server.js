const express = require("express");
const mysql = require("mysql2");

const app = express();

app.use(express.json());
app.use(express.static("public"));

/* ================= DATABASE ================= */

const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "order_app"
});

db.connect(err => {
  if (err) {
    console.log("❌ DB Error:", err);
  } else {
    console.log("✅ MySQL Connected");

    // 🔥 AUTO BUAT TABLE
    db.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nama VARCHAR(100),
        items TEXT,
        total INT,
        alamat VARCHAR(100),
        pembayaran VARCHAR(50),
        antrian INT,
        status VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
});

/* ================= LOGIN ================= */

const ADMIN = {
  user: "omuy",
  pass: "rayaa"
};

app.post("/login", (req, res) => {
  const { user, pass } = req.body;

  if (user === ADMIN.user && pass === ADMIN.pass) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

/* ================= ORDER ================= */

// CREATE ORDER + ANTRIAN
app.post("/order", (req, res) => {
  const { nama, items, total, alamat, pembayaran } = req.body;

  db.query("SELECT MAX(antrian) as last FROM orders", (err, result) => {

    // 🔥 kalau DB error → pakai fallback
    if (err || !result) {
      console.log("DB error, pakai antrian sementara");

      return res.json({
        id: Date.now(),
        antrian: Math.floor(Math.random() * 900) + 100 // 100-999
      });
    }

    let last = 0;

if (result && result[0] && result[0].last != null) {
  last = result[0].last;
}

let nextAntrian = parseInt(last) + 1;

    db.query(
      "INSERT INTO orders (nama, items, total, alamat, pembayaran, antrian, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [nama, JSON.stringify(items), total, alamat, pembayaran, nextAntrian, "Menunggu"],
      (err2, result2) => {

        // 🔥 kalau insert gagal → fallback juga
        if (err2) {
          console.log("Insert gagal, pakai fallback");

          return res.json({
            id: Date.now(),
            antrian: nextAntrian || Math.floor(Math.random() * 900) + 100
          });
        }

        res.json({
          id: result2.insertId,
          antrian: nextAntrian
        });
      }
    );
  });
});

// GET ORDERS
app.get("/orders", (req, res) => {
  db.query("SELECT * FROM orders ORDER BY created_at DESC", (err, results) => {
    if (err) return res.status(500).json(err);

    const data = results.map(o => ({
      ...o,
      items: o.items ? JSON.parse(o.items) : []
    }));

    res.json(data);
  });
});

// UPDATE STATUS
app.put("/order/:id", (req, res) => {
  const { status } = req.body;

  console.log("UPDATE:", req.params.id, status); // 👈 DEBUG

  db.query(
    "UPDATE orders SET status=? WHERE id=?",
    [status, req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.sendStatus(200);
    }
  );
});

// DELETE ORDER
app.delete("/order/:id", (req, res) => {
  db.query(
    "DELETE FROM orders WHERE id=?",
    [req.params.id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.sendStatus(200);
    }
  );
});

/* ================= PORT ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🔥 Server jalan di port " + PORT);
});