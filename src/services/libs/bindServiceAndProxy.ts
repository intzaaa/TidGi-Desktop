/**
 * Don't forget to edit src/preload/common/services.ts to export service to renderer process
 */
import { registerProxy } from 'electron-ipc-cat/server';

import serviceIdentifier from '@services/serviceIdentifier';
import { container } from '@services/container';

import { Authentication } from '@services/auth';
import { ContextService } from '@services/context';
import { Git } from '@services/git';
import { MenuService } from '@services/menu';
import { NativeService } from '@services/native';
import { NotificationService } from '@services/notifications';
import { Preference } from '@services/preferences';
import { SystemPreference } from '@services/systemPreferences';
import { ThemeService } from '@services/theme';
import { Updater } from '@services/updater';
import { View } from '@services/view';
import { Wiki } from '@services/wiki';
import { WikiGitWorkspace } from '@services/wikiGitWorkspace';
import { Window } from '@services/windows';
import { Workspace } from '@services/workspaces';
import { WorkspaceView } from '@services/workspacesView';

import type { IAuthenticationService } from '@services/auth/interface';
import { AuthenticationServiceIPCDescriptor } from '@services/auth/interface';
import type { IContextService } from '@services/context/interface';
import { ContextServiceIPCDescriptor } from '@services/context/interface';
import type { IGitService } from '@services/git/interface';
import { GitServiceIPCDescriptor } from '@services/git/interface';
import type { IMenuService } from '@services/menu/interface';
import { MenuServiceIPCDescriptor } from '@services/menu/interface';
import type { INativeService } from '@services/native/interface';
import { NativeServiceIPCDescriptor } from '@services/native/interface';
import type { INotificationService } from '@services/notifications/interface';
import { NotificationServiceIPCDescriptor } from '@services/notifications/interface';
import type { IPreferenceService } from '@services/preferences/interface';
import { PreferenceServiceIPCDescriptor } from '@services/preferences/interface';
import type { ISystemPreferenceService } from '@services/systemPreferences/interface';
import { SystemPreferenceServiceIPCDescriptor } from '@services/systemPreferences/interface';
import type { IThemeService } from '@services/theme/interface';
import { ThemeServiceIPCDescriptor } from '@services/theme/interface';
import type { IUpdaterService } from '@services/updater/interface';
import { UpdaterServiceIPCDescriptor } from '@services/updater/interface';
import type { IViewService } from '@services/view/interface';
import { ViewServiceIPCDescriptor } from '@services/view/interface';
import type { IWikiGitWorkspaceService } from '@services/wikiGitWorkspace/interface';
import { WikiGitWorkspaceServiceIPCDescriptor } from '@services/wikiGitWorkspace/interface';
import type { IWikiService } from '@services/wiki/interface';
import { WikiServiceIPCDescriptor } from '@services/wiki/interface';
import type { IWindowService } from '@services/windows/interface';
import { WindowServiceIPCDescriptor } from '@services/windows/interface';
import type { IWorkspaceService } from '@services/workspaces/interface';
import { WorkspaceServiceIPCDescriptor } from '@services/workspaces/interface';
import type { IWorkspaceViewService } from '@services/workspacesView/interface';
import { WorkspaceViewServiceIPCDescriptor } from '@services/workspacesView/interface';

