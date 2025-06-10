import { Language, Translate, Security, HighQuality } from '@mui/icons-material';

export const features = [
  {
    title: 'Real-time Translation',
    description:
      'Experience seamless communication with instant translation across multiple languages.',
    icon: Translate,
  },
  {
    title: 'Multiple Languages',
    description: 'Support for 8 major languages including English, Spanish, Chinese, and more.',
    icon: Language,
  },
  {
    title: 'Secure Communication',
    description: 'End-to-end encryption ensuring your conversations remain private and secure.',
    icon: Security,
  },
  {
    title: 'High-Quality Audio',
    description: 'Crystal clear audio with noise reduction and echo cancellation.',
    icon: HighQuality,
  },
];

export const statistics = [
  {
    value: '8+',
    label: 'Languages',
  },
  {
    value: '<500ms',
    label: 'Latency',
  },
  {
    value: '99.9%',
    label: 'Uptime',
  },
];

export const supportedLanguages = [
  { code: 'EN', name: 'English' },
  { code: 'ES', name: 'Spanish' },
  { code: 'FR', name: 'French' },
  { code: 'ZH', name: 'Chinese' },
  { code: 'HI', name: 'Hindi' },
  { code: 'AR', name: 'Arabic' },
  { code: 'BN', name: 'Bengali' },
  { code: 'PT', name: 'Portuguese' },
];
