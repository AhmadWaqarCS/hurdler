import { withGitErrorHandling } from './client.js';
import type { TagOptions } from './types.js';
import { GitRefNameSchema } from './schema.js';
import { GitValidationError } from './errors.js';
import { devInfo } from '../core/dev-mode/index.js';

/**
 * Validates a Git tag name.
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
 * Creates a new Git tag.
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
 * Lists all tags in the repository.
 */
export async function listTags(repoPath: string): Promise<string[]> {
  return withGitErrorHandling('listTags', repoPath, async (client) => {
    const tagResult = await client.tags();
    return tagResult.all;
  });
}

/**
 * Checks if a tag exists.
 */
export async function tagExists(repoPath: string, tagName: string): Promise<boolean> {
  const tags = await listTags(repoPath);
  return tags.includes(tagName);
}

/**
 * Deletes a tag locally.
 */
export async function deleteTag(repoPath: string, tagName: string): Promise<void> {
  const validatedName = validateTagName(tagName);

  return withGitErrorHandling('deleteTag', repoPath, async (client) => {
    await client.tag(['-d', validatedName]);
    devInfo('GIT_TAG', `Deleted tag '${validatedName}'`);
  });
}
