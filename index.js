require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");
const app = express();
const port = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false
});

app.use(express.json());

app.post("/logGame", async (req, res) => {
    // this entire function is GPT-ed and wrong.
  const { players, winner } = req.body;
  if (!players || !winner) return res.status(400).send("Missing data");

  try {
    for (const name of players) {
      await pool.query(
        `INSERT INTO players (name, elo) VALUES ($1, 1000) ON CONFLICT (name) DO NOTHING`,
        [name]
      );
    }

    const ratings = {};
    for (const name of players) {
      const { rows } = await pool.query(`SELECT elo FROM players WHERE name = $1`, [name]);
      ratings[name] = rows[0].elo;
    }

    const K = 32;
    const expected = {};
    const winnerRating = ratings[winner];
    for (const name of players) {
      const r = ratings[name];
      const exp = 1 / (1 + Math.pow(10, (winnerRating - r) / 400));
      expected[name] = exp;
    }

    for (const name of players) {
      const score = name === winner ? 1 : 0;
      const newElo = ratings[name] + K * (score - expected[name]);
      await pool.query(`UPDATE players SET elo = $1 WHERE name = $2`, [Math.round(newElo), name]);
    }

    await pool.query(`INSERT INTO games (players, winner) VALUES ($1, $2)`, [players, winner]);
    res.send("Game logged.");
  } catch (e) {
    console.error(e);
    res.status(500).send("Error logging game");
  }
});


//todo add logPlayer, 


app.get("/leaderboard", async (req, res) => {
    // this entire function is GPT-ed and wrong.
  const { rows } = await pool.query(`SELECT name, elo FROM players ORDER BY elo DESC`);
  res.json(rows);
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
