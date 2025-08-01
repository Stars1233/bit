import type { LinkDetail } from '@teambit/dependency-resolver';
import type { Logger } from '@teambit/logger';
import type { ComponentID } from '@teambit/component-id';
import type { ConsumerComponent } from '@teambit/legacy.consumer-component';
import { componentIdToPackageName } from '@teambit/pkg.modules.component-package-name';
import path from 'path';

import type { Capsule } from './capsule';
import type CapsuleList from './capsule-list';

export async function symlinkDependenciesToCapsules(
  capsules: Capsule[],
  capsuleList: CapsuleList,
  logger: Logger
): Promise<Record<string, Record<string, string>>> {
  logger.debug(`symlinkDependenciesToCapsules, ${capsules.length} capsules`);
  return Object.fromEntries(
    await Promise.all(
      capsules.map((capsule) => {
        return symlinkComponent(capsule.component.state._consumer, capsuleList, logger);
      })
    )
  );
}

export async function symlinkOnCapsuleRoot(
  capsuleList: CapsuleList,
  logger: Logger,
  capsuleRoot: string
): Promise<LinkDetail[]> {
  const modulesPath = path.join(capsuleRoot, 'node_modules');
  return capsuleList.map((capsule) => {
    const packageName = componentIdToPackageName(capsule.component.state._consumer);
    const dest = path.join(modulesPath, packageName);
    return {
      from: capsule.path,
      to: dest,
      packageName,
    };
  });
}

async function symlinkComponent(
  component: ConsumerComponent,
  capsuleList: CapsuleList,
  logger: Logger
): Promise<[string, Record<string, string>]> {
  const componentCapsule = capsuleList.getCapsuleIgnoreVersion(component.id);
  if (!componentCapsule) throw new Error(`unable to find the capsule for ${component.id.toString()}`);
  const allDeps = component.getAllDependenciesIds();
  const linkResults = allDeps.reduce((acc, depId: ComponentID) => {
    // TODO: this is dangerous - we might have 2 capsules for the same component with different version, then we might link to the wrong place
    const devCapsule = capsuleList.getCapsuleIgnoreVersion(depId);
    if (!devCapsule) {
      // happens when a dependency is not in the workspace. (it gets installed via the package manager)
      logger.debug(
        `symlinkComponentToCapsule: unable to find the capsule for ${depId.toStringWithoutVersion()}. skipping`
      );
      return acc;
    }
    const packageName = componentIdToPackageName(devCapsule.component.state._consumer);
    const devCapsulePath = devCapsule.path;
    acc[packageName] = `link:${devCapsulePath}`;
    return acc;
  }, {});

  return [componentCapsule.path, linkResults];
}
