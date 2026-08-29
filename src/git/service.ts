import { initRepository, getGitStatus, isGitRepository, getGitRoot } from './status.js';
import { stageFiles, stageAll, unstageFiles, discardChanges, cleanUntracked } from './staging.js';
import { commit, stageAndCommit, getCommitLog, getCommitDetails, getHeadCommit, getCommitCount } from './commits.js';
import {
  listBranches,
  getCurrentBranch,
  createBranch,
  checkoutBranch,
  deleteBranch,
  renameBranch,
  branchExists,
} from './branches.js';
import { mergeBranch, abortMerge, getConflictFiles } from './merge.js';
import { getDiff, getFileDiff, getShowFile, getChangedFilesBetweenBranches } from './diff.js';
import { stashChanges, popStash, listStashes, dropStash, clearStashes } from './stash.js';
import { createTag, listTags, deleteTag, tagExists } from './tags.js';
import { getRemotes, addRemote, removeRemote, fetchRemote, pullFromRemote, pushToRemote } from './remotes.js';
import {
  createPullRequest,
  listPullRequests,
  getPullRequest,
  reviewPullRequest,
  mergePullRequest,
  closePullRequest,
} from './prs.js';
import { createIssue, listIssues, getIssue, updateIssue, closeIssue } from './issues.js';
import {
  getAgentAuthor,
  registerAgentAuthor,
  createAgentAuthor,
  getAllAgentAuthors,
  clearCustomAgentAuthors,
  formatAuthorArg,
  DEFAULT_AGENT_AUTHORS,
} from './authors.js';
import { getGitClient, clearGitClientCache, canonicalizeRepoPath } from './client.js';

/**
 * Functional Git Service providing a unified interface across all Git subsystems.
 */
export const gitService = {
  // Client & Cache
  getClient: getGitClient,
  clearCache: clearGitClientCache,
  canonicalizePath: canonicalizeRepoPath,

  // Status & Repository Lifecycle
  init: initRepository,
  status: getGitStatus,
  isRepo: isGitRepository,
  getRoot: getGitRoot,

  // Staging
  stage: stageFiles,
  stageAll,
  unstage: unstageFiles,
  discard: discardChanges,
  clean: cleanUntracked,

  // Commits
  commit,
  stageAndCommit,
  log: getCommitLog,
  getCommitDetails,
  getHeadCommit,
  getCommitCount,

  // Branches
  listBranches,
  getCurrentBranch,
  createBranch,
  checkout: checkoutBranch,
  deleteBranch,
  renameBranch,
  branchExists,

  // Merge
  merge: mergeBranch,
  abortMerge,
  getConflictFiles,

  // Diff & Inspection
  diff: getDiff,
  fileDiff: getFileDiff,
  show: getShowFile,
  changedFiles: getChangedFilesBetweenBranches,

  // Stash
  stash: stashChanges,
  popStash,
  listStashes,
  dropStash,
  clearStashes,

  // Tags
  createTag,
  listTags,
  deleteTag,
  tagExists,

  // Remotes
  getRemotes,
  addRemote,
  removeRemote,
  fetch: fetchRemote,
  pull: pullFromRemote,
  push: pushToRemote,

  // Pull Requests
  createPR: createPullRequest,
  listPRs: listPullRequests,
  getPR: getPullRequest,
  reviewPR: reviewPullRequest,
  mergePR: mergePullRequest,
  closePR: closePullRequest,

  // Issues
  createIssue,
  listIssues,
  getIssue,
  updateIssue,
  closeIssue,

  // Authors
  getAgentAuthor,
  registerAgentAuthor,
  createAgentAuthor,
  getAllAgentAuthors,
  clearCustomAgentAuthors,
  formatAuthorArg,
  DEFAULT_AGENT_AUTHORS,
};

/**
 * Creates a scoped Git repository service instance bound to a specific repository path.
 */
