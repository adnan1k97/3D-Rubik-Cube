import React from 'react';
import { Trophy, Grid3X3, Pin } from 'lucide-react';
import { Wallet, ConnectWallet, WalletDropdown, WalletDropdownDisconnect } from '@coinbase/onchainkit/wallet';
import { Address, Avatar, Name, Identity } from '@coinbase/onchainkit/identity';

interface LandingPageProps {
  onStartCampaign: () => void;
  onStartSimulator: () => void;
  visible: boolean;
}

const LandingPage: React.FC<LandingPageProps> = ({ onStartCampaign, onStartSimulator, visible }) => {
  return (
    <div 
      className={`
        absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden
        transition-all duration-700 ease-[cubic-bezier(0.25,0.1,0.25,1)]
        ${visible ? 'opacity-100 backdrop-blur-2xl bg-black/40' : 'opacity-0 pointer-events-none backdrop-blur-none bg-transparent'}
      `}
    >
      {/* Vibrant Background Orbs representing Rubik's Cube Colors */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
         <div className="absolute top-[10%] left-[10%] w-96 h-96 bg-[#b90000]/30 rounded-full blur-[100px] animate-pulse" />
         <div className="absolute top-[30%] right-[5%] w-[35rem] h-[35rem] bg-[#0045ad]/30 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
         <div className="absolute bottom-[5%] left-[20%] w-[30rem] h-[30rem] bg-[#ffd500]/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
         <div className="absolute bottom-[20%] right-[20%] w-80 h-80 bg-[#009e60]/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1.5s' }} />
         <div className="absolute -top-[5%] right-[30%] w-96 h-96 bg-[#ff5900]/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>

      <div className={`
         relative z-10 w-full max-w-5xl px-4 md:px-12
         flex flex-col items-center justify-center gap-16
         transition-all duration-1000 delay-100 transform
         ${visible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-12 opacity-0 scale-95'}
      `}>
        
        {/* Title */}
        <div className="flex flex-col items-center text-center mt-8">
            {/* 3D Rubik's Cube Theme Letters */}
            <div className="flex gap-3 md:gap-5 mb-2">
                <div className="w-20 h-20 md:w-32 md:h-32 bg-[#b90000] rounded-2xl border-4 md:border-8 border-[#111] shadow-[inset_0_0_20px_rgba(0,0,0,0.6),0_15px_30px_rgba(185,0,0,0.5)] flex items-center justify-center transform -rotate-6 hover:rotate-0 hover:scale-110 transition-all duration-300">
                    <span className="text-5xl md:text-7xl font-black text-white drop-shadow-lg">C</span>
                </div>
                <div className="w-20 h-20 md:w-32 md:h-32 bg-[#0045ad] rounded-2xl border-4 md:border-8 border-[#111] shadow-[inset_0_0_20px_rgba(0,0,0,0.6),0_15px_30px_rgba(0,69,173,0.5)] flex items-center justify-center transform translate-y-4 hover:translate-y-0 hover:scale-110 transition-all duration-300">
                    <span className="text-5xl md:text-7xl font-black text-white drop-shadow-lg">U</span>
                </div>
                <div className="w-20 h-20 md:w-32 md:h-32 bg-[#ffd500] rounded-2xl border-4 md:border-8 border-[#111] shadow-[inset_0_0_20px_rgba(0,0,0,0.4),0_15px_30px_rgba(255,213,0,0.5)] flex items-center justify-center transform rotate-6 hover:rotate-0 hover:scale-110 transition-all duration-300">
                    <span className="text-5xl md:text-7xl font-black text-black drop-shadow-md">B</span>
                </div>
                <div className="w-20 h-20 md:w-32 md:h-32 bg-[#009e60] rounded-2xl border-4 md:border-8 border-[#111] shadow-[inset_0_0_20px_rgba(0,0,0,0.6),0_15px_30px_rgba(0,158,96,0.5)] flex items-center justify-center transform -translate-y-2 hover:translate-y-0 hover:scale-110 transition-all duration-300">
                    <span className="text-5xl md:text-7xl font-black text-white drop-shadow-lg">E</span>
                </div>
            </div>
            <h2 className="text-3xl md:text-5xl font-black mt-8 text-white tracking-[0.4em] uppercase drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                MASTER
            </h2>
        </div>

        {/* Buttons */}
        <div className="w-full max-w-lg flex flex-col gap-6 px-4">
            
            {/* Campaign Card */}
            <button 
                onClick={onStartCampaign}
                className="group relative w-full rounded-3xl p-1 overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_0_50px_rgba(255,89,0,0.5)] cursor-pointer"
            >
                <div className="absolute inset-0 bg-gradient-to-br from-[#b90000] via-[#ff5900] to-[#ffd500] opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative flex items-center justify-center gap-5 p-6 md:p-8 bg-black/90 backdrop-blur-2xl rounded-[1.35rem] h-full group-hover:bg-black/70 transition-colors">
                    <Trophy size={32} className="text-[#ffd500] group-hover:scale-125 transition-transform duration-300 drop-shadow-[0_0_15px_rgba(255,213,0,0.6)]" />
                    <span className="text-xl md:text-2xl font-black text-white uppercase tracking-widest drop-shadow-md">
                        Campaign Mode 
                    </span>
                </div>
            </button>

            {/* Freeplay Card */}
            <button 
                onClick={onStartSimulator}
                className="group relative w-full rounded-3xl p-1 overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_0_50px_rgba(0,69,173,0.5)] cursor-pointer"
            >
                 <div className="absolute inset-0 bg-gradient-to-br from-[#0045ad] via-[#009e60] to-cyan-500 opacity-80 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative flex items-center justify-center gap-5 p-6 md:p-8 bg-black/90 backdrop-blur-2xl rounded-[1.35rem] h-full group-hover:bg-black/70 transition-colors">
                    <Grid3X3 size={32} className="text-cyan-400 group-hover:scale-125 group-hover:rotate-90 transition-transform duration-500 drop-shadow-[0_0_15px_rgba(34,211,238,0.6)]" />
                    <span className="text-xl md:text-2xl font-black text-white uppercase tracking-widest drop-shadow-md">
                        Free Simulator
                    </span>
                </div>
            </button>
            
            {/* Wallet Connect Bar */}
            <div className="mt-4 flex flex-col items-center gap-4 w-full">
               <Wallet>
                 <ConnectWallet text="Connect Wallet" className="w-full max-w-[240px] bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl py-3 px-6 transition-colors shadow-[0_0_15px_rgba(37,99,235,0.5)]">
                    <Avatar className="h-6 w-6" />
                    <Name />
                 </ConnectWallet>
                 <WalletDropdown>
                   <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                     <Avatar />
                     <Name />
                     <Address />
                   </Identity>
                   <WalletDropdownDisconnect />
                 </WalletDropdown>
               </Wallet>

               <div className="flex items-center gap-2 text-white/70 text-xs font-medium bg-white/5 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
                   <Pin size={14} className="text-blue-400" />
                   <span>Tip: Pin this app in your Base/Coinbase Wallet for easy access!</span>
               </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default LandingPage;