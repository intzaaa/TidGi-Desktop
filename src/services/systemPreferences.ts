import { app, ipcMain } from 'electron';
import { injectable } from 'inversify';

interface IUsedElectionSettings {
  openAtLogin: 'yes-hidden' | 'yes' | 'no';
}

/**
 * System Preferences are not stored in storage but stored in macOS Preferences.
 * It can be retrieved and changed using Electron APIs
 */
@injectable()
export class SystemPreference {
  constructor() {
    this.init();
  }

  init(): void {
    ipcMain.handle('get-system-preference', (event, key: keyof IUsedElectionSettings) => {
      event.returnValue = this.get(key);
    });
    ipcMain.handle('get-system-preferences', (event) => {
      const preferences = this.getSystemPreferences();
      event.returnValue = preferences;
    });
    ipcMain.handle('request-set-system-preference', <K extends keyof IUsedElectionSettings>(_: unknown, key: K, value: IUsedElectionSettings[K]) => {
      this.setSystemPreference(key, value);
    });
  }

  public get<K extends keyof IUsedElectionSettings>(key: K): IUsedElectionSettings[K] {
    switch (key) {
      case 'openAtLogin': {
        // return our custom setting enum, to be cross-platform
        const loginItemSettings = app.getLoginItemSettings();
        const { openAtLogin, openAsHidden } = loginItemSettings;
        if (openAtLogin && openAsHidden) return 'yes-hidden';
        if (openAtLogin) return 'yes';
        return 'no';
      }
      default: {
        throw new Error(`Try to get ${key} in SystemPreference, but it is not existed`);
      }
    }
  }

  public getSystemPreferences(): IUsedElectionSettings {
    return {
      openAtLogin: this.get('openAtLogin'),
    };
  }

  public setSystemPreference<K extends keyof IUsedElectionSettings>(key: K, value: IUsedElectionSettings[K]): void {
    switch (key) {
      case 'openAtLogin': {
        app.setLoginItemSettings({
          openAtLogin: value.startsWith('yes'),
          openAsHidden: value === 'yes-hidden',
        });
        break;
      }
      default: {
        break;
      }
    }
    // TODO: sendToAllWindows?, maybe do this in the base class
    // sendToAllWindows('set-system-preference', name, value);
  }
}
