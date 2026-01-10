import type { LanguageCode, PipelineState, TrackDescriptor } from './types';

// Placeholder for pipeline lifecycle manager (no implementation yet)
export class PipelineManager {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  startPipeline(_speakerId: string, _language: LanguageCode): Promise<TrackDescriptor> {
    return Promise.resolve({
      speakerId: 'placeholder',
      language: 'en-US',
      trackLabel: 'placeholder:en-US',
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  stopPipeline(_speakerId: string, _language: LanguageCode): Promise<void> {
    return Promise.resolve();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getState(_speakerId: string, _language: LanguageCode): PipelineState {
    return 'stopped';
  }
}
