export interface Minigame {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge: '3D WebGL' | 'Zen Audio' | 'Chill Sandbox' | 'Creative';
  route: string;
  icon: string;
  primaryColor: string;
  glowColor: string;
  tags: string[];
  floatDelay: string;
  floatDuration: string;
  sizeClass: 'bubble--lg' | 'bubble--md' | 'bubble--sm';
}
