const dcp = require('dcp-client');
const SCHEDULER_URL = new URL('https://scheduler.distributed.computer');

function init()
{
  return dcp.init(SCHEDULER_URL);
}

// creates a job and parses body into compute.for args
function computeFor(reqBody)
{
  const compute = require('dcp/compute');

  // slice data
  const data = reqBody.slices;

  // work function
  const workFunction = reqBody.work.function;

  // call compute.for
  const job = compute.for(data, workFunction, reqBody.args);

  // job api
  job.computeGroups = reqBody.computeGroups || job.computeGroups;
  job.requirements  = reqBody.requirements  || [];
  job.public        = reqBody.public        || {};
  job.requires      = reqBody.requires      || [];

  return job
}

async function deployJobDCP(reqBody)
{
  const compute = require('dcp/compute');
  const wallet = require('dcp/wallet');

  const job = computeFor(reqBody);

  var slicePaymentOffer = compute.marketValue;
  if (typeof reqBody.slicePaymentOffer === 'number')
    slicePaymentOffer = reqBody.slicePaymentOffer;

  // TODO: auth / keystore
  const ks = await wallet.get();
  job.setPaymentAccountKeystore(ks);

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
async function results(jobAddress)
{
  const utils = require('dcp/utils');
  const dcpConfig = require('dcp/dcp-config');
  const protocol = require('dcp/protocol');
  const wallet = require('dcp/wallet');

  // TODO: auth / keystore
  const ks = await wallet.get();

  const conn = new protocol.Connection(dcpConfig.scheduler.services.resultSubmitter.location, ks);

  const { success, payload } = await conn.send('fetchResult', {
    job: jobAddress,
    owner: (await wallet.get()).address,
  },  await wallet.get());

  console.log(payload);

  return payload;
}

// exports
exports.deployJobDCP = deployJobDCP;
exports.results      = results;
exports.init         = init;

