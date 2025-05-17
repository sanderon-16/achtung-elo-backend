const express = require("express");
const { Pool } = require("pg");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false
});

// POST /logGame
app.post("/logGame", async (req, res) => {
  const { players } = req.body;
  // players = array of objects: { name, color, score }

  if (!Array.isArray(players) || players.length < 2) {
    return res.status(400).json({ error: "Invalid players array" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Insert or get existing players
    const playerIds = [];
    for (const p of players) {
      const result = await client.query(
        `INSERT INTO Player (name)
         VALUES ($1)
         ON CONFLICT (name) DO NOTHING
         RETURNING pid`,
        [p.name]
      );

      let pid;
      if (result.rows.length > 0) {
        pid = result.rows[0].pid;
      } else {
        const res2 = await client.query(`SELECT pid FROM Player WHERE name = $1`, [p.name]);
        pid = res2.rows[0].pid;
      }

      playerIds.push({ ...p, pid });
    }

    // Insert game
    const pidCols = playerIds.map((p, i) => `pid${i}`);
    const pidVals = playerIds.map(p => p.pid);
    const numPlayers = playerIds.length;
    const gameResult = await client.query(
      `INSERT INTO Game (num_players, ${pidCols.join(", ")})
       VALUES ($1, ${pidVals.map((_, i) => `$${i + 2}`).join(", ")})
       RETURNING game_id`,
      [numPlayers, ...pidVals]
    );
    const gameId = gameResult.rows[0].game_id;

    // Insert into PlayerInGame
    for (const p of playerIds) {
      await client.query(
        `INSERT INTO PlayerInGame (pid, game_id, color, score)
         VALUES ($1, $2, $3, $4)`,
        [p.pid, gameId, p.color, p.score]
      );
    }

    // Simple Elo Update (Winner takes all) (SUPER GPT-ed - avi this is for you)
    const sorted = [...playerIds].sort((a, b) => b.score - a.score);
    const K = 32;

    for (const player of playerIds) {
      const res = await client.query(`SELECT elo FROM Player WHERE pid = $1`, [player.pid]);
      player.elo = res.rows[0].elo;
    }

    for (let i = 0; i < playerIds.length; i++) {
      for (let j = i + 1; j < playerIds.length; j++) {
        const A = playerIds[i];
        const B = playerIds[j];

        const EA = 1 / (1 + Math.pow(10, (B.elo - A.elo) / 400));
        const EB = 1 / (1 + Math.pow(10, (A.elo - B.elo) / 400));

        const SA = A.score > B.score ? 1 : A.score === B.score ? 0.5 : 0;
        const SB = 1 - SA;

        A.elo += K * (SA - EA);
        B.elo += K * (SB - EB);
      }
    }

    // Update Elo
    for (const p of playerIds) {
      await client.query(`UPDATE Player SET elo = $1 WHERE pid = $2`, [Math.round(p.elo), p.pid]);
    }

    await client.query("COMMIT");
    res.json({ gameId });
    // res.json({ 0 :"Game logged successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to log game" });
  } finally {
    client.release();
  }
});

// GET /leaderboard
app.get("/leaderboard", async (req, res) => {
  try {
    const result = await pool.query(`SELECT name, elo FROM Player ORDER BY elo DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
