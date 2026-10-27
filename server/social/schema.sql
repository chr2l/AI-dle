-- Joueurs : un profil public par code ami, protégé par la clé secrète du joueur.
CREATE TABLE IF NOT EXISTS players (
  code TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL,
  profile TEXT NOT NULL,
  week INTEGER NOT NULL,
  weekly_score INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS players_week ON players (week, weekly_score DESC);

-- Cadeaux en attente : un par expéditeur, destinataire et jour.
CREATE TABLE IF NOT EXISTS gifts (
  id TEXT PRIMARY KEY,
  sender TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  receiver TEXT NOT NULL,
  day INTEGER NOT NULL,
  UNIQUE (sender, receiver, day)
);
CREATE INDEX IF NOT EXISTS gifts_receiver ON gifts (receiver);
