import React, { useEffect, useState } from 'react';
import { Lock, Star, ArrowLeft, Trophy, Play } from 'lucide-react';

const CAMPAIGN_KEY = 'rubiks-campaign-progress-v1';
const MAX_LEVELS = 20;

interface LevelSelectorProps {
  onSelectLevel: (level: number) => void;
  onBack: () => void;
  visible: boolean;
}

const getPhaseInfo = (level: number) => {
    if (level <= 3) return { name: "Novice", color: "text-blue-400", border: "border-blue-500/30", bg: "bg-blue-500/10" };
    if (level <= 8) return { name: "Apprentice", color: "text-green-400", border: "border-green-500/30", bg: "bg-green-500/10" };
    if (level <= 15) return { name: "Expert", color: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-500/10" };
    return { name: "Grand Master", color: "text-red-500", border: "border-red-500/30", bg: "bg-red-500/10" };
};

const LevelSelector: React.FC<LevelSelectorProps> = ({ onSelectLevel, onBack, visible }) => {
  const [maxLevel, setMaxLevel] = useState(1);

  useEffect(() => {
    if (visible) {
        const saved = localStorage.getItem(CAMPAIGN_KEY);
        if (saved) {
            setMaxLevel(parseInt(saved, 10));
        }
    }
  }, [visible]);

  return (
    <div 
      className={`
        absolute inset-0 z-50 flex flex-col items-center justify-start pt-20 pb-10
        transition-all duration-500 ease-in-out bg-black/80 backdrop-blur-xl overflow-y-auto
        ${visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
      `}
    >
        {/* Header */}
        <div className="w-full max-w-4xl px-6 flex items-center justify-between mb-8">
            <button 
                onClick={onBack}
                className="flex items-center gap-2 text-white/60 hover:text-white transition-colors group"
            >
                <div className="p-2 rounded-full bg-white/5 group-hover:bg-white/10 border border-white/5 transition-all">
                    <ArrowLeft size={20} />
                </div>
                <span className="text-sm font-bold tracking-wider">BACK</span>
            </button>
            
            <div className="text-center">
                <h2 className="text-3xl font-black text-white tracking-tighter">CAMPAIGN <span className="text-blue-500">MAP</span></h2>
                <p className="text-xs text-white/40 font-mono mt-1">PROGRESS: {Math.min(maxLevel, MAX_LEVELS)} / {MAX_LEVELS}</p>
            </div>

            <div className="w-24" /> {/* Spacer for centering */}
        </div>

        {/* Levels Grid */}
        <div className="w-full max-w-4xl px-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: MAX_LEVELS }, (_, i) => i + 1).map((level) => {
                const isLocked = level > maxLevel;
                const isCompleted = level < maxLevel;
                const isCurrent = level === maxLevel;
                const phase = getPhaseInfo(level);
                
                return (
                    <button
                        key={level}
                        onClick={() => !isLocked && onSelectLevel(level)}
                        disabled={isLocked}
                        className={`
                            relative aspect-square rounded-2xl border flex flex-col items-center justify-center gap-2
                            transition-all duration-300 group
                            ${isLocked 
                                ? 'bg-white/5 border-white/5 text-white/20 cursor-not-allowed' 
                                : `bg-[#0a0a0a] ${phase.border} ${isCurrent ? 'ring-2 ring-white/20 shadow-2xl scale-105 z-10' : 'hover:border-white/40 hover:bg-white/5'}`
                            }
                        `}
                    >
                         {/* Phase Background Glow */}
                         {!isLocked && (
                             <div className={`absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500 ${phase.bg} blur-xl`} />
                         )}

                         {/* Status Icon */}
                         <div className={`
                            w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold shadow-lg
                            ${isLocked 
                                ? 'bg-black/40 text-white/20' 
                                : isCompleted 
                                    ? 'bg-green-500 text-black' 
                                    : 'bg-white text-black'
                            }
                         `}>
                             {isLocked ? <Lock size={14} /> : (isCompleted ? <Star size={16} fill="currentColor" /> : level)}
                         </div>

                         {/* Label */}
                         <div className="text-center z-10">
                             {isLocked ? (
                                 <span className="text-[10px] font-bold tracking-widest opacity-40">LOCKED</span>
                             ) : (
                                 <>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider block ${phase.color}`}>{phase.name}</span>
                                    {isCurrent && <span className="text-[9px] text-white/60 font-mono mt-1 flex items-center justify-center gap-1 animate-pulse"><Play size={8} fill="currentColor"/> CURRENT</span>}
                                 </>
                             )}
                         </div>
                    </button>
                );
            })}
        </div>
    </div>
  );
};

export default LevelSelector;