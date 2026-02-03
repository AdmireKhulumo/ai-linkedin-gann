import langchainClient from '../lib/langchain-client';
import type { AIInvokeResult } from '../lib/langchain-client';
import { z } from 'zod';

const DiscriminatorOutputSchema = z.object({
    score: z.number().min(0).max(10),
});

export type DiscriminatorOutput = z.infer<typeof DiscriminatorOutputSchema>;

const DEFAULT_MODEL_NAME = 'gpt-4o-mini';
const DEFAULT_MODEL_PROVIDER = 'openai';
const DEFAULT_SYSTEM_PROMPT = `You are a discriminator that evaluates how well a generator summarized a source text and picked relevant experiences according to a given prompt.

You receive:
1. The original instruction (what the generator was asked to do)
2. The source text (CV) that was to be summarized
3. The generator's summary output

Score from 0 to 10:
- 10 = perfect: summary accurately reflects the source, picks the most relevant experiences for the prompt, and follows the instruction well
- 0 = very bad: summary is inaccurate, misses relevant experiences, or ignores the prompt

Be consistent and critical. Consider: coverage of relevant experiences, accuracy vs source, and relevance to the prompt criteria. Only output the score. Be strict, giving out anything above 8 should mean that the output is really really good`;

const DEFAULT_SETTINGS = {
    temperature: 0.1,
    maxTokens: 64,
    timeout: 30_000,
};

/** Context the discriminator needs to evaluate summary quality and relevance. */
export type DiscriminatorContext = {
    /** The instruction given to the generator (e.g. "summarise and highlight .NET and AI experience"). */
    generatorPrompt: string;
    /** The source text (CV) that was summarised. */
    cvContent: string;
};

/**
 * GANN discriminator: takes the generator's summary output and scores how well it summarised
 * and picked relevant experiences according to the prompt (0–10). Uses the source CV and
 * generator prompt as context.
 */
export async function run(
    generatorOutput: string,
    context: DiscriminatorContext
): Promise<AIInvokeResult<number>> {
    const { generatorPrompt, cvContent } = context;
    const userPrompt = `Original instruction to the generator:\n${generatorPrompt}\n\n---\nSource text (CV) that was to be summarised:\n${cvContent}\n\n---\nGenerator's summary output:\n${generatorOutput}\n\nScore how well the generator summarised and picked relevant experiences according to the instruction (0–10).`;

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
