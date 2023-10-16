const { config } = require('dotenv');
const { expand } = require('dotenv-expand');
const path = require('path');

expand(config());
expand(
  config({
    path: path.resolve(process.cwd(), ".env"),
    override: true,
  })
);

