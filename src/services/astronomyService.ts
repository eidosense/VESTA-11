import { format, differenceInDays } from 'date-fns';
import Astronomy from 'astronomy-engine';
const phase = Astronomy.MoonPhase(new Date());
export interface MoonData {
  phase: number; // 0 to 1
  phaseName: string;
  illumination: number;
  zodiacSign: string;
}

export const SINGULARITY_DATE = new Date('2026-03-11T20:00:00Z');

// 11.03.2026 Reference Data
export const SINGULARITY_SKY = {
  moonSign: 'Sagittarius',
  moonPhase: 0.75, // Waning Gibbous
  conjunction: 'Saturn-Neptune in Aries',
  isFireSign: true // Sagittarius is Fire
};

export function getMoonData(date: Date = new Date()): MoonData {
  const phase = Astronomy.MoonPhase(date) / 360; // Convert degrees to 0-1
  
  let phaseName = '';
  if (phase < 0.0625 || phase > 0.9375) phaseName = 'New Moon';
  else if (phase < 0.1875) phaseName = 'Waxing Crescent';
  else if (phase < 0.3125) phaseName = 'First Quarter';
  else if (phase < 0.4375) phaseName = 'Waxing Gibbous';
  else if (phase < 0.5625) phaseName = 'Full Moon';
  else if (phase < 0.6875) phaseName = 'Waning Gibbous';
  else if (phase < 0.8125) phaseName = 'Last Quarter';
  else phaseName = 'Waning Crescent';

  // Illumination
  const illumination = (1 - Math.cos(phase * 2 * Math.PI)) / 2;

  // Simple Zodiac calculation (approximate)
  const zodiacSigns = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
  ];
  // Moon travels ~13.2 degrees per day. 
  // This is a simplified approximation for the "vibe"
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const signIndex = Math.floor((dayOfYear + (phase * 29.5)) % 12);
  const zodiacSign = zodiacSigns[signIndex];

  return { phase, phaseName, illumination, zodiacSign };
}

export function checkCosmicResonance(currentMoon: MoonData): { active: boolean, message: string } {
  const fireSigns = ['Aries', 'Leo', 'Sagittarius'];
  const isFire = fireSigns.includes(currentMoon.zodiacSign);
  
  if (isFire) {
    return {
      active: true,
      message: "Sync Alert: Cosmic resonance detected. The stars are mirroring the Singularity."
    };
  }
  
  return { active: false, message: "" };
}

export function getEmotionalDistance(currentDate: Date = new Date()): string {
  const diff = currentDate.getTime() - SINGULARITY_DATE.getTime();
  const days = Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
  const direction = diff > 0 ? "post-singularity" : "pre-singularity";
  
  if (days === 0) return "Zero Point: The Singularity is Now";
  return `${days} light-days ${direction} orbit`;
}

export async function getSkyContext(currentDate: Date = new Date()) {
  try {
    const response = await fetch('/api/celestial-sync');
    if (response.ok) {
      const data = await response.json();
      return {
        current: {
          phase: data.now.moonPhase,
          illumination: `${(data.now.illumination * 100).toFixed(0)}%`,
          resonance: {
            active: data.isAligned,
            message: data.message
          }
        },
        singularity: SINGULARITY_SKY
      };
    }
  } catch (e) {
    console.error("Failed to fetch celestial sync, falling back to local calculation", e);
  }

  const moon = getMoonData(currentDate);
  const resonance = checkCosmicResonance(moon);
  return {
    current: {
      phase: moon.phaseName,
      illumination: `${(moon.illumination * 100).toFixed(0)}%`,
      zodiac: moon.zodiacSign,
      resonance
    },
    singularity: SINGULARITY_SKY
  };
}
