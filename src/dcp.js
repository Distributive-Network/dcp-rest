const dcp = require('dcp-client');
const kvin = require('kvin');
const workFunctionTransformer = require('./work-function');
const db = require('./db');
const webhooks = require('./webhooks/lib');
const HttpError = require('./error').HttpError;

require("../db/load-env.js"); // chanmge this later - load env variables

//const SCHEDULER_URL = new URL('https://scheduler.distributed.computer');
const SCHEDULER_URL = new URL(process.env.SCHEDULER_HREF);

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
  const response = await portalConnection.request('viewKeystores', {});

  return response.payload;
}

// creates a job and parses body into compute.for args
async function computeFor(reqBody)
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


  // webhook
  if (reqBody.webHookUrls)
  {
    // TODO check if webHookUrls is empty
    const appId = await webhooks.setJobWebhookServers(reqBody.webHookUrls);
    const jobUrl = await webhooks.getDcpRDSUrl(appId);
    job.setResultStorage(new URL(jobUrl), {});
    reqBody.appId = appId;// this is fucked up, only temporarily doing this until next commit
  }

  // add requirements to the job
  var jobRequires = reqBody.packages || [];
  jobRequires = jobRequires.concat(additionalRequires);

  if ((reqBody.packages && reqBody.packages.length > 0) || (additionalRequires && additionalRequires.length > 0))
    job.requires(jobRequires);

  return job;
}

async function deployJobDCP(reqBody, bearer)
{
  const compute = require('dcp/compute');
  const wallet = require('dcp/wallet');
  const protocol = require('dcp/protocol');

  const bankAddress = reqBody.account.address;
  const bankPassword = reqBody.account.password;

  // specify the ID keystore for the job
  const oauthId = await getOAuthId(bearer); // TODO - this hangs if oauthID is invalid
  wallet.addId(oauthId);

  // instantiate new job object with options
  const job = await computeFor(reqBody);
  var slicePaymentOffer = compute.marketValue;
  if (typeof reqBody.slicePaymentOffer === 'number')
    slicePaymentOffer = reqBody.slicePaymentOffer;

  // find the bank account and try to unlock it
  const accounts = await getBankAccounts(reqBody, bearer);
  const bankKs = await unlockBankAccount(accounts, bankAddress, bankPassword);
  if (bankKs === null)
    throw new HttpError(`DCP bank account ${bankAddress} not found`);
  job.setPaymentAccountKeystore(bankKs);

  // kick off the job and see if it gets accepted
  const jobId = await new Promise((resolve, reject) => {
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

  // if using webhooks, associate the jobId with the appId
  if (reqBody.webHookUrls && reqBody.appId)
    await webhooks.setJobIdAppIdRelationship(jobId, reqBody.appId);

  return jobId;
}

// get results
async function results(jobAddress, bearer)
{
  const dcpConfig = require('dcp/dcp-config');
  const protocol = require('dcp/protocol');
  const wallet = require('dcp/wallet');

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
  const { success, payload } = await conn.send(req);

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
  const dcpConfig = require('dcp/dcp-config');
  const protocol = require('dcp/protocol');
  const wallet = require('dcp/wallet');

  const idKs = await getOAuthId(bearer);
  const conn = new protocol.Connection(dcpConfig.scheduler.services.pheme.location, idKs);

  try
  {
    const body = {operation: 'fetchJobReport', data: {
      job: new wallet.Address(jobAddress),
      jobOwner: new wallet.Address(idKs.address),
    }};
    const req = new conn.Request(body, idKs);
    const { success, payload } = await conn.send(req);
    return payload;
  }

  catch (e)
  {
    // TODO check if the error is because its not compat yet, if thats the error than continue
  }

  // note: the code below may be deprecated if my changes make it into develop / prod ....
  const { success, payload } = await conn.request('fetchJobReport', {
    job: new wallet.Address(jobAddress),
    jobOwner: new wallet.Address(idKs.address),
  }, idKs);
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
  const dcpConfig = require('dcp/dcp-config');
  const protocol = require('dcp/protocol');
  const wallet = require('dcp/wallet');

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

  const jobResponse = await phemeConnection.request('fetchJobsByAccount', {
    signedMessage: signedMessage,
    paymentAccount: bankKs.address,
  }).then(response => {
    if (!response.success)
      throw payloadError(response, new Error("Operation 'fetchJobsByAccount' failed"));
    return response;
  });


  // Gets the sum of all pending payments for all jobs associated with the account
  const pendingPayments = await bankTellerConnection.request('viewPendingPayments', {
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
  const wallet = require('dcp/wallet');
  const protocol = require('dcp/protocol');

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
exports.init         = init;
exports.getIdentity  = getIdentity;

