import { expect } from 'chai';

import { Helper } from '@teambit/legacy.e2e-helper';

describe('bit import command with no ids', function () {
  this.timeout(0);
  let helper: Helper;
  before(() => {
    helper = new Helper();
  });
  after(() => {
    helper.scopeHelper.destroy();
  });
  describe('with a component in bit.map and --merge flag', () => {
    before(() => {
      helper.scopeHelper.setWorkspaceWithRemoteScope();
      helper.fixtures.createComponentBarFoo();
      helper.fixtures.addComponentBarFoo();
      helper.fixtures.tagComponentBarFoo();
      helper.command.exportIds('bar/foo');
      const bitMap = helper.bitMap.read();
      helper.scopeHelper.reInitWorkspace();
      helper.scopeHelper.addRemoteScope();
      helper.bitMap.write(bitMap);
    });
    it('should throw an error and suggest using bit checkout reset', () => {
      expect(() => helper.command.importAllComponents(true)).to.throw('checkout reset');
    });
  });
  describe('with components in bit.map when they are modified locally', () => {
    let localScope;
    before(() => {
      helper.scopeHelper.setWorkspaceWithRemoteScope();
      helper.fixtures.createComponentBarFoo();
      helper.fixtures.addComponentBarFoo();
      helper.fixtures.tagComponentBarFoo();
      helper.command.exportIds('bar/foo');
      const bitMap = helper.bitMap.read();
      helper.scopeHelper.reInitWorkspace();
      helper.scopeHelper.addRemoteScope();
      helper.bitMap.write(bitMap);
      helper.command.checkoutReset('--all');
      const barFooFixtureV2 = "module.exports = function foo() { return 'got foo v2'; };";
      helper.fs.createFile('bar', 'foo.js', barFooFixtureV2);
      localScope = helper.scopeHelper.cloneWorkspace();
    });
    describe('without any flag', () => {
      // should import objects only
      let output;
      before(() => {
        output = helper.command.importAllComponents();
      });
      it('should not display a warning saying it was unable to import', () => {
        expect(output).to.not.have.string('unable to import');
      });
      it('should display a successful message', () => {
        expect(output).to.have.string('successfully imported');
      });
    });
    describe('with --override flag', () => {
      before(() => {
        helper.scopeHelper.getClonedWorkspace(localScope);
      });
      it('should throw an error and suggest using bit checkout reset', () => {
        expect(() => helper.command.import('--override')).to.throw('checkout reset');
      });
    });
    describe('with --merge=manual flag', () => {
      let output;
      before(() => {
        helper.scopeHelper.getClonedWorkspace(localScope);
        output = helper.command.runCmd(`bit import ${helper.scopes.remote}/bar/foo --merge=manual`);
      });
      it('should display a successful message', () => {
        expect(output).to.have.string('successfully imported');
      });
      it('should show them as modified', () => {
        const statusOutput = helper.command.runCmd('bit status');
        expect(statusOutput).to.have.string('modified components');
      });
    });
    describe('after tagging', () => {
      let output;
      before(() => {
        helper.scopeHelper.getClonedWorkspace(localScope);
        helper.command.tagAllComponents();
        output = helper.command.runCmd(`bit import ${helper.scopes.remote}/bar/foo --merge=manual`);
      });
      it('should display a successful message', () => {
        // before, it'd throw an error component-not-found as the tag exists only locally
        expect(output).to.have.string('successfully imported');
      });
    });
  });

  describe('with an AUTHORED component which was only tagged but not exported', () => {
    before(() => {
      helper.scopeHelper.setWorkspaceWithRemoteScope();
      helper.fixtures.createComponentBarFoo();
      helper.fixtures.addComponentBarFoo();
      helper.fixtures.tagComponentBarFoo();
      const bitMap = helper.bitMap.read();
      helper.scopeHelper.reInitWorkspace();
      helper.scopeHelper.addRemoteScope();
      helper.bitMap.write(bitMap);
    });
    it('should not try to import that component as it was not exported yet', () => {
      try {
        helper.command.importAllComponents(true);
      } catch (err: any) {
        expect(err.toString()).to.have.string('nothing to import');
      }
    });
  });
});
