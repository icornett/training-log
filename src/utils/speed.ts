const KPH_PER_MPH = 1.60934

export const mphToKph = (mph: number): number => mph * KPH_PER_MPH

export const kphToMph = (kph: number): number => kph / KPH_PER_MPH
