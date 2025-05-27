/**
 * Параметры торпеды
 */
export interface TorpedoParams {
  /**
   * Максимальная скорость торпеды
   */
  maxVelocity: number;
  
  /**
   * Время жизни торпеды в секундах
   */
  lifeTimeSec: number;
  
  /**
   * Маневренность в процентах
   */
  maneuvering: number;
  
  /**
   * Время перезарядки в секундах
   */
  reloadTimeSec: number;
  
  /**
   * Урон от попадания
   */
  damage: number;
  
  /**
   * Дистанция применения
   */
  executionDist: number;
  
  /**
   * Дистанция принятия цели (для самонаводящихся торпед)
   */
  targetAcceptDist?: number;
} 