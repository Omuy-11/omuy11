require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const crypto = require("crypto");

const app = express();

app.use(express.json());
app.use(express.static("public"));

/* ================= DATABASE ================= */

const isRailway =
  process.env.MYSQLHOST && process.env.MYSQLHOST !== "localhost";

const db = mysql.createPool(
  isRailway
    ? {
        host: process.env.MYSQLHOST,
        user: process.env.MYSQLUSER,
        password: process.env.MYSQLPASSWORD,
        database: process.env.MYSQLDATABASE,
        port: process.env.MYSQLPORT,
        ssl: { rejectUnauthorized: false }
      }
    : {
        host: "localhost",
        user: "root",
        password: "",
        database: "order_app",
        port: 3306
      }
);

console.log("MODE:", isRailway ? "RAILWAY" : "LOCAL");

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
  user: process.env.ADMIN_USER || "omuy",
  pass: process.env.ADMIN_PASS || "rayaa"
};

let sessions = {};

setInterval(() => {
  const ONE_DAY = 24 * 60 * 60 * 1000;

  for (let token in sessions) {
    if (Date.now() - sessions[token].createdAt > ONE_DAY) {
      delete sessions[token];
    }
  }
}, 60 * 60 * 1000);

// LOGIN
app.post("/login", (req, res) => {
  const { user, pass } = req.body;

  if (user === ADMIN.user && pass === ADMIN.pass) {
    const token = crypto.randomBytes(16).toString("hex");

    sessions[token] = {
      createdAt: Date.now()
    };

    res.json({ success: true, token });
  } else {
    res.json({ success: false });
  }
});

// AUTH
function auth(req, res, next) {
  let token = req.headers["authorization"];

  if (token && token.startsWith("Bearer ")) {
    token = token.slice(7);
  }

  if (!token || !sessions[token]) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const session = sessions[token];
  const ONE_DAY = 24 * 60 * 60 * 1000;

  if (Date.now() - session.createdAt > ONE_DAY) {
    delete sessions[token];
    return res.status(401).json({ error: "Session expired" });
  }

  next();
}

// HELPER ROLLBACK
function rollback(conn, res, message) {
  conn.rollback(() => {
    conn.release();
    res.status(500).json({ error: message });
  });
}

/* ================= ORDER ================= */

// CREATE ORDER
app.post("/order", (req, res) => {
  const { nama, telp, items, alamat, alamatLengkap, pembayaran, isTest, ongkir } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Item tidak valid!" });
  }

  for (let item of items) {
    if (
      !item.nama ||
      typeof item.nama !== "string" ||
      typeof item.harga !== "number"
    ) {
      return res.status(400).json({ error: "Format item tidak valid!" });
    }
  }

  if (!telp || telp.length < 10) {
    return res.status(400).json({ error: "No telp tidak valid!" });
  }

  db.getConnection((err, conn) => {
    if (err) return res.status(500).json({ error: "DB error" });

    conn.beginTransaction(err => {
      if (err) return rollback(conn, res, "Transaction error");

      // HITUNG ITEM
      const itemCount = {};
      for (let item of items) {
        itemCount[item.nama] = (itemCount[item.nama] || 0) + 1;
      }

      const names = Object.keys(itemCount);

      // LOCK STOCK
      conn.query(
        "SELECT * FROM stocks WHERE nama IN (?) FOR UPDATE",
        [names],
        (err, stocks) => {
          if (err) return rollback(conn, res, "DB error");

          // CEK STOCK
          for (let nama in itemCount) {
            let s = stocks.find(x => x.nama === nama);

            if (!s || s.jumlah < itemCount[nama]) {
              conn.rollback(() => conn.release());
              return res
                .status(400)
                .json({ error: "Stock tidak cukup!" });
            }
          }

          // UPDATE STOCK
          const updates = Object.entries(itemCount).map(
            ([nama, qty]) =>
              new Promise((resolve, reject) => {
                conn.query(
                  "UPDATE stocks SET jumlah = jumlah - ? WHERE nama = ? AND jumlah >= ?",
                  [qty, nama, qty],
                  (err, result) => {
                    if (err) return reject(err);
                    if (result.affectedRows === 0)
                      return reject(new Error("Stock gagal update"));
                    resolve();
                  }
                );
              })
          );

          Promise.all(updates)
            .then(() => {
              // HITUNG TOTAL ASLI
              const realTotal = items.reduce(
  (sum, item) => sum + item.harga,
  0
) + (ongkir || 0);

              // ANTRIAN
              const queryAntrian = isTest
  ? "SELECT MAX(antrian) as last FROM orders WHERE is_test = 1 FOR UPDATE"
  : "SELECT MAX(antrian) as last FROM orders WHERE is_test = 0 FOR UPDATE";

conn.query(queryAntrian, (err, result) => {
  if (err) return rollback(conn, res, "DB error");

  const last = result[0]?.last || 0;
  const nextAntrian = last + 1;

                  // INSERT ORDER
                  conn.query(
                    "INSERT INTO orders (nama, telp, items, total, alamat, alamat_lengkap, pembayaran, antrian, status, is_test) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [
  nama,
  telp,
  JSON.stringify(items),
  realTotal,
  alamat,
  alamatLengkap,
  pembayaran,
  nextAntrian,
  "menunggu",
  isTest ? 1 : 0
],
                    (err2, result2) => {
                      if (err2)
                        return rollback(conn, res, "Insert error");

                      conn.commit(err => {
                        if (err)
                          return rollback(conn, res, "Commit error");

                        conn.release();

                        res.json({
                          id: result2.insertId,
                          antrian: nextAntrian
                        });
                      });
                    }
                  );
                }
              );
            })
            .catch(err => rollback(conn, res, err.message));
        }
      );
    });
  });
});

