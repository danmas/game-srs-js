import { Ship } from '../../objects/Ship';
import { Submarine } from '../../objects/Submarine';
import { Vehicle } from '../../objects/Vehicle';
import { MainScene } from '../../scenes/MainScene';
import { Constants } from '../../utils/Constants';
import { Settings } from '../../utils/Settings';
import { DetectionState } from '../../utils/DetectionState';
import { BaseAIStrategy } from './BaseAIStrategy';
import { AIWorldContext } from './AIStrategy';
import { CoordUtils } from '../../utils/CoordUtils';
import { AILogger } from '../../utils/AILogger';
import { LogLevel } from '../../utils/UniversalLogger';
import * as Phaser from 'phaser';

/**
 * Стратегия для торгового корабля с торпедами.
 * Убегает при обнаружении врагов (включая подводные лодки) даже в Зоне 1.
 * Атакует врагов в ближнем бою (близко и обнаружен в Зоне 2+).
 */
export class MerchantShipStrategy extends BaseAIStrategy {
    public readonly name: string = "Торговый Корабль";
    public readonly description: string = "Убегает при обнаружении врагов (включая подлодки в Зоне 1). Атакует в ближнем бою.";
    
    private threatId: number | null = null;
    private escapeUpdateTime: number = 0;
    private readonly escapeUpdateInterval: number = 1000; // Обновление направления уклонения каждую секунду
    private lastKnownThreatPosition: Phaser.Math.Vector2 | null = null;
    
    /**
     * Фаза анализа - обнаружение угроз и оценка ситуации
     */
    public analyzeStep(owner: Vehicle, context: AIWorldContext): void {
        // Принудительное логирование СРАЗУ для отладки
        console.log(`[MerchantShipStrategy] analyzeStep called for ${owner.entityType} ${owner.id}, active=${owner.active}, isShip=${owner instanceof Ship}`);
        
        if (!owner.active || !(owner instanceof Ship)) return;
        
        const ship = owner as Ship;
        console.log(`[MerchantShipStrategy] analyzeStep continuing for Ship ${ship.id}`);
        
        // Периодическое логирование статуса ИИ (общая функция)
        this.logPeriodicStatus(ship, context, {
            currentThreat: this.threatId
        });
        
        // Обновляем поиск угрозы с определенным интервалом
        this.escapeUpdateTime += Settings.SLOW_LOOP_INTERVAL_MS;
        if (this.escapeUpdateTime >= this.escapeUpdateInterval) {
            this.escapeUpdateTime = 0;
            this.findThreat(ship, context);
        }
        
        // Автоматическая проверка здоровья и повышение скорости (общая функция)
        this.checkHealthAndAdjustSpeed(ship, context, 200, Vehicle.POWER_4);
    }
    
