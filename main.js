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
  ];
}

app.post('/job', jobValidationRules(), validate, async (req, res) => {
  var jobAddress;
  try {
    jobAddress = await dcp.deployJobDCP(req.body);
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
 */
app.get('/job/:id/result', async (req, res) => {
  const jobAddress = req.params.id;
  const results = await dcp.results(jobAddress);
  res.send(results);
});

dcp.init().then(() => app.listen(1234));

