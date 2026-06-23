const jwt = require('jsonwebtoken');
const { supabaseAnon } = require('../config/supabaseClient');

function getTokenFromRequest(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string') return null;
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) return null;
  return token.trim();
}

function jwtVerifyErrorPayload(err) {
  const isDev = process.env.NODE_ENV !== 'production';

  if (err.name === 'TokenExpiredError') {
    return {
      success: false,
      code: 'TOKEN_EXPIRED',
      message: 'This JWT has expired. Log in again and use the fresh `token` from the response.',
      expiredAt: err.expiredAt,
    };
  }

  if (err.name === 'NotBeforeError') {
    return {
      success: false,
      code: 'TOKEN_NOT_ACTIVE_YET',
      message: 'This JWT is not valid yet (nbf claim). Check device clock or token source.',
      date: err.date,
    };
  }

  if (err.name === 'JsonWebTokenError') {
    return {
      success: false,
      code: 'JWT_INVALID',
      message:
        'This token is not a valid app JWT for this server (wrong secret, malformed, or wrong kind of token).',
      hint:
        'Use the `token` field from POST /api/auth/login (app JWT), or `session.access_token` (Supabase JWT) — both are accepted for user routes. Admin routes need the `token` from POST /api/admin/login.',
      ...(isDev && { detail: err.message }),
    };
  }

  return {
    success: false,
    code: 'AUTH_ERROR',
    message: err.message || 'Authentication failed.',
    ...(isDev && { detail: String(err) }),
  };
}

exports.verifyToken = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        code: 'NO_TOKEN',
        message: 'No token provided. Add header: Authorization: Bearer <token>',
        hint: 'Paste `token` or `session.access_token` from POST /api/auth/login.',
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        code: 'SERVER_MISCONFIGURED',
        message: 'Server misconfigured: JWT_SECRET not set',
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError' || jwtErr.name === 'NotBeforeError') {
        return res.status(401).json(jwtVerifyErrorPayload(jwtErr));
      }

      if (jwtErr.name === 'JsonWebTokenError') {
        const { data, error } = await supabaseAnon.auth.getUser(token);
        if (error || !data?.user) {
          const isDev = process.env.NODE_ENV !== 'production';
          return res.status(401).json({
            success: false,
            code: 'JWT_INVALID',
            message:
              'Not a valid app JWT and not a valid Supabase session access_token (or it expired / was revoked).',
            hint:
              'Log in again. Use either the top-level `token` from the login JSON or `session.access_token`. Do not paste the refresh_token.',
            ...(isDev && {
              jwtLibraryDetail: jwtErr.message,
              supabaseDetail: error?.message,
            }),
          });
        }

        req.user = {
          id: data.user.id,
          email: data.user.email,
          role: 'user',
        };
        return next();
      }

      return res.status(401).json(jwtVerifyErrorPayload(jwtErr));
    }
  } catch (err) {
    return res.status(401).json(jwtVerifyErrorPayload(err));
  }
};

exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    return next();
  };
};

