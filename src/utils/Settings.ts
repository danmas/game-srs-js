/**
 * Настройки игры
 */
export class Settings {

  static readonly SUBMARINE_SHALLOW_DEPTH_MAX: number = 150;
  static readonly SUBMARINE_PERISCOPE_DEPTH_MAX: number = 50;

  // Информация о версии
  static readonly CURRENT_PROGRAM: string = "Silent Red Storm";
  static readonly CURRENT_VERSION: string = "v.06.0";
  static readonly CURRENT_SRS: string = `${Settings.CURRENT_PROGRAM} ${Settings.CURRENT_VERSION}`;
  static readonly CURRENT_SCENARIO: string = "Scenario1x1";
  static readonly SCENARIO_SCORE_NAME: string = Settings.CURRENT_SCENARIO;
  
  // Флаги отладки
  static readonly DEBUG: boolean = true;
  static readonly DRAW_REAL_WORLD: boolean = true;
  static readonly CHEAT: boolean = false;
  static readonly DRAW_TORPED_CALC: boolean = false;
  
  // Настройки дисплея
  static readonly SCREEN_WIDTH: number = 1100; // Размер видимого окна и UI
  static readonly SCREEN_HEIGHT: number = 900; // Размер UI
  
  // Общие размеры игрового мира (могут быть больше SCREEN_WIDTH/HEIGHT)
  static readonly GAME_WORLD_WIDTH: number = 1100*10; // Settings.SCREEN_WIDTH * 10;
  static readonly GAME_WORLD_HEIGHT: number = 5600; // Settings.SCREEN_HEIGHT * 10 * 0.6222...; // 5600, чтобы было кратно 200 и 100
  
  static readonly SCALE_MAIN: number = 1.5;
  
  // Физика
  static readonly koef_v: number = 30;
  static readonly alfa_v: number = 0.0005;
  static readonly alfa_r_0: number = 0.002;    // поворот на минимальной скорости
  static readonly alfa_r_30: number = 0.005;   // поворот на максимальной скорости
  
  // Торпеды
  static readonly HIT_TIME_RELOAD_INCREASE: number = 1.3;
  static readonly HIT_SHIP_SPEED_DECREASE: number = 1.3;
  static readonly SHIP_HIT_SIZE: number = 30;
  
  // Торпеда Тип I
  static readonly TRP_I_LIFE_TIME_SEC: number = 60;
  static readonly TRP_I_MAX_VELOCITY: number = 60.0;
  static readonly TRP_I_MANEVR_PRC: number = 80;
  static readonly TRP_I_TIME_RELOAD_SEC: number = 2;
  static readonly TRP_I_DAMEGE: number = 1000.0;
  static readonly TRP_I_DIST_EXECUTION: number = 1000.0;
  
  // Торпеда Тип II
  static readonly TRP_II_LIFE_TIME_SEC: number = 60;
  static readonly TRP_II_MAX_VELOCITY: number = 50.0;
  static readonly TRP_II_MANEVR_PRC: number = 80;
  static readonly TRP_II_TIME_RELOAD_SEC: number = 2;
  static readonly TRP_II_DAMEGE: number = 800.0;
  static readonly TRP_II_DIST_EXECUTION: number = 1000.0;
  
  // Торпеда Тип III
  static readonly TRP_III_LIFE_TIME_SEC: number = 30;
  static readonly TRP_III_MAX_VELOCITY: number = 38.0;
  static readonly TRP_III_TRG_ACCEPT_DIST: number = 200.0;
  static readonly TRP_III_MANEVR_PRC: number = 80;
  static readonly TRP_III_TIME_RELOAD_SEC: number = 2;
  static readonly TRP_III_DAMEGE: number = 500.0;
  static readonly TRP_III_DIST_EXECUTION: number = 300.0;
  
  // Другие настройки
  static readonly koef_coast: number = 15;
  static readonly TAIL_MAX_LENGTH: number = 10;
  static readonly TAIL_TIME_INTERVAL: number = 1000;
  static readonly TAIL_COLOR: number = 0x00FF00;
  
