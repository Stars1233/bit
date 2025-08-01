import type { SourceFile } from '@teambit/component.sources';
import { MainRuntime } from '@teambit/cli';
import type { ScopeMain } from '@teambit/scope';
import { ScopeAspect } from '@teambit/scope';
import { flatten, isFunction } from 'lodash';
import type { SlotRegistry } from '@teambit/harmony';
import { Slot } from '@teambit/harmony';
import type { Workspace } from '@teambit/workspace';
import { WorkspaceAspect } from '@teambit/workspace';
import { EnvsAspect } from '@teambit/envs';
import type { EnvJsonc, EnvsMain } from '@teambit/envs';
import type {
  ConsumerComponent as LegacyComponent,
  Dependency as LegacyDependency,
} from '@teambit/legacy.consumer-component';
import type { Component, ComponentMain } from '@teambit/component';
import { ComponentAspect } from '@teambit/component';
import type { GraphqlMain } from '@teambit/graphql';
import { GraphqlAspect } from '@teambit/graphql';
import { DevFilesAspect } from './dev-files.aspect';
import { DevFiles } from './dev-files';
import { DevFilesFragment } from './dev-files.fragment';
import { devFilesSchema } from './dev-files.graphql';

type DevPatternDescriptor = {
  /**
   * Name of the dev pattern
   */
  name: string;

  /**
   * Glob pattern to select dev files
   */
  pattern: string[];
};

type DevPattern = string[] | DevPatternDescriptor;

/**
 * dev pattern is a list of strings or a function that returns a list of strings. an example to a pattern can be "[*.spec.ts]"
 */
export type DevPatterns = ((component: Component) => DevPattern) | DevPattern;

export type EnvJsoncPatterns = {
  compositions?: string[];
  docs?: string[];
  tests?: string[];
  [key: string]: string[] | undefined;
};

/**
 * slot for dev file patterns.
 */
export type DevPatternSlot = SlotRegistry<DevPatterns>;

export type DevFilesConfig = {
  patterns: string[];
};

export class DevFilesMain {
  constructor(
    private envs: EnvsMain,

    private workspace: Workspace,

    private devPatternSlot: DevPatternSlot,

    /**
     * configuration loaded into the dev files aspect.
     */
    readonly config: DevFilesConfig
  ) {}

  /**
   * compute all dev patterns on a component.
   * computing of dev patterns is a merge of the configuration, the env (env.getDevPatterns(component)) and
   * the registering aspects (through registerDevPattern()).
   */
  async computeDevPatterns(component: Component, envExtendsDeps?: LegacyDependency[]) {
    const entry = component.state.aspects.get(DevFilesAspect.id);
    const configuredPatterns = entry?.config.devFilePatterns || [];

    const fromSlot = await this.computeDevPatternsFromSlot(component);
    const fromEnv = await this.computeDevPatternsFromEnv(component, fromSlot.names, envExtendsDeps);

    const res = Object.assign(
      {
        config: configuredPatterns,
      },
      fromSlot.patterns,
      fromEnv
    );
    return res;
  }

  private async computeDevPatternsFromSlot(
    component: Component
  ): Promise<{ patterns: { [id: string]: string[] }; names: { [name: string]: string } }> {
    const patternSlot = this.devPatternSlot.toArray();
    const getPatterns = (devPatterns: DevPatterns) => {
      if (isFunction(devPatterns)) {
        return devPatterns(component);
      }
      return devPatterns;
    };
    const fromSlot = patternSlot.reduce(
      (acc, current) => {
        const [aspectId, patterns] = current;
        // if (component.state.aspects.get(aspectId)) acc[aspectId] = acc[aspectId].concat(patterns);
        const patternsOrDescriptor = getPatterns(patterns);
        const patternsArray = Array.isArray(patternsOrDescriptor) ? patternsOrDescriptor : patternsOrDescriptor.pattern;
        const name = Array.isArray(patternsOrDescriptor) ? undefined : patternsOrDescriptor.name;
        if (!acc.patterns[aspectId]) acc.patterns[aspectId] = [];
        acc.patterns[aspectId] = acc.patterns[aspectId].concat(patternsArray);
        if (name) {
          acc.names[name] = aspectId;
        }
        return acc;
      },
      { patterns: {}, names: {} }
    );
    return fromSlot;
  }

  private async computeDevPatternsFromEnv(
    component: Component,
    patternNames: { [name: string]: string },
    envExtendsDeps?: LegacyDependency[]
  ): Promise<{ [id: string]: string[] }> {
    const envId = (await this.envs.getOrCalculateEnvId(component)).toString();
    const fromEnvJsonFile = await this.computeDevPatternsFromEnvJsoncFile(envId, undefined, envExtendsDeps);

    let fromEnvFunc;
    if (!fromEnvJsonFile) {
      const envDef = await this.envs.calculateEnv(component, { skipWarnings: !!this.workspace?.inInstallContext });
      fromEnvFunc = envDef.env?.getDevPatterns ? envDef.env.getDevPatterns(component) : [];
    }
    const envPatterns = fromEnvJsonFile || fromEnvFunc || {};
    if (Array.isArray(envPatterns)) {
      return { [envId]: envPatterns };
    }
    const envPatternsObject = Object.entries(envPatterns).reduce((acc, [name, pattern]) => {
      const aspectId = patternNames[name] || envId;
      if (!acc[aspectId]) acc[aspectId] = [];
      acc[aspectId] = acc[aspectId].concat(pattern);
      return acc;
    }, {});
    return envPatternsObject;
  }

