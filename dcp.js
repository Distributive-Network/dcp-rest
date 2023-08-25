const dcp = require('dcp-client');
const kvin = require('kvin');
const workFunctionTransformer = require('./work-function');

const SCHEDULER_URL = new URL('https://scheduler.distributed.computer');

function init()
{
  return dcp.init(SCHEDULER_URL);
}

// unlock bank account
async function unlockBankAccount(bankAccounts, address, password)
{
  const wallet = require('dcp/wallet');

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
  const wallet = require('dcp/wallet');
  const protocol = require('dcp/protocol');

  const idKs = await getOAuthId(bearer);
  const portalConnection = new protocol.Connection(dcpConfig.portal, idKs);
  const response = await portalConnection.send('viewKeystores', {});

  return response.payload;
}

// creates a job and parses body into compute.for args
function computeFor(reqBody)
{
  const compute = require('dcp/compute');

  // slice data
  const data = reqBody.slices;

  // work function
  const work = workFunctionTransformer.setup(reqBody.work);
  const workFunction = work.workFunction;
  const additionalRequires = work.requires || [];

  // call compute.for
  const job = compute.for(data, workFunction, reqBody.args);

  // job api
  job.computeGroups = reqBody.computeGroups || job.computeGroups;
  job.requirements  = reqBody.requirements  || [];
  job.public        = reqBody.public        || {};

  // add requirements to the job
  var jobRequires = reqBody.requires || [];
  jobRequires = jobRequires.concat(additionalRequires);

  if ((reqBody.requires && reqBody.requires.length > 0) || (additionalRequires && additionalRequires.length > 0))
    job.requires(jobRequires);

  return job
}

async function deployJobDCP(reqBody, bearer)
{
  const compute = require('dcp/compute');
  const wallet = require('dcp/wallet');
  const protocol = require('dcp/protocol');

  // specify the ID keystore for the job
  const oauthId = await getOAuthId(bearer);
  wallet.addId(oauthId);

  // instantiate new job object with options
  const job = computeFor(reqBody);
  var slicePaymentOffer = compute.marketValue;
  if (typeof reqBody.slicePaymentOffer === 'number')
    slicePaymentOffer = reqBody.slicePaymentOffer;

  // find the bank account and try to unlock it
  const accounts = await getBankAccounts(reqBody, bearer);
  const bankKs = await unlockBankAccount(accounts, reqBody.account.address, reqBody.account.password);
  job.setPaymentAccountKeystore(bankKs);

  // kick off the job and see if it gets accepted
  return new Promise((resolve, reject) => {
    // start computing the job
    job.exec(slicePaymentOffer).catch(reject);

    // race to return the job address
    job.on('accepted', () => {
      console.log(`Job with id ${job.id} accepted by the scheduler`);
      resolve(job.address);
    });

    job.on('readystatechange', (state) => {
      if (job.id !== null)
        resolve(job.address);
    });
  });
}

// get results
async function results(jobAddress, bearer)
{
  const dcpConfig = require('dcp/dcp-config');
  const protocol = require('dcp/protocol');
  const wallet = require('dcp/wallet');

  // caveat with the id... can only use it for jobs deployed with this oauth token, this is bad - but whatever
  // it will change in the future
  const idKs = await getOAuthId(bearer);
  const conn = new protocol.Connection(dcpConfig.scheduler.services.resultSubmitter.location, idKs);

  const { success, payload } = await conn.send('fetchResult', {
    job: new wallet.Address(jobAddress),
    owner: new wallet.Address(idKs.address),
  }, idKs);

  for (let i = 0; i < payload.length; i++)
    payload[i].value = kvin.deserialize(payload[i].value.split('data:application/x-kvin,')[1])

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
  const dcpConfig = require('dcp/dcp-config');
  const protocol = require('dcp/protocol');
  const wallet = require('dcp/wallet');

  const idKs = await getOAuthId(bearer);
  const conn = new protocol.Connection(dcpConfig.scheduler.services.pheme.location, idKs);

  const { success, payload } = await conn.send('fetchJobReport', {
    job: new wallet.Address(jobAddress),
    jobOwner: new wallet.Address(idKs.address),
  }, idKs);

  console.log(payload);

  return payload;
}