export function createRepoService(repoPath: string) {
  const canonicalPath = canonicalizeRepoPath(repoPath);

  return {
    repoPath: canonicalPath,
    init: (options?: Parameters<typeof initRepository>[1]) => initRepository(canonicalPath, options),
    status: () => getGitStatus(canonicalPath),
    isRepo: () => isGitRepository(canonicalPath),
    getRoot: () => getGitRoot(canonicalPath),
    stage: (files: string | string[]) => stageFiles(canonicalPath, files),
    stageAll: () => stageAll(canonicalPath),
    unstage: (files: string | string[]) => unstageFiles(canonicalPath, files),
    discard: (options?: Parameters<typeof discardChanges>[1]) => discardChanges(canonicalPath, options),
    clean: () => cleanUntracked(canonicalPath),
    commit: (options: Parameters<typeof commit>[1]) => commit(canonicalPath, options),
    stageAndCommit: (options: Parameters<typeof stageAndCommit>[1]) => stageAndCommit(canonicalPath, options),
    log: (options?: Parameters<typeof getCommitLog>[1]) => getCommitLog(canonicalPath, options),
    getCommitDetails: (hash: string) => getCommitDetails(canonicalPath, hash),
    getHeadCommit: () => getHeadCommit(canonicalPath),
    getCommitCount: (branch?: string) => getCommitCount(canonicalPath, branch),
    listBranches: () => listBranches(canonicalPath),
    getCurrentBranch: () => getCurrentBranch(canonicalPath),
    createBranch: (branchName: string, options?: Parameters<typeof createBranch>[2]) =>
      createBranch(canonicalPath, branchName, options),
    checkout: (branchName: string, options?: Parameters<typeof checkoutBranch>[2]) =>
      checkoutBranch(canonicalPath, branchName, options),
    deleteBranch: (branchName: string, options?: Parameters<typeof deleteBranch>[2]) =>
      deleteBranch(canonicalPath, branchName, options),
    renameBranch: (oldName: string, newName: string) => renameBranch(canonicalPath, oldName, newName),
    branchExists: (branchName: string) => branchExists(canonicalPath, branchName),
    merge: (options: Parameters<typeof mergeBranch>[1]) => mergeBranch(canonicalPath, options),
    abortMerge: () => abortMerge(canonicalPath),
    getConflictFiles: () => getConflictFiles(canonicalPath),
    diff: (options?: Parameters<typeof getDiff>[1]) => getDiff(canonicalPath, options),
    fileDiff: (filePath: string, options?: Parameters<typeof getFileDiff>[2]) =>
      getFileDiff(canonicalPath, filePath, options),
    show: (filePath: string, ref?: string) => getShowFile(canonicalPath, filePath, ref),
    changedFiles: (baseBranch: string, targetBranch: string) =>
      getChangedFilesBetweenBranches(canonicalPath, baseBranch, targetBranch),
    stash: (options?: Parameters<typeof stashChanges>[1]) => stashChanges(canonicalPath, options),
    popStash: (index?: number) => popStash(canonicalPath, index),
    listStashes: () => listStashes(canonicalPath),
    dropStash: (index?: number) => dropStash(canonicalPath, index),
    clearStashes: () => clearStashes(canonicalPath),
    createTag: (tagName: string, options?: Parameters<typeof createTag>[2]) =>
      createTag(canonicalPath, tagName, options),
    listTags: () => listTags(canonicalPath),
    deleteTag: (tagName: string) => deleteTag(canonicalPath, tagName),
    tagExists: (tagName: string) => tagExists(canonicalPath, tagName),
    createPR: (options: Parameters<typeof createPullRequest>[1]) => createPullRequest(canonicalPath, options),
    listPRs: (filter?: Parameters<typeof listPullRequests>[1]) => listPullRequests(canonicalPath, filter),
    getPR: (prId: string) => getPullRequest(canonicalPath, prId),
    reviewPR: (prId: string, review: Parameters<typeof reviewPullRequest>[2]) =>
      reviewPullRequest(canonicalPath, prId, review),
    mergePR: (prId: string, options?: Parameters<typeof mergePullRequest>[2]) =>
      mergePullRequest(canonicalPath, prId, options),
    closePR: (prId: string, reason?: string) => closePullRequest(canonicalPath, prId, reason),
    createIssue: (options: Parameters<typeof createIssue>[1]) => createIssue(canonicalPath, options),
    listIssues: (filter?: Parameters<typeof listIssues>[1]) => listIssues(canonicalPath, filter),
    getIssue: (issueId: string) => getIssue(canonicalPath, issueId),
    updateIssue: (issueId: string, updates: Parameters<typeof updateIssue>[2]) =>
      updateIssue(canonicalPath, issueId, updates),
    closeIssue: (issueId: string, reason?: string) => closeIssue(canonicalPath, issueId, reason),
  };
}
