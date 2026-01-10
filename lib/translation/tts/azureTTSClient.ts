export class AzureTTSClient {
  private key: string;
  private region: string;
  private voice: string;
  constructor(params: { key: string; region: string; voice: string }) {
    this.key = params.key;
    this.region = params.region;
    this.voice = params.voice;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async synthesize(text: string, language: string): Promise<AsyncIterable<Uint8Array>> {
    async function* gen() {
      // TODO: implement vendor streaming
      yield new Uint8Array();
    }
    return gen();
  }
}
