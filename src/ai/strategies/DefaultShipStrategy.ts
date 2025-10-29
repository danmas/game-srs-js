import { Ship } from '../../objects/Ship';
import { Vehicle } from '../../objects/Vehicle';
import { MainScene } from '../../scenes/MainScene';
import { Constants } from '../../utils/Constants';
import { Settings } from '../../utils/Settings';
import { DetectionState } from '../../utils/DetectionState';
import { BaseAIStrategy } from './BaseAIStrategy';
import { AIWorldContext } from './AIStrategy';
import { UniversalLogger } from '../../utils/UniversalLogger';

/**
 * Стандартная стратегия для кораблей.
 * Имитирует текущее поведение ИИ в игре.
 */
export class DefaultShipStrategy extends BaseAIStrategy {
    public readonly name: string = "Стандартный Боевой ИИ";
    public readonly description: string = "Базовая стратегия для кораблей. Атакует обнаруженные цели и увеличивает скорость при низком здоровье.";
    
    private targetId: number | null = null;
    
    /**
     * Фаза анализа - сбор информации и оценка ситуации
     */
    public analyzeStep(owner: Vehicle, context: AIWorldContext): void {
        UniversalLogger.debug(`analyzeStep called for ${owner.constructor.name} ${owner.id}`, `ANALYZE_${owner.id}`);
        if (!owner.active || !(owner instanceof Ship)) return;
        
        const ship = owner as Ship;
        
        // Логика из старого Ship.AI_step_I
        // Если здоровье низкое, пытаемся уйти
        if (ship.getHealth() < 200 && ship.getPower() < Vehicle.POWER_4) {
            const oldPower = ship.getPower();
            ship.setPower(Vehicle.POWER_4);
            this.logDecision(`Set Power to ${Vehicle.POWER_4}`, `Health low (${ship.getHealth()}), increasing speed from ${oldPower}.`);
        }
        
        // Поиск цели для атаки
        this.findTarget(ship, context);
    }
    
    /**
     * Фаза действия - принятие решений и выполнение действий
     */
    public actionStep(owner: Vehicle, context: AIWorldContext): void {
        UniversalLogger.debug(`actionStep called for ${owner.constructor.name} ${owner.id}`, `ACTION_${owner.id}`);
        if (!owner.active || !(owner instanceof Ship)) return;
        
        const ship = owner as Ship;
        UniversalLogger.debug(`isConvoy: ${ship.isConvoy()}, targetId: ${this.targetId}`, `ACTION_${owner.id}`);
        
        // Если это корабль конвоя, не атакуем
        if (ship.isConvoy()) return;
        
        // Если есть цель, пытаемся атаковать
        if (this.targetId !== null) {
            UniversalLogger.debug(`Ship has target ${this.targetId}, calling attackTarget`, `ACTION_${owner.id}`);
            this.attackTarget(ship, context);
        }
        
        // Управление движением по WayPoints
        if (ship.getWayPoints().length > 0 && !ship.getIsMovingOnWayPoint()) {
            ship.startMoveOnWP();
        }
    }
    
    /**
     * Поиск подходящей цели для атаки
     */
    private findTarget(ship: Ship, context: AIWorldContext): void {
        this.targetId = null;
        
        for (const [id, perceivedInfo] of ship.perceivedTargets.entries()) {
            if (perceivedInfo.targetVehicle.active && 
                perceivedInfo.targetVehicle.getForces() !== ship.getForces() &&
                (perceivedInfo.detectionState === DetectionState.ZONE_2_LOCALIZED || 
                 perceivedInfo.detectionState === DetectionState.ZONE_3_IDENTIFIED)) {
                
                if (perceivedInfo.targetVehicle instanceof Ship) {
                    this.targetId = id;
                    break;
                }
            }
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
        
        const weaponReady = ship.isWeaponReady(Constants.WEAPON_SELECT_TORP_I);
        const targetTruePosition = target.getTruePositionBeforeSensorEffects();
        const distanceToTarget = Phaser.Math.Distance.Between(
            ship.x, ship.y, 
            targetTruePosition.x, targetTruePosition.y
        );
        const angleToTargetRad = Phaser.Math.Angle.Between(
            ship.x, ship.y, 
            targetTruePosition.x, targetTruePosition.y
        );
        let angleToTargetDeg = (Phaser.Math.RadToDeg(angleToTargetRad) + 90 + 360) % 360;
        const diffAngle = Phaser.Math.Angle.ShortestBetween(ship.getDirection(), angleToTargetDeg);
        
        const distanceOk = distanceToTarget < Settings.TRP_I_DIST_EXECUTION;
        const angleOk = Math.abs(diffAngle) < Settings.TRP_ATACK__ANGLE_WARNING;
        
        if (weaponReady && distanceOk && angleOk) {
            this.logDecision(`Fire Torpedo I at Target ${target.id}`, `Target in range (${distanceToTarget.toFixed(0)}) and angle is good (${diffAngle.toFixed(0)}).`);
            this.scene.fireTorpedo(
                ship,
                Constants.WEAPON_SELECT_TORP_I,
                targetTruePosition.x,
                targetTruePosition.y
            );
        }
    }
}
