// lib/subregionFlags.ts — flag in public/flags/ per subregion (tournament.subregion / teams.subregion),
// compared without case or spaces. Safe to import from client components.
const SUBREGION_FLAGS: Record<string, string> = {
  brazil: 'br', china: 'cn', europe: 'eu', japan: 'jp', korea: 'kr', mena: 'mena', northamerica: 'na',
  latamnorth: 'latamnorth', latamsouth: 'latamsouth', latamnorthsouth: 'latamnorthsouth', latam: 'latamnorthsouth',
  sea: 'sea', southeastasia: 'sea', turkey: 'turrkiye', turkiye: 'turrkiye', türkiye: 'turrkiye',
};
export const subregionFlagFile = (subregion: string | null | undefined): string | null => {
  const file = subregion && SUBREGION_FLAGS[subregion.toLowerCase().replace(/[^a-zü]/g, '')];
  return file ? `/flags/${file}.png` : null;
};
