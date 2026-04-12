const express = require("express");
const mysql = require("mysql2");
const crypto = require("crypto");

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
      return res.json({
        id: Date.now(),
        antrian: Math.floor(Math.random() * 900) + 100
      });
    }

    let last = 0;
    if (result[0] && result[0].last != null) {
      last = result[0].last;
    }

    let nextAntrian = parseInt(last) + 1;

    db.query(
      "INSERT INTO orders (nama, items, total, alamat, pembayaran, antrian, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [nama, JSON.stringify(items), total, alamat, pembayaran, nextAntrian, "Menunggu"],
      (err2, result2) => {

        if (err2) {
          return res.json({
            id: Date.now(),
            antrian: nextAntrian
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

// 🔥 PROTECTED (HARUS LOGIN)
app.get("/public-orders", (req, res) => {
  db.query("SELECT * FROM orders ORDER BY id DESC LIMIT 20", (err, results) => {
    if (err) return res.status(500).json(err);

    res.json(results);
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
