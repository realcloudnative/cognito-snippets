# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Purpose

This is a reference implementation repository for Amazon Cognito authentication patterns, starting with passkey (WebAuthn) authentication. Code was AI-generated with minimal human oversight — suitable for learning, but review thoroughly before production use.

## Development Commands

There is no build system or test framework — this is intentionally a zero-dependencies vanilla JavaScript project.

**Deploy infrastructure:**
```bash
aws cloudformation deploy \
  --template-file passkey-authn/cognito-passkey.yaml \
  --stack-name YOUR-UNIQUE-STACK-NAME \
  --parameter-overrides CallbackURL=http://localhost:3000/callback.html LogoutURL=http://localhost:3000/
```

**Generate config from deployed stack:**
```bash
cd passkey-authn && ./update-config.sh YOUR-UNIQUE-STACK-NAME
```

**Run local dev server:**
```bash
cd passkey-authn && uv run python -m http.server 3000
```

**Create a user (admin-only user creation is enforced):**
```bash
aws cognito-idp admin-create-user \
  --user-pool-id <UserPoolId> \
  --username <email> \
  --temporary-password <TempPassword>
```

## Architecture

### passkey-authn/

Implements OAuth 2.0 Authorization Code Flow with PKCE against Amazon Cognito's Managed Login v2. The flow:

1. `index.html` + `auth.js` — generates PKCE `code_verifier`/`code_challenge` and random `state`, stores them in `sessionStorage`, redirects to Cognito's `/oauth2/authorize`
2. Cognito Managed Login v2 handles WebAuthn ceremony and redirects to `callback.html?code=...&state=...`
3. `callback.html` — verifies `state`, retrieves `code_verifier` from `sessionStorage`, exchanges code at `/oauth2/token` for JWT tokens
4. `index.html` — decodes `id_token` (display only, no signature verification) to show user info

**Key files:**
- `auth.js` — core auth state machine (login, logout, token exchange, PKCE)
- `cognito-passkey.yaml` — CloudFormation: UserPool (ESSENTIALS tier), UserPoolDomain, UserPoolClient, ManagedLoginBranding
- `update-config.sh` — queries CloudFormation outputs to generate `config.js`
- `config.example.js` — template showing expected config shape

### CloudFormation Resources

The template creates exactly 4 resources:
- `AWS::Cognito::UserPool` — ESSENTIALS tier (required for passkeys), email as username, `AllowAdminCreateUserOnly: true`, allows both `WEB_AUTHN` and `PASSWORD` as first auth factors
- `AWS::Cognito::UserPoolDomain` — stack name becomes the globally-unique Cognito domain prefix, uses Managed Login v2
- `AWS::Cognito::UserPoolClient` — PKCE only (no client secret), auth flows: `ALLOW_USER_AUTH`, `ALLOW_USER_SRP_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`
- `AWS::Cognito::ManagedLoginBranding` — custom dark-purple styling

## Known Cognito Passkey Limitations

These are documented hard limits discovered during implementation:

1. Cannot distinguish passkey vs password authentication from tokens (no `amr` claim differentiation)
2. Cannot fully disable passwords — `PASSWORD` must remain in `AllowedFirstAuthFactors` alongside `WEB_AUTHN`
3. Cannot delete a user's password via API (`DeleteUserPassword` doesn't exist)
4. Passkey registration requires an existing account (cannot bootstrap passwordless users)
5. Enabling TOTP MFA conflicts with passwordless/passkey auth flows
