import { initRepository, getGitStatus, isGitRepository, getGitRoot } from './status.js';
import { stageFiles, stageAll, unstageFiles, discardChanges, cleanUntracked } from './staging.js';
import {
  commit,
  stageAndCommit,
  amendCommit,
  revertCommit,
  cherryPickCommit,
  getCommitLog,
  getCommitDetails,
  getHeadCommit,
  getCommitCount,
} from './commits.js';
import {
  listBranches,
  getCurrentBranch,
  createBranch,
  checkoutBranch,
  deleteBranch,
  renameBranch,
  branchExists,
  setUpstreamBranch,
  getBranchDetails,
} from './branches.js';
import { mergeBranch, abortMerge, getConflictFiles, resolveConflictFile } from './merge.js';
import { getDiff, getDiffSummary, getFileDiff, getShowFile, getChangedFilesBetweenBranches } from './diff.js';
import {
  stashChanges,
  popStash,
  applyStash,
  listStashes,
  dropStash,
  clearStashes,
  getStashDetails,
} from './stash.js';
import { createTag, listTags, deleteTag, tagExists, getTagDetails } from './tags.js';
import {
  getRemotes,
  addRemote,
  setRemoteUrl,
  removeRemote,
  fetchRemote,
  pullFromRemote,
  pushToRemote,
} from './remotes.js';
import {
  createPullRequest,
  listPullRequests,
  getPullRequest,
  updatePullRequest,
  reviewPullRequest,
  mergePullRequest,
  closePullRequest,
  reopenPullRequest,
  deletePullRequest,
} from './prs.js';
import {
  createIssue,
  listIssues,
  getIssue,
  updateIssue,
  closeIssue,
  reopenIssue,
  deleteIssue,
  addIssueComment,
} from './issues.js';
import {
  getAgentAuthor,
  registerAgentAuthor,
  updateAgentAuthor,
  unregisterAgentAuthor,
  hasAgentAuthor,
  createAgentAuthor,
  getAllAgentAuthors,
  listAgentAuthors,
  clearCustomAgentAuthors,
  formatAuthorArg,
  syncAuthorsWithDisk,
  DEFAULT_AGENT_AUTHORS,
} from './authors.js';
import { getGitConfig, updateGitConfig, resetGitConfig } from './config.js';
import * as gitStorage from './storage.js';
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
  amend: amendCommit,
  revert: revertCommit,
  cherryPick: cherryPickCommit,
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
  setUpstream: setUpstreamBranch,
  getBranchDetails,

  // Merge & Conflicts
  merge: mergeBranch,
  abortMerge,
  getConflictFiles,
  resolveConflict: resolveConflictFile,

  // Diff & Inspection
  diff: getDiff,
  diffSummary: getDiffSummary,
  fileDiff: getFileDiff,
  show: getShowFile,
  changedFiles: getChangedFilesBetweenBranches,

  // Stash
  stash: stashChanges,
  popStash,
  applyStash,
  listStashes,
  dropStash,
  clearStashes,
  getStashDetails,

  // Tags
  createTag,
  listTags,
  deleteTag,
  tagExists,
  getTagDetails,

  // Remotes
  getRemotes,
  addRemote,
  setRemoteUrl,
  removeRemote,
  fetch: fetchRemote,
  pull: pullFromRemote,
  push: pushToRemote,

  // Pull Requests
  createPR: createPullRequest,
  listPRs: listPullRequests,
  getPR: getPullRequest,
  updatePR: updatePullRequest,
  reviewPR: reviewPullRequest,
  mergePR: mergePullRequest,
  closePR: closePullRequest,
  reopenPR: reopenPullRequest,
  deletePR: deletePullRequest,

  // Issues
  createIssue,
  listIssues,
  getIssue,
  updateIssue,
  closeIssue,
  reopenIssue,
  deleteIssue,
  addIssueComment,

  // Authors
  getAgentAuthor,
  registerAgentAuthor,
  updateAgentAuthor,
  unregisterAgentAuthor,
  hasAgentAuthor,
  createAgentAuthor,
  getAllAgentAuthors,
  listAgentAuthors,
  clearCustomAgentAuthors,
  formatAuthorArg,
  syncAuthorsWithDisk,
  DEFAULT_AGENT_AUTHORS,

  // Config
  getConfig: getGitConfig,
  updateConfig: updateGitConfig,
  resetConfig: resetGitConfig,

  // Storage
  storage: gitStorage,
};

