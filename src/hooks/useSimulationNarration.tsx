import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getNarration } from '@/data/simulationNarrations';

interface UseSimulationNarrationReturn {
  isPlaying: boolean;
  isLoading: boolean;
  isMuted: boolean;
  currentStep: string | null;
  playNarration: (step: string) => Promise<void>;
  pauseNarration: () => void;
  resumeNarration: () => void;
  stopNarration: () => void;
  toggleMute: () => void;
  replayCurrentNarration: () => void;
}

export const useSimulationNarration = (): UseSimulationNarrationReturn => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    const stored = localStorage.getItem('simulation-narration-muted');
    return stored === 'true';
  });
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<Map<string, string>>(new Map());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      // Revoke all cached blob URLs
      audioCache.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      audioCache.current.clear();
    };
  }, []);

  const fetchAudio = useCallback(async (text: string): Promise<string> => {
    // Check cache first
    const cacheKey = text.substring(0, 50);
    if (audioCache.current.has(cacheKey)) {
      return audioCache.current.get(cacheKey)!;
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ text }),
      }
    );

    if (!response.ok) {
      throw new Error(`TTS request failed: ${response.status}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    // Cache the URL
    audioCache.current.set(cacheKey, audioUrl);
    
    return audioUrl;
  }, []);

  const playNarration = useCallback(async (step: string) => {
    if (isMuted) return;

    const text = getNarration(step);
    if (!text) {
      console.warn(`No narration found for step: ${step}`);
      return;
    }

    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setCurrentStep(step);
    setIsLoading(true);

    try {
      const audioUrl = await fetchAudio(text);
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
      };

      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setIsPlaying(false);
      };

      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing narration:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isMuted, fetchAudio]);

  const pauseNarration = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const resumeNarration = useCallback(() => {
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  const stopNarration = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
      setIsPlaying(false);
      setCurrentStep(null);
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const newValue = !prev;
      localStorage.setItem('simulation-narration-muted', String(newValue));
      
      // If unmuting, don't auto-play
      // If muting, stop current playback
      if (newValue && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      
      return newValue;
    });
  }, []);

  const replayCurrentNarration = useCallback(() => {
    if (currentStep) {
      // Reset and replay
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
        setIsPlaying(true);
      } else {
        playNarration(currentStep);
      }
    }
  }, [currentStep, playNarration]);

  return {
    isPlaying,
    isLoading,
    isMuted,
    currentStep,
    playNarration,
    pauseNarration,
    resumeNarration,
    stopNarration,
    toggleMute,
    replayCurrentNarration,
  };
};
