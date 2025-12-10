import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// --- In-Memory-"Datenbank" ---
let nextUserId = 1;
let nextMessageId = 1;

/**
 * User:
 * {
 *   id,
 *   email,
 *   password,
 *   role: "client" | "model",
 *   tokens,
 *   createdAt
 * }
 */
const users = [];

/**
 * Message:
 * {
 *   id,
 *   conversationId,
 *   fromUserId,
 *   toUserId,
 *   senderRole: "client" | "model",
 *   text,
 *   timestamp
 * }
 */
const messages = [];

// Hilfsfunktion: User nach Email + Rolle
function findUserByEmailAndRole(email, role) {
  return users.find(
    (u) =>
      u.email.toLowerCase() === email.toLowerCase() && u.role === role
  );
}

// --- Root-Route ---
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "AdultChat Backend läuft",
  });
});

// --- API Test ---
app.get("/api/test", (req, res) => {
  res.json({
    ok: true,
    message: "API läuft",
    usersCount: users.length,
    messagesCount: messages.length,
  });
});

// --- Registrierung ---
app.post("/api/register", (req, res) => {
  const { email, password, role } = req.body || {};

  if (!email || !password || !role) {
    return res.status(400).json({
      ok: false,
      error: "email, password und role sind erforderlich",
    });
  }

  if (role !== "client" && role !== "model") {
    return res.status(400).json({
      ok: false,
      error: 'role muss "client" oder "model" sein',
    });
  }

  if (findUserByEmailAndRole(email, role)) {
    return res.status(400).json({
      ok: false,
      error: "User mit dieser E-Mail und Rolle existiert bereits",
    });
  }

  const user = {
    id: nextUserId++,
    email,
    password, // nur Demo – später mit Hash!
    role,
    tokens: role === "client" ? 100 : 0, // Start-Tokens für Clients
    createdAt: new Date().toISOString(),
  };

  users.push(user);

  const { password: _pw, ...safeUser } = user;
  res.json({ ok: true, user: safeUser });
});

// --- Login ---
app.post("/api/login", (req, res) => {
  const { email, password, role } = req.body || {};

  if (!email || !password || !role) {
    return res.status(400).json({
      ok: false,
      error: "email, password und role sind erforderlich",
    });
  }

  const user = findUserByEmailAndRole(email, role);
  if (!user || user.password !== password) {
    return res.status(401).json({
      ok: false,
      error: "Ungültige Zugangsdaten oder falsche Rolle",
    });
  }

  const { password: _pw, ...safeUser } = user;
  res.json({ ok: true, user: safeUser });
});

// --- User-Liste (z.B. für Model-Auswahl) ---
app.get("/api/users", (req, res) => {
  const safeUsers = users.map((u) => ({
    id: u.id,
    email: u.email,
    role: u.role,
    tokens: u.tokens,
    createdAt: u.createdAt,
  }));
  res.json(safeUsers);
});

// --- Nachrichten laden ---
app.get("/api/messages", (req, res) => {
  const { conversationId } = req.query;
  if (!conversationId) {
    return res.status(400).json({
      ok: false,
      error: "conversationId ist erforderlich",
    });
  }

  const convMessages = messages
    .filter((m) => m.conversationId === conversationId)
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

  res.json({
    ok: true,
    conversationId,
    messages: convMessages,
  });
});

// --- Nachricht senden + Tokenlogik ---
app.post("/api/messages", (req, res) => {
  const { conversationId, fromUserId, toUserId, senderRole, text } =
    req.body || {};

  if (
    !conversationId ||
    !fromUserId ||
    !toUserId ||
    !senderRole ||
    !text
  ) {
    return res.status(400).json({
      ok: false,
      error:
        "conversationId, fromUserId, toUserId, senderRole und text sind erforderlich",
    });
  }

  if (senderRole !== "client" && senderRole !== "model") {
    return res.status(400).json({
      ok: false,
      error: 'senderRole muss "client" oder "model" sein',
    });
  }

  const fromUser = users.find((u) => u.id === Number(fromUserId));
  const toUser = users.find((u) => u.id === Number(toUserId));

  if (!fromUser || !toUser) {
    return res.status(400).json({
      ok: false,
      error: "fromUserId oder toUserId nicht gefunden",
    });
  }

  // Token-Kosten pro Client-Nachricht
  const MESSAGE_COST = 1;

  if (senderRole === "client") {
    if (typeof fromUser.tokens !== "number") fromUser.tokens = 0;
    if (fromUser.tokens < MESSAGE_COST) {
      return res.status(400).json({
        ok: false,
        error: "Nicht genug Tokens für diese Nachricht",
      });
    }
    fromUser.tokens -= MESSAGE_COST;
  }

  const newMessage = {
    id: nextMessageId++,
    conversationId,
    fromUserId: Number(fromUserId),
    toUserId: Number(toUserId),
    senderRole,
    text,
    timestamp: new Date().toISOString(),
  };

  messages.push(newMessage);

  res.json({
    ok: true,
    message: newMessage,
    remainingTokens: senderRole === "client" ? fromUser.tokens : undefined,
  });
});

// --- Server starten ---
app.listen(PORT, () => {
  console.log(`AdultChat Backend läuft auf http://localhost:${PORT}`);
});
