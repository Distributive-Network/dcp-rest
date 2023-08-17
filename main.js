#!/usr/bin/env node

const dcp = require('./dcp');

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
/**
 * TODO: it would be AWESOME if I could say which slices have not been returned yet
 * TODO: should probably accept sliceNumber array or range to return specific data
 * or paginated data. 
 */
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

dcp.init().then(() => app.listen(1234));