/**
 * Creates a scoped Git repository service instance bound to a specific repository path.
 *
 * @param repoPath - The repository directory path.
 * @returns Scoped repository interface.
 *
 * @example
 * ```typescript
 * const repo = createRepoService('/path/to/repo');
 * const status = await repo.status();
 * await repo.stageAndCommit({ files: 'README.md', message: 'docs: init' });
 * ```
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
    amend: (options: Parameters<typeof amendCommit>[1]) => amendCommit(canonicalPath, options),
    revert: (options: Parameters<typeof revertCommit>[1]) => revertCommit(canonicalPath, options),
    cherryPick: (options: Parameters<typeof cherryPickCommit>[1]) => cherryPickCommit(canonicalPath, options),
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
    setUpstream: (branchName: string, upstreamRef: string) => setUpstreamBranch(canonicalPath, branchName, upstreamRef),
    getBranchDetails: (branchName: string) => getBranchDetails(canonicalPath, branchName),
    merge: (options: Parameters<typeof mergeBranch>[1]) => mergeBranch(canonicalPath, options),
    abortMerge: () => abortMerge(canonicalPath),
    getConflictFiles: () => getConflictFiles(canonicalPath),
    resolveConflict: (filePath: string) => resolveConflictFile(canonicalPath, filePath),
    diff: (options?: Parameters<typeof getDiff>[1]) => getDiff(canonicalPath, options),
    diffSummary: (options?: Parameters<typeof getDiffSummary>[1]) => getDiffSummary(canonicalPath, options),
    fileDiff: (filePath: string, options?: Parameters<typeof getFileDiff>[2]) =>
      getFileDiff(canonicalPath, filePath, options),
    show: (filePath: string, ref?: string) => getShowFile(canonicalPath, filePath, ref),
    changedFiles: (baseBranch: string, targetBranch: string) =>
      getChangedFilesBetweenBranches(canonicalPath, baseBranch, targetBranch),
    stash: (options?: Parameters<typeof stashChanges>[1]) => stashChanges(canonicalPath, options),
    popStash: (index?: number) => popStash(canonicalPath, index),
    applyStash: (index?: number) => applyStash(canonicalPath, index),
    listStashes: () => listStashes(canonicalPath),
    dropStash: (index?: number) => dropStash(canonicalPath, index),
    clearStashes: () => clearStashes(canonicalPath),
    getStashDetails: (index?: number) => getStashDetails(canonicalPath, index),
    createTag: (tagName: string, options?: Parameters<typeof createTag>[2]) =>
      createTag(canonicalPath, tagName, options),
    listTags: () => listTags(canonicalPath),
    deleteTag: (tagName: string) => deleteTag(canonicalPath, tagName),
    tagExists: (tagName: string) => tagExists(canonicalPath, tagName),
    getTagDetails: (tagName: string) => getTagDetails(canonicalPath, tagName),
    getRemotes: () => getRemotes(canonicalPath),
    addRemote: (name: string, url: string) => addRemote(canonicalPath, name, url),
    setRemoteUrl: (name: string, url: string) => setRemoteUrl(canonicalPath, name, url),
    removeRemote: (name: string) => removeRemote(canonicalPath, name),
    fetch: (options?: Parameters<typeof fetchRemote>[1]) => fetchRemote(canonicalPath, options),
    pull: (options?: Parameters<typeof pullFromRemote>[1]) => pullFromRemote(canonicalPath, options),
    push: (options?: Parameters<typeof pushToRemote>[1]) => pushToRemote(canonicalPath, options),
    createPR: (options: Parameters<typeof createPullRequest>[1]) => createPullRequest(canonicalPath, options),
    listPRs: (filter?: Parameters<typeof listPullRequests>[1]) => listPullRequests(canonicalPath, filter),
    getPR: (prId: string) => getPullRequest(canonicalPath, prId),
    updatePR: (prId: string, updates: Parameters<typeof updatePullRequest>[2]) =>
      updatePullRequest(canonicalPath, prId, updates),
    reviewPR: (prId: string, review: Parameters<typeof reviewPullRequest>[2]) =>
      reviewPullRequest(canonicalPath, prId, review),
    mergePR: (prId: string, options?: Parameters<typeof mergePullRequest>[2]) =>
      mergePullRequest(canonicalPath, prId, options),
    closePR: (prId: string, reason?: string) => closePullRequest(canonicalPath, prId, reason),
    reopenPR: (prId: string) => reopenPullRequest(canonicalPath, prId),
    deletePR: (prId: string) => deletePullRequest(canonicalPath, prId),
    createIssue: (options: Parameters<typeof createIssue>[1]) => createIssue(canonicalPath, options),
    listIssues: (filter?: Parameters<typeof listIssues>[1]) => listIssues(canonicalPath, filter),
    getIssue: (issueId: string) => getIssue(canonicalPath, issueId),
    updateIssue: (issueId: string, updates: Parameters<typeof updateIssue>[2]) =>
      updateIssue(canonicalPath, issueId, updates),
    closeIssue: (issueId: string, reason?: string) => closeIssue(canonicalPath, issueId, reason),
    reopenIssue: (issueId: string) => reopenIssue(canonicalPath, issueId),
    deleteIssue: (issueId: string) => deleteIssue(canonicalPath, issueId),
    addIssueComment: (issueId: string, comment: Parameters<typeof addIssueComment>[2]) =>
      addIssueComment(canonicalPath, issueId, comment),
    getConfig: () => getGitConfig(canonicalPath),
    updateConfig: (updates: Parameters<typeof updateGitConfig>[1]) => updateGitConfig(canonicalPath, updates),
    resetConfig: () => resetGitConfig(canonicalPath),
  };
}
