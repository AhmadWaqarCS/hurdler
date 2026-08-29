import { Project, ScriptTarget, ModuleKind, type SourceFile } from 'ts-morph';
import { ASTError } from '../../errors.js';
import { sanitizeCodeFilePath, fileExists } from '../../helpers.js';

let sharedVirtualProject: Project | null = null;

/**
 * Creates or retrieves a cached high-performance in-memory ts-morph Project.
 */
export function getVirtualTsMorphProject(): Project {
  if (!sharedVirtualProject) {
    sharedVirtualProject = new Project({
      useInMemoryFileSystem: true,
      compilerOptions: {
        target: ScriptTarget.ESNext,
        module: ModuleKind.ESNext,
        allowJs: true,
        checkJs: false,
        skipLibCheck: true,
      },
    });
  }
  return sharedVirtualProject;
}

/**
 * Creates an in-memory SourceFile from code string.
 */
export function createVirtualSourceFile(code: string, filePath = 'snippet.ts'): SourceFile {
  const project = getVirtualTsMorphProject();
  const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`;

  // If a source file with this path already exists, remove it first to avoid duplicates
  const existing = project.getSourceFile(normalizedPath);
  if (existing) {
    project.removeSourceFile(existing);
  }

  try {
    return project.createSourceFile(normalizedPath, code, { overwrite: true });
  } catch (err: any) {
    throw new ASTError(`Failed to parse TypeScript/JavaScript source code: ${err.message}`, {
      filePath,
      cause: err,
    });
  }
}

/**
 * Loads a real file from disk into a ts-morph Project.
 */
export function loadDiskSourceFile(filePath: string, projectRoot?: string): SourceFile {
  const resolvedPath = sanitizeCodeFilePath(filePath, projectRoot);

  if (!fileExists(resolvedPath)) {
    throw new ASTError(`Source file does not exist: ${resolvedPath}`, { filePath: resolvedPath });
  }

  const project = getVirtualTsMorphProject();
  const existing = project.getSourceFile(resolvedPath);
  if (existing) {
    project.removeSourceFile(existing);
  }

  try {
    return project.addSourceFileAtPath(resolvedPath);
  } catch (err: any) {
    throw new ASTError(`Failed to load source file at ${resolvedPath}: ${err.message}`, {
      filePath: resolvedPath,
      cause: err,
    });
  }
}
