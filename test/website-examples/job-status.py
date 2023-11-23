#!/usr/bin/env python3

API_KEY='236414f26fe26b6459aa.13Z6_GlQQj7REYkM_ivaIsEkt70WeM_2kBZBNngVowU'
API_URL='http://bestia.office.distributive.network/api'

import requests

job_id = '0x921A3D2ACF9926a4e199F56F405C2bEE6F208e4d'

headers = {
    'Authorization': 'Bearer ' + API_KEY 
}

response = requests.get(f'{API_URL}/job/{job_id}/status', headers=headers)

print(response)

