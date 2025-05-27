/**
 * Константы игры
 */
export class Constants {
  // Состояния торпедного аппарата
  static readonly ST_TA_EMPTY: number = 0;
  static readonly ST_TA_LOADING: number = 1;
  static readonly ST_TA_READY: number = 2;
  
  // Лампы и индикаторы
  static readonly LAMP_TRPRD_I: string = "TRD I";
  static readonly LAMP_TRPRD_II: string = "TRD II";
  static readonly LAMP_TRPRD_III: string = "TRD III";
  static readonly LAMP_TRPRD_IV: string = "TRD IV";
  static readonly LAMP_PERISCOPE: string = "LAMP_PERISCOPE";
  static readonly LAMP_WP: string = "LAMP_WP";
  static readonly LAMP_TRP_ATACK: string = "TATC";
  
  // Типы оружия
  static readonly WEAPON_SELECT_UNKNOWN: number = 0;
  static readonly WEAPON_SELECT_TORP_I: number = 1;
  static readonly WEAPON_SELECT_TORP_II: number = 2;
  static readonly WEAPON_SELECT_TORP_III: number = 3;
  static readonly WEAPON_SELECT_TORP_IV: number = 4;
  
  // Стороны конфликта
  static readonly FORCES_RED: number = 0;
  static readonly FORCES_WHITE: number = 1;
  
  // Цвета
  static readonly COLOR_DARK_GRAY: number = 0x828282;
  static readonly COLOR_WHITE: number = 0x7fff00;
  static readonly COLOR_LIGHT_RED: number = 0xFF4500;
  static readonly COLOR_LIGHT_WHITE: number = 0xFFFFFF;
  static readonly COLOR_LIGHT_GREEN: number = 0x7fff00;
  static readonly COLOR_LIGHT_YELLOW: number = 0xffff00;
  static readonly COLOR_LIGHT_GRY: number = 0xF5F5F5;
  static readonly COLOR_DARK_RED: number = 0xA52A2A;
  static readonly COLOR_DARK_WHITE: number = 0xA9A9A9;
  static readonly COLOR_MADIUM_RED: number = 0xC71585;
  static readonly COLOR_MADIUM_WHITE: number = 0xDCDCDC;
  
  // Настройки точек маршрута (старые, будут удалены или пересмотрены)
  static readonly WAY_POINT_SIZE: number = 10; // Этот параметр может быть полезен (как arrivalThreshold в Vehicle)
  static readonly WAY_POINT_COLOR: number = 0x90EE90;
  static readonly WAY_POINT_COLOR_TORPED: number = 0xFF6347;
  static readonly WAY_POINT_COLOR_TARGET: number = 0x000000;
  static readonly WAY_POINT_COLOR_T_DEFENCE: number = 0xFF8247;
  
  // Старые типы точек маршрута - УДАЛЯЕМ ЭТОТ БЛОК
  // static readonly WP_SHIP: number = 1;
  // static readonly WP_TARGET: number = 2; // Дубликат
  // static readonly WP_TARGET_SEARCH: number = 3; // Дубликат WP_TYPE_SEARCH
  // static readonly WP_TORP: number = 4;
  // static readonly WP_TORP_DEFENCE: number = 5; // Аналог WP_TYPE_MANEUVER
  // static readonly WP_CONVOY: number = 6; // Дубликат WP_TYPE_CONVOY
  
  // Актуальные типы путевых точек (используются в Ship.ts и Vehicle.ts)
  static readonly WP_TYPE_MOVE: number = 0;     // Обычное движение к точке
  static readonly WP_TYPE_SEARCH: number = 1;   // Движение к точке в режиме поиска
  static readonly WP_TYPE_CONVOY: number = 2;   // Движение в составе конвоя
  static readonly WP_TYPE_MANEUVER: number = 3; // Маневр (например, уклонение от торпеды)
  static readonly WP_TYPE_TARGET: number = 4;   // Точка на конкретной цели (замена старого WP_TARGET)
  static readonly WP_TYPE_TORPEDO_TARGET: number = 100; // Specific for player-aimed torpedo Type I - ADDED

  // Глубины отображения (Z-index)
  static readonly DEPTH_GRID: number = -99;
  static readonly DEPTH_WAYPOINT: number = -50; // Путевые точки выше сетки, но ниже кораблей
  static readonly DEPTH_VEHICLE_DEFAULT: number = 0;
  static readonly DEPTH_NOISE_CIRCLES: number = 25;
  static readonly DEPTH_UI_BASE: number = 100; // Базовая глубина для UI элементов
  static readonly DEPTH_TEXT_INFO: number = 30;
  static readonly DEPTH_UI_ELEMENTS: number = 50; // ADDED - For torpedo cursor and aiming line

  // Глубины для подводной лодки (в метрах)
} 