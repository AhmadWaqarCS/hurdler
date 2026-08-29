import type { ModuleDefinition, ModuleBundle } from './types.js';

export const STATIC_MODULES: Record<string, ModuleDefinition> = {
  // -------------------------------------------------------------
  // Validation & Schema
  // -------------------------------------------------------------
  zod: {
    name: 'zod',
    displayName: 'Zod TypeScript Schema Validation',
    category: 'validation',
    description: 'TypeScript-first schema declaration and validation library with static type inference.',
    docUrl: 'https://zod.dev',
    repoUrl: 'https://github.com/colinhacks/zod',
    npmUrl: 'https://www.npmjs.com/package/zod',
    recommendedVersion: '^3.23.8',
    pinnedVersion: '3.23.8',
    minNodeVersion: '>=16.0.0',
    isDevDependency: false,
    runtime: ['node', 'browser', 'edge', 'universal'],
    packageType: 'esm',
    tags: ['schema', 'validation', 'typescript', 'typesafe', 'json'],
    peerDependencies: [],
    recommendedCompanions: [],
    bestPractices: [
      'Use z.infer<typeof Schema> to extract static TypeScript types directly from schemas.',
      'Use .safeParse(data) instead of .parse(data) for robust non-throwing error handling.',
      'Use .min(1) instead of deprecated .nonempty() for strings.',
      'Leverage .refine() or .superRefine() for custom cross-field validation rules.',
    ],
    antiPatterns: [
      'Do not call deprecated z.string().nonempty(); use z.string().min(1).',
      'Do not duplicate TypeScript interfaces manually when z.infer is available.',
      'Do not throw raw Zod errors to HTTP clients without formatting issues.',
    ],
    exampleUsage: `import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  age: z.number().int().min(0).optional(),
});

export type User = z.infer<typeof UserSchema>;

export function validateUser(input: unknown): User {
  const result = UserSchema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}`,
  },

  valibot: {
    name: 'valibot',
    displayName: 'Valibot Modular Validation',
    category: 'validation',
    description: 'Modular, tree-shakeable schema library for data validation with minimal bundle footprint.',
    docUrl: 'https://valibot.dev',
    repoUrl: 'https://github.com/fabian-hiller/valibot',
    npmUrl: 'https://www.npmjs.com/package/valibot',
    recommendedVersion: '^0.36.0',
    pinnedVersion: '0.36.0',
    minNodeVersion: '>=16.0.0',
    isDevDependency: false,
    runtime: ['node', 'browser', 'edge', 'universal'],
    packageType: 'esm',
    tags: ['schema', 'validation', 'tree-shaking', 'lightweight'],
    peerDependencies: [],
    recommendedCompanions: [],
    bestPractices: [
      'Use individual function imports (e.g. object, string, email, pipe) to maximize tree-shaking efficiency.',
      'Use v.InferOutput<typeof Schema> for inferring TypeScript output types.',
    ],
    antiPatterns: [
      'Do not import monolithic namespaces when tree-shaking is desired.',
    ],
    exampleUsage: `import * as v from 'valibot';

export const Schema = v.object({
  username: v.pipe(v.string(), v.minLength(3)),
  email: v.pipe(v.string(), v.email()),
});

export type UserData = v.InferOutput<typeof Schema>;`,
  },

  // -------------------------------------------------------------
  // Databases & ORMs
  // -------------------------------------------------------------
  prisma: {
    name: 'prisma',
    displayName: 'Prisma CLI & Schema Engine',
    category: 'orm_database',
    description: 'Next-generation ORM and database toolkit CLI for migrations and code generation.',
    docUrl: 'https://www.prisma.io/docs',
    repoUrl: 'https://github.com/prisma/prisma',
    npmUrl: 'https://www.npmjs.com/package/prisma',
    recommendedVersion: '^5.22.0',
    pinnedVersion: '5.22.0',
    minNodeVersion: '>=18.18.0',
    isDevDependency: true,
    runtime: ['node'],
    packageType: 'esm',
    tags: ['orm', 'database', 'sql', 'postgres', 'mysql', 'sqlite', 'schema'],
    peerDependencies: [],
    recommendedCompanions: ['@prisma/client'],
    bestPractices: [
      'Install prisma as a devDependency and @prisma/client as a runtime dependency.',
      'Run npx prisma generate after modifying schema.prisma.',
      'Keep database migrations in source control using prisma migrate dev.',
    ],
    antiPatterns: [
      'Do not install prisma as a runtime production dependency.',
      'Do not commit generated prisma client artifacts to git directly.',
    ],
    exampleUsage: `// schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}`,
  },

  '@prisma/client': {
    name: '@prisma/client',
    displayName: 'Prisma Client Runtime',
    category: 'orm_database',
    description: 'Type-safe database client auto-generated from your Prisma schema.',
    docUrl: 'https://www.prisma.io/docs/concepts/components/prisma-client',
    repoUrl: 'https://github.com/prisma/prisma',
    npmUrl: 'https://www.npmjs.com/package/@prisma/client',
    recommendedVersion: '^5.22.0',
    pinnedVersion: '5.22.0',
    minNodeVersion: '>=18.18.0',
    isDevDependency: false,
    runtime: ['node'],
    packageType: 'esm',
    tags: ['orm', 'database', 'prisma', 'sql', 'query-builder'],
    peerDependencies: ['prisma'],
    recommendedCompanions: ['prisma'],
    bestPractices: [
      'Instantiate PrismaClient as a singleton in globalThis for Next.js and dev environments to prevent connection leaks during hot reloading.',
      'Use select and include judiciously to optimize SQL query payload sizes.',
      'Leverage prisma.$transaction for atomic multi-step database operations.',
    ],
    antiPatterns: [
      'Never instantiate new PrismaClient() inside individual route handlers or request lifecycles.',
      'Do not use raw SQL queries when Prisma typed queries can achieve the result safely.',
    ],
    exampleUsage: `import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}`,
  },

  'drizzle-orm': {
    name: 'drizzle-orm',
    displayName: 'Drizzle ORM',
    category: 'orm_database',
    description: 'Headless, type-safe TypeScript ORM with zero dependencies and SQL-like ergonomics.',
    docUrl: 'https://orm.drizzle.team/docs/overview',
    repoUrl: 'https://github.com/drizzle-team/drizzle-orm',
    npmUrl: 'https://www.npmjs.com/package/drizzle-orm',
    recommendedVersion: '^0.36.4',
    pinnedVersion: '0.36.4',
    minNodeVersion: '>=18.0.0',
    isDevDependency: false,
    runtime: ['node', 'edge', 'browser', 'universal'],
    packageType: 'esm',
    tags: ['orm', 'database', 'sql', 'postgres', 'sqlite', 'mysql', 'type-safe'],
    peerDependencies: [],
    recommendedCompanions: ['drizzle-kit', 'pg'],
    bestPractices: [
      'Define schemas in modular schema files and export them to pass into drizzle(client, { schema }).',
      'Use drizzle relational queries (db.query.users.findMany) for intuitive nested querying.',
      'Use drizzle-kit for automated SQL migration generation.',
    ],
    antiPatterns: [
      'Do not mix different SQL dialect drivers in the same schema definition.',
    ],
    exampleUsage: `import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema: { users } });`,
  },

  'drizzle-kit': {
    name: 'drizzle-kit',
    displayName: 'Drizzle Kit CLI',
    category: 'orm_database',
    description: 'CLI companion for Drizzle ORM to generate migrations and inspect database schemas.',
    docUrl: 'https://orm.drizzle.team/docs/kit-overview',
    repoUrl: 'https://github.com/drizzle-team/drizzle-kit',
    npmUrl: 'https://www.npmjs.com/package/drizzle-kit',
    recommendedVersion: '^0.28.1',
    pinnedVersion: '0.28.1',
    isDevDependency: true,
    runtime: ['node'],
    packageType: 'esm',
    tags: ['orm', 'cli', 'migrations', 'drizzle'],
    peerDependencies: ['drizzle-orm'],
    recommendedCompanions: ['drizzle-orm'],
    bestPractices: [
      'Configure drizzle.config.ts with dialect, schema path, and out directory.',
      'Use drizzle-kit generate for version-controlled migration files.',
    ],
    exampleUsage: `// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});`,
  },

  pg: {
    name: 'pg',
    displayName: 'node-postgres (pg)',
    category: 'orm_database',
    description: 'Non-blocking PostgreSQL client for Node.js.',
    docUrl: 'https://node-postgres.com',
    repoUrl: 'https://github.com/brianc/node-postgres',
    npmUrl: 'https://www.npmjs.com/package/pg',
    recommendedVersion: '^8.13.1',
    pinnedVersion: '8.13.1',
    isDevDependency: false,
    runtime: ['node'],
    packageType: 'dual',
    tags: ['postgres', 'sql', 'database', 'driver'],
    peerDependencies: [],
    recommendedCompanions: ['@types/pg'],
    bestPractices: [
      'Use a Pool instance rather than creating single Client instances per query.',
      'Install @types/pg as devDependency for complete TypeScript support.',
      'Always parameterize SQL queries ($1, $2) to prevent SQL injection.',
    ],
    antiPatterns: [
      'Never interpolate raw strings directly into SQL queries.',
    ],
    exampleUsage: `import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
});`,
  },

  '@types/pg': {
    name: '@types/pg',
    displayName: 'TypeScript Definitions for pg',
    category: 'orm_database',
    description: 'TypeScript typings for the node-postgres package.',
    docUrl: 'https://node-postgres.com',
    recommendedVersion: '^8.11.10',
    pinnedVersion: '8.11.10',
    isDevDependency: true,
    runtime: ['node'],
    packageType: 'esm',
    tags: ['types', 'postgres', 'typescript'],
    peerDependencies: ['pg'],
  },

  ioredis: {
    name: 'ioredis',
    displayName: 'ioredis',
    category: 'orm_database',
    description: 'Robust, performance-focused Redis client for Node.js supporting Cluster, Sentinel, and Pipelines.',
    docUrl: 'https://ioredis.readthedocs.io',
    repoUrl: 'https://github.com/redis/ioredis',
    npmUrl: 'https://www.npmjs.com/package/ioredis',
    recommendedVersion: '^5.4.1',
    pinnedVersion: '5.4.1',
    isDevDependency: false,
    runtime: ['node'],
    packageType: 'dual',
    tags: ['redis', 'cache', 'key-value', 'nosql'],
    peerDependencies: [],
    recommendedCompanions: [],
    bestPractices: [
      'Reuse Redis connection instances via singleton patterns.',
      'Set key TTL expiration policies to prevent memory leaks.',
    ],
    exampleUsage: `import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');`,
  },

  // -------------------------------------------------------------
  // Frontend Frameworks & Libraries
  // -------------------------------------------------------------
  next: {
    name: 'next',
    displayName: 'Next.js React Framework',
    category: 'framework_frontend',
    description: 'The React Framework for the Web with App Router, Server Components, SSR, and API routes.',
    docUrl: 'https://nextjs.org/docs',
    repoUrl: 'https://github.com/vercel/next.js',
    npmUrl: 'https://www.npmjs.com/package/next',
    recommendedVersion: '^14.2.18',
    pinnedVersion: '14.2.18',
    minNodeVersion: '>=18.18.0',
    isDevDependency: false,
    runtime: ['node', 'edge'],
    packageType: 'esm',
    tags: ['react', 'nextjs', 'framework', 'ssr', 'app-router', 'server-components'],
    peerDependencies: ['react', 'react-dom'],
    recommendedCompanions: ['react', 'react-dom', 'tailwindcss', 'lucide-react'],
    bestPractices: [
      'Use the App Router (/app directory) with React Server Components by default.',
      'Mark client-interactive components with "use client" directive at the top.',
      'Use Server Actions or Route Handlers (/app/api/.../route.ts) for mutations.',
      'Utilize next/image and next/font for automatic core web vitals optimizations.',
    ],
    antiPatterns: [
      'Do not mix legacy Pages Router (/pages) with App Router in new architectures.',
      'Do not use "use client" on entire pages when only small subcomponents need interactivity.',
      'Do not import server-only modules in client components.',
    ],
    exampleUsage: `// app/page.tsx
export default async function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Welcome to Next.js</h1>
    </main>
  );
}`,
  },

  react: {
    name: 'react',
    displayName: 'React Core',
    category: 'framework_frontend',
    description: 'JavaScript library for building user interfaces with declarative component architecture.',
    docUrl: 'https://react.dev',
    repoUrl: 'https://github.com/facebook/react',
    npmUrl: 'https://www.npmjs.com/package/react',
    recommendedVersion: '^18.3.1',
    pinnedVersion: '18.3.1',
    minNodeVersion: '>=16.0.0',
    isDevDependency: false,
    runtime: ['browser', 'node', 'edge', 'universal'],
    packageType: 'esm',
    tags: ['react', 'ui', 'components', 'frontend', 'jsx'],
    peerDependencies: [],
    recommendedCompanions: ['react-dom', '@types/react', '@types/react-dom'],
    bestPractices: [
      'Keep state local and minimize unnecessary re-renders.',
      'Use hooks (useState, useEffect, useMemo, useCallback) following the Rules of Hooks.',
    ],
    antiPatterns: [
      'Do not call hooks inside loops, conditions, or nested functions.',
    ],
    exampleUsage: `import React, { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button>;
}`,
  },

  'react-dom': {
    name: 'react-dom',
    displayName: 'React DOM Renderer',
    category: 'framework_frontend',
    description: 'DOM-specific methods and renderer for React.',
    docUrl: 'https://react.dev/reference/react-dom',
    repoUrl: 'https://github.com/facebook/react',
    npmUrl: 'https://www.npmjs.com/package/react-dom',
    recommendedVersion: '^18.3.1',
    pinnedVersion: '18.3.1',
    isDevDependency: false,
    runtime: ['browser', 'node'],
    packageType: 'esm',
    tags: ['react', 'dom', 'renderer'],
    peerDependencies: ['react'],
    recommendedCompanions: ['react', '@types/react-dom'],
  },

  '@types/react': {
    name: '@types/react',
    displayName: 'TypeScript Definitions for React',
    category: 'framework_frontend',
    description: 'TypeScript typings for React.',
    docUrl: 'https://react.dev',
    recommendedVersion: '^18.3.12',
    pinnedVersion: '18.3.12',
    isDevDependency: true,
    runtime: ['node'],
    packageType: 'esm',
    tags: ['types', 'react', 'typescript'],
    peerDependencies: [],
  },

  '@types/react-dom': {
    name: '@types/react-dom',
    displayName: 'TypeScript Definitions for React DOM',
    category: 'framework_frontend',
    description: 'TypeScript typings for React DOM.',
    docUrl: 'https://react.dev',
    recommendedVersion: '^18.3.1',
    pinnedVersion: '18.3.1',
    isDevDependency: true,
    runtime: ['node'],
    packageType: 'esm',
    tags: ['types', 'react-dom', 'typescript'],
    peerDependencies: ['@types/react'],
  },

  // -------------------------------------------------------------
  // Backend Frameworks
  // -------------------------------------------------------------
  express: {
    name: 'express',
    displayName: 'Express.js Web Framework',
    category: 'framework_backend',
    description: 'Fast, unopinionated, minimalist web framework for Node.js.',
    docUrl: 'https://expressjs.com',
    repoUrl: 'https://github.com/expressjs/express',
    npmUrl: 'https://www.npmjs.com/package/express',
    recommendedVersion: '^4.21.1',
    pinnedVersion: '4.21.1',
    minNodeVersion: '>=18.0.0',
    isDevDependency: false,
    runtime: ['node'],
    packageType: 'dual',
    tags: ['express', 'backend', 'http', 'api', 'rest'],
    peerDependencies: [],
    recommendedCompanions: ['@types/express', 'cors', 'dotenv', 'zod'],
    bestPractices: [
      'Install @types/express for full TypeScript typing.',
      'Use express.json() middleware for JSON parsing.',
      'Always implement a centralized error handling middleware (err, req, res, next).',
    ],
    antiPatterns: [
      'Do not forget next(err) in asynchronous error catch blocks.',
    ],
    exampleUsage: `import express from 'express';

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(3000, () => {
  console.log('Server listening on port 3000');
});`,
  },

  '@types/express': {
    name: '@types/express',
    displayName: 'TypeScript Definitions for Express',
    category: 'framework_backend',
    description: 'TypeScript definitions for Express.',
    docUrl: 'https://expressjs.com',
    recommendedVersion: '^5.0.0',
    pinnedVersion: '5.0.0',
    isDevDependency: true,
    runtime: ['node'],
    packageType: 'esm',
    tags: ['types', 'express', 'typescript'],
    peerDependencies: ['express'],
  },

  '@nestjs/core': {
    name: '@nestjs/core',
    displayName: 'NestJS Core Engine',
    category: 'framework_backend',
    description: 'A progressive Node.js framework for building scalable enterprise server-side applications.',
    docUrl: 'https://docs.nestjs.com',
    repoUrl: 'https://github.com/nestjs/nest',
    npmUrl: 'https://www.npmjs.com/package/@nestjs/core',
    recommendedVersion: '^10.4.8',
    pinnedVersion: '10.4.8',
    minNodeVersion: '>=18.0.0',
    isDevDependency: false,
    runtime: ['node'],
    packageType: 'esm',
    tags: ['nestjs', 'backend', 'enterprise', 'ioc', 'typescript', 'decorators'],
    peerDependencies: ['@nestjs/common', 'rxjs', 'reflect-metadata'],
    recommendedCompanions: ['@nestjs/common', 'rxjs', 'reflect-metadata'],
    bestPractices: [
      'Follow modular architecture with @Module, @Controller, and @Injectable providers.',
      'Use NestJS built-in ValidationPipe with class-validator or Zod.',
    ],
    exampleUsage: `import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}
bootstrap();`,
  },

  '@nestjs/common': {
    name: '@nestjs/common',
    displayName: 'NestJS Common Components',
    category: 'framework_backend',
    description: 'Common decorators, utilities, and primitives for NestJS applications.',
    docUrl: 'https://docs.nestjs.com',
    repoUrl: 'https://github.com/nestjs/nest',
    npmUrl: 'https://www.npmjs.com/package/@nestjs/common',
    recommendedVersion: '^10.4.8',
    pinnedVersion: '10.4.8',
    isDevDependency: false,
    runtime: ['node'],
    packageType: 'esm',
    tags: ['nestjs', 'backend', 'decorators'],
    peerDependencies: ['@nestjs/core'],
    recommendedCompanions: ['@nestjs/core'],
  },

  hono: {
    name: 'hono',
    displayName: 'Hono Multi-Runtime Framework',
    category: 'framework_backend',
    description: 'Ultrafast, lightweight web standards-based web framework for Cloudflare Workers, Node.js, Deno, Bun.',
    docUrl: 'https://hono.dev',
    repoUrl: 'https://github.com/honojs/hono',
    npmUrl: 'https://www.npmjs.com/package/hono',
    recommendedVersion: '^4.6.10',
    pinnedVersion: '4.6.10',
    minNodeVersion: '>=18.0.0',
    isDevDependency: false,
    runtime: ['node', 'edge', 'universal'],
    packageType: 'esm',
    tags: ['hono', 'edge', 'fast', 'serverless', 'web-standards'],
    peerDependencies: [],
    recommendedCompanions: ['@hono/zod-validator'],
    bestPractices: [
      'Use Hono RPC and @hono/zod-validator for end-to-end type safety between client and server.',
    ],
    exampleUsage: `import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => c.text('Hello from Hono!'));

export default app;`,
  },

  fastify: {
    name: 'fastify',
    displayName: 'Fastify High-Performance Framework',
    category: 'framework_backend',
    description: 'Fast and low overhead web framework for Node.js with built-in JSON schema serialization.',
    docUrl: 'https://fastify.dev',
    repoUrl: 'https://github.com/fastify/fastify',
    npmUrl: 'https://www.npmjs.com/package/fastify',
    recommendedVersion: '^5.1.0',
    pinnedVersion: '5.1.0',
    minNodeVersion: '>=20.0.0',
    isDevDependency: false,
    runtime: ['node'],
    packageType: 'dual',
    tags: ['fastify', 'backend', 'high-performance', 'http'],
    peerDependencies: [],
    recommendedCompanions: [],
    bestPractices: [
      'Declare JSON schemas for request and response to enable high-speed compilation with fast-json-stringify.',
    ],
    exampleUsage: `import Fastify from 'fastify';

const fastify = Fastify({ logger: true });

fastify.get('/ping', async () => ({ pong: true }));

await fastify.listen({ port: 3000 });`,
  },

  // -------------------------------------------------------------
  // UI, Styling & Icons
  // -------------------------------------------------------------
  tailwindcss: {
    name: 'tailwindcss',
    displayName: 'Tailwind CSS',
    category: 'styling',
    description: 'Utility-first CSS framework for rapid UI development with responsive and dark-mode utilities.',
    docUrl: 'https://tailwindcss.com/docs',
    repoUrl: 'https://github.com/tailwindlabs/tailwindcss',
    npmUrl: 'https://www.npmjs.com/package/tailwindcss',
    recommendedVersion: '^3.4.15',
    pinnedVersion: '3.4.15',
    minNodeVersion: '>=18.0.0',
    isDevDependency: true,
    runtime: ['node', 'browser'],
    packageType: 'esm',
    tags: ['css', 'styling', 'tailwind', 'utility-first', 'responsive'],
    peerDependencies: [],
    recommendedCompanions: ['clsx', 'tailwind-merge'],
    bestPractices: [
      'Use the cn() helper (clsx + tailwind-merge) for conditional and overridable className merging.',
      'Configure content paths accurately in tailwind.config.ts.',
    ],
    antiPatterns: [
      'Do not construct dynamic class strings with string concatenation (e.g. "bg-" + color).',
    ],
    exampleUsage: `// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;`,
  },

  clsx: {
    name: 'clsx',
    displayName: 'clsx Utility',
    category: 'styling',
    description: 'Tiny utility for constructing className strings conditionally.',
    docUrl: 'https://github.com/lukeed/clsx',
    repoUrl: 'https://github.com/lukeed/clsx',
    npmUrl: 'https://www.npmjs.com/package/clsx',
    recommendedVersion: '^2.1.1',
    pinnedVersion: '2.1.1',
    isDevDependency: false,
    runtime: ['browser', 'node', 'edge', 'universal'],
    packageType: 'esm',
    tags: ['styling', 'utility', 'css', 'classnames'],
    peerDependencies: [],
    recommendedCompanions: ['tailwind-merge'],
  },

  'tailwind-merge': {
    name: 'tailwind-merge',
    displayName: 'tailwind-merge',
    category: 'styling',
    description: 'Merge Tailwind CSS classes in JS without style conflicts.',
    docUrl: 'https://github.com/dcastil/tailwind-merge',
    repoUrl: 'https://github.com/dcastil/tailwind-merge',
    npmUrl: 'https://www.npmjs.com/package/tailwind-merge',
    recommendedVersion: '^2.5.4',
    pinnedVersion: '2.5.4',
    isDevDependency: false,
    runtime: ['browser', 'node', 'edge', 'universal'],
    packageType: 'esm',
    tags: ['styling', 'tailwind', 'utility', 'css'],
    peerDependencies: [],
    recommendedCompanions: ['clsx'],
    exampleUsage: `import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}`,
  },

  'lucide-react': {
    name: 'lucide-react',
    displayName: 'Lucide React Icons',
    category: 'icons',
    description: 'Beautiful, consistent open-source icons for React applications.',
    docUrl: 'https://lucide.dev',
    repoUrl: 'https://github.com/lucide-icons/lucide',
    npmUrl: 'https://www.npmjs.com/package/lucide-react',
    recommendedVersion: '^0.460.0',
    pinnedVersion: '0.460.0',
    isDevDependency: false,
    runtime: ['browser', 'node', 'universal'],
    packageType: 'esm',
    tags: ['icons', 'react', 'svg', 'lucide', 'ui'],
    peerDependencies: ['react'],
    recommendedCompanions: ['react'],
    exampleUsage: `import { Check, ChevronRight, AlertCircle } from 'lucide-react';

export function StatusIcon({ success }: { success: boolean }) {
  return success ? <Check className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />;
}`,
  },

  '@radix-ui/react-slot': {
    name: '@radix-ui/react-slot',
    displayName: 'Radix UI Slot Primitive',
    category: 'ui_components',
    description: 'Polymorphic slot component for merging props and event handlers onto child elements.',
    docUrl: 'https://www.radix-ui.com/primitives/docs/utilities/slot',
    repoUrl: 'https://github.com/radix-ui/primitives',
    npmUrl: 'https://www.npmjs.com/package/@radix-ui/react-slot',
    recommendedVersion: '^1.1.0',
    pinnedVersion: '1.1.0',
    isDevDependency: false,
    runtime: ['browser', 'universal'],
    packageType: 'esm',
    tags: ['radix-ui', 'ui', 'slot', 'polymorphism', 'components'],
    peerDependencies: ['react'],
    recommendedCompanions: ['class-variance-authority'],
  },

  'class-variance-authority': {
    name: 'class-variance-authority',
    displayName: 'Class Variance Authority (CVA)',
    category: 'styling',
    description: 'Type-safe variant management for building customizable UI component libraries.',
    docUrl: 'https://cva.style/docs',
    repoUrl: 'https://github.com/joe-bell/cva',
    npmUrl: 'https://www.npmjs.com/package/class-variance-authority',
    recommendedVersion: '^0.7.1',
    pinnedVersion: '0.7.1',
    isDevDependency: false,
    runtime: ['browser', 'node', 'universal'],
    packageType: 'esm',
    tags: ['styling', 'variants', 'cva', 'design-system', 'tailwind'],
    peerDependencies: [],
    recommendedCompanions: ['clsx', 'tailwind-merge'],
    exampleUsage: `import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);`,
  },

  // -------------------------------------------------------------
  // State Management & Data Fetching
  // -------------------------------------------------------------
  '@tanstack/react-query': {
    name: '@tanstack/react-query',
    displayName: 'TanStack React Query',
    category: 'state_management',
    description: 'Powerful asynchronous state management, caching, and data synchronization for React.',
    docUrl: 'https://tanstack.com/query/latest/docs/framework/react/overview',
    repoUrl: 'https://github.com/tanstack/query',
    npmUrl: 'https://www.npmjs.com/package/@tanstack/react-query',
    recommendedVersion: '^5.60.6',
    pinnedVersion: '5.60.6',
    minNodeVersion: '>=18.0.0',
    isDevDependency: false,
    runtime: ['browser', 'node', 'universal'],
    packageType: 'esm',
    tags: ['react-query', 'tanstack', 'async-state', 'cache', 'fetching', 'data'],
    peerDependencies: ['react'],
    recommendedCompanions: ['react'],
    bestPractices: [
      'Wrap application in QueryClientProvider with a QueryClient instance.',
      'Use queryKey arrays consistently e.g. [\'users\', userId].',
      'Leverage useMutation for data updates and invalidateQueries on success.',
    ],
    antiPatterns: [
      'Do not perform direct fetch calls inside useEffect when useQuery is available.',
    ],
    exampleUsage: `import { useQuery } from '@tanstack/react-query';

export function UserProfile({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['user', id],
    queryFn: async () => {
      const res = await fetch(\`/api/users/\${id}\`);
      if (!res.ok) throw new Error('Network error');
      return res.json();
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading user</div>;
  return <div>Welcome, {data.name}</div>;
}`,
  },

  zustand: {
    name: 'zustand',
    displayName: 'Zustand State Store',
    category: 'state_management',
    description: 'Small, fast, and scalable bearbones state management solution for React.',
    docUrl: 'https://zustand.docs.pmnd.rs',
    repoUrl: 'https://github.com/pmndrs/zustand',
    npmUrl: 'https://www.npmjs.com/package/zustand',
    recommendedVersion: '^5.0.1',
    pinnedVersion: '5.0.1',
    isDevDependency: false,
    runtime: ['browser', 'node', 'universal'],
    packageType: 'esm',
    tags: ['state', 'store', 'zustand', 'react', 'lightweight'],
    peerDependencies: [],
    recommendedCompanions: ['react'],
    bestPractices: [
      'Use selector functions when consuming state to prevent unnecessary re-renders (useStore(s => s.count)).',
    ],
    exampleUsage: `import { create } from 'zustand';

interface BearState {
  bears: number;
  increase: () => void;
  reset: () => void;
}

export const useBearStore = create<BearState>((set) => ({
  bears: 0,
  increase: () => set((state) => ({ bears: state.bears + 1 })),
  reset: () => set({ bears: 0 }),
}));`,
  },

  axios: {
    name: 'axios',
    displayName: 'Axios HTTP Client',
    category: 'api_client',
    description: 'Promise-based HTTP client for browser and Node.js with interceptor support.',
    docUrl: 'https://axios-http.com/docs/intro',
    repoUrl: 'https://github.com/axios/axios',
    npmUrl: 'https://www.npmjs.com/package/axios',
    recommendedVersion: '^1.7.7',
    pinnedVersion: '1.7.7',
    isDevDependency: false,
    runtime: ['node', 'browser', 'universal'],
    packageType: 'dual',
    tags: ['http', 'api', 'client', 'rest', 'ajax'],
    peerDependencies: [],
    recommendedCompanions: [],
    bestPractices: [
      'Create configured axios instances (axios.create) with baseURL and interceptors.',
    ],
    exampleUsage: `import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.API_BASE_URL || 'http://localhost:3000',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});`,
  },

  // -------------------------------------------------------------
  // Authentication & Security
  // -------------------------------------------------------------
  'better-auth': {
    name: 'better-auth',
    displayName: 'Better Auth Framework',
    category: 'auth',
    description: 'Comprehensive, framework-agnostic TypeScript authentication framework with built-in plugins.',
    docUrl: 'https://www.better-auth.com/docs',
    repoUrl: 'https://github.com/better-auth/better-auth',
    npmUrl: 'https://www.npmjs.com/package/better-auth',
    recommendedVersion: '^1.0.0',
    pinnedVersion: '1.0.0',
    minNodeVersion: '>=18.0.0',
    isDevDependency: false,
    runtime: ['node', 'edge', 'universal'],
    packageType: 'esm',
    tags: ['auth', 'authentication', 'better-auth', 'session', 'oauth', 'jwt', 'security'],
    peerDependencies: [],
    recommendedCompanions: [],
    bestPractices: [
      'Configure database adapter (Prisma, Drizzle, etc.) during initialization.',
      'Mount the auth handler to standard API route (e.g., /api/auth/[...all]).',
    ],
    exampleUsage: `import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './prisma';

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
});`,
  },

  jose: {
    name: 'jose',
    displayName: 'jose JWT & Cryptography',
    category: 'auth',
    description: 'Universal JSON Web Tokens (JWT), JWS, JWE, JWK, and JWKS module for Edge and Node runtimes.',
    docUrl: 'https://github.com/panva/jose',
    repoUrl: 'https://github.com/panva/jose',
    npmUrl: 'https://www.npmjs.com/package/jose',
    recommendedVersion: '^5.9.6',
    pinnedVersion: '5.9.6',
    minNodeVersion: '>=18.0.0',
    isDevDependency: false,
    runtime: ['node', 'edge', 'browser', 'universal'],
    packageType: 'esm',
    tags: ['jwt', 'crypto', 'auth', 'security', 'edge-compatible'],
    peerDependencies: [],
    bestPractices: [
      'Use jose for Edge-runtime and Next.js middleware JWT verification where Node crypto is restricted.',
    ],
    exampleUsage: `import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'secret-key-at-least-32-chars');

export async function signToken(payload: Record<string, unknown>) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(secret);
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload;
}`,
  },

  bcryptjs: {
    name: 'bcryptjs',
    displayName: 'bcryptjs Password Hashing',
    category: 'auth',
    description: 'Pure JavaScript implementation of bcrypt password hashing with zero native bindings.',
    docUrl: 'https://github.com/dcodeIO/bcrypt.js',
    repoUrl: 'https://github.com/dcodeIO/bcrypt.js',
    npmUrl: 'https://www.npmjs.com/package/bcryptjs',
    recommendedVersion: '^2.4.3',
    pinnedVersion: '2.4.3',
    isDevDependency: false,
    runtime: ['node', 'universal'],
    packageType: 'dual',
    tags: ['bcrypt', 'password', 'hashing', 'auth', 'security'],
    peerDependencies: [],
    recommendedCompanions: ['@types/bcryptjs'],
    bestPractices: [
      'Always use async hash / compare methods with work factor (salt rounds) of 10 or 12.',
    ],
    exampleUsage: `import bcrypt from 'bcryptjs';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}`,
  },

  '@types/bcryptjs': {
    name: '@types/bcryptjs',
    displayName: 'TypeScript Definitions for bcryptjs',
    category: 'auth',
    description: 'TypeScript typings for bcryptjs.',
    docUrl: 'https://github.com/dcodeIO/bcrypt.js',
    recommendedVersion: '^2.4.6',
    pinnedVersion: '2.4.6',
    isDevDependency: true,
    runtime: ['node'],
    packageType: 'esm',
    tags: ['types', 'bcrypt', 'typescript'],
    peerDependencies: ['bcryptjs'],
  },

  // -------------------------------------------------------------
  // Testing
  // -------------------------------------------------------------
  vitest: {
    name: 'vitest',
    displayName: 'Vitest Unit & Integration Test Runner',
    category: 'testing',
    description: 'Blazing fast Vite-native unit test runner with Jest compatibility and instant watch mode.',
    docUrl: 'https://vitest.dev/guide',
    repoUrl: 'https://github.com/vitest-dev/vitest',
    npmUrl: 'https://www.npmjs.com/package/vitest',
    recommendedVersion: '^2.1.5',
    pinnedVersion: '2.1.5',
    minNodeVersion: '>=18.0.0',
    isDevDependency: true,
    runtime: ['node'],
    packageType: 'esm',
    tags: ['testing', 'test-runner', 'vitest', 'unit-test', 'vite'],
    peerDependencies: [],
    recommendedCompanions: ['@testing-library/react'],
    bestPractices: [
      'Install vitest as a devDependency.',
      'Use describe, it/test, expect from vitest.',
    ],
    exampleUsage: `import { describe, it, expect } from 'vitest';

describe('Calculator', () => {
  it('adds two numbers correctly', () => {
    expect(1 + 1).toBe(2);
  });
});`,
  },

  '@testing-library/react': {
    name: '@testing-library/react',
    displayName: 'React Testing Library',
    category: 'testing',
    description: 'Simple and complete React DOM testing utilities that encourage accessible user-centric test practices.',
    docUrl: 'https://testing-library.com/docs/react-testing-library/intro/',
    repoUrl: 'https://github.com/testing-library/react-testing-library',
    npmUrl: 'https://www.npmjs.com/package/@testing-library/react',
    recommendedVersion: '^16.0.1',
    pinnedVersion: '16.0.1',
    isDevDependency: true,
    runtime: ['node'],
    packageType: 'esm',
    tags: ['testing', 'react', 'dom', 'ui-tests'],
    peerDependencies: ['react', 'react-dom'],
    recommendedCompanions: ['vitest', 'react', 'react-dom'],
  },

  playwright: {
    name: 'playwright',
    displayName: 'Playwright End-to-End & UI Testing Engine',
    category: 'testing',
    description:
      'Cross-browser end-to-end automation and UI testing framework supporting Chromium, Firefox, and WebKit with visual regression, headless automation, and screenshot capabilities.',
    docUrl: 'https://playwright.dev/docs/intro',
    repoUrl: 'https://github.com/microsoft/playwright',
    npmUrl: 'https://www.npmjs.com/package/playwright',
    recommendedVersion: '^1.50.0',
    pinnedVersion: '1.50.0',
    minNodeVersion: '>=18.0.0',
    isDevDependency: true,
    runtime: ['node'],
    packageType: 'esm',
    tags: ['playwright', 'testing', 'e2e', 'automation', 'browser', 'ui', 'screenshot'],
    peerDependencies: [],
    recommendedCompanions: ['@types/node'],
    bestPractices: [
      'Use headless mode for CI/CD and agent automated workflows.',
      'Capture JPEG compressed screenshots (quality: 75) to minimize token and bandwidth costs for multimodal LLM vision processing.',
      'Use locator assertions with automatic waiting instead of arbitrary sleep timers.',
      'Isolate browser contexts per test to eliminate state leakage between test steps.',
    ],
    exampleUsage: `import { chromium } from 'playwright';

export async function testHomePage(baseUrl = 'http://localhost:3000') {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(baseUrl);
  const title = await page.title();
  const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 75 });
  await browser.close();
  return { title, screenshotBuffer };
}`,
  },

  // -------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------
  'date-fns': {
    name: 'date-fns',
    displayName: 'date-fns Date Utility',
    category: 'utilities',
    description: 'Modern JavaScript date utility library with comprehensive immutability and tree-shaking.',
    docUrl: 'https://date-fns.org/docs/Getting-Started',
    repoUrl: 'https://github.com/date-fns/date-fns',
    npmUrl: 'https://www.npmjs.com/package/date-fns',
    recommendedVersion: '^4.1.0',
    pinnedVersion: '4.1.0',
    isDevDependency: false,
    runtime: ['browser', 'node', 'edge', 'universal'],
    packageType: 'esm',
    tags: ['date', 'time', 'formatting', 'utilities'],
    peerDependencies: [],
    recommendedCompanions: [],
    exampleUsage: `import { format, formatDistanceToNow, addDays } from 'date-fns';

export function getReadableDate(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}`,
  },

  nanoid: {
    name: 'nanoid',
    displayName: 'NanoID Unique ID Generator',
    category: 'utilities',
    description: 'Tiny, secure, URL-friendly unique string ID generator for JavaScript.',
    docUrl: 'https://github.com/ai/nanoid',
    repoUrl: 'https://github.com/ai/nanoid',
    npmUrl: 'https://www.npmjs.com/package/nanoid',
    recommendedVersion: '^5.0.8',
    pinnedVersion: '5.0.8',
    isDevDependency: false,
    runtime: ['browser', 'node', 'edge', 'universal'],
    packageType: 'esm',
    tags: ['id', 'uuid', 'unique-id', 'random', 'utilities'],
    peerDependencies: [],
    recommendedCompanions: [],
    exampleUsage: `import { nanoid } from 'nanoid';

export function createUniqueId(prefix = 'item'): string {
  return \`\${prefix}_\${nanoid(16)}\`;
}`,
  },

  dotenv: {
    name: 'dotenv',
    displayName: 'dotenv Environment Loader',
    category: 'utilities',
    description: 'Loads environment variables from .env file into process.env.',
    docUrl: 'https://github.com/motdotla/dotenv',
    repoUrl: 'https://github.com/motdotla/dotenv',
    npmUrl: 'https://www.npmjs.com/package/dotenv',
    recommendedVersion: '^16.4.5',
    pinnedVersion: '16.4.5',
    isDevDependency: false,
    runtime: ['node'],
    packageType: 'dual',
    tags: ['env', 'environment', 'config', 'utilities'],
    peerDependencies: [],
    recommendedCompanions: [],
    exampleUsage: `import dotenv from 'dotenv';
dotenv.config();`,
  },
};

