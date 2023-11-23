#!/usr/bin/env bash

npx @redocly/cli build-docs spec.yaml 
mv redoc-static.html public/docs.html

