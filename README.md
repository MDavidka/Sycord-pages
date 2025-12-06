# Sycord Pages

A platform for creating and deploying websites with AI-powered tools.

## Features

- Create custom websites with AI assistance
- Deploy to Vercel with one click
- Manage multiple projects
- Subdomain support for each site

## Deploy Your Own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FEdev-s%2FSycord-pages&project-name=sycord-pages&repository-name=sycord-pages)

Click the button above to deploy your own instance of Sycord Pages to Vercel.

## Getting Started

1. Clone this repository
2. Install dependencies: `npm install --legacy-peer-deps`
3. Set up environment variables
4. Run the development server: `npm run dev`

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# MongoDB
MONGODB_URI=your_mongodb_connection_string

# NextAuth
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Vercel (for deployments)
VERCEL_CLIENT_ID=your_vercel_client_id
VERCEL_CLIENT_SECRET=your_vercel_client_secret
VERCEL_REDIRECT_URI=your_vercel_redirect_uri
```

## DNS Setup

For subdomain deployments to work, you need to configure wildcard DNS. See [DNS_SETUP.md](./DNS_SETUP.md) for detailed instructions.

## License

MIT
