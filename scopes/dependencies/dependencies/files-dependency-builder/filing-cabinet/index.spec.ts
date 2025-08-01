import { BIT_TEMP_ROOT } from '@teambit/defender.fs.global-bit-temp-dir';
import fs from 'fs-extra';
import assert from 'assert';
import path from 'path';
import rewire from 'rewire';
import sinon from 'sinon';

import type { DependencyDetector } from '@teambit/dependency-resolver';

const UNIT_TEST_DIR = path.join(BIT_TEMP_ROOT, 'unit-test');

const cabinetNonDefault = rewire('./');
const cabinet = cabinetNonDefault.default;

const fixtures = path.resolve(`${__dirname}/../fixtures/filing-cabinet`);

// eslint-disable-next-line import/no-dynamic-require, global-require
const mockedFiles = require(`${fixtures}/mockedJSFiles`);
// eslint-disable-next-line import/no-dynamic-require, global-require
const mockAST = require(`${fixtures}/ast`);

function mockfs(obj: any, acc?: string) {
  Object.entries(obj).forEach(([key, value]) => {
    if (typeof value === 'string') {
      const filePath = acc ? path.join(acc, key) : key;
      const fullFilePath = path.join(UNIT_TEST_DIR, filePath);
      const content = value;
      return fs.outputFileSync(fullFilePath, content);
    }
    mockfs(value, acc ? path.join(acc, key) : key);
    return undefined;
  });
}

function cleanUnitDir() {
  fs.removeSync(UNIT_TEST_DIR);
}

// try {
//   // eslint-disable-next-line global-require
//   require('module-lookup-amd');
// } catch (err: any) {
//   // eslint-disable-next-line no-console
//   console.log(`mocha suppresses the error, so console.error is needed to show the error on the screen.
// the problem is with module-lookup-amd that calls requirejs package and uses rewire package.
// see https://github.com/jhnns/rewire/issues/178 for more details.
// the error occurs since node v12.16.0. for the time being, to run the tests, use an earlier version.
// `);
//   // eslint-disable-next-line no-console
//   console.error(err);
//   throw err;
// }

