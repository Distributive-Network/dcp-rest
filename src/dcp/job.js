/**
 * @file job.js
 *
 * Classes to help manage and define jobs.
 *
 * @author Will Pringle <will@distributive.network>
 * @date November 2023
 */

'use strict';

const kvin = require('kvin');

const HttpError = require('../error').HttpError;
const worktimes = require('./worktime-setup');
const sendOnce  = require('./protocol-helpers').sendOnce;
const webhooks = require('../webhooks/lib');

const compute        = require('dcp/compute');
const dcpConfig      = require('dcp/dcp-config');
const wallet         = require('dcp/wallet');
const addSlices      = require('dcp/job').addSlices;
const fetchResults   = require('dcp/job').fetchResults;
const rehydrateRange = require('dcp/range-object').rehydrateRange;
const fetchURI       = require('dcp/utils').fetchURI;

/**
 * Specifies a job and contains a deploy method.
 */
class JobSpec
{
  #jobRef;

  /**
   * Constructor.
   * @constructor
   * @param {object} optons - an options object
   */
  constructor(options)
  {
    // shape the job into something which matches the worktime
    const workSpec = worktimes.setup(options); // needs options.work and options.args
    this.workFunction  = workSpec.function;
    const jobArgs      = workSpec.args;
    const jobPackages  = (workSpec.packages || []).concat(options.packages || []);
    const jobWorktime  = workSpec.worktime;

    // use the this.#jobRef variable to store a reference to job
    const job = compute.for(options.slices || [], this.workFunction, options.args);
    this.#jobRef = job;
    job.computeGroups = options.computeGroups || job.computeGroups;
    job.requirements  = options.requirements  || [];
    job.public        = options.public        || { name: 'Restfully helping make the world smarter' };
    job.autoClose     = false; // all jobs deployed by dcp-rest are open by default.

    if (jobWorktime)
    {
      if (jobWorktime.name) job.worktime        = jobWorktime.name;
      if (jobWorktime.name) job.worktimeVersion = jobWorktime.version;
      if (jobWorktime.name) job.customWorktime  = jobWorktime.custom;
    }

    // webhook: TODO drop this functionality later
    if (options.webHookUrls)
    {
      throw new HttpError("WebHooks are no longer supported in dcp-rest");
/*
      // TODO check if webHookUrls is empty
      this.appIdPromise = webhooks.setJobWebhookServers(options.webHookUrls);
      this.appidPromise.then((appId) => {
        return webhooks.getDcpRDSUrl(appId);
      }).then((jobUrl) => {
        job.setResultStorage(new URL(jobUrl), {});
      });
*/
    }

    if (jobPackages.length > 0)
      job.requires(jobPackages);

    // set slice payment offer
    if (options.slicePaymentOffer === 'MARKET_VALUE')
      this.slicePaymentOffer = compute.marketValue;
    else
      this.slicePaymentOffer = options.slicePaymentOffer || compute.marketValue;

    job.setPaymentAccountKeystore(options.bankKs);
  }

  /**
   * Deploys the job to dcp and returns a promise to a jobId.
   */
  async deploy()
  {
    // kick off the job and see if it gets accepted
    const jobId = await new Promise((resolve, reject) => {
      // start computing the job
      this.#jobRef.exec(this.slicePaymentOffer).catch(reject);

      // race to return the job address
      this.#jobRef.on('accepted', () => {
        console.log(`Job with id ${this.#jobRef.id} accepted by the scheduler`);
        resolve(this.#jobRef.address);
      });
    });

    // if using webhooks, associate the jobId with the appId
    if (this.appIdPromise)
    {
      const appId = await this.appIdPromise;
      await webhooks.setJobIdAppIdRelationship(jobId, appId);
    }

    return jobId;
  }
}

/**
 * Represents a handle to a running job.
 */
class JobHandle
{
  /**
   * Constructor.
   * @constructor
   * @param {string} jobId - the running job's address 
   * @param {Keystore} identityKs - unlocked proxy id keystore associated with the job
   */
  constructor(jobId, idKeystore, idPassword)
  {
    this.address    = new wallet.Address(jobId);
    this.idKs       = idKeystore;
  }

  /**
   * Gets the address associated with the identity keystore associated with the job.
   */
  get #identityAddress()
  {
    return new wallet.Address(this.idKs.address);
  }

  /**
   * Adds slices to a currently running job.
   * @param {Array} sliceData - an array of slice data to add to the job to execute
   */
  async add(newSlices)
  {
    if (!(newSlices instanceof Array))
      throw new HttpError(`${newSlices} is not an instance of an Array`);

    const body = {
      job: this.address,
      dataValues: kvin.marshal(newSlices),
    };

    const response = await sendOnce('jobSubmit', 'addSliceData', this.idKs, body);
    const { success, payload } = response;

    if (!success)
      throw new HttpError(`Failure to upload slices for job ${this.address}`);

    // delete pointless success marker
    delete payload.success;

    return payload;
  } 

  /**
   * Gets the currently completed results from a job.
   * @return {Array} results - an array of currently completed slices shaped like: [{ sliceNumber: n, value: m }...]
   */
  async fetchResults(rangeObject)
  {
    var range = rangeObject;
    const results = [];

    if (range)
      range = rehydrateRange(rangeObject);

    const body = {
      job: this.address,
      owner: this.idKs.address,
      range,
    };

    const response = await sendOnce('resultSubmitter', 'fetchResult', this.idKs, body, this.idKs);
    const { success, payload } = response;

    if (!success)
      throw new HttpError(`Cannot get results for job ${this.address.address}`);

    // fetchResults returns an array of {sliceNumber: n, value: m}, rename "slice" to "sliceNumber"
    for (const encodedResult of payload)
    {
      const result = {
        sliceNumber: encodedResult.slice,
        value: await fetchURI(decodeURIComponent(encodedResult.value)),
      };

      results.push(result);
    }

    return results;
  }

  /**
   * Gets the status of a currently running job.
   * @return {object} statusObj - object containing status information
   */
  async status()
  {
    const body = {
      job:      this.address,
      jobOwner: this.idKs.address,
    };

    const response = await sendOnce('pheme', 'fetchJobReport', this.idKs, body);

    if (!response.success)
      throw new HttpError(`Request to fetchJobReport failed for job ${this.address}`);
    return response.payload;
  }

  /**
   * Cancels a job.
   */
  async cancel(reason)
  {
    const body = {
      job: this.address,
      reason,
    };
    const response = await sendOnce('jobSubmit', 'cancelJob', this.idKs, body);

    if (!response.success)
      throw new HttpError(`Unable to cancel job ${this.address}`);

    return response.payload;
  }
}

exports.JobSpec = JobSpec;
exports.JobHandle = JobHandle;

