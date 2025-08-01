import fs from 'fs-extra';
import { fromPairs } from 'lodash';
import { FileStatus } from '@teambit/component.modules.merge-helper';
import { VERSION_DELIMITER } from '@teambit/legacy.constants';
import { removeChalkCharacters } from '@teambit/legacy.utils';
import WorkspaceJsoncHelper from './e2e-workspace-jsonc-helper';
import BitMapHelper from './e2e-bitmap-helper';
import CommandHelper from './e2e-command-helper';
import ComponentJsonHelper from './e2e-component-json-helper';
import ConfigHelper from './e2e-config-helper';
import EnvHelper from './e2e-env-helper';
import ExtensionsHelper from './e2e-extensions-helper';
import FixtureHelper from './e2e-fixtures-helper';
import FsHelper from './e2e-fs-helper';
import GeneralHelper from './e2e-general-helper';
import GitHelper from './e2e-git-helper';
import NpmHelper from './e2e-npm-helper';
import PackageJsonHelper from './e2e-package-json-helper';
import ScopeHelper from './e2e-scope-helper';
import ScopeJsonHelper from './e2e-scope-json-helper';
import type { ScopesOptions } from './e2e-scopes';
import ScopesData from './e2e-scopes';
import CapsulesHelper from './e2e-capsules-helper';

export type HelperOptions = {
  scopesOptions?: ScopesOptions;
};
export class Helper {
  debugMode: boolean;
  scopes: ScopesData;
  scopeJson: ScopeJsonHelper;
  workspaceJsonc: WorkspaceJsoncHelper;
  componentJson: ComponentJsonHelper;
  fs: FsHelper;
  command: CommandHelper;
  config: ConfigHelper;
  bitMap: BitMapHelper;
  env: EnvHelper;
  extensions: ExtensionsHelper;
  fixtures: FixtureHelper;
  general: GeneralHelper;
  npm: NpmHelper;
  packageJson: PackageJsonHelper;
  scopeHelper: ScopeHelper;
  git: GitHelper;
  capsules: CapsulesHelper;
  constructor(helperOptions?: HelperOptions) {
    this.debugMode = Boolean(process.env.npm_config_debug) || process.argv.includes('--debug'); // debug mode shows the workspace/scopes dirs and doesn't delete them
    this.scopes = new ScopesData(helperOptions?.scopesOptions); // generates dirs and scope names
    this.scopeJson = new ScopeJsonHelper(this.scopes);
    this.workspaceJsonc = new WorkspaceJsoncHelper(this.scopes);
    this.componentJson = new ComponentJsonHelper(this.scopes);
    this.packageJson = new PackageJsonHelper(this.scopes);
    this.fs = new FsHelper(this.scopes);
    this.command = new CommandHelper(this.scopes, this.debugMode);
    this.bitMap = new BitMapHelper(this.scopes, this.fs);
    this.config = new ConfigHelper(this.command);
    this.npm = new NpmHelper(this.scopes, this.fs, this.command);
    this.scopeHelper = new ScopeHelper(
      this.debugMode,
      this.scopes,
      this.command,
      this.fs,
      this.npm,
      this.workspaceJsonc
    );
    this.git = new GitHelper(this.scopes, this.command, this.scopeHelper);
    this.fixtures = new FixtureHelper(
      this.fs,
      this.command,
      this.npm,
      this.scopes,
      this.debugMode,
      this.packageJson,
      this.scopeHelper
    );
    this.extensions = new ExtensionsHelper(
      this.scopes,
      this.command,
      this.workspaceJsonc,
      this.scopeHelper,
      this.fixtures,
      this.fs
    );
    this.env = new EnvHelper(this.command, this.fs, this.scopes, this.scopeHelper, this.fixtures, this.extensions);
    this.general = new GeneralHelper(this.scopes, this.npm, this.command);
    this.capsules = new CapsulesHelper(this.command);
  }
}

export function ensureAndWriteJson(filePath: string, fileContent: any) {
  fs.ensureFileSync(filePath);
  fs.writeJsonSync(filePath, fileContent, { spaces: 2 });
}

export const FileStatusWithoutChalk = fromPairs(
  Object.entries(FileStatus)
    .map(([status, value]) => [status, removeChalkCharacters(value as string)])
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
);

export { VERSION_DELIMITER };
