import React, { useEffect, useState } from 'react';
import { Lock, Star, ArrowLeft, Trophy, Play, Loader2 } from 'lucide-react';
import { useWriteContract, useAccount } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { config } from '../lib/wagmi';
import { CUBE_MASTER_ABI, CUBE_MASTER_ADDRESS, FEE_AMOUNT } from '../lib/contract';

const CAMPAIGN_KEY = 'rubiks-campaign-progress-v1';
const MAX_LEVELS = 20;

interface LevelSelectorProps {
  onSelectLevel: (level: number) => void;
  onBack: () => void;
  visible: boolean;
}

const getPhaseInfo = (level: number) => {
    if (level <= 3) return { name: "Novice", color: "text-[#3b82f6]", border: "border-[#0045ad]", shadowHex: "rgba(0,69,173,0.5)", bg: "bg-[#0045ad]/40" };
    if (level <= 8) return { name: "Apprentice", color: "text-[#34d399]", border: "border-[#009e60]", shadowHex: "rgba(0,158,96,0.5)", bg: "bg-[#009e60]/40" };
    if (level <= 15) return { name: "Expert", color: "text-[#ff9d00]", border: "border-[#ff5900]", shadowHex: "rgba(255,89,0,0.5)", bg: "bg-[#ff5900]/40" };
    return { name: "Grand Master", color: "text-[#ef4444]", border: "border-[#b90000]", shadowHex: "rgba(185,0,0,0.5)", bg: "bg-[#b90000]/40" };
};

