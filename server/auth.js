const crypto = require("crypto");

function createAuthService({ adminPassword, readDataWithoutMigration, appVersion, sendJson }) {
  const sessions = new Map();

  function parseCookies(req) {
    return Object.fromEntries(
      String(req.headers.cookie || "")
        .split(";")
        .map((cookie) => cookie.trim().split("="))
        .filter(([key, value]) => key && value)
    );
  }

  function isAuthed(req) {
    const data = readDataWithoutMigration();
    if (!adminPassword && !data.admin?.passwordHash) return true;
    const sessionId = parseCookies(req).homedash_session;
    const session = sessionId ? sessions.get(sessionId) : null;
    if (!session) return false;
    if (session.expiresAt < Date.now()) {
      sessions.delete(sessionId);
      return false;
    }
    return true;
  }

  function requireAuth(req, res) {
    if (isAuthed(req)) return true;
    sendJson(res, 401, { error: "Admin login required" });
    return false;
  }

  function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
    const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
    return `${salt}:${hash}`;
  }

  function verifyPassword(password, storedHash) {
    if (adminPassword && password === adminPassword) return true;
    if (!storedHash) return false;
    const [salt, expectedHash] = storedHash.split(":");
    if (!salt || !expectedHash) return false;
    const actualHash = hashPassword(password, salt).split(":")[1];
    return crypto.timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
  }

  function createAdminSession(res) {
    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, { expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
    setSessionCookie(res, sessionId);
  }

  function setSessionCookie(res, sessionId) {
    res.setHeader("Set-Cookie", `homedash_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
  }

  function clearSessionCookie(res) {
    res.setHeader("Set-Cookie", "homedash_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  }

  function getAuthState(data, req) {
    const passwordHash = data.admin?.passwordHash || "";
    return {
      enabled: Boolean(adminPassword || passwordHash),
      authenticated: isAuthed(req)
    };
  }

  function login(req, res, data, password) {
    if (!adminPassword && !data.admin?.passwordHash || verifyPassword(password, data.admin?.passwordHash)) {
      createAdminSession(res);
      return { enabled: Boolean(adminPassword || data.admin?.passwordHash), authenticated: true };
    }
    return null;
  }

  function shortcut(res, data) {
    createAdminSession(res);
    return { enabled: Boolean(adminPassword || data.admin?.passwordHash), authenticated: true };
  }

  function logout(req, res, data) {
    const sessionId = parseCookies(req).homedash_session;
    if (sessionId) sessions.delete(sessionId);
    clearSessionCookie(res);
    return { enabled: Boolean(adminPassword || data.admin?.passwordHash), authenticated: false };
  }

  function toPublicData(data, req) {
    const { passwordHash, ...publicAdmin } = data.admin || {};
    const authenticated = isAuthed(req);
    const publicData = authenticated ? data : redactStatusSecrets(data);
    return {
      ...publicData,
      app: {
        name: "Homedash",
        version: appVersion
      },
      admin: {
        ...publicAdmin,
        enabled: Boolean(adminPassword || passwordHash)
      },
      auth: {
        enabled: Boolean(adminPassword || passwordHash),
        authenticated
      }
    };
  }

  return {
    getAuthState,
    hashPassword,
    isAuthed,
    login,
    logout,
    requireAuth,
    shortcut,
    toPublicData
  };
}

function redactStatusSecrets(data) {
  const redactTarget = (target) => target ? {
    ...target,
      tokenId: "",
      tokenSecret: "",
      apiKey: "",
      username: "",
      password: "",
      headerValue: ""
  } : target;
  const profiles = (data.profiles || []).map((profile) => ({
    ...profile,
    statusTargets: (profile.statusTargets || []).map(redactTarget)
  }));
  return {
    ...data,
    profiles,
    statusTargets: (data.statusTargets || []).map(redactTarget)
  };
}

module.exports = {
  createAuthService
};