  mergeEnvManifestPatterns(parent: EnvJsonc, child: EnvJsonc): Partial<EnvJsonc> {
    const merged: Partial<EnvJsonc> = {
      patterns: { ...parent.patterns, ...child.patterns },
    };
    return merged;
  }

  private async computeDevPatternsFromEnvJsoncFile(
    envId: string,
    legacyFiles?: SourceFile[],
    envExtendsDeps?: LegacyDependency[]
  ): Promise<string[] | undefined> {
    const isCoreEnv = this.envs.isCoreEnv(envId);

    if (isCoreEnv) return undefined;
    let envJsonc;
    if (legacyFiles) {
      envJsonc = await this.envs.calculateEnvManifest(undefined, legacyFiles, envExtendsDeps);
    } else {
      const envComponent = await this.envs.getEnvComponentByEnvId(envId, envId);
      envJsonc = await this.envs.calculateEnvManifest(envComponent, undefined, envExtendsDeps);
    }

    if (!envJsonc) return undefined;

    return envJsonc.patterns;
  }

  /**
   * get all dev files configured on a component.
   */
  getDevPatterns(component: Component, aspectId?: string): string[] {
    const entry = component.state.aspects.get(DevFilesAspect.id);
    const devPatterns = entry?.data.devPatterns || {};
    return aspectId ? devPatterns[aspectId] : flatten(Object.values(devPatterns));
  }

  /**
   * determine whether a file of a component is a dev file.
   */
  isDevFile(component: Component, filePath: string): boolean {
    const devFiles = this.getDevFiles(component);
    return devFiles.includes(filePath);
  }

  /**
   * register a new dev pattern.
   * @param regex dev pattern
   */
  registerDevPattern(pattern: DevPatterns) {
    return this.devPatternSlot.register(pattern);
  }

  /**
   * get all dev patterns registered.
   * If you want to use this during onLoad event you might need to use computeDevFiles instead, since the component might not include this data yet
   */
  getDevFiles(component: Component): DevFiles {
    const entry = component.state.aspects.get(DevFilesAspect.id);
    const rawDevFiles = entry?.data.devFiles || {};
    return new DevFiles(rawDevFiles);
  }

  async getDevFilesForConsumerComp(
    consumerComponent: LegacyComponent,
    envExtendsDeps?: LegacyDependency[]
  ): Promise<string[]> {
    const componentId = consumerComponent.id;
    // Do not change the storeInCache=false arg. if you think you need to change it, please talk to Gilad first
    const component = await this.workspace.get(componentId, consumerComponent, true, false, {
      loadExtensions: false,
      // executeLoadSlot: false,
    });
    if (!component) throw Error(`failed to transform component ${consumerComponent.id.toString()} in harmony`);
    const computedDevFiles = await this.computeDevFiles(component, envExtendsDeps);
    return computedDevFiles.list();
  }

  /**
   * compute all dev files of a component.
   */
  async computeDevFiles(component: Component, envExtendsDeps?: LegacyDependency[]): Promise<DevFiles> {
    const devPatterns = await this.computeDevPatterns(component, envExtendsDeps);
    const rawDevFiles = Object.keys(devPatterns).reduce((acc, aspectId) => {
      if (!acc[aspectId]) acc[aspectId] = [];
      const patterns = devPatterns[aspectId];
      acc[aspectId] = component.state.filesystem.byGlob(patterns).map((file) => file.relative);
      return acc;
    }, {});

    return new DevFiles(rawDevFiles);
  }

  static slots = [Slot.withType<DevPatterns>()];

  static defaultConfig = {
    patterns: [],
  };

  static runtime = MainRuntime;

  static dependencies = [EnvsAspect, WorkspaceAspect, ComponentAspect, GraphqlAspect, ScopeAspect];

  static async provider(
    [envs, workspace, componentAspect, graphql, scope]: [EnvsMain, Workspace, ComponentMain, GraphqlMain, ScopeMain],
    config: DevFilesConfig,
    [devPatternSlot]: [DevPatternSlot]
  ) {
    const devFiles = new DevFilesMain(envs, workspace, devPatternSlot, config);
    componentAspect.registerShowFragments([new DevFilesFragment(devFiles)]);
    envs.registerEnvJsoncMergeCustomizer(devFiles.mergeEnvManifestPatterns.bind(devFiles));

    const calcDevOnLoad = async (component: Component) => {
      return {
        devPatterns: await devFiles.computeDevPatterns(component),
        devFiles: (await devFiles.computeDevFiles(component)).toObject(),
      };
    };

    if (workspace) {
      workspace.registerOnComponentLoad(calcDevOnLoad);
    }
    if (scope) {
      scope.registerOnCompAspectReCalc(calcDevOnLoad);
    }

    graphql.register(() => devFilesSchema(devFiles));
    return devFiles;
  }
}

DevFilesAspect.addRuntime(DevFilesMain);
