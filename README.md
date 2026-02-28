# Cognito Snippets

Reusable code snippets demonstrating Amazon Cognito authentication patterns and features.

> [!NOTE]
> **Made with ❤️  by Claude Code**
> This repository was created by an AI coding agent with minimal human oversight. The code examples, documentation, and infrastructure templates were generated to demonstrate Amazon Cognito patterns and their limitations. While functional and tested, please review thoroughly before production use.

## Purpose

This repository provides **ready-to-use examples** for implementing various Amazon Cognito authentication patterns. Each snippet is a self-contained, working example that you can learn from, adapt, or use as a starting point for your projects.

## Available Snippets

### [Passkey Authentication](./passkey-authn/)

Demonstrates **passkey (WebAuthn) authentication** with Amazon Cognito User Pools using Managed Login v2.

**Includes:**
- CloudFormation template for Cognito setup
- Vanilla JavaScript OAuth 2.0 + PKCE implementation
- Passkey registration and authentication
- Comprehensive documentation of Cognito's passkey limitations

**Key Learnings:** Cannot track auth method, cannot fully disable passwords, MFA conflicts with passkeys.

[View full documentation →](./passkey-authn/README.md)

---

### [Social Login](./social-login/)

Demonstrates **federated social login via Google** with Amazon Cognito User Pools using Managed Login v2. Users authenticate entirely through Google — no Cognito-native passwords.

**Includes:**
- CloudFormation template with Google IdP and a Pre-Token-Generation Lambda
- Email allowlist enforced at token issuance (invite-only access)
- Vanilla JavaScript OAuth 2.0 + PKCE implementation
- Step-by-step Google developer setup instructions

**Key Learnings:** `AllowAdminCreateUserOnly` does not block federated sign-ups; the Lambda trigger is the real enforcement point.

[View full documentation →](./social-login/README.md)

---

## Getting Started

Each snippet is self-contained in its own directory with:
- **README.md** - Complete setup instructions and documentation
- **CloudFormation templates** - Infrastructure as code
- **Working code** - Ready-to-run examples
- **Helper scripts** - Utilities for testing and configuration

Browse to any snippet directory and follow the README to get started.

## Prerequisites

- AWS account with appropriate permissions
- AWS CLI configured (`aws configure`)
- Modern web browser with WebAuthn support (for passkey example)
- Basic knowledge of Amazon Cognito and OAuth 2.0

## Repository Structure

```
cognito-snippets/
├── passkey-authn/           # Passkey authentication example
│   ├── README.md
│   ├── cognito-passkey.yaml
│   ├── index.html
│   └── ...
├── social-login/            # Federated social login (Google + Apple)
│   ├── README.md
│   ├── cognito-social.yaml
│   ├── index.html
│   └── ...
└── README.md                # This file
```

## License

MIT-0 - Use these snippets freely without attribution requirements.

## Related Resources

- [Amazon Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [WebAuthn Guide](https://webauthn.guide/)

---

**Maintained by:** [realcloudnative.com](https://realcloudnative.com)
