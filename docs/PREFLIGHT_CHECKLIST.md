# Pre-Flight Checklist — Deployment Setup

Complete every item here **before** asking Claude to write any deployment code. These are all account and cloud configuration steps — nothing in the codebase changes until this list is done.

---

## 1. Domain

- [ ] Confirm production domain (e.g., `aicmoterminal.com`)
- [ ] Plan subdomains: `app.yourdomain.com` → Netlify (frontend), `api.yourdomain.com` → AWS ALB (backend)

---

## 2. AWS Account

- [ ] Create or confirm AWS account
- [ ] Enable MFA on root account — do this before anything else
- [ ] Create a deployment IAM user (not root) with these permissions:
  - `AmazonECS_FullAccess`
  - `AmazonEC2ContainerRegistryFullAccess`
  - `ElasticLoadBalancingFullAccess`
  - `AmazonSSMReadOnlyAccess`
  - `CloudWatchFullAccess`
- [ ] Generate Access Key + Secret Key for this IAM user → save both for GitHub Actions CI secrets

---

## 3. AWS Parameter Store

In AWS Console → Systems Manager → Parameter Store, create each of these as a **SecureString** under the path `/aicmo/prod/`:

- [ ] `/aicmo/prod/SUPABASE_URL`
- [ ] `/aicmo/prod/SUPABASE_KEY` — use the **service role** key, not the anon key
- [ ] `/aicmo/prod/GEMINI_API_KEY`
- [ ] `/aicmo/prod/FIRECRAWL_API_KEY`
- [ ] `/aicmo/prod/SERPER_API_KEY`
- [ ] `/aicmo/prod/RESEND_API_KEY`
- [ ] `/aicmo/prod/CORS_ORIGINS` — set to `https://app.yourdomain.com` (update once domain is confirmed)
- [ ] `/aicmo/prod/RESEND_FROM_EMAIL` — set to `AI CMO <noreply@yourdomain.com>` (must match verified Resend sender)
- [ ] `/aicmo/prod/USE_MOCK_APIFY` — set to `true` (leave true until deliberate live testing)

---

## 4. AWS ECR — Container Registry

- [ ] Go to AWS Console → ECR → Create repository
- [ ] Name: `aicmo-backend`
- [ ] Visibility: Private
- [ ] Note the repository URI: `ACCOUNT_ID.dkr.ecr.REGION.amazonaws.com/aicmo-backend`

---

## 5. AWS ECS — Cluster

- [ ] Go to ECS → Clusters → Create Cluster
- [ ] Name: `aicmo-cluster`
- [ ] Infrastructure: **AWS Fargate** (serverless)
- [ ] Enable CloudWatch Container Insights: Yes

---

## 6. AWS ALB — Application Load Balancer

- [ ] Create ALB: `aicmo-alb`, scheme: Internet-facing
- [ ] Request an ACM certificate for `api.yourdomain.com` (free via AWS Certificate Manager — takes a few minutes)
- [ ] Create a target group: `aicmo-tg`, type IP, port 8000, health check path `/health`
- [ ] Add HTTPS listener: port 443 → forward to `aicmo-tg`

---

## 7. Security Groups

- [ ] **ALB Security Group**: allow inbound 443 from `0.0.0.0/0`
- [ ] **ECS Task Security Group**: allow inbound port 8000 **from the ALB Security Group only** — never directly from the internet

---

## 8. AWS Billing Alarms

- [ ] In AWS Billing console: enable "Receive Billing Alerts" (requires opt-in — it's off by default)
- [ ] Create CloudWatch alarm: $30/month → SNS topic → your email (warning)
- [ ] Create CloudWatch alarm: $60/month → SNS topic → your email (critical)

---

## 9. External API Spending Caps

Set these in each provider's dashboard before going live:

- [ ] **Serper.dev**: Log in → Billing → set monthly credit ceiling
- [ ] **Firecrawl**: Log in → set monthly crawl limit
- [ ] **Google AI Studio**: Log in → IAM & Admin → Quotas → set Gemini API request quotas

---

## 10. Netlify Account Setup

- [ ] Create Netlify account (or use existing)
- [ ] New site → Import from GitHub → select this repo
- [ ] Set base directory: `frontend`
- [ ] Set build command: `npm run build`
- [ ] Set publish directory: `frontend/.next`
- [ ] **Do NOT trigger a deploy yet** — environment variables must be added first (Step 11)

---

## 11. Netlify Environment Variables

In Netlify UI → Site Settings → Environment Variables, add all of these:

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `NEXT_PUBLIC_API_BASE_URL` = `https://api.yourdomain.com`
- [ ] `NEXTAUTH_SECRET` — generate with: `openssl rand -base64 32`
- [ ] `NEXTAUTH_URL` = `https://app.yourdomain.com`
- [ ] `ALLOWED_EMAILS` = comma-separated list of allowed login emails (e.g., `you@x.com,teammate@x.com`)
- [ ] `EMAIL_SERVER_HOST` = `smtp.resend.com`
- [ ] `EMAIL_SERVER_PORT` = `465`
- [ ] `EMAIL_SERVER_USER` = `resend`
- [ ] `EMAIL_SERVER_PASSWORD` = your Resend API key
- [ ] `EMAIL_FROM` = verified sender address (e.g., `noreply@yourdomain.com`)

---

## 12. Resend — Verify Sender Domain

- [ ] Log into Resend → Domains → Add Domain → enter `yourdomain.com`
- [ ] Add the DNS records Resend provides: SPF, DKIM, DMARC
- [ ] Wait for domain verification (5–30 min for DNS propagation)
- [ ] This unblocks both magic link auth emails and the weekly digest sender

---

## 13. Supabase — Row Level Security

Run this SQL in Supabase → SQL Editor:

```sql
-- analysis_jobs: readable by anyone with the job_id (UUIDs are unguessable)
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_by_job_id" ON analysis_jobs FOR SELECT USING (true);

-- watchlist: users can only see their own rows
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_rows" ON watchlist USING (user_email = auth.jwt() ->> 'email');
```

- [ ] Run the SQL above
- [ ] Verify: use the anon key to `SELECT * FROM watchlist` for a different user's email — should return empty

---

## 14. DNS Configuration

Once Netlify and the ALB are provisioned:

- [ ] Point `app.yourdomain.com` → Netlify's provided DNS target (CNAME or A record)
- [ ] Point `api.yourdomain.com` → ALB DNS name (from Step 6)
- [ ] Optional but recommended: proxy both through Cloudflare (orange cloud) for WAF and edge rate limiting

---

## Done?

Once every checkbox above is ticked, come back and say **"pre-flight complete"** — that's the signal to start writing deployment code.
