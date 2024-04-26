const kvin = require('kvin');
const db = require('./db');
const webhooks = require('./webhooks/lib');
const HttpError = require('./error').HttpError;
const JobSpec   = require('./dcp/job').JobSpec;
const JobHandle = require('./dcp/job').JobHandle;
const sendOnce  = require('./dcp/protocol-helpers').sendOnce;

// dcp specific imports
const protocol = require('dcp/protocol');
const wallet = require('dcp/wallet');
const dcpConfig = require('dcp/dcp-config');

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

  if (bankAccounts.length === 0)
    throw new HttpError(`No payment accounts associated with identity ${idKs.address}`);

  return bankAccounts;
}

async function getBankAccountKeystores(idKs) 
{
  const { payload, success } = await sendOnce('portal', 'viewKeystores', idKs);

  if (!success)
    throw new HttpError('Request to viewKeystores failed');

  return payload;
}

async function deployJobDCP(req)
{
  var bankKeystore;
  const options = req.body;
  const account = req.body.account;

  const idKeystore = await req.authorizedIdentity;
  wallet.addId(idKeystore);

  // if the bank account json is passed in its entirety, don't use oauth
  if (req.body.account.json)
    bankKeystore = await new wallet.Keystore(req.body.account.json);
  else
  {
    const portalBankAccounts = await getBankAccountKeystores(idKeystore);

    function finderCmp(ks)
    {
      if (account.address)
        return wallet.Address(ks.address).eq(address);
      else if (account.label)
        return ks.label === account.label || ks.label === account.name;
      else
        throw new HttpError('No payment account information provided');
    }

    bankKeystore = portalBankAccounts.find(finderCmp);
  }

  await bankKeystore.unlock(account.password, 1000, true);

  if (!bankKeystore)
    throw new HttpError(`Cannot find a matching payment account with identity ${idKeystore.address}`);
  options.bankKs = bankKeystore;

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
  const body = {
    statuses: ['cancelled', 'corrupted', 'estimation', 'finished', 'running', 'paused', 'new']
  };
  const { success, payload } = await sendOnce('pheme', 'listJobs', idKs, body);

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
  const response = await sendOnce('portal', 'getUserInfo', idKs);
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

