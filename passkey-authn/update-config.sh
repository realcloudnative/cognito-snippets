#!/bin/bash
set -e

STACK_NAME="${1:-demo-20260214}"

echo "Fetching configuration from CloudFormation stack: $STACK_NAME"

# Get stack outputs
OUTPUTS=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs' \
  --output json)

# Extract values
DOMAIN=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="CognitoDomain") | .OutputValue' | sed 's|https://||')
CLIENT_ID=$(echo "$OUTPUTS" | jq -r '.[] | select(.OutputKey=="AppClientId") | .OutputValue')

# Generate config.js
cat > config.js << EOF
// Auto-generated from CloudFormation stack: $STACK_NAME
// Run ./update-config.sh to refresh

export const CONFIG = {
    domain: '$DOMAIN',
    clientId: '$CLIENT_ID',
    redirectUri: 'http://localhost:3000/callback.html',
    logoutUri: 'http://localhost:3000/'
};
EOF

echo "✓ Generated config.js with:"
echo "  Domain: $DOMAIN"
echo "  Client ID: $CLIENT_ID"
