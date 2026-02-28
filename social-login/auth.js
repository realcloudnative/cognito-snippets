// Import configuration from auto-generated config.js
// Run ./update-config.sh to regenerate from CloudFormation
import { CONFIG } from './config.js';

// PKCE helper functions
async function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64URLEncode(array);
}

async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return base64URLEncode(new Uint8Array(hash));
}

function base64URLEncode(buffer) {
    const base64 = btoa(String.fromCharCode(...buffer));
    return base64
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

// Generate random state for CSRF protection
function generateState() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return base64URLEncode(array);
}

// Decode JWT token (without verification - for display only)
function decodeJWT(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid token format');
        }
        const payload = parts[1];
        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(decoded);
    } catch (err) {
        console.error('Failed to decode JWT:', err);
        return null;
    }
}

// Auth class
class CognitoAuth {
    constructor(config) {
        this.config = config;
        this.storageKeys = {
            accessToken: 'cognito_access_token',
            idToken: 'cognito_id_token',
            refreshToken: 'cognito_refresh_token',
            codeVerifier: 'pkce_code_verifier',
            state: 'oauth_state'
        };
    }

    async login() {
        const codeVerifier = await generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        const state = generateState();

        // Store for callback verification
        sessionStorage.setItem(this.storageKeys.codeVerifier, codeVerifier);
        sessionStorage.setItem(this.storageKeys.state, state);

        // Build authorization URL
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            scope: 'openid email profile'
        });

        // Use /oauth2/authorize - Cognito Managed Login shows configured social providers
        const authUrl = `https://${this.config.domain}/oauth2/authorize?${params}`;
        window.location.href = authUrl;
    }

    async handleCallback(code, state) {
        // Verify state to prevent CSRF
        const savedState = sessionStorage.getItem(this.storageKeys.state);
        if (state !== savedState) {
            throw new Error('Invalid state parameter - possible CSRF attack');
        }

        // Get code verifier for PKCE
        const codeVerifier = sessionStorage.getItem(this.storageKeys.codeVerifier);
        if (!codeVerifier) {
            throw new Error('No code verifier found');
        }

        // Exchange code for tokens
        const tokenUrl = `https://${this.config.domain}/oauth2/token`;
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: this.config.clientId,
            code: code,
            redirect_uri: this.config.redirectUri,
            code_verifier: codeVerifier
        });

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token exchange failed: ${error}`);
        }

        const tokens = await response.json();

        // Store tokens
        sessionStorage.setItem(this.storageKeys.accessToken, tokens.access_token);
        sessionStorage.setItem(this.storageKeys.idToken, tokens.id_token);
        if (tokens.refresh_token) {
            sessionStorage.setItem(this.storageKeys.refreshToken, tokens.refresh_token);
        }

        // Clean up PKCE data
        sessionStorage.removeItem(this.storageKeys.codeVerifier);
        sessionStorage.removeItem(this.storageKeys.state);
    }

    logout() {
        // Clear local tokens
        sessionStorage.removeItem(this.storageKeys.accessToken);
        sessionStorage.removeItem(this.storageKeys.idToken);
        sessionStorage.removeItem(this.storageKeys.refreshToken);

        // Redirect to Cognito logout endpoint
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            logout_uri: this.config.logoutUri
        });

        const logoutUrl = `https://${this.config.domain}/logout?${params}`;
        window.location.href = logoutUrl;
    }

    getUser() {
        const idToken = sessionStorage.getItem(this.storageKeys.idToken);
        if (!idToken) {
            return null;
        }

        const decoded = decodeJWT(idToken);
        if (!decoded) {
            return null;
        }

        // Check if token is expired
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp < now) {
            this.logout();
            return null;
        }

        return {
            sub: decoded.sub,
            email: decoded.email,
            email_verified: decoded.email_verified,
            ...decoded
        };
    }

    isAuthenticated() {
        return this.getUser() !== null;
    }
}

// Export singleton instance
export const auth = new CognitoAuth(CONFIG);
