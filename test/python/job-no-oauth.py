#!/usr/bin/env pytest
"""
Tests deploying and managing jobs.

Without using oauth / identity.

This test expects there to be a running worker to compute the jobs
quickly. As a result, these tests can't target production since they
will take too long to execute.
"""

#API_URL='https://dcp-rest.diana.distributive.network/api'
API_URL='http://localhost:1234/api/v0'
HEADERS = {
    'Authorization': 'Basic eyJ2ZXJzaW9uIjozLCJpZCI6IjcwOGM1MGRiLTZlZGMtNDYzZC1iYjQ3LTZjMzAyM2IwZDU5MyIsImFkZHJlc3MiOiIwNmUxNDllM2ZiMGE1NTljMTRjNDM5NzYxZGU4N2RiZmNmYjBiYTVmIiwiY3J5cHRvIjp7ImNpcGhlcnRleHQiOiJmOTBkOTZhZDM1YzdlOGVjMjhlNzVmYTQwMDVmOTI5YTlmYmM5MmQxZTA2ZDYyNzU1YzAwYmMzZjc5OWUwNWYxIiwiY2lwaGVycGFyYW1zIjp7Iml2IjoiZTdiNjY5YjY3NzNhODEyOTE2OTkwNzE0ZDgzM2JlMTIifSwiY2lwaGVyIjoiYWVzLTEyOC1jdHIiLCJrZGYiOiJzY3J5cHQiLCJrZGZwYXJhbXMiOnsiZGtsZW4iOjMyLCJzYWx0IjoiMzYwNmQxMDllM2ZmMzNhYjA5NDY2ODcxYmNhY2U4MGI4NTdmNGMxMDE4OGE0YzhkM2I0MjM3OWRmMjliNzA2ZiIsIm4iOjEwMjQsInIiOjgsInAiOjF9LCJtYWMiOiIzMGM2ZmZhNzdhZWZlYWI4ZWVmNjdiNjg4YzE2ZmE0OWM5NzZlMjFmMmFkZmVmMGRjNmM5MGQ4MzY5OWYzZWI1In0sInRpbWVzdGFtcCI6IldlZCBNYXIgMjAgMjAyNCAwOToxNTo0NSBHTVQtMDQwMCAoRWFzdGVybiBEYXlsaWdodCBTYXZpbmcgVGltZSkifTo=',
}

import requests

# helper functions

def compute_for(slices, workLanguage, workFunction):
    job = {
        'slices': slices,
        'work': {
            'language': workLanguage,
            'function': workFunction, 
        },
        'account': {
		    "json": {"address":"0x6db720Ec2e7DB70737Cf0CC6986711e653a25E71","crypto":{"ciphertext":"43a8dc28fd6c3a571ec719b6ca86100ccd5e128431fc34dbc1d80875b3bf7aa2","cipherparams":{"iv":"2cbd4e1db754b4839741138d4b33c5a1"},"cipher":"aes-128-ctr","kdf":"scrypt","kdfparams":{"dklen":32,"salt":"be5a8db9714f86146f4f03322d43b182c4faaba1cd95680ffca94ea5b6648419","n":1024,"r":8,"p":1},"mac":"9e4ffb60a33d57db3d25e6b8077afd53a8b194bb68c6b38b90205c53c4d62470"},"version":3},
            "password": ""
        }
    }

    return job

def deploy_job(job):
    url = f'{API_URL}/job/'
    return requests.post(url, json=job, headers=HEADERS)


# tests

def test_job_deploy():
    # deploy a simple job
    job = compute_for(
        [1,2,3,4,5],
        'js', 
        '(datum) => { progress(); return datum * 2; }',
    )
    resp = deploy_job(job)

    # check if the status is "created"
    assert resp.status_code == 201

    # check that a 40 digit long hex code was returned as a jobId in the response
    job_id = resp.json()['jobId']

    def is_hex(s):
        try:
            int(s, 16)
            return True
        except ValueError:
            return False

    assert is_hex(job_id)
    assert len(job_id) == 40 or len(job_id) == 42

def test_job_status():
    # deploy job
    job = compute_for(
        [1,2,3,4,5],
        'js', 
        '(datum) => { progress(); return datum * 2; }',
    )
    resp = deploy_job(job)
    job_id = resp.json()["jobId"]

    # make status request
    url = f'{API_URL}/job/{job_id}'
    resp = requests.get(url, headers=HEADERS)

    # check the status
    assert resp.status_code == 200

    # check if the number of total slices is correct
    assert resp.json()['totalSlices'] == 5

def test_job_cancel():
    # deploy job
    job = compute_for(
        [1,2,3,4,5],
        'js',
        '(datum) => { progress(); return datum * 2; }',
    )
    resp = deploy_job(job)
    job_id = resp.json()["jobId"]

    # cancel the job
    url = f'{API_URL}/job/{job_id}'
    resp = requests.delete(url, headers=HEADERS)

    # check the status
    assert resp.status_code == 204

    # check if the status is cancelled
    url = f'{API_URL}/job/{job_id}'
    resp = requests.get(url, headers=HEADERS)

    # check if the number of total slices is correct
    assert resp.json()['status'] == 'cancelled'

def test_job_result():
    # deploy job
    job = compute_for(
        [1,2,3,4,5],
        'js',
        '(datum) => { progress(); return datum * 2; }',
    )
    resp = deploy_job(job)
    job_id = resp.json()["jobId"]

    # get the results completed so far
    url = f'{API_URL}/job/{job_id}/result'
    resp = requests.get(url, headers=HEADERS)

    # check the status
    assert resp.status_code == 200 

    # check if a results array was returned
    slices = resp.json()['results']
    assert type(slices).__name__ == 'list'

def test_job_addslc():
    # deploy job
    job = compute_for(
        [1,2,3,4,5],
        'js',
        '(datum) => { progress(); return datum * 2; }',
    )
    resp = deploy_job(job)
    job_id = resp.json()["jobId"]

    # add 3 slices to the job
    url = f'{API_URL}/job/{job_id}/slices'
    data = {
        'sliceData': [100,200,300],
    }
    resp = requests.post(url, json=data, headers=HEADERS)

    # check the status
    assert resp.status_code == 201

    # check if the total slices is 5 + 3
    url = f'{API_URL}/job/{job_id}'
    resp = requests.get(url, headers=HEADERS)

    assert resp.json()['totalSlices'] == 5 + 3

