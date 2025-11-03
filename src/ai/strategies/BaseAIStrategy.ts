import { Vehicle } from '../../objects/Vehicle';
import { Ship } from '../../objects/Ship';
import { Submarine } from '../../objects/Submarine';
import { Torpedo } from '../../objects/Torpedo';
import { MainScene } from '../../scenes/MainScene';
import { AIStrategy, AIWorldContext } from './AIStrategy';
import { AILogger } from '../../utils/AILogger';
import { UniversalLogger, LogLevel } from '../../utils/UniversalLogger';
import { DetectionState } from '../../utils/DetectionState';
import { Constants } from '../../utils/Constants';
import { Settings } from '../../utils/Settings';
import { CoordUtils } from '../../utils/CoordUtils';
import * as Phaser from 'phaser';

/**
 * Базовая абстрактная стратегия, реализующая общую функциональность.
 * От нее должны наследоваться все конкретные стратегии.
 */
export abstract class BaseAIStrategy implements AIStrategy {
    public abstract readonly name: string;
    public abstract readonly description: string;
    
    protected owner: Vehicle | null = null;
    protected scene: MainScene | null = null;
    
    /**
     * Инициализация стратегии
     */
    public initialize(owner: Vehicle, scene: MainScene): void {
        this.owner = owner;
        this.scene = scene;
        this.onInitialize();
    }
    
    /**
     * Метод для переопределения в дочерних классах для дополнительной инициализации
     */
    protected onInitialize(): void {
        // Пустая реализация по умолчанию
    }
    
    /**
     * Фаза анализа (переопределяется в дочерних классах)
     */
    public analyzeStep(owner: Vehicle, context: AIWorldContext): void {
        this.logDecision("Analyze Step", "Evaluating situation.");
    }
    
    /**
     * Фаза действия (переопределяется в дочерних классах)
     */
    public actionStep(owner: Vehicle, context: AIWorldContext): void {
        this.logDecision("Action Step", "Executing decisions.");
    }

    /**
     * Отправляет сообщение в логгер ИИ.
     * @param decision Краткое описание решения.
     * @param reason Контекст и причина решения.
     */
    protected logDecision(decision: string, reason: string): void {
        UniversalLogger.debug(`[${this.owner?.entityType} ${this.owner?.id}] ${decision}: ${reason}`, `AI_${this.name}`);
        if (this.owner) {
            AILogger.log(this.owner, this.name, decision, reason);
        }
    }
    
    /**
     * Проверяет, находится ли цель в зоне обнаружения 2 или выше
     */
    protected isTargetDetected(targetId: number): boolean {
        if (!this.owner) return false;
        
        const targetInfo = this.owner.perceivedTargets.get(targetId);
        if (!targetInfo) return false;
        
        // Зона 2 (локализовано) или Зона 3 (идентифицировано)
        return targetInfo.detectionState >= 1; // DetectionState.ZONE_2_LOCALIZED
    }
    
    // ==================== ОБЩИЕ ФУНКЦИИ ====================
    
    /**
     * Периодическое логирование статуса ИИ (каждые 5 секунд)
     * Используется для отслеживания активности стратегии
     */
    protected logPeriodicStatus(
        vehicle: Vehicle,
        context: AIWorldContext,
        additionalData?: Record<string, any>
    ): void {
        const currentTime = context.gameTime;
        const lastLogTime = (vehicle as any).__lastAILogTime || 0;
        
        if (currentTime - lastLogTime > 5000) {
            (vehicle as any).__lastAILogTime = currentTime;
            
            const baseData = {
                entityId: vehicle.id,
                strategy: this.name,
                health: vehicle instanceof Ship ? vehicle.getHealth() : 'N/A',
                power: vehicle.getPower(),
                position: { x: vehicle.x, y: vehicle.y },
                direction: vehicle.getDirection(),
                speed: vehicle.getSpeed(),
                targetCount: vehicle.perceivedTargets.size
            };
            
            // Добавляем глубину для подлодок
            if (vehicle instanceof Submarine) {
                (baseData as any).depth = vehicle.getDepth();
            }
            
            const fullData = { ...baseData, ...additionalData };
            
            AILogger.log(
                vehicle,
                this.name,
                "AI Status Report",
                `Health=${fullData.health}, Power=${fullData.power}, Targets=${fullData.targetCount}`,
                LogLevel.INFO,
                fullData
            );
        }
    }
    
