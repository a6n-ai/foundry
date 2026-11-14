export type PermissionMap = Record<string, string[]>;
export type ResourceLabel = {
  resource: string;
  label: string;
  actions: { action: string; label: string }[];
};

export function isGrantable(grantable: PermissionMap, resource: string, action: string): boolean {
  return grantable[resource]?.includes(action) ?? false;
}

export function togglePermission(
  value: PermissionMap,
  resource: string,
  action: string,
  grantable: PermissionMap,
): PermissionMap {
  if (!isGrantable(grantable, resource, action)) return value;
  const current = value[resource] ?? [];
  const next = current.includes(action) ? current.filter((a) => a !== action) : [...current, action];
  const { [resource]: _drop, ...rest } = value;
  return next.length ? { ...rest, [resource]: next } : rest;
}