const LevelSelector: React.FC<LevelSelectorProps> = ({ onSelectLevel, onBack, visible }) => {
  const [maxLevel, setMaxLevel] = useState(1);
  const [pendingLevel, setPendingLevel] = useState<number | null>(null);
  const { writeContractAsync } = useWriteContract();
  const { isConnected } = useAccount();

  const handleSelectLevel = async (level: number) => {
      // Local development fallback
      if (CUBE_MASTER_ADDRESS === "0x0000000000000000000000000000000000000000") {
          console.warn("Dev Mode: Bypassing Web3 Transaction (Contract not deployed)");
          onSelectLevel(level);
          return;
      }

      if (!isConnected) {
          alert("Please connect your wallet from the home screen first!");
          return;
      }

      try {
          setPendingLevel(level);
          const hash = await writeContractAsync({
              address: CUBE_MASTER_ADDRESS,
              abi: CUBE_MASTER_ABI,
              functionName: 'playLevel',
              value: FEE_AMOUNT,
          });
          
          await waitForTransactionReceipt(config, { hash });
          
          onSelectLevel(level);
      } catch (error) {
          console.error("Transaction failed", error);
      } finally {
          setPendingLevel(null);
      }
  };

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
        absolute inset-0 z-50 flex flex-col items-center justify-start pt-16 md:pt-20 pb-10 px-4 md:px-0
        transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)] overflow-y-auto overflow-x-hidden
        ${visible ? 'opacity-100 pointer-events-auto backdrop-blur-2xl bg-black/60' : 'opacity-0 pointer-events-none backdrop-blur-none bg-transparent'}
      `}
    >
      {/* Vibrant Background Orbs representing Rubik's Cube Colors */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
         <div className="absolute top-[20%] left-[5%] w-[35rem] h-[35rem] bg-[#0045ad]/20 rounded-full blur-[120px] animate-pulse" />
         <div className="absolute top-[60%] right-[5%] w-[30rem] h-[30rem] bg-[#ff5900]/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
         <div className="absolute bottom-[5%] left-[25%] w-[40rem] h-[40rem] bg-[#009e60]/20 rounded-full blur-[130px] animate-pulse" style={{ animationDelay: '2s' }} />
         <div className="absolute -top-[10%] right-[25%] w-[25rem] h-[25rem] bg-[#b90000]/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>

        {/* Header */}
        <div className="w-full max-w-5xl flex items-center justify-between mb-12">
            <button 
                onClick={onBack}
                className="flex items-center gap-3 text-white/60 hover:text-white transition-colors group z-10"
            >
                <div className="p-3 rounded-2xl bg-black/60 backdrop-blur-xl group-hover:bg-[#b90000] border-2 border-white/10 group-hover:border-[#b90000] transition-all duration-300 shadow-lg group-hover:shadow-[0_0_25px_rgba(185,0,0,0.6)]">
                    <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                </div>
                <span className="text-sm font-black tracking-widest uppercase hidden md:block">BACK</span>
            </button>
            
            <div className="text-center z-10">
                <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter drop-shadow-2xl">
                    CAMPAIGN <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ffd500] to-[#ff5900]">MAP</span>
                </h2>
                <div className="inline-flex items-center gap-2 px-4 py-1.5 mt-3 rounded-full bg-white/5 border border-white/10 text-xs font-black tracking-widest text-white/80 uppercase shadow-inner">
                    PROGRESS: <span className="text-white">{Math.min(maxLevel, MAX_LEVELS)} / {MAX_LEVELS}</span>
                </div>
            </div>

            <div className="w-16 md:w-32" /> {/* Spacer for centering */}
        </div>

        {/* Levels Grid */}
        <div className="w-full max-w-5xl grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 z-10 pb-12">
            {Array.from({ length: MAX_LEVELS }, (_, i) => i + 1).map((level) => {
                const isLocked = level > maxLevel;
                const isCompleted = level < maxLevel;
                const isCurrent = level === maxLevel;
                const phase = getPhaseInfo(level);
                
                return (
                    <button
                        key={level}
                        onClick={() => !isLocked && handleSelectLevel(level)}
                        disabled={isLocked || pendingLevel !== null}
                        className={`
                            relative aspect-square rounded-3xl border-4 flex flex-col items-center justify-center gap-3
                            transition-all duration-500 group overflow-hidden
                            ${isLocked 
                                ? 'bg-black/60 border-[#111] shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] text-white/20 cursor-not-allowed' 
                                : `bg-black/80 ${phase.border} backdrop-blur-xl ${isCurrent ? 'scale-105 z-10' : 'hover:-translate-y-2 hover:scale-105 hover:z-20'}`
                            }
                        `}
                        style={!isLocked ? { boxShadow: `inset 0 0 30px rgba(0,0,0,0.8), 0 15px 30px ${phase.shadowHex}` } : {}}
                    >
                         {/* Phase Background Glow */}
                         {!isLocked && (
                             <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${phase.bg} blur-2xl`} />
                         )}

                         {/* Status Icon */}
                         <div className={`
                            w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black shadow-xl z-10 transition-transform duration-500 group-hover:scale-110
                            ${isLocked 
                                ? 'bg-[#111] text-white/10 border-2 border-white/5' 
                                : isCompleted 
                                    ? 'bg-[#ffd500] text-black border-4 border-[#ff5900] shadow-[0_0_20px_rgba(255,213,0,0.6)]' 
                                    : 'bg-white text-black border-4 border-gray-300 shadow-[0_0_25px_rgba(255,255,255,0.8)] animate-pulse'
                            }
                         `}>
                             {pendingLevel === level ? (
                                 <Loader2 size={24} className="animate-spin text-white" />
                             ) : isLocked ? (
                                 <Lock size={20} />
                             ) : (
                                 isCompleted ? <Star size={24} fill="currentColor" /> : level
                             )}
                         </div>

                         {/* Label */}
                         <div className="text-center z-10 mt-1">
                             {pendingLevel === level ? (
                                 <span className="text-[11px] font-black tracking-widest text-white uppercase animate-pulse">PROCESSING...</span>
                             ) : isLocked ? (
                                 <span className="text-[11px] font-black tracking-widest opacity-30 uppercase">LOCKED</span>
                             ) : (
                                 <>
                                    <span className={`text-xs font-black uppercase tracking-widest block drop-shadow-lg ${phase.color}`}>{phase.name}</span>
                                    {isCurrent && (
                                        <span className="text-[10px] text-white font-black mt-2 inline-flex items-center justify-center gap-1.5 bg-white/20 px-3 py-1 rounded-full backdrop-blur-md shadow-inner border border-white/20">
                                            <Play size={10} fill="currentColor"/> CURRENT
                                        </span>
                                    )}
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