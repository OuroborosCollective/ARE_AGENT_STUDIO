import React, { useEffect, useMemo, useState } from 'react';
import { TouchEventType, type FrameTelemetry, type TrainingMetric } from '../types';
import { globalNeuralPolicy } from '../services/neuralPolicyEngine';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Cpu, Play, Layers, TrendingDown, Sliders, Download, Database } from 'lucide-react';

interface PolicyTrainingStudioProps {
  telemetries: FrameTelemetry[];
}

export const PolicyTrainingStudio: React.FC<PolicyTrainingStudioProps> = ({ telemetries }) => {
  const [epochs, setEpochs] = useState(12);
  const [learningRate, setLearningRate] = useState(0.01);
  const [isTraining, setIsTraining] = useState(false);
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [metrics, setMetrics] = useState<TrainingMetric[]>([]);
  const [weightHeatmap, setWeightHeatmap] = useState<number[]>([]);

  const trainingPairs = useMemo(
    () => telemetries.filter((t) => t.action && t.featureVector?.length === 16),
    [telemetries],
  );

  const refreshWeightView = () => setWeightHeatmap(globalNeuralPolicy.W3.flat().slice(0, 32));
  useEffect(() => refreshWeightView(), []);

  const handleStartTraining = () => {
    if (trainingPairs.length === 0) return;
    globalNeuralPolicy.learningRate = learningRate;
    setMetrics([]);
    setCurrentEpoch(1);
    setIsTraining(true);
  };

  useEffect(() => {
    if (!isTraining) return;
    if (currentEpoch > epochs) {
      setIsTraining(false);
      globalNeuralPolicy.saveToLocalStorage();
      return;
    }

    const timer = window.setTimeout(() => {
      let loss = 0;
      let mse = 0;
      let bce = 0;
      let coordinateError = 0;

      for (const sample of trainingPairs) {
        const action = sample.action!;
        const target: [number, number, number, number] = [action.x, action.y, action.pressure, action.type === TouchEventType.UP ? 0 : 1];
        const result = globalNeuralPolicy.trainStep(sample.featureVector!, target);
        const prediction = globalNeuralPolicy.forward(sample.featureVector!).prediction;
        loss += result.loss;
        mse += result.coordMse;
        bce += result.bceLoss;
        coordinateError += Math.hypot(prediction[0] - action.x, prediction[1] - action.y);
      }

      const n = trainingPairs.length;
      const meanCoordError = coordinateError / n;
      const accuracy = Math.max(0, Math.min(100, (1 - meanCoordError / Math.SQRT2) * 100));
      setMetrics((prev) => [...prev, {
        epoch: currentEpoch,
        loss: Number((loss / n).toFixed(5)),
        coordMse: Number((mse / n).toFixed(5)),
        touchStateBce: Number((bce / n).toFixed(5)),
        trajectoryAccuracy: Number(accuracy.toFixed(2)),
        learningRate: globalNeuralPolicy.learningRate,
      }]);
      refreshWeightView();
      setCurrentEpoch((value) => value + 1);
    }, 30);

    return () => window.clearTimeout(timer);
  }, [isTraining, currentEpoch, epochs, trainingPairs]);

  const handleExportWeights = () => {
    const blob = new Blob([globalNeuralPolicy.exportWeightsJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `are_agent_policy_${globalNeuralPolicy.totalTrainedBatches}_steps.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs">
              <Cpu className="w-4 h-4" />
              <span>SEEDED IMITATION POLICY • OBSERVED PAIRS ONLY</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">Behavioral Cloning Training Studio</h2>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Trains the real in-browser 16→32→16→4 MLP only from captured frame/action pairs. No synthetic epochs are generated.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleStartTraining}
              disabled={isTraining || trainingPairs.length === 0}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all ${
                isTraining ? 'bg-amber-600 text-white animate-pulse' : trainingPairs.length ? 'bg-cyan-600 hover:bg-cyan-500 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Play className="w-4 h-4" />
              <span>{isTraining ? `EPOCH ${Math.min(currentEpoch, epochs)}/${epochs}` : trainingPairs.length ? 'TRAIN OBSERVED PAIRS' : 'RECORD DATA FIRST'}</span>
            </button>
            <button onClick={handleExportWeights} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono">
              <Download className="w-3.5 h-3.5" /> Export Weights
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-cyber-card border border-cyber-border rounded-2xl p-6">
          <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2"><Layers className="w-4 h-4 text-cyan-400" /> Active Policy Architecture</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[#0c101c] border border-cyan-500/30">
              <span className="text-[10px] font-mono text-cyan-400 font-bold block">INPUT</span>
              <h4 className="text-sm font-bold text-white mt-1">16-D observed feature vector</h4>
              <p className="text-[11px] text-slate-400 mt-2">Captured telemetry/features attached to the demonstrated action.</p>
            </div>
            <div className="p-4 rounded-xl bg-[#0c101c] border border-purple-500/30">
              <span className="text-[10px] font-mono text-purple-400 font-bold block">HIDDEN MLP</span>
              <h4 className="text-sm font-bold text-white mt-1">16 → 32 → 16</h4>
              <p className="text-[11px] text-slate-400 mt-2">ReLU dense layers with AdamW-style online updates.</p>
            </div>
            <div className="p-4 rounded-xl bg-[#0c101c] border border-emerald-500/30">
              <span className="text-[10px] font-mono text-emerald-400 font-bold block">ACTION HEAD</span>
              <h4 className="text-sm font-bold text-white mt-1">4 normalized outputs</h4>
              <p className="text-[11px] text-slate-400 mt-2">x, y, pressure and touch probability in [0,1].</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-emerald-400" /> Measured training loss</span>
              <span className="text-xs font-mono text-emerald-400">Latest coordinate score: {metrics.length ? `${metrics.at(-1)!.trajectoryAccuracy}%` : 'not measured'}</span>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" />
                  <XAxis dataKey="epoch" stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0c101c', borderColor: '#1f293d', borderRadius: '8px', fontSize: '11px' }} />
                  <Line type="monotone" dataKey="loss" stroke="#00f0ff" strokeWidth={2} dot={{ r: 2 }} name="Total Loss" />
                  <Line type="monotone" dataKey="coordMse" stroke="#10b981" strokeWidth={1.5} dot={false} name="Coordinate MSE" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-cyber-card border border-cyber-border rounded-2xl p-6 h-fit space-y-4">
          <h3 className="font-bold text-white text-sm flex items-center gap-2"><Sliders className="w-4 h-4 text-cyan-400" /> Training Contract</h3>
          <div className="space-y-3 text-xs font-mono">
            <div className="p-3 rounded-xl bg-[#0c101c] border border-slate-800">
              <span className="text-[10px] text-slate-400 block">OBSERVED TRAINING PAIRS</span>
              <span className="text-lg font-bold text-white flex items-center gap-2"><Database className="w-4 h-4 text-cyan-400" /> {trainingPairs.length}</span>
            </div>
            <div><label className="text-slate-400 block mb-1">EPOCHS ({epochs})</label><input type="range" min={1} max={30} value={epochs} onChange={(e) => setEpochs(Number(e.target.value))} className="w-full accent-cyan-400" /></div>
            <div>
              <label className="text-slate-400 block mb-1">LEARNING RATE ({learningRate})</label>
              <select value={learningRate} onChange={(e) => setLearningRate(Number(e.target.value))} className="w-full bg-[#0c101c] border border-slate-800 rounded-lg px-3 py-2 text-slate-200">
                <option value={0.01}>1e-2</option><option value={0.005}>5e-3</option><option value={0.001}>1e-3</option>
              </select>
            </div>
            <div className="pt-3 border-t border-slate-800">
              <span className="text-[10px] text-slate-400 font-bold block mb-2">ACTIVE OUTPUT WEIGHTS</span>
              <div className="grid grid-cols-8 gap-1">{weightHeatmap.map((w, idx) => <div key={idx} style={{ opacity: Math.max(0.15, Math.min(1, Math.abs(w) * 4)) }} className="h-4 rounded-[2px] bg-emerald-400" title={`W[${idx}] = ${w.toFixed(5)}`} />)}</div>
            </div>
            <div className="text-[10px] text-slate-500">Seed: <span className="text-slate-300">{globalNeuralPolicy.seed}</span></div>
            <div className="text-[10px] text-slate-500">Optimizer steps: <span className="text-slate-300">{globalNeuralPolicy.totalTrainedBatches}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};
