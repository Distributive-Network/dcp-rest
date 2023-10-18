#!/usr/bin/env node
const sqlite3 = require('sqlite3').verbose();
require('./load-env');

// Create a new database or connect to an existing one
let db = new sqlite3.Database(process.env.SQLITE3_DB, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the database.');
});

// Creating a table
db.serialize(() => {
    // used for api keys
    db.run("CREATE TABLE IF NOT EXISTS users (email TEXT, token TEXT, keystore TEXT)", (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log("Table created!");
    });

    // used for webhooks
    db.run("CREATE TABLE IF NOT EXISTS jobs (appId TEXT, jobId TEXT)", (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log("Table created!");
    });
    db.run("CREATE TABLE IF NOT EXISTS webhooks (appId TEXT, url TEXT)", (err) => {
        if (err) {
            console.error(err.message);
        }
        console.log("Table created!");
    });
});

// Close the database connection
db.close((err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Closed the database connection.');
});

