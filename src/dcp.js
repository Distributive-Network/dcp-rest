const kvin = require('kvin');
const db = require('./db');
const webhooks = require('./webhooks/lib');
const HttpError = require('./error').HttpError;
const JobSpec   = require('./dcp/job').JobSpec;
const JobHandle = require('./dcp/job').JobHandle;

// dcp specific imports
const protocol = require('dcp/protocol');
const wallet = require('dcp/wallet');
const dcpConfig = require('dcp/dcp-config');

// unlock bank account
async function unlockBankAccount(bankAccounts, address, password)
{
  // try to find the account in the list of bankAccounts
  for (const i in bankAccounts)
  {
    if (wallet.Address(bankAccounts[i].address).eq(address))
    {
      const ks = await new wallet.Keystore(bankAccounts[i]);
      await ks.unlock(password, 1000, true);
      return ks;
    }
  }

  return null;
}

// get the accounts associated with the portal user
async function getBankAccounts(reqBody, bearer)
{
  const idKs = await getOAuthId(bearer);
  const portalConnection = new protocol.Connection(dcpConfig.portal, idKs);
  const response = await portalConnection.request('viewKeystores', {});

  return response.payload;
}


async function deployJobDCP(reqBody, bearer)
{
  const options = reqBody;

  const bankAddress = reqBody.account.address;
  const bankPassword = reqBody.account.password;

  // specify the ID keystore for the job
  const oauthId = await getOAuthId(bearer); // TODO - this hangs if oauthID is invalid
  wallet.addId(oauthId);

  // unlock and set the banka ccount
  const accounts = await getBankAccounts(reqBody, bearer);
  const bankKs = await unlockBankAccount(accounts, bankAddress, bankPassword);
  if (bankKs === null)
    throw new HttpError(`DCP bank account ${bankAddress} not found`);
  options.bankKs = bankKs;

  const jobSpec = new JobSpec(options);
  return await jobSpec.deploy();
}

// get results
async function results(jobAddress, bearer)
{
  // caveat with the id... can only use it for jobs deployed with this oauth token, this is bad - but whatever
  // it will change in the future when we have identity figured out on the dcp side
  const idKs = await getOAuthId(bearer);
  const conn = new protocol.Connection(dcpConfig.scheduler.services.resultSubmitter.location, idKs);

  const body = {
    operation: 'fetchResult', data: {
      job: new wallet.Address(jobAddress),
      owner: new wallet.Address(idKs.address),
    }
  };
  const req = new conn.Request(body, idKs);
  let success, payload;

  try
  {
    const res = await conn.send(req);
    success = res.success;
    payload = res.payload;
    console.log(res);
  }

  catch (e)
  {
    throw new HttpError(`-Error getting results for job ${jobAddress}`);
  }
  if (!success)
    throw new HttpError(`Error getting results for job ${jobAddress}`);

  console.log(payload);

  for (let i = 0; i < payload.length; i++)
  {
    if (payload[i].value.includes("application/x-kvin"))
      payload[i].value = kvin.deserialize(decodeURI(payload[i].value.split('data:application/x-kvin,')[1]))
    else
      payload[i].value = decodeURI(payload[i].value.split('data:,')[1])
  }

  // get the number of slices so far
  const jobStatus = await status(jobAddress, bearer);

  // respond with the status
  const response = {};
  response.totalSlices = jobStatus.totalSlices;
  response.completedSlices = jobStatus.completedSlices;
  response.activeSlices = jobStatus.activeSlices;
  response.slices = payload;

  return response;
}

// get status
async function status(jobAddress, bearer)
{
  const idKs = await getOAuthId(bearer);

  const jh = new JobHandle(jobAddress, idKs);

  return jh.status();
}

// cancel a job
async function cancelJob(jobAddress, reqBody, bearer)
{
  const idKs = await getOAuthId(bearer);
  const conn = new protocol.Connection(dcpConfig.scheduler.services.jobSubmit.location, idKs)

  const reason = reqBody.reason;

  const { success, payload } = await conn.request('cancelJob', {
    job: new wallet.Address(jobAddress),
//    jobOwner: new wallet.Address(idKs.address),
    reason: reason,
  }, idKs);

  return payload;
}

async function countJobs(bearer)
{
  const jobs = await listJobs(bearer);
  return jobs.length;
}

async function listJobs(bearer)
{
  const idKs = await getOAuthId(bearer);
  const phemeConnection = new protocol.Connection(dcpConfig.scheduler.services.pheme.location, idKs);

  const requestPayload = {
    statuses: ['cancelled', 'corrupted', 'estimation', 'finished', 'running', 'paused', 'new']
  };

  const { success, payload } = await phemeConnection.request('listJobs', requestPayload);

  return payload;
}

async function getPendingPayment(reqBody, bearer)
{
  const accounts = await getBankAccounts(reqBody, bearer);
  const bankKs = await unlockBankAccount(accounts, reqBody.account.address, reqBody.account.password);

  // Make signed message to confirm ownership of keystore
  const signedMessage = await bankKs.makeSignedMessage({ address: bankKs.address });

  const idKs = await getOAuthId(bearer);
  const phemeConnection = new protocol.Connection(dcpConfig.scheduler.services.pheme.location, idKs);
  const bankTellerConnection = new protocol.Connection(dcpConfig.bank.services.bankTeller.location, idKs);

  const jobResponse = await phemeConnection.request('fetchJobsByAccount', {
    signedMessage: signedMessage,
    paymentAccount: bankKs.address,
  }).then(response => {
    if (!response.success)
      throw new HttpError("Operation 'fetchJobsByAccount' failed");
    return response;
  });


  // Gets the sum of all pending payments for all jobs associated with the account
  const pendingPayments = await bankTellerConnection.request('viewPendingPayments', {
    preauthToken: jobResponse.payload.preauthToken,
  }).then(response => {
    if (!response.success)
      throw new HttpError("Operation 'viewPendingPayments' failed");
    return response;
  });
  const {totalPendingPayments} = pendingPayments.payload

  return totalPendingPayments;
}

// auth
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

async function getIdentity(bearer)
{
  const idKs = await getOAuthId(bearer);
  const portalConnection = new protocol.Connection(dcpConfig.portal, idKs);
  const response = await portalConnection.request('getUserInfo', {});

  return response.payload.id;
}

// exports
exports.deployJobDCP = deployJobDCP;
exports.results      = results;
exports.status       = status;
exports.cancelJob    = cancelJob;
exports.countJobs    = countJobs;
exports.listJobs     = listJobs;
exports.getAccounts  = getBankAccounts;
exports.getIdentity  = getIdentity;

