#!/bin/bash
set -e

# Create a passwordless user in Cognito for passkey-only authentication
# Usage: ./create-passwordless-user.sh <email> [stack-name]

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <email> <stack-name>"
    echo "Example: $0 user@example.com my-cognito-stack"
    exit 1
fi

EMAIL="$1"
STACK_NAME="$2"

echo "Creating passwordless user: $EMAIL"

# Get User Pool ID from CloudFormation
USER_POOL_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`UserPoolId`].OutputValue' \
    --output text)

echo "User Pool ID: $USER_POOL_ID"

# Get Cognito Domain for passkey registration URL
COGNITO_DOMAIN=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`CognitoDomain`].OutputValue' \
    --output text)

# Get App Client ID
APP_CLIENT_ID=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs[?OutputKey==`AppClientId`].OutputValue' \
    --output text)

# Create user WITHOUT password
# Note: User will be automatically CONFIRMED (not FORCE_CHANGE_PASSWORD)
aws cognito-idp admin-create-user \
    --user-pool-id "$USER_POOL_ID" \
    --username "$EMAIL" \
    --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
    --message-action SUPPRESS

echo ""
echo "✓ User created successfully (passwordless)"
echo ""
echo "Next steps:"
echo "  1. The user should sign in to your application at the configured callback URL"
echo "  2. After signing in, they can add a passkey via the 'Add Passkey' button"
echo ""
echo "Alternatively, you can construct a direct passkey registration URL:"
echo "  https://${COGNITO_DOMAIN}/passkeys/add?client_id=${APP_CLIENT_ID}&redirect_uri=<YOUR_CALLBACK_URL>&response_type=code&scope=openid+email+profile"