describe('filing-cabinet', () => {
  describe('JavaScript', () => {
    beforeEach(() => {
      mockfs(mockedFiles);
    });

    afterEach(() => {
      cleanUnitDir();
    });

    it('uses a generic resolve for unsupported file extensions', () => {
      const resolvedFile = cabinet({
        dependency: './bar',
        filename: `${UNIT_TEST_DIR}/js/commonjs/foo.baz`,
        directory: `${UNIT_TEST_DIR}/js/commonjs/`,
      });
      assert.ok(resolvedFile.endsWith('bar.baz'));
    });

    describe('when given an ast for a JS file', () => {
      it('reuses the ast when trying to determine the module type', () => {
        const ast = {};

        const result = cabinet({
          dependency: './bar',
          filename: `${UNIT_TEST_DIR}/js/es6/foo.js`,
          directory: `${UNIT_TEST_DIR}/js/es6/`,
          ast,
        });
        assert.ok(result.endsWith('es6/bar.js'));
      });

      it('resolves the dependency successfully', () => {
        const result = cabinet({
          dependency: './bar',
          filename: `${UNIT_TEST_DIR}/js/es6/foo.js`,
          directory: `${UNIT_TEST_DIR}/js/es6/`,
          ast: mockAST,
        });
        assert.equal(result, path.join(UNIT_TEST_DIR, 'js/es6/bar.js'));
      });
    });

    describe('when not given an ast', () => {
      it('uses the filename to look for the module type', () => {
        const options = {
          dependency: './bar',
          filename: `${UNIT_TEST_DIR}/js/es6/foo.js`,
          directory: `${UNIT_TEST_DIR}/js/es6/`,
        };

        const result = cabinet(options);
        assert.equal(result, path.join(UNIT_TEST_DIR, 'js/es6/bar.js'));
      });
    });

    describe('es6', () => {
      // TODO: commonJSLookup is not able to be stubbed after the revamp, but keep the test case temporarily for reference
      it.skip('assumes commonjs for es6 modules with no requirejs/webpack config', () => {
        const stub = sinon.stub();
        const revert = cabinetNonDefault.__set__('commonJSLookup', stub);

        cabinet({
          dependency: './bar',
          filename: `${UNIT_TEST_DIR}/js/es6/foo.js`,
          directory: `${UNIT_TEST_DIR}/js/es6/`,
        });

        assert.ok(stub.called);

        revert();
      });
    });

    describe('jsx', () => {
      it('resolves files with the .jsx extension', () => {
        const result = cabinet({
          dependency: './bar',
          filename: `${UNIT_TEST_DIR}/js/es6/foo.jsx`,
          directory: `${UNIT_TEST_DIR}/js/es6/`,
        });

        assert.equal(result, `${path.join(UNIT_TEST_DIR, 'js/es6/bar.js')}`);
      });
    });

    // describe('amd', () => {
    //   it('uses the amd resolver', () => {
    //     const resolvedFile = cabinet({
    //       dependency: './bar',
    //       filename: `${UNIT_TEST_DIR}/js/amd/foo.js`,
    //       directory: `${UNIT_TEST_DIR}/js/amd/`,
    //     });
    //     assert.ok(resolvedFile.endsWith('amd/bar.js'));
    //   });

    //   // skipped as part of lazy loading fix. not seems to be super helpful test
    //   it.skip('passes along arguments', () => {
    //     const stub = sinon.stub();
    //     const revert = cabinet.__set__('amdLookup', stub);
    //     const config = { baseUrl: 'js' };

    //     cabinet({
    //       dependency: 'bar',
    //       config,
    //       configPath: 'config.js',
    //       filename: `${UNIT_TEST_DIR}/js/amd/foo.js`,
    //       directory: `${UNIT_TEST_DIR}/js/amd/`,
    //     });

    //     const args = stub.getCall(0).args[0];

    //     assert.equal(args.dependency, 'bar');
    //     assert.equal(args.config, config);
    //     assert.equal(args.configPath, 'config.js');
    //     assert.equal(args.filename, 'js/amd/foo.js');
    //     assert.equal(args.directory, 'js/amd/');

    //     assert.ok(stub.called);

    //     revert();
    //   });
    // });

    describe('commonjs', () => {
      // TODO: commonJSLookup is not able to be stubbed after the revamp, but keep the test case temporarily for reference
      it.skip("uses require's resolver", () => {
        const stub = sinon.stub();
        const revert = cabinetNonDefault.__set__('commonJSLookup', stub);

        cabinet({
          dependency: './bar',
          filename: `${UNIT_TEST_DIR}/js/commonjs/foo.js`,
          directory: `${UNIT_TEST_DIR}/js/commonjs/`,
        });

        assert.ok(stub.called);

        revert();
      });

      it('returns an empty string for an unresolved module', () => {
        const result = cabinet({
          dependency: 'foobar',
          filename: `${UNIT_TEST_DIR}/js/commonjs/foo.js`,
          directory: `${UNIT_TEST_DIR}/js/commonjs/`,
        });

        assert.equal(result, '');
      });

      it('adds the directory to the require resolution paths', () => {
        const directory = `${UNIT_TEST_DIR}/js/commonjs/`;
        cabinet({
          dependency: 'foobar',
          filename: `${UNIT_TEST_DIR}/js/commonjs/foo.js`,
          directory,
        });

        assert.ok(
          // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
          require.main.paths.some(function (p) {
            return p.indexOf(path.normalize(directory)) !== -1;
          })
        );
      });

      it('resolves a relative dependency about the filename', () => {
        const directory = `${UNIT_TEST_DIR}/js/commonjs/`;
        const filename = `${directory}foo.js`;

        const result = cabinet({
          dependency: './bar',
          filename,
          directory,
        });

        assert.equal(result, path.join(path.resolve(directory), 'bar.js'));
      });

      it("resolves a .. dependency to its parent directory's index.js file", () => {
        const directory = `${UNIT_TEST_DIR}/js/commonjs/`;
        const filename = `${directory}subdir/module.js`;

        const result = cabinet({
          dependency: '../',
          filename,
          directory,
        });

        assert.equal(result, path.join(path.resolve(directory), 'index.js'));
      });

      // @todo: fix
      it.skip('resolves a dependency within a directory outside of the given file', () => {
        const directory = `${UNIT_TEST_DIR}/js/commonjs/`;
        const filename = `${directory}test/index.spec.js`;

        const result = cabinet({
          dependency: 'subdir',
          filename,
          directory,
        });

        assert.equal(result, path.join(path.resolve(directory), 'subdir/index.js'));
      });

      // @todo: fix
      it.skip('resolves a node module with module entry in package.json', () => {
        const directory = `${UNIT_TEST_DIR}/js/commonjs/`;
        const filename = `${directory}module.entry.js`;

        const result = cabinet({
          dependency: 'module.entry',
          filename,
          directory,
          nodeModulesConfig: {
            entry: 'module',
          },
        });

        assert.equal(
          result,
          path.join(path.resolve(directory), '..', 'node_modules', 'module.entry', 'index.module.js')
        );
      });

      it('resolves a nested module', () => {
        const directory = `${UNIT_TEST_DIR}/js/node_modules/nested/`;
        const filename = `${directory}index.js`;

        const result = cabinet({
          dependency: 'lodash.assign',
          filename,
          directory,
        });

        assert.equal(result, path.join(path.resolve(directory), 'node_modules', 'lodash.assign', 'index.js'));
      });

      it('resolves to the index.js file of a directory', () => {
        const directory = `${UNIT_TEST_DIR}/js/withIndex`;
        const filename = `${directory}/index.js`;

        const result = cabinet({
          dependency: './subdir',
          filename,
          directory,
        });

        assert.equal(result, path.normalize(`${path.resolve(directory)}/subdir/index.js`));
      });

      it('resolves implicit .jsx requires', () => {
        const result = cabinet({
          dependency: './bar',
          filename: `${UNIT_TEST_DIR}/js/cjs/foo.js`,
          directory: `${UNIT_TEST_DIR}/js/cjs/`,
        });

        assert.equal(result, `${path.join(UNIT_TEST_DIR, 'js/cjs/bar.jsx')}`);
      });

      it('resolves implicit .scss requires', () => {
        const result = cabinet({
          dependency: './baz',
          filename: `${UNIT_TEST_DIR}/js/cjs/foo.js`,
          directory: `${UNIT_TEST_DIR}/js/cjs/`,
        });

        assert.equal(result, `${path.join(UNIT_TEST_DIR, 'js/cjs/baz.scss')}`);
      });

      it('resolves implicit .json requires', () => {
        const result = cabinet({
          dependency: './pkg',
          filename: `${UNIT_TEST_DIR}/js/cjs/foo.js`,
          directory: `${UNIT_TEST_DIR}/js/cjs/`,
        });

        assert.equal(result, `${path.join(UNIT_TEST_DIR, 'js/cjs/pkg.json')}`);
      });
    });

    describe('typescript', () => {
      it('resolves an import', () => {
        const directory = `${UNIT_TEST_DIR}/js/ts`;
        const filename = `${directory}/index.ts`;

        const result = cabinet({
          dependency: './foo',
          filename,
          directory,
        });

        assert.equal(result, path.join(path.resolve(directory), 'foo.ts'));
      });

      describe('when a dependency does not exist', () => {
        it('returns an empty result', () => {
          const directory = `${UNIT_TEST_DIR}/js/ts`;
          const filename = `${directory}/index.ts`;

          const result = cabinet({
            dependency: './barbar',
            filename,
            directory,
          });

          assert.equal(result, '');
        });
      });
    });
  });

  describe('CSS', () => {
    beforeEach(() => {
      mockfs({
        stylus: {
          'foo.styl': '',
          'bar.styl': '',
        },
        sass: {
          'foo.scss': '',
          'bar.scss': '',
          'foo.sass': '',
          'bar.sass': '',
        },
        less: {
          'foo.less': '',
          'bar.less': '',
          'bar.css': '',
        },
      });

      // mockJSDir = path.resolve(__dirname, '../');
    });

    afterEach(() => {
      cleanUnitDir();
    });

    describe('sass', () => {
      it('uses the sass resolver for .scss files', () => {
        const result = cabinet({
          dependency: 'bar',
          filename: `${UNIT_TEST_DIR}/sass/foo.scss`,
          directory: `${UNIT_TEST_DIR}/sass/`,
        });

        assert.equal(result, path.normalize(`${UNIT_TEST_DIR}/sass/bar.scss`));
      });

      it('uses the sass resolver for .sass files', () => {
        const result = cabinet({
          dependency: 'bar',
          filename: `${UNIT_TEST_DIR}/sass/foo.sass`,
          directory: `${UNIT_TEST_DIR}/sass/`,
        });

        assert.equal(result, path.normalize(`${UNIT_TEST_DIR}/sass/bar.sass`));
      });
    });

    describe('stylus', () => {
      it('uses the stylus resolver', () => {
        const result = cabinet({
          dependency: 'bar',
          filename: `${UNIT_TEST_DIR}/stylus/foo.styl`,
          directory: `${UNIT_TEST_DIR}/stylus/`,
        });

        assert.equal(result, path.normalize(`${UNIT_TEST_DIR}/stylus/bar.styl`));
      });
    });

    describe('less', () => {
      it('resolves extensionless dependencies', () => {
        const result = cabinet({
          dependency: 'bar',
          filename: `${UNIT_TEST_DIR}/less/foo.less`,
          directory: `${UNIT_TEST_DIR}/less/`,
        });

        assert.equal(result, path.normalize(`${UNIT_TEST_DIR}/less/bar.less`));
      });

      it('resolves dependencies with a less extension', () => {
        const result = cabinet({
          dependency: 'bar.less',
          filename: `${UNIT_TEST_DIR}/less/foo.less`,
          directory: `${UNIT_TEST_DIR}/less/`,
        });

        assert.equal(result, path.normalize(`${UNIT_TEST_DIR}/less/bar.less`));
      });

      it('resolves dependencies with a css extension', () => {
        const result = cabinet({
          dependency: 'bar.css',
          filename: `${UNIT_TEST_DIR}/less/foo.less`,
          directory: `${UNIT_TEST_DIR}/less/`,
        });

        assert.equal(result, path.normalize(`${UNIT_TEST_DIR}/less/bar.css`));
      });
    });
  });

  describe('unrecognized extension', () => {
    it('uses a generic resolve for unsupported file extensions', () => {
      const result = cabinet({
        dependency: './bar',
        filename: `${UNIT_TEST_DIR}/barbazim/foo.baz`,
        directory: `${UNIT_TEST_DIR}/barbazim/`,
      });

      assert.equal(result, path.normalize(`${UNIT_TEST_DIR}/barbazim/bar.baz`));
    });
  });

  describe('custom env lookups', () => {
    it('supports passing env detectors', () => {
      const detector: DependencyDetector = {
        detect: (fileContent: string) => {
          return fileContent.indexOf('foo') === -1 ? [] : ['foo'];
        },
        isSupported: ({ ext }) => {
          return ext === '.foo';
        },
        dependencyLookup: ({ dependency }) => {
          return `/xyz/${dependency}.baz`;
        },
        type: 'foo',
      };
      const result = cabinet({
        directory: `${UNIT_TEST_DIR}/barbazim/`,
        filename: `${UNIT_TEST_DIR}/barbazim/xxx.foo`,
        ext: '.foo',
        dependency: 'bar',
        envDetectors: [detector],
      });

      assert.equal(result, '/xyz/bar.baz');
    });
  });

  describe('.register', () => {
    it('registers a custom resolver for a given extension', () => {
      const stub = sinon.stub().returns('foo.foobar');
      cabinetNonDefault.register('.foobar', stub);

      const pathResult = cabinet({
        dependency: './bar',
        filename: `${UNIT_TEST_DIR}/js/amd/foo.foobar`,
        directory: `${UNIT_TEST_DIR}/js/amd/`,
      });

      assert.ok(stub.called);
      assert.equal(pathResult, 'foo.foobar');
    });

    it('allows does not break default resolvers', () => {
      mockfs({
        stylus: {
          'foo.styl': '',
          'bar.styl': '',
        },
      });

      const stub = sinon.stub().returns('foo');

      cabinetNonDefault.register('.foobar', stub);

      cabinet({
        dependency: './bar',
        filename: `${UNIT_TEST_DIR}/js/amd/foo.foobar`,
        directory: `${UNIT_TEST_DIR}/js/amd/`,
      });

      const result = cabinet({
        dependency: './bar',
        filename: `${UNIT_TEST_DIR}/stylus/foo.styl`,
        directory: `${UNIT_TEST_DIR}/stylus/`,
      });

      assert.ok(stub.called);
      assert.ok(result);

      cleanUnitDir();
    });

    it('can be called multiple times', () => {
      const stub = sinon.stub().returns('foo');
      const stub2 = sinon.stub().returns('foo');

      cabinetNonDefault.register('.foobar', stub);
      cabinetNonDefault.register('.barbar', stub2);

      cabinet({
        dependency: './bar',
        filename: `${UNIT_TEST_DIR}/js/amd/foo.foobar`,
        directory: `${UNIT_TEST_DIR}/js/amd/`,
      });

      cabinet({
        dependency: './bar',
        filename: `${UNIT_TEST_DIR}/js/amd/foo.barbar`,
        directory: `${UNIT_TEST_DIR}/js/amd/`,
      });

      assert.ok(stub.called);
      assert.ok(stub2.called);
    });

    it('does not add redundant extensions to supportedFileExtensions', () => {
      const stub = sinon.stub;
      const newExt = '.foobar';

      cabinetNonDefault.register(newExt, stub);
      cabinetNonDefault.register(newExt, stub);

      const { supportedFileExtensions } = cabinetNonDefault;

      assert.equal(supportedFileExtensions.indexOf(newExt), supportedFileExtensions.lastIndexOf(newExt));
    });
  });

  // @todo: fix.
  describe.skip('webpack', () => {
    let directory;

    beforeEach(() => {
      directory = path.resolve(__dirname, '../../../');
    });

    function testResolution(dependency, expected) {
      const resolved = cabinet({
        dependency,
        filename: `${__dirname}/index.js`,
        directory,
        webpackConfig: `${fixtures}/webpack.config.js`,
      });

      assert.equal(resolved, path.normalize(expected));
    }

    it('resolves an aliased path', () => {
      testResolution('R', `${directory}/node_modules/resolve/index.js`);
    });

    it('resolves a non-aliased path', () => {
      testResolution('resolve', `${directory}/node_modules/resolve/index.js`);
    });

    it('resolves a relative path', () => {
      testResolution('./test/ast', `${fixtures}/test/ast.js`);
    });

    it('resolves an absolute path from a file within a subdirectory', () => {
      const resolved = cabinet({
        dependency: 'R',
        filename: `${fixtures}/test/ast.js`,
        directory,
        webpackConfig: `${fixtures}/webpack.config.js`,
      });

      assert.equal(resolved, `${directory}/node_modules/resolve/index.js`);
    });

    it('resolves a path using resolve.root', () => {
      const resolved = cabinet({
        dependency: 'mod1',
        filename: `${directory}/index.js`,
        directory,
        webpackConfig: `${directory}/webpack-root.config.js`,
      });

      assert.equal(resolved, `${directory}/test/root1/mod1.js`);
    });

    it('resolves NPM module when using resolve.root', () => {
      const resolved = cabinet({
        dependency: 'resolve',
        filename: `${directory}/index.js`,
        directory,
        webpackConfig: `${directory}/webpack-root.config.js`,
      });

      assert.equal(resolved, `${directory}/node_modules/resolve/index.js`);
    });

    it('resolves NPM module when using resolve.modulesDirectories', () => {
      const resolved = cabinet({
        dependency: 'resolve',
        filename: `${directory}/index.js`,
        directory,
        webpackConfig: `${directory}/webpack-root.config.js`,
      });

      assert.equal(resolved, `${directory}/node_modules/resolve/index.js`);
    });

    it('resolves a path using resolve.modulesDirectories', () => {
      const resolved = cabinet({
        dependency: 'mod2',
        filename: `${directory}/index.js`,
        directory,
        webpackConfig: `${directory}/webpack-root.config.js`,
      });

      assert.equal(resolved, `${directory}/test/root2/mod2.js`);
    });

    it('resolves a path using webpack config that exports a function', () => {
      const resolved = cabinet({
        dependency: 'R',
        filename: `${directory}/index.js`,
        directory,
        webpackConfig: `${directory}/webpack-env.config.js`,
      });

      assert.equal(resolved, `${directory}/node_modules/resolve/index.js`);
    });

    it('resolves files with a .jsx extension', () => {
      testResolution('./test/foo.jsx', `${directory}/test/foo.jsx`);
    });

    describe('when the dependency contains a loader', () => {
      it('still works', () => {
        testResolution('hgn!resolve', `${directory}/node_modules/resolve/index.js`);
      });
    });
  });
});
