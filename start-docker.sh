#!/usr/bin/env bash

docker build -t dcp-rest .
docker run -p 1234:1234 -d dcp-rest

