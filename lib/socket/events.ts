// Translation-related Socket.IO event names
export const EVENT_TRANSLATION_PREFERENCE = 'translation:preference';
export const EVENT_TRANSLATION_TRACK_READY = 'translation:track-ready';
export const EVENT_TRANSLATION_PIPELINE_STATUS = 'translation:pipeline-status';

// SFU signaling event names
export const SFU_GET_ROUTER_RTP_CAPABILITIES = 'sfu:get-router-rtp-capabilities';
export const SFU_CREATE_TRANSPORT = 'sfu:create-transport';
export const SFU_CONNECT_TRANSPORT = 'sfu:connect-transport';
export const SFU_PRODUCE = 'sfu:produce';
export const SFU_CONSUME = 'sfu:consume';
export const SFU_RESUME_CONSUMER = 'sfu:resume-consumer';
export const SFU_NEW_PRODUCER = 'sfu:new-producer';
export const SFU_CLOSE_PRODUCER = 'sfu:close-producer';
export const SFU_PRODUCER_CLOSED = 'sfu:producer-closed';
