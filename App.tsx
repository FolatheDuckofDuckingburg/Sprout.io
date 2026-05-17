import React, { useState, useEffect, useRef } from 'react';

export default function App() {
  // App state
  const [backendIp, setBackendIp] = useState('192.168.1.100'); // IP for local Spike Prime Flask server
  const [modelUrl, setModelUrl] = useState(''); // Live Teachable Machine Model URL
  const [isScanning, setIsScanning] = useState(false);
  
  // Real-Time Telemetry and Inference State
  const [plantType, setPlantType] = useState('UNKNOWN_SPECIES'); // New Species identification
  const [plantHydration, setPlantHydration] = useState('OPTIMAL'); // Healthy, Dry, etc.
  const [confidence, setConfidence] = useState(0); // Safely defined confidence variable
  const [lastWatered, setLastWatered] = useState<string>('--:--');
  
  // Hardware status simulation
  const [pumpStatus, setPumpStatus] = useState<'IDLE' | 'PUMPING'>('IDLE');
  const [hubConnection, setHubConnection] = useState<'CONNECTED' | 'DISCONNECTED' | 'CONNECTING'>('CONNECTING');

  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warn' } | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  // Refs for video and AI
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modelRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Dynamic loader for TensorFlow.js & Teachable Machine scripts
  useEffect(() => {
    const loadScripts = async () => {
      if ((window as any).tmImage) return; // Already loaded

      const tfScript = document.createElement('script');
      tfScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js';
      tfScript.async = true;
      document.body.appendChild(tfScript);

      tfScript.onload = () => {
        const tmScript = document.createElement('script');
        tmScript.src = 'https://cdn.jsdelivr.net/npm/@teachablemachine/image@latest/dist/teachablemachine-image.min.js';
        tmScript.async = true;
        document.body.appendChild(tmScript);
      };
    };

    loadScripts();

    // Mock Hub connection logic to make it feel real
    setTimeout(() => setHubConnection('CONNECTED'), 2500);
  }, []);

  // Handle Loading the Real Teachable Machine Model
  const loadModel = async () => {
    if (!modelUrl) {
      showToast('Please enter a valid Teachable Machine URL first!', 'warn');
      return;
    }

    setIsModelLoading(true);
    setIsModelLoaded(false);
    showToast('Downloading AI weights from Google...', 'info');

    try {
      const checkpointURL = modelUrl + 'model.json';
      const metadataURL = modelUrl + 'metadata.json';

      if ((window as any).tmImage) {
        const model = await (window as any).tmImage.load(checkpointURL, metadataURL);
        modelRef.current = model;
        setIsModelLoaded(true);
        showToast('AI Model Loaded successfully! 🎉', 'success');
      } else {
        throw new Error('Teachable Machine library not ready yet.');
      }
    } catch (error) {
      console.error(error);
      showToast('Error loading model. Check your URL.', 'warn');
    } finally {
      setIsModelLoading(false);
    }
  };

  // Turn Camera On/Off & Run AI loop
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        showToast('Camera blocked. Running in Graphic Demo mode.', 'warn');
      }
    };

    const stopCamera = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    if (isScanning) {
      startCamera();
      if (isModelLoaded && modelRef.current) {
        // Run REAL AI prediction loops
        const predictLoop = async () => {
          if (videoRef.current && videoRef.current.readyState === 4) {
            const prediction = await modelRef.current.predict(videoRef.current);
            // Sort to find the highest prediction
            prediction.sort((a: any, b: any) => b.probability - a.probability);
            
            const bestPrediction = prediction[0];
            
            // Decode class name (e.g. 'Pothos_Healthy' -> ['Pothos', 'Healthy'])
            const parts = bestPrediction.className.split('_');
            const species = parts[0] || bestPrediction.className;
            const condition = parts[1] || 'DETECTED';

            setPlantType(species.toUpperCase());
            setPlantHydration(condition.toUpperCase());
            setConfidence(Math.round(bestPrediction.probability * 100));
          }
          animationFrameRef.current = requestAnimationFrame(predictLoop);
        };
        predictLoop();
      } else {
        // Run Mock Demonstration Loop if no model loaded
        const mockInterval = setInterval(() => {
          const speciesList = ['POTHOS', 'MONSTERA', 'ZZ_PLANT', 'SNAKE_PLANT'];
          const hydrationStates = ['HEALTHY', 'NEEDS_WATER', 'DRY_SOIL'];
          
          setPlantType(speciesList[Math.floor(Math.random() * speciesList.length)]);
          setPlantHydration(hydrationStates[Math.floor(Math.random() * hydrationStates.length)]);
          setConfidence(Math.floor(Math.random() * 15) + 85);
        }, 4000);

        return () => {
          stopCamera();
          clearInterval(mockInterval);
        };
      }
    } else {
      stopCamera();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setPlantType('IDLE');
      setPlantHydration('IDLE');
      setConfidence(0);
    }

    return () => {
      stopCamera();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isScanning, isModelLoaded]);

  // Toast helper
  const showToast = (msg: string, type: 'info' | 'success' | 'warn' = 'info') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Command delivery to python backend over local Wi-Fi
  const triggerWater = () => {
    if (hubConnection !== 'CONNECTED') {
      showToast('LEGO Hub is disconnected! Cannot pump.', 'warn');
      return;
    }

    setPumpStatus('PUMPING');
    showToast('Sending pump command to Spike Hub...', 'info');

    fetch(`http://${backendIp}:5000/api/water`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          showToast('Pump activated! Water flowing 💧', 'success');
          setLastWatered(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        } else {
          showToast('Failed to start pump.', 'warn');
        }
      })
      .catch((err) => {
        showToast('Cannot reach Python backend. Check Wi-Fi/IP!', 'warn');
        console.warn('Network error:', err);
      })
      .finally(() => {
        setTimeout(() => setPumpStatus('IDLE'), 3500);
      });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-4 sm:p-8 font-sans antialiased text-slate-900">
      {/* Interactive Mobile Phone Frame wrapper */}
      <div className="relative w-full max-w-[420px] aspect-[9/19.5] bg-slate-950 rounded-[60px] shadow-[0_30px_70px_-10px_rgba(0,0,0,0.3)] p-4 border-[8px] border-slate-900 ring-4 ring-slate-800/40 flex flex-col overflow-hidden">
        
        {/* Phone Notch / Speaker */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-36 h-7 bg-slate-950 rounded-b-2xl z-50 flex items-center justify-center gap-1.5 border border-slate-800 border-t-0">
          <div className="w-16 h-1.5 bg-slate-900 rounded-full"></div>
          <div className="w-3 h-3 bg-slate-950 rounded-full border-2 border-slate-800 flex items-center justify-center">
             <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
          </div>
        </div>

        {/* Screen Content - Light Theme */}
        <div className="flex-1 bg-white rounded-[45px] pt-10 pb-5 px-5 flex flex-col overflow-y-auto scrollbar-none relative">
          
          {/* Header Block & Status indicators */}
          <div className="flex items-center justify-between mb-4 mt-1">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 text-2xl transform -rotate-6 transition-transform hover:rotate-0 cursor-pointer">
                🌱
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight">Sprout Mobile</h1>
                <p className="text-[10px] font-extrabold text-slate-400 tracking-wider uppercase">Smart Irrigation OS</p>
              </div>
            </div>
          </div>

          {/* Config Cards */}
          <div className="flex flex-col gap-2.5 mb-4">
              <div className="bg-slate-50 rounded-3xl p-3.5 border border-slate-100 shadow-sm flex items-center gap-3">
                <span className="text-xl">📶</span>
                <div className="flex-1">
                    <h2 className="text-xs font-bold text-slate-950 mb-0.5">Spike Hub IP</h2>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-bold placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
                      placeholder="e.g. 192.168.1.100"
                      value={backendIp}
                      onChange={(e) => setBackendIp(e.target.value)}
                    />
                </div>
              </div>

              <div className="bg-slate-50 rounded-3xl p-3.5 border border-slate-100 shadow-sm flex items-center gap-3">
                <span className="text-xl">🧠</span>
                <div className="flex-1">
                    <h2 className="text-xs font-bold text-slate-950 mb-0.5">Teachable Machine Model</h2>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-bold placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
                        placeholder="Paste URL..."
                        value={modelUrl}
                        onChange={(e) => setModelUrl(e.target.value)}
                      />
                      <button
                        onClick={loadModel}
                        disabled={isModelLoading}
                        className={`px-3 py-2 rounded-lg text-[10px] font-extrabold text-white shadow-sm transition-all active:scale-95 ${isModelLoaded ? 'bg-emerald-500' : 'bg-purple-600 hover:bg-purple-700'}`}
                      >
                        {isModelLoading ? '...' : isModelLoaded ? 'Loaded' : 'Load'}
                      </button>
                    </div>
                </div>
              </div>
          </div>

          {/* Camera Viewfinder */}
          <div className="w-full aspect-[4/3] bg-slate-950 rounded-[32px] overflow-hidden p-3 mb-4 relative flex items-center justify-center shadow-lg">
            <div className="relative w-full h-full bg-slate-900 rounded-2.5xl flex items-center justify-center overflow-hidden border border-emerald-500/10">
              
              {/* Real Webcam Stream Layer */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-500 ${isScanning && streamRef.current ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              />

              {/* Graphic Demo fallback if camera not scanning */}
              {(!isScanning || !streamRef.current) && (
                <div className="relative w-36 h-36 flex flex-col justify-end items-center transition-transform">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 bg-yellow-200/20 rounded-full blur-xl -z-10"></div>
                  <div className="w-16 h-14 bg-red-400 rounded-b-xl relative z-10 shadow-md"></div>
                  <div className="w-20 h-3 bg-red-500 rounded-full absolute bottom-[50px] z-20 shadow-sm"></div>
                  
                  <div className={`absolute bottom-14 left-3 w-9 h-14 rounded-full transform -rotate-[35deg] origin-bottom transition-colors duration-500 shadow-sm ${plantHydration === 'NEEDS_WATER' ? 'bg-orange-400' : 'bg-emerald-400'}`}></div>
                  <div className={`absolute bottom-14 right-3 w-9 h-14 rounded-full transform rotate-[35deg] origin-bottom transition-colors duration-500 shadow-sm ${plantHydration === 'DRY_SOIL' ? 'bg-orange-400' : 'bg-emerald-400'}`}></div>
                  <div className="absolute bottom-[60px] w-8 h-16 bg-emerald-500 rounded-full shadow-sm"></div>
                </div>
              )}

              {/* Viewfinder elements */}
              <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-emerald-400 rounded-tl"></div>
              <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-emerald-400 rounded-tr"></div>
              <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-emerald-400 rounded-bl"></div>
              <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-emerald-400 rounded-br"></div>

              {isScanning && (
                <div className="absolute left-4 right-4 h-0.5 bg-emerald-400 shadow-[0_0_10px_#34d399] rounded-full animate-[scanMove_2.5s_ease-in-out_infinite]"></div>
              )}
            </div>
          </div>

          {/* New "Find My Plant" Species Card */}
          <div className="bg-emerald-50 rounded-3xl p-4 border border-emerald-100 shadow-sm mb-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm text-2xl">
              🪴
            </div>
            <div>
              <div className="inline-flex items-center gap-1 text-emerald-600 font-bold uppercase tracking-widest text-[9px] mb-0.5">
                 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                 Find My Plant
              </div>
              <h3 className={`text-lg font-black tracking-tight ${plantType === 'IDLE' ? 'text-slate-400' : 'text-slate-900'}`}>
                {plantType.replace(/_/g, ' ')}
              </h3>
            </div>
          </div>

          {/* Dashboard Telemetry Grid */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
              <p className={`text-sm font-extrabold truncate ${plantHydration === 'HEALTHY' || plantHydration === 'OPTIMAL' ? 'text-emerald-500' : plantHydration === 'IDLE' ? 'text-slate-400' : 'text-orange-500'}`}>
                {plantHydration.replace(/_/g, ' ')}
              </p>
            </div>
            <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Confidence</p>
              <div className="flex items-center gap-2">
                <p className="text-sm font-extrabold text-slate-900">{confidence}%</p>
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-500 transition-all duration-300" style={{width: `${confidence}%`}}></div>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Last Pumped</p>
              <p className="text-sm font-extrabold text-slate-900">{lastWatered}</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Spike Hub</p>
                <p className="text-xs font-extrabold text-slate-900">{hubConnection}</p>
              </div>
              <div className={`w-2.5 h-2.5 rounded-full ${hubConnection === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2.5 mt-auto">
            <button
              onClick={() => setIsScanning(!isScanning)}
              className={`flex-1 py-4 rounded-[20px] font-bold text-xs text-white transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 ${isScanning ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20'}`}
            >
              <span>{isScanning ? '⏹️' : '🔍'}</span>
              {isScanning ? 'Stop Scan' : 'Start Scan'}
            </button>

            <button
              onClick={triggerWater}
              disabled={hubConnection !== 'CONNECTED' || pumpStatus === 'PUMPING'}
              className="flex-1 py-4 rounded-[20px] font-black text-xs transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-emerald-400/30 bg-emerald-400 hover:bg-emerald-300 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-slate-950"
            >
              <span>💧</span>
              Pump Water
            </button>
          </div>

          {/* Custom Toast Alert */}
          {toast && (
            <div className={`absolute bottom-6 left-6 right-6 px-5 py-3.5 rounded-full flex items-center justify-center shadow-xl animate-[bounce_0.3s_ease-out] z-[100] border ${toast.type === 'success' ? 'bg-emerald-500 border-emerald-400' : toast.type === 'warn' ? 'bg-orange-500 border-orange-400' : 'bg-slate-800 border-slate-700'}`}>
              <span className="text-white text-xs font-extrabold text-center leading-tight">{toast.message}</span>
            </div>
          )}

        </div>
      </div>

      <style>{`
        @keyframes scanMove {
          0%, 100% { top: 16px; }
          50% { top: calc(100% - 20px); }
        }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
