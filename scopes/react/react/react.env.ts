import type { TsConfigSourceFile } from 'typescript';
import ts from 'typescript';
import { tmpdir } from 'os';
import type { Component } from '@teambit/component';
import type { ESLint as ESLintLib } from 'eslint';
import { ComponentUrl } from '@teambit/component.modules.component-url';
import type { BuildTask } from '@teambit/builder';
import { CAPSULE_ARTIFACTS_DIR } from '@teambit/builder';
import { merge, cloneDeep } from 'lodash';
import type { Bundler, BundlerContext, DevServer, DevServerContext } from '@teambit/bundler';
import type { PreviewStrategyName } from '@teambit/preview';
import { COMPONENT_PREVIEW_STRATEGY_NAME } from '@teambit/preview';
import { PrettierConfigWriter, PrettierFormatter } from '@teambit/defender.prettier-formatter';
import type {
  PrettierConfigTransformContext,
  PrettierConfigTransformer,
} from '@teambit/defender.prettier.config-mutator';
import { PrettierConfigMutator } from '@teambit/defender.prettier.config-mutator';
import { TypescriptConfigWriter } from '@teambit/typescript.typescript-compiler';
import { EslintConfigWriter, ESLintLinter } from '@teambit/defender.eslint-linter';
import type { ESLintOptions } from '@teambit/defender.eslint-linter';
import type { CompilerMain } from '@teambit/compiler';
import type {
  BuilderEnv,
  CompilerEnv,
  DependenciesEnv,
  DevEnv,
  LinterEnv,
  PackageEnv,
  TesterEnv,
  FormatterEnv,
  PipeServiceModifier,
  PipeServiceModifiersMap,
} from '@teambit/envs';
import { JestTask, JestTester, jestWorkerPath } from '@teambit/defender.jest-tester';
import type { JestWorker } from '@teambit/defender.jest-tester';
import type { PackageJsonProps, PkgMain } from '@teambit/pkg';
import type { Tester, TesterMain } from '@teambit/tester';
import type { TsConfigTransformer, TypescriptMain, TypeScriptCompilerOptions } from '@teambit/typescript';
import type { WebpackConfigTransformer, WebpackMain } from '@teambit/webpack';
import type { Workspace } from '@teambit/workspace';
import type { EslintConfigTransformContext, EslintConfigTransformer } from '@teambit/defender.eslint.config-mutator';
import { EslintConfigMutator } from '@teambit/defender.eslint.config-mutator';
import type { DependencyResolverMain } from '@teambit/dependency-resolver';
import type { Linter, LinterContext } from '@teambit/linter';
import type { Formatter, FormatterContext } from '@teambit/formatter';
import { pathNormalizeToLinux } from '@teambit/toolbox.path.path';
import type { ComponentMeta } from '@teambit/react.ui.highlighter.component-metadata.bit-component-meta';
import type { SchemaExtractor } from '@teambit/schema';
import { join, resolve } from 'path';
import { outputFileSync } from 'fs-extra';
import type { Logger } from '@teambit/logger';
import type { ConfigWriterEntry } from '@teambit/workspace-config-files';

// ensure reactEnv depends on compositions-app
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { CompositionsApp } from '@teambit/react.ui.compositions-app';
// ensure reactEnv depends on docs-app
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import DocsApps from '@teambit/react.ui.docs-app';
import type { ReactMainConfig } from './react.main.runtime';
import { ReactAspect } from './react.aspect';
// webpack configs for both components and envs
import basePreviewConfigFactory from './webpack/webpack.config.base';
import basePreviewProdConfigFactory from './webpack/webpack.config.base.prod';

// webpack configs for envs only
// import devPreviewConfigFactory from './webpack/webpack.config.preview.dev';
import envPreviewDevConfigFactory from './webpack/webpack.config.env.dev';
import { templateWebpackConfigFactory } from './webpack/webpack.config.env.template';

