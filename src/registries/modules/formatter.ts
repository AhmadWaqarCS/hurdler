import type {
  ModuleDefinition,
  ModulePromptOptions,
  PackageManager,
  VersionStrategy,
  PackageJsonDependenciesResult,
} from './types.js';

/**
 * Resolves the version string based on the chosen version strategy.
 *
 * @param module - The module definition.
 * @param strategy - Semver strategy to resolve ('exact', 'caret', 'tilde', 'latest_stable').
 * @returns Resolved version string specifier.
 *
 * @example
 * ```typescript
 * const v = resolveTargetVersion(zodModule, 'caret');
 * // '^3.23.8'
 * ```
 */
export function resolveTargetVersion(
  module: ModuleDefinition,
  strategy: VersionStrategy = 'exact'
): string {
  if (!module) return 'latest';
  const pinned = module.pinnedVersion || 'latest';
  const recommended = module.recommendedVersion || `^${pinned}`;

  switch (strategy) {
    case 'exact':
      return pinned;
    case 'caret':
      return recommended.startsWith('^') ? recommended : `^${pinned}`;
    case 'tilde':
      return `~${pinned}`;
    case 'latest_stable':
      return pinned;
    default:
      return pinned;
  }
}

/**
 * Generates formatted CLI installation commands (split by runtime vs devDependency).
 *
 * @param modules - List of modules to install.
 * @param packageManager - Target package manager ('npm', 'pnpm', 'yarn', 'bun').
 * @param strategy - Version strategy.
 * @returns Object with command strings and package lists.
 *
 * @example
 * ```typescript
 * const cmd = formatInstallCommands([zod, prisma], 'pnpm', 'exact');
 * console.log(cmd.combinedCmd);
 * // 'pnpm add zod@3.23.8 && pnpm add -D prisma@5.22.0'
 * ```
 */
export function formatInstallCommands(
  modules: ModuleDefinition[],
  packageManager: PackageManager = 'npm',
  strategy: VersionStrategy = 'exact'
): {
  runtimeCmd: string;
  devCmd: string;
  combinedCmd: string;
  runtimePackages: string[];
  devPackages: string[];
} {
  const runtimePackages: string[] = [];
  const devPackages: string[] = [];

  for (const mod of modules) {
    if (!mod || typeof mod !== 'object') continue;
    const version = resolveTargetVersion(mod, strategy);
    const specifier = `${mod.name}@${version}`;
    if (mod.isDevDependency) {
      if (!devPackages.includes(specifier)) {
        devPackages.push(specifier);
      }
    } else {
      if (!runtimePackages.includes(specifier)) {
        runtimePackages.push(specifier);
      }
    }
  }

  const getCmd = (pkgList: string[], isDev: boolean): string => {
    if (pkgList.length === 0) return '';
    const pkgs = pkgList.join(' ');
    switch (packageManager) {
      case 'pnpm':
        return isDev ? `pnpm add -D ${pkgs}` : `pnpm add ${pkgs}`;
      case 'yarn':
        return isDev ? `yarn add -D ${pkgs}` : `yarn add ${pkgs}`;
      case 'bun':
        return isDev ? `bun add -d ${pkgs}` : `bun add ${pkgs}`;
      case 'npm':
      default:
        return isDev ? `npm install --save-dev ${pkgs}` : `npm install ${pkgs}`;
    }
  };

  const runtimeCmd = getCmd(runtimePackages, false);
  const devCmd = getCmd(devPackages, true);
  const combinedParts = [runtimeCmd, devCmd].filter(Boolean);
  const combinedCmd = combinedParts.join(' && ');

  return {
    runtimeCmd,
    devCmd,
    combinedCmd,
    runtimePackages,
    devPackages,
  };
}

/**
 * Generates a clean JSON-ready dependency dictionary for package.json.
 *
 * @param modules - List of modules.
 * @param options - Version strategy options.
 * @returns Dependencies and devDependencies maps.
 *
 * @example
 * ```typescript
 * const deps = formatPackageJsonDependencies([zod, next]);
 * ```
 */
