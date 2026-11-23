import { describe, expect, it } from "vitest";
import { builtinArrayTypes, postgresOptions } from "../postgres-options";

const parse = (name: string, text: string) =>
  (builtinArrayTypes[`${name}_array`] as { parse: (s: string) => unknown }).parse(text);

describe("postgresOptions", () => {
  it("turns off the per-client pg_type lookup", () => {
    expect(postgresOptions.fetch_types).toBe(false);
  });

  it("parses text arrays with quoting and NULL", () => {
    expect(parse("text", '{a,"b c","d,e",NULL}')).toEqual(["a", "b c", "d,e", null]);
    expect(parse("text", "{}")).toEqual([]);
    expect(parse("text", '{"NULL","say \\"hi\\"","back\\\\slash"}')).toEqual(["NULL", 'say "hi"', "back\\slash"]);
  });

  it("keeps postgres.js element types", () => {
    expect(parse("int4", "{1,2,3}")).toEqual([1, 2, 3]);
    expect(parse("int8", "{9007199254740993}")).toEqual(["9007199254740993"]);
    expect(parse("bool", "{t,f}")).toEqual([true, false]);
    expect(parse("date", "{2026-11-23}")).toEqual([new Date("2026-11-23")]);
  });

  it("parses nested arrays", () => {
    expect(parse("int4", "{{1,2},{3,4}}")).toEqual([[1, 2], [3, 4]]);
  });
});
