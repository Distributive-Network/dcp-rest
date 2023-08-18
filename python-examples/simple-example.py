#!/usr/bin/env python3
import time
import dcp

workFun = dcp.WorkFunction("lambda x: x*5")
data = [1,2,3]

job = dcp.computeFor(data, workFun, "0x3d4393D4A143310C10A4C9Ff259B5d2DFbb2AA83", "1")

while True:
  time.sleep(5)
  status = job.status()
  print(status)
  if (status['status'] in ("cancelled", "finished")):
    break

print("DCP job done! Here are the results!")
print(job.result())

