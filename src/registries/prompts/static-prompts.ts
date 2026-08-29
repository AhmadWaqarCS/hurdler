import type { PromptDefinition } from './types.js';

/**
 * Static registry of default Global, System, and Agent prompts for Hurdler.
 */
export const STATIC_PROMPTS: Record<string, PromptDefinition> = {
  // --- Global Prompts ---
  'global:kiss': {
    id: 'global:kiss',
    title: 'Follow KISS Philosophy',
    category: 'global',
    content:
      'Follow the KISS (Keep It Simple, Stupid) philosophy. Avoid over-engineering, unnecessary abstractions, and premature optimizations. Write clean, direct, and readable code in isolation.',
    description: 'Enforces simplicity, modularity, and readable implementation.',
    variables: [],
    cacheable: true,
    priority: 0,
    tags: ['global', 'architecture', 'philosophy', 'kiss'],
  },
  'global:senior-engineer': {
    id: 'global:senior-engineer',
    title: 'Senior Software Engineer Standards',
    category: 'global',
    content:
      'Operate as a senior expert software engineer. Consider edge cases, rigorous error handling, security implications, performance characteristics, and long-term maintainability in all designs.',
    description: 'Guides the model to reason with senior engineering rigor and foresight.',
    variables: [],
    cacheable: true,
    priority: 5,
    tags: ['global', 'quality', 'standards'],
  },
  'global:isolation': {
    id: 'global:isolation',
    title: 'Feature Isolation Principle',
    category: 'global',
    content:
      'Develop and refactor features in strict isolation. Ensure that changes in one module never break existing functionality elsewhere in the codebase.',
    description: 'Ensures safe modular evolution without cross-feature regressions.',
    variables: [],
    cacheable: true,
    priority: 10,
    tags: ['global', 'architecture', 'isolation'],
  },

  // --- System Prompts ---
  'system:business-logic': {
    id: 'system:business-logic',
    title: 'Business Logic First',
    category: 'system',
    content:
      'Focus primarily on business logic, domain rules, state transitions, and deterministic outcomes before designing presentation layers or UI.',
    description: 'Prioritizes robust domain rules and state integrity.',
    variables: [],
    cacheable: true,
    priority: 20,
    tags: ['system', 'business-logic', 'domain'],
  },
  'system:validations': {
    id: 'system:validations',
    title: 'Defensive Validation and Schema Enforcement',
    category: 'system',
    content:
      'Enforce strict schema validations (using Zod or standard types). Validate all external inputs, arguments, configurations, and API payloads defensively with detailed error reporting.',
    description: 'Mandates strict runtime schema validations for all parameters.',
    variables: [],
    cacheable: true,
    priority: 25,
    tags: ['system', 'validation', 'zod', 'security'],
  },
  'system:security-patches': {
    id: 'system:security-patches',
    title: 'Security and Secret Protection',
    category: 'system',
    content:
      'Apply security best practices: sanitize inputs, prevent injection vulnerabilities, enforce secret masking, guard boundaries, and ensure no credentials or sensitive tokens are exposed in logs or outputs.',
    description: 'Applies security safeguards and secret masking.',
    variables: [],
    cacheable: true,
    priority: 30,
    tags: ['system', 'security', 'sanitization'],
  },
  'system:performance': {
    id: 'system:performance',
    title: 'High Performance and Optimization',
    category: 'system',
    content:
      'Optimize for runtime performance, memory efficiency, non-blocking I/O, minimal allocations, and lazy evaluations without sacrificing code readability.',
    description: 'Optimizes runtime execution and memory footprint.',
    variables: [],
    cacheable: true,
    priority: 35,
    tags: ['system', 'performance', 'optimization'],
  },
  'system:refactor-debug': {
    id: 'system:refactor-debug',
    title: 'Root-Cause Debugging and Safe Refactoring',
    category: 'system',
    content:
      'When refactoring or fixing bugs, first analyze all related files to identify the true root cause. Do not modify unrelated core stable functions or add unnecessary complexity.',
    description: 'Ensures careful root-cause analysis during debugging.',
    variables: [],
    cacheable: true,
    priority: 40,
    tags: ['system', 'debugging', 'refactoring'],
  },
  'system:playwright-testing': {
    id: 'system:playwright-testing',
    title: 'Playwright E2E & Browser Automation Testing',
    category: 'system',
    content:
      'Author and execute deterministic Playwright end-to-end tests and browser actions. Capture JPEG compressed screenshots (quality: 75) at key checkpoints to verify visual state and minimize token costs. Assert element visibility, text values, URL routes, and network health defensively.',
    description: 'Directs browser automation, Playwright action execution, and end-to-end testing.',
    variables: [],
    cacheable: true,
    priority: 42,
    tags: ['system', 'playwright', 'testing', 'automation', 'e2e'],
  },
  'system:ui-visual-inspection': {
    id: 'system:ui-visual-inspection',
    title: 'UI Visual & Aesthetic Inspection',
    category: 'system',
    content:
      'Reason over captured visual screenshots (JPEG), rendered DOM HTML structures, and correlated component source code. Verify design token harmony, typography hierarchy, responsive spacing, contrast, micro-animations, and alignment. Identify UI defects and specify surgical component refactorings.',
    description: 'Instructs multimodal LLM reasoning over visual UI screenshots and DOM structure.',
    variables: [],
    cacheable: true,
    priority: 45,
    tags: ['system', 'ui', 'design', 'visual', 'inspection', 'screenshot'],
  },

  // --- Agent Prompts ---
  'agent:orchestrator': {
    id: 'agent:orchestrator',
    title: 'Workflow Orchestrator',
    category: 'agent',
    content:
      'Coordinate multi-agent workflows, decompose complex requirements into isolated tasks, delegate to specialized agents, and aggregate final artifacts.',
    description: 'Directs workflow execution and inter-agent coordination.',
    variables: [],
    cacheable: true,
    priority: 50,
    tags: ['agent', 'orchestrator', 'workflow'],
  },
  'agent:ui-designer': {
    id: 'agent:ui-designer',
    title: 'UI/UX Designer',
    category: 'agent',
    content:
      'Design modern, rich, aesthetic user interfaces using clean design systems, cohesive color palettes, typography, responsive layouts, and micro-animations.',
    description: 'Instructs the model on UI/UX aesthetics and frontend design principles.',
    variables: [],
    cacheable: true,
    priority: 55,
    tags: ['agent', 'ui', 'design', 'frontend'],
  },
  'agent:database-manager': {
    id: 'agent:database-manager',
    title: 'Database Manager',
    category: 'agent',
    content:
      'Manage database schemas, relational constraints, indices, migrations, and query performance with ACID compliance and data safety.',
    description: 'Specializes in database modeling and query performance.',
    variables: [],
    cacheable: true,
    priority: 60,
    tags: ['agent', 'database', 'schema', 'sql'],
  },
  'agent:tester': {
    id: 'agent:tester',
    title: 'Testing Specialist',
    category: 'agent',
    content:
      'Author robust, isolated test suites covering happy paths, edge cases, failure modes, and boundary conditions to guarantee system integrity.',
    description: 'Directs comprehensive and isolated test suite authoring.',
    variables: [],
    cacheable: true,
    priority: 65,
    tags: ['agent', 'testing', 'qa'],
  },
  'agent:security-reviewer': {
    id: 'agent:security-reviewer',
    title: 'Security Reviewer',
    category: 'agent',
    content:
      'Perform comprehensive security code reviews, vulnerability scans, access control audits, and cryptographic validation.',
    description: 'Conducts thorough security and vulnerability audits.',
    variables: [],
    cacheable: true,
    priority: 70,
    tags: ['agent', 'security', 'audit'],
  },
};
