import requests
import os
import json

API_URL="http://localhost:1234/"

class WorkFunction:
  def __init__(self, code, language="python", imports=[]):
    self.code = code
    self.language = language
    self.imports = imports

  def __str__(self):
    return self.code

class Job:
  def __init__(self, slices, workFunction: WorkFunction, address=None):
    self.requires = ['pyodide-core/pyodide-core.js']
    self.slices = slices
    self.workFunction = workFunction
    self.address = address

    self.results = []
    self.state = "IN_PROGRESS"

  def status(self):
    headers = {
        'Authorization': 'Bearer ' + os.environ.get('DCP_BEARER')
    }
    response = requests.get(f"{os.environ.get('DCP_API_URL')}job/{self.address}/status", headers=headers)
    data = response.json()

    self.state = data['status']

    return data

  def result(self):
    headers = {
        'Authorization': 'Bearer ' + os.environ.get('DCP_BEARER')
    }
    response = requests.get(f"{os.environ.get('DCP_API_URL')}job/{self.address}/result", headers=headers)
    response_dict = response.json()
    data = response_dict['slices']
    
    return [item['value'] for item in sorted(data, key=lambda x: x['slice'])]

def computeFor(slices, workFunction: WorkFunction, account, account_password=""):
  global API_URL
  if (os.environ.get('DCP_BEARER') is None):
    raise EnvironmentError("Environment variable 'DCP_BEARER' is not set!")

  # Data to be sent
  data = {
      "slices": slices,
      "work": {
          "function": str(workFunction),
          "language": workFunction.language,
          "pyimports": workFunction.imports,
      },
      "account": {
          "address": account,
          "password": account_password
      }
  }

  headers = {
      'Authorization': 'Bearer ' + os.environ.get('DCP_BEARER')
  }

  response = requests.post(f"{os.environ.get('DCP_API_URL')}job", json=data, headers=headers)

  return Job(slices, workFunction, response.text)

