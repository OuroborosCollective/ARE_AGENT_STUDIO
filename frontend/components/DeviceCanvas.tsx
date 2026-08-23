import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TouchAction, TouchEventType, AgentPrediction, GameArchetype } from '../types';
import { globalNeuralPolicy } from '../services/neuralPolicyEngine';
import {
  Monitor,
  Tv,
  Smartphone,
  VideoOff,
  Radio,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Scan,
  Layers,
  Zap,
  CheckCircle2,
  Maximize2,
  ScreenShare,
  Upload,
  Link2,
  FileVideo,
  Play,
  Pause
} from 'lucide-react';

interface DeviceCanvasProps {
  onHumanTouch: (action: TouchAction) => void;
  isAgentActive: boolean;
  agentPrediction: AgentPrediction | null;
  onFrameSnapshot?: (dataUrl: string, motionIntensity: number, featureVector: number[]) => void;
  gamePhase: string;
  gameArchetype: GameArchetype;
  onDAggerInterventionTriggered?: (agentAction: [number, number], humanAction: TouchAction) => void;
}

export const DeviceCanvas: React.FC<DeviceCanvasProps> = ({
  onHumanTouch,
  isAgentActive,
  agentPrediction,
  onFrameSnapshot,
  gamePhase,
  gameArchetype,
  onDAggerInterventionTriggered,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const pointerStartRef = useRef<Map<number, number>>(new Map());
  const rippleCounterRef = useRef(1);

  // Stream & Source State
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [activeSourceType, setActiveSourceType] = useState<'NONE' | 'DISPLAY_MEDIA' | 'LOCAL_VIDEO' | 'NETWORK_STREAM'>('NONE');
  const [sourceTitle, setSourceTitle] = useState<string>('No Game Screen Connected');
  const [streamError, setStreamError] = useState<string | null>(null);
  const [fpsCounter, setFpsCounter] = useState(0);
  const [touchRipples, setTouchRipples] = useState<{ x: number; y: number; id: number; color: string; label?: string }[]>([]);

  // Network URL dialog state
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [networkStreamUrl, setNetworkStreamUrl] = useState('');

  // Video playback controls for recorded feeds
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);

  // Real-time Vision Metrics computed from actual screen pixels
  const [realMetrics, setRealMetrics] = useState({
    motionIntensity: 0,
    avgLuminance: 0,
    dominantColor: '#000000',
    hasSignal: false,
    resolution: '0x0',
  });

  // Feature detection for getDisplayMedia across browsers and sandboxed iframes
  const isDisplayMediaSupported = typeof navigator !== 'undefined' &&
    ((navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') ||
     (typeof (navigator as any).getDisplayMedia === 'function'));

  // 1. Safe Screen / Window Capture Handler (with fallback detection)
  const handleStartScreenCapture = async () => {
    try {
      setStreamError(null);

      let mediaStream: MediaStream | null = null;

      if (navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function') {
        mediaStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'window',
            frameRate: { ideal: 60, max: 60 },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } else if (typeof (navigator as any).getDisplayMedia === 'function') {
        mediaStream = await (navigator as any).getDisplayMedia({ video: true });
      } else {
        throw new Error('Screen capture is not available in this browser window. Please load a Gameplay Video Feed or Network Stream URL.');
      }

      if (!mediaStream) {
        throw new Error('Failed to acquire screen media stream.');
      }

      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        setSourceTitle(videoTrack.label || 'Display / Scrcpy Window');
        setRealMetrics((prev) => ({
          ...prev,
          resolution: `${settings.width || 1080}x${settings.height || 2400}`,
        }));
      }

      setStream(mediaStream);
      setActiveSourceType('DISPLAY_MEDIA');

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.src = '';
        videoRef.current.play().catch(() => {});
      }

      videoTrack.onended = () => {
        handleStopStream();
      };
    } catch (err: any) {
      console.warn('Screen capture error:', err);
      if (err.name !== 'NotAllowedError') {
        setStreamError(err.message || 'Screen capture could not be opened. You can use the Gameplay Video Feed option below.');
      }
    }
  };

  // 2. Real Gameplay Video File Feeder (Load any Android screen recording MP4/WebM)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    handleStopStream();
    setStreamError(null);

    const fileUrl = URL.createObjectURL(file);
    setSourceTitle(`File: ${file.name}`);
    setActiveSourceType('LOCAL_VIDEO');

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = fileUrl;
      videoRef.current.loop = true;
      videoRef.current.play().catch(() => {});
      setIsVideoPlaying(true);
    }
  };

  // 3. Connect to a browser-decodable remote video URL
  const handleConnectNetworkStream = (url: string) => {
    try {
      const validUrl = new URL(url);
      handleStopStream();
      setStreamError(null);
      setSourceTitle(`Stream: ${validUrl.host}`);
      setActiveSourceType('NETWORK_STREAM');
      setShowUrlInput(false);

      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = validUrl.toString();
        videoRef.current.play().catch((error) => {
          setStreamError(`Browser could not decode/play this URL: ${error instanceof Error ? error.message : 'unsupported stream'}`);
          setActiveSourceType('NONE');
        });
      }
    } catch {
      setStreamError('Invalid Stream URL format. Expected http://host:port/stream');
    }
  };

  const handleTogglePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsVideoPlaying(true);
    } else {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    }
  };

  const handleStopStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.src = '';
    }
    setStream(null);
    setActiveSourceType('NONE');
    setSourceTitle('No Game Screen Connected');
    setRealMetrics((prev) => ({ ...prev, hasSignal: false }));
  };

  // Touch & Action Handler mapped directly over the captured game viewport
  const handlePointerInteraction = useCallback((e: React.PointerEvent<HTMLCanvasElement>, type: TouchEventType) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const normX = Math.max(0, Math.min(1, clientX / rect.width));
    const normY = Math.max(0, Math.min(1, clientY / rect.height));

    const isHumanTakeover = isAgentActive;

    const now = Date.now();
    if (type === TouchEventType.DOWN) pointerStartRef.current.set(e.pointerId, now);
    const startedAt = pointerStartRef.current.get(e.pointerId) ?? now;
    const durationMs = Math.max(0, now - startedAt);
    const action: TouchAction = {
      id: globalThis.crypto?.randomUUID?.() || `touch-${now}-${e.pointerId}`,
      timestamp: now,
      x: normX,
      y: normY,
      type,
      pressure: Math.max(0, Math.min(1, Number.isFinite(e.pressure) ? e.pressure : 0)),
      durationMs,
      isCorrection: isHumanTakeover,
    };
    if (type === TouchEventType.UP) pointerStartRef.current.delete(e.pointerId);

    if (isHumanTakeover && agentPrediction && onDAggerInterventionTriggered) {
      onDAggerInterventionTriggered([agentPrediction.targetX, agentPrediction.targetY], action);
    }

    onHumanTouch(action);

    // Visual touch ripple feedback
    const newRipple = {
      x: normX,
      y: normY,
      id: rippleCounterRef.current++,
      color: isHumanTakeover ? '#ef4444' : isAgentActive ? '#f59e0b' : '#00f0ff',
      label: isHumanTakeover ? 'DAgger Human Override' : isAgentActive ? 'Agent Touch Injection' : 'Human Touch Input',
    };
    setTouchRipples((prev) => [...prev.slice(-6), newRipple]);
  }, [onHumanTouch, isAgentActive, agentPrediction, onDAggerInterventionTriggered]);

  // Real-Time Video Frame Acquisition & Pixel Analysis Loop from live Screen Stream
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let animationId: number;
    let framesThisSecond = 0;
    let lastFpsCheck = performance.now();

    const processFrame = () => {
      const w = canvas.width;
      const h = canvas.height;

      const hasActiveVideo = video && activeSourceType !== 'NONE' && video.readyState >= 2;

      if (hasActiveVideo) {
        // 1. Draw Real Screen Video Frame
        ctx.drawImage(video, 0, 0, w, h);

        // 2. Perform Real Pixel State Analysis
        try {
          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;
          const totalPixels = data.length / 4;

          let motionDiff = 0;
          let totalLum = 0;

          const prevData = prevFrameDataRef.current;

          for (let i = 0; i < data.length; i += 16) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            totalLum += lum;

            // Real inter-frame motion delta
            if (prevData && prevData.length === data.length) {
              const diff = Math.abs(r - prevData[i]) + Math.abs(g - prevData[i + 1]) + Math.abs(b - prevData[i + 2]);
              if (diff > 45) {
                motionDiff++;
              }
            }

          }
          const motion = Math.min(100, Math.round((motionDiff / (totalPixels / 4)) * 400));
          const avgLum = Math.round(totalLum / (data.length / 16));

          if (!prevFrameDataRef.current || prevFrameDataRef.current.length !== data.length) {
            prevFrameDataRef.current = new Uint8ClampedArray(data);
          } else {
            prevFrameDataRef.current.set(data);
          }

          setRealMetrics((prev) => ({
            ...prev,
            motionIntensity: motion,
            avgLuminance: avgLum,
            dominantColor: `rgb(${data[0]}, ${data[1]}, ${data[2]})`,
            hasSignal: true,
          }));

          // Send snapshot data for telemetry dataset aggregation
          if (onFrameSnapshot && framesThisSecond % 15 === 0) {
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            const featureVector = globalNeuralPolicy.extractVisualFeaturesFromImageData(imgData);
            onFrameSnapshot(dataUrl, motion, featureVector);
          }
        } catch {
          // Cross-origin fallback
        }

        // 3. Render Agent Target Trajectory Overlay when active
        if (isAgentActive && agentPrediction) {
          const targetPxX = agentPrediction.targetX * w;
          const targetPxY = agentPrediction.targetY * h;

          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(targetPxX, targetPxY, 18, 0, Math.PI * 2);
          ctx.moveTo(targetPxX - 24, targetPxY);
          ctx.lineTo(targetPxX + 24, targetPxY);
          ctx.moveTo(targetPxX - 24, targetPxY);
          ctx.lineTo(targetPxX + 24, targetPxY);
          ctx.stroke();

          // Action Horizon Spline
          if (agentPrediction.trajectory && agentPrediction.trajectory.length > 0) {
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
            ctx.lineWidth = 3;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(w * 0.5, h * 0.65);
            agentPrediction.trajectory.forEach((pt) => {
              ctx.lineTo(pt.x * w, pt.y * h);
            });
            ctx.stroke();
            ctx.setLineDash([]);
          }

          ctx.fillStyle = '#fef08a';
          ctx.font = 'bold 10px JetBrains Mono';
          ctx.textAlign = 'center';
          ctx.fillText(`CONF: ${(agentPrediction.confidence * 100).toFixed(0)}% • LAT: ${agentPrediction.latencyMs.toFixed(1)}ms`, targetPxX, targetPxY - 26);
        }

      } else {
        // --- NO DEVICE / SCREEN DISCONNECTED STANDBY VIEW ---
        ctx.fillStyle = '#06080e';
        ctx.fillRect(0, 0, w, h);

        // Cyber Grid Pattern
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.5)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y < h; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }

        // Radar Scanning Pulse
        const pulse = (Date.now() / 15) % (w * 0.45);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2 - 40, pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(w / 2, h / 2 - 40, 28, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.arc(w / 2, h / 2 - 40, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 12px JetBrains Mono';
        ctx.textAlign = 'center';
        ctx.fillText('NO GAME SCREEN CONNECTED', w / 2, h / 2 + 15);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px JetBrains Mono';
        ctx.fillText('SELECT WINDOW, GAMEPLAY FEED OR STREAM', w / 2, h / 2 + 35);
      }

      // FPS Calculation
      framesThisSecond++;
      const now = performance.now();
      if (now - lastFpsCheck >= 1000) {
        setFpsCounter(framesThisSecond);
        framesThisSecond = 0;
        lastFpsCheck = now;
      }

      animationId = requestAnimationFrame(processFrame);
    };

    animationId = requestAnimationFrame(processFrame);
    return () => cancelAnimationFrame(animationId);
  }, [activeSourceType, isAgentActive, agentPrediction, onFrameSnapshot]);

  return (
    <div className="relative flex flex-col items-center">
      {/* Hidden Video element for receiving live Screen Capture MediaStream or Video Feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        crossOrigin="anonymous"
        className="hidden"
      />

      {/* Hidden File Input for loading recorded gameplay files */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/ogg,video/quicktime"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Phone Frame Wrapper */}
      <div className="relative p-3 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 rounded-[40px] shadow-2xl border-2 border-slate-700/80 neon-border">

        {/* Notch */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-4 bg-black/90 rounded-full flex items-center justify-center gap-3 z-20">
          <div className="w-2 h-2 rounded-full bg-slate-900 border border-slate-700"></div>
          <div className="w-10 h-1 bg-slate-800 rounded-full"></div>
        </div>

        {/* Live Canvas Screen */}
        <div className="relative overflow-hidden rounded-[32px] bg-black">
          <canvas
            ref={canvasRef}
            width={380}
            height={700}
            onPointerDown={(e) => handlePointerInteraction(e, TouchEventType.DOWN)}
            onPointerMove={(e) => e.buttons > 0 && handlePointerInteraction(e, TouchEventType.MOVE)}
            onPointerUp={(e) => handlePointerInteraction(e, TouchEventType.UP)}
            className="block cursor-crosshair touch-none select-none"
          />

          {/* Touch Ripples */}
          {touchRipples.map((ripple) => (
            <div
              key={ripple.id}
              style={{
                left: `${ripple.x * 100}%`,
                top: `${ripple.y * 100}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center animate-ping duration-700"
            >
              <div
                style={{ borderColor: ripple.color, backgroundColor: `${ripple.color}33` }}
                className="w-10 h-10 rounded-full border-2"
              />
            </div>
          ))}

          {/* Real-time Stream Signal Pill */}
          <div className="absolute top-14 left-1/2 -translate-x-1/2 text-[9px] font-mono px-3 py-1 rounded-full border flex items-center gap-2 pointer-events-none bg-black/80 backdrop-blur">
            <span className={`w-2 h-2 rounded-full ${realMetrics.hasSignal ? 'bg-emerald-400 animate-pulse' : 'bg-red-500 animate-ping'}`} />
            <span className={realMetrics.hasSignal ? 'text-emerald-300 font-bold' : 'text-red-400'}>
              {realMetrics.hasSignal ? `SCREEN STREAM ACTIVE • ${fpsCounter} FPS` : 'NO GAME SCREEN CONNECTED'}
            </span>
          </div>

          {/* Prompt Overlay when no game screen is connected */}
          {!realMetrics.hasSignal && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-5 text-center space-y-3">
              <div className="p-3 bg-cyan-950/60 border border-cyan-500/40 rounded-2xl text-cyan-400">
                <ScreenShare className="w-7 h-7 mx-auto" />
              </div>

              <div>
                <h4 className="text-sm font-bold text-white font-mono">Connect Mobile Game Screen</h4>
                <p className="text-[11px] text-slate-400 font-mono mt-1 leading-relaxed">
                  Stream your live <b>Scrcpy window</b>, <b>Android emulator</b> (BlueStacks/Waydroid), or load a recorded gameplay feed.
                </p>
              </div>

              <div className="w-full space-y-2 pt-1 font-mono text-xs">
                {/* 1. Window Capture Button */}
                {isDisplayMediaSupported && (
                  <button
                    onClick={handleStartScreenCapture}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all"
                  >
                    <Monitor className="w-4 h-4" />
                    <span>Select Game Window / Scrcpy</span>
                  </button>
                )}

                {/* 2. Load Local Recorded Gameplay Feed */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <FileVideo className="w-4 h-4 text-purple-400" />
                  <span>Load Gameplay Video Feed (.mp4)</span>
                </button>

                {/* 3. Connect to Remote Scrcpy MJPEG / Stream URL */}
                <button
                  onClick={() => setShowUrlInput((prev) => !prev)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 flex items-center justify-center gap-1.5 text-[11px]"
                >
                  <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Connect Browser-Compatible Video URL</span>
                </button>
              </div>

              {/* Network Stream URL Dialog */}
              {showUrlInput && (
                <div className="w-full p-2.5 bg-slate-900 border border-cyan-500/40 rounded-xl space-y-2 text-left font-mono text-[11px]">
                  <span className="text-slate-300 block font-bold">Browser-decodable video URL:</span>
                  <input
                    type="text"
                    value={networkStreamUrl}
                    onChange={(e) => setNetworkStreamUrl(e.target.value)}
                    placeholder="https://host.example/gameplay.mp4"
                    className="w-full px-2 py-1 bg-black border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-cyan-400 text-xs"
                  />
                  <button
                    onClick={() => handleConnectNetworkStream(networkStreamUrl)}
                    className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded"
                  >
                    Connect Stream
                  </button>
                </div>
              )}

              {streamError && (
                <div className="text-[10px] text-red-400 font-mono bg-red-950/80 p-2 rounded border border-red-800 flex items-center gap-1.5 text-left">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{streamError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Home Indicator */}
        <div className="mt-2 flex justify-center">
          <div className="w-28 h-1 bg-slate-600 rounded-full"></div>
        </div>
      </div>

      {/* Live Stream Controls Bar */}
      {realMetrics.hasSignal && (
        <div className="flex items-center justify-between gap-3 mt-3 bg-slate-900/95 border border-slate-800 px-3.5 py-2 rounded-xl font-mono text-xs w-full max-w-[380px]">
          <div className="flex items-center gap-1.5 truncate">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="text-slate-200 truncate font-semibold" title={sourceTitle}>
              {sourceTitle}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {activeSourceType === 'LOCAL_VIDEO' && (
              <button
                onClick={handleTogglePlayPause}
                className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                title={isVideoPlaying ? 'Pause Video' : 'Play Video'}
              >
                {isVideoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 text-emerald-400" />}
              </button>
            )}

            <span className="text-slate-500 text-[11px]">
              Mot: <span className="text-cyan-300 font-bold">{realMetrics.motionIntensity}%</span>
            </span>

            <button
              onClick={handleStopStream}
              className="text-red-400 hover:text-red-300 text-[11px] px-2 py-0.5 rounded bg-red-950/60 border border-red-800/80 transition-colors"
            >
              Stop
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
