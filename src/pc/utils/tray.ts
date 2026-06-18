import { TrayIcon } from '@tauri-apps/api/tray';
import { Menu } from '@tauri-apps/api/menu';
import { defaultWindowIcon } from '@tauri-apps/api/app';

/**
 * 设置系统托盘图标（前端版本）
 * 注意：通常由后端 Rust 代码处理，这是备用方案
 */
export async function setupTray() {
  try {
    // 创建托盘菜单
    const menu = await Menu.new({
      items: [
        {
          id: 'show',
          text: '显示主窗口',
          action: () => {
            console.log('显示主窗口');
            // 可以调用 Tauri API 显示窗口
          }
        },
        {
          id: 'hide',
          text: '隐藏窗口',
          action: () => {
            console.log('隐藏窗口');
          }
        },
        {
          id: 'separator',
          text: '',
        },
        {
          id: 'quit',
          text: '退出',
          action: () => {
            console.log('退出应用');
            // 可以调用 Tauri API 退出应用
          }
        }
      ]
    });

    // 创建托盘图标
    const icon = await defaultWindowIcon();
    if (!icon) {
      throw new Error('无法获取默认窗口图标');
    }

    const tray = await TrayIcon.new({
      icon,
      menu,
      menuOnLeftClick: false,
      tooltip: 'Envis - 环境和服务管理工具',
      action: (event) => {
        switch (event.type) {
          case 'Click':
            console.log(
              `鼠标 ${event.button} 按钮按下, 状态: ${event.buttonState}`
            );
            break;
          case 'DoubleClick':
            console.log(`鼠标 ${event.button} 按钮双击`);
            break;
          case 'Enter':
            console.log(
              `鼠标进入托盘图标 位置: ${event.rect.position.x}, ${event.rect.position.y}`
            );
            break;
          case 'Move':
            console.log(
              `鼠标在托盘图标移动 位置: ${event.rect.position.x}, ${event.rect.position.y}`
            );
            break;
          case 'Leave':
            console.log(
              `鼠标离开托盘图标 位置: ${event.rect.position.x}, ${event.rect.position.y}`
            );
            break;
        }
      }
    });

    console.log('系统托盘图标已创建', tray);
    return tray;
  } catch (error) {
    console.error('创建系统托盘图标失败:', error);
    throw error;
  }
}

/**
 * 更新托盘图标标题
 */
export async function updateTrayTitle(title: string) {
  try {
    // 这里需要保存 tray 实例的引用
    console.log('更新托盘标题:', title);
  } catch (error) {
    console.error('更新托盘标题失败:', error);
  }
}
