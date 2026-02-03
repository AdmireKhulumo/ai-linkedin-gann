import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { run as runGenerator, type GeneratorSettings } from './ai-agents/generator';
import { run as runDiscriminator } from './ai-agents/discriminator';
import { suggestNextTemperature, type GeneratorConfigSnapshot } from './ai-agents/configurator';

const CV_PATH = path.join(process.cwd(), 'cv.txt');
const GENERATOR_PROMPT = 'Write a 3 sentence summary of this consultants CV, highlighting top experiences which make them a good .NET and AI developer.';
const NUM_ROUNDS = 5;

async function main(): Promise<void> {
  console.log('AI LinkedIn GANN\n');

  const cvContent = fs.readFileSync(CV_PATH, 'utf-8');
  const fullGeneratorPrompt = `${cvContent}\n\n---\n\n${GENERATOR_PROMPT}`;

  let currentConfig: GeneratorConfigSnapshot = {
    temperature: 2.0,
    maxTokens: 1024,
    timeout: 30_000,
  };

  const discriminatorContext = { generatorPrompt: GENERATOR_PROMPT, cvContent };

  for (let round = 1; round <= NUM_ROUNDS; round++) {
    console.log(`--- Round ${round} ---`);
    console.log('Generator config (temperature):', currentConfig.temperature);

    const genResult = await runGenerator(fullGeneratorPrompt, currentConfig as GeneratorSettings);
    if (!genResult.success) {
      console.error('Generator error:', genResult.error);
      return;
    }

    const text = genResult.response;
    console.log('\n  [Generator]\n  ', text);

    const discResult = await runDiscriminator(text, discriminatorContext);
    if (!discResult.success) {
      console.error('Discriminator error:', discResult.error);
      return;
    }

    const score = discResult.response;
    console.log('\n  [Discriminator]\n  ', 'Score:', score);

    if (score >= 9) {
      console.log('\nTarget score (9+) reached. Stopping.');
      break;
    }

    const configResult = await suggestNextTemperature({
      generatorPrompt: GENERATOR_PROMPT,
      generatorConfig: currentConfig,
      score,
      cvContent,
    });

    if (!configResult.success) {
      console.error('Configurator error:', configResult.error);
      return;
    }

    const suggestedTemp = configResult.response;
    console.log('\n  [Configurator]\n  ', 'Suggested temperature:', suggestedTemp);
    currentConfig = { ...currentConfig, temperature: suggestedTemp };
    console.log('');
  }

  console.log('Done.');
}

main();
