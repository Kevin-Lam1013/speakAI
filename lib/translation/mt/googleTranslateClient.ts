export class GoogleMTClient {
  private apiKey?: string;
  constructor(opts: { apiKey?: string }) {
    this.apiKey = opts.apiKey;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async translate(text: string, target: string, source?: string): Promise<string> {
    // TODO: implement vendor call
    return text;
  }
}


