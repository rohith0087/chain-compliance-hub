import React from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX, Play, Pause, RotateCcw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SimulationNarrationControlsProps {
  isPlaying: boolean;
  isLoading: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onPlayPause: () => void;
  onReplay: () => void;
}

export const SimulationNarrationControls: React.FC<SimulationNarrationControlsProps> = ({
  isPlaying,
  isLoading,
  isMuted,
  onToggleMute,
  onPlayPause,
  onReplay,
}) => {
  return (
    <TooltipProvider>
      <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2 bg-background/95 backdrop-blur-sm border rounded-full px-3 py-2 shadow-lg">
        {/* Mute/Unmute Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 rounded-full",
                isMuted && "text-muted-foreground"
              )}
              onClick={onToggleMute}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>{isMuted ? 'Enable voice guidance' : 'Mute voice guidance'}</p>
          </TooltipContent>
        </Tooltip>

        {/* Play/Pause Button */}
        {!isMuted && (
          <>
            <div className="w-px h-4 bg-border" />
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={onPlayPause}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{isLoading ? 'Loading...' : isPlaying ? 'Pause' : 'Play'}</p>
              </TooltipContent>
            </Tooltip>

            {/* Replay Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={onReplay}
                  disabled={isLoading}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Replay narration</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}

        {/* Playing indicator */}
        {isPlaying && !isMuted && (
          <div className="flex items-center gap-1 ml-1">
            <span className="flex gap-0.5">
              {[...Array(3)].map((_, i) => (
                <span
                  key={i}
                  className="w-0.5 bg-primary rounded-full animate-pulse"
                  style={{
                    height: `${8 + Math.random() * 8}px`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
