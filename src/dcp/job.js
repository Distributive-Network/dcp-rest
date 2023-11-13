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
const workFunctionTransformer = require('../work-function');
const webhooks = require('../webhooks/lib');

const protocol = require('dcp/protocol');
const compute  = require('dcp/compute');
const wallet   = require('dcp/compute');

class JobSpec
{
  #jobRef;

  constructor(options)
  {
    debugger;
    // validate work function and transform it if required
    const work = workFunctionTransformer.setup(options.work);
    this.workFunction = work.workFunction;
    const additionalRequires = work.requires || [];

    // use the this.#jobRef variable to store a reference to job
    const job = compute.for(options.slices, this.workFunction, options.args);
    this.#jobRef = job;
    job.computeGroups = options.computeGroups || job.computeGroups;
    job.requirements  = options.requirements  || [];
    job.public        = options.public        || { name: 'Restfully helping make the world smarter' };

    // webhook: TODO drop this functionality later
    if (options.webHookUrls)
    {
      // TODO check if webHookUrls is empty
      this.appIdPromise = webhooks.setJobWebhookServers(options.webHookUrls);
      this.appidPromise.then((appId) => {
        return webhooks.getDcpRDSUrl(appId);
      }).then((joburl) => {
        job.setResultStorage(new URL(jobUrl), {});
      });
    }

    // add requirements to the job TODO: clean this up
    var jobRequires = options.packages || [];
    jobRequires = jobRequires.concat(additionalRequires);

    if ((options.packages && options.packages.length > 0) || (additionalRequires && additionalRequires.length > 0))
      job.requires(jobRequires);

    // set slice payment offer
    this.slicePaymentOffer = options.slicePaymentOffer || compute.marketValue;
    job.setPaymentAccountKeystore(options.bankKs);
  }

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

exports.JobSpec = JobSpec;

