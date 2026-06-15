// Base Next.js (App Router) + TypeScript + Tailwind project template
// This is auto-generated when a new chat is created. It is deployable with
// `npm run build` (Next.js production build) — NOT a Vite SPA.

export const BASE_PROJECT_FILES: Record<string, { file: { contents: string } }> = {
  'package.json': {
    file: {
      contents: `{
  "name": "nextjs-app",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "lucide-react": "^0.408.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.4.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.10",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.6",
    "typescript": "^5.5.3"
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
// see https://nextjs.org/docs/basic-features/typescript for more information.`
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
    <main className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to Your App
        </h1>
        <p className="text-gray-600">
          Start editing app/page.tsx to build your application
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
@tailwind utilities;`
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
