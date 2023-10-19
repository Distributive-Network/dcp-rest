#!/usr/bin/env bash

set -o allexport
source .env set
set +o allexport

# compile go project
echo "Compiling Go project"
cd $WEBHOOK_REPOSTER_DIR
go build
cd -

# run project
echo "Running go project"
$WEBHOOK_REPOSTER_DIR/reposter

