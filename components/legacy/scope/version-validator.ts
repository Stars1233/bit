/* eslint-disable complexity */
import { PackageJsonValidator as PJV } from '@teambit/pkg.package-json.validator';
import { forEach, isEmpty } from 'lodash';
import { lt, gt } from 'semver';
import packageNameValidate from 'validate-npm-package-name';
import type { ComponentIdList } from '@teambit/component-id';
import { ComponentID } from '@teambit/component-id';
import { BitError } from '@teambit/bit-error';
import { isSnap, isTag } from '@teambit/component-version';
import { DEPENDENCIES_FIELDS } from '@teambit/legacy.constants';
import { SchemaName, Dependencies, DEPENDENCIES_TYPES } from '@teambit/legacy.consumer-component';
import { getArtifactsFiles, PackageJsonFile } from '@teambit/component.sources';
import { componentOverridesForbiddenFields, nonPackageJsonFields } from '@teambit/legacy.consumer-config';
import type { ExtensionDataEntry } from '@teambit/legacy.extension-data';
import { ExtensionDataList } from '@teambit/legacy.extension-data';
import type { PathLinux } from '@teambit/legacy.utils';
import { isValidPath } from '@teambit/legacy.utils';
import { validateType } from './validate-type';
import VersionInvalid from './exceptions/version-invalid';
import type { Version } from '@teambit/objects';

/**
 * make sure a Version instance is correct. throw an exceptions if it is not.
 */
