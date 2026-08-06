import Groq from 'groq-sdk';

let groqClient: Groq | null = null;
let isUsingOpenRouter = false;

export function getGroqClient(): { client: Groq; defaultModel: string } {
  const groqKey = process.env.GROQ_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  // 1. Direct Groq API Key
  if (groqKey && groqKey.startsWith('gsk_')) {
    if (!groqClient) {
      groqClient = new Groq({ apiKey: groqKey });
      isUsingOpenRouter = false;
    }
    return { client: groqClient, defaultModel: 'llama-3.3-70b-versatile' };
  }

  // 2. OpenRouter API Key
  if (openRouterKey && openRouterKey.startsWith('sk-or-v1-')) {
    if (!groqClient) {
      groqClient = new Groq({
        apiKey: openRouterKey,
        baseURL: 'https://openrouter.ai/api/v1',
      });
      isUsingOpenRouter = true;
    }
    return { client: groqClient, defaultModel: 'meta-llama/llama-3.3-70b-instruct' };
  }

  // Fallback to whichever key string exists
  const keyToUse = (groqKey && groqKey !== 'gsk_your_actual_groq_api_key_here')
    ? groqKey
    : openRouterKey || '';

  if (keyToUse) {
    if (!groqClient) {
      groqClient = new Groq({ apiKey: keyToUse });
    }
    return { client: groqClient, defaultModel: 'llama-3.3-70b-versatile' };
  }

  throw new Error(
    'No valid AI API key found. Please configure GROQ_API_KEY or OPENROUTER_API_KEY in .env file.'
  );
}

export async function generateGroqJSON<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  modelOverride?: string
): Promise<T> {
  const { client, defaultModel } = getGroqClient();
  const model = modelOverride || defaultModel;

  const response = await client.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: `${systemPrompt}\n\nIMPORTANT: Respond ONLY with valid JSON matching the requested structure without markdown code blocks.`,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
    model,
    temperature: 0.2,
    ...(isUsingOpenRouter ? {} : { response_format: { type: 'json_object' } }),
  });

  const content = response.choices[0]?.message?.content || '{}';
  const cleaned = content.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    console.error('Failed to parse AI JSON response:', content);
    throw new Error('Invalid JSON response format received from AI model.');
  }
}

export async function generateGroqText(
  systemPrompt: string,
  userPrompt: string,
  modelOverride?: string
): Promise<string> {
  const { client, defaultModel } = getGroqClient();
  const model = modelOverride || defaultModel;

  const response = await client.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    model,
    temperature: 0.4,
  });

  return response.choices[0]?.message?.content || '';
}
