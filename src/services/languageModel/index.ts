/* eslint-disable unicorn/no-null */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable @typescript-eslint/strict-boolean-expressions */
import { dialog } from 'electron';
import fs from 'fs-extra';
import { injectable } from 'inversify';
import path from 'path';
import { BehaviorSubject, Observable } from 'rxjs';
import { ModuleThread, spawn, Worker } from 'threads';

// @ts-expect-error it don't want .ts
// eslint-disable-next-line import/no-webpack-loader-syntax
import workerURL from 'threads-plugin/dist/loader?name=llmWorker!./llmWorker/index.ts';

import { LANGUAGE_MODEL_FOLDER } from '@/constants/appPaths';
import { getExistingParentDirectory } from '@/helpers/findPath';
import { lazyInject } from '@services/container';
import { i18n } from '@services/libs/i18n';
import { logger } from '@services/libs/log';
import type { INativeService } from '@services/native/interface';
import { IPreferenceService } from '@services/preferences/interface';
import serviceIdentifier from '@services/serviceIdentifier';
import { IWindowService } from '@services/windows/interface';
import { WindowNames } from '@services/windows/WindowProperties';
import { ILanguageModelAPIResponse, ILanguageModelService, IRunLLAmaOptions, LanguageModelRunner } from './interface';
import { LLMWorker } from './llmWorker/index';

@injectable()
export class LanguageModel implements ILanguageModelService {
  @lazyInject(serviceIdentifier.NativeService)
  private readonly nativeService!: INativeService;

  @lazyInject(serviceIdentifier.Window)
  private readonly windowService!: IWindowService;

  @lazyInject(serviceIdentifier.Preference)
  private readonly preferenceService!: IPreferenceService;

  private llmWorker?: ModuleThread<LLMWorker>;

  /**
   * Null means started loading, but not finished yet.
   */
  private modelLoaded: Record<LanguageModelRunner, boolean | null> = {
    [LanguageModelRunner.llamaCpp]: false,
  };

  public modelLoaded$ = new BehaviorSubject<Record<LanguageModelRunner, boolean | null>>(this.modelLoaded);
  public updateModelLoaded(update: Partial<Record<LanguageModelRunner, boolean | null>>): void {
    this.modelLoaded = { ...this.modelLoaded, ...update };
    this.modelLoaded$.next(this.modelLoaded);
  }

  private modelLoadProgress: Record<LanguageModelRunner, number> = {
    [LanguageModelRunner.llamaCpp]: 0,
  };

  public modelLoadProgress$ = new BehaviorSubject<Record<LanguageModelRunner, number>>(this.modelLoadProgress);
  public updateModelLoadProgress(update: Partial<Record<LanguageModelRunner, number>>): void {
    this.modelLoadProgress = { ...this.modelLoadProgress, ...update };
    this.modelLoadProgress$.next(this.modelLoadProgress);
  }

  private async initWorker(): Promise<void> {
    logger.debug(`initial llmWorker with  ${workerURL as string}`, { function: 'LanguageModel.initWorker' });
    try {
      this.llmWorker = await spawn<LLMWorker>(new Worker(workerURL as string), { timeout: 1000 * 30 });
      logger.debug(`initial llmWorker done`, { function: 'LanguageModel.initWorker' });
    } catch (error) {
      if ((error as Error).message.includes('Did not receive an init message from worker after')) {
        // https://github.com/andywer/threads.js/issues/426
        // wait some time and restart the wiki will solve this
        logger.warn(`initWorker() handle "${(error as Error)?.message}", will try recreate worker.`, { function: 'LanguageModel.initWorker' });
        await this.initWorker();
      } else {
        logger.error('initWorker() unexpected error, throw it', { function: 'LanguageModel.initWorker', error: (error as Error).message, stack: (error as Error).stack });
        throw error;
      }
    }
  }

  /**
   * Ensure you get a started worker. If not stated, it will await for it to start.
   * @param workspaceID
   */
  private async getWorker(): Promise<ModuleThread<LLMWorker>> {
    if (this.llmWorker === undefined) {
      await this.initWorker();
    } else {
      return this.llmWorker;
    }
    if (this.llmWorker === undefined) {
      const errorMessage = `Still no llmWorker after init. No running worker, maybe worker failed to start`;
      logger.error(
        errorMessage,
        {
          function: 'getWorker',
        },
      );
      throw new Error(errorMessage);
    }
    return this.llmWorker;
  }

  /**
   * Return true if the model exists, false otherwise. And will show a dialog to user if the model does not exist.
   * @param modelPath Absolute path to the model
   */
  private async checkModelExistsAndWarnUser(modelPath: string): Promise<boolean> {
    const exists = await fs.pathExists(modelPath);
    if (!exists) {
      const mainWindow = this.windowService.get(WindowNames.main);
      if (mainWindow !== undefined) {
        let pathToOpen = modelPath;
        void dialog
          .showMessageBox(mainWindow, {
            title: i18n.t('LanguageModel.ModelNotExist'),
            message: `${i18n.t('LanguageModel.ModelNotExistDescription')}: ${modelPath}`,
            buttons: ['OK', i18n.t('LanguageModel.OpenThisPath')],
            cancelId: 0,
            defaultId: 1,
          })
          .then(async ({ response }) => {
            if (response === 1) {
              pathToOpen = await getExistingParentDirectory(modelPath);
              await this.nativeService.openPath(pathToOpen);
            }
          })
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          .catch((error) => logger.error('checkModelExistsAndWarnUser failed', { pathToOpen, error }));
      }
    }
    return exists;
  }