    /**
     * Проверяет здоровье корабля и автоматически повышает скорость при низком здоровье
     */
    protected checkHealthAndAdjustSpeed(
        ship: Ship,
        context: AIWorldContext,
        threshold: number = 200,
        targetPower: number = Vehicle.POWER_4
    ): boolean {
        if (ship.getHealth() < threshold && ship.getPower() < targetPower) {
            const oldPower = ship.getPower();
            ship.setPower(targetPower);
            AILogger.log(
                ship,
                this.name,
                "Increase Speed",
                `Health low (${ship.getHealth()}), increasing speed from ${oldPower} to ${targetPower}.`,
                LogLevel.WARN,
                { ...context, oldPower, newPower: targetPower, health: ship.getHealth() }
            );
            return true;
        }
        return false;
    }
    
    /**
     * Универсальный поиск цели по заданным критериям
     * Возвращает ID найденной цели или null
     */
    protected findTargetByFilter(
        vehicle: Vehicle,
        context: AIWorldContext,
        filter: {
            requireDetectionLevel?: DetectionState;
            requireType?: 'Ship' | 'Submarine' | 'any';
            maxDistance?: number;
            minDistance?: number;
            excludeConvoy?: boolean;
            excludeAllies?: boolean;
            maxSpeedFilter?: number;
        } = {}
    ): number | null {
        let bestTargetId: number | null = null;
        let bestDistance = Infinity;
        
        // Значения по умолчанию
        const detectionLevel = filter.requireDetectionLevel ?? DetectionState.ZONE_1_UNCERTAIN;
        const requireType = filter.requireType ?? 'any';
        const excludeAllies = filter.excludeAllies ?? true;
        
        for (const [id, perceivedInfo] of vehicle.perceivedTargets.entries()) {
            // Базовые проверки
            if (!perceivedInfo.targetVehicle.active) continue;
            if (excludeAllies && perceivedInfo.targetVehicle.getForces() === vehicle.getForces()) continue;
            if (perceivedInfo.detectionState < detectionLevel) continue;
            
            // Проверка типа
            if (requireType === 'Ship' && !(perceivedInfo.targetVehicle instanceof Ship)) continue;
            if (requireType === 'Submarine' && !(perceivedInfo.targetVehicle instanceof Submarine)) continue;
            
            // Проверка конвоя
            if (filter.excludeConvoy && perceivedInfo.targetVehicle instanceof Ship) {
                if (perceivedInfo.targetVehicle.isConvoy()) continue;
            }
            
            // Проверка скорости (для фильтрации торговых судов)
            if (filter.maxSpeedFilter !== undefined) {
                if (perceivedInfo.targetVehicle.getSpeed() > filter.maxSpeedFilter) continue;
            }
            
            // Расчет дистанции
            const distance = Phaser.Math.Distance.Between(
                vehicle.x, vehicle.y,
                perceivedInfo.targetVehicle.x, perceivedInfo.targetVehicle.y
            );
            
            // Проверка дистанции
            if (filter.maxDistance !== undefined && distance > filter.maxDistance) continue;
            if (filter.minDistance !== undefined && distance < filter.minDistance) continue;
            
            // Выбираем ближайшую цель
            if (distance < bestDistance) {
                bestDistance = distance;
                bestTargetId = id;
            }
        }
        
        return bestTargetId;
    }
    
