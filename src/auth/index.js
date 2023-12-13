const bearerAuth   = require('./bearer');
const basicAuth    = require('./basic');

/**
 * Returns a promise which decorates req with an `authorizedIdentity`
 * property based on Bearer or id keystore authorization and calls
 * the `next` callback.
 */
function authMiddleWare (req, res, next)
{
  var authFunction;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer '))
    authFunction = bearerAuth.getId;
  else if (authHeader && authHeader.startsWith('Basic '))
    authFunction = basicAuth.getId;
  else
    return res.status(401).json({ error: 'Authentication method not provided' });

  return basicAuth.getId(authHeader)
    .then((id) => {
      req.authorizedIdentity = id;
      next();
    })
    .catch(err => res.status(401).json({ error: 'Invalid identity keystore or password' }));
}

exports.middleWare = authMiddleWare;

