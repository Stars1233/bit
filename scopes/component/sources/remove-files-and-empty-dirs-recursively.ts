import fs from 'fs-extra';
import pMap from 'p-map';
import mapSeries from 'p-map-series';
import * as path from 'path';
import { concurrentIOLimit } from '@teambit/harmony.modules.concurrency';
import { removeEmptyDir } from '@teambit/toolbox.fs.remove-empty-dir';
import { logger } from '@teambit/legacy.logger';

/**
 * This function will remove the list of files from fs
 * Then go to the folder of each file and remove it as well if it's empty
 */
export async function removeFilesAndEmptyDirsRecursively(filesPaths: string[]): Promise<boolean> {
  const dirs = filesPaths.map((filePath) => path.dirname(filePath));
  logger.info(`remove-files-and-empty-dirs-recursively deleting the following paths: ${filesPaths.join(', ')}`);
  const concurrency = concurrentIOLimit();
  await pMap(filesPaths, (filePath) => fs.remove(filePath), { concurrency });
  // Sorting it to make sure we will delete the inner dirs first
  const sortedDirs = dirs.sort().reverse();
  await mapSeries(sortedDirs, (dir) => removeEmptyDir(dir));
  return true;
}
