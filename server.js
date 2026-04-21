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
  user: "omuy",
  pass: "rayaa"
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


  const token = req.headers["authorization"];

  if (!token || !sessions[token]) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

/* ================= ORDER ================= */

// CREATE ORDER (PUBLIC)
app.post("/order", (req, res) => {
  const { nama, items, total, alamat, alamatLengkap, pembayaran } = req.body;

  db.query("SELECT MAX(antrian) as last FROM orders", (err, result) => {

    if (err) {
      console.log("ERROR SELECT:", err);
      return res.status(500).json({ error: "DB error (select)" });
    }

    let last = result[0]?.last || 0;
    let nextAntrian = parseInt(last) + 1;

    db.query(
  "INSERT INTO orders (nama, items, total, alamat, alamat_lengkap, pembayaran, antrian, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  [
    nama,
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
          console.log("ERROR INSERT:", err2);
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

function auth(req, res, next) {
  let token = req.headers["authorization"];

  if (!token) return res.status(401).json({ error: "Unauthorized" });

  // support "Bearer xxx"
  if (token.startsWith("Bearer ")) {
    token = token.slice(7);
  }

  if (!sessions[token]) {
    return res.status(401).json({ error: "Invalid token" });
  }

  next();
}

/* ================= PORT ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🔥 Server jalan di port " + PORT);
});