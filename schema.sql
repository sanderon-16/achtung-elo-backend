CREATE TABLE IF NOT EXISTS Player (
  pid SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  elo INT DEFAULT 1000
);

CREATE TABLE IF NOT EXISTS Game (
  game_id SERIAL PRIMARY KEY,
  num_players INT NOT NULL,
  pid0 INT REFERENCES Player(pid),
  pid1 INT REFERENCES Player(pid),
  pid2 INT REFERENCES Player(pid),
  pid3 INT REFERENCES Player(pid),
  pid4 INT REFERENCES Player(pid),
  pid5 INT REFERENCES Player(pid),
  timestamp TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS PlayerInGame (
  pid INT REFERENCES Player(pid),
  game_id INT REFERENCES Game(game_id),
  color TEXT NOT NULL,
  score INT NOT NULL,
  PRIMARY KEY (pid, game_id)
);
