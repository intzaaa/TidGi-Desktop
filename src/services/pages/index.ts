/* eslint-disable @typescript-eslint/require-await */
import settings from 'electron-settings';
import { injectable } from 'inversify';
import { debounce, mapValues, pickBy } from 'lodash';

import { lazyInject } from '@services/container';
import { logger } from '@services/libs/log';
import serviceIdentifier from '@services/serviceIdentifier';
import { IWorkspaceService } from '@services/workspaces/interface';
import { IWorkspaceViewService } from '@services/workspacesView/interface';
import { BehaviorSubject } from 'rxjs';
import { debouncedSetSettingFile } from './debouncedSetSettingFile';
import { defaultBuildInPages } from './defaultBuildInPages';
import { IPage, IPagesService, PageType } from './interface';

@injectable()
export class Pages implements IPagesService {
  /**
   * Record from page id/PageType to page settings. For build-in pages, id is the type.
   */
  private readonly pages: Record<string | PageType, IPage> = {};

  public pages$: BehaviorSubject<IPage[]>;

  @lazyInject(serviceIdentifier.WorkspaceView)
  private readonly workspaceViewService!: IWorkspaceViewService;

  @lazyInject(serviceIdentifier.Workspace)
  private readonly workspaceService!: IWorkspaceService;

  constructor() {
    this.pages = this.getInitPagesForCache();
    this.pages$ = new BehaviorSubject<IPage[]>(this.getPagesAsListSync());
    this.updatePageSubject = debounce(this.updatePageSubject.bind(this), 500) as () => Promise<void>;
  }

  private async updatePageSubject(): Promise<void> {
    // DEBUG: console this.getPagesAsListSync()
    logger.info(`updatePageSubject this.getPagesAsListSync() ${JSON.stringify(this.getPagesAsListSync())}`);
    this.pages$.next(this.getPagesAsListSync());
  }

  /**
   * load pages in sync, and ensure it is an Object
   */
  private getInitPagesForCache(): Record<string | PageType, IPage> {
    const pagesFromDisk = settings.getSync(`pages`) ?? {};
    const loadedPages = typeof pagesFromDisk === 'object' && !Array.isArray(pagesFromDisk)
      ? pickBy(pagesFromDisk, (value) => value !== null) as unknown as Record<string | PageType, IPage>
      : {};
    return this.sanitizePageSettings(loadedPages);
  }

  private sanitizePageSettings(pages: Record<string | PageType, IPage>): Record<string | PageType, IPage> {
    // assign newly added default page setting to old user config, if user config missing a key (id of newly added build-in page)
    const firstActivePage = Object.values(pages).find((page) => page.active);
    const sanitizedPages = {
      ...defaultBuildInPages,
      ...mapValues(pages, page => ({
        ...page,
        active: false,
      })),
    };
    if (firstActivePage !== undefined) {
      const pageToActive = sanitizedPages[firstActivePage.id];
      if (pageToActive !== undefined) {
        pageToActive.active = true;
      }
    }
    return sanitizedPages;
  }

  public async setActivePage(id: string | PageType): Promise<void> {
    logger.info(`setActivePage() openPage: ${id}`);
    const oldActivePage = this.getActivePageSync();
    const oldActivePageID = oldActivePage?.id;
    logger.info(`setActivePage() closePage: ${oldActivePageID ?? 'undefined'}`);
    if (id !== PageType.wiki) {
      await this.workspaceViewService.clearActiveWorkspaceView();
    }
    // DEBUG: console oldActivePageID === id
    console.log(`oldActivePageID === id`, oldActivePageID, id);
    if (oldActivePageID === id) return;
    if (oldActivePageID === undefined) {
      await this.update(id, { active: true });
    } else {
      if (id === PageType.wiki) {
        // wiki don't have page record here, so we only need to update the old active page (like Help page)
        await this.update(oldActivePageID, { active: false });
      } else {
        await this.updatePages({ [id]: { active: true }, [oldActivePageID]: { active: false } });
      }
    }
  }

  public async clearActivePage(id: string | PageType | undefined): Promise<void> {
    if (id === undefined) {
      return;
    }
    await this.update(id, { active: false });
  }

  public async getActivePage(): Promise<IPage | undefined> {
    return this.getActivePageSync();
  }

  public getActivePageSync(): IPage | undefined {
    return this.getPagesAsListSync().find((page) => page.active);
  }

  public async get(id: string | PageType): Promise<IPage | undefined> {
    return this.getSync(id);
  }

  public getSync(id: string | PageType): IPage {
    return this.pages[id];
  }

  public async set(id: string | PageType, page: IPage, updateSettingFile = true): Promise<void> {
    logger.info(`set page ${id} with ${JSON.stringify(page)}`);
    this.pages[id] = page;
    if (updateSettingFile) {
      await Promise.all([
        debouncedSetSettingFile(this.pages),
        this.updatePageSubject(),
      ]);
    }
  }

  public async update(id: string | PageType, pageSetting: Partial<IPage>, updateSettingFile = true): Promise<void> {
    const page = this.getSync(id);
    if (page === undefined) {
      logger.error(`Could not update page ${id} because it does not exist`);
      return;
    }
    await this.set(id, { ...page, ...pageSetting }, updateSettingFile);
  }

  public async setPages(newPages: Record<string, IPage>): Promise<void> {
    for (const id in newPages) {
      await this.set(id, newPages[id], false);
    }
    await Promise.all([
      debouncedSetSettingFile(this.pages),
      this.updatePageSubject(),
    ]);
  }

  public async updatePages(newPages: Record<string, Partial<IPage>>): Promise<void> {
    for (const id in newPages) {
      await this.update(id, newPages[id], false);
    }
    await Promise.all([
      debouncedSetSettingFile(this.pages),
      this.updatePageSubject(),
    ]);
  }

  /**
   * Get sorted page list
   * Async so proxy type is async
   */
  public async getPagesAsList(): Promise<IPage[]> {
    return this.getPagesAsListSync();
  }

  /**
   * Get sorted page list
   * Sync for internal use
   */
  public getPagesAsListSync(): IPage[] {
    return Object.values(this.pages);
  }
}
