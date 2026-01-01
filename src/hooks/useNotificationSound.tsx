import { useCallback, useRef, useEffect, useState } from 'react';

type SoundType = 'success' | 'message' | 'warning' | 'urgent';

interface NotificationSoundSettings {
  enabled: boolean;
  volume: number;
}

const STORAGE_KEY = 'notification_sound_settings';

const DEFAULT_SETTINGS: NotificationSoundSettings = {
  enabled: true,
  volume: 0.5,
};

// Sound frequencies and patterns for different notification types
const SOUND_CONFIGS: Record<SoundType, { frequencies: number[]; durations: number[]; type: OscillatorType }> = {
  success: {
    frequencies: [523.25, 659.25, 783.99], // C5, E5, G5 - pleasant major chord arpeggio
    durations: [100, 100, 150],
    type: 'sine',
  },
  message: {
    frequencies: [440, 554.37], // A4, C#5 - gentle two-tone
    durations: [80, 120],
    type: 'sine',
  },
  warning: {
    frequencies: [392, 349.23, 392], // G4, F4, G4 - attention-getting
    durations: [120, 120, 150],
    type: 'triangle',
  },
  urgent: {
    frequencies: [523.25, 392, 523.25, 392], // C5, G4 alternating - urgent pulse
    durations: [100, 100, 100, 150],
    type: 'square',
  },
};

// Map notification types from the database to sound types
export const mapNotificationTypeToSound = (notificationType: string): SoundType | null => {
  const typeMap: Record<string, SoundType> = {
    // Buyer sounds
    'document_submitted': 'success',
    'document_uploaded': 'success',
    'new_document': 'success',
    
    // Support sounds
    'ticket_response': 'message',
    'support_response': 'message',
    'ticket_update': 'message',
    
    // Warning sounds (supplier)
    'document_expiry_expires_soon': 'warning',
    'document_expiring': 'warning',
    'expiry_warning': 'warning',
    
    // Urgent sounds (supplier)
    'document_expiry_urgent': 'urgent',
    'document_expiry_overdue': 'urgent',
    'document_overdue': 'urgent',
    'urgent': 'urgent',
  };
  
  return typeMap[notificationType] || null;
};

export const useNotificationSound = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [settings, setSettings] = useState<NotificationSoundSettings>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Initialize audio context on first user interaction
  const unlockAudio = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    setIsUnlocked(true);
  }, []);

  // Add click listener to unlock audio
  useEffect(() => {
    const handleInteraction = () => {
      unlockAudio();
      // Remove listeners after first interaction
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };

    document.addEventListener('click', handleInteraction);
    document.addEventListener('keydown', handleInteraction);

    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, [unlockAudio]);

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage errors
    }
  }, [settings]);

  const playTone = useCallback((
    frequency: number,
    duration: number,
    type: OscillatorType,
    startTime: number,
    volume: number
  ) => {
    if (!audioContextRef.current) return;

    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    // Envelope for smooth sound
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume * 0.3, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration / 1000);

    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration / 1000);
  }, []);

  const playSound = useCallback((soundType: SoundType) => {
    if (!settings.enabled) return;
    
    // Ensure audio context exists
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Resume if suspended
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const config = SOUND_CONFIGS[soundType];
    if (!config) return;

    const now = audioContextRef.current.currentTime;
    let currentTime = now;

    config.frequencies.forEach((freq, index) => {
      playTone(freq, config.durations[index], config.type, currentTime, settings.volume);
      currentTime += config.durations[index] / 1000;
    });
  }, [settings.enabled, settings.volume, playTone]);

  const playNotificationSound = useCallback((notificationType: string) => {
    const soundType = mapNotificationTypeToSound(notificationType);
    if (soundType) {
      playSound(soundType);
    }
  }, [playSound]);

  const toggleEnabled = useCallback(() => {
    setSettings(prev => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setSettings(prev => ({ ...prev, volume: Math.max(0, Math.min(1, volume)) }));
  }, []);

  const setEnabled = useCallback((enabled: boolean) => {
    setSettings(prev => ({ ...prev, enabled }));
  }, []);

  const testSound = useCallback((soundType: SoundType = 'message') => {
    // Force play even if disabled for testing
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    
    const config = SOUND_CONFIGS[soundType];
    const now = audioContextRef.current.currentTime;
    let currentTime = now;

    config.frequencies.forEach((freq, index) => {
      playTone(freq, config.durations[index], config.type, currentTime, settings.volume);
      currentTime += config.durations[index] / 1000;
    });
  }, [settings.volume, playTone]);

  return {
    playSound,
    playNotificationSound,
    toggleEnabled,
    setVolume,
    setEnabled,
    testSound,
    isEnabled: settings.enabled,
    volume: settings.volume,
    isUnlocked,
  };
};
