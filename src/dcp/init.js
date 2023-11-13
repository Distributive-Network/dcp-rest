/**
 * @file init.js
 *
 * Initialization code for dcp-client and enviornment variables.
 *
 * @author Will Pringle <will@distributive.network>
 * @date November 2023
 */

'use strict';

const { config } = require('dotenv');
const { expand } = require('dotenv-expand');

const dcpClient = require('dcp-client');
const path = require('path');

function loadEnvironmentVariables()
{
  expand(config());
  expand(
    config({
      path: path.resolve(process.cwd(), '.env'),
      override: true,
    })
  );
}

/**
 * Initializes dcp client, must call this before any dcp related code.
 */
function initialize()
{
  loadEnvironmentVariables();
  const SCHEDULER_URL = new URL(process.env.SCHEDULER_HREF);

  // return promoise to init dcpClient
  return dcpClient.init(SCHEDULER_URL);
}

exports.init = initialize;

