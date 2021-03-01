import { Subscribable, Observer, TeardownLogic, Observable } from 'rxjs';
import { IpcRenderer, ipcRenderer, Event } from 'electron';
import { v4 as uuid } from 'uuid';
import Errio from 'errio';
import { IpcProxyError } from './utils';
import { Request, RequestType, Response, ResponseType, ProxyDescriptor, ProxyPropertyType } from './common';

export type ObservableConstructor = new (subscribe: (obs: Observer<any>) => TeardownLogic) => Subscribable<any>;

export function createProxy<T>(descriptor: ProxyDescriptor, ObservableCtor: ObservableConstructor = Observable, transport: IpcRenderer = ipcRenderer): T {
  const result = {};

  Object.keys(descriptor.properties).forEach((propertyKey) => {
    const propertyType = descriptor.properties[propertyKey];

    // Provide feedback if the Observable constructor has not been passed in
    if ((propertyType === ProxyPropertyType.Value$ || propertyType === ProxyPropertyType.Function$) && typeof ObservableCtor !== 'function') {
      throw new Error(
        'You must provide an implementation of the Observable constructor if you want to proxy Observables. Please see the docs at https://github.com/frankwallis/electron-ipc-proxy.',
      );
    }

    Object.defineProperty(result, propertyKey, {
      enumerable: true,
      get: memoize(() => getProperty(propertyType, propertyKey, descriptor.channel, ObservableCtor, transport)),
    });
  });

  return result as T;
}

function getProperty(
  propertyType: ProxyPropertyType,
  propertyKey: string,
  channel: string,
  ObservableCtor: ObservableConstructor,
  transport: IpcRenderer,
): Promise<any> | Subscribable<any> | ((...arguments_: any[]) => Promise<any>) | ((...arguments_: any[]) => Subscribable<any>) {
  switch (propertyType) {
    case ProxyPropertyType.Value:
      return makeRequest({ type: RequestType.Get, propKey: propertyKey }, channel, transport);
    case ProxyPropertyType.Value$:
      return makeObservable({ type: RequestType.Subscribe, propKey: propertyKey }, channel, ObservableCtor, transport);
    case ProxyPropertyType.Function:
      return async (...arguments_: any[]) => await makeRequest({ type: RequestType.Apply, propKey: propertyKey, args: arguments_ }, channel, transport);
    case ProxyPropertyType.Function$:
      return (...arguments_: any[]) =>
        makeObservable({ type: RequestType.ApplySubscribe, propKey: propertyKey, args: arguments_ }, channel, ObservableCtor, transport);
    default:
      throw new IpcProxyError(`Unrecognised ProxyPropertyType [${propertyType}]`);
  }
}

function memoize<T>(getter: () => T): () => T {
  let result: T = null;
  return () => result || (result = getter());
}

async function makeRequest(request: Request, channel: string, transport: IpcRenderer): Promise<any> {
  const correlationId = uuid();
  transport.send(channel, request, correlationId);

  return await new Promise((resolve, reject) => {
    transport.once(correlationId, (event: Event, response: Response) => {
      switch (response.type) {
        case ResponseType.Result:
          return resolve(response.result);
        case ResponseType.Error:
          return reject(Errio.parse(response.error));
        default:
          return reject(new IpcProxyError(`Unhandled response type [${response.type}]`));
      }
    });
  });
}

function makeObservable(request: Request, channel: string, ObservableCtor: ObservableConstructor, transport: IpcRenderer): Subscribable<any> {
  return new ObservableCtor((obs) => {
    const subscriptionId = uuidv4();
    const subscriptionRequest = { ...request, subscriptionId };

    transport.on(subscriptionId, (event: Event, response: Response) => {
      switch (response.type) {
        case ResponseType.Next:
          return obs.next(response.value);
        case ResponseType.Error:
          return obs.error(Errio.parse(response.error));
        case ResponseType.Complete:
          return obs.complete();
        default:
          return obs.error(new IpcProxyError(`Unhandled response type [${response.type}]`));
      }
    });

    makeRequest(subscriptionRequest, channel, transport).catch((error: Error) => {
      console.log('Error subscribing to remote observable', error);
      obs.error(error);
    });

    return () => {
      transport.removeAllListeners(subscriptionId);
      makeRequest({ type: RequestType.Unsubscribe, subscriptionId }, channel, transport).catch((error) => {
        console.log('Error unsubscribing from remote observale', error);
        obs.error(error);
      });
    };
  });
}

export { ProxyDescriptor, ProxyPropertyType };
