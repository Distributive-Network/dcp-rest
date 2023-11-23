#!/usr/bin/env bash

npx @redocly/cli build-docs spec.yaml 

# change colour to match theme
sed 's/#263238/#1aa473/g' redoc-static.html  > public/docs.html

rm redoc-static.html

