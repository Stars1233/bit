import type { Component, ComponentID, AspectData } from '@teambit/component';
import type { ComponentLoadOptions } from '@teambit/legacy.consumer-component';
import type { PathOsBasedAbsolute } from '@teambit/legacy.utils';
import type { WatchOptions } from '@teambit/watcher';

export type SerializableResults = { results: any; toString: () => string };
export type OnComponentChange = (
  component: Component,
  files: PathOsBasedAbsolute[],
  removedFiles: PathOsBasedAbsolute[],
  watchOpts: WatchOptions
) => Promise<SerializableResults | void>;
export type OnComponentAdd = (
  component: Component,
  files: string[],
  watchOpts: WatchOptions
) => Promise<SerializableResults | void>;
export type OnComponentRemove = (componentId: ComponentID) => Promise<SerializableResults>;
export type OnComponentEventResult = { extensionId: string; results: SerializableResults };

export type OnComponentLoad = (
  component: Component,
  loadOpts?: ComponentLoadOptions
) => Promise<AspectData | undefined>;
