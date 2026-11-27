import { makePublicId } from "../ids";

export type ColKind =
  | "id" | "ref" | "string" | "text" | "int" | "bool" | "time" | "timestamp" | "json";

export interface ColSpec {
  kind: ColKind;
  name: string;
  length?: number;
  notNull: boolean;
  primaryKey: boolean;
  hasDefault: boolean;
  default?: unknown;
  defaultFn?: () => unknown;
  onUpdateFn?: () => unknown;
  references?: { target: () => AnyCol; onDelete?: "cascade" | "set null" | "restrict" | "no action" | "set default" };
}

/** Phantom generics carry the JS type, nullability and default-ness for Drizzle inference. */
export class Col<T, N extends boolean, H extends boolean, K extends ColKind> {
  /** Stamped by defineTable. */
  _table?: string;
  _key?: string;
  declare readonly _t: T;
  declare readonly _k: K;
  declare readonly _n: N;
  declare readonly _h: H;
  constructor(readonly spec: ColSpec) {}

  private next<T2, N2 extends boolean, H2 extends boolean>(patch: Partial<ColSpec>) {
    return new Col<T2, N2, H2, K>({ ...this.spec, ...patch });
  }
  notNull() {
    return this.next<T, true, H>({ notNull: true });
  }
  default(value: T) {
    return this.next<T, N, true>({ default: value, hasDefault: true });
  }
  $defaultFn(fn: () => T) {
    return this.next<T, N, true>({ defaultFn: fn, hasDefault: true });
  }
  $onUpdateFn(fn: () => T) {
    return this.next<T, N, H>({ onUpdateFn: fn });
  }
  references(target: () => AnyCol, opts?: { onDelete?: NonNullable<ColSpec["references"]>["onDelete"] }) {
    return this.next<T, N, H>({ references: { target, onDelete: opts?.onDelete } });
  }
  $type<U>() {
    return this.next<U, N, H>({});
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyCol = Col<any, boolean, boolean, ColKind>;

const mk = <T, K extends ColKind>(kind: K, name: string, extra: Partial<ColSpec> = {}) =>
  new Col<T, false, false, K>({ kind, name, notNull: false, primaryKey: false, hasDefault: false, ...extra });

const timeCol = (name: string) => mk<number, "time">("time", name);

export const c = {
  id(prefix: string) {
    const gen = makePublicId(prefix);
    return mk<string, "id">("id", "id", { primaryKey: true, notNull: true, hasDefault: true, defaultFn: gen }) as unknown as Col<string, true, true, "id">;
  },
  ref: (name: string) => mk<string, "ref">("ref", name),
  string: (name: string, len = 255) => mk<string, "string">("string", name, { length: len }),
  text: (name: string) => mk<string, "text">("text", name),
  int: (name: string) => mk<number, "int">("int", name),
  bool: (name: string) => mk<boolean, "bool">("bool", name),
  time: timeCol,
  timestamp: (name: string) => mk<Date, "timestamp">("timestamp", name),
  json: <T>(name: string) => mk<T, "json">("json", name),
  base(prefix: string) {
    return {
      id: c.id(prefix),
      createdAt: timeCol("created_at").notNull().$defaultFn(() => Date.now()),
      createdBy: c.ref("created_by"),
    };
  },
  updatable(prefix: string) {
    return {
      ...c.base(prefix),
      updatedAt: timeCol("updated_at")
        .notNull()
        .$defaultFn(() => Date.now())
        .$onUpdateFn(() => Date.now()),
      updatedBy: c.ref("updated_by"),
    };
  },
};
