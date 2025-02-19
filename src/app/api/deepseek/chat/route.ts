import { OpenAI } from 'openai';
import { OpenAIStream, StreamingTextResponse } from 'ai';

// Create an OpenAI API client with custom base URL
const client = new OpenAI({
  baseURL: 'http://127.0.0.1:1234/v1',
});

export const runtime = 'edge';

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Add system message to encourage reasoning first
  const systemMessage = {
    role: 'system',
    content: `You are a helpful assistant.`
  };

  // Add system message to the beginning of the messages array
  const augmentedMessages = [systemMessage, ...messages];

  // Ask DeepSeek for a streaming chat completion
  const response = await client.chat.completions.create({
    model: 'lmstudio-community/deepseek-r1-distill-qwen-7b',
    stream: true,
    messages: augmentedMessages.map((message: any) => ({
      content: message.content,
      role: message.role,
    })),
  });

  const stream = OpenAIStream(response);
  return new StreamingTextResponse(stream);
} 