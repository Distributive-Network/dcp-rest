#!/usr/bin/env python3

ACCOUNT='0x10A5C517c7F7A3bEDfFD574bDcFFEbCa0Ac0EbD5'
ACCOUNT_PASSWORD=''
API_KEY='236414f26fe26b6459aa.13Z6_GlQQj7REYkM_ivaIsEkt70WeM_2kBZBNngVowU'
API_URL='http://bestia.office.distributive.network/api'

import requests

data = {
    "slices": [1,2,3,4,5,6],
    "work": {
        "function": "(datum) => { progress(); return datum * 2; }",
        "language": "JavaScript",
    },
    "account": {
        "address": ACCOUNT,
        "password": ACCOUNT_PASSWORD, 
    }
}

headers = {
    'Authorization': 'Bearer ' + API_KEY 
}

response = requests.post(f"{API_URL}/job", json=data, headers=headers)

print(response.json()) # { "jobId": "0x1234512345123451234512345123451234512345" }

