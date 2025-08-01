import type { PropsWithChildren } from 'react';
import React from 'react';
import type { SlotRegistry } from '@teambit/harmony';
import type { RouteProps } from 'react-router-dom';
import { Routes, Route } from 'react-router-dom';
import { flatten } from 'lodash';
import type { LinkProps } from '@teambit/base-react.navigation.link';

export type RouteSlot = SlotRegistry<RouteProps | RouteProps[]>;
export type NavigationSlot = SlotRegistry<LinkProps>;

export type SlotRouterProps = PropsWithChildren<{
  /**
   * @deprecated
   * use @property routes to pass list of routes instead
   */
  slot?: RouteSlot;
  routes?: RouteProps[];
  rootRoutes?: RouteProps[];
  parentPath?: string;
}>;

function toKey(route: RouteProps) {
  if (route.path) return route.path;
  if (route.index) return '/';
  return '.';
}

export function SlotRouter({ routes: routesFromProps, slot, rootRoutes, children, parentPath }: SlotRouterProps) {
  const routes = routesFromProps || (slot && flatten(slot.values())) || [];
  const withRoot = routes.concat(rootRoutes || []);

  const jsxRoutes = withRoot.map((route) => <Route key={toKey(route)} {...route} />);

  if (parentPath) {
    return (
      <Routes>
        <Route path={parentPath}>
          {jsxRoutes}
          {children}
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path={parentPath}>
        {jsxRoutes}
        {children}
      </Route>
    </Routes>
  );
}
