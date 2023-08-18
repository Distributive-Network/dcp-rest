# restful-dcp
REST API FOR DCP

---
API
# DCP HTTP API
The DCP HTTP API.

## Overview
This document describes the specification for the DCP HTTP API. This API is meant to serve as a replacement for, or compantion to, the `dcp-client` npm and pip package.
**Base URL:** `https://dcp.dev/api/v1`
**Authentication:** NIL (for now, hopefully `Oauth2` tokens)

## Authorization
Include this Bearer token generated by our oauth flow in your authorization headers. It can be generated at `https://distributed/compute/api`

## Endpoints
### Submitting a Job
Path: `/job`
Method: `POST`
Request Body:
- `slices` (any one of `array`, `range`, or `remoteDataSet`):
	- `array`: array of numbers, strings, or objects or a mix
	- `range`:
		- `start`: number
		- `end`: number
		- `step`: number
	- `remoteDataSet`:
		- `array`: array of strings of URLs
- `work`: 
	- `language`: string (either `JavaScript`, `Python`, `JavaScriptUseStrict`, `TypeScript`, for now)
	- `function`: string
	- `pyimports`: (optional) array of pip modules for use in python
- `args`: (optional) array of numbers, strings, or objects, or a mix
- `account`:
	- `address`: string keystore hex id
	- `password`: (optional) password for account if it needs it
- `computeGroups`: (optional) array of
	- `joinKey`: string
	- `joinSecret`: string
- `slicePaymentOffer`: (optional) string which is a decimal number or `MARKET_VALUE`
- `requirements`: (optional) array of strings
- `requires`: (optional) array of strings
- `public`: (optional)
	- `name`: string
	- `description`: string
	- `link`: string

Responses:
- `200`
	- `content`:
		- `jobAddress`: string

Example:
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

### Cancelling a Job
Path: `/job/[id]`
Method: `DELETE`
Request Body:
- `reason`: string

### Job Status
Path: `/job/[id]/status`
Method: `GET`

### Getting results
Path: `/job/[id]/result`
Method: `GET`

### Long polling for results
Path: `/job/[id]/result/wait`
Method: `GET`
Description: Makes a request doesn't respond until the results are in or the request expires / client disconnects. 
Responses:
- `200`
	- results

### Listening to the events for a job
Path: `/job/[id]/events/ws`
Method: `GET`
Description: Gets a websocket connection for job events presented as dcp protocol

Responses:
- `101`: Switching Protocols. Connection has been upgraded to a WebSocket
- `400`: Bad Request
- `403`: Forbidden
- `500`: Internal server error


