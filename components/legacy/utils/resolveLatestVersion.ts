/**
 * Retrieve bitId with the highest version from a list according to provided id
 * it returns the provided id if it has a version already
 * if the list contains id without version, it returns the provided id.
 */
import { compact, isEmpty } from 'lodash';
import semver from 'semver';
import type { ComponentID, ComponentIdList } from '@teambit/component-id';

export default function getLatestVersionNumber(bitIds: ComponentIdList, bitId: ComponentID): ComponentID {
  if (!bitId._legacy.getVersion().latest) return bitId;

  // If the bitId provided doesn't contain version we want to ignore scope during search always
  // otherwise we will have problems finding the version from the bitmap after we export the component
  // because we tag with a name without scope but the bitmap contain it with the scope name since it was exported
  // without this, we will always just return the first component in the bitmap which is really bad
  const similarIds = bitIds.filterWithoutVersion(bitId);
  const allVersionsForId = similarIds
    .filter((id) => id.hasVersion() && !id._legacy.isVersionSnap())
    .map((id) => id.version);

  // A case when the provided bitId doesn't exists in the array
  if (isEmpty(allVersionsForId)) {
    if (similarIds.length === 1) return similarIds[0];
    if (similarIds.length > 1)
      throw new Error(`found multiple snaps for ${bitId.toString()}, unable to figure which one is the latest`);
    return bitId;
  }
  const allVersionsWithoutNullForId = compact(allVersionsForId);

  const maxVersion = semver.maxSatisfying<string>(allVersionsWithoutNullForId, '*', { includePrerelease: true });
  if (!maxVersion) {
    throw new Error(
      `semver was not able to find the highest version among the following: ${allVersionsWithoutNullForId.join(', ')}`
    );
  }
  const bitIdWithMaxVersion = bitId.changeVersion(maxVersion);
  const result = bitIds.search(bitIdWithMaxVersion);
  if (!result) {
    throw new Error(`getLatestVersionNumber failed to find the id ${bitIdWithMaxVersion.toString()} within bitIds`);
  }

  return result;
}
