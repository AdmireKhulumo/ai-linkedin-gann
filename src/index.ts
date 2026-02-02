import 'dotenv/config';
import { run as runGenerator, type GeneratorSettings } from './ai-agents/generator';
import { run as runDiscriminator } from './ai-agents/discriminator';
import { suggestNextTemperature, type GeneratorConfigSnapshot } from './ai-agents/configurator';

const GENERATOR_PROMPT = 'Say hello in one sentence that sounds funny.';
const NUM_ROUNDS = 3;

async function main(): Promise<void> {
  console.log('AI LinkedIn GANN\n');

  let currentConfig: GeneratorConfigSnapshot = {
    temperature: 0.7,
    maxTokens: 1024,
    timeout: 30_000,
  };

  for (let round = 1; round <= NUM_ROUNDS; round++) {
    console.log(`--- Round ${round} ---`);
    console.log('Generator config (temperature):', currentConfig.temperature);

    const genResult = await runGenerator(GENERATOR_PROMPT, currentConfig as GeneratorSettings);
    if (!genResult.success) {
      console.error('Generator error:', genResult.error);
      return;
    }

    const text = genResult.response;
    console.log('\n  [Generator]\n  ', text);

    const discResult = await runDiscriminator(text);
    if (!discResult.success) {
      console.error('Discriminator error:', discResult.error);
      return;
    }

    const score = discResult.response;
    console.log('\n  [Discriminator]\n  ', 'Score:', score);

    const configResult = await suggestNextTemperature({
      generatorPrompt: GENERATOR_PROMPT,
      generatorConfig: currentConfig,
      score,
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
