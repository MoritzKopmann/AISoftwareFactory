import { z } from 'zod';
import type { RunTool } from '../../../runner/index.js';
import { ArtifactNotFoundError } from '../../logic/errors/artifact-not-found-error.js';
import type { PublishArtifactUseCase } from '../../logic/use-cases/publish-artifact-use-case.js';

// Loose on purpose: a bad value must come back as error text the session can read, not as a schema error.
const inputShape = {
  artifactId: z
    .string()
    .describe(
      'The folder name under .aisf/artifacts/. Lowercase letters, digits and dashes, 1 to 64 characters, starting with a letter or digit.',
    ),
  title: z.string().describe('What the human sees as the name of the page.'),
};
const inputSchema = z.object({
  artifactId: z
    .string()
    .regex(
      /^[a-z0-9][a-z0-9-]{0,63}$/,
      'artifactId must be 1 to 64 characters of lowercase letters, digits and dashes, starting with a letter or digit',
    ),
  title: z.string().min(1, 'title must not be empty'),
});

export function createShowArtifactTool(publishArtifact: PublishArtifactUseCase): RunTool {
  return {
    name: 'aisf_show_artifact',
    description:
      'Show the human a page and wait for them. Publishes .aisf/artifacts/<artifactId>/index.html in your worktree, then pauses the run at a checkpoint until the human answers.',
    inputShape,
    execute: async (input, runContext) => {
      const parsed = inputSchema.safeParse(input);
      if (!parsed.success) {
        return {
          text: `Nothing published. ${parsed.error.issues.map(({ message }) => message).join('; ')}`,
        };
      }
      const { artifactId, title } = parsed.data;
      try {
        await publishArtifact.execute({
          projectId: runContext.projectId,
          ticketNumber: runContext.ticketNumber,
          runId: runContext.runId,
          worktreePath: runContext.worktreePath,
          artifactId,
          title,
        });
      } catch (error) {
        if (error instanceof ArtifactNotFoundError) {
          return { text: `Nothing published. ${error.message}` };
        }
        throw error;
      }
      return {
        wait: {
          kind: 'checkpoint',
          request: `The page "${title}" is ready on the ticket page. Open it and answer there.`,
          artifactId,
        },
      };
    },
  };
}
