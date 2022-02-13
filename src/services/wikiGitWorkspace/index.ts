import path from 'path';
import { app, dialog, powerMonitor } from 'electron';
import { injectable } from 'inversify';

import serviceIdentifier from '@services/serviceIdentifier';
import type { IWikiService } from '@services/wiki/interface';
import type { IGitService, IGitUserInfos } from '@services/git/interface';
import type { INewWorkspaceConfig, IWorkspace, IWorkspaceService } from '@services/workspaces/interface';
import type { IWorkspaceViewService } from '@services/workspacesView/interface';
import type { IWindowService } from '@services/windows/interface';
import type { IAuthenticationService } from '@services/auth/interface';
import { WindowNames } from '@services/windows/WindowProperties';
import { lazyInject } from '@services/container';

import { logger } from '@services/libs/log';
import i18n from '@services/libs/i18n';
import { IWikiGitWorkspaceService } from './interface';
import { InitWikiGitError, InitWikiGitRevertError, InitWikiGitSyncedWikiNoGitUserInfoError } from './error';
import { SupportedStorageServices } from '@services/types';
import { hasGit } from 'git-sync-js';

@injectable()
export class WikiGitWorkspace implements IWikiGitWorkspaceService {
  @lazyInject(serviceIdentifier.Authentication) private readonly authService!: IAuthenticationService;
  @lazyInject(serviceIdentifier.Wiki) private readonly wikiService!: IWikiService;
  @lazyInject(serviceIdentifier.Git) private readonly gitService!: IGitService;
  @lazyInject(serviceIdentifier.Workspace) private readonly workspaceService!: IWorkspaceService;
  @lazyInject(serviceIdentifier.Window) private readonly windowService!: IWindowService;
  @lazyInject(serviceIdentifier.WorkspaceView) private readonly workspaceViewService!: IWorkspaceViewService;

  public registerSyncBeforeShutdown(): void {
    const listener = async (event: Event): Promise<void> => {
      event.preventDefault();
      try {
        const workspaces = await this.workspaceService.getWorkspacesAsList();
        const workspacesToSync = workspaces.filter((workspace) => workspace.storageService !== SupportedStorageServices.local);
        await Promise.allSettled(
          workspacesToSync.map(async (workspace) => {
            const userInfo = await this.authService.getStorageServiceUserInfo(workspace.storageService);
            if (userInfo !== undefined && workspace.gitUrl !== null) {
              await this.gitService.commitAndSync(workspace.wikiFolderLocation, workspace.gitUrl, userInfo);
            }
          }),
        );
      } catch (error) {
        logger.error(`SyncBeforeShutdown failed`, { error });
      } finally {
        app.quit();
      }
    };
    powerMonitor.addListener('shutdown', listener);
  }

  public initWikiGitTransaction = async (newWorkspaceConfig: INewWorkspaceConfig, userInfo?: IGitUserInfos): Promise<IWorkspace | undefined> => {
    const newWorkspace = await this.workspaceService.create(newWorkspaceConfig);
    const { gitUrl, storageService, wikiFolderLocation, isSubWiki, id: workspaceID, mainWikiToLink } = newWorkspace;
    const isSyncedWiki = storageService !== SupportedStorageServices.local;
    try {
      if (await hasGit(wikiFolderLocation)) {
        logger.warn('Skip git init because it already has a git setup.', { wikiFolderLocation });
      } else {
        if (isSyncedWiki) {
          if (typeof gitUrl === 'string' && userInfo !== undefined) {
            await this.gitService.initWikiGit(wikiFolderLocation, isSyncedWiki, !isSubWiki, gitUrl, userInfo);
          } else {
            throw new InitWikiGitSyncedWikiNoGitUserInfoError(gitUrl, userInfo);
          }
        } else {
          await this.gitService.initWikiGit(wikiFolderLocation, false);
        }
      }
      return newWorkspace;
    } catch (error) {
      // prepare to rollback changes
      const errorMessage = `initWikiGitTransaction failed, ${(error as Error).message} ${(error as Error).stack ?? ''}`;
      logger.crit(errorMessage);
      await this.workspaceService.remove(workspaceID);
      try {
        if (!isSubWiki) {
          await this.wikiService.removeWiki(wikiFolderLocation);
        } else if (typeof mainWikiToLink === 'string') {
          await this.wikiService.removeWiki(wikiFolderLocation, mainWikiToLink);
        }
      } catch (error_) {
        throw new InitWikiGitRevertError((error_ as Error).message);
      }
      throw new InitWikiGitError(errorMessage);
    }
  };

  public removeWorkspace = async (workspaceID: string): Promise<void> => {
    const mainWindow = this.windowService.get(WindowNames.main);
    if (mainWindow !== undefined) {
      const { response } = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: [i18n.t('WorkspaceSelector.RemoveWorkspace'), i18n.t('WorkspaceSelector.RemoveWorkspaceAndDelete'), i18n.t('Cancel')],
        message: i18n.t('WorkspaceSelector.AreYouSure'),
        cancelId: 2,
      });
      try {
        if (response === 0 || response === 1) {
          const workspace = await this.workspaceService.get(workspaceID);
          if (workspace === undefined) {
            throw new Error(`Need to get workspace with id ${workspaceID} but failed`);
          }
          const { isSubWiki, mainWikiToLink, wikiFolderLocation } = workspace;
          await this.wikiService.stopWiki(wikiFolderLocation).catch((error: Error) => logger.error(error.message, error));
          if (isSubWiki) {
            if (mainWikiToLink === null) {
              throw new Error(`workspace.mainWikiToLink is null in WikiGitWorkspace.removeWorkspace ${JSON.stringify(workspace)}`);
            }
            await this.wikiService.removeWiki(wikiFolderLocation, mainWikiToLink, response === 0);
            // remove folderName from fileSystemPaths
            await this.wikiService.updateSubWikiPluginContent(mainWikiToLink, undefined, {
              ...workspace,
              subWikiFolderName: path.basename(wikiFolderLocation),
            });
          } else if (response === 1) {
            await this.wikiService.removeWiki(wikiFolderLocation);
          }
          await this.workspaceViewService.removeWorkspaceView(workspaceID);
          // switch to first workspace
          const firstWorkspace = await this.workspaceService.getFirstWorkspace();
          if (firstWorkspace !== undefined) {
            await this.workspaceViewService.setActiveWorkspaceView(firstWorkspace.id);
          }
        }
      } catch (error) {
        logger.error((error as Error).message, error);
      }
    }
  };
}
