// Example configuration file
// Run ./update-config.sh <stack-name> to auto-generate from CloudFormation

export const CONFIG = {
    domain: 'your-domain-prefix.auth.region.amazoncognito.com',
    clientId: 'your-cognito-app-client-id',
    redirectUri: 'http://localhost:3000/callback.html',
    logoutUri: 'http://localhost:3000/'
};
