const express = require("express");
const mysql = require("mysql2");
const crypto = require("crypto");

const app = express();

app.use(express.json());
app.use(express.static("public"));

/* ================= DATABASE ================= */

const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT
});

db.connect(err => {
  if (err) {
    console.log("❌ DB Error:", err);
  } else {
    console.log("✅ MySQL Connected");
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
function auth(req, res, next) {
  const token = req.headers["authorization"];

  if (!token || !sessions[token]) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
}

/* ================= ORDER ================= */

// CREATE ORDER (PUBLIC)
app.post("/order", (req, res) => {
  const { nama, items, total, alamat, pembayaran } = req.body;

  db.query("SELECT MAX(antrian) as last FROM orders", (err, result) => {

    if (err) {
      console.log("ERROR SELECT:", err);
      return res.status(500).json({ error: "DB error (select)" });
    }

    let last = result[0]?.last || 0;
    let nextAntrian = parseInt(last) + 1;

    db.query(
      "INSERT INTO orders (nama, items, total, alamat, pembayaran, antrian, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [nama, JSON.stringify(items), total, alamat, pembayaran, nextAntrian, "Menunggu"],
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

// 🔥 PROTECTED (HARUS LOGIN)
app.get("/public-orders", (req, res) => {
  db.query("SELECT * FROM orders ORDER BY id DESC LIMIT 20", (err, results) => {

    if (err) {
      console.log("PUBLIC ORDERS ERROR:", err);
      return res.status(500).json({ error: "DB ERROR" });
    }

    console.log("DATA ORDERS:", results);

    res.json(results || []);
  });
});

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

/* ================= PORT ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🔥 Server jalan di port " + PORT);
});
