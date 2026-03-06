import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SUPABASE_SECRET_KEY || "fallback-secret-change-in-production";

/** Rotas que não exigem token (públicas) */
const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
];

function isPublicPath(path) {
  const normalized = path.split("?")[0];
  return PUBLIC_PATHS.some((p) => normalized === p || normalized.endsWith(p) || normalized.includes(p));
}

/**
 * Middleware que exige JWT para rotas da API (exceto login, cadastro, esqueci senha).
 * Garante que apenas usuários cadastrados acessem os dados.
 */
export function requireAuth(req, res, next) {
  if (isPublicPath(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Acesso restrito. Faça login para continuar.",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId ?? decoded.sub;
    req.userEmail = decoded.email;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: "Sessão inválida ou expirada. Faça login novamente.",
    });
  }
}