    /**
     * Фаза действия - убегание или атака в крайнем случае
     */
    public actionStep(owner: Vehicle, context: AIWorldContext): void {
        // Принудительное логирование СРАЗУ для отладки
        console.log(`[MerchantShipStrategy] actionStep called for ${owner.entityType} ${owner.id}, active=${owner.active}, isShip=${owner instanceof Ship}`);
        
        if (!owner.active || !(owner instanceof Ship)) return;
        
        const ship = owner as Ship;
        console.log(`[MerchantShipStrategy] actionStep continuing for Ship ${ship.id}`);
        
        // Логируем вход в actionStep для отладки
        AILogger.log(ship, this.name, "Action Phase", `Evaluating situation. Threat=${this.threatId || 'none'}, Convoy=${ship.isConvoy()}`, LogLevel.INFO, { ...context, threatId: this.threatId });
        
        // Если корабль конвоя, не выполняем действия стратегии
        if (ship.isConvoy()) {
            AILogger.log(ship, this.name, "Hold Position", "Convoy ship: following convoy orders.", LogLevel.INFO, { ...context });
            return;
        }
        
        // Если есть угроза - убегаем
        if (this.threatId !== null) {
            const threatInfo = ship.perceivedTargets.get(this.threatId);
            if (threatInfo && threatInfo.targetVehicle.active) {
                const distance = Phaser.Math.Distance.Between(
                    ship.x, ship.y,
                    threatInfo.targetVehicle.x, threatInfo.targetVehicle.y
                );
                
                // Если враг очень близко и обнаружен в Зоне 2+ - атакуем
                const shouldFight = distance < 600 && 
                                    threatInfo.detectionState >= DetectionState.ZONE_2_LOCALIZED;
                
                if (shouldFight) {
                    // Атакуем врага
                    AILogger.log(
                        ship,
                        this.name,
                        "Emergency Attack",
                        `Enemy too close (${distance.toFixed(0)}m), fighting back against ${threatInfo.targetVehicle.entityType} ${this.threatId}`,
                        LogLevel.WARN,
                        {
                            action: 'emergencyAttack',
                            targetId: this.threatId,
                            distance: distance,
                            detectionState: threatInfo.detectionState,
                            position: { x: ship.x, y: ship.y },
                            targetPosition: { x: threatInfo.targetVehicle.x, y: threatInfo.targetVehicle.y }
                        }
                    );
                    this.attackInEmergency(ship, threatInfo.targetVehicle, context);
                } else {
                    // Обычный случай - убегаем
                    AILogger.log(
                        ship,
                        this.name,
                        "Evading Threat",
                        `Evading from ${threatInfo.targetVehicle.entityType} ${this.threatId} at distance ${distance.toFixed(0)}m`,
                        LogLevel.INFO,
                        {
                            action: 'evade',
                            targetId: this.threatId,
                            distance: distance,
                            detectionState: threatInfo.detectionState,
                            position: { x: ship.x, y: ship.y },
                            threatPosition: { x: threatInfo.targetVehicle.x, y: threatInfo.targetVehicle.y }
                        }
                    );
                    this.escapeFromThreat(ship, threatInfo, context);
                }
            } else {
                // Угроза исчезла
                this.threatId = null;
                this.lastKnownThreatPosition = null;
                AILogger.log(ship, this.name, "Threat Lost", "Enemy contact lost, returning to normal navigation.", LogLevel.INFO, { ...context });
            }
        } else {
            // Нет угрозы - обычное движение
            if (ship.getWayPoints().length > 0 && !ship.getIsMovingOnWayPoint()) {
                ship.startMoveOnWP();
            }
        }
    }
    
