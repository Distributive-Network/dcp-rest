#!/usr/bin/env bash

set -o allexport
source .env set
set +o allexport

# compile go project
cd $WEBHOOK_REPOSTER_DIR
go build
cd -

# run project
$WEBHOOK_REPOSTER_DIR/webhooker

