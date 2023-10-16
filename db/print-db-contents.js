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

// Querying data
db.each("SELECT email, token, keystore FROM users", (err, row) => {
    if (err) {
        console.error(err.message);
    }
    console.log(row);
});


// Close the database connection
db.close((err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Closed the database connection.');
});
