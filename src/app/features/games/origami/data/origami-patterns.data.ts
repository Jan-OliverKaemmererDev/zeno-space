import { OrigamiPaperStyle, OrigamiPattern } from '../models/origami.models';

/**
 * Predefined paper colors and authentic Japanese Washi patterns.
 */
export const PAPER_STYLES: OrigamiPaperStyle[] = [
  {
    id: 'sakura',
    name: 'Sakura Kirschblüte',
    primaryColor: '#f472b6',
    secondaryColor: '#fbcfe8',
    accentColor: '#be185d',
    patternType: 'solid',
  },
  {
    id: 'matcha',
    name: 'Zen Matcha',
    primaryColor: '#4ade80',
    secondaryColor: '#bbf7d0',
    accentColor: '#15803d',
    patternType: 'solid',
  },
  {
    id: 'indigo',
    name: 'Aizome Indigo',
    primaryColor: '#38bdf8',
    secondaryColor: '#bae6fd',
    accentColor: '#0369a1',
    patternType: 'solid',
  },
  {
    id: 'kurenai',
    name: 'Kurenai Zinnober',
    primaryColor: '#ef4444',
    secondaryColor: '#fecaca',
    accentColor: '#b91c1c',
    patternType: 'solid',
  },
  {
    id: 'yuzu',
    name: 'Yuzu Goldgelb',
    primaryColor: '#fbbf24',
    secondaryColor: '#fef3c7',
    accentColor: '#b45309',
    patternType: 'solid',
  },
  {
    id: 'fuji',
    name: 'Fuji Lavendel',
    primaryColor: '#c084fc',
    secondaryColor: '#f3e8ff',
    accentColor: '#7e22ce',
    patternType: 'solid',
  },
  {
    id: 'seigaiha',
    name: 'Washi Seigaiha (Wellen)',
    primaryColor: '#0284c7',
    secondaryColor: '#38bdf8',
    accentColor: '#ffffff',
    patternType: 'seigaiha',
  },
  {
    id: 'asanoha',
    name: 'Washi Asanoha (Sterne)',
    primaryColor: '#e11d48',
    secondaryColor: '#fb7185',
    accentColor: '#ffe4e6',
    patternType: 'asanoha',
  },
];

/**
 * All three featured origami motifs with real, progressive folding phases in 500x500 coordinate space.
 */
