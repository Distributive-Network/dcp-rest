require("../../db/load-env.js"); // chanmge this later - load env variables
const db = require('../db');
const crypto = require('crypto');

function getRePosterURL()
{
  return process.env.WEBHOOK_REPOSTER_URL;
}

function getDcpRDSUrl(appId)
{
  const jobUrl = `${getRePosterURL()}/job/${appId}/slice/1`; // TODO change 1
  return jobUrl;
}

async function setJobIdAppIdRelationship(jobId, appId)
{
  await db.addJobIdAppId(jobId, appId);
}

async function setJobWebhookServers(servers)
{
  const appId = crypto.randomUUID();

  // add servers to db
  await db.addWebhook(appId, servers);
  
  return appId;
}

async function deleteJobWebhookServers(jobId, servers)
{
  // TODO
}

async function addJobWebhookServers(jobId, servers)
{
  // TODO - add more servers on the fly
}

async function getJobWebhookServers(jobId) {
  // TODO - getter
}

exports.getDcpRDSUrl              = getDcpRDSUrl;
exports.getRePosterURL            = getRePosterURL;
exports.setJobIdAppIdRelationship = setJobIdAppIdRelationship;
exports.setJobWebhookServers      = setJobWebhookServers;
exports.deleteJobWebhookServers   = deleteJobWebhookServers;
exports.addJobWebhookServers      = addJobWebhookServers;
exports.getJobWebhookServers      = getJobWebhookServers;