    /** 
     * Расчет угла до цели с учетом игровой координатной системы
     * РАБОТАЛО!
     * 
    protected calculateAngleToTarget(
        from: Vehicle,
        targetPos: Phaser.Math.Vector2
    ): { angleRad: number; angleDeg: number; diff: number } {
        const angleRad = Phaser.Math.Angle.Between(
            from.x, from.y,
            targetPos.x, targetPos.y
        );
        
        // Конвертация с учетом системы координат игры (0° = север)
        let angleDeg = (Phaser.Math.RadToDeg(angleRad) + 90 + 360) % 360;
        
        // Разница между текущим направлением и целевым
        const diff = Phaser.Math.Angle.ShortestBetween(from.getDirection(), angleDeg);
        
        return { angleRad, angleDeg, diff };
    }
*/
    
/**
 * Расчет угла до цели
 * Назначение: Вычисляет угол до целевой позиции с учетом игровой координатной системы.
 *
 * Сигнатура:
 * protected calculateAngleToTarget(
 *     from: Vehicle,
 *     targetPos: Phaser.Math.Vector2
 * ): { angleRad: number; angleDeg: number; diff: number }
 *
 * Пример использования:
 * const targetPos = new Phaser.Math.Vector2(enemy.x, enemy.y);
 * const angleInfo = this.calculateAngleToTarget(ship, targetPos);
 *
 * console.log(`Угол до цели: ${angleInfo.angleDeg}°`);
 * console.log(`Разница с текущим курсом: ${angleInfo.diff}°`);
 *
 * // Корректировка руля
 * if (Math.abs(angleInfo.diff) > 10) {
 *     ship.setRudder(angleInfo.diff > 0 ? 1 : -1);
 * }
 *
 * Возвращает:
 * - `angleRad` - угол в радианах (навигационная система)
 * - `angleDeg` - угол в градусах (навигационная система)
 * - `diff` - разница между текущим направлением и целевым (кратчайший угол, -180..+180°)
 */
protected calculateAngleToTarget(
    from: Vehicle,
    targetPos: Phaser.Math.Vector2
): { angleRad: number; angleDeg: number; diff: number } {
    // Шаг 1: Вычисляем математический угол (Phaser: 0° = вправо)
    const mathRad = Phaser.Math.Angle.Between(
        from.x, from.y,
        targetPos.x, targetPos.y
    );
    const mathDeg = Phaser.Math.RadToDeg(mathRad);

    // Шаг 2: Конвертируем в навигационную систему (0° = вверх)
    // Формула из COORDINATES_REFERENCE.md: navDeg = (mathDeg + 90 + 360) % 360
    const angleDeg = (mathDeg + 90 + 360) % 360;
    const angleRad = Phaser.Math.DegToRad(angleDeg);

    // Шаг 3: Текущее направление уже в навигационных градусах
    const currentNavDeg = from.getDirection();

    // Шаг 4: Кратчайшая разница углов (навигационная система)
    const diff = Phaser.Math.Angle.ShortestBetween(currentNavDeg, angleDeg);

    // DEBUG лог (опционально, для отладки)
    UniversalLogger.debug(
        `Angle to target: math(${mathDeg.toFixed(1)}° → nav(${angleDeg.toFixed(1)}°), current(${currentNavDeg.toFixed(1)}°), diff(${diff.toFixed(1)}°))`,
        'AI_CALC_ANGLE'
    );

    return {
        angleRad,  // Навигационный rad
        angleDeg,  // Навигационный deg
        diff       // Кратчайшая разница
    };
}


