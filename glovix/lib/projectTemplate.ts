// Base Vite + React + TypeScript + Tailwind project template (no shadcn).
//
// This is the clean generation baseline (aligned with GlovixTech): the AI builds
// a client-side React SPA that previews live in the in-browser WebContainer
// (`npm run dev`) and deploys to the Syte VPS (https://sycord.site/api/) which
// builds it in Docker (`npm run build` → static `dist/`) and serves it.

export const BASE_PROJECT_FILES: Record<string, { file: { contents: string } }> = {
  'package.json': {
    file: {
      contents: `{
  "name": "vite-react-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0 || true"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "lucide-react": "^0.408.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.4.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.6",
    "typescript": "^5.5.3",
    "vite": "^5.3.4"
  }
}`
    }
  },
  'vite.config.ts': {
    file: {
      contents: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
  },
})`
    }
  },
  'tsconfig.json': {
    file: {
      contents: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}`
    }
  },
  'tailwind.config.js': {
    file: {
      contents: `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
}`
    }
  },
  'postcss.config.js': {
    file: {
      contents: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`
    }
  },
  'index.html': {
    file: {
      contents: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
    }
  },
  'src/main.tsx': {
    file: {
      contents: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`
    }
  },
  'src/App.tsx': {
    file: {
      contents: `export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-3">Welcome to your app</h1>
        <p className="text-gray-500">Start editing src/App.tsx to build your site.</p>
      </div>
    </div>
  )
}`
    }
  },
  'src/index.css': {
    file: {
      contents: `@tailwind base;
@tailwind components;
@tailwind utilities;`
    }
  },
  'lib/utils.ts': {
    file: {
      contents: `import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}`
    }
  },
  // Docker build recipe used by the Syte deployer (issue_deploy): build the Vite
  // SPA and serve the static output. Syte runs `docker build` then starts the
  // container; the app listens on $PORT (default 3000).
  'Dockerfile': {
    file: {
      contents: `# syntax=docker/dockerfile:1
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/dist ./dist
ENV PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "serve -s dist -l \${PORT:-3000}"]`
    }
  },
  '.dockerignore': {
    file: {
      contents: `node_modules
dist
.git
.glovix`
    }
  },
};

// Get file list as string for AI context
export function getProjectStructure(): string {
  const paths = Object.keys(BASE_PROJECT_FILES).sort();
  const tree: string[] = ['Project structure:'];

  for (const path of paths) {
    const depth = path.split('/').length - 1;
    const indent = '  '.repeat(depth);
    const name = path.split('/').pop() || path;
    tree.push(`${indent}${name}`);
  }

  return tree.join('\n');
}

/**
 * Base project files for a new chat/project. Preset arg kept for signature
 * compatibility but no longer injects shadcn presets (Vite + plain React now).
 */
export function getBaseProjectFiles(_presetId?: string): Record<string, { file: { contents: string } }> {
  return { ...BASE_PROJECT_FILES }
}

/** No preset system in the Vite baseline — kept for import compatibility. */
export function getPresetDescription(_presetId?: string): string {
  return ''
}
