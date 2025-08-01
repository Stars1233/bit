import type { ConsumerComponent as LegacyComponent } from '@teambit/legacy.consumer-component';
import type { Dependency, SerializedDependency } from './dependency';
import type { DependencyList } from './dependency-list';

// export interface DependencyFactory<T extends Dependency, U extends SerializedDependency> {
//   parse(serializedDependency: U): T;
// }

// export interface DependencyFactory {
//   parse<T extends Dependency, U extends SerializedDependency>(serializedDependency: U): T;
// }

export interface DependencyFactory {
  type: string;
  parse: <T extends Dependency, U extends SerializedDependency>(serializedDependency: U) => T;
  fromLegacyComponent?: (legacyComponent: LegacyComponent) => Promise<DependencyList>;
}
