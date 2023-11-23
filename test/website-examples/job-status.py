#!/usr/bin/env python3

API_KEY='9bbf581794493c1de68d.g_t-PTEVeRveFLmGLVCdesSz2HOFuLheCsU9prpXhaI'
API_URL='http://bestia.office.distributive.network/api'

import requests

job_id = '0x921A3D2ACF9926a4e199F56F405C2bEE6F208e4d'

headers = {
    'Authorization': 'Bearer ' + API_KEY 
}

response = requests.get(f'{API_URL}/job/{job_id}', headers=headers)

print(response.json())

