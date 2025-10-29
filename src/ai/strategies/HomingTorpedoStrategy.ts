import { Ship } from '../../objects/Ship';
import { Torpedo } from '../../objects/Torpedo';
import { Vehicle } from '../../objects/Vehicle';
import { Constants } from '../../utils/Constants';
import { Settings } from '../../utils/Settings';
import { PhysicsUtils } from '../../utils/PhysicsUtils';
import { CoordUtils } from '../../utils/CoordUtils';
import { BaseAIStrategy } from './BaseAIStrategy';
import { AIWorldContext } from './AIStrategy';

/**
 * Стратегия для самонаводящейся торпеды.
 * Ищет ближайшую шумную цель и преследует ее.
 */
export class HomingTorpedoStrategy extends BaseAIStrategy {
    public readonly name: string = "Самонаводящаяся Торпеда";
    public readonly description: string = "Ищет ближайшую шумную цель и преследует ее. Эффективна против громких кораблей.";
    
    private searchTimeMs: number = 0;
    private targetShip: Ship | null = null;
    private targetAcceptDist: number = Settings.TRP_III_TRG_ACCEPT_DIST;
    
    /**
     * Фаза анализа - поиск цели
     */
    public analyzeStep(owner: Vehicle, context: AIWorldContext): void {
        if (!owner.active || !(owner instanceof Torpedo) || !this.scene) return;
        
        const torpedo = owner as Torpedo;
        
        this.searchTimeMs += Settings.SLOW_LOOP_INTERVAL_MS;
        
        // Обновляем поиск каждые 3 секунды
        if (this.searchTimeMs >= 3000) {
            this.searchTimeMs = 0;
            
            // Получаем вражеские корабли
            const enemyShips = torpedo.getForces() === Constants.FORCES_WHITE 
                ? this.scene.getRedShips() 
                : this.scene.getWhiteShips();
            
            let closestEnemy: Ship | null = null;
            let minDistance = Infinity;
            
            for (const enemy of enemyShips) {
                if (!enemy.active) continue;
                
                // Проверка "слышимости" цели
                const noiseReceivedByTorpedo = PhysicsUtils.getReceivedNoiseLevel(
                    enemy, 
                    torpedo.getPosition()
                );
                
                // Торпеда "слышит" только если шум >= порога Зоны 1
                if (noiseReceivedByTorpedo < Settings.NOISE_THRESHOLD_ZONE_1_UNCERTAIN) {
                    continue; // Цель слишком тихая
                }
                
                const distance = Phaser.Math.Distance.Between(torpedo.x, torpedo.y, enemy.x, enemy.y);
                
                // Выбор ближайшей цели в радиусе захвата
                if (distance < minDistance && distance < this.targetAcceptDist) {
                    minDistance = distance;
                    closestEnemy = enemy;
                }
            }
            
            const previousTargetId = this.targetShip ? this.targetShip.id : null;
            this.targetShip = closestEnemy;

            if (this.targetShip && this.targetShip.id !== previousTargetId) {
                this.logDecision(`Acquired new homing target: Ship ${this.targetShip.id}`, `Closest noisy ship detected at distance ${minDistance.toFixed(0)}.`);
            } else if (!this.targetShip && previousTargetId !== null) {
                this.logDecision(`Homing target lost`, `Previous target (ID: ${previousTargetId}) is no longer noisy enough or is out of range.`);
            }
        }
    }
    
    /**
     * Фаза действия - преследование цели
     */
    public actionStep(owner: Vehicle, context: AIWorldContext): void {
        if (!owner.active || !(owner instanceof Torpedo)) return;
        
        const torpedo = owner as Torpedo;
        
        // Если торпеда уже движется по WayPoints, не вмешиваемся
        if (torpedo.getMoveState() === Vehicle.ST_WP_MOVING) return;
        
        if (this.targetShip && this.targetShip.active) {
            // Цель найдена - движение к ней
            torpedo.clearWayPoints();
            const targetLogicalPos = CoordUtils.phaserToLogical(this.targetShip.getPosition());
            torpedo.addWayPoint(
                targetLogicalPos.x, 
                targetLogicalPos.y, 
                Constants.WP_TYPE_TORPEDO_TARGET
            );
            torpedo.startMoveOnWP();
            // Используем метод setMoveState, если он есть, или оставляем как есть
            if (typeof torpedo.setMoveState === 'function') {
                torpedo.setMoveState(Vehicle.ST_WP_MOVING);
            }
        } else {
            // Цель потеряна - движение прямо
            if (torpedo.getMoveState() === Vehicle.ST_WP_MOVING) {
                torpedo.stopMoveOnWayPoint();
                this.logDecision(`Stopping WP movement`, `Homing target is lost.`);
            }
            if (torpedo.getPower() === Vehicle.POWER_0) {
                torpedo.setPower(Vehicle.POWER_4); // Продолжить поиск
                this.logDecision(`Set Power to ${Vehicle.POWER_4}`, `Continuing search for a target.`);
            }
        }
    }
}
