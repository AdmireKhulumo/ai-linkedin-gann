import langchainClient from '../lib/langchain-client';
import type { AIInvokeResult } from '../lib/langchain-client';
import { z } from 'zod';

const ConfiguratorOutputSchema = z.object({
    suggestedTemperature: z.number().min(0).max(2),
});

export type ConfiguratorOutput = z.infer<typeof ConfiguratorOutputSchema>;

/** Generator config snapshot (what was used for a run). */
export type GeneratorConfigSnapshot = {
    temperature: number;
    maxTokens: number;
    timeout?: number;
};

/** One entry in configurator history: a past run and its outcome. */
export type ConfiguratorHistoryEntry = {
    generatorPrompt: string;
    generatorConfig: GeneratorConfigSnapshot;
    score: number;
    /** Temperature we suggested for the *next* run after this (if any). */
    suggestedNextTemperature?: number;
};

const DEFAULT_MODEL_NAME = 'gpt-4o-mini';
const DEFAULT_MODEL_PROVIDER = 'openai';
const DEFAULT_SYSTEM_PROMPT = `You are a configurator for a GAN-like setup where the generator summarises a CV according to a prompt and the discriminator scores how well the summary and choice of experiences match the prompt (0–10; 10 = perfect, 0 = very bad).

- The generator produces a summary from the source CV and a given instruction, using an LLM with a given temperature.
- The discriminator scores that summary for quality and relevance (not funniness).
- Your job: given the generator's instruction, the config (especially temperature) that was used, and the score, suggest the temperature the generator should use NEXT so that the next score is likely to be higher.

Consider:
- Lower temperature (e.g. 0.3–0.6) tends to be more focused and consistent; higher (e.g. 0.7–1.2) more creative/random.
- Use history of past runs to spot patterns (e.g. "when we used 0.9, score dropped; when we used 0.5, score rose").
- Suggest one number in the range 0 to 2. Be decisive.`;

const DEFAULT_SETTINGS = {
    temperature: 0.2,
    maxTokens: 128,
    timeout: 30_000,
};

/** In-memory history of generator runs and scores for the configurator. */
let history: ConfiguratorHistoryEntry[] = [];

/**
 * Returns the current configurator history (read-only snapshot).
 */
export function getHistory(): readonly ConfiguratorHistoryEntry[] {
    return history;
}

/**
 * Clears the in-memory history (e.g. for tests or a new session).
 */
export function clearHistory(): void {
    history = [];
}

/**
 * Configurator: receives generator config + prompt + discriminator score,
 * optional CV context, uses in-memory history, and suggests the next temperature to maximise score.
 */
export async function suggestNextTemperature(params: {
    generatorPrompt: string;
    generatorConfig: GeneratorConfigSnapshot;
    score: number;
    /** Optional: source CV content for context (same as used by generator and discriminator). */
    cvContent?: string;
}): Promise<AIInvokeResult<number>> {
    const { generatorPrompt, generatorConfig, score, cvContent } = params;

    const entry: ConfiguratorHistoryEntry = {
        generatorPrompt,
        generatorConfig: { ...generatorConfig },
        score,
    };
    history.push(entry);

    const historyBlock =
        history.length === 0
            ? 'No previous runs yet.'
            : history
                .map((h, i) => {
                    const part = `Run ${i + 1}: prompt="${h.generatorPrompt.slice(0, 120)}${h.generatorPrompt.length > 120 ? '...' : ''}", temperature=${h.generatorConfig.temperature}, score=${h.score}`;
                    if (h.suggestedNextTemperature != null) {
                        return part + ` (suggested next temp: ${h.suggestedNextTemperature})`;
                    }
                    return part;
                })
                .join('\n');

    const cvBlock =
        cvContent != null
            ? `\n\nSource CV context (same text the generator summarises):\n${cvContent.slice(0, 2000)}${cvContent.length > 2000 ? '...' : ''}`
            : '';
    const userPrompt = `History of runs (most recent last):\n${historyBlock}\n\nCurrent run we just got the score for: prompt="${generatorPrompt}", temperature=${generatorConfig.temperature}, score=${score}.${cvBlock}\n\nWhat temperature should the generator use for the NEXT run to maximise the score? Reply with a single number between 0 and 2.`;

    const result = await langchainClient.invoke(
        DEFAULT_MODEL_NAME,
        DEFAULT_SYSTEM_PROMPT,
        userPrompt,
        DEFAULT_SETTINGS,
        ConfiguratorOutputSchema,
        DEFAULT_MODEL_PROVIDER
    );

    if (result.success) {
        const suggested = result.response.suggestedTemperature;
        if (history.length > 0) {
            history[history.length - 1].suggestedNextTemperature = suggested;
        }
        return { success: true, response: suggested };
    }
    return { success: false, error: result.error };
}

export { ConfiguratorOutputSchema };
