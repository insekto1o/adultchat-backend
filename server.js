import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4000;

// Mittelware
app.use(cors());
app.use(express.json());

// Simple In-Memory-Daten (nur zum Start, später DB)
const users = []; // { id, email, passwordHashFake, role, tokens }
let nextUserId = 1;

const messages = []; // { id, fromUserId, toUserId, text, timestamp, cost }
let nextMessageId = 1;

// Gesundheitscheck
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Dummy-Register (ohne echte Sicherheit, nur zum Anfang)
app.post("/api/register", (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: "email, password, role sind Pflicht" });
  }

  if (!["client", "model"].includes(role)) {
    return res.status(400).json({ error: "role muss 'client' oder 'model' sein" });
  }

  const existing = users.find((u) => u.email === email);
  if (existing) {
    return res.status(400).json({ error: "User mit dieser E-Mail existiert schon (Demo)." });
  }

  const newUser = {
    id: nextUserId++,
    email,
    // In echt: Passwort hashen! Hier nur Platzhalter:
    passwordHashFake: "HASH_" + password,
    role,
    tokens: role === "client" ? 200 : 0 // Clients starten mit 200 Tokens
  };

  users.push(newUser);

  res.json({
    id: newUser.id,
    email: newUser.email,
    role: newUser.role,
    tokens: newUser.tokens
  });
});

// Dummy-Login (ohne JWT, ohne Security, nur für Start)
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const user = users.find(
    (u) => u.email === email && u.passwordHashFake === "HASH_" + password
  );

  if (!user) {
    return res.status(401).json({ error: "Login fehlgeschlagen (Demo)." });
  }

  // In echt würde hier ein Token (JWT) zurückkommen
  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    tokens: user.tokens
  });
});

// Dummy-Route für Tokens & Rollen ansehen
app.get("/api/users", (req, res) => {
  res.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      tokens: u.tokens
    }))
  );
});

// NEU: Nachricht senden (mit Token-Abzug beim Client)
app.post("/api/messages/send", (req, res) => {
  const { fromUserId, toUserId, text, cost } = req.body;

  if (!fromUserId || !toUserId || !text) {
    return res.status(400).json({ error: "fromUserId, toUserId und text sind Pflicht." });
  }

  const fromUser = users.find((u) => u.id === Number(fromUserId));
  const toUser = users.find((u) => u.id === Number(toUserId));

  if (!fromUser || !toUser) {
    return res.status(404).json({ error: "Sender oder Empfänger nicht gefunden." });
  }

  // Standard-Kosten, falls nichts angegeben: 2 Tokens
  const messageCost = typeof cost === "number" ? cost : 2;

  // Nur Clients zahlen Tokens
  if (fromUser.role === "client" && messageCost > 0) {
    if (fromUser.tokens < messageCost) {
      return res.status(400).json({ error: "Nicht genug Tokens für diese Nachricht." });
    }
    fromUser.tokens -= messageCost;
  }

  const msg = {
    id: nextMessageId++,
    fromUserId: fromUser.id,
    toUserId: toUser.id,
    text,
    cost: messageCost,
    timestamp: new Date().toISOString()
  };

  messages.push(msg);

  res.json({
    message: msg,
    fromUser: {
      id: fromUser.id,
      tokens: fromUser.tokens
    }
  });
});

// NEU: Nachrichten-Verlauf zwischen zwei Usern
app.get("/api/messages", (req, res) => {
  const { userId, partnerId } = req.query;

  if (!userId || !partnerId) {
    return res
      .status(400)
      .json({ error: "userId und partnerId sind als Query-Parameter Pflicht." });
  }

  const a = Number(userId);
  const b = Number(partnerId);

  const convo = messages
    .filter(
      (m) =>
        (m.fromUserId === a && m.toUserId === b) ||
        (m.fromUserId === b && m.toUserId === a)
    )
    .sort((m1, m2) => new Date(m1.timestamp) - new Date(m2.timestamp));

  res.json(convo);
});

app.listen(PORT, () => {
  console.log(`AdultChat Backend läuft auf http://localhost:${PORT}`);
});

// NEU: Alle Nachrichten für einen User (z.B. Model-Inbox)
app.get("/api/messages/forUser/:userId", (req, res) => {
  const userId = Number(req.params.userId);
  if (!userId) {
    return res.status(400).json({ error: "userId (Param) ist Pflicht." });
  }

  const userExists = users.some((u) => u.id === userId);
  if (!userExists) {
    return res.status(404).json({ error: "User nicht gefunden." });
  }

  const userMessages = messages
    .filter((m) => m.fromUserId === userId || m.toUserId === userId)
    .sort((m1, m2) => new Date(m1.timestamp) - new Date(m2.timestamp));

  res.json(userMessages);
});
