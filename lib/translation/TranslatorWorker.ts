import { PipelineManager } from './PipelineManager';
import type { LanguageCode } from './types';

// Skeleton worker that will own the wrtc peer and pipelines per room
export class TranslatorWorker {
  private pipelineManager: PipelineManager;
  constructor() {
    this.pipelineManager = new PipelineManager();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async joinRoom(_roomId: string): Promise<void> {
    // TODO: create wrtc peer connection(s) and handle tracks
  }

  async ensurePipeline(speakerId: string, language: LanguageCode) {
    return this.pipelineManager.startPipeline(speakerId, language);
  }

  async stopPipeline(speakerId: string, language: LanguageCode) {
    return this.pipelineManager.stopPipeline(speakerId, language);
  }
}
