# nodejs tests

This directory contains NodeJS tests which are ran using the
[Peter](https://gitlab.com/Distributed-Compute-Protocol/peter) testing framework. 

## Instructions to run

First, ensure you have installed the npm packages required:
- `npm ci`

Next, install `peter` - I prefer to install it globally on my system
using:
- `sudo npm i -g peter`

Finally, in order to run the tests, just execute peter specifying an
ancestor directory of the test files. For instance:
- `peter .`

## Additional notes
These tests will inherit the environment variables specified in the
`.env` file in the base directory of this repository. Notable
variables are: 
- `DCP_SCHEDULER_LOCATION`
- `API_PORT`

