# Minimalistic Cognito Passkey Web App

A vanilla JavaScript implementation of Amazon Cognito authentication with passkey support. **Zero dependencies**.

## Prerequisites

Before you begin, ensure you have:

- **AWS Account** with permissions to create Cognito resources
- **AWS CLI** installed and configured (`aws configure`)
  - Minimum version: 2.0 (for Cognito passkey support)
- **[uv](https://github.com/astral-sh/uv)** - Fast Python package manager
- **Modern web browser** with WebAuthn support
  - Chrome 61+, Firefox 60+, Safari 11+, or Edge 79+
- **Basic knowledge** of:
  - Amazon Cognito User Pools
  - OAuth 2.0 authorization code flow
  - WebAuthn/passkeys concepts

## Files

- `index.html` - Main page with login/logout UI
- `callback.html` - OAuth callback handler
- `auth.js` - Authentication logic with PKCE

## Features

- **Pure vanilla JavaScript** - No frameworks or libraries
- **Modern ES6+** - Uses modules, async/await, fetch API
- **Secure PKCE flow** - Uses Web Crypto API for code challenge
- **JWT decoding** - Native base64 decoding
- **Session storage** - Browser-native token management

## Setup

### 1. Deploy CloudFormation Stack

**Important:** Choose a **globally unique** stack name - it will be used as your Cognito domain prefix (e.g., `my-app-20260215` instead of `cognito-passkey`).

```bash
aws cloudformation deploy \
  --template-file cognito-passkey.yaml \
  --stack-name YOUR-UNIQUE-NAME-HERE \
  --parameter-overrides \
    CallbackURL=http://localhost:3000/callback.html \
    LogoutURL=http://localhost:3000/
```

### 2. Create Users (Admin Console)

**This template is configured for admin interfaces, not public websites.** Self-registration is disabled.

Create users via the AWS Cognito console:
1. Navigate to your User Pool in the AWS Console
2. Users → Create user
3. Set email and temporary password
4. User will be prompted to change password on first login

**For public websites:** To enable self-registration, modify the CloudFormation template and set `AllowAdminCreateUserOnly: false` in the UserPool resource.

### 3. Generate Configuration

Run the update script with your stack name:

```bash
./update-config.sh YOUR-UNIQUE-NAME-HERE
```

This automatically generates `config.js` with your Cognito domain and client ID.

### 4. Run Local Server

You need a local web server (file:// won't work due to OAuth redirects).

Use [uv](https://github.com/astral-sh/uv) to run Python's HTTP server:

```bash
uv run python -m http.server 3000
```

### 5. Test

1. Open http://localhost:3000
2. Click "Login with Passkey"
3. Use Cognito Hosted UI to register/login with passkey
4. You'll be redirected back with user info displayed

## How It Works

### OAuth 2.0 Authorization Code Flow with PKCE

1. **Login Click**
   - Generate random `code_verifier` (32 bytes)
   - Create SHA-256 hash as `code_challenge`
   - Store verifier in sessionStorage
   - Redirect to Cognito `/oauth2/authorize` with challenge

2. **User Authenticates**
   - Cognito Hosted UI handles passkey/password login
   - User completes WebAuthn ceremony
   - Cognito redirects back with `code`

3. **Callback Handler**
   - Retrieve `code_verifier` from sessionStorage
   - POST to `/oauth2/token` with code + verifier
   - Receive `id_token`, `access_token`, `refresh_token`
   - Store tokens in sessionStorage

4. **User Info Display**
   - Decode `id_token` (JWT) to extract user claims
   - Display email and user ID
   - Check token expiration

5. **Logout**
   - Clear sessionStorage
   - Redirect to Cognito `/logout` endpoint

## Key Learnings: Cognito Passkey Limitations

### What We Discovered

Through building this demo, we identified several important limitations in Cognito's passkey implementation:

#### 1. Cannot Track Authentication Method ❌

**Problem:** There's no way to determine if a user authenticated with a passkey vs password.

**What we tried:**
- Pre Token Generation Lambda trigger - receives identical events for both passkey and password authentication
- `triggerSource` is always `TokenGeneration_HostedAuth` for both methods
- `amr` (Authentication Methods Reference) claim is not populated by Cognito
- No distinguishing information in the Lambda event structure

**Conclusion:** Cognito does not provide authentication method tracking. This is a platform limitation.

#### 2. Cannot Fully Disable Passwords ❌

**Problem:** PASSWORD must remain in `AllowedFirstAuthFactors` even for passkey-only setups.

**What happens:**
```yaml
SignInPolicy:
  AllowedFirstAuthFactors:
    - WEB_AUTHN  # ✅ Works
    # - PASSWORD  # ❌ Cannot remove - CloudFormation fails with:
                  # "PASSWORD should be configured as one of the allowed first auth factors"
```

**Conclusion:** Cognito requires PASSWORD at the user pool level, even if you want passkey-only authentication.

#### 3. Cannot Delete User Passwords ❌

**Problem:** Once a user has a password, it cannot be deleted from Cognito.

**Implications:**
- Users created with temporary passwords will always have a password in Cognito
- Even after registering a passkey, the password remains valid for authentication
- No `DeleteUserPassword` API exists
- Best workaround: Set password to long random unknown value

**Security concern:** Users with both passkey AND password can authenticate with either method. Cannot enforce "passkey only" for users who have passwords.

#### 4. Passkeys Don't Support Passwordless User Creation ❌

**Problem:** Cannot create users without passwords when only WEB_AUTHN + PASSWORD are enabled.

**From AWS Documentation:**
> "If the only authentication flows available to new users require a password, for example passkey or username-password, you must create or generate a temporary password for each new user."

**To enable passwordless user creation, you need:**
- `EMAIL_OTP` or `SMS_OTP` in `AllowedFirstAuthFactors`
- Passkeys alone are NOT sufficient for passwordless user creation

**Current workaround:**
1. Create users with temporary passwords
2. Users sign in with password (first time only)
3. Users register passkey via `/passkeys/add`
4. Users forget/ignore password
5. Users authenticate with passkey thereafter

#### 5. MFA Conflicts with Passwordless Authentication ❌

**Problem:** MFA (TOTP) and passwordless factors (passkeys) are mutually exclusive per user.

**From AWS Documentation:**
> "Multi-factor authentication cannot be used with passwordless authentication"

**Implications:**
- Users can have passkeys OR TOTP MFA, not both
- Setting `MfaConfiguration: REQUIRED` conflicts with `WEB_AUTHN` authentication
- Must use `MfaConfiguration: OPTIONAL` at most

### Recommended Approach

Given these limitations, the **pragmatic approach** for passkey authentication with Cognito:

1. ✅ Keep both `WEB_AUTHN` and `PASSWORD` in `AllowedFirstAuthFactors` (required)
2. ✅ Create users with temporary passwords (required for admin-created users)
3. ✅ Direct users to `/passkeys/add` to register passkeys on first login
4. ✅ Users authenticate with passkeys thereafter (password exists but is forgotten/unknown)
5. ✅ Accept that both methods technically remain valid in Cognito

### Alternative: True Passwordless with EMAIL_OTP

If passwordless user creation is critical, add EMAIL_OTP:

```yaml
SignInPolicy:
  AllowedFirstAuthFactors:
    - WEB_AUTHN
    - EMAIL_OTP   # Enables passwordless user creation
    - PASSWORD    # Still required by Cognito
```

**Trade-offs:**
- ✅ Users can be created with NO password
- ✅ Users get email codes initially, then register passkey
- ✅ No password ever existed in Cognito for these users
- ❌ Email OTP is slower and more jarring UX than temporary passwords

### Comparison: Auth0 vs Cognito

For future evaluation, key questions for Auth0:

1. Can users be created with ONLY passkeys (no password, no OTP)?
2. Does Auth0 track which authentication method was used?
3. Can passwords be fully disabled/deleted after passkey registration?
4. What's the cost at 25K+ monthly active users?

This demo serves as a **reference implementation for Cognito**. A separate Auth0 demo can be built for comparison.

## Security Notes

- **PKCE required** - Public clients (no client secret) must use PKCE
- **State parameter** - Prevents CSRF attacks
- **Token storage** - sessionStorage (cleared on tab close)
- **No token verification** - ID token is decoded but not cryptographically verified (suitable for display only)
- **Passkey authentication** - WebAuthn provides strong authentication with biometric or hardware security keys

## Browser Requirements

- Modern browsers with:
  - ES6 modules
  - Web Crypto API (`crypto.subtle`)
  - Fetch API
  - sessionStorage

Supports: Chrome 61+, Firefox 60+, Safari 11+, Edge 79+

## Production Considerations

For production use, consider:

1. **HTTPS** - Required for WebAuthn/passkeys
2. **Token verification** - Verify JWT signatures server-side
3. **Refresh tokens** - Implement token refresh logic
4. **Error handling** - Add retry logic and better error messages
5. **Token storage** - Consider localStorage vs sessionStorage based on UX needs
6. **Custom domain** - Use CloudFront + ACM for custom Cognito domain

## Troubleshooting

### CloudFormation Stack Deployment Fails

**Problem:** Stack creation fails with UserPoolDomain error

**Solution:**
- Choose a globally unique stack name (used as Cognito domain prefix)
- Stack name must be lowercase, alphanumeric, and hyphens only
- Try adding a timestamp or random suffix (e.g., `my-app-20260215`)
- Check AWS region - some features require specific regions

### "No authorization code received" Error

**Problem:** OAuth callback doesn't receive the authorization code

**Solution:**
- Verify `CallbackURL` in CloudFormation matches your local server URL exactly
- Ensure you're running a local web server (not using `file://` protocol)
- Check browser console for CORS or network errors

### Passkey Registration Not Working

**Problem:** WebAuthn ceremony fails or doesn't start

**Solution:**
- Ensure you're using HTTPS or `localhost` (WebAuthn requirement)
- Check browser compatibility (Chrome, Safari, Firefox, Edge modern versions)
- Verify your device has biometric hardware or security key
- Try clearing browser cache and sessionStorage

### User Creation Fails

**Problem:** Cannot create users without passwords

**Solution:**
- This is expected with WEB_AUTHN + PASSWORD only
- Either:
  - Create users with temporary passwords (recommended)
  - Or add EMAIL_OTP to `AllowedFirstAuthFactors` for passwordless creation

### Tokens Not Being Stored

**Problem:** User keeps getting logged out

**Solution:**
- Check browser console for storage errors
- Verify sessionStorage is enabled in browser
- Ensure no browser extensions are blocking storage
- Check if you're in private/incognito mode (sessionStorage may be limited)

### "Invalid state parameter" Error

**Problem:** CSRF protection is blocking the callback

**Solution:**
- Clear sessionStorage and try again
- Ensure you complete the OAuth flow in the same browser tab
- Don't refresh during the authentication process

### Need Help?

- Check the [Amazon Cognito documentation](https://docs.aws.amazon.com/cognito/)
- Review CloudFormation stack events for deployment errors
- Enable browser developer console to see detailed errors
- Verify AWS CLI version supports Cognito passkeys (`aws --version`)