/* ================= PUBLIC ================= */

app.get("/public-orders", (req, res) => {

  const showTest = req.query.test === "1";

  const query = showTest
    ? "SELECT * FROM orders WHERE is_test = 1 ORDER BY id DESC LIMIT 20"
    : "SELECT * FROM orders WHERE is_test = 0 ORDER BY id DESC LIMIT 20";

  db.query(query, (err, results) => {
    if (err)
      return res.status(500).json({ error: err.message });
    res.json(results || []);
  });
});

/* ================= ADMIN ================= */

app.put("/order/:id", auth, (req, res) => {
  const { status } = req.body;

  db.query(
    "UPDATE orders SET status=? WHERE id=?",
    [status, req.params.id],
    err => {
      if (err) return res.status(500).json(err);
      res.sendStatus(200);
    }
  );
});

app.delete("/order/:id", auth, (req, res) => {
  db.query(
    "DELETE FROM orders WHERE id=?",
    [req.params.id],
    err => {
      if (err) return res.status(500).json(err);
      res.sendStatus(200);
    }
  );
});

/* ================= STOCK ================= */

app.get("/stocks", (req, res) => {
  db.query("SELECT * FROM stocks ORDER BY id DESC", (err, results) => {
    if (err) return res.status(500).json({ error: "DB error" });
    res.json(results || []);
  });
});

app.post("/stocks", auth, (req, res) => {
  const { nama, jumlah } = req.body;

  if (!nama || typeof jumlah !== "number" || jumlah < 0) {
    return res.status(400).json({ error: "Data tidak valid" });
  }

  db.query(
    "INSERT INTO stocks (nama, jumlah) VALUES (?, ?)",
    [nama, jumlah],
    err => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.sendStatus(200);
    }
  );
});

app.put("/stocks/update", auth, (req, res) => {
  const { nama, jumlah } = req.body;

  if (!nama || typeof jumlah !== "number") {
    return res.status(400).json({ error: "Data tidak valid" });
  }

  db.query(
    "UPDATE stocks SET jumlah = GREATEST(jumlah + ?, 0) WHERE nama = ?",
    [jumlah, nama],
    err => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.sendStatus(200);
    }
  );
});

app.delete("/stocks/:id", auth, (req, res) => {
  db.query(
    "DELETE FROM stocks WHERE id = ?",
    [req.params.id],
    err => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.sendStatus(200);
    }
  );
});

/* ================= PORT ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🔥 Server jalan di port " + PORT);
});