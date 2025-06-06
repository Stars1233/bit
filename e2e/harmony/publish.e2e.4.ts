import chai, { expect } from 'chai';
import { generateRandomStr } from '@teambit/toolbox.string.random';
import { Helper, DEFAULT_OWNER, NpmCiRegistry, supportNpmCiRegistryTesting } from '@teambit/legacy.e2e-helper';

chai.use(require('chai-fs'));

describe('publish functionality', function () {
  this.timeout(0);
  let helper: Helper;
  let npmCiRegistry: NpmCiRegistry;
  before(() => {
    helper = new Helper({ scopesOptions: { remoteScopeWithDot: true } });
  });
  after(() => {
    helper.scopeHelper.destroy();
  });
  describe('workspace with TS components', () => {
    let appOutput: string;
    let scopeBeforeTag: string;
    let scopeWithoutOwner: string;
    before(() => {
      helper.scopeHelper.setWorkspaceWithRemoteScope();
      helper.workspaceJsonc.setPackageManager();
      scopeWithoutOwner = helper.scopes.remoteWithoutOwner;
      appOutput = helper.fixtures.populateComponentsTS(3);
      npmCiRegistry = new NpmCiRegistry(helper);
      npmCiRegistry.configureCiInPackageJsonHarmony();
      scopeBeforeTag = helper.scopeHelper.cloneWorkspace();
    });
    describe('publishing before tag', () => {
      it('should throw an error', () => {
        const output = helper.general.runWithTryCatch('bit publish comp1');
        expect(output).to.have.string(
          'unable to publish the following component(s), please make sure they are exported'
        );
        expect(output).to.have.string('comp1');
      });
    });
    (supportNpmCiRegistryTesting ? describe : describe.skip)('publishing the components', () => {
      before(async () => {
        await npmCiRegistry.init();
      });
      after(() => {
        npmCiRegistry.destroy();
      });
      describe('automatically by tag pipeline', () => {
        before(() => {
          helper.scopeHelper.getClonedWorkspace(scopeBeforeTag);
          helper.command.tagAllComponents();
        });
        it('should publish them successfully and be able to consume them by installing the packages', () => {
          helper.scopeHelper.reInitWorkspace();
          helper.npm.initNpm();
          helper.npm.installNpmPackage(`@${DEFAULT_OWNER}/${scopeWithoutOwner}.comp1`, '0.0.1');
          helper.fs.outputFile(
            'app.js',
            `const comp1 = require('@${DEFAULT_OWNER}/${scopeWithoutOwner}.comp1').default;\nconsole.log(comp1())`
          );
          const output = helper.command.runCmd('node app.js');
          expect(output.trim()).to.be.equal(appOutput.trim());
        });
      });
      describe('automatically by snap pipeline', () => {
        before(() => {
          helper.scopeHelper.getClonedWorkspace(scopeBeforeTag);
          helper.command.tagIncludeUnmodified('1.0.5');
          helper.command.snapAllComponents('--unmodified');
        });
        it('should publish them successfully using the 0.0.0-snap version and not changing the "latest" tag', () => {
          const headSnap = helper.command.getHead('comp1');
          const comp1Pkg = `@${DEFAULT_OWNER}/${scopeWithoutOwner}.comp1`;
          const npmTag = helper.command.runCmd(`npm dist-tags ls ${comp1Pkg}`);
          expect(npmTag).to.have.string('latest: 1.0.5');
          expect(npmTag).to.have.string(`snap: 0.0.0-${headSnap}`);
        });
        it('should publish them successfully and be able to consume them by installing the packages', () => {
          const headSnap = helper.command.getHead('comp1');
          helper.scopeHelper.reInitWorkspace();
          helper.npm.initNpm();
          helper.npm.installNpmPackage(`@${DEFAULT_OWNER}/${scopeWithoutOwner}.comp1`, `0.0.0-${headSnap}`);
          helper.fs.outputFile(
            'app.js',
            `const comp1 = require('@${DEFAULT_OWNER}/${scopeWithoutOwner}.comp1').default;\nconsole.log(comp1())`
          );
          const output = helper.command.runCmd('node app.js');
          expect(output.trim()).to.be.equal(appOutput.trim());
        });
      });
      describe('using "bit publish"', () => {
        before(async () => {
          helper.scopeHelper.getClonedWorkspace(scopeBeforeTag);
          helper.command.tagIncludeUnmodified('2.0.0');
          helper.command.publish('comp1', '--allow-staged');
          helper.command.publish('comp2', '--allow-staged');
          helper.command.publish('comp3', '--allow-staged');
        });
        // this also makes sure that the main of package.json points to the dist file correctly
        it('should publish them successfully and be able to consume them by installing the packages', () => {
          helper.scopeHelper.reInitWorkspace();
          helper.npm.initNpm();
          helper.npm.installNpmPackage(`@${DEFAULT_OWNER}/${scopeWithoutOwner}.comp1`, '2.0.0');
          helper.fs.outputFile(
            'app.js',
            `const comp1 = require('@${DEFAULT_OWNER}/${scopeWithoutOwner}.comp1').default;\nconsole.log(comp1())`
          );
          const output = helper.command.runCmd('node app.js');
          expect(output.trim()).to.be.equal(appOutput.trim());
        });
      });
      describe('with pre-release', () => {
        before(async () => {
          helper.scopeHelper.getClonedWorkspace(scopeBeforeTag);
          helper.command.tagIncludeUnmodified('3.0.0-dev.1');
        });
        it('should publish with the tag flag and be able to npm install them by the tag name', () => {
          helper.scopeHelper.reInitWorkspace();
          helper.npm.initNpm();
          helper.npm.installNpmPackage(`@${DEFAULT_OWNER}/${scopeWithoutOwner}.comp1`, 'dev');
          helper.fs.outputFile(
            'app.js',
            `const comp1 = require('@${DEFAULT_OWNER}/${scopeWithoutOwner}.comp1').default;\nconsole.log(comp1())`
          );
          const output = helper.command.runCmd('node app.js');
          expect(output.trim()).to.be.equal(appOutput.trim());
        });
      });
    });
  });
  (supportNpmCiRegistryTesting ? describe : describe.skip)('with custom package name', function () {
    let randomStr: string;
    let publishOutput: string;
    let pkgName: string;
    before(async function () {
      npmCiRegistry = new NpmCiRegistry(helper);
      helper.scopeHelper.setWorkspaceWithRemoteScope({ addRemoteScopeAsDefaultScope: false });
      helper.fs.outputFile('ui/button.js', 'console.log("hello button");');
      helper.command.addComponent('ui', { i: 'ui/button' });

      randomStr = generateRandomStr(4); // to avoid publishing the same package every time the test is running
      const name = `react.${randomStr}.{name}`;
      npmCiRegistry.configureCustomNameInPackageJsonHarmony(name);
      await npmCiRegistry.init();

      publishOutput = helper.command.tagAllComponents();
      pkgName = `react.${randomStr}.ui.button`;
    });
    after(() => {
      npmCiRegistry.destroy();
    });
    it('should publish them successfully', () => {
      expect(publishOutput).to.have.string(pkgName);
    });
    describe('installing the component as a package', () => {
      before(() => {
        helper.scopeHelper.reInitWorkspace({ addRemoteScopeAsDefaultScope: false });
        helper.npm.initNpm();
        npmCiRegistry.installPackage(pkgName);
      });
      it('should be able to consume them by installing the packages', () => {
        helper.fs.outputFile('app.js', `require('${pkgName}');\n`);
        const output = helper.command.runCmd('node app.js');
        expect(output.trim()).to.be.equal('hello button');
      });
      describe('requiring the package from another component', () => {
        before(() => {
          helper.fs.outputFile('bar/foo.js', `const pkg = require('${pkgName}'); console.log(pkg);`);
          helper.command.addComponent('bar');
        });
        it('should recognize that the package is a component', () => {
          const show = helper.command.showComponentParsed('bar');
          expect(show.dependencies).to.have.lengthOf(1);
          expect(show.dependencies[0].id).equal('my-scope/ui/button@0.0.1');
        });
      });
    });
  });
  describe('prevent publishing to npm when custom-package-name is needed', () => {
    before(() => {
      helper.scopeHelper.setWorkspaceWithRemoteScope();
      helper.fixtures.populateComponents(1, false);
      const pkg = {
        packageJson: {
          name: 'no', // custom-name so it will try to publish to npm
        },
        avoidPublishToNPM: true,
      };
      helper.workspaceJsonc.addToVariant('*', 'teambit.pkg/pkg', pkg);
    });
    it('should not publish to npm', () => {
      // if it was publishing, it would failed with an error:
      // "failed running npm publish at /Users/davidfirst/Library/Caches/Bit/capsules/d7865720a5a6eb77903fb2536ba6e34efcaa0344/ci.w4hrkz2p-remote_comp1@0.0.1"
      expect(() => helper.command.tagAllComponents()).to.not.throw();
    });
  });
});
