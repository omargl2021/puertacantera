import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const isProd = process.env.NODE_ENV === 'production';

// Runtime HMAC signing secret (env override or cryptographically strong in-memory key)
const SESSION_SIGNING_KEY =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

const DEFAULT_ADMIN_USERNAME = 'ADMON';
// Precomputed scrypt hash for the user-specified initial admin credential (overridden if process.env.ADMIN_PASSWORD is set)
const DEFAULT_ADMIN_SCRYPT =
  'pc_admon_salt_v1_9f4a:9fa591999d6333954990165dcbbb48f49aea110b387ee2ea297a4ffa400742dc';

interface ServerSession {
  token: string;
  username: string;
  role: 'admin' | 'resident' | 'treasurer' | 'guard';
  issuedAt: number;
}

const activeSessions = new Map<string, ServerSession>();

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyScryptHash(password: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const derivedHex = crypto.scryptSync(password, salt, 32).toString('hex');
  return timingSafeEqualStr(derivedHex, expectedHex);
}

function verifyAdminCredentials(username: string, password: string): boolean {
  const configuredUser = (process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME).trim();
  if (username.trim().toUpperCase() !== configuredUser.toUpperCase()) {
    return false;
  }
  const configuredPass = process.env.ADMIN_PASSWORD;
  if (configuredPass && configuredPass.length > 0) {
    return timingSafeEqualStr(password, configuredPass);
  }
  return verifyScryptHash(password, DEFAULT_ADMIN_SCRYPT);
}

function issueSessionToken(username: string, role: ServerSession['role']): string {
  const nonce = crypto.randomBytes(24).toString('hex');
  const sig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(`${username}:${role}:${nonce}`)
    .digest('hex');
  const token = `${nonce}.${sig}`;
  activeSessions.set(token, { token, username, role, issuedAt: Date.now() });
  return token;
}

function extractBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue || !headerValue.startsWith('Bearer ')) return null;
  return headerValue.slice('Bearer '.length).trim() || null;
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/auth/login', (req, res) => {
    const rawUsername = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!rawUsername || rawUsername.length > 160 || rawPassword.length < 4 || rawPassword.length > 128) {
      res.status(400).json({ ok: false, error: 'Ingresa un usuario y contraseña válidos.' });
      return;
    }

    const configuredAdminUser = (process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME).trim();
    if (rawUsername.toUpperCase() === configuredAdminUser.toUpperCase()) {
      if (!verifyAdminCredentials(rawUsername, rawPassword)) {
        res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos.' });
        return;
      }
      const token = issueSessionToken(configuredAdminUser, 'admin');
      res.json({
        ok: true,
        isAdmin: true,
        username: configuredAdminUser,
        role: 'admin',
        token,
      });
      return;
    }

    // Non-admin resident sign-in validated against resident directory on client/Firestore;
    // issue a non-privileged resident bearer token (never admin).
    const token = issueSessionToken(rawUsername.toLowerCase(), 'resident');
    res.json({
      ok: true,
      isAdmin: false,
      username: rawUsername,
      role: 'resident',
      token,
    });
  });

  app.get('/api/auth/me', (req, res) => {
    const token = extractBearerToken(req.header('authorization'));
    if (!token) {
      res.status(401).json({ ok: false, error: 'No autenticado.' });
      return;
    }
    const session = activeSessions.get(token);
    if (!session) {
      res.status(401).json({ ok: false, error: 'Sesión expirada o inválida.' });
      return;
    }
    res.json({ ok: true, username: session.username, role: session.role });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = extractBearerToken(req.header('authorization'));
    if (token) {
      activeSessions.delete(token);
    }
    res.json({ ok: true });
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Puerta Cantera server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
