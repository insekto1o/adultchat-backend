import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// --- In-Memory "Datenbank" (nur zum Testen) ---

// User: { id, email, password, role ("client" | "model"), tokens }
let users = [];

// Messages: { id, conversationId, fromUserId, toUserId, senderRole, text, timestamp }
let messages = [];

// einfache ID-Generatoren
let nextUserId = 1;
let nextMessageId = 1;

// --- Basis-Route für Render / Browser-Check ---

app.get("/", (req, res) => {
  res.send("AdultChat Backend online");
});

// --- Test-Route ---

app.get("/api/test", (req, res) => {
  res.json({ ok: true, message: "API läuft" });
});

// --- User-API ---

// Alle User (nur Debug)
app.get("/api/users", (req, res) => {
  res.json(users);
});

// Registrierung: { email, password, role }
app.post("/api/register", (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ ok: false, error: "email, password, role nötig" });
  }

  const exists = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.role === role
  );
  if (exists) {
    return res.status(400).json({ ok: false, error: "User existiert bereits" });
  }

  const newUser = {
    id: nextUserId++,
    email,
    password, // nur Demo – in echt: hashen!
    role,     // "client" oder "model"
    tokens: role === "client" ? 100 : 0, // Client startet z.B. mit 100 Tokens
  };

  users.push(newUser);
  res.json({ ok: true, user: newUser });
});

// Login: { email, password, role }
app.post("/api/login", (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ ok: false, error: "email, password, role nötig" });
  }

  const user = users.find(
    (u) =>
      u.email.toLowerCase() === email.toLowerCase() &&
      u.password === password &&
      u.role === role
  );

  if (!user) {
    return res.status(401).json({ ok: false, error: "Login fehlgeschlagen" });
  }

  res.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      tokens: user.tokens,
    },
  });
});

// --- Nachrichten-API ---

// Nachrichten für eine Konversation holen
// GET /api/messages?conversationId=123
app.get("/api/messages", (req, res) => {
  const { conversationId } = req.query;
  if (!conversationId) {
    return res.status(400).json({ ok: false, error: "conversationId nötig" });
  }

  const convMessages = messages.filter(
    (m) => m.conversationId === conversationId
  );
  res.json({ ok: true, messages: convMessages });
});

// Neue Nachricht schicken
// Body: { conversationId, fromUserId, toUserId, senderRole, text }
app.post("/api/messages", (req, res) => {
  const { conversationId, fromUserId, toUserId, senderRole, text } = req.body;

  if (!conversationId || !fromUserId || !toUserId || !senderRole || !text) {
    return res.status(400).json({
      ok: false,
      error: "conversationId, fromUserId, toUserId, senderRole, text nötig",
    });
  }

  const msg = {
    id: nextMessageId++,
    conversationId: String(conversationId),
    fromUserId,
    toUserId,
    senderRole, // "client" oder "model"
    text,
    timestamp: new Date().toISOString(),
  };

  messages.push(msg);
  res.json({ ok: true, message: msg });
});

// --- Server Starten ---

app.listen(PORT, () => {
  console.log(`AdultChat Backend läuft auf Port ${PORT}`);
});
