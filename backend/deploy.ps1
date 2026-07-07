# GripTrack coach Lambda — package + deploy (run from backend/)
#
# One-time prerequisites (run manually, fill in the placeholders):
#
#   # 1. Execution role
#   aws iam create-role --role-name griptrack-coach-role --assume-role-policy-document file://trust-lambda.json
#   aws iam attach-role-policy --role-name griptrack-coach-role --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
#
#   # 2. Create function (after building function.zip with this script)
#   aws lambda create-function --function-name griptrack-coach `
#     --runtime python3.12 --handler lambda_function.handler `
#     --zip-file fileb://function.zip --timeout 120 --memory-size 512 `
#     --role arn:aws:iam::<ACCOUNT_ID>:role/griptrack-coach-role `
#     --environment "Variables={ANTHROPIC_API_KEY=<KEY>,APP_SHARED_SECRET=<SECRET>,MODEL_ID=claude-opus-4-8}"
#
#   # 3. Function URL, CORS locked to GitHub Pages
#   aws lambda create-function-url-config --function-name griptrack-coach --auth-type NONE `
#     --cors "AllowOrigins=https://knowlec.github.io,AllowMethods=POST,AllowHeaders=content-type,x-app-secret,MaxAge=86400"
#   aws lambda add-permission --function-name griptrack-coach --action lambda:InvokeFunctionUrl `
#     --principal "*" --function-url-auth-type NONE --statement-id url-public
#
#   # 4. Cost ceiling: one concurrent invocation max
#   aws lambda put-function-concurrency --function-name griptrack-coach --reserved-concurrent-executions 1

$ErrorActionPreference = "Stop"

if (Test-Path package) { Remove-Item package -Recurse -Force }
New-Item -ItemType Directory package | Out-Null

# Lambda runs on Linux x86_64 — pull manylinux wheels
pip install -r requirements.txt -t package/ --platform manylinux2014_x86_64 --only-binary=:all: --python-version 3.12
Copy-Item lambda_function.py, prompts.py, coach_schema.py package/

if (Test-Path function.zip) { Remove-Item function.zip -Force }
Compress-Archive -Path package\* -DestinationPath function.zip

Write-Host "Built function.zip. Deploy with:"
Write-Host "  aws lambda update-function-code --function-name griptrack-coach --zip-file fileb://function.zip"