export function formatPackageJsonDependencies(
  modules: ModuleDefinition[],
  options?: { strategy?: VersionStrategy }
): PackageJsonDependenciesResult {
  const strategy = options?.strategy ?? 'caret';
  const dependencies: Record<string, string> = {};
  const devDependencies: Record<string, string> = {};

  for (const mod of modules) {
    if (!mod || typeof mod !== 'object') continue;
    const version = resolveTargetVersion(mod, strategy);
    if (mod.isDevDependency) {
      devDependencies[mod.name] = version;
    } else {
      dependencies[mod.name] = version;
    }
  }

  return { dependencies, devDependencies };
}

/**
 * Formats a formatted package.json snippet with dependencies.
 *
 * @param modules - List of modules.
 * @param options - Version strategy options.
 * @returns Pretty-printed JSON string snippet.
 *
 * @example
 * ```typescript
 * const snippet = formatPackageJsonDependenciesSnippet([zod, prisma]);
 * ```
 */
export function formatPackageJsonDependenciesSnippet(
  modules: ModuleDefinition[],
  options?: { strategy?: VersionStrategy }
): string {
  const { dependencies, devDependencies } = formatPackageJsonDependencies(modules, options);
  const snippet = {
    dependencies,
    devDependencies,
  };
  return JSON.stringify(snippet, null, 2);
}

/**
 * Formats a single module as a concise one-line reference.
 *
 * @param module - Module definition.
 * @returns Markdown bullet point reference.
 */
export function formatModuleQuickReference(module: ModuleDefinition): string {
  return `- **${module.name}** (\`${module.pinnedVersion}\`): ${module.description} — [Docs](${module.docUrl})`;
}

/**
 * Formats detailed documentation, rules, and examples for a single module.
 *
 * @param module - Module definition.
 * @param options - Prompt formatting options.
 * @returns Detailed markdown string.
 */
export function formatModuleDetails(
  module: ModuleDefinition,
  options?: ModulePromptOptions
): string {
  const opts: Required<ModulePromptOptions> = {
    includeExamples: options?.includeExamples ?? true,
    includeBestPractices: options?.includeBestPractices ?? true,
    includeAntiPatterns: options?.includeAntiPatterns ?? true,
    includeInstallCommand: options?.includeInstallCommand ?? true,
    packageManager: options?.packageManager ?? 'npm',
    versionStrategy: options?.versionStrategy ?? 'exact',
    detailLevel: options?.detailLevel ?? 'detailed',
  };

  const lines: string[] = [];
  lines.push(`### Module: \`${module.name}\` (v${module.pinnedVersion})`);
  lines.push(`- **Display Name**: ${module.displayName}`);
  lines.push(`- **Category**: \`${module.category}\``);
  lines.push(`- **Description**: ${module.description}`);
  lines.push(`- **Official Documentation**: [${module.docUrl}](${module.docUrl})`);
  lines.push(`- **Fixed Stable Version**: \`${module.pinnedVersion}\` (Semver Range: \`${module.recommendedVersion}\`)`);
  lines.push(`- **Runtime Environment**: \`${module.runtime.join(', ')}\``);
  lines.push(`- **Package Type**: \`${module.packageType}\``);

  if (opts.includeInstallCommand) {
    const install = formatInstallCommands([module], opts.packageManager, opts.versionStrategy);
    lines.push(`- **Install Command**: \`${install.combinedCmd || install.runtimeCmd || install.devCmd}\``);
  }

  if (module.peerDependencies && module.peerDependencies.length > 0) {
    lines.push(`- **Peer Dependencies**: ${module.peerDependencies.map((p) => `\`${p}\``).join(', ')}`);
  }

  if (module.recommendedCompanions && module.recommendedCompanions.length > 0) {
    lines.push(`- **Recommended Companions**: ${module.recommendedCompanions.map((c) => `\`${c}\``).join(', ')}`);
  }

  if (opts.includeBestPractices && module.bestPractices && module.bestPractices.length > 0) {
    lines.push('');
    lines.push('**Best Practices & Usage Guidelines:**');
    for (const practice of module.bestPractices) {
      lines.push(`- ${practice}`);
    }
  }

  if (opts.includeAntiPatterns && module.antiPatterns && module.antiPatterns.length > 0) {
    lines.push('');
    lines.push('**Anti-Patterns & Hallucination Warnings to Avoid:**');
    for (const anti of module.antiPatterns) {
      lines.push(`- ⚠️ ${anti}`);
    }
  }

  if (opts.includeExamples && module.exampleUsage) {
    lines.push('');
    lines.push('**Canonical Example:**');
    lines.push('```typescript');
    lines.push(module.exampleUsage);
    lines.push('```');
  }

  return lines.join('\n');
}

