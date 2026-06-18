import React, { useState } from 'react';
import RubiksCube from './components/RubiksCube';
import LandingPage from './components/LandingPage';
import LevelSelector from './components/LevelSelector';

type GameMode = 'campaign' | 'freeplay';
type ViewState = 'landing' | 'levels' | 'game';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('landing');
  const [gameMode, setGameMode] = useState<GameMode>('freeplay');
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  
  // Transition state: 'idle' | 'out' (fading to black) | 'in' (fading from black)
  const [transitionStage, setTransitionStage] = useState<'idle' | 'out' | 'in'>('idle');

  const executeTransition = (updateState: () => void) => {
    setTransitionStage('out');
    
    // Wait for fade out to black (500ms)
    setTimeout(() => {
        updateState();
        
        // Small delay to ensure React renders the new state behind the curtain
        setTimeout(() => {
            setTransitionStage('in');
            
            // Wait for fade in from black (500ms) to complete
            setTimeout(() => {
                setTransitionStage('idle');
            }, 500);
        }, 50);
    }, 500);
  };

  const handleOpenCampaign = () => {
    executeTransition(() => {
        setView('levels');
    });
  };

  const handleStartLevel = (level: number) => {
      executeTransition(() => {
          setSelectedLevel(level);
          setGameMode('campaign');
          setView('game');
      });
  };

  const handleStartSimulator = () => {
    executeTransition(() => {
        setGameMode('freeplay');
        setView('game');
    });
  };

  const handleBackToLanding = () => {
    executeTransition(() => {
        setView('landing');
    });
  };

  const handleGameHome = () => {
      if (gameMode === 'campaign') {
        executeTransition(() => {
            setView('levels');
        });
      } else {
        executeTransition(() => {
            setView('landing');
        });
      }
  };

  return (
    <div className="w-full h-screen text-white overflow-hidden relative font-sans">
      {/* 
        The RubiksCube component is always mounted but interacts based on props.
        We unmount it when not in 'game' view to reset its internal state cleanly or keep it lighter.
        However, for smoother transitions, keeping it mounted is often better, but let's 
        only render it when needed to ensure fresh state on level start.
      */}
      {view === 'game' && (
        <RubiksCube 
            isGameActive={true} 
            initialMode={gameMode}
            startingLevel={gameMode === 'campaign' ? selectedLevel : undefined}
            onHome={handleGameHome}
        />
      )}
      
      {/* Background Cube (Visual only) for menus if desired, or just use CSS bg */}
      {view !== 'game' && (
         <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#2b2b2b_0%,#050505_100%)] z-0" />
      )}

      <LevelSelector 
        visible={view === 'levels'}
        onSelectLevel={handleStartLevel}
        onBack={handleBackToLanding}
      />
      
      <LandingPage 
        onStartCampaign={handleOpenCampaign}
        onStartSimulator={handleStartSimulator}
        visible={view === 'landing'} 
      />

      {/* Transition Veil */}
      <div 
        className={`
            absolute inset-0 bg-black z-[100] pointer-events-none
            transition-opacity duration-500 ease-in-out
            ${transitionStage === 'out' ? 'opacity-100' : 'opacity-0'}
        `}
      />
    </div>
  );
};

export default App;