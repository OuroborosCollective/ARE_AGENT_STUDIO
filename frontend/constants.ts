import { TacticalRule, DeviceConfig, BenchmarkResult, PlaystyleProfile, DAggerIntervention, GenreKnowledgeSchema, GameArchetype } from './types';

export const DEFAULT_DEVICE: DeviceConfig = {
  serial: '',
  brand: 'Unconfigured',
  model: 'No Android device configured',
  resolutionWidth: 1080,
  resolutionHeight: 2400,
  densityDpi: 480,
  framerateFps: 60,
  connectionProtocol: 'scrcpy_h264',
  latencyMs: 0,
  connected: false,
  batteryLevel: 0,
};

export const GENRE_KNOWLEDGE_SCHEMAS: Record<GameArchetype, GenreKnowledgeSchema> = {
  [GameArchetype.FPS]: {
    genre: GameArchetype.FPS,
    shortCode: 'FPS',
    title: 'Ego-Shooter (FPS)',
    description: 'Direkte Ego-Perspektive mit absolutem Fokus auf präzises Zielen, Reflexe und Projektil-Eliminierung.',
    criteria: {
      cameraPerspective: 'First-Person (Direkt durch die Augen der Spielfigur).',
      coreObjective: 'Eliminierung aller Gegner im Sichtfeld, Überleben, Erreichen eines geografischen Zielpunkts.',
      coreControls: 'Fadenkreuz/Blickrichtung (Touchpad/Stick rechts), Bewegung (Trackpad links) und direktes Abfeuern der Waffe.',
      primaryGameplayLoop: 'Schneller, repetitiver Kern-Loop aus Sichten -> Zielen -> Schießen -> In-Deckung-Gehen (Reflexbasiert).',
      secondaryActions: ['Nachladen', 'Waffen wechseln', 'Granaten werfen', 'Springen/Ducken', 'Heilen über Medipacks', 'ADS (Visier zielen)'],
      differentiationBoundary: 'Sobald Nahkampf oder Charakterwerte das manuelle Zielen ersetzen, ist es kein reiner Ego-Shooter mehr.',
      dominantLoopShareMinPercent: 60,
    },
    visualHUDTaxonomy: [
      'Zentrales Fadenkreuz & Hitmarker (Bildschirmmitte)',
      'Rechter Touch-Bereich für Blickwinkel/Aiming & ADS',
      'Munitions- & Magazinzähler (Unten rechts)',
      'Kompassleiste & Radar-Audioanzeige (Oben)',
    ],
    movementLogic: 'Strafe-Movement, Slide-Cancel und Deckungs-Peeking bei konstant zentriertem Fadenkreuz.',
    decisionTree: [
      'Condition: Feind im Sichtfeld & Fadenkreuz-Distanz < 0.08 -> Action: Tap ADS -> Auto-Burst Trigger -> Side-Step',
      'Condition: Magazin < 20% & Kein Feindkontakt -> Action: Tap Reload -> Ducken hinter Deckung',
      'Condition: Eingehender Schaden von Hinten -> Action: 180° Snap-Flick -> Sprint zur nächsten Deckung',
    ],
    controlPrimitives: [
      { id: 'fps_aim', name: 'Touchpad Crosshair Pan', inputCategory: 'AIM_FIRE', normalizedZone: { xMin: 0.45, xMax: 0.95, yMin: 0.20, yMax: 0.80 }, activationRule: 'Continuous Delta Drag', expectedLatencyMs: 6, recoveryCadenceMs: 25 },
      { id: 'fps_fire', name: 'Primary Fire Trigger', inputCategory: 'AIM_FIRE', normalizedZone: { xMin: 0.80, xMax: 0.96, yMin: 0.45, yMax: 0.65 }, activationRule: 'Rhythmic Tap / Continuous Hold', expectedLatencyMs: 4, recoveryCadenceMs: 80 },
      { id: 'fps_ads', name: 'ADS Scope Zoom', inputCategory: 'AIM_FIRE', normalizedZone: { xMin: 0.70, xMax: 0.82, yMin: 0.50, yMax: 0.65 }, activationRule: 'Toggle Tap', expectedLatencyMs: 8, recoveryCadenceMs: 150 },
    ],
  },
  [GameArchetype.SIM_MANAGEMENT]: {
    genre: GameArchetype.SIM_MANAGEMENT,
    shortCode: 'SIM/BUILD',
    title: 'Simulations- & Aufbauspiele',
    description: 'Indirekte Vogelperspektive mit Fokus auf Systemoptimierung, Ressourcenströme, Stadtbau und Wirtschaft.',
    criteria: {
      cameraPerspective: 'Vogelperspektive / Isometrisch (Indirekte Kontrolle).',
      coreObjective: 'Langfristiges Überleben, Wachstum eines Systems, Maximierung von Effizienz, Wohlstand oder Ressourcen.',
      coreControls: 'Hauptsächlich Menü-Navigation, Selektions-Cursor und Drag-and-Drop zur Platzierung von Objekten.',
      primaryGameplayLoop: 'Kontinuierliche Schleife aus Ressourcen-Analyse -> Planung -> Bauen/Investieren -> Warten auf Systemreaktion.',
      secondaryActions: ['Steuersätze steuern', 'Mikromanagement von Personal', 'Erforschen neuer Technologien', 'Katastrophen beheben'],
      differentiationBoundary: 'Fokus liegt auf Planung und Erhalt eines Gesamtsystems, nicht auf direkter Action oder Reflexen.',
      dominantLoopShareMinPercent: 60,
    },
    visualHUDTaxonomy: [
      'Oberes Ressourcen-Dashboard (Gold, Holz, Energie, Bevölkerung)',
      'Unteres Bau- & Infrastruktur-Menü (Raster/Slots)',
      'Zentrales Isometrisches Bau- & Zonenraster',
      'Benachrichtigungs-Ticker für Engpässe & Katastrophen',
    ],
    movementLogic: 'Kamerazoom & Panning über das Wirtschaftsraster; platzieren von Produktionsstätten entlang logistischer Routen.',
    decisionTree: [
      'Condition: Gold > 1000 & Energiebilanz < 15% -> Action: Öffne Baumenü -> Wähle Kraftwerk -> Platziere auf freiem Slot (0.35, 0.45)',
      'Condition: Katastrophe (Feuer/Streik) aktiv -> Action: Tap Krisen-Symbol -> Entsende Rettungsteam -> Bestätigen',
      'Condition: Ressourcen-Stau im Lager -> Action: Upgrade Hauptlager auf Level 2',
    ],
    controlPrimitives: [
      { id: 'sim_pan', name: 'Camera Map Pan', inputCategory: 'JOYSTICK_MOVE', normalizedZone: { xMin: 0.10, xMax: 0.90, yMin: 0.15, yMax: 0.80 }, activationRule: 'Two-Finger Drag / Swipe', expectedLatencyMs: 20, recoveryCadenceMs: 100 },
      { id: 'sim_build', name: 'Place Structure', inputCategory: 'BUILD_PLACE', normalizedZone: { xMin: 0.20, xMax: 0.80, yMin: 0.30, yMax: 0.70 }, activationRule: 'Select Slot & Tap Confirm', expectedLatencyMs: 15, recoveryCadenceMs: 300 },
      { id: 'sim_menu', name: 'Open Build Menu', inputCategory: 'MENU_NAV', normalizedZone: { xMin: 0.05, xMax: 0.35, yMin: 0.82, yMax: 0.96 }, activationRule: 'Single Tap', expectedLatencyMs: 10, recoveryCadenceMs: 200 },
    ],
  },
  [GameArchetype.ACTION_RPG]: {
    genre: GameArchetype.ACTION_RPG,
    shortCode: 'ARPG',
    title: 'Action-RPG (Action-Rollenspiel)',
    description: 'Direkte Charakter-Progression kombiniert mit reflexbasierten Echtzeit-Kämpfen, Ausweichen und Beutesammlung.',
    criteria: {
      cameraPerspective: 'Third-Person oder Isometrisch (Direkte Figurkontrolle).',
      coreObjective: 'Ständige Optimierung des eigenen Charakters (Build), Besiegen mächtiger Bosse, Beute/Loot sammeln.',
      coreControls: 'Direkte Steuerung einer Einzelfigur. Tasten für Angriffe, Ausweichrollen und Auslösen von Fähigkeiten.',
      primaryGameplayLoop: 'Gebietserkundung -> schnelle Echtzeit-Kämpfe -> Sammeln von Beute (Loot) -> Skillpunkte/Ausrüstung im Menü verteilen.',
      secondaryActions: ['Dialoge mit NPCs führen', 'Ausrüstung modifizieren/Crafting', 'Handeln mit Händlern', 'Inventar-Management'],
      differentiationBoundary: 'Im Gegensatz zum reinen Actionspiel bestimmen Ausrüstung, Level und Attribute maßgeblich den Kampferfolg.',
      dominantLoopShareMinPercent: 60,
    },
    visualHUDTaxonomy: [
      'Virtueller Bewegungs-Joystick (Unten links)',
      'HP-, Mana- & Ausdauer-Kugeln/Balken (Oben/Unten)',
      'Rechtes Aktions-Cluster (Normaler Angriff, Ausweichrolle, 3 Skill-Slots)',
      'Mini-Map & Quest-Navigationspfeil',
    ],
    movementLogic: 'Hit-and-Run Kiting, gezieltes Ausweichen im gegnerischen Telegrafen-Bereich (Red AoE Circles).',
    decisionTree: [
      'Condition: Boss Telegrafiert Angriff (AoE Red Circle) -> Action: Tap Ausweichrolle (0.88, 0.88) weg vom Einschlagsort',
      'Condition: Boss Stun-Phase == TRUE & Skill Q Cooldown == 0s -> Action: Skill 1 -> Skill 2 -> Burst Ulti -> Auto Attack x5',
      'Condition: HP < 35% -> Action: Tap Heiltrank (0.60, 0.85) -> Kiten auf Distanz',
    ],
    controlPrimitives: [
      { id: 'arpg_move', name: 'Hero Direct Joystick', inputCategory: 'JOYSTICK_MOVE', normalizedZone: { xMin: 0.08, xMax: 0.32, yMin: 0.68, yMax: 0.92 }, activationRule: 'Continuous Drag', expectedLatencyMs: 10, recoveryCadenceMs: 50 },
      { id: 'arpg_dodge', name: 'Dodge Roll', inputCategory: 'SLIDE_DODGE', normalizedZone: { xMin: 0.85, xMax: 0.96, yMin: 0.80, yMax: 0.95 }, activationRule: 'Instant Tap', expectedLatencyMs: 6, recoveryCadenceMs: 350 },
      { id: 'arpg_combo', name: 'Skill 1 Burst', inputCategory: 'SKILL_COMBO', normalizedZone: { xMin: 0.65, xMax: 0.78, yMin: 0.75, yMax: 0.88 }, activationRule: 'Instant Tap', expectedLatencyMs: 8, recoveryCadenceMs: 250 },
    ],
  },
  [GameArchetype.MMORPG]: {
    genre: GameArchetype.MMORPG,
    shortCode: 'MMO',
    title: 'MMORPG (Massively Multiplayer Online)',
    description: 'Persistente Online-Welt für tausende Spieler mit Gruppen-Content, Raids, Gilden, Berufen und Auktionshaus.',
    criteria: {
      cameraPerspective: 'Meist Third-Person mit freier Kamerarotation.',
      coreObjective: 'Langzeit-Progression, Meisterung von Gruppen-Inhalten (Raids/Dungeons), sozialer Status und Reichtum.',
      coreControls: 'Ähnlich ARPG, jedoch stark fokussiert auf komplexe Fähigkeiten-Leisten (Hotkeys), Zielanwahl und Gruppen-UI.',
      primaryGameplayLoop: 'Quests absolvieren -> wiederholte Dungeons in organisierten Gruppen (Tank/Heal/DPS) -> spielerbetriebener Markt.',
      secondaryActions: ['Berufe ausüben (Bergbau, Angeln)', 'Gilden verwalten', 'Text-/Sprach-Chat nutzen', 'Kosmetika sammeln'],
      differentiationBoundary: 'Verliert ohne die massive permanente Online-Spielerschaft seine funktionale Existenz.',
      dominantLoopShareMinPercent: 60,
    },
    visualHUDTaxonomy: [
      'Gruppen- & Raid-Mitglieder-Statusfenster (Links oben)',
      'Ziel-Fokusfenster mit Buffs/Debuffs (Oben mittig)',
      'Erweiterte 8-Slot Fähigkeitenleiste (Unten rechts)',
      'Gilden- & Weltchat-Eingabezeile (Unten links)',
    ],
    movementLogic: 'Raid-Positionierung: Tanken mit Rücken zur Gruppe, Heiler auf Reichweite halten, DPS im Rücken des Bosses.',
    decisionTree: [
      'Condition: Gruppenmitglied HP < 30% & Rolle == Heiler -> Action: Tap Gruppen-Porträt 2 -> Tap Schnellheilung Slot 3',
      'Condition: Boss Phase-Wechsel -> Action: Verlasse Giftfläche -> Starte Rotations-Burst',
      'Condition: Inventar voll nach Dungeon -> Action: Öffne Auktionshaus -> Verkaufe seltene Beute',
    ],
    controlPrimitives: [
      { id: 'mmo_party', name: 'Select Party Member', inputCategory: 'MENU_NAV', normalizedZone: { xMin: 0.05, xMax: 0.25, yMin: 0.15, yMax: 0.45 }, activationRule: 'Target Tap', expectedLatencyMs: 15, recoveryCadenceMs: 300 },
      { id: 'mmo_hotkey', name: 'Trigger Raid Skill', inputCategory: 'SKILL_COMBO', normalizedZone: { xMin: 0.55, xMax: 0.95, yMin: 0.65, yMax: 0.95 }, activationRule: 'Sequential Tap Chain', expectedLatencyMs: 12, recoveryCadenceMs: 150 },
    ],
  },
  [GameArchetype.PUZZLE_MATCH]: {
    genre: GameArchetype.PUZZLE_MATCH,
    shortCode: 'PUZZLE',
    title: 'Puzzle- & Match-Spiele (Tetris / Match-3)',
    description: '2D-Raster mit Fokus auf Mustererkennung, geometrische Anordnung und logische Auflösung von Elementen.',
    criteria: {
      cameraPerspective: 'Zweidimensional (2D), meist statisches Spielfeld.',
      coreObjective: 'Erreichen einer Highscore, Verhindern des Vollaufens des Spielfelds, Lösen vorgegebener Rätselmuster.',
      coreControls: '2D-Raster Interaktion. Tasten/Gesten zum Verschieben, Rotieren, Tauschen oder Platzieren von Formen.',
      primaryGameplayLoop: 'Kontinuierliches, rhythmisches Sortieren von Elementen, die sich bei korrekter Anordnung auflösen.',
      secondaryActions: ['Power-ups einsetzen (Bomben, Reihen-Clears)', 'Vorschau auf das nächste Element ansehen', 'Highscores vergleichen'],
      differentiationBoundary: 'Keine Story, keine Charakter-Progression, keine klassischen Gegner, sondern rein abstraktes Logik-Rätsel.',
      dominantLoopShareMinPercent: 60,
    },
    visualHUDTaxonomy: [
      '2D Spielmatrix (z.B. 10x20 Tetris-Feld oder 8x8 Match-3 Raster)',
      'Vorschaufenster für nächste Steine/Formen (Next Piece)',
      'Score-, Combo- & Level-Zähler (Oben)',
      'Power-up Leiste (Unten)',
    ],
    movementLogic: 'Berechnung des optimalen Ablageorts nach Schwerpunkt, Kantenanpassung und Kaskaden-Potential.',
    decisionTree: [
      'Condition: I-Block (Linie) aktiv & 4-Reihen Schacht frei -> Action: Rotiere Vertikal -> Hard Drop in Spalte 10 (0.90, 0.85)',
      'Condition: Match-3 Reihe horizontal möglich bei (Row 4, Col 3) -> Action: Swipe Tile (0.35, 0.45) nach rechts',
      'Condition: Feld-Füllstand > 80% -> Action: Aktiviere Bomben-Powerup auf unterstes Drittel',
    ],
    controlPrimitives: [
      { id: 'puz_rotate', name: 'Rotate Shape', inputCategory: 'GRID_SWAP', normalizedZone: { xMin: 0.70, xMax: 0.90, yMin: 0.75, yMax: 0.90 }, activationRule: 'Single Tap / Tap Up', expectedLatencyMs: 8, recoveryCadenceMs: 80 },
      { id: 'puz_drop', name: 'Hard Drop / Fast Fall', inputCategory: 'GRID_SWAP', normalizedZone: { xMin: 0.40, xMax: 0.60, yMin: 0.80, yMax: 0.95 }, activationRule: 'Swipe Down', expectedLatencyMs: 6, recoveryCadenceMs: 120 },
      { id: 'puz_swap', name: 'Swap Match Tiles', inputCategory: 'GRID_SWAP', normalizedZone: { xMin: 0.15, xMax: 0.85, yMin: 0.25, yMax: 0.75 }, activationRule: 'Directional Tile Drag', expectedLatencyMs: 10, recoveryCadenceMs: 150 },
    ],
  },
  [GameArchetype.MOBA_ARENA]: {
    genre: GameArchetype.MOBA_ARENA,
    shortCode: 'MOBA',
    title: 'MOBA / Lane Strategy',
    description: '3-Lane Arena mit Creep-Wellen, Turm-Belagerung und koordinierten Team-Fights.',
    criteria: {
      cameraPerspective: 'Isometrische Vogelperspektive mit zentrierter Spielfigur.',
      coreObjective: 'Zerstörung des gegnerischen Hauptgebäudes (Ancient/Nexus).',
      coreControls: 'Dual-Stick: Bewegen mit linkem Analogstick, Skills zielen mit rechtem Skillpad.',
      primaryGameplayLoop: 'Farming in der Lane -> Ganks & Teamfights -> Einnahme neutraler Bosse -> Push zur Basis.',
      secondaryActions: ['Items im Shop kaufen', 'Minimap-Pings setzen', 'Wards zur Sichtkontrolle platzieren'],
      differentiationBoundary: 'Echtzeit-Strategie kombiniert mit Einzelheld-Steuerung in symmetrischen Team-Gefechten.',
      dominantLoopShareMinPercent: 60,
    },
    visualHUDTaxonomy: [
      'Virtueller Joystick (Links)',
      'Minimap & Lane-Status (Links oben)',
      'Skillpad mit 3-4 Fähigkeiten (Rechts unten)',
      'Gold- & Item-Shop (Rechts oben)',
    ],
    movementLogic: 'Mikro-Kiting zwischen Auto-Attack Intervallen und ständiger Map-Awareness.',
    decisionTree: [
      'Condition: Feindlicher Turm greift an -> Action: Sofortiger Rückzug aus dem Turm-Radius',
      'Condition: Teamfight bricht aus -> Action: Fokussiere gegnerischen Carry -> Aktiviere CC-Ultimate',
    ],
    controlPrimitives: [
      { id: 'moba_joy', name: 'Joystick Pan', inputCategory: 'JOYSTICK_MOVE', normalizedZone: { xMin: 0.08, xMax: 0.32, yMin: 0.68, yMax: 0.92 }, activationRule: 'Continuous Drag', expectedLatencyMs: 12, recoveryCadenceMs: 60 },
      { id: 'moba_s1', name: 'Skill 1', inputCategory: 'SKILL_COMBO', normalizedZone: { xMin: 0.65, xMax: 0.78, yMin: 0.75, yMax: 0.88 }, activationRule: 'Instant Tap', expectedLatencyMs: 8, recoveryCadenceMs: 250 },
    ],
  },
};

export const INITIAL_TACTICAL_RULES: TacticalRule[] = [];

export const INITIAL_DAGGER_INTERVENTIONS: DAggerIntervention[] = [];

export const PLAYSTYLE_PROFILES: PlaystyleProfile[] = [
  {
    name: 'Pro Kiter & Punisher',
    archetype: 'Tactical Kiter',
    reactionTimeMs: 145,
    tapJitterVariance: 0.012,
    riskTolerance: 0.45,
    cameraPanCadence: 'Smooth Curve',
    skillComboPacingMs: 80,
  },
  {
    name: 'Hyper-Aggressive Duelist',
    archetype: 'Hyper-Aggressive',
    reactionTimeMs: 110,
    tapJitterVariance: 0.024,
    riskTolerance: 0.85,
    cameraPanCadence: 'Flick',
    skillComboPacingMs: 45,
  },
  {
    name: 'Calculated Burst Sniper',
    archetype: 'Calculated Burst',
    reactionTimeMs: 165,
    tapJitterVariance: 0.005,
    riskTolerance: 0.30,
    cameraPanCadence: 'Snap',
    skillComboPacingMs: 120,
  },
];

export const BENCHMARK_METRICS: BenchmarkResult[] = [];
