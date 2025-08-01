import type { BuildTask, BuiltTaskResult, BuildContext, ComponentResult } from '@teambit/builder';
import type { Formatter } from './formatter';

export class FormatTask implements BuildTask {
  constructor(
    readonly aspectId: string,
    readonly name = 'format'
  ) {}

  async execute(context: BuildContext): Promise<BuiltTaskResult> {
    if (!context.env.getFormatter) {
      return {
        componentsResults: [],
      };
    }

    const formatter: Formatter = context.env.getFormatter();
    // TODO: add option to select between check and format here
    const results = await formatter.check(context);
    const componentsResults = results.results.map((formatResult): ComponentResult => {
      return {
        component: formatResult.component,
        metadata: {
          results: formatResult.results,
        },
        errors: [],
      };
    });

    return {
      componentsResults,
    };
  }
}
