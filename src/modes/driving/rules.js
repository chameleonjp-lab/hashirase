import { finite, identifier } from '../../contracts/validation.js';
export function calculateCollisionDamage(category, impactSpeedMs) {
  const impactKmh = Math.max(12.0, impactSpeedMs * 3.6);
  // Normalized speed factor: 0.5 at 60 km/h, 1.0 at 120 km/h, 2.0 at 240 km/h
  const spdFactor = Math.max(0.16, Math.min(2.6, impactKmh / 120.0));

  // Base Civilian Car collision damage formula (器物損壊):
  // ~28 HP at 30 km/h, ~42 HP at 60 km/h, ~70 HP at 120 km/h, ~126 HP at 240 km/h
  const civilianBaseDamage = Math.round(14 + 56 * spdFactor);

  if (category === 'CIVILIAN_CAR') {
    return { hpLoss: civilianBaseDamage, impactKmh: Math.round(impactKmh), offenseName: '器物損壊', penaltyPt: 350 };
  }
  if (category === 'POLICE_CAR') {
    // Strictly 2x the damage of a civilian car at the same collision speed!
    return { hpLoss: civilianBaseDamage * 2, impactKmh: Math.round(impactKmh), offenseName: '公務執行妨害', penaltyPt: 700 };
  }
  if (category === 'WALL') {
    // Building wall impact (物損): ~29 HP at 60 km/h, ~48 HP at 120 km/h
    const wallDmg = Math.round(10 + 38 * spdFactor);
    return { hpLoss: wallDmg, impactKmh: Math.round(impactKmh), offenseName: '物損(壁)', penaltyPt: 150 };
  }
  // Utility pole or Traffic signal impact (物損: 信号・電柱): ~21 HP at 60 km/h, ~34 HP at 120 km/h
  const poleDmg = Math.round(8 + 26 * spdFactor);
  return { hpLoss: poleDmg, impactKmh: Math.round(impactKmh), offenseName: category === 'SIGNAL' ? '物損(信号)' : '物損(電柱)', penaltyPt: 150 };
}
export function scoreDrivingState(carState, policePursuitState) {
  const distScore = Math.round(carState.totalDistanceTraveled * 3.0);
  const penalties =
    policePursuitState.propertyDamageHits * 150 +
    policePursuitState.carHits * 350 +
    policePursuitState.policeHits * 700;
  carState.score = distScore + (carState.goalBonusScore || 0) - penalties;
  return carState.score;
}
export function advanceDistance(carState, pursuit, timeAttack, dt) {
  if (!timeAttack.finished && !pursuit.gameOver) carState.totalDistanceTraveled += Math.hypot(carState.vx,carState.vz)*dt;
}
export function createDrivingRules(car, pursuit, timeAttack) {
  const seen = new Set();
  return Object.freeze({
    step(dt, environment = {}) {
      for (const impact of environment.impacts || []) {
        identifier(impact.eventId,'impact.eventId'); finite(impact.impactSpeed,'impactSpeed',0);
        if (!['CIVILIAN_CAR','POLICE_CAR','WALL','SIGNAL','POLE'].includes(impact.category)) throw new TypeError('Unknown impact category');
        if (seen.has(impact.eventId) || pursuit.gameOver) continue;
        seen.add(impact.eventId);
        const info=calculateCollisionDamage(impact.category,impact.impactSpeed);
        const key=impact.category==='CIVILIAN_CAR'?'carHits':impact.category==='POLICE_CAR'?'policeHits':'propertyDamageHits';
        pursuit[key]++; car.hp=Math.max(0,car.hp-info.hpLoss); car.integrity=Math.round(car.hp/car.maxHp*100);
        if(car.hp===0) pursuit.gameOver=true;
      }
      advanceDistance(car,pursuit,timeAttack,dt); scoreDrivingState(car,pursuit);
    },
    reset() { seen.clear(); }
  });
}
