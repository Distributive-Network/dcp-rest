#!/usr/bin/env python3

import requests
import time

def list_bank_accounts():
    url = "http://bestia.office.distributive.network/api/accounts"
    headers = {
        "Authorization": "Bearer 9ffdd4e335fb0aa87588.DjehbjdhIenIxT--TmiLwnGVQkM7PydsIey0PhBIFhs",
    }

    response = requests.get(url, headers=headers)
    print(response.json())

def make_post_request():
    url = "http://bestia.office.distributive.network/api/job"
    headers = {
        "Authorization": "Bearer 9ffdd4e335fb0aa87588.DjehbjdhIenIxT--TmiLwnGVQkM7PydsIey0PhBIFhs",
        "Content-Type": "application/json"
    }
    data = {
        "slices": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        "work": {
            "language": "js",
            "function": "(datum) => { progress(); return datum * 2; }"
        },
        "account": {
            "address": "0x10A5C517c7F7A3bEDfFD574bDcFFEbCa0Ac0EbD5"
        }
    }
    response = requests.post(url, json=data, headers=headers)
    if response.status_code == 200:
        return response.json()["jobId"]
    else:
        print("Error in POST request:", response.text)
        return None

def make_get_requests(job_address):
    headers = {
        "Authorization": "Bearer 9ffdd4e335fb0aa87588.DjehbjdhIenIxT--TmiLwnGVQkM7PydsIey0PhBIFhs"
    }

    # Check the job result
    url_result = f"http://bestia.office.distributive.network/api/job/{job_address}/result"
    response_result = requests.get(url_result, headers=headers)
    print("Job Result Status:", response_result.status_code)
    
    # Additional checks
    for endpoint in [f"/job/{job_address}/status", "/jobs", "/accounts"]:
        url = f"http://localhost:1234{endpoint}"
        response = requests.get(url, headers=headers)
        print(f"Status for {endpoint}: {response.status_code}")

# Main execution
list_bank_accounts()

job_address = make_post_request()

print(job_address)

if job_address:
    make_get_requests(job_address)

