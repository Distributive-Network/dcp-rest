#!/usr/bin/env bash

docker build -t my-nodejs-app .

docker volume create shared-db-volume

docker run --rm -v shared-db-volume:/data -v $(pwd)/db:/backup busybox cp /backup/apidb.sqlite3 /data

docker run -p 1234:1234 -v shared-db-volume:/usr/src/app/db -d my-nodejs-app node -r dotenv/config app.js
docker run -p 3737:3737 -v shared-db-volume:/usr/src/app/db -d my-nodejs-app node -r dotenv/config locksmith/auth.js

