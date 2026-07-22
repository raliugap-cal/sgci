#!/bin/bash
# Ver imports incorrectos en lab y prescriptions
sed -n '1,20p' apps/api/src/lab/lab.module.ts
echo "---PRESCRIPTIONS---"
sed -n '1,20p' apps/api/src/prescriptions/prescriptions.module.ts
