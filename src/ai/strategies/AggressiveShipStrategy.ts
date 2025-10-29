import { Ship } from '../../objects/Ship';
import { Vehicle } from '../../objects/Vehicle';
import { MainScene } from '../../scenes/MainScene';
import { Constants } from '../../utils/Constants';
import { Settings } from '../../utils/Settings';
import { DetectionState } from '../../utils/DetectionState';
import { BaseAIStrategy } from './BaseAIStrategy';
import { AIWorldContext } from './AIStrategy';
import { CoordUtils } from '../../utils/CoordUtils';

/**
 * Агрессивная стратегия для кораблей.
 * Активно преследует цели и атакует при первой возможности.
 */
export class AggressiveShipStrategy extends BaseAIStrategy {
    public readonly name: string = "Агрессивный Охотник";
    public readonly description: string = "Активно преследует обнаруженные цели и атакует при первой возможности. Игнорирует опасность.";
    
    private targetId: number | null = null;
    private pursuitUpdateTime: number = 0;
    private readonly pursuitUpdateInterval: number = 2000; // Обновление цели каждые 2 секунды
    
    /**
     * Фаза анализа - сбор информации и оценка ситуации
     */
    public analyzeStep(owner: Vehicle, context: AIWorldContext): void {
        if (!owner.active || !(owner instanceof Ship)) return;
        
        const ship = owner as Ship;
        
        // Обновляем цель для преследования с определенным интервалом
        this.pursuitUpdateTime += Settings.SLOW_LOOP_INTERVAL_MS;
        if (this.pursuitUpdateTime >= this.pursuitUpdateInterval) {
            this.pursuitUpdateTime = 0;
            this.findBestTarget(ship, context);
        }
    }
    
    /**
     * Фаза действия - принятие решений и выполнение действий
     */
    public actionStep(owner: Vehicle, context: AIWorldContext): void {
        if (!owner.active || !(owner instanceof Ship)) return;
        
        const ship = owner as Ship;
        
        // Если это корабль конвоя, не атакуем
        if (ship.isConvoy()) return;
        
        // Если есть цель, преследуем и атакуем
        if (this.targetId !== null) {
            const targetInfo = ship.perceivedTargets.get(this.targetId);
            if (targetInfo && targetInfo.targetVehicle.active) {
                // Преследуем цель
                this.pursueTarget(ship, targetInfo.targetVehicle);
                
                // Пытаемся атаковать
                this.attackTarget(ship, context);
            } else {
                this.targetId = null;
            }
        }
        
        // Всегда двигаемся на максимальной скорости
        if (ship.getPower() < Vehicle.POWER_5) {
            ship.setPower(Vehicle.POWER_5);
            this.logDecision(`Set Power to ${Vehicle.POWER_5}`, `Aggressive pursuit strategy requires maximum speed.`);
        }
    }
    
    /**
     * Поиск лучшей цели для преследования (ближайшей)
     */
    private findBestTarget(ship: Ship, context: AIWorldContext): void {
        this.targetId = null;
        let minDistance = Infinity;
        
        for (const [id, perceivedInfo] of ship.perceivedTargets.entries()) {
            if (perceivedInfo.targetVehicle.active && 
                perceivedInfo.targetVehicle.getForces() !== ship.getForces() &&
                (perceivedInfo.detectionState === DetectionState.ZONE_2_LOCALIZED || 
                 perceivedInfo.detectionState === DetectionState.ZONE_3_IDENTIFIED)) {
                
                if (perceivedInfo.targetVehicle instanceof Ship) {
                    const distance = Phaser.Math.Distance.Between(
                        ship.x, ship.y,
                        perceivedInfo.targetVehicle.x, perceivedInfo.targetVehicle.y
                    );
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        this.targetId = id;
                    }
                }
            }
        }

        if (this.targetId !== null) {
            this.logDecision(`New pursuit target acquired: Ship ${this.targetId}`, `Target is the closest detected enemy at distance ${minDistance.toFixed(0)}.`);
        }
    }
    
    /**
     * Преследование выбранной цели
     */
    private pursueTarget(ship: Ship, target: Vehicle): void {
        // Получаем логические координаты цели
        const targetLogicalPos = CoordUtils.phaserToLogical(target.getPosition());
        
        // Обновляем WayPoint к цели
        ship.clearWayPoints();
        ship.addWayPoint(targetLogicalPos.x, targetLogicalPos.y, Constants.WP_TYPE_TARGET);
        
        if (!ship.getIsMovingOnWayPoint()) {
            ship.startMoveOnWP();
        }
    }
    
    /**
     * Атака выбранной цели
     */
    private attackTarget(ship: Ship, context: AIWorldContext): void {
        if (this.targetId === null || !this.scene) return;
        
        const targetInfo = ship.perceivedTargets.get(this.targetId);
        if (!targetInfo || !(targetInfo.targetVehicle instanceof Ship)) return;
        
        const target = targetInfo.targetVehicle as Ship;
        
        // Проверяем все доступные типы оружия
        const weaponTypes = [
            Constants.WEAPON_SELECT_TORP_I,
            Constants.WEAPON_SELECT_TORP_II,
            Constants.WEAPON_SELECT_TORP_III
        ];
        
        for (const weaponType of weaponTypes) {
            if (!ship.isWeaponReady(weaponType)) continue;
            
            const targetTruePosition = target.getTruePositionBeforeSensorEffects();
            const distanceToTarget = Phaser.Math.Distance.Between(
                ship.x, ship.y, 
                targetTruePosition.x, targetTruePosition.y
            );
            
            // Используем разные дистанции для разных типов оружия
            let maxDistance = Settings.TRP_I_DIST_EXECUTION;
            if (weaponType === Constants.WEAPON_SELECT_TORP_II) {
                maxDistance = Settings.TRP_II_DIST_EXECUTION;
            } else if (weaponType === Constants.WEAPON_SELECT_TORP_III) {
                maxDistance = Settings.TRP_III_DIST_EXECUTION;
            }
            
            const angleToTargetRad = Phaser.Math.Angle.Between(
                ship.x, ship.y, 
                targetTruePosition.x, targetTruePosition.y
            );
            let angleToTargetDeg = (Phaser.Math.RadToDeg(angleToTargetRad) + 90 + 360) % 360;
            const diffAngle = Phaser.Math.Angle.ShortestBetween(ship.getDirection(), angleToTargetDeg);
            
            const distanceOk = distanceToTarget < maxDistance;
            const angleOk = Math.abs(diffAngle) < Settings.TRP_ATACK__ANGLE_WARNING;
            
            if (distanceOk && angleOk) {
                this.logDecision(`Fire Torpedo ${weaponType} at Target ${target.id}`, `Target in range (${distanceToTarget.toFixed(0)}), angle good.`);
                this.scene.fireTorpedo(
                    ship,
                    weaponType,
                    targetTruePosition.x,
                    targetTruePosition.y
                );
                break; // Используем первое доступное оружие
            }
        }
    }
}
