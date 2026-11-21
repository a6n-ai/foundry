"use client";

import { useState, useTransition, type ReactElement } from "react";
import { toast } from "@foundry/ui/toast";
import { Button } from "@foundry/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@foundry/ui/dialog";
import { Input } from "@foundry/ui/input";
import { Label } from "@foundry/ui/label";
import type { PermissionMap, ResourceLabel } from "./permission-map";
import { RolePermissionGrid } from "./role-permission-grid";

export type OrgRoleDialogProps = {
  resources: ResourceLabel[];
  grantable: PermissionMap;
  initial?: { name: string; permission: PermissionMap };
  trigger: ReactElement;
  onSave: (input: { name: string; permission: PermissionMap }) => Promise<{ error?: string }>;
};

const ROLE_NAME = /^[a-z0-9-]+$/;

export function validateRoleName(name: string): string | undefined {
  if (!name) return "Enter a role name.";
  if (!ROLE_NAME.test(name)) return "Use lowercase letters, digits and hyphens only.";
}

export function OrgRoleDialog({ resources, grantable, initial, trigger, onSave }: OrgRoleDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [permission, setPermission] = useState<PermissionMap>(initial?.permission ?? {});
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const editing = Boolean(initial);
  const trimmed = name.trim();
  const nameError = trimmed === "" ? undefined : validateRoleName(trimmed);

  function reset() {
    setName(initial?.name ?? "");
    setPermission(initial?.permission ?? {});
    setError(undefined);
  }

  function submit() {
    const invalid = validateRoleName(trimmed);
    if (invalid) return setError(invalid);
    start(async () => {
      let res: { error?: string };
      try {
        res = await onSave({ name: trimmed, permission });
      } catch (err) {
        res = { error: err instanceof Error && err.message ? err.message : "Something went wrong. Try again." };
      }
      if (res.error) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(editing ? "Role updated." : "Role created.");
      setOpen(false);
      if (!editing) reset();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit role" : "Create role"}</DialogTitle>
          <DialogDescription>Choose what members with this role can do.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="org-role-name">Role name</Label>
            <Input
              id="org-role-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(undefined);
              }}
              aria-invalid={Boolean(nameError)}
              autoComplete="off"
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>
          <RolePermissionGrid resources={resources} value={permission} grantable={grantable} onChange={setPermission} />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending || trimmed === "" || Boolean(nameError)}>
            {pending ? "Saving…" : "Save role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
