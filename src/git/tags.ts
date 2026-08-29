import { withGitErrorHandling } from './client.js';
import type { TagOptions, TagDetails } from './types.js';
import { GitRefNameSchema } from './schema.js';
import { GitValidationError, GitTagNotFoundError } from './errors.js';
import { devInfo } from '../core/dev-mode/index.js';

/**
 * Validates a Git tag name.
 *
 * @param name - The tag name string to validate.
 * @returns The validated tag name.
 * @throws GitValidationError if tag name format is invalid.
 *
 * @example
 * ```typescript
 * const valid = validateTagName('v1.0.0');
 * ```
 */
export function validateTagName(name: string): string {
  const parseResult = GitRefNameSchema.safeParse(name);
  if (!parseResult.success) {
    throw new GitValidationError(
      `Invalid Git tag name '${name}': ${parseResult.error.issues.map((i) => i.message).join(', ')}`
    );
  }
  return parseResult.data;
}

/**
 * Creates a new Git tag (annotated or lightweight).
 *
 * @param repoPath - Repository root directory path.
 * @param tagName - Name of the tag to create (e.g. 'v1.0.0').
 * @param options - Tag message, ref, author, and annotation options.
 *
 * @example
 * ```typescript
 * await createTag('/my-repo', 'v1.0.0', { message: 'First stable release' });
 * ```
 */
export async function createTag(
  repoPath: string,
  tagName: string,
  options?: TagOptions
): Promise<void> {
  const validatedName = validateTagName(tagName);

  return withGitErrorHandling('createTag', repoPath, async (client) => {
    const tagArgs: string[] = [];

    if (options?.annotate ?? true) {
      tagArgs.push('-a', validatedName);
      tagArgs.push('-m', options?.message ?? `Release tag ${validatedName}`);
    } else {
      tagArgs.push(validatedName);
    }

    if (options?.ref) {
      tagArgs.push(options.ref);
    }

    await client.tag(tagArgs);
    devInfo('GIT_TAG', `Created tag '${validatedName}'`);
  });
}

/**
 * Lists all tag names in the repository.
 *
 * @param repoPath - Repository root directory path.
 * @returns Array of tag names.
 *
 * @example
 * ```typescript
 * const tags = await listTags('/my-repo');
 * ```
 */
export async function listTags(repoPath: string): Promise<string[]> {
  return withGitErrorHandling('listTags', repoPath, async (client) => {
    const tagResult = await client.tags();
    return tagResult.all;
  });
}

/**
 * Checks if a specific tag exists in the repository.
 *
 * @param repoPath - Repository root directory path.
 * @param tagName - Tag name to check.
 * @returns True if tag exists.
 *
 * @example
 * ```typescript
 * if (await tagExists('/my-repo', 'v1.0.0')) { ... }
 * ```
 */
export async function tagExists(repoPath: string, tagName: string): Promise<boolean> {
  const tags = await listTags(repoPath);
  return tags.includes(tagName);
}

/**
 * Retrieves detailed inspection for a specific tag.
 *
 * @param repoPath - Repository root directory path.
 * @param tagName - Name of the tag.
 * @returns TagDetails object.
 * @throws GitTagNotFoundError if tag does not exist.
 *
 * @example
 * ```typescript
 * const details = await getTagDetails('/my-repo', 'v1.0.0');
 * ```
 */
export async function getTagDetails(repoPath: string, tagName: string): Promise<TagDetails> {
  const validatedName = validateTagName(tagName);

  if (!(await tagExists(repoPath, validatedName))) {
    throw new GitTagNotFoundError(validatedName, { repoPath });
  }

  return withGitErrorHandling('getTagDetails', repoPath, async (client) => {
    const commit = (await client.revparse([validatedName])).trim();
    const showOutput = await client.show([validatedName, '--summary']);

    return {
      name: validatedName,
      commit,
      message: showOutput,
    };
  });
}

/**
 * Deletes a tag locally from the repository.
 *
 * @param repoPath - Repository root directory path.
 * @param tagName - Tag name to delete.
 *
 * @example
 * ```typescript
 * await deleteTag('/my-repo', 'v1.0.0');
 * ```
 */
export async function deleteTag(repoPath: string, tagName: string): Promise<void> {
  const validatedName = validateTagName(tagName);

  return withGitErrorHandling('deleteTag', repoPath, async (client) => {
    await client.tag(['-d', validatedName]);
    devInfo('GIT_TAG', `Deleted tag '${validatedName}'`);
  });
}
