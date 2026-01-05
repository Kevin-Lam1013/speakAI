'use client';

import { useEffect, useRef } from 'react';

interface TranslatedAudioSinkProps {
  // Map of track labels (e.g., `${speakerId}:${language}`) to MediaStreamTrack or MediaStream
  streams: MediaStream[];
  replaceMode?: boolean; // when true, original should be muted by caller
}

export default function TranslatedAudioSink({ streams, replaceMode = true }: TranslatedAudioSinkProps) {
  const audioRefs = useRef<HTMLAudioElement[]>([]);

  useEffect(() => {
    // Ensure we have an <audio> element per stream
    const needed = Math.max(streams.length, 0);
    while (audioRefs.current.length < needed) {
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.playsInline = true;
      audio.volume = 1.0;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      audioRefs.current.push(audio);
    }
    // Attach streams
    streams.forEach((ms, idx) => {
      const audio = audioRefs.current[idx];
      if (audio && audio.srcObject !== ms) {
        audio.srcObject = ms;
      }
    });

    // Cleanup extra audios
    for (let i = streams.length; i < audioRefs.current.length; i++) {
      const audio = audioRefs.current[i];
      if (audio) {
        audio.pause();
        audio.srcObject = null;
        document.body.removeChild(audio);
      }
    }
    audioRefs.current = audioRefs.current.slice(0, streams.length);

    return () => {
      // On unmount, remove all
      audioRefs.current.forEach(a => {
        a.pause();
        a.srcObject = null;
        if (a.parentNode) a.parentNode.removeChild(a);
      });
      audioRefs.current = [];
    };
  }, [streams]);

  return null;
}


