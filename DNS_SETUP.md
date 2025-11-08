# DNS Setup for Subdomain Deployments

## Problem
For subdomains like `mysite.ltpd.xyz` to work, your DNS provider needs to know that ALL subdomains should point to Vercel.

## Solution: Add a Wildcard DNS Record

### Step 1: Go to Your DNS Provider
- **Common providers**: Vercel Domains, Namecheap, GoDaddy, Cloudflare, Route53, etc.

### Step 2: Add a Wildcard Record
Add a new DNS record with these settings:

\`\`\`
Type: CNAME
Name: *.ltpd.xyz (or just *)
Value: cname.vercel-dns.com
\`\`\`

OR if using an A record:

\`\`\`
Type: A
Name: *.ltpd.xyz (or just *)
Value: 76.76.19.132
\`\`\`

### Step 3: Verify in Vercel
1. Go to Vercel Project Settings → Domains
2. Make sure `ltpd.xyz` is configured with Vercel
3. Wildcard should automatically apply to all subdomains

### Example: Cloudflare
1. Domain Management → DNS
2. Add Record:
   - Type: CNAME
   - Name: *
   - Content: cname.vercel-dns.com
   - TTL: Auto

### Example: Vercel Domains
1. Project Settings → Domains
2. Add Domain: `*.ltpd.xyz`
3. Configure DNS at your registrar

## How It Works
- Main: `ltpd.xyz` → Dashboard
- Subdomains: `*.ltpd.xyz` → Deployed user sites (routed by middleware)
  - `businessname.ltpd.xyz` → Routed to `/sites/businessname`
  - `myshop.ltpd.xyz` → Routed to `/sites/myshop`
  - etc.

## Testing
After DNS is configured (may take 5-15 minutes):
1. Create a project called "test"
2. Deploy it with subdomain "test"
3. Visit `test.ltpd.xyz` in your browser
4. Check browser console and Vercel logs for `[v0]` debug messages

## Troubleshooting

### Subdomain doesn't resolve
- Check DNS propagation: `nslookup test.ltpd.xyz`
- Wait for DNS cache to clear (5-15 minutes)
- Verify wildcard record is in place

### Getting 404 on subdomain
- Check server logs in Vercel for `[v0]` messages
- Verify deployment was created in MongoDB (check dashboard)
- Check middleware is catching the subdomain (look for "Subdomain detected" in logs)

### Site shows dashboard instead of user site
- Middleware might not be routing correctly
- Check logs for "Rewriting to sites page" message
- Verify subdomain format matches what's in database