    /**
     * Поиск угрозы среди обнаруженных целей
     * Реагирует даже на Зону 1 (неопределенный контакт)
     */
    private findThreat(ship: Ship, context: AIWorldContext): void {
        this.threatId = null;
        let closestThreatDistance = Infinity;
        let mostDangerousThreat: number | null = null;
        
        for (const [id, perceivedInfo] of ship.perceivedTargets.entries()) {
            if (!perceivedInfo.targetVehicle.active || 
                perceivedInfo.targetVehicle.getForces() === ship.getForces()) {
                continue;
            }
            
            // Реагируем на врагов даже в Зоне 1 (неопределенный контакт)
            if (perceivedInfo.detectionState === DetectionState.NO_CONTACT) {
                continue; // Полностью не обнаружено - пропускаем
            }
            
            // Особенно опасаемся подводных лодок
            const isSubmarine = perceivedInfo.targetVehicle instanceof Submarine;
            const isShip = perceivedInfo.targetVehicle instanceof Ship;
            
            if (!isShip && !isSubmarine) {
                continue; // Не корабль и не подлодка
            }
            
            const distance = Phaser.Math.Distance.Between(
                ship.x, ship.y,
                perceivedInfo.targetVehicle.x, perceivedInfo.targetVehicle.y
            );
            
            // Определяем приоритет угрозы:
            // 1. Подлодка в Зоне 1+ (очень опасно) = приоритет 100
            // 2. Подлодка в Зоне 2+ = приоритет 80
            // 3. Корабль в Зоне 2+ = приоритет 60
            // 4. Корабль в Зоне 1 = приоритет 40
            let threatPriority = 0;
            if (isSubmarine) {
                if (perceivedInfo.detectionState >= DetectionState.ZONE_2_LOCALIZED) {
                    threatPriority = 80;
                } else if (perceivedInfo.detectionState === DetectionState.ZONE_1_UNCERTAIN) {
                    threatPriority = 100; // Подлодка даже в Зоне 1 - очень опасно!
                }
            } else if (isShip) {
                if (perceivedInfo.detectionState >= DetectionState.ZONE_2_LOCALIZED) {
                    threatPriority = 60;
                } else if (perceivedInfo.detectionState === DetectionState.ZONE_1_UNCERTAIN) {
                    threatPriority = 40;
                }
            }
            
            // Выбираем самую опасную угрозу (с учетом приоритета и расстояния)
            // Используем комбинированную метрику: приоритет * 1000 - расстояние
            const threatScore = threatPriority * 1000 - distance;
            
            if (threatPriority > 0 && threatScore > (closestThreatDistance < Infinity ? (mostDangerousThreat !== null ? 0 : -Infinity) : -Infinity)) {
                const currentBestScore = mostDangerousThreat !== null ? 
                    (closestThreatDistance < Infinity ? (mostDangerousThreat * 1000 - closestThreatDistance) : -Infinity) : -Infinity;
                
                if (threatScore > currentBestScore) {
                    const oldThreatId = this.threatId;
                    closestThreatDistance = distance;
                    mostDangerousThreat = threatPriority;
                    this.threatId = id;
                    
                    // Логируем обнаружение новой угрозы
                    if (oldThreatId !== id) {
                        const threatTypeName = isSubmarine ? 'Submarine' : 'Ship';
                        AILogger.log(
                            ship,
                            this.name,
                            "Threat Detected",
                            `New threat detected: ${threatTypeName} ID ${id} at distance ${distance.toFixed(0)}m, DetectionState=${perceivedInfo.detectionState}`,
                            LogLevel.WARN,
                            {
                                threatId: id,
                                threatType: threatTypeName,
                                distance: distance,
                                detectionState: perceivedInfo.detectionState,
                                threatPriority: threatPriority,
                                position: { x: ship.x, y: ship.y },
                                threatPosition: { x: perceivedInfo.targetVehicle.x, y: perceivedInfo.targetVehicle.y }
                            }
                        );
                    }
                    
                    // Сохраняем последнюю известную позицию угрозы
                    this.lastKnownThreatPosition = new Phaser.Math.Vector2(
                        perceivedInfo.targetVehicle.x,
                        perceivedInfo.targetVehicle.y
                    );
                }
            }
        }
        
        if (this.threatId !== null) {
            const threatInfo = ship.perceivedTargets.get(this.threatId);
            const threatType = threatInfo?.targetVehicle instanceof Submarine ? "Submarine" : "Ship";
            const zoneName = threatInfo?.detectionState === DetectionState.ZONE_1_UNCERTAIN ? "Zone 1" :
                           threatInfo?.detectionState === DetectionState.ZONE_2_LOCALIZED ? "Zone 2" :
                           threatInfo?.detectionState === DetectionState.ZONE_3_IDENTIFIED ? "Zone 3" : "Unknown";
            
            AILogger.log(ship, this.name, `Threat Detected: ${threatType}`, 
                `${threatType} detected in ${zoneName} at distance ${closestThreatDistance.toFixed(0)}. Initiating evasion.`, 
                LogLevel.WARN, { 
                    ...context, 
                    threatId: this.threatId,
                    threatType,
                    detectionZone: zoneName,
                    distance: closestThreatDistance
                });
        }
    }
    
