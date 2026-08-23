import React, { useState } from 'react';
import { GameArchetype, GenreKnowledgeSchema, GenreControlPrimitive } from '../types';
import { GENRE_KNOWLEDGE_SCHEMAS } from '../constants';
import {
  Gamepad2,
  Crosshair,
  Activity,
  Layers,
  CheckCircle2,
  Sparkles,
  Compass,
  Swords,
  ShieldAlert,
  ArrowRight,
  Sliders,
  Target,
  Building2,
  Users,
  Grid,
  Info,
  BookOpen
} from 'lucide-react';

interface GenreKnowledgeMatrixProps {
  currentGenre: GameArchetype;
  onSelectGenre: (genre: GameArchetype) => void;
  onDeployGenreRules: (genre: GameArchetype) => void;
}

export const GenreKnowledgeMatrix: React.FC<GenreKnowledgeMatrixProps> = ({
  currentGenre,
  onSelectGenre,
  onDeployGenreRules,
}) => {
  const activeSchema: GenreKnowledgeSchema = GENRE_KNOWLEDGE_SCHEMAS[currentGenre];
  const [selectedPrimitive, setSelectedPrimitive] = useState<GenreControlPrimitive | null>(
    activeSchema.controlPrimitives[0] || null
  );

  const getGenreIcon = (genre: GameArchetype) => {
    switch (genre) {
      case GameArchetype.FPS:
        return <Crosshair className="w-4 h-4 text-amber-400" />;
      case GameArchetype.SIM_MANAGEMENT:
        return <Building2 className="w-4 h-4 text-emerald-400" />;
      case GameArchetype.ACTION_RPG:
        return <Swords className="w-4 h-4 text-red-400" />;
      case GameArchetype.MMORPG:
        return <Users className="w-4 h-4 text-purple-400" />;
      case GameArchetype.PUZZLE_MATCH:
        return <Grid className="w-4 h-4 text-cyan-400" />;
      case GameArchetype.MOBA_ARENA:
        return <Target className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Deterministic Differentiation Matrix */}
      <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs">
              <BookOpen className="w-4 h-4" />
              <span>DETERMINISTIC GENRE DIFFERENTIATION MATRIX (V1 & V2 SPECIFICATION)</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">
              Multi-Genre Action Logic & Structural Taxonomy
            </h2>
            <p className="text-xs text-slate-400 font-mono max-w-2xl mt-1">
              Operator-maintained genre templates for camera perspective, objectives, controls and gameplay loops. The 60% rule is a taxonomy heuristic, not an observed runtime measurement.
            </p>
          </div>

          <button
            onClick={() => onDeployGenreRules(currentGenre)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-mono text-xs font-bold shadow-lg shadow-cyan-500/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Template Candidates</span>
          </button>
        </div>

        {/* 60% Classification Rule Banner */}
        <div className="mt-4 p-3 rounded-xl bg-[#0c101c] border border-slate-800 flex items-start gap-3">
          <Info className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs font-mono text-slate-300">
            <span className="text-cyan-300 font-bold">TAXONOMY HEURISTIC: </span>
            Weist ein Spiel Merkmale mehrerer Genres auf, priorisiert das System das Genre, dessen <span className="text-emerald-400 font-semibold">&quot;Gameplay-Ablauf&quot;</span> mehr als <span className="text-amber-400 font-bold">60% der Spielzeit</span> einnimmt.
          </div>
        </div>
      </div>

      {/* 5 Core Genre Selectors */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {Object.keys(GENRE_KNOWLEDGE_SCHEMAS).map((key) => {
          const archetypeKey = key as GameArchetype;
          const schema = GENRE_KNOWLEDGE_SCHEMAS[archetypeKey];
          const isSelected = currentGenre === archetypeKey;
          return (
            <button
              key={key}
              onClick={() => {
                onSelectGenre(archetypeKey);
                setSelectedPrimitive(GENRE_KNOWLEDGE_SCHEMAS[archetypeKey].controlPrimitives[0]);
              }}
              className={`p-3.5 rounded-xl border text-left font-mono transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 ring-2 ring-cyan-500/30'
                  : 'bg-cyber-card border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-bold">{schema.shortCode}</span>
                {getGenreIcon(archetypeKey)}
              </div>
              <div className="text-xs font-bold text-white truncate mt-2">{schema.title.split('(')[0]}</div>
            </button>
          );
        })}
      </div>

      {/* Deep-Dive Structural Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Structural Criteria Breakdown (Ziel, Steuerung, Loop, Abgrenzung) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-2">
                {getGenreIcon(currentGenre)}
                <h3 className="font-bold text-white text-base">
                  {activeSchema.title} — Fundamentale Merkmale
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[11px] border border-cyan-500/30">
                Min. {activeSchema.criteria.dominantLoopShareMinPercent}% Dominant Loop
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-[#0c101c] border border-slate-800">
                <span className="text-cyan-400 font-bold block mb-1">1. KAMERAPERSPEKTIVE</span>
                <p className="text-slate-200 leading-relaxed">{activeSchema.criteria.cameraPerspective}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0c101c] border border-slate-800">
                <span className="text-amber-400 font-bold block mb-1">2. KERN-ZIEL</span>
                <p className="text-slate-200 leading-relaxed">{activeSchema.criteria.coreObjective}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0c101c] border border-slate-800">
                <span className="text-emerald-400 font-bold block mb-1">3. STEUERUNG & INTERAKTION</span>
                <p className="text-slate-200 leading-relaxed">{activeSchema.criteria.coreControls}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#0c101c] border border-slate-800">
                <span className="text-red-400 font-bold block mb-1">4. ABGRENZUNG ZU ANDEREN GENRES</span>
                <p className="text-slate-200 leading-relaxed">{activeSchema.criteria.differentiationBoundary}</p>
              </div>
            </div>

            {/* Primary Gameplay Loop Box */}
            <div className="mt-4 p-4 rounded-xl bg-[#0c101c] border border-cyan-500/30 text-xs font-mono">
              <span className="text-cyan-300 font-bold block mb-1">5. HAUPTSCHLEIFE (GAMEPLAY-ABLAUF):</span>
              <p className="text-emerald-300 leading-relaxed">{activeSchema.criteria.primaryGameplayLoop}</p>
            </div>

            {/* Secondary Actions Chips */}
            <div className="mt-4">
              <span className="text-slate-400 text-xs font-mono font-bold block mb-2">NEBEN-AKTIONEN:</span>
              <div className="flex flex-wrap gap-2">
                {activeSchema.criteria.secondaryActions.map((action, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 text-xs font-mono">
                    • {action}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Tactical Decision Directives */}
          <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6">
            <h3 className="font-bold text-white text-base mb-4 flex items-center gap-2">
              <Swords className="w-4 h-4 text-purple-400" />
              <span>Genre-Spezifische Entscheidungs-Regeln (Decision Tree)</span>
            </h3>

            <div className="space-y-2.5">
              {activeSchema.decisionTree.map((rule, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-[#0c101c] border border-slate-800 text-xs font-mono">
                  <span className="text-purple-400 font-bold block mb-1">REGEL #{idx + 1}:</span>
                  <span className="text-slate-200">{rule}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Control Primitives & Spatial HUD Anchors */}
        <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 h-fit space-y-5">
          <h3 className="font-bold text-white text-sm flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Genre Input-Primitive & HUD Zones</span>
          </h3>

          <div className="space-y-2">
            {activeSchema.controlPrimitives.map((prim) => (
              <button
                key={prim.id}
                onClick={() => setSelectedPrimitive(prim)}
                className={`w-full text-left p-3 rounded-xl border font-mono text-xs transition-all ${
                  selectedPrimitive?.id === prim.id
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500 ring-1 ring-amber-500/30'
                    : 'bg-[#0c101c] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex justify-between font-bold">
                  <span>{prim.name}</span>
                  <span className="text-[10px] text-amber-400">{prim.inputCategory}</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Template target: {prim.expectedLatencyMs}ms • cadence prior: {prim.recoveryCadenceMs}ms (unverified)
                </div>
              </button>
            ))}
          </div>

          {selectedPrimitive && (
            <div className="p-4 rounded-xl bg-[#0c101c] border border-slate-800 text-xs font-mono space-y-2">
              <span className="text-[10px] text-slate-500 block font-bold">TOUCH-BOUNDING BOX (NORMALISIERT)</span>
              <div className="text-slate-300">
                X: [{selectedPrimitive.normalizedZone.xMin.toFixed(2)} - {selectedPrimitive.normalizedZone.xMax.toFixed(2)}]
                <br />
                Y: [{selectedPrimitive.normalizedZone.yMin.toFixed(2)} - {selectedPrimitive.normalizedZone.yMax.toFixed(2)}]
              </div>
              <div className="text-emerald-400 pt-2 border-t border-slate-800">
                <span className="text-slate-500 block text-[10px]">GESTEN-INJEKTION:</span>
                {selectedPrimitive.activationRule}
              </div>
            </div>
          )}

          {/* Visual HUD Taxonomy list */}
          <div className="pt-2 border-t border-slate-800">
            <span className="text-xs font-mono font-bold text-slate-400 block mb-2">VISUELLE HUD-ELEMENTE:</span>
            <div className="space-y-1.5 text-xs font-mono text-slate-300">
              {activeSchema.visualHUDTaxonomy.map((hud, idx) => (
                <div key={idx} className="p-2 rounded bg-[#0c101c] border border-slate-800/80 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                  <span className="text-[11px] truncate">{hud}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
