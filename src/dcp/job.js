/**
 * @file job.js
 *
 * Class to help manage and define jobs.
 *
 * @author Will Pringle <will@distributive.network>
 * @date November 2023
 */

'use strict';

const HttpError = require('../error').HttpError;
const workFunctionTransformer = require('./work-function');
const webhooks = require('../webhooks/lib');

const compute        = require('dcp/compute');
const dcpConfig      = require('dcp/dcp-config');
const protocol       = require('dcp/protocol');
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
    // validate work function and transform it if required
    const work = workFunctionTransformer.setup(options.work);
    this.workFunction = work.workFunction;
    const additionalRequires = work.requires || [];

    // use the this.#jobRef variable to store a reference to job
    const job = compute.for(options.slices || [], this.workFunction, options.args);
    this.#jobRef = job;
    job.computeGroups = options.computeGroups || job.computeGroups;
    job.requirements  = options.requirements  || [];
    job.public        = options.public        || { name: 'Restfully helping make the world smarter' };
    job.autoClose     = false; // all jobs deployed by dcp-rest are open by default.

    // webhook: TODO drop this functionality later
    if (options.webHookUrls)
    {
      // TODO check if webHookUrls is empty
      this.appIdPromise = webhooks.setJobWebhookServers(options.webHookUrls);
      this.appidPromise.then((appId) => {
        return webhooks.getDcpRDSUrl(appId);
      }).then((jobUrl) => {
        job.setResultStorage(new URL(jobUrl), {});
      });
    }

    // add requirements to the job TODO: clean this up
    let jobRequires = options.packages || [];
    jobRequires = jobRequires.concat(additionalRequires);

    if ((options.packages && options.packages.length > 0) || (additionalRequires && additionalRequires.length > 0))
      job.requires(jobRequires);

    // set slice payment offer
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

      this.#jobRef.on('readystatechange', (state) => {
        if (this.#jobRef.id !== null)
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
    // check if the job exists
    // TODO check if the job exists before doing anything... whats the easiest way to do that?

    this.address    = new wallet.Address(jobId);
    this.idKs       = idKeystore;

    // connections - TODO wrap connections in generic getter that will automatically reconnect if they're down
    this.phemeConnection           = new protocol.Connection(dcpConfig.scheduler.services.pheme.location,           this.idKs);
    this.resultSubmitterConnection = new protocol.Connection(dcpConfig.scheduler.services.resultSubmitter.location, this.idKs);
    this.jobSubmitConnection       = new protocol.Connection(dcpConfig.scheduler.services.jobSubmit.location,       this.idKs);
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
  add(newSlices)
  {
    return addSlices(newSlices, this.address);
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
      operation: 'fetchResult',
      data: {
        job: this.address,
        owner: this.idKs.address,
        range,
      }
    };

    const request = new this.resultSubmitterConnection.Request(body, this.idKs);
    const { success, payload } = await this.resultSubmitterConnection.send(request);

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
      operation: 'fetchJobReport',
      data: {
        job:      this.address,
        jobOwner: this.#identityAddress,
      }
    };

    const request = new this.phemeConnection.Request(body, this.idKs);
    const { success, payload } = await this.phemeConnection.send(request);

    if (!success)
      throw new HttpError(`Request to fetchJobReport failed for job ${this.address}`);
    return payload;
  }

  /**
   * Cancels a job.
   */
  async cancel(reason)
  {
    const { success, payload } = await this.jobSubmitConnection.request('cancelJob', {
      job: this.address,
      reason,
    }, this.idKs);

    if (!success)
      throw new HttpError(`Unable to cancel job ${this.address}`);

    return payload;
  }
}

exports.JobSpec = JobSpec;
exports.JobHandle = JobHandle;