// webpack configs for components only
import componentPreviewProdConfigFactory from './webpack/webpack.config.component.prod';
import componentPreviewDevConfigFactory from './webpack/webpack.config.component.dev';
import type { WorkerMain } from '@teambit/worker';
import type { DevFilesMain } from '@teambit/dev-files';

export const ReactEnvType = 'react';
const defaultTsConfig = require('./typescript/tsconfig.json');
const buildTsConfig = require('./typescript/tsconfig.build.json');
const prettierConfig = require('./prettier/prettier.config');

// TODO: move to be taken from the key mode of compiler context
type CompilerMode = 'build' | 'dev';

type GetBuildPipeModifiers = PipeServiceModifiersMap & {
  tsModifier?: PipeServiceModifier;
  jestModifier?: PipeServiceModifier;
};

/**
 * a component environment built for [React](https://reactjs.org) .
 */
export class ReactEnv
  implements TesterEnv, CompilerEnv, LinterEnv, DevEnv, BuilderEnv, DependenciesEnv, PackageEnv, FormatterEnv
{
  constructor(
    /**
     * typescript extension.
     */
    protected tsAspect: TypescriptMain,

    /**
     * compiler extension.
     */
    private compiler: CompilerMain,

    /**
     * webpack extension.
     */
    private webpack: WebpackMain,

    /**
     * workspace extension.
     */
    private workspace: Workspace,

    /**
     * worker extension.
     */
    private worker: WorkerMain,

    /**
     * pkg extension.
     */
    private pkg: PkgMain,

    /**
     * tester extension
     */
    private tester: TesterMain,

    private config: ReactMainConfig,

    private dependencyResolver: DependencyResolverMain,

    private devFiles: DevFilesMain,

    private logger: Logger,

    private compilerAspectId: string
  ) {}

  getTsConfig(targetTsConfig?: TsConfigSourceFile): TsConfigSourceFile {
    return targetTsConfig ? merge({}, defaultTsConfig, targetTsConfig) : defaultTsConfig;
  }

  getBuildTsConfig(targetTsConfig?: TsConfigSourceFile): TsConfigSourceFile {
    return targetTsConfig ? merge({}, buildTsConfig, targetTsConfig) : buildTsConfig;
  }

  /**
   * @deprecated use createCjsJestTester()
   */
  getCjsJestTester(jestConfigPath?: string, jestModulePath?: string): Tester {
    return this.createCjsJestTester(jestConfigPath, jestModulePath);
  }

  /**
   * Get a jest tester instance with react config and cjs configs
   * @param jestConfigPath
   * @param jestModulePath
   * @returns
   */
  createCjsJestTester(jestConfigPath?: string, jestModulePath?: string): Tester {
    const pathToSource = pathNormalizeToLinux(__dirname).replace('/dist', '');
    const defaultConfig = join(pathToSource, './jest/jest.cjs.config.js');
    const config = jestConfigPath || defaultConfig;
    const worker = this.getJestWorker();
    const tester = JestTester.create(
      {
        jest: jestModulePath || require.resolve('jest'),
        config,
      },
      { logger: this.logger, worker }
    );

    return tester;
  }

  private getJestWorker() {
    return this.worker.declareWorker<JestWorker>('jest', jestWorkerPath);
  }

  /**
   * @deprecated use createEsmJestTester()
   */
  getEsmJestTester(jestConfigPath?: string, jestModulePath?: string): Tester {
    return this.createEsmJestTester(jestConfigPath, jestModulePath);
  }

  /**
   * Get a jest tester instance with react config and esm configs
   * @param jestConfigPath
   * @param jestModulePath
   * @returns
   */
  createEsmJestTester(jestConfigPath?: string, jestModulePath?: string): Tester {
    const pathToSource = pathNormalizeToLinux(__dirname).replace('/dist', '');
    const defaultConfig = join(pathToSource, './jest/jest.esm.config.js');
    const config = jestConfigPath || defaultConfig;
    const worker = this.getJestWorker();
    return JestTester.create(
      {
        jest: jestModulePath || require.resolve('jest'),
        config,
      },
      { logger: this.logger, worker }
    );
  }

  /**
   * returns a component tester.
   */
  getTester(jestConfigPath: string, jestModulePath?: string): Tester {
    return this.createCjsJestTester(jestConfigPath, jestModulePath);
  }

  private createTsCompilerOptions(mode: CompilerMode = 'dev'): TypeScriptCompilerOptions {
    const tsconfig = mode === 'dev' ? cloneDeep(defaultTsConfig) : cloneDeep(buildTsConfig);
    const pathToSource = pathNormalizeToLinux(__dirname).replace('/dist/', '/src/');
    const compileJs = true;
    const compileJsx = true;
    return {
      tsconfig,
      // TODO: @david please remove this line and refactor to be something that makes sense.
      types: [resolve(pathToSource, './typescript/style.d.ts'), resolve(pathToSource, './typescript/asset.d.ts')],
      compileJs,
      compileJsx,
    };
  }

  /**
   * @deprecated use createTsCjsCompiler()
   */
  getTsCjsCompiler(mode: CompilerMode = 'dev', transformers: TsConfigTransformer[] = [], tsModule = ts) {
    return this.createTsCjsCompiler(mode, transformers, tsModule);
  }

  /**
   * Get a compiler instance with react config and set it to cjs module
   * @param mode
   * @param transformers
   * @param tsModule
   * @returns
   */
  createTsCjsCompiler(mode: CompilerMode = 'dev', transformers: TsConfigTransformer[] = [], tsModule = ts) {
    const tsCompileOptions = this.createTsCompilerOptions(mode);
    return this.tsAspect.createCjsCompiler(tsCompileOptions, transformers, tsModule);
  }

  /**
   * @deprecated use createTsEsmCompiler()
   */
  getTsEsmCompiler(mode: CompilerMode = 'dev', transformers: TsConfigTransformer[] = [], tsModule = ts) {
    this.createTsEsmCompiler(mode, transformers, tsModule);
  }

  /**
   * Get a compiler instance with react config and set it to esm module
   * @param mode
   * @param transformers
   * @param tsModule
   * @returns
   */
  createTsEsmCompiler(mode: CompilerMode = 'dev', transformers: TsConfigTransformer[] = [], tsModule = ts) {
    const tsCompileOptions = this.createTsCompilerOptions(mode);
    return this.tsAspect.createEsmCompiler(tsCompileOptions, transformers, tsModule);
  }

  getCompiler(transformers: TsConfigTransformer[] = [], tsModule = ts) {
    // return this.getTsEsmCompiler('dev', transformers, tsModule);
    return this.createTsCjsCompiler('dev', transformers, tsModule);
  }

  private getEslintOptions(options: ESLintLib.Options, pluginPath: string, context: LinterContext): ESLintOptions {
    const mergedConfig: ESLintLib.Options = {
      // @ts-ignore - this is a bug in the @types/eslint types
      overrideConfig: options,
      extensions: context.extensionFormats,
      useEslintrc: false,
      // TODO: this should be probably be replaced with resolve-plugins-relative-to
      // https://eslint.org/docs/latest/use/command-line-interface#--resolve-plugins-relative-to
      cwd: pluginPath,
      fix: !!context.fix,
      fixTypes: context.fixTypes as ESLintLib.Options['fixTypes'],
    };
    return Object.assign({}, options, { config: mergedConfig, extensions: context.extensionFormats });
  }

  /**
   * returns and configures the component linter.
   */
  getLinter(context: LinterContext, transformers: EslintConfigTransformer[] = []): Linter {
    const tsconfigPath = require.resolve('./typescript/tsconfig.json');

    // resolve all plugins from the react environment.
    const eslintConfig = require('./eslint/eslintrc');
    const mergedOptions = this.getEslintOptions(eslintConfig, __dirname, context);
    const configMutator = new EslintConfigMutator(mergedOptions);
    const transformerContext: EslintConfigTransformContext = { fix: !!context.fix };
    configMutator.addExtensionTypes(['.md', '.mdx']);
    configMutator.setTsConfig(tsconfigPath);
    const afterMutation = runTransformersWithContext(configMutator.clone(), transformers, transformerContext);
    return ESLintLinter.create(afterMutation.raw, { logger: this.logger });
  }

  /**
   * returns and configures the component formatter.
   */
  getFormatter(context: FormatterContext, transformers: PrettierConfigTransformer[] = []): Formatter {
    const configMutator = new PrettierConfigMutator(prettierConfig);
    const transformerContext: PrettierConfigTransformContext = { check: !!context?.check };
    const afterMutation = runTransformersWithContext(configMutator.clone(), transformers, transformerContext);
    return PrettierFormatter.create({ config: afterMutation.raw }, { logger: this.logger });
  }

  private getFileMap(components: Component[], local = false) {
    return components.reduce<{ [key: string]: ComponentMeta }>((index, component: Component) => {
      component.state.filesystem.files.forEach((file) => {
        index[file.path] = {
          id: component.id.toString(),
          homepage: local ? `/${component.id.fullName}` : ComponentUrl.toUrl(component.id),
        };
      });

      return index;
    }, {});
  }

  private writeFileMap(components: Component[], local?: boolean) {
    const fileMap = this.getFileMap(components, local);
    const path = join(tmpdir(), `${Math.random().toString(36).slice(2, 11)}.json`);
    outputFileSync(path, JSON.stringify(fileMap));
    return path;
  }

  /**
   * required for `bit start`
   */
  getDevEnvId(id?: string) {
    if (typeof id !== 'string') return ReactAspect.id;
    return id || ReactAspect.id;
  }

  /**
   * get a schema generator instance configured with the correct tsconfig.
   */
  getSchemaExtractor(tsconfig: TsConfigSourceFile, tsserverPath?: string, contextPath?: string): SchemaExtractor {
    return this.tsAspect.createSchemaExtractor(this.getTsConfig(tsconfig), tsserverPath, contextPath);
  }

  /**
   * returns and configures the React component dev server.
   * required for `bit start`
   */
  getDevServer(
    context: DevServerContext,
    transformers: WebpackConfigTransformer[] = [],
    webpackModulePath?: string,
    webpackDevServerModulePath?: string
  ): DevServer {
    const baseConfig = basePreviewConfigFactory(false);
    const envDevConfig = envPreviewDevConfigFactory(context.id);
    const componentDevConfig = componentPreviewDevConfigFactory(this.workspace.path, context.id);

    const defaultTransformer: WebpackConfigTransformer = (configMutator) => {
      const merged = configMutator.merge([baseConfig, envDevConfig, componentDevConfig]);
      return merged;
    };

    return this.webpack.createDevServer(
      context,
      [defaultTransformer, ...transformers],
      webpackModulePath,
      webpackDevServerModulePath
    );
  }

  async getBundler(
    context: BundlerContext,
    transformers: WebpackConfigTransformer[] = [],
    webpackModulePath?: string
  ): Promise<Bundler> {
    return this.createComponentsWebpackBundler(context, transformers, webpackModulePath);
  }

  async createComponentsWebpackBundler(
    context: BundlerContext,
    transformers: WebpackConfigTransformer[] = [],
    webpackModulePath?: string
  ): Promise<Bundler> {
    const baseConfig = basePreviewConfigFactory(!context.development);
    const baseProdConfig = basePreviewProdConfigFactory(context.development);
    const componentProdConfig = componentPreviewProdConfigFactory();

    const defaultTransformer: WebpackConfigTransformer = (configMutator) => {
      const merged = configMutator.merge([baseConfig, baseProdConfig, componentProdConfig]);
      return merged;
    };
    const mergedTransformers = [defaultTransformer, ...transformers];
    return this.createWebpackBundler(context, mergedTransformers, webpackModulePath);
  }

  async createTemplateWebpackBundler(
    context: BundlerContext,
    transformers: WebpackConfigTransformer[] = [],
    webpackModulePath?: string
  ): Promise<Bundler> {
    const baseConfig = basePreviewConfigFactory(!context.development);
    const baseProdConfig = basePreviewProdConfigFactory(context.development);
    const templateConfig = templateWebpackConfigFactory();

    const defaultTransformer: WebpackConfigTransformer = (configMutator) => {
      const merged = configMutator.merge([baseConfig, baseProdConfig, templateConfig]);
      return merged;
    };
    const mergedTransformers = [defaultTransformer, ...transformers];
    return this.createWebpackBundler(context, mergedTransformers, webpackModulePath);
  }

  private async createWebpackBundler(
    context: BundlerContext,
    transformers: WebpackConfigTransformer[] = [],
    webpackModulePath?: string
  ): Promise<Bundler> {
    return this.webpack.createBundler(context, transformers, undefined, webpackModulePath);
  }

  getAdditionalHostDependencies(): string[] {
    return ['@teambit/mdx.ui.mdx-scope-context', '@mdx-js/react', 'react', 'react-dom'];
  }

  /**
   * returns a path to a docs template.
   */
  getDocsTemplate() {
    return require.resolve('@teambit/react.ui.docs-app');
  }

  icon = 'https://static.bit.dev/extensions-icons/react.svg';

  /**
   * returns the path to the compositions template
   */
  getMounter() {
    return require.resolve('@teambit/react.ui.compositions-app');
  }

  getPreviewConfig() {
    return {
      strategyName: COMPONENT_PREVIEW_STRATEGY_NAME as PreviewStrategyName,
      splitComponentBundle: true,
      isScaling: true,
    };
  }

  /**
   * define the package json properties to add to each component.
   */
  getPackageJsonProps(): PackageJsonProps {
    // React compile by default to esm, so uses type module
    // return this.getEsmPackageJsonProps();
    return this.getCjsPackageJsonProps();
  }

  /**
   * @deprecated use createCjsPackageJsonProps()
   */
  getCjsPackageJsonProps(): PackageJsonProps {
    return this.createCjsPackageJsonProps();
  }

  /**
   * Get the default package.json props for a cjs component
   * @returns
   */
  createCjsPackageJsonProps(): PackageJsonProps {
    return this.tsAspect.getCjsPackageJsonProps();
  }

  /**
   * @deprecated use createEsmPackageJsonProps()
   */
  getEsmPackageJsonProps(): PackageJsonProps {
    return this.createEsmPackageJsonProps();
  }

  /**
   * Get the default package.json props for an esm component
   * @returns
   */
  createEsmPackageJsonProps(): PackageJsonProps {
    return this.tsAspect.getEsmPackageJsonProps();
  }

  getNpmIgnore() {
    return [`${CAPSULE_ARTIFACTS_DIR}/*`];
  }

  /**
   * adds dependencies to all configured components.
   */
  getDependencies() {
    return {
      dependencies: {
        react: '-',
        'react-dom': '-',
        'core-js': '^3.0.0',
      },
      // TODO: add this only if using ts
      devDependencies: {
        react: '-',
        'react-dom': '-',
        '@types/mocha': '-',
        '@types/node': '12.20.4',
        '@types/react': '^17.0.8',
        '@types/react-dom': '^17.0.5',
        '@types/jest': '^26.0.0',
        // This is added as dev dep since our jest file transformer uses babel plugins that require this to be installed
        '@babel/runtime': '7.20.0',
        '@types/testing-library__jest-dom': '5.9.5',
      },
      peerDependencies: {
        react: '^16.8.0 || ^17.0.0',
        'react-dom': '^16.8.0 || ^17.0.0',
      },
    };
  }

  /**
   * returns the component build pipeline.
   */
  getBuildPipe(modifiers: GetBuildPipeModifiers = {}): BuildTask[] {
    const transformers: Function[] = modifiers?.tsModifier?.transformers || [];
    const pathToSource = pathNormalizeToLinux(__dirname).replace('/dist', '');
    const jestConfigPath =
      modifiers?.jestModifier?.transformers?.[0]() || join(pathToSource, './jest/jest.cjs.config.js');
    const jestPath = modifiers?.jestModifier?.module || require.resolve('jest');
    const worker = this.getJestWorker();
    const testerTask = JestTask.create(
      { config: jestConfigPath, jest: jestPath },
      { logger: this.logger, worker, devFiles: this.devFiles }
    );
    return [this.createCjsCompilerTask(transformers, modifiers?.tsModifier?.module || ts), testerTask];
  }

  /**
   * @deprecated use createBuildPipeWithoutCompiler()
   */
  getBuildPipeWithoutCompiler(): BuildTask[] {
    return this.createBuildPipeWithoutCompiler();
  }

  /**
   * Get the react build pipeline without the compilation task.
   * This help in cases you want to only replace the compilation task with something else
   * @returns
   */
  createBuildPipeWithoutCompiler(): BuildTask[] {
    const pipeWithoutCompiler = this.getBuildPipe().filter((task) => task.aspectId !== this.compilerAspectId);
    return pipeWithoutCompiler;
  }

  /**
   * @deprecated use createEsmCompilerTask()
   */
  getEsmCompilerTask(transformers: TsConfigTransformer[] = [], tsModule = ts) {
    return this.createEsmCompilerTask(transformers as Function[], tsModule);
  }

  /**
   * Get a compiler task with react config and set to esm module
   * @param transformers
   * @param tsModule
   * @returns
   */
  createEsmCompilerTask(transformers: Function[] = [], tsModule = ts) {
    const tsCompiler = this.createTsEsmCompiler('build', transformers as TsConfigTransformer[], tsModule);
    return this.compiler.createTask('TSCompiler', tsCompiler);
  }

  /**
   * @deprecated use createCjsCompilerTask()
   * */
  getCjsCompilerTask(transformers: TsConfigTransformer[] = [], tsModule = ts) {
    return this.createCjsCompilerTask(transformers as Function[], tsModule);
  }

  /**
   * Get a compiler task with react config and set to cjs module
   * @param transformers
   * @param tsModule
   * @returns
   */
  createCjsCompilerTask(transformers: Function[] = [], tsModule = ts) {
    const tsCompiler = this.createTsCjsCompiler('build', transformers as TsConfigTransformer[], tsModule);
    return this.compiler.createTask('TSCompiler', tsCompiler);
  }

  workspaceConfig(): ConfigWriterEntry[] {
    return [
      TypescriptConfigWriter.create(
        {
          tsconfig: require.resolve('./typescript/tsconfig.cjs.json'),
          // types: resolveTypes(__dirname, ["./types"]),
        },
        this.logger
      ),
      EslintConfigWriter.create(
        {
          configPath: require.resolve('./eslint/eslintrc.js'),
          tsconfig: require.resolve('./typescript/tsconfig.cjs.json'),
        },
        this.logger
      ),
      PrettierConfigWriter.create(
        {
          configPath: require.resolve('./prettier/prettier.config.js'),
        },
        this.logger
      ),
    ];
  }

  async __getDescriptor() {
    return {
      type: ReactEnvType,
    };
  }
}

export function runTransformersWithContext<P, T extends Function, C>(config: P, transformers: T[] = [], context: C): P {
  if (!Array.isArray(transformers)) return config;
  const newConfig = transformers.reduce((acc, transformer) => {
    return transformer(acc, context);
  }, config);
  return newConfig;
}
