import React from 'react';
import { ChevronLeft, ChevronRight, Play, Pause, BrainCircuit, Volume2 } from 'lucide-react';
import { Button } from './Button';

interface ControlsProps {
  currentIndex: number;
  totalLength: number;
  isPlaying: boolean;
  isAnalyzing: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (index: number) => void;
  onTogglePlay: () => void;
  onAnalyze: () => void;
  hasAnalysis: boolean;
}

export const Controls: React.FC<ControlsProps> = ({
  currentIndex,
  totalLength,
  isPlaying,
  isAnalyzing,
  onPrev,
  onNext,
  onSeek,
  onTogglePlay,
  onAnalyze,
  hasAnalysis
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-950/90 backdrop-blur-md border-t border-gray-800 flex flex-col gap-4 z-50">
      
      {/* Slider */}
      <div className="flex items-center gap-4 w-full max-w-4xl mx-auto text-xs text-gray-400">
        <span>1</span>
        <input
          type="range"
          min={0}
          max={totalLength - 1}
          value={currentIndex}
          onChange={(e) => onSeek(parseInt(e.target.value))}
          className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
        />
        <span>{totalLength}</span>
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-center gap-4">
        
        <Button 
          variant="secondary" 
          onClick={onPrev} 
          disabled={currentIndex === 0}
          aria-label="Previous Page"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-gray-400 w-16 text-center">
                {currentIndex + 1} / {totalLength}
            </span>
        </div>

        <Button 
          variant="secondary" 
          onClick={onNext} 
          disabled={currentIndex === totalLength - 1}
          aria-label="Next Page"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>

        <div className="w-px h-8 bg-gray-800 mx-2" />

        <Button 
            variant={isPlaying ? "danger" : "primary"}
            onClick={onTogglePlay}
            title="Auto-Read Mode (TTS + Auto-Advance)"
            className="min-w-[140px]"
        >
            {isPlaying ? <Pause className="w-5 h-5 mr-2" /> : <Play className="w-5 h-5 mr-2" />}
            {isPlaying ? "Stop Auto-Read" : "Start Auto-Read"}
        </Button>

        {!isPlaying && (
            <Button
                variant={hasAnalysis ? "ghost" : "secondary"}
                onClick={onAnalyze}
                disabled={isAnalyzing}
                className={hasAnalysis ? "text-green-400" : ""}
                title="Manually Analyze (Single Page)"
            >
                <BrainCircuit className={`w-5 h-5 mr-2 ${isAnalyzing ? 'animate-pulse text-indigo-400' : ''}`} />
                {isAnalyzing ? "Processing..." : "Extract Text"}
            </Button>
        )}

      </div>
    </div>
  );
};
