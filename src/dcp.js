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
async function getBankAccounts(request)
{
  const idKs = await request.authorizedIdentity;
  const bankAccounts = [];

  // parse through and only return a list of objects with name and address
  const accountKeystores = await getBankAccountKeystores(idKs);
  for (const accountKeystore of accountKeystores)
  {
    bankAccounts.push({
      name:    accountKeystore.label,
      address: accountKeystore.address,
      balance: accountKeystore.balance,
    });
  }

  return bankAccounts;
}

async function getBankAccountKeystores(idKs) 
{
  const portalConnection = new protocol.Connection(dcpConfig.portal, idKs);
  const response = await portalConnection.request('viewKeystores', {});
  const { payload, success } = await portalConnection.request('viewKeystores', {});

  if (!success)
    throw new HttpError('Request to viewKeystores failed');

  return payload;
}


async function deployJobDCP(req)
{
  const options = req.body;

  const bankAddress = req.body.account.address;
  const bankPassword = req.body.account.password;

  const idKeystore = await req.authorizedIdentity;
  wallet.addId(idKeystore);

  // unlock and set the banka ccount
  const accounts = await getBankAccountKeystores(idKeystore);
  const bankKs = await unlockBankAccount(accounts, bankAddress, bankPassword);
  if (bankKs === null)
    throw new HttpError(`DCP bank account ${bankAddress} not found`);
  options.bankKs = bankKs;

  const jobSpec = new JobSpec(options);
  return await jobSpec.deploy();
}

// append slices to a running job
async function addSlices(jobAddress, request)
{
  const idKs = await request.authorizedIdentity;


  // try to add slices to the job
  const jh = new JobHandle(jobAddress, idKs);

  return jh.add(request.body.sliceData);
}

// get results
async function results(jobAddress, request, range=undefined)
{
  const idKs = await request.authorizedIdentity;
  const Range = require('dcp/range-object').RangeObject;
  const MultiRange = require('dcp/range-object').MultiRangeObject;
  const SparseRange = require('dcp/range-object').SparseRangeObject;

  if (request.params.sliceNumber)
    range = new Range(parseInt(request.params.sliceNumber),parseInt(request.params.sliceNumber));

  else if (request.query.range)
  {
    if (typeof request.query.range === 'string')
      request.query.range = [request.query.range];
    const ranges = request.query.range.map((rangeStr) => {
      const [start, stop] = rangeStr.split('-');
      return new Range(parseInt(start), parseInt(stop));
    });
    range = new SparseRange(new MultiRange(ranges));
  }

  // get the status and currently completed results for the job
  const jh = new JobHandle(jobAddress, idKs);
  const jobStatus  = await jh.status();
  const jobResults = await jh.fetchResults(range);

  // respond with a nice object that contains the total slices completed and an array of them
  const response = {};
  response.totalSlices = jobStatus.totalSlices;
  response.completedSlices = jobStatus.completedSlices;
  response.activeSlices = jobStatus.activeSlices;
  response.results = jobResults;

  return response;
}

// get status
async function status(jobAddress, request)
{
  const idKs = await request.authorizedIdentity;
  const jh = new JobHandle(jobAddress, idKs);
  const jobStatus = await jh.status();

  // TODO do some sort of error checking on jobStatus

  // since all jobs submitted by the api are "open" its not really valuable for users
  // to see that their job is "running" when its completed all slices... So we'll instead
  // check to see if all the slices deployed for the job have been completed, and we'll set
  // the status to "completed"
  if (jobStatus.totalSlices === jobStatus.completedSlices)
    jobStatus.status = 'completed';

  return jobStatus;
}

// cancel a job
async function cancelJob(jobAddress, request)
{
  const idKs = await request.authorizedIdentity;
  const jh = new JobHandle(jobAddress, idKs);
  return jh.cancel(request.body.reason);
}

async function countJobs(request)
{
  const idKs = await request.authorizedIdentity;
  const jobs = await listJobs(idKs);
  return jobs.length;
}

async function listJobs(request)
{
  const idKs = await request.authorizedIdentity;
  const phemeConnection = new protocol.Connection(dcpConfig.scheduler.services.pheme.location, idKs);

  const requestPayload = {
    statuses: ['cancelled', 'corrupted', 'estimation', 'finished', 'running', 'paused', 'new']
  };

  const { success, payload } = await phemeConnection.request('listJobs', requestPayload);

  return payload;
}

/*
async function getPendingPayment(reqBody, bearer)
{
  const accounts = await getBankAccounts(reqBody, bearer);
  const bankKs = await unlockBankAccount(accounts, reqBody.account.address, reqBody.account.password);

  // Make signed message to confirm ownership of keystore
  const signedMessage = await bankKs.makeSignedMessage({ address: bankKs.address });

  const idKs = await request.authorizedIdentity;
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
*/

// auth
async function getOAuthId(bearer)
{
  return await require('./auth/bearer').getId(bearer);
}

async function getIdentity(request)
{
  const idKs = await request.authorizedIdentity;
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
exports.addSlices    = addSlices;

