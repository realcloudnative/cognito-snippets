# Social Login with Amazon Cognito (Google + Apple)

> AI-generated reference implementation. Review carefully before production use.

Federated social login via Google and Apple, using Amazon Cognito Managed Login v2 and the OAuth 2.0 Authorization Code Flow with PKCE. Users never create a Cognito-native password — authentication is fully delegated to their chosen social provider.

Access is **invite-only**: a Pre-Token-Generation Lambda blocks token issuance for any email not on a configured allowlist.

## Prerequisites

- AWS CLI configured with appropriate permissions
- [`uv`](https://docs.astral.sh/uv/) for running the local dev server
- `jq` for the config generation script
- A Google Cloud account (for Google Sign-In)
- An Apple Developer account (for Sign in with Apple)

## Before you start: claim your Cognito domain

The Google and Apple setup steps require your Cognito domain, which is created by CloudFormation. The domain is predictable — it will be `https://<stack-name>.auth.<region>.amazoncognito.com` — but Cognito domain prefixes are **globally unique**, so the name you choose might already be taken.

To avoid configuring Google/Apple and then hitting a name collision during deployment, deploy just the UserPool and Domain first with placeholder IdP credentials:

```bash
aws cloudformation deploy \
  --template-file social-login/cognito-social.yaml \
  --stack-name demo-social-login \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    CallbackURL=http://localhost:3000/callback.html \
    LogoutURL=http://localhost:3000/ \
    GoogleClientId=placeholder \
    GoogleClientSecret=placeholder \
    AppleServicesId=placeholder \
    AppleTeamId=AAAAAAAAAA \
    AppleKeyId=AAAAAAAAAA \
    ApplePrivateKey="$(openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 2>/dev/null)" \
    AllowedEmails=placeholder@example.com
```

> The Apple parameters require syntactically valid values (10-char Team/Key IDs, a PEM private key) even for placeholders — the values above satisfy that. The IdPs will fail to authenticate until you replace them with real credentials in the update step below.

Once the stack is created successfully, your domain is confirmed and reserved. Then complete the Google and Apple setup below and update the stack with real credentials:

```bash
aws cloudformation deploy \
  --template-file social-login/cognito-social.yaml \
  --stack-name demo-social-login \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    GoogleClientId=YOUR_REAL_GOOGLE_CLIENT_ID \
    GoogleClientSecret=YOUR_REAL_GOOGLE_CLIENT_SECRET \
    AppleServicesId=com.example.myapp-signin \
    AppleTeamId=ABCDE12345 \
    AppleKeyId=FGHIJ67890 \
    ApplePrivateKey="$(cat /path/to/AuthKey_FGHIJ67890.p8)" \  # .p8 file downloaded in Apple Setup step 3
    AllowedEmails=alice@example.com,bob@example.com
```

Your confirmed Cognito domain (substitute into the steps below):

```
https://demo-social-login.auth.<region>.amazoncognito.com
```

## Google Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**.
2. Click **Create Credentials** → **OAuth client ID**.
3. Set application type to **Web application**.
4. Under **Authorized redirect URIs**, add:
   ```
   https://<your-stack-name>.auth.<region>.amazoncognito.com/oauth2/idpresponse
   ```
5. Copy the **Client ID** and **Client Secret** — you will pass these as CloudFormation parameters.

> The redirect URI uses your Cognito domain, not your app URL. Cognito handles the IdP callback and then redirects to your app's `CallbackURL`.

## Apple Setup

1. Sign in to [Apple Developer](https://developer.apple.com/) → **Certificates, Identifiers & Profiles**.

2. **Create a Services ID** (Identifiers → +):
   - Type: **Services IDs**
   - Description: anything (e.g. `My App Social Login`)
   - Identifier: reverse-domain style, e.g. `com.example.myapp-signin`
   - Enable **Sign In with Apple** and click **Configure**
   - Add your Cognito domain to **Domains and Subdomains**:
     ```
     <your-stack-name>.auth.<region>.amazoncognito.com
     ```
   - Add the return URL to **Return URLs**:
     ```
     https://<your-stack-name>.auth.<region>.amazoncognito.com/oauth2/idpresponse
     ```
   - Save the Services ID — this becomes `AppleServicesId`.

3. **Create a Sign in with Apple key** (Keys → +):
   - Enable **Sign In with Apple** and configure it with your App ID (Primary App ID).
   - Download the `.p8` file — you can only download it once.
   - Note the **Key ID** — this becomes `AppleKeyId`.

4. **Find your Team ID** at the top-right of the Apple Developer portal (10-character alphanumeric string) — this becomes `AppleTeamId`.

5. Copy the contents of the `.p8` file (including the `-----BEGIN PRIVATE KEY-----` header and footer) — this becomes `ApplePrivateKey`.

## Deploy

Follow the two-stage process described in [Before you start](#before-you-start-claim-your-cognito-domain): deploy with placeholders first to claim the domain, complete the Google and Apple setup, then redeploy with real credentials.

> `--capabilities CAPABILITY_IAM` is required because the template creates an IAM role for the Lambda function.

## Generate Config

```bash
cd social-login && ./update-config.sh demo-social-login
```

This writes `config.js` with the Cognito domain, client ID, and URLs pulled from the CloudFormation outputs.

## Run Locally

```bash
cd social-login && uv run python -m http.server 3000
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

```
Browser                    Cognito Managed Login         Google / Apple
  │                               │                            │
  │── auth.login() ──────────────>│                            │
  │   (PKCE code_challenge)       │                            │
  │                               │── OAuth redirect ─────────>│
  │                               │<─ auth code ──────────────│
  │<─ redirect to callback.html ──│                            │
  │   (?code=...&state=...)       │                            │
  │                               │                            │
  │── POST /oauth2/token ────────>│                            │
  │   (code + code_verifier)      │── Pre-Token-Gen Lambda ──> │
  │                               │   (email allowlist check)  │
  │<─ id_token + access_token ───│                            │
  │                               │                            │
  │ decode id_token (display only)│                            │
```

1. `index.html` + `auth.js` generate a PKCE `code_verifier`/`code_challenge` and random `state`, store them in `sessionStorage`, and redirect to Cognito's `/oauth2/authorize`.
2. Cognito Managed Login v2 shows Google and Apple sign-in buttons. The user authenticates with their chosen provider.
3. Cognito receives the IdP callback, maps attributes, and redirects to `callback.html?code=...&state=...`.
4. `callback.html` verifies `state`, retrieves `code_verifier`, and exchanges the code at `/oauth2/token`.
5. Before issuing tokens, Cognito invokes the Pre-Token-Generation Lambda, which checks the user's email against the allowlist.
6. On success, tokens are stored in `sessionStorage` and the user is redirected to `index.html`.

## Learnings & Limitations

### `AllowAdminCreateUserOnly: true` does NOT block federated sign-ups

The [API definition](https://docs.aws.amazon.com/cognito-user-identity-pools/latest/APIReference/API_AdminCreateUserConfigType.html) for `AllowAdminCreateUserOnly` says: *"When `true`, only administrators can create new user profiles… users can register themselves and create a new user profile with the `SignUp` operation."* The restriction applies only to the `SignUp` API call. It says nothing about federation.

The [federation documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation.html) confirms: *"Amazon Cognito creates a user profile for your federated user in its own directory."* This happens regardless of `AllowAdminCreateUserOnly`.

### The Lambda is the enforcement point — but the user record persists

The [Pre-Token-Generation trigger](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-token-generation.html) runs before tokens are issued. Raising an exception from it blocks the token response, but the user record was already created (or looked up) earlier in the flow. The blocked user appears in the User Pool console but cannot obtain tokens.

An alternative enforcement point is the [Pre-Sign-Up trigger](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-lambda-pre-sign-up.html), which fires *"on self-service sign-up with `SignUp` or first sign-in with a trusted identity provider"* — i.e., before the user record is created. Using Pre-Sign-Up instead would prevent user record creation entirely for blocked emails.

### Allowlist via environment variable — not suitable for production at scale

The current implementation stores the allowlist as a comma-separated environment variable. This works for small, static lists but requires a Lambda redeployment to change. For production use, replace this with a DynamoDB table lookup or similar dynamic store.

### Apple private key vs Google client secret

Apple uses asymmetric signing (a `.p8` private key file) to authenticate the client, while Google uses a symmetric client secret. The private key is more sensitive — it is passed as a CloudFormation parameter here for simplicity, but **production deployments should store it in AWS Secrets Manager** and have the Lambda fetch it at runtime.

### The `identities` claim identifies the provider — it is in the ID token

The [federation documentation](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-identity-federation.html) confirms: *"Amazon Cognito records information about your federated user's identity to an attribute, and a claim in the ID token, called `identities`. This claim contains your user's provider and their unique ID from the provider."* So the provider (Google vs Apple) is available in the ID token as the `identities` claim — no Admin API call needed. Note that `identities` is not a standard OIDC claim and you cannot modify it directly.

## Production Considerations

- **HTTPS**: The `CallbackURL` and `LogoutURL` must use HTTPS in production. The `http://localhost:3000` values are only valid for local development.
- **Secrets Manager**: Store `ApplePrivateKey` (and optionally `GoogleClientSecret`) in AWS Secrets Manager. Update the Lambda to fetch secrets at startup rather than reading from environment variables.
- **Token verification**: The frontend decodes the `id_token` for display only — it does **not** verify the signature. Any backend service consuming these tokens must verify the JWT signature against Cognito's JWKS endpoint.
- **Refresh token handling**: The current implementation does not automatically refresh expired tokens. Add refresh logic in `auth.js` for production use.
- **Dynamic allowlist**: Replace the environment variable allowlist with a DynamoDB table for runtime updates without Lambda redeployment.
