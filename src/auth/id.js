const HttpError = require('../error').HttpError;

const protocol = require('dcp/protocol');
const wallet = require('dcp/wallet');

async function getId(keystore, password)
{
  const idKeystore = await new wallet.Keystore(keystore);
  await idKeystore.unlock(password, 1000, true);
  return idKeystore;
}

exports.getId = getId;

