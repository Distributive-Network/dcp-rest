const db = require('../db');
const HttpError = require('../error').HttpError;

const protocol = require('dcp/protocol');
const wallet = require('dcp/wallet');

async function getOAuthId(bearer)
{
  const tokenStr = bearer.split('Bearer ')[1];
  const tokenHalves = tokenStr.split('.');
  const apiKey = tokenHalves[0];
  const ksPassword = tokenHalves[1];

  // db or cache call to get the keystore associated with the user based on what they sent.
  const keystore = await db.getKeystore(apiKey);

  wallet.passphrasePrompt = (message) => {
    return ksPassword;
  };

  const idKs = await new wallet.IdKeystore(keystore);
  await idKs.unlock(ksPassword, 1000, true);
  return idKs;
}

exports.getId = getOAuthId;

