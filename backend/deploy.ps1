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
#   # 3. Public endpoint. NOTE: a plain Lambda Function URL (auth NONE) is blocked by the
#   # DMI organization SCP (403 AccessDeniedException), so we front it with an API Gateway
#   # HTTP API instead — same v2 event payload, still effectively free.
#   aws apigatewayv2 create-api --name griptrack-coach --protocol-type HTTP `
#     --target arn:aws:lambda:eu-west-1:<ACCOUNT_ID>:function:griptrack-coach `
#     --cors-configuration "AllowOrigins=https://knowlec.github.io,AllowMethods=POST,AllowHeaders=content-type,x-app-secret,MaxAge=86400"
#   aws lambda add-permission --function-name griptrack-coach --action lambda:InvokeFunction `
#     --principal apigateway.amazonaws.com --statement-id apigw-invoke `
#     --source-arn "arn:aws:execute-api:eu-west-1:<ACCOUNT_ID>:<API_ID>/*"
#   # Caveat: HTTP API integration timeout is a hard 29s — if coach reviews start timing
#   # out, switch the Lambda env var MODEL_ID to a faster model (e.g. claude-sonnet-5).
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
