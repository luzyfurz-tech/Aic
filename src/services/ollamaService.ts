import { Message } from 'ollama';

class OllamaService {
  private apiKey: string | null = null;
  private host: string = 'https://ollama.com';

  setApiKey(key: string) { this.apiKey = key; }
  setHost(host: string) { this.host = host; }

  async fetchModels() {
    const response = await fetch('/api/models', {
      headers: { 
        'Authorization': `Bearer ${this.apiKey || ''}`,
        'X-Ollama-Host': this.host
      },
    });
    const data = await response.json();
    return data.models || [];
  }

  async *sendMessageStream(model: string, messages: Message[]) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey || ''}`,
        'X-Ollama-Host': this.host
      },
      body: JSON.stringify({ model, messages, stream: true }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          yield JSON.parse(line.slice(6));
        }
      }
    }
  }
}
export const ollamaService = new OllamaService();