// -------------------------------------------------------------
// Curated Stack Bundles / Presets
// -------------------------------------------------------------

export const STATIC_MODULE_BUNDLES: Record<string, ModuleBundle> = {
  nextjs_fullstack: {
    id: 'nextjs_fullstack',
    name: 'Next.js Modern Fullstack App',
    description: 'Complete stack for building modern, responsive, type-safe Next.js web applications.',
    modules: [
      'next',
      'react',
      'react-dom',
      'zod',
      '@tanstack/react-query',
      'clsx',
      'tailwind-merge',
      'lucide-react',
      '@radix-ui/react-slot',
      'class-variance-authority',
    ],
    devModules: [
      '@types/react',
      '@types/react-dom',
      'tailwindcss',
      'vitest',
      '@testing-library/react',
    ],
    tags: ['nextjs', 'react', 'fullstack', 'tailwind', 'app-router'],
  },

  database_prisma: {
    id: 'database_prisma',
    name: 'Prisma PostgreSQL Database Stack',
    description: 'Type-safe database layer with Prisma ORM and schema validations.',
    modules: ['@prisma/client', 'zod'],
    devModules: ['prisma'],
    tags: ['prisma', 'database', 'postgres', 'sql', 'orm'],
  },

  database_drizzle: {
    id: 'database_drizzle',
    name: 'Drizzle PostgreSQL Database Stack',
    description: 'Lightweight SQL-like TypeScript ORM stack with Drizzle and node-postgres.',
    modules: ['drizzle-orm', 'pg', 'zod'],
    devModules: ['drizzle-kit', '@types/pg'],
    tags: ['drizzle', 'database', 'postgres', 'sql', 'orm'],
  },

  express_backend: {
    id: 'express_backend',
    name: 'Express.js REST API Backend',
    description: 'Robust Express.js backend with Zod validation, environment configuration, and utility tooling.',
    modules: ['express', 'zod', 'dotenv', 'date-fns', 'nanoid'],
    devModules: ['@types/express', 'vitest'],
    tags: ['express', 'backend', 'rest', 'api'],
  },

  nestjs_backend: {
    id: 'nestjs_backend',
    name: 'NestJS Enterprise Backend',
    description: 'Enterprise architecture backend with NestJS core, modules, and validation.',
    modules: ['@nestjs/core', '@nestjs/common', 'zod', 'dotenv'],
    devModules: ['vitest'],
    tags: ['nestjs', 'backend', 'enterprise', 'ioc'],
  },

  auth_security: {
    id: 'auth_security',
    name: 'Authentication & Cryptography Stack',
    description: 'Complete user authentication, password hashing, and token verification utilities.',
    modules: ['better-auth', 'jose', 'bcryptjs'],
    devModules: ['@types/bcryptjs'],
    tags: ['auth', 'jwt', 'security', 'bcrypt', 'better-auth'],
  },
};
