export async function getHealthCoachAdvice(input) {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return 'Пей воду равномерно в течение дня, добавь 20-30 минут ходьбы и постарайся лечь спать на 30 минут раньше.';
  }

  const base = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Ты краткий health coach. Дай 2-3 конкретных совета.' },
        { role: 'user', content: JSON.stringify(input) },
      ],
      temperature: 0.5,
      max_tokens: 150,
    }),
  });

  if (!response.ok) throw new Error('AI provider request failed');
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || 'Сегодня держи фокус на воде, белке и стабильном сне.';
}
