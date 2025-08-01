import chalk from 'chalk';
import type { NodeModulesLinksResult } from '@teambit/workspace.modules.node-modules-linker';
import { getPackageNameFromTarget } from './get-package-name-from-target';
import { LinkRow, VerboseLinkRow } from './link-row';
import type { LinkDetail } from '@teambit/dependency-resolver';

type ComponentListLinksProps = {
  componentListLinks?: NodeModulesLinksResult[];
  verbose: boolean;
  compSummary?: boolean;
};

export function ComponentListLinks({
  componentListLinks,
  verbose = false,
  compSummary = false,
}: ComponentListLinksProps) {
  if (!componentListLinks || !componentListLinks.length) {
    return chalk.cyan('No components link were generated');
  }

  if (compSummary) {
    const count = componentListLinks.length;
    return chalk.cyan(`${count} components were linked`);
  }

  const title = chalk.bold.cyan('Components links');
  const links = componentListLinks.map((componentLinks) => ComponentLinks({ componentLinks, verbose })).join('\n');

  return `${title}\n${links}`;
}

export function packageListLinks(packageList?: LinkDetail[]) {
  if (!packageList || !packageList.length) {
    return '';
  }
  const title = chalk.bold.cyan('Non-Core Package links');

  const links = packageList
    .map((link) => {
      const id = link.packageName;
      const packagePath = getPackageNameFromTarget(link.to);
      return LinkRow({ title: id, target: packagePath, padding: 50 });
    })
    .join('\n');

  return `${title}\n${links}`;
}

type ComponentLinksProps = {
  componentLinks: NodeModulesLinksResult;
  verbose: boolean;
};
function ComponentLinks({ componentLinks, verbose = false }: ComponentLinksProps) {
  if (!componentLinks.bound || componentLinks.bound.length < 1) return '';
  if (verbose) return VerboseComponentLinks({ componentLinks });
  return RegularComponentLinks({ componentLinks });
}

type RegularComponentLinksProps = {
  componentLinks: NodeModulesLinksResult;
};
function RegularComponentLinks({ componentLinks }: RegularComponentLinksProps) {
  const id = componentLinks.id.toString();
  if (!componentLinks.bound || componentLinks.bound.length < 1) return '';
  const packagePath = getPackageNameFromTarget(componentLinks.bound[0].to);
  return LinkRow({ title: id, target: packagePath, padding: 50 });
}

type VerboseComponentLinksProps = {
  componentLinks: NodeModulesLinksResult;
};
function VerboseComponentLinks({ componentLinks }: VerboseComponentLinksProps) {
  const id = componentLinks.id.toString();
  if (!componentLinks.bound || componentLinks.bound.length < 1) return '';
  const title = chalk.bold.cyan(id);
  const links = componentLinks.bound.map((link) => VerboseLinkRow({ from: link.from, to: link.to })).join('\n');
  return `${title}\n${links}\n`;
}
