/**
 * Собирает статистику по игре
 */
export class Statistic {
  /**
   * Количество попаданий во врагов
   */
  static enemy_hit_count: number = 0;
  
  /**
   * Количество попаданий в наши суда
   */
  static friend_hit_count: number = 0;
  
  /**
   * Количество потопленных врагов
   */
  static enemy_destroyed: number = 0;
  
  /**
   * Количество потопленных наших
   */
  static friend_destroyed: number = 0;
  
  /**
   * Количество выстрелов по врагам
   */
  static enemy_fire_count: number = 0;
  
  /**
   * Количество выстрелов по нашим судам
   */
  static friend_fire_count: number = 0;
  
  /**
   * Время выхода из порта (пересечения области port_line)
   */
  static time_leave_port_sec: number = 0;
  
  /**
   * Время выполнения миссии (сек)
   */
  static time_game_sec: number = 0;
  
  /**
   * Время потраченное на работу AI
   */
  static AI_calc_time: number = 0;

  /**
   * Сбрасывает статистику
   */
  static reset(): void {
    this.enemy_hit_count = 0;
    this.friend_hit_count = 0;
    this.enemy_destroyed = 0;
    this.friend_destroyed = 0;
    this.enemy_fire_count = 0;
    this.friend_fire_count = 0;
    this.time_leave_port_sec = 0;
    this.time_game_sec = 0;
    this.AI_calc_time = 0;
  }
} 