/**
 * Extracts and aggregates all anti-patterns and best practices into an actionable rule list for code generation prompts.
 *
 * @param modules - List of modules.
 * @returns Aggregated guidelines markdown string.
 */
export function formatModuleRules(modules: ModuleDefinition[]): string {
  const practices: string[] = [];
  const antiPatterns: string[] = [];

  for (const mod of modules) {
    if (mod.bestPractices) {
      for (const bp of mod.bestPractices) {
        practices.push(`- [${mod.name}] ${bp}`);
      }
    }
    if (mod.antiPatterns) {
      for (const ap of mod.antiPatterns) {
        antiPatterns.push(`- ⚠️ [${mod.name}] ${ap}`);
      }
    }
  }

  const sections: string[] = [];
  if (practices.length > 0) {
    sections.push('#### Required Coding Best Practices:\n' + practices.join('\n'));
  }
  if (antiPatterns.length > 0) {
    sections.push('#### Prohibited Anti-Patterns:\n' + antiPatterns.join('\n'));
  }

  return sections.join('\n\n');
}

/**
 * Formats a collection of modules into high-signal markdown context specifically designed for LLMs.
 *
 * @param modules - List of modules.
 * @param options - Prompt formatting configuration.
 * @returns Formatted prompt markdown block.
 *
 * @example
 * ```typescript
 * const prompt = formatModulesForLLM([zod, prisma], { detailLevel: 'full' });
 * ```
 */
export function formatModulesForLLM(
  modules: ModuleDefinition[],
  options?: ModulePromptOptions
): string {
  if (!modules || modules.length === 0) {
    return 'No modules configured.';
  }

  const opts: Required<ModulePromptOptions> = {
    includeExamples: options?.includeExamples ?? true,
    includeBestPractices: options?.includeBestPractices ?? true,
    includeAntiPatterns: options?.includeAntiPatterns ?? true,
    includeInstallCommand: options?.includeInstallCommand ?? true,
    packageManager: options?.packageManager ?? 'npm',
    versionStrategy: options?.versionStrategy ?? 'exact',
    detailLevel: options?.detailLevel ?? 'detailed',
  };

  const sections: string[] = [];

  // Header
  sections.push('## Authorized Modules & Libraries');
  sections.push(
    'The project strictly utilizes the following vetted Node.js libraries. Generate code adhering to these exact versions and documentation specifications.'
  );

  // Quick summary
  const installInfo = formatInstallCommands(modules, opts.packageManager, opts.versionStrategy);
  if (installInfo.combinedCmd) {
    sections.push(`\n**Installation Commands (${opts.packageManager}):**\n\`\`\`bash\n${installInfo.combinedCmd}\n\`\`\``);
  }

  if (opts.detailLevel === 'compact') {
    sections.push('\n**Module Reference:**');
    sections.push(modules.map(formatModuleQuickReference).join('\n'));
    return sections.join('\n');
  }

  // Detailed entries
  sections.push('\n---\n');
  sections.push(modules.map((m) => formatModuleDetails(m, opts)).join('\n\n---\n\n'));

  // Aggregated rules summary
  const aggregatedRules = formatModuleRules(modules);
  if (aggregatedRules) {
    sections.push('\n---\n');
    sections.push('### Consolidated Module Guidelines & Constraints\n' + aggregatedRules);
  }

  return sections.join('\n');
}
