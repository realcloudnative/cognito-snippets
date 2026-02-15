# Cognito Passkey Authentication

CloudFormation template: `cognito-passkey.yaml`

## Architecture

The template provisions four resources:

| Resource | Type | Purpose |
|---|---|---|
| UserPool | `AWS::Cognito::UserPool` | User directory on the **Essentials** tier (required for passkeys) |
| UserPoolDomain | `AWS::Cognito::UserPoolDomain` | Prefix domain with **Managed Login v2** (new UI, not legacy Hosted UI) |
| UserPoolClient | `AWS::Cognito::UserPoolClient` | App client with choice-based auth (`USER_AUTH` flow) |
| ManagedLoginBranding | `AWS::Cognito::ManagedLoginBranding` | Default Cognito-provided branding for the login pages |

## Key configuration choices

### User Registration

- **Admin-only user creation**: `AllowAdminCreateUserOnly: true` disables self-registration. Users must be created by administrators.
- To enable self-registration, set this to `false` or remove the property.

### Managed Login v2 vs legacy Hosted UI

`ManagedLoginVersion` on the domain resource controls which UI is served:

- **Version 2** — New Managed Login with passkey support and branding editor
- **Version 1** — Legacy Hosted UI (classic), no passkey support

### Passkey (WebAuthn)

- Requires `UserPoolTier: ESSENTIALS` or higher.
- `SignInPolicy.AllowedFirstAuthFactors` must include `WEB_AUTHN`.
- `WebAuthnUserVerification: preferred` means biometric verification is used when available but not mandatory. Set to `required` to enforce it.
- `WebAuthnRelyingPartyID` defaults to the Cognito prefix domain. Set it explicitly when using a custom domain.

### Auth flows

`ALLOW_USER_AUTH` on the app client enables choice-based authentication, which covers passkeys, passwordless OTP, and password sign-in from a single flow. This is separate from the older client-based flows (`ALLOW_USER_SRP_AUTH`, etc.) which are also included for backward compatibility.

### Allowed first auth factors

Configured in `Policies.SignInPolicy.AllowedFirstAuthFactors`. Possible values:

- `WEB_AUTHN` — Passkeys / biometric / security keys
- `PASSWORD` — Username + password
- `EMAIL_OTP` — One-time password via email
- `SMS_OTP` — One-time password via SMS

The template currently enables `WEB_AUTHN` and `PASSWORD`.

## Parameters

| Parameter | Default | Description |
|---|---|---|
| `UserPoolName` | `PasskeyUserPool` | Name of the user pool |
| `DomainPrefix` | *(required)* | Globally unique prefix for the Cognito domain |
| `CallbackURL` | `https://localhost:3000/callback` | OAuth callback URL |
| `LogoutURL` | `https://localhost:3000/logout` | OAuth logout URL |

## Deployment

```bash
aws cloudformation deploy \
  --template-file cognito-passkey.yaml \
  --stack-name cognito-passkey \
  --parameter-overrides DomainPrefix=my-unique-prefix
```

## Updating callback / logout URLs

`CallbackURLs` and `LogoutURLs` are **no-interruption updates** — changing them does not replace or recreate any resources. Just redeploy with new parameter values:

```bash
aws cloudformation deploy \
  --template-file cognito-passkey.yaml \
  --stack-name cognito-passkey \
  --parameter-overrides \
    DomainPrefix=my-unique-prefix \
    CallbackURL=https://myapp.example.com/callback \
    LogoutURL=https://myapp.example.com/logout
```

## Custom Branding

The Managed Login UI uses custom styling:

- **Dark purple/blue background** (`#11053b`)
- **8px border radius** on buttons, forms, and inputs
- **Light mode** as default color scheme
- **Header and footer disabled** for minimalist UI
- **Centered form layout**

Branding is defined in the CloudFormation template's `ManagedLoginBranding` resource.

## References

- [Cognito Managed Login](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-managed-login.html)
- [Authentication flows](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-authentication-flow-methods.html)
- [CloudFormation: AWS::Cognito::UserPool](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-cognito-userpool.html)
- [CloudFormation: AWS::Cognito::UserPoolDomain](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-cognito-userpooldomain.html)
- [CloudFormation: AWS::Cognito::UserPoolClient](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-cognito-userpoolclient.html)
- [CloudFormation: AWS::Cognito::ManagedLoginBranding](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-cognito-managedloginbranding.html)
