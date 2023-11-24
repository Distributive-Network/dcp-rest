/**
 ***XXX *** XXX TODO WARNING TODO XXX *** XXX ***
 *
 * The following code is only for demo purposes
 * and will not hold up in a production environment.
 * It is just put in place temporarily to provide
 * a good enough "database" to use for a demo.
 *
 */


// TODO error handling, this always assumes happy path

const sqlite3 = require('sqlite3').verbose();

// Create a new database or connect to an existing one
async function connect()
{
  let db = undefined;
  const dbPromise = new Promise((resolve, reject) => {
    db = new sqlite3.Database(process.env.SQLITE3_DB, (err) => {
      if (err) {
        reject(err.message);
      }
      resolve();
    });
  });
  await dbPromise;
  return db;
}

// Inserting data
/*
let stmt = db.prepare("INSERT INTO user VALUES (?, ?)");
stmt.run([1, "Alice"]);
stmt.run([2, "Bob"]);
stmt.finalize();
*/

// Querying data
function query(db, queryString)
{
  const dbPromise = new Promise((resolve, reject) => {
    db.each(queryString, (err, row) => {
      if (err) {
        reject(err.message);
      }
      resolve(row);
    });
  }).catch((e) => {
    console.log(e);
  });
  return dbPromise;
}

// Close the database connection
async function close(db)
{
  const dbPromise = new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err.message);
      }
      resolve();
    });
  });
  await dbPromise;
}


async function getKeystore(apiKey)
{
  const db = await connect();

  // XXX TODO XXX TODO WARNING - SQL INJECTION TODO XXX TODO XXX
  const row = await query(db, `SELECT keystore FROM users where key="${apiKey}"`);

  close(db); // don't await, just kick off the promise

  return row.keystore;
}

async function addJobIdAppId(jobId, appId)
{
  const db = await connect();
  let stmt = db.prepare("INSERT INTO jobs VALUES (?, ?)");

  stmt.run([appId, jobId]);
  stmt.finalize();

  close(db); // don't await, just kick off the promise
}

async function addWebhook(appId, servers)
{
  const db = await connect();

  let stmt = db.prepare("INSERT INTO webhooks VALUES (?, ?)");
  for (const server of servers)
    stmt.run([appId, server]);
  stmt.finalize();

  close(db); // don't await, just kick off the promise
}

async function addApiKey(randomString, keystore, email)
{
  // Create a new database or connect to an existing one
  let db = await connect();

  // Inserting data
  let stmt = db.prepare("INSERT INTO users VALUES (?, ?, ?)");
  stmt.run([email, randomString, keystore]);
  stmt.finalize();

  // Close the database connection
  close(db); 
}

exports.getKeystore   = getKeystore;
exports.addJobIdAppId = addJobIdAppId;
exports.addWebhook    = addWebhook;
exports.createKey     = addApiKey;

