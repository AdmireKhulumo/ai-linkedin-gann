import langchainClient from '../lib/langchain-client';
import type { AIInvokeResult } from '../lib/langchain-client';
import { z } from 'zod';

const DiscriminatorOutputSchema = z.object({
    score: z.number().min(0).max(10),
});

export type DiscriminatorOutput = z.infer<typeof DiscriminatorOutputSchema>;

const DEFAULT_MODEL_NAME = 'gpt-4o-mini';
const DEFAULT_MODEL_PROVIDER = 'openai';
const DEFAULT_SYSTEM_PROMPT = `You are a discriminator that scores how funny a piece of text is.
Output a single numeric score from 0 to 10:
- 0 = not funny at all
- 10 = extremely funny
Be consistent and critical. Only output the score.`;

const DEFAULT_SETTINGS = {
    temperature: 0.1,
    maxTokens: 64,
    timeout: 30_000,
};

/**
 * GANN discriminator: takes the generator's text output and scores its funniness (0–10).
 * Uses the same model as the generator with very low temperature for consistent scoring.
 */
export async function run(generatorOutput: string): Promise<AIInvokeResult<number>> {
    const userPrompt = `Score how funny this text is (0–10):\n\n${generatorOutput}`;

    const result = await langchainClient.invoke(
        DEFAULT_MODEL_NAME,
        DEFAULT_SYSTEM_PROMPT,
        userPrompt,
        DEFAULT_SETTINGS,
        DiscriminatorOutputSchema,
        DEFAULT_MODEL_PROVIDER
    );

    if (result.success) {
        return { success: true, response: result.response.score };
    }
    return { success: false, error: result.error };
}

export { DiscriminatorOutputSchema };
