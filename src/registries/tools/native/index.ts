import { readFileTool, readManyFilesTool, getFileInfoTool } from './fs-read.js';
import {
  createFileTool,
  createManyFilesTool,
  deleteFileTool,
  copyFileTool,
  moveFileTool,
} from './fs-write.js';
import { editFileTool, editManyFilesTool, appendFileTool } from './fs-edit.js';
import { listDirectoryTool, createDirectoryTool, searchFilesTool } from './fs-dir.js';
import {
  gitStatusTool,
  gitDiffTool,
  gitLogTool,
  gitBranchListTool,
  gitBranchCreateTool,
  gitBranchCheckoutTool,
  gitStageAndCommitTool,
  gitShowFileTool,
} from './git.js';
import type { NativeToolDefinition } from '../types.js';

export * from './fs-read.js';
export * from './fs-write.js';
export * from './fs-edit.js';
export * from './fs-dir.js';
export * from './git.js';

/**
 * Standard registry dictionary of all built-in native software engineering tools.
 */
export const STATIC_TOOLS: Record<string, NativeToolDefinition> = {
  // Read operations
  [readFileTool.name]: readFileTool,
  [readManyFilesTool.name]: readManyFilesTool,
  [getFileInfoTool.name]: getFileInfoTool,

  // Write operations
  [createFileTool.name]: createFileTool,
  [createManyFilesTool.name]: createManyFilesTool,
  [deleteFileTool.name]: deleteFileTool,
  [copyFileTool.name]: copyFileTool,
  [moveFileTool.name]: moveFileTool,

  // Edit operations
  [editFileTool.name]: editFileTool,
  [editManyFilesTool.name]: editManyFilesTool,
  [appendFileTool.name]: appendFileTool,

  // Directory & Search operations
  [listDirectoryTool.name]: listDirectoryTool,
  [createDirectoryTool.name]: createDirectoryTool,
  [searchFilesTool.name]: searchFilesTool,

  // Git operations
  [gitStatusTool.name]: gitStatusTool,
  [gitDiffTool.name]: gitDiffTool,
  [gitLogTool.name]: gitLogTool,
  [gitBranchListTool.name]: gitBranchListTool,
  [gitBranchCreateTool.name]: gitBranchCreateTool,
  [gitBranchCheckoutTool.name]: gitBranchCheckoutTool,
  [gitStageAndCommitTool.name]: gitStageAndCommitTool,
  [gitShowFileTool.name]: gitShowFileTool,
};

