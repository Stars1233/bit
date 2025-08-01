import type { Component, ComponentMap } from '@teambit/component';
import type { ExecutionContext, Environment } from '@teambit/envs';
import type { PreviewDefinition } from '@teambit/preview';
import { isFunction } from 'lodash';
import type { AbstractVinyl } from '@teambit/component.sources';

import type { CompositionsMain } from './compositions.main.runtime';
import type { CompositionBrowserMetadataObject } from './composition';

export class CompositionPreviewDefinition implements PreviewDefinition {
  readonly prefix = 'compositions';
  readonly includePeers = true;

  constructor(private compositions: CompositionsMain) {}

  async renderTemplatePath(context: ExecutionContext): Promise<string | undefined> {
    return this.renderTemplatePathByEnv(context.env);
  }

  async renderTemplatePathByEnv(env: Environment): Promise<string | undefined> {
    if (env.getMounter && isFunction(env.getMounter)) {
      return env.getMounter();
    }
    return undefined;
  }

  async getModuleMap(components: Component[]): Promise<ComponentMap<AbstractVinyl[]>> {
    const map = this.compositions.getPreviewFiles(components);
    return map;
  }

  async getMetadata(component: Component): Promise<CompositionBrowserMetadataObject> {
    const compositions = this.compositions
      .getCompositions(component)
      .map((composition) => ({ displayName: composition.displayName, identifier: composition.identifier }));
    return {
      compositions,
    };
  }
}
