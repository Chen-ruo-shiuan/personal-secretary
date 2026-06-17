const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!

export async function pushMessage(userId: string, messages: object[]) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ to: userId, messages }),
  })
}

export function textMessage(text: string) {
  return { type: 'text', text }
}

export function flexMessage(altText: string, contents: object) {
  return { type: 'flex', altText, contents }
}
