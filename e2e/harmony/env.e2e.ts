import chai, { expect } from 'chai';
import { Extensions } from '@teambit/legacy.constants';
import { Helper } from '@teambit/legacy.e2e-helper';
import { IssuesClasses } from '@teambit/component-issues';

chai.use(require('chai-fs'));
chai.use(require('chai-string'));

describe('env command', function () {
  this.timeout(0);
  let helper: Helper;
  before(() => {
    helper = new Helper();
  });
  after(() => {
    helper.scopeHelper.destroy();
  });
  describe('bit env set', () => {
    describe('run bit env set and then tag when the variants points to another env', () => {
      before(() => {
        helper.scopeHelper.setWorkspaceWithRemoteScope();
        helper.extensions.addExtensionToVariant('*', 'teambit.react/react', undefined, true);
        helper.fixtures.populateComponents(1);
        helper.command.setEnv('comp1', 'teambit.harmony/aspect');
        helper.command.tagAllWithoutBuild();
      });
      it('should not be modified', () => {
        const status = helper.command.statusJson();
        expect(status.modifiedComponents).to.have.lengthOf(0);
      });
      it('should not change the env to the variants one', () => {
        const env = helper.env.getComponentEnv('comp1');
        expect(env).to.equal('teambit.harmony/aspect');
      });
      it('ejecting the conf to component.json should not write internal fields', () => {
        helper.command.ejectConf('comp1');
        const compJson = helper.componentJson.read('comp1');
        expect(compJson.extensions[Extensions.envs]).to.not.have.property('__specific');
      });
    });
    describe('run bit env set X and then bit env set Y', () => {
      before(() => {
        helper.scopeHelper.setWorkspaceWithRemoteScope();
        helper.fixtures.populateComponents(1);
        helper.command.setEnv('comp1', 'teambit.harmony/aspect');
        helper.command.setEnv('comp1', 'teambit.react/react');
      });
      it('should replace the env with the last one and remove the first one', () => {
        const show = helper.command.showComponent('comp1');
        expect(show).to.not.have.string('teambit.harmony/aspect');
      });
    });
    describe('run bit env set when there is a component.json', () => {
      before(() => {
        helper.scopeHelper.setWorkspaceWithRemoteScope();
        helper.fixtures.populateComponents(1);
        helper.command.ejectConf('comp1');
        helper.command.setEnv('comp1', 'teambit.harmony/aspect');
      });
      it('should write the env into the component.json file', () => {
        const compJson = helper.componentJson.read('comp1');
        expect(compJson.extensions).to.have.property(Extensions.envs);
      });
      it('should not add "config" to the .bitmap file', () => {
        const bitMap = helper.bitMap.read();
        expect(bitMap.comp1).to.not.have.property('config');
      });
      it('should set the new env correctly', () => {
        const env = helper.env.getComponentEnv('comp1');
        expect(env).to.equal('teambit.harmony/aspect');
      });
      describe('run bit env unset', () => {
        before(() => {
          helper.command.unsetEnv('comp1');
        });
        it('should unset the env correctly', () => {
          const env = helper.env.getComponentEnv('comp1');
          expect(env).to.not.equal('teambit.harmony/aspect');
        });
        it('should remove the env from the component.json file', () => {
          const compJson = helper.componentJson.read('comp1');
          expect(compJson.extensions).to.not.have.property(Extensions.envs);
        });
      });
    });
  });
  describe('bit env replace', () => {
    describe('replacing a failed-loaded env', () => {
      before(() => {
        helper.scopeHelper.setWorkspaceWithRemoteScope();
        helper.env.setEmptyEnv();

        helper.fixtures.populateComponents(1, false);
        helper.command.setEnv('comp1', 'empty-env');
        helper.fs.outputFile('empty-env/empty-env.bit-env.ts', 'throw new Error("my-error");');
        helper.command.compile();
        helper.command.expectStatusToHaveIssue(IssuesClasses.NonLoadedEnv.name);
      });
      it('should be able to replace with no errors', () => {
        const output = helper.command.replaceEnv(`${helper.scopes.remote}/empty-env`, 'teambit.react/react');
        expect(output).to.have.string('added teambit.react/react env to the following component(s):');
      });
    });
  });
});
