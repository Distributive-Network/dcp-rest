#!/usr/bin/env node
/**
 * @file app.js
 *
 * Express server entry point.
 *
 * @author Will Pringle <will@distributive.network>
 * @date November 2023
 */

'use strict';

const express = require('express');
const path = require('path');
const http = require('http');

const dcpInit = require('./src/dcp/init').init;

function setUpExpressServer()
{
  const routes = require('./src/main').router;

  const app = express();

  const OpenApiValidator = require('express-openapi-validator');


  // load environment variables
//  require('./db/load-env.js');

  app.use(express.json());
  app.use(express.text());
  app.use(express.urlencoded({ extended: false }));

  // server openAPI spec at /spec and use it to validate requests
  const spec = path.join(__dirname, 'spec.yaml');

  // routes
  app.use(express.static('public'));

  app.use('/', routes);

  app.use('/spec', express.static(spec));

  app.use(
    OpenApiValidator.middleware({
      apiSpec: './spec.yaml',
      validateResponses: true, // <-- to validate responses
    }),
  );

  // Error handling middleware for validation errors
  app.use((err, req, res, next) => {
    // If it's an OpenAPI error, format it nicely
    if (err.status === 400 && err.type === 'request.openapi.validation') 
    {
      return res.status(err.status).json({
        error: 'Bad Request',
        messages: err.errors.map(error => error.message),
      });
    }
    
    // Pass on to default error handler or other error middleware
    next(err);
  });

  // errors
  app.use((err, req, res, next) => {
    const status = err.status || 500;

    console.error(err); // Dump error to console for debug
    if (err.customMessage)
      res.status(status).send({ message: err.customMessage });

    res.status(status).send({ message: 'Internal Server Error' });
  });

  return app;
}

dcpInit().then(() => {
  console.log('api @ http://localhost:1234');
  const app = setUpExpressServer();
  http.createServer(app).listen(1234);
});

