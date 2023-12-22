# Restful DCP (`dcp-rest`)
A Restful HTTP API wrapper for common [dcp-client](https://www.npmjs.com/package/dcp-client) operations.

This is a flexible api that will allow you to manage jobs deployed from bifrost or dcp-client as well as provide a rich experience for deploying jobs itself.

## Endpoints
### Deploying a Job to dcp
Deploy jobs to DCP. Full language support with libraries for Python and R is coming soon.
Path: `/job`
Method: `POST`

Example request body:
```json
{
	"slices": [1,2,3,4,5,6,7,8,9,10],
	"work": {
		"language": "js",
		"function": "(datum) => { return datum * 2; }"
	},
	"account": {
		"address": "94E619279C5780fF20ECe07fAA719e3D66111A88"
	}
}
```

### Upload data for your Job to work on
In `dcp-rest`, every job is an "open job", which means you can add slices to be computed anytime after deploying - in fact, you can even omit the `slices` property of the request body in the example above and opt to add them later or in batches if you prefer.

Path: `/job/{jobId}/slices`
Method: `POST`

### Getting results
Download your currently computed results.
Path: `/job/[id]/result`
Method: `GET`

Example request:
```
/api/v0/job/$JOBID/result?range=1-10&range=33-35
```
*^ Will return the results for slices 1 to 10 and 33 to 35*

### Job Status
Path: `/job/[id]/status`
Method: `GET`

### Forcefully kill a running Job
Stop a job from completing mid execution. 
Path: `/job/{jobId}`
Method: `DELETE`

### List your bank keystores on DCP
List the bank accounts associated with your identity.
Path: `/accounts`
Method: `GET`

## Auth
`dcp-rest` uses two types of authorization and authentication:
1. Bearer token API keys (not yet implemented)
2. Basic tokens comprising of an id keystore and id keystore password

### Basic Auth
Note: in order to get the best experience with `dcp-rest`, please use an identity keystore which is a proxy to your DCP portal account. This is not required for most of the endpoints, but is used for deploying jobs and listing user bank accounts. <TODO: make a website that generates them and link it here> 

Here is an example of generating a token in JavaScript:
```js
const idKeystore = wallet.getId();
const idKeystoreJSON = `${JSON.stringify(idKeystore.toJSON())}`;
const idKeystorePass = 'myepicpassw0rd'

const token = `Basic ${btoa(idKeystoreJSON + ':' + idKeystorePass)}`;
```
**Important Note**: DCP does not have a solid "identity"/"auth" underlying implementation yet (but will sometime soon). This means you must use the exact same id keystore to manage a job as you did to deploy it.

## Try it out!
```
docker build -t dcp-rest .
docker run -p 1234:1234 dcp-rest
```

## Roadmap
Primary items on the roadmap
- create an oauth app for api key generation
- add better error handling and error responses
- add support for Python and R in work functions (Python will be easy / might work already)

