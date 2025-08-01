// eslint-disable-next-line max-classes-per-file
import type { Command, CommandOptions } from '@teambit/cli';
import type { ApiServerMain } from './api-server.main.runtime';

export class ServerCmd implements Command {
  name = 'server';
  description = 'communicate with bit cli program via http requests';
  alias = '';
  commands: Command[] = [];
  group = 'workspace-setup';
  options = [
    ['p', 'port [port]', 'port to run the server on'],
    ['c', 'compile', 'compile components during the watch process'],
  ] as CommandOptions;
  private = true;

  constructor(private apiServer: ApiServerMain) {}

  async wait(args, options: { port: number; compile: boolean }) {
    await this.apiServer.runApiServer(options);
  }
}
