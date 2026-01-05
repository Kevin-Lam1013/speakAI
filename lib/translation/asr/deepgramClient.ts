export interface DeepgramTranscript {
  text: string;
  isFinal: boolean;
}

export class DeepgramASRClient {
  private apiKey: string;
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Placeholder streaming method signature
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  streamRecognize(_pcmStream: AsyncIterable<Float32Array>): AsyncIterable<DeepgramTranscript> {
    async function* gen() {
      // TODO: implement vendor streaming
      yield { text: '', isFinal: false };
    }
    return gen();
  }
}


