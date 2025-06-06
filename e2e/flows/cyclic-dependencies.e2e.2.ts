import { expect } from 'chai';
import { IssuesClasses } from '@teambit/component-issues';
import { Helper } from '@teambit/legacy.e2e-helper';

const fixtureA = `const b = require('../b/b');
console.log('got ' + b() + ' and got A')`;
const fixtureB = `const a = require('../a/a');
console.log('got ' + a() + ' and got B')`;

describe('cyclic dependencies', function () {
  this.timeout(0);
  let helper: Helper;
  before(() => {
    helper = new Helper();
  });
  after(() => {
    helper.scopeHelper.destroy();
  });

  describe('a => b, b => a (component A requires B, component B requires A)', () => {
    let output;
    before(() => {
      helper.scopeHelper.setWorkspaceWithRemoteScope();
      helper.fs.createFile('comp/a', 'a.js', fixtureA);
      helper.fs.createFile('comp/b', 'b.js', fixtureB);
      helper.command.addComponent('comp/a', { i: 'comp/a' });
      helper.command.addComponent('comp/b', { i: 'comp/b' });
      helper.command.linkAndRewire();

      // an intermediate step, make sure it throws when CircularDependencies issue is not ignored.
      const errOutput = helper.general.runWithTryCatch('bit tag -a');
      expect(errOutput).to.have.string(IssuesClasses.CircularDependencies.name);

      output = helper.command.tagAllWithoutBuild('--ignore-issues="CircularDependencies"');
    });
    it('should be able to tag both with no errors', () => {
      expect(output).to.have.string('2 component(s) tagged');
    });
    it('should save the dependencies and flattenedDependencies of A correctly', () => {
      const compA = helper.command.catComponent('comp/a@0.0.1');
      expect(compA.dependencies[0].id).to.deep.equal({ name: 'comp/b', scope: helper.scopes.remote, version: '0.0.1' });
      expect(compA.flattenedDependencies[0]).to.deep.equal({
        name: 'comp/b',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
    });
    it('should save the dependencies and flattenedDependencies of B correctly', () => {
      const compA = helper.command.catComponent('comp/b@0.0.1');
      expect(compA.dependencies[0].id).to.deep.equal({ name: 'comp/a', scope: helper.scopes.remote, version: '0.0.1' });
      expect(compA.flattenedDependencies[0]).to.deep.equal({
        name: 'comp/a',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
    });
    describe('exporting the component', () => {
      let exportOutput;
      before(() => {
        exportOutput = helper.command.export();
      });
      it('should export successfully with no errors', () => {
        expect(exportOutput).to.have.string('exported');
      });
      describe('importing to a new environment', () => {
        let importOutput;
        before(() => {
          helper.scopeHelper.reInitWorkspace();
          helper.scopeHelper.addRemoteScope();
          helper.command.importComponent('comp/a');
          importOutput = helper.command.importComponent('comp/b');
        });
        it('should import successfully and not throw any error', () => {
          // a previous bug caused to throw an error 'failed running npm install'
          expect(importOutput).to.have.string('successfully imported');
        });
        it('should bring in the components', () => {
          const list = helper.command.listLocalScope();
          expect(list).to.have.string('comp/a');
          expect(list).to.have.string('comp/b');
        });
        it('should not show a clean workspace', () => {
          helper.command.expectStatusToBeClean();
        });
      });
    });
  });
  describe('a complex case with a long chain of dependencies', () => {
    let output;
    before(() => {
      helper.scopeHelper.setWorkspaceWithRemoteScope();
      // isString => isType
      helper.fixtures.createComponentIsType();
      helper.fixtures.createComponentIsString();
      helper.fixtures.addComponentUtilsIsType();
      helper.fixtures.addComponentUtilsIsString();
      helper.command.linkAndRewire();
      helper.command.tagAllWithoutBuild();

      // A1 => A2 => A3 (leaf)
      // B1 => B2 => B3 => B4
      // A1 => B1, B2 => A1
      // B4 => is-string => is-type (leaf)
      helper.fs.outputFile('comp/A1/index.js', "const A2 = require('../A2'); const B1 = require ('../B1');");
      helper.fs.outputFile('comp/A2/index.js', "const A3 = require('../A3')");
      helper.fs.outputFile('comp/A3/index.js', "console.log('Im a leaf')");
      helper.fs.outputFile('comp/B1/index.js', "const B2 = require('../B2');");
      helper.fs.outputFile('comp/B2/index.js', "const B3 = require('../B3'); const A1 = require ('../A1');");
      helper.fs.outputFile('comp/B3/index.js', "const B4 = require('../B4')");
      helper.fs.outputFile('comp/B4/index.js', "const isString = require('../../is-string/is-string')");
      helper.command.addComponent('comp/**', { n: 'comp' });
      helper.command.linkAndRewire();
      output = helper.command.tagAllWithoutBuild('--ignore-issues="CircularDependencies"');
    });
    it('should be able to tag with no errors', () => {
      expect(output).to.have.string('7 component(s) tagged');
    });
    it('bit insights should show the circular with the correct order: dependent -> dependency', () => {
      const results = helper.command.runCmd('bit insights circular --json');
      const parsedResults = JSON.parse(results);
      expect(parsedResults[0].data[0]).to.deep.equal([
        `${helper.scopes.remote}/comp/a1@0.0.1`,
        `${helper.scopes.remote}/comp/b1@0.0.1`,
        `${helper.scopes.remote}/comp/b2@0.0.1`,
        `${helper.scopes.remote}/comp/a1@0.0.1`,
      ]);
    });
    it('leaves (A3 and is-type) should not have any dependency', () => {
      const leaves = ['comp/a3@latest', 'utils/is-type@latest'];
      leaves.forEach((leaf) => {
        const catComp = helper.command.catComponent(leaf);
        // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
        expect(catComp.dependencies).to.have.lengthOf(0);
        // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
        expect(catComp.flattenedDependencies).to.have.lengthOf(0);
      });
    });
    // A2 => A3 (leaf)
    it('A2 should have only A3 as a dependency and flattenedDependency', () => {
      const A2 = helper.command.catComponent('comp/a2@latest');
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(A2.dependencies).to.have.lengthOf(1);
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(A2.flattenedDependencies).to.have.lengthOf(1);
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(A2.dependencies[0].id).to.deep.equal({ name: 'comp/a3', scope: helper.scopes.remote, version: '0.0.1' });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(A2.flattenedDependencies[0]).to.deep.equal({
        name: 'comp/a3',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
    });
    // A1 => A2 => A3 (leaf). A1 => B1. B1 => B2 => B3 => B4.
    it('A1 should have A2 and B1 as direct dependencies, and all the rest as flattenedDependencies', () => {
      const A1 = helper.command.catComponent('comp/a1@latest');
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(A1.dependencies).to.have.lengthOf(2);
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      const dependenciesIds = A1.dependencies.map((dep) => dep.id);
      expect(dependenciesIds).to.deep.include({ name: 'comp/a2', scope: helper.scopes.remote, version: '0.0.1' });
      expect(dependenciesIds).to.deep.include({ name: 'comp/b1', scope: helper.scopes.remote, version: '0.0.1' });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(A1.flattenedDependencies).to.have.lengthOf(8);
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(A1.flattenedDependencies).to.deep.include({
        name: 'comp/a2',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(A1.flattenedDependencies).to.deep.include({
        name: 'comp/a3',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(A1.flattenedDependencies).to.deep.include({
        name: 'comp/b1',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(A1.flattenedDependencies).to.deep.include({
        name: 'comp/b2',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(A1.flattenedDependencies).to.deep.include({
        name: 'comp/b3',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(A1.flattenedDependencies).to.deep.include({
        name: 'comp/b4',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(A1.flattenedDependencies).to.deep.include({
        name: 'utils/is-type',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(A1.flattenedDependencies).to.deep.include({
        name: 'utils/is-string',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
    });
    // B2 => B3 => B4. B2 => A1. A1 => A2 => A3 (leaf). A1 => B1.
    it('B2 should have A1 and B3 as direct dependencies, and all the rest as flattenedDependencies', () => {
      const B2 = helper.command.catComponent('comp/b2@latest');
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B2.dependencies).to.have.lengthOf(2);
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      const dependenciesIds = B2.dependencies.map((dep) => dep.id);
      expect(dependenciesIds).to.deep.include({ name: 'comp/b3', scope: helper.scopes.remote, version: '0.0.1' });
      expect(dependenciesIds).to.deep.include({ name: 'comp/a1', scope: helper.scopes.remote, version: '0.0.1' });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B2.flattenedDependencies).to.have.lengthOf(8);
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B2.flattenedDependencies).to.deep.include({
        name: 'comp/a1',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B2.flattenedDependencies).to.deep.include({
        name: 'comp/a2',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B2.flattenedDependencies).to.deep.include({
        name: 'comp/a3',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B2.flattenedDependencies).to.deep.include({
        name: 'comp/b1',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B2.flattenedDependencies).to.deep.include({
        name: 'comp/b3',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B2.flattenedDependencies).to.deep.include({
        name: 'comp/b4',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B2.flattenedDependencies).to.deep.include({
        name: 'utils/is-type',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B2.flattenedDependencies).to.deep.include({
        name: 'utils/is-string',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
    });
    // B1 => B2 => B3 => B4. B2 => A1. A1 => A2 => A3 (leaf)
    it('B1 should have B2 as direct dependencies, and all the rest as flattenedDependencies', () => {
      const B1 = helper.command.catComponent('comp/b1@latest');
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B1.dependencies).to.have.lengthOf(1);
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      const dependenciesIds = B1.dependencies.map((dep) => dep.id);
      expect(dependenciesIds).to.deep.include({ name: 'comp/b2', scope: helper.scopes.remote, version: '0.0.1' });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B1.flattenedDependencies).to.have.lengthOf(8);
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B1.flattenedDependencies).to.deep.include({
        name: 'comp/a1',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B1.flattenedDependencies).to.deep.include({
        name: 'comp/a2',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B1.flattenedDependencies).to.deep.include({
        name: 'comp/a3',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B1.flattenedDependencies).to.deep.include({
        name: 'comp/b2',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B1.flattenedDependencies).to.deep.include({
        name: 'comp/b3',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B1.flattenedDependencies).to.deep.include({
        name: 'comp/b4',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B1.flattenedDependencies).to.deep.include({
        name: 'utils/is-type',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B1.flattenedDependencies).to.deep.include({
        name: 'utils/is-string',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
    });
    // B3 => B4 => is-string => is-type (leaf)
    it('B3 should have B4 as direct dependencies, and B4, is-type, is-string as flattenedDependencies', () => {
      const B3 = helper.command.catComponent('comp/b3@latest');
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B3.dependencies).to.have.lengthOf(1);
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      const dependenciesIds = B3.dependencies.map((dep) => dep.id);
      expect(dependenciesIds).to.deep.include({ name: 'comp/b4', scope: helper.scopes.remote, version: '0.0.1' });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B3.flattenedDependencies).to.have.lengthOf(3);
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B3.flattenedDependencies).to.deep.include({
        name: 'comp/b4',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B3.flattenedDependencies).to.deep.include({
        name: 'utils/is-type',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B3.flattenedDependencies).to.deep.include({
        name: 'utils/is-string',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
    });
    // B4 => is-string => is-type (leaf)
    it('B4 should have is-string as a direct dependency, and is-type, is-string as flattenedDependencies', () => {
      const B4 = helper.command.catComponent('comp/b4@latest');
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B4.dependencies).to.have.lengthOf(1);
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      const dependenciesIds = B4.dependencies.map((dep) => dep.id);
      expect(dependenciesIds).to.deep.include({
        name: 'utils/is-string',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B4.flattenedDependencies).to.have.lengthOf(2);
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B4.flattenedDependencies).to.deep.include({
        name: 'utils/is-type',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(B4.flattenedDependencies).to.deep.include({
        name: 'utils/is-string',
        scope: helper.scopes.remote,
        version: '0.0.1',
      });
    });
    describe('exporting the component', () => {
      let exportOutput;
      before(() => {
        exportOutput = helper.command.export();
      });
      it('should export successfully with no errors', () => {
        expect(exportOutput).to.have.string('exported');
      });
      describe('importing to a new environment', () => {
        let importOutput;
        before(() => {
          helper.scopeHelper.reInitWorkspace();
          helper.scopeHelper.addRemoteScope();
          importOutput = helper.command.importComponent('comp/a1');
        });
        it('should import successfully and not throw any error', () => {
          // a previous bug caused to throw an error 'failed running npm install'
          expect(importOutput).to.have.string('successfully imported');
        });
        it('should bring in the components', () => {
          const list = helper.command.listLocalScope();
          expect(list).to.have.string('comp/a1');
        });
        it('bit status should the circular dependency issue', () => {
          const status = helper.command.status();
          expect(status).to.have.string('issues found');
          expect(status).to.have.string('circular dependencies');
        });
      });
    });
  });
  describe('same component require itself using module path', () => {
    let tagOutput;
    before(() => {
      helper.scopeHelper.setWorkspaceWithRemoteScope();
      helper.fixtures.createComponentBarFoo();
      helper.fixtures.addComponentBarFoo();
      helper.command.tagAllWithoutBuild();
      helper.command.export();
      // after export, the author now has a link from node_modules.
      helper.fixtures.createComponentBarFoo(`require('@${helper.scopes.remote}/bar.foo');`);
    });
    it('should block the tag by default', () => {
      expect(() => helper.command.tagAllWithoutBuild()).to.throw();
    });
    it('should tag successfully with --ignore-issues flag and should not save the component itself as a dependency', () => {
      tagOutput = helper.command.tagAllWithoutBuild('--ignore-issues=SelfReference');
      // we had a bug where this was leading to an error "unable to save Version object, it has dependencies but its flattenedDependencies is empty"
      expect(tagOutput).to.have.string('1 component(s) tagged');

      const catComponent = helper.command.catComponent('bar/foo@latest');
      // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
      expect(catComponent.dependencies).to.be.lengthOf(0);
    });
  });
});
