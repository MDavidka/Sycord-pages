// Base Next.js (App Router) + TypeScript + Tailwind project template.
// This is auto-generated when a new chat is created.
//
// The Sycord VM runner deploys generated projects by running:
//   npm install --legacy-peer-deps  →  npm run build (next build)  →  npm run start (next start)
// so this template MUST build cleanly with `npm run build` and serve HTML at `/`.
// `next start` automatically honors the PORT / HOSTNAME env vars the runner sets,
// so the scripts intentionally do NOT hardcode a port.

export const BASE_PROJECT_FILES: Record<string, { file: { contents: string } }> = {
  'package.json': {
    file: {
      contents: `{
  "name": "nextjs-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.460.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.15",
    "typescript": "^5.6.3"
  }
}`
    }
  },
  'next.config.mjs': {
    file: {
      contents: `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;`
    }
  },
  'tsconfig.json': {
    file: {
      contents: `{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`
    }
  },
  'next-env.d.ts': {
    file: {
      contents: `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/building-your-application/configuring/typescript for more information.`
    }
  },
  'postcss.config.mjs': {
    file: {
      contents: `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;`
    }
  },
  'tailwind.config.ts': {
    file: {
      contents: `import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;`
    }
  },
  'lib/utils.ts': {
    file: {
      contents: `import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// shadcn/ui style class merge helper.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}`
    }
  },
  'app/layout.tsx': {
    file: {
      contents: `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Next.js App",
  description: "Built with Syra on the Sycord platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}`
    }
  },
  'app/page.tsx': {
    file: {
      contents: `export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center px-6">
      <div className="text-center max-w-xl">
        <h1 className="text-4xl font-bold mb-4">Welcome to Your App</h1>
        <p className="text-gray-400">
          Start editing <code className="rounded bg-gray-800 px-1.5 py-0.5 text-gray-200">app/page.tsx</code> to build your application.
        </p>
      </div>
    </main>
  );
}`
    }
  },
  'app/globals.css': {
    file: {
      contents: `@tailwind base;
@tailwind components;
@tailwind utilities;

html,
body {
  background-color: #030712;
  color: #f3f4f6;
}`
    }
  }
};

// Get file list as string for AI context
export function getProjectStructure(): string {
  const paths = Object.keys(BASE_PROJECT_FILES).sort();
  const tree: string[] = ['Project structure:'];

  for (const path of paths) {
    const depth = path.split('/').length - 1;
    const indent = '  '.repeat(depth);
    const name = path.split('/').pop() || path;
    tree.push(`${indent}📄 ${name}`);
  }

  return tree.join('\n');
}
