import Phaser from 'phaser';

/**
 * Интерфейс для информации о сценарии
 */
interface ScenarioInfo {
  id: string;
  name: string;
  description: string;
}

/**
 * Сцена меню выбора сценария
 */
export class MenuScene extends Phaser.Scene {
  private scenarios: ScenarioInfo[] = [
    {
      id: 'scenario1',
      name: 'Сценарий 1',
      description: 'Выход из порта и уничтожение вражеского корабля'
    },
    {
      id: 'scenario_2',
      name: 'Сценарий 2',
      description: 'Уничтожение вражеского корабля'
    },
    {
      id: 'scenario_test_1',
      name: 'Тестовый сценарий',
      description: 'Только Kashin и Hunter (без лодки игрока)'
    }
  ];

  private selectedIndex: number = 0;
  private menuItems: Phaser.GameObjects.Text[] = [];
  private titleText!: Phaser.GameObjects.Text;
  private descriptionText!: Phaser.GameObjects.Text;
  private selector!: Phaser.GameObjects.Text; // Индикатор выбора

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;
    const FONT_FAMILY = '"Courier New", Courier, monospace';
    const TITLE_COLOR = '#e94560';
    const TEXT_COLOR = '#ffffff';
    const INACTIVE_COLOR = '#a0a0a0';
    const SELECTOR_COLOR = '#e94560';

    // Фон
    this.cameras.main.setBackgroundColor('#1a1a2e');

    // Заголовок
    this.titleText = this.add.text(width / 2, 80, 'SILENT RED STORM', {
      fontSize: '48px',
      color: TITLE_COLOR,
      fontFamily: FONT_FAMILY,
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Подзаголовок
    this.add.text(width / 2, 140, 'Выберите сценарий', {
      fontSize: '24px',
      color: TEXT_COLOR,
      fontFamily: FONT_FAMILY
    }).setOrigin(0.5);
    
    // Блок для описания
    const descriptionBoxY = height - 200;
    const descriptionBoxHeight = 100;
    const descriptionBox = this.add.graphics();
    descriptionBox.fillStyle(0x000000, 0.4);
    descriptionBox.fillRoundedRect(width / 2 - 350, descriptionBoxY, 700, descriptionBoxHeight, 10);
    
    // Описание выбранного сценария
    this.descriptionText = this.add.text(width / 2, descriptionBoxY + descriptionBoxHeight / 2, '', {
      fontSize: '18px',
      color: INACTIVE_COLOR,
      fontFamily: FONT_FAMILY,
      align: 'center',
      wordWrap: { width: 680 }
    }).setOrigin(0.5);

    // Создаем пункты меню
    const startY = 220;
    const spacing = 60;
    
    // Индикатор выбора
    this.selector = this.add.text(0, 0, '>', {
      fontSize: '28px',
      color: SELECTOR_COLOR,
      fontFamily: FONT_FAMILY,
    }).setOrigin(0.5);

    this.scenarios.forEach((scenario, index) => {
      const y = startY + index * spacing;
      const text = this.add.text(width / 2, y, scenario.name, {
        fontSize: '28px',
        color: TEXT_COLOR,
        fontFamily: FONT_FAMILY,
      }).setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          this.selectedIndex = index;
          this.updateMenu();
          this.updateDescription();
        })
        .on('pointerdown', () => {
          this.startScenario();
        });

      this.menuItems.push(text);
    });

    // Обновляем всё при создании
    this.updateMenu();
    this.updateDescription();

    // Управление клавиатурой
    this.input.keyboard?.on('keydown-UP', () => {
      this.selectPrevious();
    });

    this.input.keyboard?.on('keydown-DOWN', () => {
      this.selectNext();
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
      this.startScenario();
    });

    this.input.keyboard?.on('keydown-SPACE', () => {
      this.startScenario();
    });

    // Подсказки
    this.add.text(width / 2, height - 50, '↑ ↓ - Выбор | Enter/Space - Запуск', {
      fontSize: '16px',
      color: '#666666',
      fontFamily: FONT_FAMILY
    }).setOrigin(0.5);
  }

  private selectPrevious(): void {
    this.selectedIndex = (this.selectedIndex - 1 + this.scenarios.length) % this.scenarios.length;
    this.updateMenu();
    this.updateDescription();
  }

  private selectNext(): void {
    this.selectedIndex = (this.selectedIndex + 1) % this.scenarios.length;
    this.updateMenu();
    this.updateDescription();
  }

  private updateMenu(): void {
    this.menuItems.forEach((item, index) => {
      if (index === this.selectedIndex) {
        item.setColor('#e94560');
        item.setStyle({ fontStyle: 'bold' });
        
        // Обновляем позицию селектора
        this.selector.x = item.x - item.width / 2 - 30;
        this.selector.y = item.y;
        this.selector.setVisible(true);

      } else {
        item.setColor('#ffffff');
        item.setStyle({ fontStyle: 'normal' });
      }
    });
  }

  private updateDescription(): void {
    const selectedScenario = this.scenarios[this.selectedIndex];
    this.descriptionText.setText(selectedScenario.description);
  }

  private startScenario(): void {
    const selectedScenario = this.scenarios[this.selectedIndex];
    console.log(`Запуск сценария: ${selectedScenario.id}`);
    
    // Переходим к игровой сцене с данными о выбранном сценарии
    this.scene.start('MainScene', { scenarioName: selectedScenario.id });
  }
}

