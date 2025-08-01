import { gql } from 'graphql-tag';
import type { Component } from '@teambit/component';
import type { DocsMain } from './docs.main.runtime';

export function docsSchema(docs: DocsMain) {
  return {
    typeDefs: gql`
      extend type Component {
        description: String
        labels: [String]
      }
    `,
    resolvers: {
      Component: {
        description: (component: Component) => {
          return docs.getDescription(component);
        },

        labels: (component: Component) => {
          const doc = docs.getDoc(component);
          return doc?.labels || [];
        },
      },
    },
  };
}
