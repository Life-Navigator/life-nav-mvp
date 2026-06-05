# LifeNavigator branded auth email templates

Premium, brand-consistent HTML for Supabase Auth emails. All links use the
**token_hash → SSR confirm route** format (`/auth/confirm?...`), NOT the default
`{{ .ConfirmationURL }}`, so they work with `apps/web/src/app/auth/confirm/route.ts`.

| File                | Supabase template                          | Suggested subject                          | Link target                              |
| ------------------- | ------------------------------------------ | ------------------------------------------ | ---------------------------------------- |
| `confirmation.html` | Confirm signup                             | `Confirm your email · LifeNavigator`       | `type=signup` → `/onboarding`            |
| `magic_link.html`   | Magic Link                                 | `Your LifeNavigator sign-in link`          | `type=magiclink` → `/dashboard`          |
| `recovery.html`     | Reset Password                             | `Reset your LifeNavigator password`        | `type=recovery` → `/auth/password-reset` |
| `invite.html`       | Invite user                                | `You're invited to the LifeNavigator beta` | `type=invite` → `/onboarding`            |
| `welcome.html`      | _app-level_ (not a Supabase auth template) | `Welcome to LifeNavigator`                 | `/dashboard` (no token)                  |

`{{ .SiteURL }}` resolves to the Supabase **Site URL** (set to `https://app.lifenavigator.tech`).

## Apply (Management API — needs an `sbp_` access token)

```bash
REF=diwkyyahglnqmyledsey
export SUPABASE_ACCESS_TOKEN=sbp_xxx
cd supabase/email-templates
jq -n \
  --rawfile c confirmation.html --rawfile m magic_link.html \
  --rawfile r recovery.html --rawfile i invite.html \
  '{
    mailer_subjects_confirmation: "Confirm your email · LifeNavigator",
    mailer_templates_confirmation_content: $c,
    mailer_subjects_magic_link: "Your LifeNavigator sign-in link",
    mailer_templates_magic_link_content: $m,
    mailer_subjects_recovery: "Reset your LifeNavigator password",
    mailer_templates_recovery_content: $r,
    mailer_subjects_invite: "You'\''re invited to the LifeNavigator beta",
    mailer_templates_invite_content: $i
  }' | curl -sS -X PATCH \
    "https://api.supabase.com/v1/projects/$REF/config/auth" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" --data @- | jq '.mailer_subjects_confirmation'
```

## Apply (dashboard, no token)

Supabase → Authentication → Email Templates → for each template, paste the file's
contents into the **Message body (HTML)** and set the subject from the table above.

## Notes

- `welcome.html` is for the app-level mailer (`src/lib/email/email-service.ts`), sent
  after activation — not a Supabase auth email.
- Logo: uses a typographic wordmark (the `/public/LifeNavigator.png` asset is 1.47 MB,
  too heavy for email). To use the image instead, host a small (<20 KB) version and
  swap the wordmark `<span>` for an `<img>`.
