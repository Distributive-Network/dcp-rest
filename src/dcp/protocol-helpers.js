/**
 * @file protocol-helpers.js
 *
 * Helpful functions for using the dcp protocol.
 *
 * @author Will Pringle <will@distributive.network>
 * @date   April 2024
 */
'use strict';

const dcpConfig   = require('dcp/dcp-config');
const Connection  = require('dcp/protocol').Connection;

/**
 * Sends a DCP request to a DCP service, then closes the connection.
 *
 * @param {String}     serviceName The name of the service
 * @param {String}     method      The operation to perform
 * @param {IdKeystore} identity    Identity Keystore
 * @param {Object}     body        The request body
 * @param {Keystore}   authKs      Optional keystore for authorization
 *
 * @returns response from the operation
 */
async function sendOnce(serviceName, method, identity, body, authKs)
{
  // get list of services on dcp; FYI this will contain non-services
  const services = {};
  for (const prop in dcpConfig)
  {
    const propObj = dcpConfig[prop];
    if (propObj?.services)
    {
      for (const name in propObj.services)
        services[name] = propObj.services[name];
    }
    else if (dcpConfig[prop]?.location)
      services[prop] = dcpConfig[prop];
  }

  const serviceLocation = services[serviceName];
  const conn = new Connection(serviceLocation, { identity });

  //const response = await conn.request(method, body);
  const message = new conn.Request({
    operation: method,
    data: body
  });

  if (authKs)
    message.authorize(authKs);

  const response = await message.send();

  conn.close();
  return response;
}

exports.sendOnce = sendOnce;