    /**
     * Вычисляет направление убегания от угрозы (противоположное направление)
     */
    protected calculateEscapeDirection(
        fromPos: Phaser.Math.Vector2,
        threatPos: Phaser.Math.Vector2,
        escapeDistance: number = 800
    ): { angle: number; point: Phaser.Math.Vector2; angleDeg: number } {
        const angleToThreat = Phaser.Math.Angle.Between(
            fromPos.x, fromPos.y,
            threatPos.x, threatPos.y
        );
        
        // Убегаем в противоположном направлении (+ 180°)
        const escapeAngleRad = angleToThreat + Math.PI;
        const escapeAngleDeg = (Phaser.Math.RadToDeg(escapeAngleRad) + 360) % 360;
        
        const escapeX = fromPos.x + Math.cos(escapeAngleRad) * escapeDistance;
        const escapeY = fromPos.y + Math.sin(escapeAngleRad) * escapeDistance;
        
        return {
            angle: escapeAngleRad,
            angleDeg: escapeAngleDeg,
            point: new Phaser.Math.Vector2(escapeX, escapeY)
        };
    }
    
    /**
     * Вычисляет направление приближения к цели (прямо или под углом для stealth)
     */
    protected calculateApproachDirection(
        fromPos: Phaser.Math.Vector2,
        targetPos: Phaser.Math.Vector2,
        approachDistance: number = 500,
        angleOffset: number = 0 // 0 = прямо, Math.PI/2 = 90° для stealth
    ): { angle: number; point: Phaser.Math.Vector2; angleDeg: number } {
        const angleToTarget = Phaser.Math.Angle.Between(
            fromPos.x, fromPos.y,
            targetPos.x, targetPos.y
        );
        
        const approachAngleRad = angleToTarget + angleOffset;
        const approachAngleDeg = (Phaser.Math.RadToDeg(approachAngleRad) + 360) % 360;
        
        const approachX = fromPos.x + Math.cos(approachAngleRad) * approachDistance;
        const approachY = fromPos.y + Math.sin(approachAngleRad) * approachDistance;
        
        // DEBUG лог
        UniversalLogger.debug(`Calculated approach: from (${fromPos.x.toFixed(0)}, ${fromPos.y.toFixed(0)}) to (${targetPos.x.toFixed(0)}, ${targetPos.y.toFixed(0)}), offset ${Phaser.Math.RadToDeg(angleOffset).toFixed(0)}°, point (${approachX.toFixed(0)}, ${approachY.toFixed(0)}), angle ${approachAngleDeg.toFixed(0)}°`, 'AI_CALC_APPROACH');
        
        return {
            angle: approachAngleRad,
            angleDeg: approachAngleDeg,
            point: new Phaser.Math.Vector2(approachX, approachY)
        };
    }
    
    /**
     * Установка waypoint для маневра с автоматическим стартом
     */
    protected setManeuverWaypoint(
        vehicle: Vehicle,
        logicalX: number,
        logicalY: number,
        type: number = Constants.WP_TYPE_MANEUVER,
        autoStart: boolean = true,
        clearPrevious: boolean = true
    ): void {
        if (clearPrevious) {
            vehicle.clearWayPoints();
        }
        
        vehicle.addWayPoint(logicalX, logicalY, type);
        
        if (autoStart && !vehicle.getIsMovingOnWayPoint()) {
            vehicle.startMoveOnWP();
        }
        
        // DEBUG лог
        UniversalLogger.debug(`Set waypoint for ${vehicle.entityType} ${vehicle.id}: logical (${logicalX.toFixed(0)}, ${logicalY.toFixed(0)}), type ${type}, autoStart ${autoStart}`, 'AI_SET_WAYPOINT', { vehicleId: vehicle.id });
    }
    