export function validateVersionInstance(version: Version): void {
  const message = `unable to save Version object${
    version.componentId ? ` of "${version.componentId.toString()}"` : ` hash ${version.hash().toString()}`
  }`;
  const validateComponentId = (bitId: ComponentID, field: string, validateVersion = true, validateScope = true) => {
    if (validateVersion && !bitId.hasVersion()) {
      throw new VersionInvalid(`${message}, the ${field} ${bitId.toString()} does not have a version`);
    }
    if (validateScope && !bitId.hasScope()) {
      throw new VersionInvalid(`${message}, the ${field} ${bitId.toString()} does not have a scope`);
    }
  };
  const _validatePackageDependencyValue = (packageValue, packageName) => {
    // don't use semver.valid and semver.validRange to validate the package version because it
    // can be also a URL, Git URL or Github URL. see here: https://docs.npmjs.com/files/package.json#dependencies
    validateType(message, packageValue, `version of "${packageName}"`, 'string');
  };

  /**
   * Validate that the package name and version are valid
   * @param {*} packageName
   * @param {*} packageVersion
   */
  const _validatePackageDependency = (packageVersion, packageName) => {
    const packageNameValidateResult = packageNameValidate(packageName);
    if (!packageNameValidateResult.validForNewPackages && !packageNameValidateResult.validForOldPackages) {
      const errors = packageNameValidateResult.errors || [];
      throw new VersionInvalid(`${packageName} is invalid package name, errors:  ${errors.join()}`);
    }

    _validatePackageDependencyValue(packageVersion, packageName);
  };

  const _validatePackageDependencies = (packageDependencies) => {
    validateType(message, packageDependencies, 'packageDependencies', 'object');
    forEach(packageDependencies, _validatePackageDependency);
  };
  const validateFile = (file, field: 'file' | 'dist-file' | 'artifact') => {
    validateType(message, file, field, 'object');
    if (!isValidPath(file.relativePath)) {
      throw new VersionInvalid(`${message}, the ${field} ${file.relativePath} is invalid`);
    }
    if (!file.name && field !== 'artifact') {
      throw new VersionInvalid(`${message}, the ${field} ${file.relativePath} is missing the name attribute`);
    }
    const ref = field === 'artifact' ? file.ref : file.file;
    if (!ref) throw new VersionInvalid(`${message}, the ${field} ${file.relativePath} is missing the hash`);
    if (file.name) validateType(message, file.name, `${field}.name`, 'string');
    validateType(message, ref, `${field}.file`, 'object');
    validateType(message, ref.hash, `${field}.file.hash`, 'string');
  };

  const _validateExtension = (extension: ExtensionDataEntry) => {
    if (extension.extensionId) {
      validateComponentId(extension.extensionId, `extensions.${extension.extensionId.toString()}`, true, false);
    }
    // Make sure we don't insert the remove sign ("-") by mistake to the models
    if (extension.config) {
      validateType(message, extension.config, 'extension.config', 'object');
    }
  };

  const validateArtifacts = (extensions: ExtensionDataList) => {
    const artifactsFiles = getArtifactsFiles(extensions);
    artifactsFiles.forEach((artifacts) => {
      artifacts.refs.map((artifact) => validateFile(artifact, 'artifact'));
      const filesPaths = artifacts.refs.map((artifact) => artifact.relativePath);
      const duplicateArtifacts = filesPaths.filter(
        (file) => filesPaths.filter((f) => file.toLowerCase() === f.toLowerCase()).length > 1
      );
      if (duplicateArtifacts.length) {
        throw new VersionInvalid(
          `${message} the following artifact files are duplicated ${duplicateArtifacts.join(', ')}`
        );
      }
    });
  };

  const validateNoDuplicateExtensionEntry = (extensions: ExtensionDataList) => {
    const existingMap = new Map();
    const duplications: string[] = [];
    extensions.forEach((ext) => {
      const stringId = ext.stringId;
      if (!stringId) {
        return;
      }
      if (existingMap.has(stringId)) {
        duplications.push(stringId);
      } else {
        existingMap.set(stringId, true);
      }
    });
    if (duplications.length) {
      // a bug causing duplicate aspects was fixed in https://github.com/teambit/bit/pull/6567
      // all Version objects snapped before 0.0.882 might have this bug. ignore them.
      if (!version.bitVersion || lt(version.bitVersion, '0.0.882')) {
        return;
      }
      throw new VersionInvalid(`${message} the following extensions entries are duplicated ${duplications.join(', ')}`);
    }
  };

  const _validateExtensions = (extensions: ExtensionDataList) => {
    if (extensions) {
      validateNoDuplicateExtensionEntry(extensions);
      extensions.map(_validateExtension);
      validateArtifacts(extensions);
      const result = ExtensionDataList.validateBeforePersistHook?.(extensions);
      if (result) {
        if (!version.bitVersion || lt(version.bitVersion, result.minBitVersion)) {
          return;
        }
        throw new VersionInvalid(`${message} ${result.errorMsg}`);
      }
    }
  };

  if (!version.mainFile) throw new VersionInvalid(`${message}, the mainFile is missing`);
  if (!isValidPath(version.mainFile)) {
    throw new VersionInvalid(`${message}, the mainFile ${version.mainFile} is invalid`);
  }
  if (!version.files || !version.files.length) throw new VersionInvalid(`${message}, the files are missing`);
  let foundMainFile = false;
  validateType(message, version.files, 'files', 'array');
  const filesPaths: PathLinux[] = [];
  version.files.forEach((file) => {
    validateFile(file, 'file');
    filesPaths.push(file.relativePath);
    if (file.relativePath === version.mainFile) foundMainFile = true;
  });
  if (!foundMainFile) {
    throw new VersionInvalid(
      `${message}, unable to find the mainFile ${version.mainFile} in the following files list: ${filesPaths.join(
        ', '
      )}`
    );
  }
  const duplicateFiles = filesPaths.filter(
    (file) => filesPaths.filter((f) => file.toLowerCase() === f.toLowerCase()).length > 1
  );
  if (duplicateFiles.length) {
    throw new VersionInvalid(`${message} the following files are duplicated ${duplicateFiles.join(', ')}`);
  }
  _validatePackageDependencies(version.packageDependencies);
  _validatePackageDependencies(version.devPackageDependencies);
  _validatePackageDependencies(version.peerPackageDependencies);
  _validateExtensions(version.extensions);
  DEPENDENCIES_TYPES.forEach((dependenciesType) => {
    if (!(version[dependenciesType] instanceof Dependencies)) {
      throw new VersionInvalid(
        `${message}, ${dependenciesType} must be an instance of Dependencies, got ${typeof version[dependenciesType]}`
      );
    }
  });
  version.dependencies.validate(version.componentId);
  version.devDependencies.validate(version.componentId);
  if (!version.dependencies.isEmpty() && !version.flattenedDependencies.length) {
    throw new VersionInvalid(`${message}, it has dependencies but its flattenedDependencies is empty`);
  }
  const validateFlattenedDependencies = (dependencies: ComponentIdList) => {
    validateType(message, dependencies, 'dependencies', 'array');
    dependencies.forEach((dependency) => {
      if (dependency.constructor.name !== ComponentID.name) {
        throw new VersionInvalid(
          `${message}, a flattenedDependency expected to be ComponentID, got ${typeof dependency}`
        );
      }
      if (!dependency.hasVersion()) {
        throw new VersionInvalid(
          `${message}, the flattenedDependency ${dependency.toString()} does not have a version`
        );
      }
    });
    // before 0.0.947, there was a bug that didn't save some extensions in the flattenedDependencies for some unknown reason.
    if (version.bitVersion && gt(version.bitVersion, '0.0.947')) {
      version.extensions.extensionsBitIds.forEach((extensionId) => {
        if (!dependencies.has(extensionId)) {
          throw new VersionInvalid(
            `${message}, the extension ${extensionId.toString()} is missing from the flattenedDependencies`
          );
        }
      });
    }
  };
  validateFlattenedDependencies(version.flattenedDependencies);
  // extensions can be duplicate with other dependencies type. e.g. "test" can have "compile" as a
  // dependency and extensionDependency. we can't remove it from extDep, otherwise, the ext won't
  // be running
  const allDependenciesIds = version.getDependenciesIdsExcludeExtensions();
  const depsDuplications = allDependenciesIds.findDuplicationsIgnoreVersion();
  if (!isEmpty(depsDuplications)) {
    const duplicationStr = Object.keys(depsDuplications)
      .map(
        (id) => `"${id}" shows as the following: ${depsDuplications[id].map((depId) => depId.toString()).join(', ')} `
      )
      .join('\n');
    throw new BitError(`some dependencies are duplicated, see details below.
if you added a dependency to "overrides" configuration with a plus sign, make sure to add it with a minus sign in the other dependency type
for example, { dependencies: { "bar/foo": "+" }, devDependencies: { "bar/foo": "-" } }

${duplicationStr}`);
    // todo: once decided how to address duplicate dependencies, remove the line above and uncomment the line below
    // throw new VersionInvalid(`${message}, some dependencies are duplicated:\n${duplicationStr}`);
  }
  if (!version.log) throw new VersionInvalid(`${message}, the log object is missing`);
  validateType(message, version.log, 'log', 'object');
  validateType(message, version.log.message, 'log.message', 'string');
  if (version.bindingPrefix) {
    validateType(message, version.bindingPrefix, 'bindingPrefix', 'string');
  }
  const npmSpecs = PJV.getSpecMap('npm');
  const validatePackageJsonField = (fieldName: string, fieldValue: any): string | null | undefined => {
    if (!npmSpecs?.[fieldName]) {
      // it's not a standard package.json field, can't validate
      return null;
    }
    const validateResult = PJV.validateType(fieldName, npmSpecs[fieldName], fieldValue);
    if (!validateResult.length) return null;
    return validateResult.join(', ');
  };
  const validateOverrides = (fieldValue: Record<string, any>, fieldName: string) => {
    const field = `overrides.${fieldName}`;
    if (DEPENDENCIES_FIELDS.includes(fieldName)) {
      validateType(message, fieldValue, field, 'object');
      Object.keys(fieldValue).forEach((key) => {
        validateType(message, key, `property name of ${field}`, 'string');
        _validatePackageDependencyValue(fieldValue[key], key);
      });
    } else if (!nonPackageJsonFields.includes(fieldName)) {
      const result = validatePackageJsonField(fieldName, fieldValue);
      if (result) {
        throw new VersionInvalid(
          `${message}, "${field}" is a package.json field but is not compliant with npm requirements. ${result}`
        );
      }
    }
  };
  Object.keys(version.overrides).forEach((field) => {
    if (componentOverridesForbiddenFields.includes(field)) {
      throw new VersionInvalid(`${message}, the "overrides" has a forbidden key "${field}"`);
    }
    validateOverrides(version.overrides[field], field);
  });
  validateType(message, version.packageJsonChangedProps, 'packageJsonChangedProps', 'object');
  const forbiddenPackageJsonProps = PackageJsonFile.propsNonUserChangeable();
  Object.keys(version.packageJsonChangedProps).forEach((prop) => {
    validateType(message, prop, 'property name of packageJson', 'string');
    if (forbiddenPackageJsonProps.includes(prop)) {
      throw new VersionInvalid(`${message}, the packageJsonChangedProps should not override the prop ${prop}`);
    }
    const result = validatePackageJsonField(prop, version.packageJsonChangedProps[prop]);
    if (result) {
      throw new VersionInvalid(
        `${message}, the generated package.json field "${prop}" is not compliant with npm requirements. ${result}`
      );
    }
  });
  if (version.parents) {
    version.parents.forEach((parent) => {
      if (parent.isEqual(version.hash())) {
        throw new VersionInvalid(`${message}, its parent has the same hash as itself: ${parent.toString()}`);
      }
      if (!isSnap(parent.toString())) {
        throw new VersionInvalid(`${message}, its parent "${parent.toString()}" is not a valid snap (40 chars hex).`);
      }
    });
  }
  const unrelatedHead = version.unrelated?.head;
  if (unrelatedHead && version.parents.some((p) => p.isEqual(unrelatedHead))) {
    if (version.bitVersion && gt(version.bitVersion, '0.2.33'))
      throw new VersionInvalid(`${message}, the unrelated.head is the same as the parent: ${unrelatedHead.toString()}`);
  }
  const schema = version.schema || SchemaName.Legacy;
  if (!version.isLegacy) {
    const fieldsForSchemaCheck = ['compiler', 'tester', 'dists', 'mainDistFile'];
    const fieldsForSchemaCheckNotEmpty = [
      'customResolvedPaths',
      'compilerPackageDependencies',
      'testerPackageDependencies',
    ];
    fieldsForSchemaCheck.forEach((field) => {
      if (version[field]) {
        throw new VersionInvalid(`${message}, the ${field} field is not permitted according to schema "${schema}"`);
      }
    });
    fieldsForSchemaCheckNotEmpty.forEach((field) => {
      if (version[field] && !isEmpty(version[field])) {
        throw new VersionInvalid(
          `${message}, the ${field} field is cannot have values according to schema "${schema}"`
        );
      }
    });
    ['dependencies', 'devDependencies'].forEach((dependenciesField) => {
      const deps: Dependencies = version[dependenciesField];
      deps.dependencies.forEach((dep) => {
        if (dep.relativePaths.length) {
          throw new VersionInvalid(
            `${message}, the ${dependenciesField} should not have relativePaths according to schema "${schema}"`
          );
        }
      });
    });
  }
  const ver = version.componentId?.version;
  if (ver && !isSnap(ver) && !isTag(ver)) {
    throw new VersionInvalid(`${message}, the version "${ver}" is invalid. it's not a hash (snap) nor a tag`);
  }

  if (version.isLegacy) {
    // mainly to make sure that all Harmony components are saved with schema
    // if they don't have schema, they'll fail on this test
    if (version.extensions && version.extensions.some((e) => e.name && e.name === 'teambit.pipelines/builder')) {
      throw new VersionInvalid(
        `${message}, the extensions should not include "teambit.pipelines/builder" as of the schema "${schema}"`
      );
    }
  }
}
