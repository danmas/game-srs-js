import { Ship } from '../../objects/Ship';
import { Vehicle } from '../../objects/Vehicle';
import { MainScene } from '../../scenes/MainScene';
import { Constants } from '../../utils/Constants';
import { Settings } from '../../utils/Settings';
import { DetectionState } from '../../utils/DetectionState';
import { BaseAIStrategy } from './BaseAIStrategy';
import { AIWorldContext } from './AIStrategy';
import { UniversalLogger, LogLevel } from '../../utils/UniversalLogger';
import { AILogger } from '../../utils/AILogger';

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
        // Закомментируем спам-логи
        UniversalLogger.debug(`---analyZe Step called for ${owner.constructor.name} ${owner.id}`, `ANALYZE_${owner.id}`);
        
        if (!owner.active || !(owner instanceof Ship)) return;
        UniversalLogger.info(`+++ analyZe Step called for ${owner.constructor.name} ${owner.id}`, `ANALYZE_${owner.id}`);
        
        // Принудительно логируем контекст в начале метода
        // Создаём безопасную копию контекста без scene/sys
        const safeLogContext = {
            perceivedTargets: [...(owner.perceivedTargets?.entries() || [])].map(([id, info]) => ({
                id,
                type: info?.targetVehicle?.entityType || 'unknown',
                detectionState: info?.detectionState,
                position: {
                    x: info?.displayPositionLogical?.x,
                    y: info?.displayPositionLogical?.y
                }
            })),
            ownerPosition: { x: owner.x, y: owner.y },
            ownerDirection: owner.getDirection(),
            ownerSpeed: owner.getSpeed(),
            gameTime: context.gameTime,
            ownerHealth: owner instanceof Ship ? owner.getHealth() : 'n/a'
        };
        
        UniversalLogger.log(
            `AI Context Data - ${owner.constructor.name} ${owner.id} - Analyze Phase`,
            `AI_CONTEXT_${owner.id}`,
            LogLevel.INFO,
            safeLogContext
        );
        
        const ship = owner as Ship;
        
        // Логика из старого Ship.AI_step_I
        // Если здоровье низкое, пытаемся уйти
        if (ship.getHealth() < 200 && ship.getPower() < Vehicle.POWER_4) {
            const oldPower = ship.getPower();
            ship.setPower(Vehicle.POWER_4);
            const decision = `Set Power to ${Vehicle.POWER_4}`;
            const reason = `Health low (${ship.getHealth()}), increasing speed from ${oldPower}.`;
            AILogger.log(ship, this.name, decision, reason, LogLevel.WARN, { ...context, oldPower, newHealth: ship.getHealth() });
        } else if (ship.getHealth() < 200) {
            // Дополнительный лог, если здоровье низкое, но скорость уже максимальная
            AILogger.log(ship, this.name, "Maintain Max Speed", `Health low (${ship.getHealth()}), but already at full power.`, LogLevel.WARN, { ...context });
        }
        
        // Поиск цели для атаки
        const prevTargetId = this.targetId;
        this.findTarget(ship, context);
        
        // Логируем изменение цели
        if (this.targetId !== prevTargetId) {
            if (this.targetId !== null) {
                const targetInfo = ship.perceivedTargets.get(this.targetId);
                const distance = targetInfo ? 
                    Phaser.Math.Distance.Between(ship.x, ship.y, targetInfo.targetVehicle.x, targetInfo.targetVehicle.y).toFixed(0) : 
                    "unknown";
                const reason = targetInfo ? 
                    `Localized detection (${targetInfo.detectionState}), enemy Ship at dist ${distance}.` : 
                    "Target acquired via sensors.";
                AILogger.log(ship, this.name, `Acquire Target ${this.targetId}`, reason, LogLevel.INFO, { 
                    ...context,
                    detectionState: targetInfo?.detectionState,
                    distance: distance
                });
            } else {
                AILogger.log(ship, this.name, "No Target", "No suitable enemies in ZONE_2+.", LogLevel.DEBUG, { ...context });
            }
        }
    }
    
    /**
     * Фаза действия - принятие решений и выполнение действий
     */
    public actionStep(owner: Vehicle, context: AIWorldContext): void {
        // Закомментируем спам-логи
        UniversalLogger.info(`--- aCtion Step called for ${owner.constructor.name} ${owner.id}`, `ACTION_${owner.id}`);
        
        if (!owner.active || !(owner instanceof Ship)) return;
        UniversalLogger.info(`+++ aCtion Step called for ${owner.constructor.name} ${owner.id}`, `ACTION_${owner.id}`);
        
        // Принудительно логируем контекст в начале метода
        // Создаём безопасную копию контекста без scene/sys
        const safeLogContext = {
            perceivedTargets: [...(owner.perceivedTargets?.entries() || [])].map(([id, info]) => ({
                id,
                type: info?.targetVehicle?.entityType || 'unknown',
                detectionState: info?.detectionState,
                position: {
                    x: info?.displayPositionLogical?.x,
                    y: info?.displayPositionLogical?.y
                }
            })),
            ownerPosition: { x: owner.x, y: owner.y },
            ownerDirection: owner.getDirection(),
            ownerSpeed: owner.getSpeed(),
            gameTime: context.gameTime,
            ownerHealth: owner instanceof Ship ? owner.getHealth() : 'n/a',
            currentTarget: this.targetId
        };
        
        UniversalLogger.log(
            `AI Context Data - ${owner.constructor.name} ${owner.id} - Action Phase`,
            `AI_CONTEXT_${owner.id}`,
            LogLevel.INFO,
            safeLogContext
        );
        
        const ship = owner as Ship;
        // UniversalLogger.debug(`isConvoy: ${ship.isConvoy()}, targetId: ${this.targetId}`, `ACTION_${owner.id}`);
        
        // Если это корабль конвоя, не атакуем
        if (ship.isConvoy()) {
            AILogger.log(ship, this.name, "Hold Position", "Convoy ship: no aggressive actions.", LogLevel.INFO, { ...context });
            return;
        }
        
        // Если есть цель, пытаемся атаковать
        if (this.targetId !== null) {
            // Лог атаки только на первом вызове или изменении (дроссель сработает)
            AILogger.log(ship, this.name, `Engage Target ${this.targetId}`, "Target acquired, initiating attack sequence.", LogLevel.INFO, { ...context });
            // UniversalLogger.debug(`Ship has target ${this.targetId}, calling attackTarget`, `ACTION_${owner.id}`);
            this.attackTarget(ship, context);
        } else {
            // Лог idle только если изменилось (e.g., потеряли цель)
            AILogger.log(ship, this.name, "Patrol Mode", "No target: continue waypoint navigation.", LogLevel.DEBUG, { ...context });
        }
        
        // Управление движением по WayPoints
        if (ship.getWayPoints().length > 0 && !ship.getIsMovingOnWayPoint()) {
            AILogger.log(ship, this.name, "Start WayPoint Route", `Route with ${ship.getWayPoints().length} points activated.`, LogLevel.INFO, { ...context });
            ship.startMoveOnWP();
        }
    }
    
    /**
     * Поиск подходящей цели для атаки
     */
    private findTarget(ship: Ship, context: AIWorldContext): void {
        this.targetId = null;
        
        UniversalLogger.debug(`---findTarget for ${ship.constructor.name} ${ship.id}`, `ANALYZE_${ship.id}`);
        
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

        UniversalLogger.info(`--- attackTarget called for ${ship.constructor.name} }`, `ACTION_`);
        
        const targetInfo = ship.perceivedTargets.get(this.targetId);
        if (!targetInfo || !(targetInfo.targetVehicle instanceof Ship)) {
            AILogger.log(ship, this.name, "Abort Attack", "Target invalid or lost contact.", LogLevel.WARN, { ...context, targetId: this.targetId });
            return;
        }
        
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
        
        // Логируем причины, по которым не можем атаковать
        if (!weaponReady) {
            AILogger.log(ship, this.name, "Hold Fire", `Torpedo I not ready (reload time).`, LogLevel.DEBUG, { ...context, weapon: Constants.WEAPON_SELECT_TORP_I });
            return;
        }
        
        if (!distanceOk) {
            AILogger.log(ship, this.name, "Adjust Position", `Target too far (${distanceToTarget.toFixed(0)} > ${Settings.TRP_I_DIST_EXECUTION}).`, LogLevel.INFO, { 
                ...context,
                requiredDist: Settings.TRP_I_DIST_EXECUTION,
                currentDist: distanceToTarget
            });
            return;
        }
        
        if (!angleOk) {
            AILogger.log(ship, this.name, "Maneuver for Angle", `Angle off by ${diffAngle.toFixed(1)}° (max ${Settings.TRP_ATACK__ANGLE_WARNING}).`, LogLevel.INFO, { 
                ...context,
                currentAngle: diffAngle,
                maxAngle: Settings.TRP_ATACK__ANGLE_WARNING
            });
            return;
        }
        
        // Все условия соблюдены - стреляем!
        const decision = `Fire Torpedo I at Target ${target.id}`;
        const reason = `Target in range (${distanceToTarget.toFixed(0)}) and angle is good (${diffAngle.toFixed(1)}°).`;
        AILogger.log(ship, this.name, decision, reason, LogLevel.INFO, { 
            ...context,
            dist: distanceToTarget, 
            angle: diffAngle,
            targetId: target.id
        });
        
        this.scene.fireTorpedo(
            ship,
            Constants.WEAPON_SELECT_TORP_I,
            targetTruePosition.x,
            targetTruePosition.y
        );
    }
}