    /**
     * Выстрел торпедой по цели с полной проверкой условий
     * Возвращает торпеду или null если выстрел невозможен
     */
    protected fireTorpedoAtTarget(
        ship: Ship,
        target: Vehicle,
        weaponType: number,
        context: AIWorldContext,
        options: {
            predictLeadTime?: number; // Время упреждения для движущихся целей (секунды)
            requireDistance?: number; // Максимальная дистанция (по умолчанию из Settings)
            requireAngle?: number; // Максимальное отклонение угла (по умолчанию из Settings)
            logAttempt?: boolean; // Логировать попытку даже если не получилось
        } = {}
    ): Torpedo | null {
        if (!this.scene) return null;
        
        // Значения по умолчанию
        const requireDistance = options.requireDistance ?? Settings.TRP_I_DIST_EXECUTION;
        const requireAngle = options.requireAngle ?? Settings.TRP_ATACK__ANGLE_WARNING;
        const logAttempt = options.logAttempt ?? true;
        
        // Проверка готовности оружия
        const weaponReady = ship.isWeaponReady(weaponType);
        if (!weaponReady) {
            if (logAttempt) {
                AILogger.log(
                    ship,
                    this.name,
                    "Hold Fire",
                    `Weapon type ${weaponType} not ready (reloading).`,
                    LogLevel.INFO,
                    { ...context, weaponType }
                );
            }
            return null;
        }
        
        // Определение целевой позиции
        let targetPos: Phaser.Math.Vector2;
        
        if (target instanceof Ship) {
            targetPos = target.getTruePositionBeforeSensorEffects();
        } else {
            targetPos = new Phaser.Math.Vector2(target.x, target.y);
        }
        
        // Предсказание движения цели
        if (options.predictLeadTime && options.predictLeadTime > 0) {
            const targetDir = target.getDirection();
            const targetDirRad = Phaser.Math.DegToRad(targetDir);
            const targetSpeed = target.getSpeed();
            const travelDist = targetSpeed * options.predictLeadTime;
            
            // Навигационная система: 0° = вверх
            targetPos.x += Math.sin(targetDirRad) * travelDist;
            targetPos.y -= Math.cos(targetDirRad) * travelDist;
        }
        
        // Проверка дистанции
        const distance = Phaser.Math.Distance.Between(
            ship.x, ship.y,
            targetPos.x, targetPos.y
        );
        
        if (distance > requireDistance) {
            if (logAttempt) {
                AILogger.log(
                    ship,
                    this.name,
                    "Target Too Far",
                    `Distance ${distance.toFixed(0)}m exceeds maximum ${requireDistance}m.`,
                    LogLevel.INFO,
                    { ...context, distance, requireDistance }
                );
            }
            return null;
        }
        
        // Проверка угла
        const angleInfo = this.calculateAngleToTarget(ship, targetPos);
        
        if (Math.abs(angleInfo.diff) > requireAngle) {
            if (logAttempt) {
                AILogger.log(
                    ship,
                    this.name,
                    "Angle Not Aligned",
                    `Angle difference ${angleInfo.diff.toFixed(1)}° exceeds maximum ${requireAngle}°.`,
                    LogLevel.INFO,
                    { ...context, angleDiff: angleInfo.diff, requireAngle }
                );
            }
            return null;
        }
        
        // Все проверки пройдены - стреляем!
        const torpedo = this.scene.fireTorpedo(
            ship,
            weaponType,
            targetPos.x,
            targetPos.y
        );
        
        if (torpedo) {
            AILogger.log(
                ship,
                this.name,
                "Torpedo Fired",
                `Weapon ${weaponType} fired at target ${target.id} from distance ${distance.toFixed(0)}m.`,
                LogLevel.WARN,
                {
                    ...context,
                    action: 'fireTorpedo',
                    targetId: target.id,
                    torpedoId: torpedo.id,
                    weaponType,
                    distance,
                    angleDiff: angleInfo.diff,
                    targetPosition: { x: targetPos.x, y: targetPos.y },
                    firePosition: { x: ship.x, y: ship.y },
                    torpedosRemaining: ship.getTorpOnBoard(weaponType)
                }
            );
        } else {
            AILogger.log(
                ship,
                this.name,
                "Torpedo Fire Failed",
                `Failed to fire weapon ${weaponType} at target ${target.id}.`,
                LogLevel.ERROR,
                { ...context, targetId: target.id, weaponType }
            );
        }
        
        return torpedo;
    }
}