// cancel a job
async function cancelJob(jobAddress, reqBody, bearer)
{
  const dcpConfig = require('dcp/dcp-config');
  const protocol = require('dcp/protocol');
  const wallet = require('dcp/wallet');

  const idKs = await getOAuthId(bearer);
  const conn = new protocol.Connection(dcpConfig.scheduler.services.jobSubmit.location, idKs)

  const reason = reqBody.reason;

  const { success, payload } = await conn.send('cancelJob', {
    job: new wallet.Address(jobAddress),
//    jobOwner: new wallet.Address(idKs.address),
    reason: reason,
  }, idKs);

  return payload;
}

async function countJobs(bearer)
{
  const dcpConfig = require('dcp/dcp-config');
  const protocol = require('dcp/protocol');
  const wallet = require('dcp/wallet');

  const idKs = await getOAuthId(bearer);
  const conn = new protocol.Connection(dcpConfig.scheduler.services.pheme.location, idKs);

  const { success, payload } = await conn.send('countJobs', {
    jobOwner: new wallet.Address(idKs.address).address,
    isSelectingAll: false,
  }, idKs);

  return payload;
}

async function listJobs(reqBody, bearer)
{
  const dcpConfig = require('dcp/dcp-config');
  const protocol = require('dcp/protocol');
  const wallet = require('dcp/wallet');

  const accounts = await getBankAccounts(reqBody, bearer);
  const bankKs = await unlockBankAccount(accounts, reqBody.account.address, reqBody.account.password);

  // Make signed message to confirm ownership of keystore
  const signedMessage = await bankKs.makeSignedMessage({ address: bankKs.address });

  const idKs = await getOAuthId(bearer);
  const phemeConnection = new protocol.Connection(dcpConfig.scheduler.services.pheme.location, idKs);

  const jobResponse = await phemeConnection.send('fetchJobsByAccount', {
    signedMessage: signedMessage,
    paymentAccount: bankKs.address,
  }).then(response => {
    if (!response.success)
      throw payloadError(response, new Error("Operation 'fetchJobsByAccount' failed"));
    return response;
  });

  delete jobResponse.payload.preauthToken;
  return jobResponse.payload;
}

async function getPendingPayment(reqBody, bearer)
{
  const dcpConfig = require('dcp/dcp-config');
  const protocol = require('dcp/protocol');
  const wallet = require('dcp/wallet');

  const accounts = await getBankAccounts(reqBody, bearer);
  const bankKs = await unlockBankAccount(accounts, reqBody.account.address, reqBody.account.password);

  // Make signed message to confirm ownership of keystore
  const signedMessage = await bankKs.makeSignedMessage({ address: bankKs.address });

  const idKs = await getOAuthId(bearer);
  const phemeConnection = new protocol.Connection(dcpConfig.scheduler.services.pheme.location, idKs);
  const bankTellerConnection = new protocol.Connection(dcpConfig.bank.services.bankTeller.location, idKs);

  const jobResponse = await phemeConnection.send('fetchJobsByAccount', {
    signedMessage: signedMessage,
    paymentAccount: bankKs.address,
  }).then(response => {
    if (!response.success)
      throw payloadError(response, new Error("Operation 'fetchJobsByAccount' failed"));
    return response;
  });


  // Gets the sum of all pending payments for all jobs associated with the account
  const pendingPayments = await bankTellerConnection.send('viewPendingPayments', {
    preauthToken: jobResponse.payload.preauthToken,
  }).then(response => {
    if (!response.success)
      throw payloadError(response, new Error("Operation 'viewPendingPayments' failed"));
    return response;
  });
  const {totalPendingPayments} = pendingPayments.payload

  return totalPendingPayments;
}

// auth
async function getOAuthId(bearer)
{
  const wallet = require('dcp/wallet');

  const tokenStr = bearer.split('Bearer ')[1];
  const tokenObj = JSON.parse(decodeURIComponent(escape(Buffer.from(tokenStr, 'base64').toString())));
  const idKs = await new wallet.IdKeystore(tokenObj.keystore); // change to extract from token
  await idKs.unlock(tokenObj.accessToken, 1000, true);

  wallet.passphrasePrompt = (message) => {
    return token.accessToken;
  };

  return idKs;
}

// kube yaml
async function getIdentity(bearer)
{
  const wallet = require('dcp/wallet');
  const protocol = require('dcp/protocol');

  const idKs = await getOAuthId(bearer);
  const portalConnection = new protocol.Connection(dcpConfig.portal, idKs);
  const response = await portalConnection.send('getUserInfo', {});

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
exports.init         = init;
exports.getIdentity  = getIdentity;

