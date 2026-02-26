# Supabase Auth + Email Verification Setup

This guide fixes the "spinning" verification link and sets up Resend for custom emails.

---

## 1. Supabase URL configuration

The verification link redirects to the wrong URL if Supabase isn’t configured correctly.

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project
2. **Authentication** → **URL Configuration**
3. Set:

| Setting | Value |
|---------|-------|
| **Site URL** | `https://athrogoals.netlify.app` |
| **Redirect URLs** | Add these (one per line): |
| | `https://athrogoals.netlify.app/**` |
| | `https://athrogoals.netlify.app/api/auth/callback` |
| | `http://localhost:3000/**` |
| | `http://localhost:3000/api/auth/callback` |

4. **Save**

---

## 2. Why the link was spinning

The verification link had `redirect_to=http://localhost:3000` because:

- You signed up from localhost, so `emailRedirectTo` was localhost, or
- Supabase was using the default Site URL (localhost).

The app now prefers `NEXT_PUBLIC_APP_URL` when it’s set and not localhost, so production signups redirect to the production callback.

---

## 3. Resend SMTP (custom emails)

To send auth emails via Resend instead of Supabase’s default:

1. Go to [Resend](https://resend.com) → **API Keys** → create an API key
2. In Supabase: **Project Settings** → **Authentication** → **SMTP Settings**
3. Enable **Custom SMTP**
4. Fill in:

| Field | Value |
|-------|-------|
| **Sender email** | `noreply@yourdomain.com` (must be a verified Resend domain) |
| **Sender name** | `Athro Goals` |
| **Host** | `smtp.resend.com` |
| **Port** | `465` |
| **Username** | `resend` |
| **Password** | Your Resend API key |

5. **Save**

---

## 4. Custom email templates (optional)

Supabase uses built‑in templates by default. To customize them:

1. **Authentication** → **Email Templates**
2. Edit **Confirm signup** (and others if needed)
3. Use `{{ .ConfirmationURL }}` for the verification link
4. Use `{{ .SiteURL }}` for your app URL

Example:

```html
<h2>Confirm your signup</h2>
<p>Click the link below to verify your email:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm email</a></p>
```

---

## 5. Environment variables

Ensure these are set in Netlify:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_APP_URL` | `https://athrogoals.netlify.app` |

This is used for `emailRedirectTo` in production.

---

## 6. Checklist

- [ ] Supabase **Site URL** = `https://athrogoals.netlify.app`
- [ ] Supabase **Redirect URLs** include production and localhost URLs
- [ ] `NEXT_PUBLIC_APP_URL` set in Netlify
- [ ] Resend SMTP configured in Supabase (optional)
- [ ] Trigger a new deploy after adding env vars

---

## 7. Testing

1. Sign up from **https://athrogoals.netlify.app/register**
2. Check the confirmation email
3. Click the link – it should land on `/api/auth/callback` and then redirect to the app
4. You should be logged in and redirected to the dashboard
