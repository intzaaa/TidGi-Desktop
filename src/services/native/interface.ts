import { MessageBoxOptions } from 'electron';

import { ProxyPropertyType } from '@/helpers/electron-ipc-proxy/common';
import { NativeChannel } from '@/constants/channels';
import { WindowNames } from '@services/windows/WindowProperties';

/**
 * Wrap call to electron api, so we won't need remote module in renderer process
 */
export interface INativeService {
  executeZxScript(zxWorkerArguments: { fileContent: string; fileName: string }): Promise<string>;
  open(uri: string, isDirectory?: boolean): Promise<void>;
  pickDirectory(defaultPath?: string): Promise<string[]>;
  pickFile(filters?: Electron.OpenDialogOptions['filters']): Promise<string[]>;
  quit(): void;
  showElectronMessageBox(message: string, type: MessageBoxOptions['type'], WindowName?: WindowNames): Promise<void>;
}
export const NativeServiceIPCDescriptor = {
  channel: NativeChannel.name,
  properties: {
    executeZxScript: ProxyPropertyType.Function,
    open: ProxyPropertyType.Function,
    pickDirectory: ProxyPropertyType.Function,
    pickFile: ProxyPropertyType.Function,
    quit: ProxyPropertyType.Function,
    showElectronMessageBox: ProxyPropertyType.Function,
  },
};
