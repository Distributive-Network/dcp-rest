const HttpError = require('../error').HttpError;
const protocol = require('dcp/protocol');
const wallet = require('dcp/wallet');

/**
 * Extracts a DCP identity keystore and password from a basic auth
 * token and returns an unlocked identity keystore for use.
 * @param {string} authHeader - The full authorization property always
 * starting with "Basic ".
 */
async function getId(authHeader)
{
  const base64Credentials = authHeader.split('Basic ')[1];
  const decodedHeader = atob(base64Credentials);
  const [ _, keystore, password ] = decodedHeader.match(/(.*):(.*)/);

  const idKeystore = await new wallet.Keystore(keystore);
  await idKeystore.unlock(password, 1000, true);

  return idKeystore;
}

exports.getId = getId;

