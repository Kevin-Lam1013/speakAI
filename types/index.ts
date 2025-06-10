import { SvgIconComponent } from '@mui/icons-material';

export interface Feature {
  title: string;
  description: string;
  icon: SvgIconComponent;
}

export interface Statistic {
  value: string;
  label: string;
}

export interface Language {
  code: string;
  name: string;
}

export interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}
