## AI LinkedIn GANN

This project is a small experiment in **GANN-style prompt optimization** for tailoring a CV to a specific job description using LLMs.

Instead of training neural networks, it wires together three **AI agents** in a loop:

- **Generator**: given the job requirements, your CV, and a prompt/instruction, it produces text (e.g. selected most relevant work experiences plus summaries).
- **Discriminator**: given the same context plus the generator’s output, it scores how good the result is on a strict 0–10 scale. It gets an example of expected experiences to better judge the generator's ouput.
- **Configurator**: looks at the score, the current generator prompt, and the job/CV context and proposes a **new, better prompt** for the next round.

Running multiple rounds creates a simple **Generative–Adversarial Neural Network (GANN)-like loop** where the generator’s behaviour is steered, not by gradients, but by language feedback and prompt updates. 

### How the project is set up

- **Entry point**: `src/index.ts`
  - Loads three local text files from `src/ai-inputs`: `cv.txt`, `job-requirements.txt`, and `expected-experiences.txt`.
  - Runs a fixed max number of rounds (currently 5) of the GANN loop.
  - In each round it:
    - Builds a context-rich prompt from the job description and CV.
    - Calls the **generator** to produce output.
    - Feeds the result into the **discriminator** to get a score.
    - Asks the **configurator** for the next generator prompt if the score is below a target threshold.

- **Generator agent**: `src/ai-agents/generator.ts`
  - Thin wrapper around `langchainClient.invoke` with a simple system prompt (“You are a generator…”).
  - Accepts a free-form prompt and optional settings (temperature, max tokens, timeout).

- **Discriminator agent**: `src/ai-agents/discriminator.ts`
  - Uses a stricter system prompt and a `zod` schema to parse a numeric score between 0 and 10.
  - Receives job requirements, CV text, the generator instruction, and optionally **expected experiences** as a “ground truth” signal.

- **Configurator agent**: `src/ai-agents/configurator.ts`
  - Keeps a small in-memory **history** of previous prompts and scores.
  - Given the last prompt, config, score, and context, it suggests the **next prompt** that should lead to a higher score.
  - Uses a `zod` schema to validate the suggested prompt and returns plain text.

- **Model client**: `src/lib/langchain-client.ts`
  - Central place where model provider, model name, and invocation settings are configured.
  - Reads environment/API keys via `dotenv` and `process.env` (see `.env.example`).

The combination of these pieces gives you a minimal but expressive playground for experimenting with **multi-agent prompt improvement loops** on real CV and job text.

### Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure your environment**

   - Copy `.env.example` to `.env`:

     ```bash
     cp .env.example .env
     ```

   - Fill in any required API keys or model provider settings in `.env` (e.g. OpenAI or compatible endpoint).

3. **Provide your data**

   Ensure the following text files exist in `src/ai-inputs`:

   - `cv.txt` – your CV/resumé in plain text.
   - `job-requirements.txt` – pasted job description or requirements.
   - `expected-experiences.txt` – (optional but recommended) a few bullet points describing the **ideal experiences** that should be selected for this job. The discriminator uses this as ground truth.

4. **Run the loop**

   ```bash
   npx ts-node src/index.ts
   ```

   You’ll see, for each round:

   - The current **generator prompt**.
   - The **generator** output.
   - The **discriminator** score.
   - The **configurator’s** suggested next prompt.

5. **Adjust and experiment**

   - Tweak `NUM_ROUNDS`, the initial generator prompt, and `GENERATOR_CONFIG` in `src/index.ts`.
   - Modify the system prompts or model names in the agent files.
   - Change the scoring strictness or expected experiences to explore different optimisation behaviours.
