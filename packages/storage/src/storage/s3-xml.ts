import type { ListResult } from "./types";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|apos);/g, (_, e: string) => ENTITIES[e]!);
const all = (xml: string, re: RegExp) => [...xml.matchAll(re)].map((m) => decode(m[1]!));

export function parseListObjectsV2(xml: string): ListResult {
  return {
    keys: all(xml, /<Contents>[\s\S]*?<Key>([\s\S]*?)<\/Key>[\s\S]*?<\/Contents>/g),
    commonPrefixes: all(xml, /<CommonPrefixes>[\s\S]*?<Prefix>([\s\S]*?)<\/Prefix>[\s\S]*?<\/CommonPrefixes>/g),
    isTruncated: /<IsTruncated>true<\/IsTruncated>/.test(xml),
    nextToken: all(xml, /<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/g)[0],
  };
}