export function bindServiceAndProxy(): void {
  container.bind<IAuthenticationService>(serviceIdentifier.Authentication).to(Authentication).inSingletonScope();
  container.bind<IContextService>(serviceIdentifier.Context).to(ContextService).inSingletonScope();
  container.bind<IGitService>(serviceIdentifier.Git).to(Git).inSingletonScope();
  container.bind<IMenuService>(serviceIdentifier.MenuService).to(MenuService).inSingletonScope();
  container.bind<INativeService>(serviceIdentifier.NativeService).to(NativeService).inSingletonScope();
  container.bind<INotificationService>(serviceIdentifier.NotificationService).to(NotificationService).inSingletonScope();
  container.bind<IPreferenceService>(serviceIdentifier.Preference).to(Preference).inSingletonScope();
  container.bind<ISystemPreferenceService>(serviceIdentifier.SystemPreference).to(SystemPreference).inSingletonScope();
  container.bind<IThemeService>(serviceIdentifier.ThemeService).to(ThemeService).inSingletonScope();
  container.bind<IUpdaterService>(serviceIdentifier.Updater).to(Updater).inSingletonScope();
  container.bind<IViewService>(serviceIdentifier.View).to(View).inSingletonScope();
  container.bind<IWikiGitWorkspaceService>(serviceIdentifier.WikiGitWorkspace).to(WikiGitWorkspace).inSingletonScope();
  container.bind<IWikiService>(serviceIdentifier.Wiki).to(Wiki).inSingletonScope();
  container.bind<IWindowService>(serviceIdentifier.Window).to(Window).inSingletonScope();
  container.bind<IWorkspaceService>(serviceIdentifier.Workspace).to(Workspace).inSingletonScope();
  container.bind<IWorkspaceViewService>(serviceIdentifier.WorkspaceView).to(WorkspaceView).inSingletonScope();

  const authService = container.get<IAuthenticationService>(serviceIdentifier.Authentication);
  const contextService = container.get<IContextService>(serviceIdentifier.Context);
  const gitService = container.get<IGitService>(serviceIdentifier.Git);
  const menuService = container.get<IMenuService>(serviceIdentifier.MenuService);
  const nativeService = container.get<INativeService>(serviceIdentifier.NativeService);
  const notificationService = container.get<INotificationService>(serviceIdentifier.NotificationService);
  const preferenceService = container.get<IPreferenceService>(serviceIdentifier.Preference);
  const systemPreferenceService = container.get<ISystemPreferenceService>(serviceIdentifier.SystemPreference);
  const themeService = container.get<IThemeService>(serviceIdentifier.ThemeService);
  const updaterService = container.get<IUpdaterService>(serviceIdentifier.Updater);
  const viewService = container.get<IViewService>(serviceIdentifier.View);
  const wikiGitWorkspaceService = container.get<IWikiGitWorkspaceService>(serviceIdentifier.WikiGitWorkspace);
  const wikiService = container.get<IWikiService>(serviceIdentifier.Wiki);
  const windowService = container.get<IWindowService>(serviceIdentifier.Window);
  const workspaceService = container.get<IWorkspaceService>(serviceIdentifier.Workspace);
  const workspaceViewService = container.get<IWorkspaceViewService>(serviceIdentifier.WorkspaceView);

  registerProxy(authService, AuthenticationServiceIPCDescriptor);
  registerProxy(contextService, ContextServiceIPCDescriptor);
  registerProxy(gitService, GitServiceIPCDescriptor);
  registerProxy(menuService, MenuServiceIPCDescriptor);
  registerProxy(nativeService, NativeServiceIPCDescriptor);
  registerProxy(notificationService, NotificationServiceIPCDescriptor);
  registerProxy(preferenceService, PreferenceServiceIPCDescriptor);
  registerProxy(systemPreferenceService, SystemPreferenceServiceIPCDescriptor);
  registerProxy(themeService, ThemeServiceIPCDescriptor);
  registerProxy(updaterService, UpdaterServiceIPCDescriptor);
  registerProxy(viewService, ViewServiceIPCDescriptor);
  registerProxy(wikiGitWorkspaceService, WikiGitWorkspaceServiceIPCDescriptor);
  registerProxy(wikiService, WikiServiceIPCDescriptor);
  registerProxy(windowService, WindowServiceIPCDescriptor);
  registerProxy(workspaceService, WorkspaceServiceIPCDescriptor);
  registerProxy(workspaceViewService, WorkspaceViewServiceIPCDescriptor);
}
