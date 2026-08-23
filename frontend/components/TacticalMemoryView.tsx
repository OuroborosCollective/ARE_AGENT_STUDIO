import React, { useState } from 'react';
import { GameArchetype, TacticalRule } from '../types';
import { analyzeGameplayFrameWithAdvisory } from '../services/advisoryService';
import {
  Sparkles,
  Brain,
  Search,
  Plus,
  Trash2,
  ShieldCheck,
  Cpu,
  ChevronRight,
  Eye,
  Crosshair,
  Zap
} from 'lucide-react';

interface TacticalMemoryViewProps {
  rules: TacticalRule[];
  onAddRule: (rule: TacticalRule) => void;
  onDeleteRule: (id: string) => void;
  latestFrameDataUrl: string | null;
  genre: GameArchetype;
}

export const TacticalMemoryView: React.FC<TacticalMemoryViewProps> = ({
  rules,
  onAddRule,
  onDeleteRule,
  latestFrameDataUrl,
  genre,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Manual rule creation form
  const [newCondition, setNewCondition] = useState('');
  const [newPhase, setNewPhase] = useState<'COMBAT' | 'FARMING' | 'RETREAT' | 'MENU' | 'BOSS_FIGHT'>('COMBAT');
  const [newDirective, setNewDirective] = useState('');

  const handleRunVisionAdvisory = async () => {
    if (!latestFrameDataUrl) return;
    setIsAnalyzing(true);
    setAiError(null);
    try {
      const res = await analyzeGameplayFrameWithAdvisory(latestFrameDataUrl, 'Real-time arena combat');
      setAiAnalysisResult(res);
    } catch (e) {
      setAiAnalysisResult(null);
      setAiError(e instanceof Error ? e.message : 'Advisory analysis failed');
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAdoptAIRecommendation = () => {
    if (!aiAnalysisResult) return;
    const rule: TacticalRule = {
      id: `TR-${Date.now().toString().slice(-4)}`,
      condition: `Phase == ${aiAnalysisResult.gameState} AND Enemies >= ${aiAnalysisResult.enemiesCount}`,
      gamePhase: aiAnalysisResult.gameState,
      actionDirective: aiAnalysisResult.recommendedDirective,
      confidence: 0,
      timestamp: 'Adopted advisory candidate; not runtime evidence',
      triggerCount: 0,
      genre,
    };
    onAddRule(rule);
    setAiAnalysisResult(null);
  };

  const handleCreateManualRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCondition || !newDirective) return;
    const rule: TacticalRule = {
      id: `TR-${Date.now().toString().slice(-4)}`,
      condition: newCondition,
      gamePhase: newPhase,
      actionDirective: newDirective,
      confidence: 0,
      timestamp: 'Created manually',
      triggerCount: 0,
      genre,
    };
    onAddRule(rule);
    setNewCondition('');
    setNewDirective('');
  };

  const filteredRules = rules.filter(
    (r) =>
      r.condition.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.actionDirective.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.gamePhase.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner: Vision-Language Assistant */}
      <div className="bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-slate-900 border border-purple-500/30 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-purple-400 font-mono text-xs">
              <Sparkles className="w-4 h-4" />
              <span>OPTIONAL SERVER-SIDE VISION ADVISORY</span>
            </div>
            <h2 className="text-xl font-bold text-white">
              Tactical State Memory & Cognitive Playbook Ledger
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Deconstructs live screenshots into high-level macro strategy (&quot;Gameplay Notes&quot;).
              Keeps optional model-generated observations as explicitly advisory candidate rules. They do not become runtime or dataset evidence.
            </p>
          </div>

          <button
            onClick={handleRunVisionAdvisory}
            disabled={isAnalyzing || !latestFrameDataUrl}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold transition-all shadow-lg shadow-purple-500/20 disabled:opacity-50 flex-shrink-0"
          >
            <Eye className={`w-4 h-4 ${isAnalyzing ? 'animate-spin' : ''}`} />
            <span>{isAnalyzing ? 'SCANNING FRAME...' : 'ANALYZE FRAME WITH ADVISORY'}</span>
          </button>
        </div>

        {/* Optional advisory output; never runtime evidence */}
        {aiAnalysisResult && (
          <div className="mt-6 p-4 rounded-xl bg-[#0c0f1c] border border-purple-500/40 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-purple-900/50 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono text-xs border border-purple-500/40 font-bold">
                  {aiAnalysisResult.gameState}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  HP: {aiAnalysisResult.hpEstimated}% • Mana: {aiAnalysisResult.manaEstimated}% • Hostiles: {aiAnalysisResult.enemiesCount}
                </span>
              </div>
              <button
                onClick={handleAdoptAIRecommendation}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save to Playbook Ledger</span>
              </button>
            </div>

            <p className="text-xs text-slate-200 font-mono">
              <span className="text-purple-400 font-bold">Tactical Observation: </span>
              {aiAnalysisResult.strategicNote}
            </p>

            <p className="text-xs text-emerald-300 font-mono mt-2">
              <span className="text-slate-400 font-bold">Suggested Policy Action: </span>
              {aiAnalysisResult.recommendedDirective}
            </p>
          </div>
        )}
      </div>

      {/* Main Grid: Ledger List & Rule Creator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Playbook Ledger Rules */}
        <div className="lg:col-span-2 bg-cyber-card border border-cyber-border rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                <span>Persistent Tactical Decision Ledger</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {filteredRules.length} high-level behavioral heuristics indexed
              </p>
            </div>

            {/* Search filter */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search conditions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0c101c] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredRules.map((rule) => (
              <div
                key={rule.id}
                className="p-4 rounded-xl bg-[#0c101c] border border-slate-800/80 hover:border-purple-500/40 transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                      {rule.id}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        rule.gamePhase === 'RETREAT'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : rule.gamePhase === 'BOSS_FIGHT'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}
                    >
                      {rule.gamePhase}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-500">
                      Triggered {rule.triggerCount}x
                    </span>
                    <button
                      onClick={() => onDeleteRule(rule.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Condition & Action */}
                <div className="mt-2 text-xs font-mono">
                  <div className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <span className="text-purple-400">WHEN:</span> {rule.condition}
                  </div>
                  <div className="text-emerald-400 mt-1 flex items-start gap-1.5">
                    <span className="text-slate-500">THEN:</span> {rule.actionDirective}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col: Add Manual Heuristic Rule */}
        <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 h-fit">
          <h3 className="font-bold text-white text-sm flex items-center gap-2 mb-4">
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Inject Custom Heuristic Rule</span>
          </h3>

          <form onSubmit={handleCreateManualRule} className="space-y-4 text-xs font-mono">
            <div>
              <label className="text-slate-400 block mb-1">GAME PHASE</label>
              <select
                value={newPhase}
                onChange={(e) => setNewPhase(e.target.value as any)}
                className="w-full bg-[#0c101c] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-purple-500"
              >
                <option value="COMBAT">COMBAT (Arena skirmish)</option>
                <option value="RETREAT">RETREAT (Kiting / Low HP)</option>
                <option value="BOSS_FIGHT">BOSS_FIGHT (Burst combo)</option>
                <option value="FARMING">FARMING (Lane wave)</option>
                <option value="MENU">MENU (Navigation)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">TRIGGER CONDITION</label>
              <input
                type="text"
                placeholder="e.g. HP < 25% AND Enemy Near"
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value)}
                className="w-full bg-[#0c101c] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">ACTION DIRECTIVE</label>
              <textarea
                rows={3}
                placeholder="e.g. Cast Dash away from threat coordinate + tap heal potion"
                value={newDirective}
                onChange={(e) => setNewDirective(e.target.value)}
                className="w-full bg-[#0c101c] border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all"
            >
              Add Rule to Memory
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
