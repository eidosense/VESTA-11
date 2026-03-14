import * as Astronomy from 'astronomy-engine';

// ... interface ve SINGULARITY tanımları aynı kalabilir

export function getMoonData(date: Date = new Date()): MoonData {
  // 1. Hassas Faz Hesaplama
  const illuminationData = Astronomy.Illumination(Astronomy.Body.Moon, date);
  const phaseAngle = Astronomy.MoonPhase(date); // 0-360 derece
  const phase = phaseAngle / 360;

  // 2. Faz İsmi Belirleme (Daha temiz bir yaklaşımla)
  const phaseNames = [
    { name: 'New Moon', limit: 0.0625 },
    { name: 'Waxing Crescent', limit: 0.1875 },
    { name: 'First Quarter', limit: 0.3125 },
    { name: 'Waxing Gibbous', limit: 0.4375 },
    { name: 'Full Moon', limit: 0.5625 },
    { name: 'Waning Gibbous', limit: 0.6875 },
    { name: 'Last Quarter', limit: 0.8125 },
    { name: 'Waning Crescent', limit: 0.9375 },
  ];
  
  const phaseName = phaseNames.find(p => phase < p.limit)?.name || 'New Moon';

  // 3. Gerçek Zodiac Hesaplaması
  // Ay'ın ekliptik boylamını buluyoruz
  const observer = new Astronomy.Observer(0, 0, 0); // Genel hesaplama için merkez
  const equant = Astronomy.Equator(Astronomy.Body.Moon, date, observer, true, true);
  const ecliptic = Astronomy.Ecliptic(equant);
  
  const zodiacSigns = [
    'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 
    'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
  ];
  // Her burç 30 derecedir (360 / 12)
  const signIndex = Math.floor(ecliptic.elon / 30) % 12;
  const zodiacSign = zodiacSigns[signIndex];

  return { 
    phase, 
    phaseName, 
    illumination: illuminationData.phase / 100, // 0-1 arasına çekiyoruz
    zodiacSign 
  };
}