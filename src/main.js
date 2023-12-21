/**
 * @file main.js
 *
 * DCP API Routes.
 *
 * @author Will Pringle <will@distributive.network>
 * @date November 2023
 */

'use strict';
const { config } = require('dotenv');
const { expand } = require('dotenv-expand');
const crypto = require('crypto');

const dcp = require('./dcp');
const auth = require('./auth');
const path = require('path');
const express = require('express');

const db = require('./db');

expand(config());
expand(
  config({
    path: path.resolve(process.cwd(), '.env'),
    override: true,
  })
);

const router = express.Router();
router.use(auth.middleWare);

router.post('/job', async (req, res, next) => {
  try
  {
    const jobId = await dcp.deployJobDCP(req);
    res.status(201).send({ jobId: jobId });
  }
  catch (error)
  {
    next(error); // Forward the error to your error-handling middleware
  }
});

// add slices to a running job
router.post('/job/:id/slices', async (req, res) => {
  const jobAddress = req.params.id;

  try
  {
    const addResponse = await dcp.addSlices(jobAddress, req);
    res.status(201).send(addResponse);
  }
  catch (error)
  {
    console.log(error);
    res.status(502).send("why");
  }
});

// return job results
router.get('/job/:id/result', async (req, res, next) => {
  const jobAddress = req.params.id;
  const ranges = req.query.range;
  const ignoreFetchFailure = req.query.ignoreFetchFailure === 'true';
  try
  {
    const results = await dcp.results(jobAddress, req);
    res.send(results);
  }
  catch (error)
  {
    console.log(error);
    res.status(error.status);
    next(error);
  }
});

router.get('/job/:id/result/:sliceNumber', async (req, res, next) => {
  const jobAddress = req.params.id;
  const sliceNumber = req.params.sliceNumber;
  try
  {
    const results = await dcp.results(jobAddress, req);
    res.send(results);
  }
  catch (error)
  {
    console.log(error);
    res.status(error.status);
    next(error);
  }
});

// job status
router.get('/job/:id', async (req, res) => {
  const jobAddress = req.params.id;
  const jobStatus = await dcp.status(jobAddress, req);
  res.send(jobStatus);
});

// cancel a job
router.delete('/job/:id', async (req, res) => {
  const jobAddress = req.params.id;
  const jobCancellation = await dcp.cancelJob(jobAddress, req) 
  res.status(204).send(jobCancellation);
});

// lists all jobs owned by the requesting identity
router.get('/jobs', async (req, res) => {
  const jobList = await dcp.listJobs(req);
  res.send(jobList);
});

// returns a number of all the jobs that have been deployed
router.get('/jobs/count', async (req, res) => {
  const jobNum = await dcp.countJobs(req);
  res.send({ jobCount: jobNum });
});

// returns all bank accounts associated with identity
router.get('/accounts', async (req, res) => {
  res.send(await dcp.getAccounts(req));
});

// TODO: deprecate this endpoint
// create an api key with an identity keystore... This is useful for the node oauth shim
// It's unusual for an api to allow the creation of api keys, but whatever...
const unAuthorizedRouter = express.Router(); // add a new router for routes that don't need to be authed
unAuthorizedRouter.post('/key', async (req, res) => {
  const keystore = req.body.keystore;
  const password = req.body.token;
  const email    = req.body.email;

  console.log(keystore);
  console.log(password);

  function generateRandomString(length) {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
  }
  const apiKey = generateRandomString(20);

  await db.createKey(apiKey, keystore, email);

  res.send({ key: `${apiKey}.${password}` });
});

module.exports.router = router;
module.exports.unAuthorizedRouter = unAuthorizedRouter;

