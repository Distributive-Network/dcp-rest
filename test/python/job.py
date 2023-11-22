#!/usr/bin/env pytest
"""
Tests deploying and managing jobs.

This test expects there to be a running worker to compute the jobs
quickly. As a result, these tests can't target production since they
will take too long to execute.

Run with -vs for more verbose output.
Generate new API_KEY in locksmith and set API_KEY equal to it.
Generate a passwordless bank account with DCCs in it and set ACCOUNT.
"""

ACCOUNT='0x10A5C517c7F7A3bEDfFD574bDcFFEbCa0Ac0EbD5'
API_KEY='236414f26fe26b6459aa.13Z6_GlQQj7REYkM_ivaIsEkt70WeM_2kBZBNngVowU'
API_URL='http://bestia.office.distributive.network/api'
HEADERS = {
    'Authorization': f'Bearer {API_KEY}',
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
            'address': f'{ACCOUNT}',
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
        '(datum) => { progress(); return datum *2; }',
    )
    resp = deploy_job(job)

    # check if the status is "created"
    assert resp.status_code == 201

    # check that a 40 digit long hex code was returned as a jobId in the response
    job_id = resp.json()["jobId"]

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
        '(datum) => { progress(); return datum *2; }',
    )
    resp = deploy_job(job)
    job_id = resp.json()["jobId"]

    # make status request
    url = f'{API_URL}/job/{job_id}/status'
    resp = requests.get(url, headers=HEADERS)

    # check the status
    assert resp.status_code == 200

    # check if the response body has required fields
    print(resp.json())



