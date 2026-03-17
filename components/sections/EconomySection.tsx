import { KPICard } from '@/components/KPICard';

interface Props {
  pistols: { wins: number; total: number };
  antiEco: { wins: number; total: number };
  recovery: { wins: number; total: number };
  pab: { atkWins: number; defWins: number; wins: number; atkTotal: number; defTotal: number; total: number };
}

export function EconomySection({ pistols, antiEco, recovery, pab }: Props) {
  const pistolRate = pistols.total > 0 ? Math.round((pistols.wins / pistols.total) * 100) : 0;
  const antiEcoRate = antiEco.total > 0 ? Math.round((antiEco.wins / antiEco.total) * 100) : 0;
  const recoveryRate = recovery.total > 0 ? Math.round((recovery.wins / recovery.total) * 100) : 0;
  const pabRateTotal = pab.total > 0 ? Math.round((pab.wins / pab.total) * 100) : 0;
  const pabRateAtk = pab.atkTotal > 0 ? Math.round((pab.atkWins / pab.atkTotal) * 100) : 0;
  const pabRateDef = pab.defTotal > 0 ? Math.round((pab.defWins / pab.defTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <KPICard
          title="Pistol Rounds"
          label={`${pistols.wins}W — ${pistols.total - pistols.wins}L`}
          value={`${pistolRate}%`}
        />
        <KPICard
          title="Post Pistol Win into Win"
          label={`${antiEco.wins}W — ${antiEco.total - antiEco.wins}L`}
          value={`${antiEcoRate}%`}
        />
        <KPICard
          title="Post Pistol Loss into Win"
          label={`${recovery.wins}W — ${recovery.total - recovery.wins}L`}
          value={`${recoveryRate}%`}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <KPICard
          title="PAB (Bonus conversion)"
          label={`${pab.wins}W — ${pab.total - pab.wins}L`}
          value={`${pabRateTotal}%`}
        />
        <KPICard
          title="PAB Attack"
          label={`${pab.atkWins}W — ${pab.atkTotal - pab.atkWins}L`}
          value={`${pabRateAtk}%`}
          variant="danger"
        />
        <KPICard
          title="PAB Def"
          label={`${pab.defWins}W — ${pab.defTotal - pab.defWins}L`}
          value={`${pabRateDef}%`}
          variant="success"
        />
      </div>
    </div>
  );
}
