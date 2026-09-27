import { DomSanitizer } from '@angular/platform-browser';
import { CategoryItem } from './navbar.models';

/**
 * Creates the list of available category items with sanitized SVG icons for presentation in the navigation menu.
 *
 * @param {DomSanitizer} sanitizer - The Angular DOM sanitizer service.
 * @returns {CategoryItem[]} List of 6 category items.
 */
export function createNavbarCategories(sanitizer: DomSanitizer): CategoryItem[] {
  return [
    {
      id: 'mathematik',
      title: 'Mathematik',
      subtitle: 'Geometrie & Kosmische Ordnung',
      description: 'Erforsche fraktale Harmonien, geometrische Muster und die mathematische Symmetrie des Raumes.',
      iconSvg: sanitizer.bypassSecurityTrustHtml(`
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9" opacity="0.35"/>
          <polygon points="12 4 20 18 4 18"/>
          <circle cx="12" cy="13" r="2.5"/>
          <line x1="12" y1="4" x2="12" y2="18" stroke-dasharray="1.5 2"/>
        </svg>
      `),
    },
    {
      id: 'astronomie',
      title: 'Astronomie',
      subtitle: 'Sterne, Kosmos & Himmelskörper',
      description: 'Erkunde die unendlichen Weiten des Weltalls, ferne Galaxien und die Gravitation kosmischer Sphären.',
      iconSvg: sanitizer.bypassSecurityTrustHtml(`
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <ellipse cx="12" cy="12" rx="10" ry="3.5" transform="rotate(-25 12 12)"/>
          <path d="M19 5 L20 7 L22 7.5 L20 8.5 L19 10.5 L18 8.5 L16 7.5 L18 7 Z" fill="currentColor" stroke="none"/>
        </svg>
      `),
    },
    {
      id: 'natur',
      title: 'Natur',
      subtitle: 'Organische Welten & Elemente',
      description: 'Erlebe die beruhigende Kraft der Natur, von sanft fließendem Wasser bis zu lebendigen floralen Strukturen.',
      iconSvg: sanitizer.bypassSecurityTrustHtml(`
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2C6.5 7 4 12 6 16.5C8 21 16 21 18 16.5C20 12 17.5 7 12 2Z"/>
          <path d="M12 7V19"/>
          <path d="M12 12C9.5 13 8 14.5 8 16"/>
          <path d="M12 10C14.5 11 16 12.5 16 14"/>
        </svg>
      `),
    },
    {
      id: 'geraeusche',
      title: 'Geräusche',
      subtitle: 'Klanglandschaften & Akustik',
      description: 'Tauche ein in meditative Frequenzen, atmosphärische Klangflächen und beruhigende akustische Räume.',
      iconSvg: sanitizer.bypassSecurityTrustHtml(`
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 14h3l3.5-7 3.5 14 3.5-9 2 4h3"/>
          <circle cx="3" cy="14" r="1.5" fill="currentColor"/>
          <circle cx="21" cy="16" r="1.5" fill="currentColor"/>
        </svg>
      `),
    },
    {
      id: 'relax',
      title: 'Relax',
      subtitle: 'Achtsamkeit & Entschleunigung',
      description: 'Finde innere Ruhe und Balance durch sanfte Interaktionen, meditative Momente und stressfreie Sphären.',
      iconSvg: sanitizer.bypassSecurityTrustHtml(`
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="10" cy="14" r="6"/>
          <circle cx="17" cy="8" r="4" opacity="0.75"/>
          <circle cx="17.5" cy="16.5" r="2.5" opacity="0.6"/>
          <path d="M7.5 11.5a3 3 0 0 1 3-3" stroke-linecap="round"/>
        </svg>
      `),
    },
    {
      id: 'abenteuer',
      title: 'Abenteuer',
      subtitle: 'Erkundung & Kosmische Mysterien',
      description: 'Begib dich auf intuitive Entdeckungsreisen, entschlüssele Geheimnisse und erforsche verborgene Pfade.',
      iconSvg: sanitizer.bypassSecurityTrustHtml(`
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"/>
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" fill-opacity="0.2"/>
          <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
        </svg>
      `),
    },
  ];
}
