import type { CommentObject } from 'comment-json';
import json from 'comment-json';
import { expect } from 'chai';
import fs from 'fs-extra';
import * as path from 'path';

import { BIT_MAP } from '@teambit/legacy.constants';
import { LANE_KEY, SCHEMA_FIELD } from '@teambit/legacy.bit-map';
import type FsHelper from './e2e-fs-helper';
import type ScopesData from './e2e-scopes';

export default class BitMapHelper {
  scopes: ScopesData;
  fs: FsHelper;
  constructor(scopes: ScopesData, fsHelper: FsHelper) {
    this.scopes = scopes;
    this.fs = fsHelper;
  }

  read(bitMapPath: string = path.join(this.scopes.localPath, BIT_MAP), withoutComment = true): Record<string, any> {
    const map = fs.readFileSync(bitMapPath) || {};
    return json.parse(map.toString(), undefined, withoutComment) as CommentObject;
  }

  readComponentsMapOnly(): Record<string, any> {
    const bitMap = this.read();
    bitMap[SCHEMA_FIELD] ? delete bitMap[SCHEMA_FIELD] : delete (bitMap as any).version;
    delete bitMap[LANE_KEY];
    return bitMap;
  }

  write(bitMap: Record<string, any>) {
    const bitMapPath = path.join(this.scopes.localPath, BIT_MAP);
    return fs.writeJSONSync(bitMapPath, bitMap, { spaces: 2 });
  }
  delete() {
    return this.fs.deletePath(BIT_MAP);
  }
  create(
    cwd: string = this.scopes.localPath,
    componentObject = {
      'bar/foo': {
        files: [
          {
            relativePath: 'bar/foo.js',
            test: false,
            name: 'foo.js',
          },
        ],
        mainFile: 'bar/foo.js',
        origin: 'AUTHORED',
      },
    },
    oldBitMapFile = false
  ) {
    const bitmapFile = path.join(cwd, oldBitMapFile ? '.bit.map.json' : BIT_MAP);

    const bitmap = {
      version: '0.11.1-testing',
    };
    Object.keys(componentObject).forEach((key) => (bitmap[key] = componentObject[key]));
    fs.ensureFileSync(bitmapFile);
    return fs.writeJsonSync(bitmapFile, bitmap, { spaces: 2 });
  }
  createHarmony(
    cwd: string = this.scopes.localPath,
    componentObject = {
      'bar/foo': {
        scope: '',
        version: '',
        defaultScope: 'my-scope',
        mainFile: 'bar/foo.js',
        rootDir: 'bar',
      },
    }
  ) {
    const bitmapFile = path.join(cwd, BIT_MAP);

    const bitmap = {
      version: '0.11.1-testing',
    };
    Object.keys(componentObject).forEach((key) => (bitmap[key] = componentObject[key]));
    fs.ensureFileSync(bitmapFile);
    return fs.writeJsonSync(bitmapFile, bitmap, { spaces: 2 });
  }
  printFilesInCaseOfError(files: Record<string, any>[]): string {
    // @ts-ignore AUTO-ADDED-AFTER-MIGRATION-PLEASE-FIX!
    const filesStr = files.map((f) => f.name).join(', ');
    return `Files in bitmap file: ${filesStr}`;
  }

  expectToHaveId(name: string, version?: string, scope?: string) {
    const bitMap = this.read();
    expect(bitMap).to.have.property(name);
    if (scope) expect(bitMap[name]?.scope).to.equal(scope);
    if (version) expect(bitMap[name]?.version).to.equal(version);
  }
  expectNotToHaveId(name: string) {
    const bitMap = this.read();
    expect(bitMap).to.not.have.property(name);
  }
}
