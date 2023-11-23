#!/usr/bin/env bash

npx @redocly/cli build-docs spec.yaml 

# change colour to match theme
sed 's/#263238/#1aa473/g' redoc-static.html  > public/docs.html

# add a header to the file
sed -i '/<\/head>/i\
<div style="background-color: #1aa473; text-align: center; padding: 10px;">\
    <a href="index.html" style="color: white; text-decoration: none; font-weight: bold;">Restful DCP</a>\
</div>' public/docs.html

rm redoc-static.html