  public runLanguageModel$(runner: LanguageModelRunner.llamaCpp, options: IRunLLAmaOptions): Observable<ILanguageModelAPIResponse>;
  public runLanguageModel$(runner: LanguageModelRunner, options: IRunLLAmaOptions): Observable<ILanguageModelAPIResponse> {
    const { id: conversationID, loadConfig: config } = options;
    this.updateModelLoaded({ [runner]: null });
    return new Observable<ILanguageModelAPIResponse>((subscriber) => {
      const runLanguageModelObserverIIFE = async () => {
        const worker = await this.getWorker();
        const { defaultModel } = await this.preferenceService.get('languageModel');
        const modelPath = config.modelPath || path.join(LANGUAGE_MODEL_FOLDER, defaultModel[runner]);
        if (!(await this.checkModelExistsAndWarnUser(modelPath))) {
          subscriber.error(new Error(`${i18n.t('LanguageModel.ModelNotExist')} ${modelPath}`));
          return;
        }
        let observable;
        if (options.loadModelOnly === true) {
          observable = worker.loadLLama({ ...config, modelPath }, conversationID);
          observable.subscribe({
            complete: () => {
              this.updateModelLoaded({ [runner]: true });
              this.updateModelLoadProgress({ [runner]: 1 });
            },
          });
        } else {
          // load and run model
          const texts = { timeout: i18n.t('LanguageModel.GenerationTimeout'), disposed: i18n.t('LanguageModel.ModelDisposed') };
          logger.info(options.sessionOptions?.systemPrompt ?? '', { tag: 'options.sessionOptions?.systemPrompt' });
          switch (runner) {
            case LanguageModelRunner.llamaCpp: {
              observable = worker.runLLama({ ...options, loadConfig: { ...config, modelPath }, conversationID }, texts);
              break;
            }
          }
        }
        observable?.subscribe({
          next: (result) => {
            const loggerCommonMeta = { id: result.id, function: 'LanguageModel.runLanguageModel$' };

            if ('type' in result) {
              switch (result.type) {
                case 'progress': {
                  const { percentage, id } = result;
                  if (percentage === 1) {
                    this.updateModelLoaded({ [runner]: true });
                  }
                  this.updateModelLoadProgress({ [runner]: percentage });
                  if (id === conversationID) {
                    subscriber.next(result);
                  }
                  break;
                }
                case 'result': {
                  this.updateModelLoaded({ [runner]: true });
                  const { token, id } = result;
                  // prevent the case that the result is from previous or next conversation, where its Observable is not properly closed.
                  if (id === conversationID) {
                    subscriber.next({ token, id });
                  }
                  break;
                }
              }
            } else if ('level' in result) {
              logger.log(result.level, `${result.message}`, loggerCommonMeta);
            }
          },
          error: (error) => {
            logger.error(`${(error as Error).message} ${(error as Error).stack ?? 'no stack'}`, { id: conversationID, function: 'LanguageModel.runLanguageModel$.error' });
            subscriber.error(error);
            this.updateModelLoaded({ [runner]: false });
            this.updateModelLoadProgress({ [runner]: 0 });
            const message = `${(error as Error).message} ${(error as Error).stack ?? 'no stack'}`;
            if (message.includes('NoBinaryFound')) {
              void this.nativeService.showElectronMessageBox({
                title: i18n.t('LanguageModel.NoBinaryFoundError'),
                message,
              });
              return;
            }
            void this.nativeService.showElectronMessageBox({
              title: i18n.t('LanguageModel.RunModelError'),
              message,
            });
          },
          complete: () => {
            logger.info(`worker observable completed`, { function: 'LanguageModel.runLanguageModel$.complete' });
            subscriber.complete();
          },
        });
      };
      void runLanguageModelObserverIIFE().catch(error => {
        const message = `${(error as Error).message} ${(error as Error).stack ?? 'no stack'}`;
        logger.error(message, { id: conversationID, function: 'runLanguageModelObserverIIFE.error' });
        void this.nativeService.showElectronMessageBox({
          title: i18n.t('LanguageModel.RunModelError'),
          message,
        });
      });
    });
  }

  public async abortLanguageModel(runner: LanguageModelRunner, id: string): Promise<void> {
    switch (runner) {
      case LanguageModelRunner.llamaCpp: {
        await this.llmWorker?.abortLLama(id);
        break;
      }
    }
  }

  public async unloadLanguageModel(runner: LanguageModelRunner): Promise<void> {
    switch (runner) {
      case LanguageModelRunner.llamaCpp: {
        await this.llmWorker?.unloadLLama();
        break;
      }
    }
    this.updateModelLoaded({ [runner]: false });
    this.updateModelLoadProgress({ [runner]: 0 });
  }
}
