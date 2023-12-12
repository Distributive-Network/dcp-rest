const bearerAuth   = require('./bearer');
const identityAuth = require('./id');

// decorates req with an `authorizedIdentity` property based on Bearer or id keystore authorization
function authMiddleWare (req, res, next)
{
  const authHeader = req.headers.authorization;

  debugger;

  if (authHeader && authHeader.startsWith('Bearer '))
  {
    return bearerAuth.getId(authHeader)
      .then((id) => {
        req.authorizedIdentity = id;
        next();
      })
      .catch(err => res.status(401).json({ error: 'Unauthorized' }));
  }
  else if (req.body && req.body.identity)
  {
    return identityAuth.getId(req.body.identity.keystore, req.body.identity.passphrase)
      .then((id) => {
        req.authorizedIdentity = id;
        next();
      })
      .catch(err => res.status(401).json({ error: 'Unauthorized' }));
  }
  else
    return res.status(401).json({ error: 'Authentication method not provided' });
}

exports.middleWare = authMiddleWare;

