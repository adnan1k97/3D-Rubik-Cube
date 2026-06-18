import React from 'react';
import { Play, Box, Trophy, Grid3X3, ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onStartCampaign: () => void;
  onStartSimulator: () => void;
  visible: boolean;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStartCampaign, onStartSimulator, visible }) => {
  return (
    <div 
      className={`
        absolute inset-0 z-50 flex flex-col items-center justify-center 
        transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)]
        ${visible ? 'opacity-100 backdrop-blur-md bg-black/40' : 'opacity-0 pointer-events-none backdrop-blur-none bg-transparent'}
      `}
    >
      <div className={`
         relative z-10 w-full max-w-5xl px-6 md:px-12
         flex flex-col md:flex-row items-center md:items-stretch justify-center gap-12 md:gap-8
         transition-all duration-1000 delay-100 transform
         ${visible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}
      `}>
        
        {/* Left Section: Title & Intro */}
        <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left space-y-6 pt-4 md:pt-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono tracking-widest text-blue-400 uppercase mb-2 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                v2.0 System Ready
            </div>
            
            <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter leading-[0.9]">
                CUBE <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">MASTER</span>
            </h1>
            
            <p className="text-lg text-white/60 max-w-md font-light leading-relaxed">
                Experience the ultimate 3D puzzle simulator. Master algorithms, solve puzzles, or challenge yourself in campaign mode.
            </p>

            <div className="hidden md:flex items-center gap-6 text-xs font-mono text-white/30 pt-8">
                <div className="flex items-center gap-2">
                    <Box size={14} /> <span>WebGL Powered</span>
                </div>
                 <div className="w-px h-4 bg-white/10" />
                <div className="flex items-center gap-2">
                    <Play size={14} /> <span>Interactive</span>
                </div>
            </div>
        </div>

        {/* Right Section: Mode Selection Cards */}
        <div className="flex-1 w-full max-w-sm md:max-w-none flex flex-col gap-4">
            
            {/* Campaign Card */}
            <button 
                onClick={onStartCampaign}
                className="group relative w-full bg-[#111]/80 backdrop-blur-xl border border-white/10 hover:border-blue-500/50 rounded-2xl p-1 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-blue-900/20"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600/0 via-blue-600/5 to-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative flex items-center gap-5 p-5 bg-[#0a0a0a]/50 rounded-xl h-full">
                    <div className="w-14 h-14 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                        <Trophy size={26} />
                    </div>
                    
                    <div className="flex-1 text-left">
                        <h3 className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors flex items-center gap-2">
                            Campaign Mode 
                            <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-blue-400" />
                        </h3>
                        <p className="text-xs text-white/40 mt-1 font-medium">20 Levels • Progression System</p>
                    </div>
                </div>
            </button>

            {/* Freeplay Card */}
            <button 
                onClick={onStartSimulator}
                className="group relative w-full bg-[#111]/80 backdrop-blur-xl border border-white/10 hover:border-emerald-500/50 rounded-2xl p-1 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-900/20"
            >
                 <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/0 via-emerald-600/5 to-emerald-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative flex items-center gap-5 p-5 bg-[#0a0a0a]/50 rounded-xl h-full">
                    <div className="w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                        <Grid3X3 size={26} />
                    </div>
                    
                    <div className="flex-1 text-left">
                        <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors flex items-center gap-2">
                            Free Simulator
                             <ArrowRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-emerald-400" />
                        </h3>
                        <p className="text-xs text-white/40 mt-1 font-medium">Infinite Shuffle • Speed Timer</p>
                    </div>
                </div>
            </button>
            
            {/* Quick Tip or Stat */}
             <div className="mt-2 px-4 py-3 rounded-xl border border-white/5 bg-white/5 text-center md:text-left">
                <p className="text-[10px] text-white/30 font-mono uppercase tracking-wider mb-1">Daily Tip</p>
                <p className="text-xs text-white/60">Practice orienting corners first to improve speed.</p>
            </div>

        </div>
      </div>
      
      {/* Decorative footer */}
      <div className={`
        absolute bottom-0 w-full p-6 flex justify-between items-end pointer-events-none
        transition-all duration-1000 delay-300
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}>
          <div className="text-[10px] font-mono text-white/20">
             SYSTEM_ID: RBC-3D<br/>
             RENDER: THREE.JS
          </div>
          <div className="h-px w-32 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="text-[10px] font-mono text-white/20 text-right">
             V 1.2.0<br/>
             STABLE
          </div>
      </div>
    </div>
  );
};

export default LandingPage;