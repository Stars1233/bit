import { ComponentIdList } from '@teambit/component-id';
import { loadConsumer } from '@teambit/legacy.consumer';
import { ModelComponent, Symlink } from '@teambit/objects';
import type { ExamineBareResult } from '../diagnosis';
import Diagnosis from '../diagnosis';

export const DIAGNOSIS_NAME = 'check orphan refs';
export default class OrphanSymlinkObjects extends Diagnosis {
  name = DIAGNOSIS_NAME;
  description = 'checks for empty internal refs in local workspace';
  category = 'internal store';

  _formatSymptoms(bareResult: ExamineBareResult): string {
    if (!bareResult.data) throw new Error('OrphanSymlinkObjects, bareResult.data is missing');
    // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
    return `the following refs points to non-existing components "${bareResult.data.orphanSymlinks.toString()}"`;
  }

  _formatManualTreat(bareResult: ExamineBareResult) {
    if (!bareResult.data) throw new Error('OrphanSymlinkObjects, bareResult.data is missing');
    // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
    return `please delete the following paths:\n${bareResult.data.objectsToDelete.join('\n')}`;
  }

  async _runExamine(): Promise<ExamineBareResult> {
    const consumer = await loadConsumer();
    const symlinks = await consumer.scope.objects.list([Symlink]);
    const orphanSymlinks = new ComponentIdList();
    const objectsToDelete = [];
    await Promise.all(
      symlinks.map(async (symlink) => {
        // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
        const realComponentId: ComponentID = symlink.getRealComponentId();
        const realModelComponent = ModelComponent.fromBitId(realComponentId);
        const foundComponent = await consumer.scope.objects.load(realModelComponent.hash());
        if (!foundComponent) {
          orphanSymlinks.push(realComponentId);
          // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
          objectsToDelete.push(consumer.scope.objects.objectPath(symlink.hash()));
        }
      })
    );

    return {
      valid: orphanSymlinks.length === 0,
      data: {
        orphanSymlinks,
        objectsToDelete,
      },
    };
  }
}