    /**
     * Убегание от угрозы (использует общую функцию calculateEscapeDirection)
     */
    private escapeFromThreat(ship: Ship, threatInfo: any, context: AIWorldContext): void {
        if (!this.scene) return;
        
        // Используем последнюю известную позицию угрозы или текущую
        const threatPos = this.lastKnownThreatPosition || 
                         new Phaser.Math.Vector2(threatInfo.targetVehicle.x, threatInfo.targetVehicle.y);
        
        const shipPos = new Phaser.Math.Vector2(ship.x, ship.y);
        
        // Вычисляем направление убегания (общая функция)
        const escapeInfo = this.calculateEscapeDirection(shipPos, threatPos, 800);
        
        // Конвертируем в логические координаты
        const escapeLogicalPos = CoordUtils.phaserToLogical(escapeInfo.point);
        
        // Устанавливаем WayPoint для убегания (общая функция)
        this.setManeuverWaypoint(
            ship,
            escapeLogicalPos.x,
            escapeLogicalPos.y,
            Constants.WP_TYPE_MANEUVER,
            true,
            true
        );
        
        // Максимальная скорость для убегания
        if (ship.getPower() < Vehicle.POWER_5) {
            ship.setPower(Vehicle.POWER_5);
        }
        
        // Устанавливаем состояние маневра уклонения
        ship['moveState'] = Vehicle.ST_WP_TORP_DEFENCE_MOVING;
        
        AILogger.log(ship, this.name, "Evading Threat", 
            `Escaping from threat at angle ${escapeInfo.angleDeg.toFixed(0)}° to distance 800m.`, 
            LogLevel.WARN, { ...context, escapeAngle: escapeInfo.angleDeg });
    }
    
    /**
     * Атака врага (враг очень близко и обнаружен)
     * Использует общую функцию fireTorpedoAtTarget
     */
    private attackInEmergency(ship: Ship, target: Vehicle, context: AIWorldContext): void {
        if (!this.scene) return;
        
        // Попытка выстрела через общую функцию (она сама проверит все условия)
        const torpedo = this.fireTorpedoAtTarget(
            ship,
            target,
            Constants.WEAPON_SELECT_TORP_I,
            context,
            {
                requireDistance: Settings.TRP_I_DIST_EXECUTION,
                requireAngle: Settings.TRP_ATACK__ANGLE_WARNING,
                logAttempt: false // Не логируем каждую неудачную попытку, только успех
            }
        );
        
        // Если не смогли выстрелить - продолжаем убегать
        if (!torpedo) {
            this.escapeFromThreat(ship, { targetVehicle: target }, context);
        }
    }

    private evadeThreat(ship: Ship, context: AIWorldContext): void {
        if (this.threatId === null || !this.lastKnownThreatPosition) return;

        const shipPos = new Phaser.Math.Vector2(ship.x, ship.y);

        // Добавляем случайный offset к углу уклонения для непредсказуемости
        const randomOffset = Phaser.Math.Between(-20, 20); // ±20 градусов
        const escapeInfo = this.calculateEscapeDirection(
            shipPos,
            this.lastKnownThreatPosition,
            800
        );

        // Применяем offset к углу
        const escapeAngleRad = escapeInfo.angle + Phaser.Math.DegToRad(randomOffset);
        const escapeX = shipPos.x + Math.cos(escapeAngleRad) * 800;
        const escapeY = shipPos.y + Math.sin(escapeAngleRad) * 800;
        const adjustedEscapePoint = new Phaser.Math.Vector2(escapeX, escapeY);

        // Конвертируем в логические координаты
        const logicalPos = CoordUtils.phaserToLogical(adjustedEscapePoint);

        // Устанавливаем waypoint
        this.setManeuverWaypoint(
            ship,
            logicalPos.x,
            logicalPos.y,
            Constants.WP_TYPE_MANEUVER,
            true,
            true
        );

        // Увеличиваем скорость для уклонения
        ship.setPower(Vehicle.POWER_3);  // Уменьшено для теста

        // Логируем действие
        const distance = Phaser.Math.Distance.Between(shipPos.x, shipPos.y, this.lastKnownThreatPosition.x, this.lastKnownThreatPosition.y);
        AILogger.log(ship, this.name, "Evading Threat", `Evading from Vehicle ${this.threatId} at distance ${distance.toFixed(0)}m with offset ${randomOffset}°`, LogLevel.INFO, { ...context, evadeDistance: distance, offset: randomOffset });
    }
}

