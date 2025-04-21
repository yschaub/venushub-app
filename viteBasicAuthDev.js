
/**
 * Vite dev middleware for HTTP Basic Auth
 * Reads BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD from process.env
 */
const basicAuthDev = function(req, res, next) {
  // Only protect dashboard and admin
  if (!req.url.startsWith('/dashboard') && !req.url.startsWith('/admin')) return next();

  const username = process.env.BASIC_AUTH_USERNAME;
  const password = process.env.BASIC_AUTH_PASSWORD;
  if (!username || !password) {
    return res.end('Error: BASIC_AUTH_USERNAME and BASIC_AUTH_PASSWORD must be set in env/secrets');
  }

  const auth = req.headers.authorization || '';
  const [schema, encoded] = auth.split(' ');

  if (schema !== 'Basic' || !encoded) {
    res.setHeader('WWW-Authenticate', 'Basic realm="VenusHub", charset="UTF-8"');
    res.statusCode = 401;
    return res.end('Unauthorized');
  }

  const decoded = Buffer.from(encoded, 'base64').toString();
  const [user, pass] = decoded.split(':');

  if (user !== username || pass !== password) {
    res.setHeader('WWW-Authenticate', 'Basic realm="VenusHub", charset="UTF-8"');
    res.statusCode = 401;
    return res.end('Unauthorized');
  }
  next();
};

export default basicAuthDev;
