'use client';

import { useMemo } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
} from '@mui/material';

export type LanguageCode = 'en-US' | 'fr-FR' | 'es-ES' | 'zh-CN';

interface TranslationControlsProps {
  selectedLanguage: LanguageCode | null;
  onLanguageChange: (language: LanguageCode | null) => void;
}

export default function TranslationControls({
  selectedLanguage,
  onLanguageChange,
}: TranslationControlsProps) {
  const options = useMemo(
    () => [
      { code: 'en-US', label: 'English (US)' },
      { code: 'fr-FR', label: 'French' },
      { code: 'es-ES', label: 'Spanish' },
      { code: 'zh-CN', label: 'Mandarin (Simplified)' },
    ],
    []
  );

  const handleChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value;
    if (!value || value === 'none') {
      onLanguageChange(null);
    } else {
      onLanguageChange(value as LanguageCode);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1.5,
        py: 1,
        bgcolor: theme =>
          theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
        borderRadius: 2,
      }}
    >
      <Typography variant="body2" sx={{ opacity: 0.8 }}>
        Target language
      </Typography>
      <FormControl
        size="small"
        variant="outlined"
        sx={{
          minWidth: 240,
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
            backgroundColor: theme =>
              theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : '#fff',
          },
        }}
      >
        <InputLabel id="translation-language-label">Select</InputLabel>
        <Select
          labelId="translation-language-label"
          id="translation-language-select"
          value={selectedLanguage ?? 'none'}
          label="Select"
          onChange={handleChange}
        >
          <MenuItem value="none">Original (no translation)</MenuItem>
          {options.map(opt => (
            <MenuItem key={opt.code} value={opt.code}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
