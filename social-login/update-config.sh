#!/bin/bash
set -e

STACK_NAME="${1:-demo-social-login}"

echo "Fetching configuration from CloudFormation stack: $STACK_NAME"

# Get stack outputs
OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs' \
  --output json)

# Extract values
DOMAIN=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="CognitoDomain") | .OutputValue' | sed 's|https://||')
CLIENT_ID=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="AppClientId") | .OutputValue')
CALLBACK_URL=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="CallbackURL") | .OutputValue')
LOGOUT_URL=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="LogoutURL") | .OutputValue')

# Generate config.js
cat > config.js << EOF
// Auto-generated from CloudFormation stack: $STACK_NAME
// Run ./update-config.sh to refresh

export const CONFIG = {
    domain: '$DOMAIN',
    clientId: '$CLIENT_ID',
    redirectUri: '$CALLBACK_URL',
    logoutUri: '$LOGOUT_URL'
};
EOF

echo "✓ Generated config.js with:"
echo "  Domain: $DOMAIN"
echo "  Client ID: $CLIENT_ID"
echo "  Callback URL: $CALLBACK_URL"
echo "  Logout URL: $LOGOUT_URL"