export const ORIGAMI_PATTERNS: OrigamiPattern[] = [
  // ==========================================
  // 1. KRANICH (TSURU / 折鶴)
  // ==========================================
  {
    id: 'crane',
    name: 'Kranich',
    japaneseName: 'Tsuru',
    kanji: '折鶴',
    subtitle: 'Der zeitlose Klassiker des Friedens & der Geduld',
    difficulty: 'Mittel',
    symbolism: '1.000 gefaltete Kraniche (Senbazuru) erfüllen einen Herzenswunsch nach Gesundheit und Frieden.',
    durationEst: 'ca. 5–8 Minuten',
    totalSteps: 18,
    iconSvgPath: 'M 250,90 L 390,270 L 250,420 L 110,270 Z M 250,90 L 250,420 M 110,270 L 390,270',
    steps: [
      {
        stepNumber: 1,
        name: 'Diagonale Talfalte',
        instruction: 'Lege das quadratische Papier als Raute vor dich. Falte die untere Ecke exakt auf die obere Spitze.',
        creaseType: 'valley',
        tip: 'Streiche die Faltkante mit dem Fingernagel oder Falzbein sauber glatt.',
        hotspot: { x: 250, y: 440, label: 'Untere Ecke nach oben falten' },
        arrow: { fromX: 250, fromY: 440, toX: 250, toY: 90, curveOffset: -30 },
        creaseLines: [{ x1: 70, y1: 250, x2: 430, y2: 250, type: 'valley' }],
        facets: [
          { points: '250,70 430,250 70,250', shadeFactor: 1.0 },
          { points: '70,250 430,250 250,430', shadeFactor: 1.0 },
        ],
        foldAnimation: {
          type: 'flap',
          flapPoints: '70,250 430,250 250,430',
          origin: { x: 250, y: 250 },
          animationClass: 'anim-fold-up-x',
          showsReverseSide: true,
        },
      },
      {
        stepNumber: 2,
        name: 'Wieder auffalten',
        instruction: 'Falte das entstandene Dreieck wieder auseinander, sodass eine deutliche diagonale Faltlinie sichtbar bleibt.',
        creaseType: 'valley',
        tip: 'Die entstandene Mittelfalte dient im nächsten Schritt als präzise Orientierung.',
        hotspot: { x: 250, y: 150, label: 'Klicken zum Auffalten' },
        creaseLines: [{ x1: 70, y1: 250, x2: 430, y2: 250, type: 'guide' }],
        facets: [
          { points: '250,70 430,250 70,250', shadeFactor: 1.04 },
          { points: '250,70 430,250 70,250', shadeFactor: 0.96, isReverseSide: true },
        ],
        foldAnimation: {
          type: 'unfold',
          flapPoints: '250,70 430,250 70,250',
          origin: { x: 250, y: 250 },
          animationClass: 'anim-unfold-down-x',
          showsReverseSide: false,
        },
      },
      {
        stepNumber: 3,
        name: 'Zweite Diagonale falten',
        instruction: 'Falte nun die linke Ecke auf die rechte Ecke, um das Kreuz der beiden Diagonalen zu beginnen.',
        creaseType: 'valley',
        hotspot: { x: 80, y: 250, label: 'Linke Ecke nach rechts falten' },
        arrow: { fromX: 80, fromY: 250, toX: 420, toY: 250, curveOffset: 25 },
        creaseLines: [{ x1: 250, y1: 70, x2: 250, y2: 430, type: 'valley' }],
        facets: [
          { points: '250,70 430,250 250,430', shadeFactor: 1.0 },
          { points: '250,70 70,250 250,430', shadeFactor: 0.93 },
        ],
        foldAnimation: {
          type: 'flap',
          flapPoints: '250,70 70,250 250,430',
          origin: { x: 250, y: 250 },
          animationClass: 'anim-fold-right-y',
          showsReverseSide: true,
        },
      },
      {
        stepNumber: 4,
        name: 'Wieder auffalten (X-Falten)',
        instruction: 'Öffne das Papier erneut. In der Mitte kreuzen sich nun die beiden sauberen Diagonalen.',
        creaseType: 'valley',
        tip: 'Prüfe, ob sich der Schnittpunkt exakt im Zentrum bei (250, 250) befindet.',
        hotspot: { x: 250, y: 250, label: 'Zentrum bestätigen' },
        creaseLines: [
          { x1: 70, y1: 250, x2: 430, y2: 250, type: 'guide' },
          { x1: 250, y1: 70, x2: 250, y2: 430, type: 'guide' },
        ],
        facets: [
          { points: '250,70 430,250 250,430', shadeFactor: 1.0 },
          { points: '250,70 430,250 250,430', shadeFactor: 0.94, isReverseSide: true },
        ],
        foldAnimation: {
          type: 'unfold',
          flapPoints: '250,70 430,250 250,430',
          origin: { x: 250, y: 250 },
          animationClass: 'anim-unfold-left-y',
          showsReverseSide: false,
        },
      },
      {
        stepNumber: 5,
        name: 'Modell wenden (Rückseite)',
        instruction: 'Wende das Papier auf die weiße Rückseite. Nun falten wir die horizontalen und vertikalen Bergfalten.',
        creaseType: 'turnover',
        hotspot: { x: 250, y: 250, label: 'Papier umdrehen' },
        facets: [
          { points: '250,70 430,250 250,430 70,250', isReverseSide: true, shadeFactor: 1.0 },
        ],
        creaseLines: [
          { x1: 70, y1: 250, x2: 430, y2: 250, type: 'guide' },
          { x1: 250, y1: 70, x2: 250, y2: 430, type: 'guide' },
        ],
        foldAnimation: {
          type: 'turnover',
          rotateTransform: 'rotateY(180deg)',
        },
      },
      {
        stepNumber: 6,
        name: 'Horizontale Mittelfalte',
        instruction: 'Falte die obere Spitze exakt auf die untere Spitze zur Hälfte zusammen.',
        creaseType: 'valley',
        hotspot: { x: 250, y: 100, label: 'Obere Spitze nach unten' },
        arrow: { fromX: 250, fromY: 100, toX: 250, toY: 400, curveOffset: 0 },
        creaseLines: [{ x1: 70, y1: 250, x2: 430, y2: 250, type: 'valley' }],
        facets: [
          { points: '70,250 430,250 250,430', isReverseSide: true, shadeFactor: 1.0 },
          { points: '250,70 430,250 70,250', isReverseSide: true, shadeFactor: 1.0 },
        ],
        foldAnimation: {
          type: 'flap',
          flapPoints: '250,70 430,250 70,250',
          origin: { x: 250, y: 250 },
          animationClass: 'anim-fold-down-x',
          showsReverseSide: false,
        },
      },
      {
        stepNumber: 7,
        name: 'Wieder auffalten',
        instruction: 'Öffne das Papier wieder. Alle Hilfsfalten kreuzen sich harmonisch im Zentrum.',
        creaseType: 'valley',
        hotspot: { x: 250, y: 250, label: 'Auffalten' },
        facets: [
          { points: '70,250 430,250 250,430', isReverseSide: true, shadeFactor: 1.0 },
          { points: '70,250 430,250 250,430', isReverseSide: false, shadeFactor: 0.98 },
        ],
        creaseLines: [
          { x1: 70, y1: 250, x2: 430, y2: 250, type: 'guide' },
          { x1: 250, y1: 70, x2: 250, y2: 430, type: 'guide' },
        ],
        foldAnimation: {
          type: 'unfold',
          flapPoints: '70,250 430,250 250,430',
          origin: { x: 250, y: 250 },
          animationClass: 'anim-unfold-up-x',
          showsReverseSide: true,
        },
      },
      {
        stepNumber: 8,
        name: 'Quadratbasis (Preliminary Base)',
        instruction: 'Fasse die vier Ecken und schiebe das Papier entlang der Falten zu einem quadratischen Diamanten mit offener Spitze unten zusammen.',
        creaseType: 'squash',
        tip: 'Die geschlossene Spitze liegt oben bei (250, 130), die offene Spitze unten bei (250, 370).',
        hotspot: { x: 250, y: 250, label: 'Zur Quadratbasis zusammenschieben' },
        facets: [
          { points: '250,130 370,250 250,250', shadeFactor: 1.05 },
          { points: '250,130 130,250 250,250', shadeFactor: 0.95 },
          { points: '250,250 370,250 250,370', shadeFactor: 1.02 },
          { points: '250,250 130,250 250,370', shadeFactor: 0.97 },
        ],
        creaseLines: [{ x1: 250, y1: 130, x2: 250, y2: 370, type: 'guide' }],
        foldAnimation: { type: 'squash' },
      },
      {
        stepNumber: 9,
        name: 'Rechte Drachenfalte',
        instruction: 'Falte die rechte untere Außenkante der oberen Papierlage genau an die Mittellinie.',
        creaseType: 'valley',
        hotspot: { x: 310, y: 310, label: 'Rechte Kante zur Mittellinie' },
        arrow: { fromX: 350, fromY: 280, toX: 260, toY: 300, curveOffset: -20 },
        creaseLines: [{ x1: 250, y1: 370, x2: 310, y2: 250, type: 'valley' }],
        facets: [
          { points: '250,130 370,250 250,250', shadeFactor: 1.0 },
          { points: '250,130 130,250 250,370', shadeFactor: 0.95 },
          { points: '250,250 370,250 250,370', shadeFactor: 1.04 },
        ],
        foldAnimation: {
          type: 'flap',
          flapPoints: '250,250 370,250 250,370',
          origin: { x: 310, y: 310 },
          animationClass: 'anim-fold-left-y',
          showsReverseSide: true,
        },
      },
      {
        stepNumber: 10,
        name: 'Linke Drachenfalte',
        instruction: 'Falte nun auch die linke untere Kante der oberen Lage bündig an die Mittellinie.',
        creaseType: 'valley',
        hotspot: { x: 190, y: 310, label: 'Linke Kante zur Mittellinie' },
        arrow: { fromX: 150, fromY: 280, toX: 240, toY: 300, curveOffset: 20 },
        creaseLines: [{ x1: 250, y1: 370, x2: 190, y2: 250, type: 'valley' }],
        facets: [
          { points: '250,130 310,250 250,370', shadeFactor: 1.05 },
          { points: '250,130 190,250 250,370', shadeFactor: 0.95 },
          { points: '250,250 130,250 250,370', shadeFactor: 0.92 },
        ],
        foldAnimation: {
          type: 'flap',
          flapPoints: '250,250 130,250 250,370',
          origin: { x: 190, y: 310 },
          animationClass: 'anim-fold-right-y',
          showsReverseSide: true,
        },
      },
      {
        stepNumber: 11,
        name: 'Obere Dreiecksspitze umknicken',
        instruction: 'Falte das obere kleine Dreieck nach unten über die beiden Laschen, glattstreichen und wieder aufrichten.',
        creaseType: 'valley',
        tip: 'Dieser Knick definiert die Scharnierlinie für die folgende Blütenblattfalte.',
        hotspot: { x: 250, y: 150, label: 'Spitze nach unten knicken' },
        arrow: { fromX: 250, fromY: 150, toX: 250, toY: 260, curveOffset: 0 },
        creaseLines: [{ x1: 190, y1: 250, x2: 310, y2: 250, type: 'guide' }],
        facets: [
          { points: '190,250 310,250 250,370', shadeFactor: 0.98 },
          { points: '190,250 310,250 250,130', shadeFactor: 1.08 },
        ],
        foldAnimation: {
          type: 'flap',
          flapPoints: '190,250 310,250 250,130',
          origin: { x: 250, y: 250 },
          animationClass: 'anim-fold-down-x',
          showsReverseSide: true,
        },
      },
      {
        stepNumber: 12,
        name: 'Seitenflügel aufklappen',
        instruction: 'Klappe die beiden Seitenlaschen wieder auf. Die Hilfslinien sind nun perfekt eingeprägt.',
        creaseType: 'valley',
        hotspot: { x: 250, y: 250, label: 'Seiten aufklappen' },
        facets: [
          { points: '250,130 370,250 250,370 130,250', shadeFactor: 1.0 },
        ],
        creaseLines: [
          { x1: 250, y1: 370, x2: 310, y2: 250, type: 'guide' },
          { x1: 250, y1: 370, x2: 190, y2: 250, type: 'guide' },
          { x1: 190, y1: 250, x2: 310, y2: 250, type: 'guide' },
        ],
        foldAnimation: { type: 'squash' },
      },
      {
        stepNumber: 13,
        name: 'Blütenblattfalte (Petal Fold)',
        instruction: 'Hebe die untere Spitze vorsichtig nach ganz oben an und drücke die Seiten entlang der Falten flach nach innen.',
        creaseType: 'petal',
        tip: 'Das ist der berühmte Zaubertrick des Origami: Es entsteht eine schlanke, lange Raute!',
        hotspot: { x: 250, y: 360, label: 'Spitze nach oben anheben' },
        arrow: { fromX: 250, fromY: 360, toX: 250, toY: 80, curveOffset: 0 },
        facets: [
          { points: '250,70 310,250 250,250', shadeFactor: 1.08 },
          { points: '250,70 190,250 250,250', shadeFactor: 0.94 },
          { points: '250,250 310,250 250,430', shadeFactor: 1.03 },
          { points: '250,250 190,250 250,430', shadeFactor: 0.96 },
        ],
        foldAnimation: { type: 'squash' },
      },
      {
        stepNumber: 14,
        name: 'Wenden & Wiederholen (Rückseite)',
        instruction: 'Drehe das Modell um und wiederhole die Blütenblattfalte auf der Rückseite.',
        creaseType: 'turnover',
        hotspot: { x: 250, y: 250, label: 'Modell wenden' },
        facets: [
          { points: '250,70 310,250 250,250', shadeFactor: 1.06 },
          { points: '250,70 190,250 250,250', shadeFactor: 0.95 },
          { points: '250,250 310,250 250,430', shadeFactor: 1.04 },
          { points: '250,250 190,250 250,430', shadeFactor: 0.94 },
        ],
        foldAnimation: {
          type: 'turnover',
          rotateTransform: 'rotateY(180deg)',
        },
      },
      {
        stepNumber: 15,
        name: 'Untere Beine verschmälern',
        instruction: 'Falte die beiden unteren schmalen Spitzen jeweils zur Mitte hin noch schlanker (Kanten zur Mittellinie).',
        creaseType: 'valley',
        tip: 'Aus diesen beiden schlanken Spitzen entstehen gleich Hals und Schwanz.',
        hotspot: { x: 210, y: 350, label: 'Spitzen schmaler falten' },
        facets: [
          { points: '250,90 310,250 250,250', shadeFactor: 1.05 },
          { points: '250,90 190,250 250,250', shadeFactor: 0.95 },
          { points: '190,250 250,250 250,440 230,350', shadeFactor: 0.95 },
          { points: '310,250 250,250 250,440 270,350', shadeFactor: 1.05 },
        ],
        foldAnimation: { type: 'squash' },
      },
      {
        stepNumber: 16,
        name: 'Hals nach oben stülpen (Reverse Fold)',
        instruction: 'Öffne die linke untere Spitze leicht und falte sie nach innen und schräg oben heraus.',
        creaseType: 'reverse',
        hotspot: { x: 230, y: 400, label: 'Hals nach links-oben falten' },
        arrow: { fromX: 230, fromY: 400, toX: 140, toY: 135, curveOffset: -40 },
        facets: [
          { points: '250,110 330,245 250,255', shadeFactor: 1.05 },
          { points: '250,110 170,245 250,255', shadeFactor: 0.95 },
          { points: '220,245 140,125 160,145 250,255', shadeFactor: 1.08 },
          { points: '280,245 250,280 250,440 270,350', shadeFactor: 0.92 },
        ],
        foldAnimation: { type: 'reverse' },
      },
      {
        stepNumber: 17,
        name: 'Schwanz nach oben stülpen',
        instruction: 'Führe die rechte untere Spitze ebenfalls per Gegenfaltung schräg nach rechts oben.',
        creaseType: 'reverse',
        hotspot: { x: 260, y: 400, label: 'Schwanz nach rechts-oben falten' },
        arrow: { fromX: 260, fromY: 400, toX: 375, toY: 135, curveOffset: 40 },
        facets: [
          { points: '250,110 330,245 250,255', shadeFactor: 1.04 },
          { points: '250,110 170,245 250,255', shadeFactor: 0.96 },
          { points: '220,245 140,125 160,145 250,255', shadeFactor: 1.08 },
          { points: '280,245 385,125 250,280', shadeFactor: 0.92 },
        ],
        foldAnimation: { type: 'reverse' },
      },
      {
        stepNumber: 18,
        name: 'Kopf formen & Flügel spreizen',
        instruction: 'Knicke die Spitze des Halses nach unten für den Schnabel. Ziehe die beiden Flügel sanft zur Seite auseinander.',
        creaseType: 'final',
        isComplete: true,
        tip: 'Puste sanft von unten in das kleine Loch im Bauch, um den Kranichkörper dreidimensional aufzublasen!',
        hotspot: { x: 120, y: 150, label: 'Kranich vollenden' },
        facets: [
          // Vollendeter meisterhafter 3D Origami-Kranich (Tsuru)
          { points: '250,195 220,245 250,255', shadeFactor: 1.05 }, // Rücken links
          { points: '250,195 280,245 250,255', shadeFactor: 1.15 }, // Rücken rechts
          { points: '250,195 55,175 220,245', shadeFactor: 1.08 },  // Flügel links oben
          { points: '220,245 55,175 150,245', shadeFactor: 0.96 },  // Flügel links unten
          { points: '220,245 150,245 200,265', shadeFactor: 0.90 }, // Flügelfalte links
          { points: '250,195 445,175 280,245', shadeFactor: 1.18 }, // Flügel rechts oben
          { points: '280,245 445,175 350,245', shadeFactor: 1.02 }, // Flügel rechts unten
          { points: '280,245 350,245 300,265', shadeFactor: 0.94 }, // Flügelfalte rechts
          { points: '220,245 140,125 160,145 250,255', shadeFactor: 1.06 }, // Hals
          { points: '140,125 105,160 135,150', shadeFactor: 1.20 }, // Kopf Krone
          { points: '135,150 105,160 160,145', shadeFactor: 0.88 }, // Schnabel / Kehle
          { points: '280,245 385,125 265,265', shadeFactor: 1.15 }, // Schwanz oben
          { points: '265,265 385,125 250,280', shadeFactor: 0.96 }, // Schwanz unten
          { points: '220,245 250,255 250,280', shadeFactor: 0.92 }, // Bauch links
          { points: '280,245 250,255 250,280', shadeFactor: 0.98 }, // Bauch rechts
        ],
        foldAnimation: { type: 'final' },
      },
    ],
  },

  // ==========================================
  // 2. EULE (FUKURO / 梟)
  // ==========================================
  {
    id: 'owl',
    name: 'Eule',
    japaneseName: 'Fukuro',
    kanji: '梟',
    subtitle: 'Symbol für Weisheit, Schutz & Glück',
    difficulty: 'Leicht',
    symbolism: '„Fukuro“ bedeutet im Japanischen auch „kein Leid“ (Fu-Kuro) und bringt dem Haushalt Schutz und Weisheit.',
    durationEst: 'ca. 3–5 Minuten',
    totalSteps: 12,
    iconSvgPath: 'M 250,110 L 340,180 L 320,380 L 180,380 L 160,180 Z M 210,180 A 15,15 0 1,1 210,179 M 290,180 A 15,15 0 1,1 290,179',
    steps: [
      {
        stepNumber: 1,
        name: 'Diagonale Talfalte',
        instruction: 'Platziere das quadratische Blatt als Raute. Falte die untere Ecke auf die obere Spitze.',
        creaseType: 'valley',
        hotspot: { x: 250, y: 430, label: 'Nach oben falten' },
        arrow: { fromX: 250, fromY: 430, toX: 250, toY: 90, curveOffset: -20 },
        creaseLines: [{ x1: 70, y1: 250, x2: 430, y2: 250, type: 'valley' }],
        facets: [
          { points: '250,70 430,250 70,250', shadeFactor: 1.0 },
          { points: '70,250 430,250 250,430', shadeFactor: 1.0 },
        ],
        foldAnimation: {
          type: 'flap',
          flapPoints: '70,250 430,250 250,430',
          origin: { x: 250, y: 250 },
          animationClass: 'anim-fold-up-x',
          showsReverseSide: true,
        },
      },
      {
        stepNumber: 2,
        name: 'Auffalten zur Mittelachse',
        instruction: 'Falte das Blatt wieder auf. Die diagonale Linie dient als Orientierungsachse.',
        creaseType: 'valley',
        hotspot: { x: 250, y: 250, label: 'Auffalten' },
        creaseLines: [{ x1: 250, y1: 70, x2: 250, y2: 430, type: 'guide' }],
        facets: [
          { points: '250,70 430,250 70,250', shadeFactor: 1.04 },
          { points: '250,70 430,250 70,250', shadeFactor: 0.96, isReverseSide: true },
        ],
        foldAnimation: {
          type: 'unfold',
          flapPoints: '250,70 430,250 70,250',
          origin: { x: 250, y: 250 },
          animationClass: 'anim-unfold-down-x',
          showsReverseSide: false,
        },
      },
      {
        stepNumber: 3,
        name: 'Drachenform (Kite Base)',
        instruction: 'Falte die obere linke und obere rechte Kante bündig an die Mittellinie.',
        creaseType: 'valley',
        hotspot: { x: 310, y: 180, label: 'Kanten zur Mittellinie' },
        arrow: { fromX: 370, fromY: 160, toX: 270, toY: 180, curveOffset: 0 },
        facets: [
          { points: '250,70 320,230 250,230', shadeFactor: 1.08 },
          { points: '250,70 180,230 250,230', shadeFactor: 0.94 },
          { points: '250,230 430,250 250,430 70,250', shadeFactor: 1.0 },
        ],
        foldAnimation: { type: 'squash' },
      },
      {
        stepNumber: 4,
        name: 'Untere Kanten anlegen (Diamant)',
        instruction: 'Falte nun auch die unteren Kanten bündig an die Mittellinie, sodass eine Diamantform entsteht.',
        creaseType: 'valley',
        hotspot: { x: 310, y: 320, label: 'Untere Kanten zur Mitte' },
        facets: [
          { points: '250,70 320,230 250,230', shadeFactor: 1.05 },
          { points: '250,70 180,230 250,230', shadeFactor: 0.95 },
          { points: '250,230 320,230 250,410', shadeFactor: 1.02 },
          { points: '250,230 180,230 250,410', shadeFactor: 0.98 },
        ],
        foldAnimation: { type: 'squash' },
      },
      {
        stepNumber: 5,
        name: 'Kopfdreieck nach vorne neigen',
        instruction: 'Falte die obere Spitze nach vorne unten über die Flügelmitte. Die weiße Rückseite wird sichtbar.',
        creaseType: 'valley',
        hotspot: { x: 250, y: 90, label: 'Kopf nach unten knicken' },
        arrow: { fromX: 250, fromY: 90, toX: 250, toY: 260, curveOffset: 0 },
        facets: [
          { points: '250,230 320,230 250,410 180,230', shadeFactor: 0.96 },
          { points: '180,230 320,230 250,70', shadeFactor: 1.05 },
        ],
        foldAnimation: {
          type: 'flap',
          flapPoints: '180,230 320,230 250,70',
          origin: { x: 250, y: 230 },
          animationClass: 'anim-fold-down-x',
          showsReverseSide: true,
        },
      },
      {
        stepNumber: 6,
        name: 'Rechten Flügel ausstellen',
        instruction: 'Klappe die rechte Seitenkante schräg nach außen, um die typische Flügelform zu beginnen.',
        creaseType: 'valley',
        hotspot: { x: 320, y: 270, label: 'Rechten Flügel spreizen' },
        facets: [
          { points: '180,230 320,230 250,300', isReverseSide: true, shadeFactor: 1.15 },
          { points: '250,230 370,280 250,410', shadeFactor: 1.06 },
          { points: '250,230 180,230 250,410', shadeFactor: 0.96 },
        ],
        foldAnimation: { type: 'squash' },
      },
      {
        stepNumber: 7,
        name: 'Linken Flügel ausstellen',
        instruction: 'Klappe die linke Kante symmetrisch nach außen.',
        creaseType: 'valley',
        hotspot: { x: 180, y: 270, label: 'Linken Flügel spreizen' },
        facets: [
          { points: '180,230 320,230 250,300', isReverseSide: true, shadeFactor: 1.15 },
          { points: '250,230 370,280 250,410', shadeFactor: 1.05 },
          { points: '250,230 130,280 250,410', shadeFactor: 0.94 },
        ],
        foldAnimation: { type: 'squash' },
      },
      {
        stepNumber: 8,
        name: 'Modell wenden',
        instruction: 'Wende die Eule auf den Rücken, um die Federohren zu formen.',
        creaseType: 'turnover',
        hotspot: { x: 250, y: 250, label: 'Modell wenden' },
        facets: [
          { points: '140,240 360,240 250,420', shadeFactor: 1.0 },
          { points: '140,240 250,160 360,240', shadeFactor: 0.95 },
        ],
        foldAnimation: {
          type: 'turnover',
          rotateTransform: 'rotateY(180deg)',
        },
      },
      {
        stepNumber: 9,
        name: 'Federohren hervorheben',
        instruction: 'Falte die beiden oberen Spitzen leicht nach oben heraus für die charakteristischen Eulenohren.',
        creaseType: 'valley',
        hotspot: { x: 250, y: 160, label: 'Federohren knicken' },
        facets: [
          { points: '140,240 360,240 250,420', shadeFactor: 1.0 },
          { points: '170,95 250,130 205,160', shadeFactor: 1.12 },
          { points: '330,95 250,130 295,160', shadeFactor: 1.10 },
        ],
        foldAnimation: { type: 'squash' },
      },
      {
        stepNumber: 10,
        name: 'Bauchfalte nach oben',
        instruction: 'Knicke die untere Spitze nach oben ein, damit die Eule eine stabile Standfläche erhält.',
        creaseType: 'valley',
        hotspot: { x: 250, y: 410, label: 'Bauchspitze umknicken' },
        arrow: { fromX: 250, fromY: 410, toX: 250, toY: 340, curveOffset: 0 },
        facets: [
          { points: '140,240 360,240 310,360 190,360', shadeFactor: 1.0 },
          { points: '190,360 310,360 250,420', shadeFactor: 0.95 },
        ],
        foldAnimation: {
          type: 'flap',
          flapPoints: '190,360 310,360 250,420',
          origin: { x: 250, y: 360 },
          animationClass: 'anim-fold-up-x',
          showsReverseSide: true,
        },
      },
      {
        stepNumber: 11,
        name: 'Wenden zur Vorderseite',
        instruction: 'Wende die Eule wieder nach vorn. Gesicht und Silhouette sind nun wunderbar geformt.',
        creaseType: 'turnover',
        hotspot: { x: 250, y: 250, label: 'Vorderseite betrachten' },
        facets: [
          { points: '170,95 250,130 205,160', shadeFactor: 1.08 },
          { points: '330,95 250,130 295,160', shadeFactor: 1.15 },
          { points: '205,160 295,160 250,265', isReverseSide: true, shadeFactor: 1.18 },
          { points: '170,95 205,160 130,240', shadeFactor: 0.96 },
          { points: '330,95 295,160 370,240', shadeFactor: 1.10 },
          { points: '185,370 315,370 280,400 220,400', shadeFactor: 0.88 },
        ],
        foldAnimation: {
          type: 'turnover',
          rotateTransform: 'rotateY(180deg)',
        },
      },
      {
        stepNumber: 12,
        name: 'Schnabel & Augen vollenden',
        instruction: 'Biege die kleine Schnabelspitze nach vorn und streiche die Flügelkanten aus.',
        creaseType: 'final',
        isComplete: true,
        tip: 'Deine weise Zen-Eule ist vollendet! Sie wacht aufmerksam über deinen Schreibtisch.',
        hotspot: { x: 250, y: 240, label: 'Eule bewundern' },
        facets: [
          // Meisterhafte, authentische Zen-Eule (Fukuro)
          { points: '170,95 250,130 205,160', shadeFactor: 1.08 }, // Federohr links
          { points: '330,95 250,130 295,160', shadeFactor: 1.15 }, // Federohr rechts
          { points: '205,160 295,160 250,265', isReverseSide: true, shadeFactor: 1.18 }, // Weißes Gesicht / Brustschild
          { points: '240,240 260,240 250,265', shadeFactor: 0.95 }, // Gefalteter Schnabel
          { points: '215,185 235,195 220,210', isReverseSide: true, shadeFactor: 0.88 }, // Origami-Auge links
          { points: '285,185 265,195 280,210', isReverseSide: true, shadeFactor: 0.92 }, // Origami-Auge rechts
          { points: '170,95 205,160 130,240', shadeFactor: 0.96 }, // Flügel links oben
          { points: '205,160 130,240 165,340 205,300', shadeFactor: 0.90 }, // Flügel links unten
          { points: '330,95 295,160 370,240', shadeFactor: 1.12 }, // Flügel rechts oben
          { points: '295,160 370,240 335,340 295,300', shadeFactor: 1.04 }, // Flügel rechts unten
          { points: '250,265 205,300 165,340 250,370', shadeFactor: 0.94 }, // Rumpf links
          { points: '250,265 295,300 335,340 250,370', shadeFactor: 1.02 }, // Rumpf rechts
          { points: '185,370 315,370 280,400 220,400', shadeFactor: 0.85 }, // Perch Standfuß
        ],
        foldAnimation: { type: 'final' },
      },
    ],
  },

  // ==========================================
  // 3. SCHILDKRÖTE (KAME / 亀)
  // ==========================================
  {
    id: 'turtle',
    name: 'Schildkröte',
    japaneseName: 'Kame',
    kanji: '亀',
    subtitle: 'Symbol für Langlebigkeit, Gelassenheit & Ausdauer',
    difficulty: 'Mittel',
    symbolism: 'In Japan sagt man: „Der Kranich lebt 1.000 Jahre, die Schildkröte 10.000 Jahre“ (Tsuru wa sennen, Kame wa mannen).',
    durationEst: 'ca. 4–6 Minuten',
    totalSteps: 14,
    iconSvgPath: 'M 250,120 A 30,30 0 0,1 250,170 M 180,260 C 180,200 320,200 320,260 C 320,340 180,340 180,260 Z M 160,200 L 190,230 M 340,200 L 310,230 M 160,320 L 190,290 M 340,320 L 310,290',
    steps: [
      {
        stepNumber: 1,
        name: 'Horizontale Mittelfalte',
        instruction: 'Falte das Papier horizontal zur Hälfte zusammen und öffne es wieder.',
        creaseType: 'valley',
        hotspot: { x: 250, y: 100, label: 'Papier falten' },
        creaseLines: [{ x1: 70, y1: 250, x2: 430, y2: 250, type: 'valley' }],
        facets: [
          { points: '70,250 430,250 430,430 70,430', shadeFactor: 1.0 },
          { points: '70,70 430,70 430,250 70,250', shadeFactor: 1.0 },
        ],
        foldAnimation: {
          type: 'flap',
          flapPoints: '70,70 430,70 430,250 70,250',
          origin: { x: 250, y: 250 },
          animationClass: 'anim-fold-down-x',
          showsReverseSide: true,
        },
      },
      {
        stepNumber: 2,
        name: 'Wieder auffalten & vertikale Falte',
        instruction: 'Öffne das Papier und falte die rechte Kante auf die linke Kante (Kreuzfalte).',
        creaseType: 'valley',
        hotspot: { x: 400, y: 250, label: 'Vertikale Falte' },
        creaseLines: [
          { x1: 250, y1: 70, x2: 250, y2: 430, type: 'valley' },
          { x1: 70, y1: 250, x2: 430, y2: 250, type: 'guide' },
        ],
        facets: [
          { points: '70,70 250,70 250,430 70,430', shadeFactor: 0.98 },
          { points: '250,70 430,70 430,430 250,430', shadeFactor: 1.02 },
        ],
        foldAnimation: {
          type: 'flap',
          flapPoints: '250,70 430,70 430,430 250,430',
          origin: { x: 250, y: 250 },
          animationClass: 'anim-fold-left-y',
          showsReverseSide: true,
        },
      },
      {
        stepNumber: 3,
        name: '4 Ecken zur Mitte (Blintz-Falte)',
        instruction: 'Falte alle vier Außenecken exakt zum Mittelpunkt des Blattes.',
        creaseType: 'valley',
        tip: 'Dies nennt man im Origami die berühmte „Blintz-Grundform“.',
        hotspot: { x: 250, y: 250, label: 'Ecken zur Mitte' },
        arrow: { fromX: 90, fromY: 90, toX: 230, toY: 230, curveOffset: 0 },
        facets: [
          { points: '70,250 250,70 250,250', shadeFactor: 1.05 },
          { points: '250,70 430,250 250,250', shadeFactor: 1.02 },
          { points: '430,250 250,430 250,250', shadeFactor: 0.95 },
          { points: '250,430 70,250 250,250', shadeFactor: 0.98 },
        ],
        foldAnimation: { type: 'squash' },
      },
      {
        stepNumber: 4,
        name: 'Modell wenden',
        instruction: 'Drehe das verkleinerte Quadrat um auf die glatte Rückseite.',
        creaseType: 'turnover',
        hotspot: { x: 250, y: 250, label: 'Wenden' },
        facets: [
          { points: '70,250 250,70 430,250 250,430', isReverseSide: true, shadeFactor: 1.0 },
        ],
        foldAnimation: {
          type: 'turnover',
          rotateTransform: 'rotateY(180deg)',
        },
      },
      {
        stepNumber: 5,
        name: 'Erneut 4 Ecken zur Mitte',
        instruction: 'Falte auch auf dieser Seite alle vier Ecken präzise zur Mitte (Doppel-Blintz).',
        creaseType: 'valley',
        hotspot: { x: 250, y: 250, label: 'Ecken erneut zur Mitte' },
        facets: [
          { points: '160,250 250,160 250,250', shadeFactor: 1.06 },
          { points: '250,160 340,250 250,250', shadeFactor: 1.02 },
          { points: '340,250 250,340 250,250', shadeFactor: 0.94 },
          { points: '250,340 160,250 250,250', shadeFactor: 0.98 },
        ],
        foldAnimation: { type: 'squash' },
      },
      {
        stepNumber: 6,
        name: 'Modell nochmals wenden',
        instruction: 'Wende das Modell erneut. Auf dieser Seite befinden sich nun vier separate Taschen/Fächer.',
        creaseType: 'turnover',
        hotspot: { x: 250, y: 250, label: 'Wenden' },
        facets: [
          { points: '160,160 340,160 340,340 160,340', shadeFactor: 1.0 },
        ],
        foldAnimation: {
          type: 'turnover',
          rotateTransform: 'rotateY(180deg)',
        },
      },
      {
        stepNumber: 7,
        name: 'Vordere linke Flosse herausziehen',
        instruction: 'Ziehe das obere linke Fach schräg nach außen und drücke es zu einer kräftigen Schwimmflosse flach.',
        creaseType: 'squash',
        hotspot: { x: 190, y: 190, label: 'Linke Flosse ziehen' },
        facets: [
          { points: '190,190 310,190 310,310 190,310', shadeFactor: 1.0 },
          { points: '190,190 75,135 125,210', shadeFactor: 0.92 },
        ],
        foldAnimation: { type: 'squash' },
      },
      {
        stepNumber: 8,
        name: 'Vordere rechte Flosse herausziehen',
        instruction: 'Wiederhole das Herausziehen für das obere rechte Fach.',
        creaseType: 'squash',
        hotspot: { x: 310, y: 190, label: 'Rechte Flosse ziehen' },
        facets: [
          { points: '190,190 310,190 310,310 190,310', shadeFactor: 1.0 },
          { points: '190,190 75,135 125,210', shadeFactor: 0.92 },
          { points: '310,190 425,135 375,210', shadeFactor: 1.08 },
        ],
        foldAnimation: { type: 'squash' },
      },
      {
        stepNumber: 9,
        name: 'Hintere Flossen herausziehen',
        instruction: 'Ziehe die beiden unteren Fächer ebenfalls heraus für die hinteren Steuerflossen.',
        creaseType: 'squash',
        hotspot: { x: 250, y: 310, label: 'Hinterflossen ziehen' },
        facets: [
          { points: '190,190 310,190 310,310 190,310', shadeFactor: 1.0 },
          { points: '190,190 75,135 125,210', shadeFactor: 0.92 },
          { points: '310,190 425,135 375,210', shadeFactor: 1.08 },
          { points: '190,310 130,375 155,335', shadeFactor: 0.88 },
          { points: '310,310 370,375 345,335', shadeFactor: 1.02 },
        ],
        foldAnimation: { type: 'squash' },
      },
      {
        stepNumber: 10,
        name: 'Kopf nach oben entfalten',
        instruction: 'Falte die obere Mitte nach oben heraus, um Kopf und Hals der Schildkröte zu modellieren.',
        creaseType: 'valley',
        hotspot: { x: 250, y: 140, label: 'Kopf nach oben falten' },
        arrow: { fromX: 250, fromY: 190, toX: 250, toY: 100, curveOffset: 0 },
        facets: [
          { points: '250,95 275,145 250,175 225,145', shadeFactor: 1.15 },
          { points: '190,190 310,190 310,310 190,310', shadeFactor: 1.0 },
          { points: '190,190 75,135 125,210', shadeFactor: 0.92 },
          { points: '310,190 425,135 375,210', shadeFactor: 1.08 },
          { points: '190,310 130,375 155,335', shadeFactor: 0.88 },
          { points: '310,310 370,375 345,335', shadeFactor: 1.02 },
        ],
        foldAnimation: { type: 'squash' },
      },
      {
        stepNumber: 11,
        name: 'Schwanz spitzen',
        instruction: 'Falte die untere Spitze zu einem spitzen Schildkrötenschwanz zusammen.',
        creaseType: 'valley',
        hotspot: { x: 250, y: 340, label: 'Schwanz formen' },
        facets: [
          { points: '250,95 275,145 250,175 225,145', shadeFactor: 1.15 },
          { points: '190,190 310,190 310,310 190,310', shadeFactor: 1.0 },
          { points: '220,330 280,330 250,375', shadeFactor: 0.86 },
          { points: '190,190 75,135 125,210', shadeFactor: 0.92 },
          { points: '310,190 425,135 375,210', shadeFactor: 1.08 },
          { points: '190,310 130,375 155,335', shadeFactor: 0.88 },
          { points: '310,310 370,375 345,335', shadeFactor: 1.02 },
        ],
        foldAnimation: { type: 'squash' },
      },
      {
        stepNumber: 12,
        name: 'Panzerecken abrunden',
        instruction: 'Knicke die vier Außenecken des quadratischen Panzers nach innen um, um den runden Panzer zu formen.',
        creaseType: 'mountain',
        tip: 'Dadurch entsteht der traditionelle sechseckige Kikkō-Schildkrötenpanzer.',
        hotspot: { x: 250, y: 250, label: 'Ecken abrunden' },
        facets: [
          { points: '250,95 275,145 250,175 225,145', shadeFactor: 1.15 },
          { points: '215,175 285,175 325,225 325,265 285,315 215,315 175,265 175,225', shadeFactor: 1.05 },
          { points: '220,330 280,330 250,375', shadeFactor: 0.86 },
          { points: '190,190 75,135 125,210', shadeFactor: 0.92 },
          { points: '310,190 425,135 375,210', shadeFactor: 1.08 },
          { points: '190,310 130,375 155,335', shadeFactor: 0.88 },
          { points: '310,310 370,375 345,335', shadeFactor: 1.02 },
        ],
        foldAnimation: { type: 'squash' },
      },
      {
        stepNumber: 13,
        name: 'Panzer-Muster ausprägen',
        instruction: 'Drücke sanft in die Panzermitte, um die Wölbung und das traditionelle Wabenmuster hervorzuheben.',
        creaseType: 'final',
        hotspot: { x: 250, y: 250, label: 'Panzer wölben' },
        facets: [
          { points: '250,95 250,175 225,145', shadeFactor: 1.06 },
          { points: '250,95 275,145 250,175', shadeFactor: 1.18 },
          { points: '250,205 285,225 285,265 250,285 215,265 215,225', shadeFactor: 1.22 },
          { points: '250,205 215,175 285,175', shadeFactor: 1.12 },
          { points: '215,225 215,175 175,200', shadeFactor: 1.04 },
          { points: '285,225 285,175 325,200', shadeFactor: 1.16 },
          { points: '215,265 175,245 190,295 250,285', shadeFactor: 0.94 },
          { points: '285,265 325,245 310,295 250,285', shadeFactor: 1.02 },
          { points: '220,330 280,330 250,375', shadeFactor: 0.86 },
          { points: '190,190 75,135 125,210', shadeFactor: 0.92 },
          { points: '310,190 425,135 375,210', shadeFactor: 1.08 },
          { points: '190,310 130,375 155,335', shadeFactor: 0.88 },
          { points: '310,310 370,375 345,335', shadeFactor: 1.02 },
        ],
        foldAnimation: { type: 'squash' },
      },
      {
        stepNumber: 14,
        name: 'Vollendete Meeresschildkröte (Kame)',
        instruction: 'Herzlichen Glückwunsch! Deine Schildkröte ruht friedlich und majestätisch auf dem Holztisch.',
        creaseType: 'final',
        isComplete: true,
        tip: 'Ein uraltes japanisches Symbol für ein langes, glückliches und gelassenes Leben.',
        hotspot: { x: 250, y: 250, label: 'Schildkröte bewundern' },
        facets: [
          // Meisterhafte, authentische 3D Origami-Schildkröte (Kame)
          { points: '250,95 250,175 225,145', shadeFactor: 1.06 }, // Kopf links
          { points: '250,95 275,145 250,175', shadeFactor: 1.18 }, // Kopf rechts
          { points: '250,205 285,225 285,265 250,285 215,265 215,225', shadeFactor: 1.22 }, // Zentrales Kikkō-Schild
          { points: '250,205 215,175 285,175', shadeFactor: 1.12 }, // Oberschild
          { points: '215,225 215,175 175,200', shadeFactor: 1.04 }, // Schuppe oben links
          { points: '215,225 175,200 175,245', shadeFactor: 0.96 }, // Schuppe Mitte links
          { points: '285,225 285,175 325,200', shadeFactor: 1.16 }, // Schuppe oben rechts
          { points: '285,225 325,200 325,245', shadeFactor: 1.08 }, // Schuppe Mitte rechts
          { points: '215,265 175,245 190,295 250,285', shadeFactor: 0.94 }, // Schuppe unten links
          { points: '285,265 325,245 310,295 250,285', shadeFactor: 1.02 }, // Schuppe unten rechts
          { points: '250,285 190,295 220,330 280,330 310,295', shadeFactor: 0.92 }, // Schuppe unten
          { points: '215,175 175,200 75,135', shadeFactor: 0.92 }, // Flosse VL oben
          { points: '175,200 125,210 75,135', shadeFactor: 0.86 }, // Flosse VL unten
          { points: '285,175 325,200 425,135', shadeFactor: 1.10 }, // Flosse VR oben
          { points: '325,200 375,210 425,135', shadeFactor: 1.04 }, // Flosse VR unten
          { points: '190,295 220,330 130,375 155,335', shadeFactor: 0.88 }, // Hinterflosse links
          { points: '310,295 280,330 370,375 345,335', shadeFactor: 1.00 }, // Hinterflosse rechts
          { points: '220,330 280,330 250,375', shadeFactor: 0.86 }, // Spitzenschwanz
        ],
        foldAnimation: { type: 'final' },
      },
    ],
  },
];
