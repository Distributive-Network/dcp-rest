#!/usr/bin/env node

const express = require('express');
const path = require('path');
const http = require('http');
const app = express();

const OpenApiValidator = require('express-openapi-validator');

const routes = require('./src/main').router;
const dcpInit = require('./src/main').dcpInit;

app.use(express.json());
app.use(express.text());
app.use(express.urlencoded({ extended: false }));

// server openAPI spec at /spec and use it to validate requests
const spec = path.join(__dirname, 'spec.yaml');
app.use('/spec', express.static(spec));

app.use(
  OpenApiValidator.middleware({
    apiSpec: './spec.yaml',
    validateResponses: true, // <-- to validate responses
  }),
);

// routes
app.use('/', routes);

// errors
app.use((err, req, res, next) => {
  console.error(err); // dump error to console for debug
  res.status(err.status || 500).json({
    message: err.message,
    errors: err.errors,
  });
});


dcpInit().then(() => {
  console.log("api @ http://localhost:1234");
  http.createServer(app).listen(1234);
});

