#!/usr/bin/env node
const sqlite3 = require('sqlite3').verbose();
require('./load-env');

let table = 'users';
if (process.argv.length > 2)
  table = process.argv[2];

if (table === "help" || table === "--help")
{
  console.log(`usage:\n\t${process.argv[0]} ${process.argv[1]} <tablename>`);
  process.exit(1);
}

// Create a new database or connect to an existing one
let db = new sqlite3.Database(process.env.SQLITE3_DB, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the database.');
});

// Querying data
db.each(`SELECT * FROM ${table}`, (err, row) => {
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

