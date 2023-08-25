#!/usr/bin/env node

const dcp = require('./dcp');
const path = require('path');
const express = require('express');

const body             = require('express-validator').body;
const validationResult = require('express-validator').validationResult;

const app = express();
app.use(express.json());

// generic validator
function validate(req, res, next)
{
  const errors = validationResult(req);
  console.log(errors);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

// submit a job
function jobValidationRules ()
{
  return [
    body('slices').exists().withMessage('One of these must exist: slices.array, slices.range, or slices.remoteDataSet.'),
    body('work').exists().withMessage('Need to send both work.function and work.function.'),
    body('args').optional().isArray().withMessage('args must be an array'),
    body('account').exists().withMessage('Need to send an account.address and optionally account.password if it has one'),
  ];
}

app.post('/job', jobValidationRules(), validate, async (req, res) => {
  var jobAddress;
  try {
    jobAddress = await dcp.deployJobDCP(req.body, req.headers.authorization);
  }
  catch (error){
    res.status(400);
    res.send(error.message);
  }

  res.send(jobAddress);
});

// return job results
app.get('/job/:id/result', async (req, res) => {
  const jobAddress = req.params.id;
  const results = await dcp.results(jobAddress, req.headers.authorization);
  res.send(results);
});

// job status
app.get('/job/:id/status', async (req, res) => {
  const jobAddress = req.params.id;
  const jobStatus = await dcp.status(jobAddress, req.headers.authorization);
  res.send(jobStatus);
});

// cancel a job
app.delete('/job/:id', async (req, res) => {
  const jobAddress = req.params.id;
  const jobCancellation = await dcp.cancelJob(jobAddress, req.body, req.headers.authorization) 
  res.send(jobCancellation);
});

app.get('/jobs', async (req, res) => {
  const jobList = await dcp.listJobs(req.body, req.headers.authorization);
  res.send(jobList);
});

app.get('/jobs/count', async (req, res) => {
  const jobList = await dcp.countJobs(req.headers.authorization);
  res.send(jobList);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, './index.html'));
});

app.get('/accounts', async (req, res) => {
  res.send(await dcp.getAccounts({}, req.headers.authorization));
});

app.get('/identity', async (req, res) => {
  res.send(await dcp.getIdentity(req.headers.authorization));
});

app.get('/kube', async (req, res) => {
  res.sendFile(path.join(__dirname, './kube.html'));
});

dcp.init().then(() => app.listen(1234));

