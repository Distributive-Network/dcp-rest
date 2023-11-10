const { config } = require('dotenv');
const { expand } = require('dotenv-expand');

const dcp = require('./dcp');
const path = require('path');
const express = require('express');

const port = 1234;

expand(config());
expand(
  config({
    path: path.resolve(process.cwd(), ".env"),
    override: true,
  })
);

const router = express.Router();

router.post('/job', async (req, res, next) => {
  try {
    const jobId = await dcp.deployJobDCP(req.body, req.headers.authorization);
    res.send(jobId);
  } catch (error) {
    next(error); // Forward the error to your error-handling middleware
  }
});

// return job results
router.get('/job/:id/result', async (req, res, next) => {
  const jobAddress = req.params.id;
  try {
    const results = await dcp.results(jobAddress, req.headers.authorization);
    res.send(results);
  } catch (error) {
    console.log(error);
    res.status(error.status);
    next(error);
  }
});

// job status
router.get('/job/:id/status', async (req, res) => {
  const jobAddress = req.params.id;
  const jobStatus = await dcp.status(jobAddress, req.headers.authorization);
  res.send(jobStatus);
});

// cancel a job
router.delete('/job/:id', async (req, res) => {
  const jobAddress = req.params.id;
  const jobCancellation = await dcp.cancelJob(jobAddress, req.body, req.headers.authorization) 
  res.send(jobCancellation);
});

// lists all jobs owned by the requesting identity
router.get('/jobs', async (req, res) => {
  const jobList = await dcp.listJobs(req.headers.authorization);
  res.send(jobList);
});

// returns a number of all the jobs that have been deployed
router.get('/jobs/count', async (req, res) => {
  const jobNum = await dcp.countJobs(req.headers.authorization);
  res.send({jobCount: jobNum});
});

// returns all bank accounts associated with identity
router.get('/accounts', async (req, res) => {
  res.send(await dcp.getAccounts({}, req.headers.authorization));
});

// point to where you can generate the locksmith stuff
router.get('/', (req, res) => {
  res.send(`Generate an API token here: ${process.env.LOCKSMITH_URL}`);
});

module.exports.router = router;
module.exports.dcpInit = dcp.init;

