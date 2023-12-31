import { isMac } from '@/helpers/system';
import { container } from '@services/container';
import { IPreferenceService } from '@services/preferences/interface';
import serviceIdentifier from '@services/serviceIdentifier';
import { IWorkspaceViewService } from '@services/workspacesView/interface';
import { BrowserWindow } from 'electron';
import { IWindowService } from './interface';
import { WindowNames } from './WindowProperties';

export function registerBrowserViewWindowListeners(newWindow: BrowserWindow, windowName: WindowNames): void {
  const preferenceService = container.get<IPreferenceService>(serviceIdentifier.Preference);
  const windowService = container.get<IWindowService>(serviceIdentifier.Window);
  const workspaceViewService = container.get<IWorkspaceViewService>(serviceIdentifier.WorkspaceView);

  // Enable swipe to navigate
  void preferenceService.get('swipeToNavigate').then((swipeToNavigate) => {
    if (swipeToNavigate) {
      if (newWindow === undefined) return;
      newWindow.on('swipe', (_event, direction) => {
        const view = newWindow?.getBrowserView();
        // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
        if (view) {
          if (direction === 'left') {
            view.webContents.goBack();
          } else if (direction === 'right') {
            view.webContents.goForward();
          }
        }
      });
    }
  });
  // Hide window instead closing on macos
  newWindow.on('close', async (event) => {
    const windowMeta = await windowService.getWindowMeta(WindowNames.main);
    if (newWindow === undefined) return;
    if (isMac && windowMeta?.forceClose !== true) {
      event.preventDefault();
      // https://github.com/electron/electron/issues/6033#issuecomment-242023295
      if (newWindow.isFullScreen()) {
        newWindow.once('leave-full-screen', () => {
          if (newWindow !== undefined) {
            newWindow.hide();
          }
        });
        newWindow.setFullScreen(false);
      } else {
        newWindow.hide();
      }
    }
  });

  newWindow.on('focus', () => {
    if (newWindow === undefined) return;
    const view = newWindow?.getBrowserView();
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    view?.webContents?.focus();
  });

  newWindow.on('enter-full-screen', async () => {
    const mainWindow = windowService.get(windowName);
    if (mainWindow === undefined) return;
    mainWindow?.webContents?.send?.('is-fullscreen-updated', true);
    await workspaceViewService.realignActiveWorkspace();
  });
  newWindow.on('leave-full-screen', async () => {
    const mainWindow = windowService.get(windowName);
    if (mainWindow === undefined) return;
    mainWindow?.webContents?.send?.('is-fullscreen-updated', false);
    await workspaceViewService.realignActiveWorkspace();
  });
}