  // Интервалы обновления
  static readonly MOVE_INTERVAL_MS: number = 20;
  static readonly SLOW_LOOP_INTERVAL_MS: number = 500;
  
  // ИИ настройки
  static readonly AI_torped_fire_interval: number = 100;
  static readonly WEB_ENABLE: boolean = true;
  
  // Настройки логирования
  static readonly LOG_MIN_LEVEL: number = 2;  // 0=TRACE, 1=DEBUG, 2=INFO, 3=WARN, 4=ERROR
  static readonly LOG_ENABLE_CONSOLE: boolean = true;
  static readonly LOG_ENABLE_LOCAL_STORAGE: boolean = true;
  static readonly LOG_ENABLE_SERVER: boolean = true;
  static readonly LOG_THROTTLE_INTERVAL: number = 1000; // мс
  static readonly LOG_USE_STRUCTURED_FORMAT: boolean = true;
  static readonly LOG_VEHICLE_THROTTLE_INTERVAL: number = 2000; // мс
  static readonly LOG_VEHICLE_THROTTLE_EVERY_NTH: number = 5; // каждый 5-й тик
  
  // Настройки атаки торпедами
  static readonly TRP_ATACK__ANGLE_WARNING: number = 180.0;
  static readonly TRP_ATACK_DISTANCE_WARNING: number = 500.0;
  static readonly TRP_ATACK_DEFENSE_ANGLE: number = 45.0;
  static readonly TRP_ATACK_ALARM_DIST: number = 300.0;
  static readonly MOVE_ON_TARGET_FROM_DIST: number = 1000;
  
  // Настройки шума
  // static readonly NOISE_TRAKCING_RANGE: number = 0.2;
  // static readonly NOISE_DIRECTION: number = 0.5;
  // static readonly NOISE_DETECTION: number = 0.8;
  public static readonly NOISE_THRESHOLD_ZONE_3_IDENTIFIED: number = 0.8; // Ранее NOISE_DETECTION
  public static readonly NOISE_THRESHOLD_ZONE_2_LOCALIZED: number = 0.5;  // Ранее NOISE_DIRECTION
  public static readonly NOISE_THRESHOLD_ZONE_1_UNCERTAIN: number = 0.2; // Ранее NOISE_TRAKCING_RANGE
  // Все, что ниже NOISE_THRESHOLD_ZONE_1_UNCERTAIN - нет контакта

  // Настройки для Зоны 1 (Неопределенный контакт)
  public static readonly ZONE_1_PING_INTERVAL_MS: number = 1000; // 5 секунд
  public static readonly ZONE_1_DISPLACEMENT_DELTA_LOGICAL: number = 150; // 50 игровых единиц в логических координатах
  
  // Настройки для точек маршрута и хвоста
  static readonly WAY_POINT_COLOR: number = 0x90EE90; // Светло-зеленый для путевых точек
  
  // Максимальная дальность обнаружения (используется как "бесконечность" для некоторых расчетов)
  static readonly MAX_DETECTION_RANGE: number = 2000; // Максимальная дальность обнаружения для торпед
  
  // Настройки для точности угла в градусах для движения по путевым точкам
  static readonly ANGLE_PRECISION_FOR_WP: number = 5;
  
  // Порог для клика рядом с WP для ее удаления
  static readonly WAYPOINT_CLICK_DELETE_THRESHOLD: number = 25; // Пиксели в мировых координатах
  
  // Цвета
  public static SHIP_STROKE_COLOR: number = 0xffffff;
  public static SHIP_STROKE_COLOR_SELECTED: number = 0x00ff00;
  
  // Статический блок для отладки или инициализации, если нужен
  static {
    // console.log(`Settings initialized. DEBUG: ${Settings.DEBUG}`);
  }

  constructor() {
    // Конструктор обычно не используется для статических классов-хелперов
    // Если бы это был инстанцируемый класс, здесь была бы логика.
  }
}