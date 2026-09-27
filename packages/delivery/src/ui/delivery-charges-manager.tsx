"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  DollarSignIcon,
  HomeIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  TruckIcon,
} from "lucide-react";
import { Button } from "@foundry/ui/button";
import { Badge } from "@foundry/ui/badge";
import { Input } from "@foundry/ui/input";
import { Label } from "@foundry/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@foundry/ui/select";
import { Switch } from "@foundry/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@foundry/ui/table";
import { ResponsiveDialog, SectionCard } from "@foundry/design-system";
import type { DeliveryChargeType } from "../charges";
import type {
  DeleteRuleResult,
  DeliveryChargeRuleDto,
  DeliveryChargeRuleInput,
  DeliveryStrategyGroupDto,
  DeliveryStrategyGroupInput,
} from "../service";

type DeliveryStrategyDto = DeliveryChargeRuleDto;
type AddressTagDto = DeliveryChargeRuleDto;

/** The app's server actions (auth + org scoping stay in the app). */
export interface DeliveryChargesActions {
  updateBaseCharge: (amount: number) => Promise<number>;
  saveDeliveryStrategy: (input: DeliveryChargeRuleInput) => Promise<DeliveryChargeRuleDto>;
  deleteDeliveryStrategy: (id: string) => Promise<DeleteRuleResult>;
  saveDeliveryStrategyGroup: (input: DeliveryStrategyGroupInput) => Promise<DeliveryStrategyGroupDto>;
  deleteDeliveryStrategyGroup: (id: string) => Promise<DeleteRuleResult>;
  saveAddressTag: (input: DeliveryChargeRuleInput) => Promise<DeliveryChargeRuleDto>;
  deleteAddressTag: (id: string) => Promise<DeleteRuleResult>;
}

export interface DeliveryChargesManagerProps {
  initialBaseCharge: number;
  /** Every option, each pointing at its group by `groupId`. */
  initialDeliveryStrategies: DeliveryStrategyDto[];
  initialStrategyGroups: DeliveryStrategyGroupDto[];
  /** Omit to hide address tags entirely — for an app that charges by delivery strategy only. */
  initialAddressTags?: AddressTagDto[];
  actions: DeliveryChargesActions;
}

export function DeliveryChargesManager({
  initialBaseCharge,
  initialDeliveryStrategies,
  initialStrategyGroups,
  initialAddressTags,
  actions,
}: DeliveryChargesManagerProps) {
  const {
    updateBaseCharge: updateBaseChargeAction,
    saveDeliveryStrategy: saveDeliveryStrategyAction,
    deleteDeliveryStrategy: deleteDeliveryStrategyAction,
    saveDeliveryStrategyGroup: saveGroupAction,
    deleteDeliveryStrategyGroup: deleteGroupAction,
    saveAddressTag: saveAddressTagAction,
    deleteAddressTag: deleteAddressTagAction,
  } = actions;
  const [baseCharge, setBaseCharge] = useState(initialBaseCharge);
  const [deliveryStrategies, setDeliveryStrategies] = useState(initialDeliveryStrategies);
  const [groups, setGroups] = useState(initialStrategyGroups);
  // Options from before groups existed (or whose group is gone) until an admin moves them.
  const ungrouped = deliveryStrategies.filter((o) => !o.groupId || !groups.some((g) => g.id === o.groupId));
  const [editingGroup, setEditingGroup] = useState<DeliveryStrategyGroupDto | "new" | null>(null);
  const [newOptionGroupId, setNewOptionGroupId] = useState<string | null>(null);
  const showAddressTags = initialAddressTags !== undefined;
  const [addressTags, setAddressTags] = useState(initialAddressTags ?? []);

  // Dialog states
  const [baseChargeOpen, setBaseChargeOpen] = useState(false);
  const [deliveryStrategyDialogOpen, setDeliveryStrategyDialogOpen] = useState(false);
  const [editingDeliveryStrategy, setEditingDeliveryStrategy] = useState<DeliveryStrategyDto | null>(null);
  const [addressTagDialogOpen, setAddressTagDialogOpen] = useState(false);
  const [editingAddressTag, setEditingAddressTag] = useState<AddressTagDto | null>(null);

  // Base Charge Form State
  const [baseChargeInput, setBaseChargeInput] = useState(initialBaseCharge.toFixed(2));
  const [isSavingBase, startSavingBase] = useTransition();

  const handleOpenBaseDialog = () => {
    setBaseChargeInput(baseCharge.toFixed(2));
    setBaseChargeOpen(true);
  };

  const handleSaveBaseCharge = () => {
    const val = Number(baseChargeInput);
    if (!Number.isFinite(val) || val < 0) {
      toast.error("Please enter a valid base charge (0 or greater).");
      return;
    }
    startSavingBase(async () => {
      try {
        const saved = await updateBaseChargeAction(val);
        setBaseCharge(saved);
        setBaseChargeOpen(false);
        toast.success("Base delivery charge updated.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update base charge.");
      }
    });
  };

  // Delivery Strategies Actions
  const handleOpenEditDeliveryStrategy = (dt: DeliveryStrategyDto) => {
    setEditingDeliveryStrategy(dt);
    setNewOptionGroupId(null);
    setDeliveryStrategyDialogOpen(true);
  };

  const handleDeleteGroup = (id: string, name: string) => {
    if (!window.confirm(`Remove strategy "${name}"?`)) return;
    void (async () => {
      try {
        const res = await deleteGroupAction(id);
        if (res.deactivatedInstead) {
          toast.info(`"${name}" still has options, so it was deactivated instead. Customers no longer see it.`);
          setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, active: false } : g)));
        } else {
          toast.success(`"${name}" removed.`);
          setGroups((prev) => prev.filter((g) => g.id !== id));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to remove strategy.");
      }
    })();
  };

  const handleDeleteDeliveryStrategy = (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove option "${name}"?`)) return;
    void (async () => {
      try {
        const res = await deleteDeliveryStrategyAction(id);
        if (res.deactivatedInstead) {
          toast.info(`"${name}" is referenced by existing orders or accounts and has been deactivated instead.`);
          setDeliveryStrategies((prev) => prev.map((t) => (t.id === id ? { ...t, active: false } : t)));
        } else {
          toast.success(`"${name}" removed successfully.`);
          setDeliveryStrategies((prev) => prev.filter((t) => t.id !== id));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete option.");
      }
    })();
  };

  // Address Tags Actions
  const handleOpenAddAddressTag = () => {
    setEditingAddressTag(null);
    setAddressTagDialogOpen(true);
  };

  const handleOpenEditAddressTag = (at: AddressTagDto) => {
    setEditingAddressTag(at);
    setAddressTagDialogOpen(true);
  };

  const handleDeleteAddressTag = (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove address tag "${name}"?`)) return;
    void (async () => {
      try {
        const res = await deleteAddressTagAction(id);
        if (res.deactivatedInstead) {
          toast.info(`"${name}" is referenced by existing orders or accounts and has been deactivated instead.`);
          setAddressTags((prev) => prev.map((t) => (t.id === id ? { ...t, active: false } : t)));
        } else {
          toast.success(`"${name}" removed successfully.`);
          setAddressTags((prev) => prev.filter((t) => t.id !== id));
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete address tag.");
      }
    })();
  };

  const formatChargeDisplay = (chargeType: DeliveryChargeType, chargeValue: number) => {
    if (chargeType === "none" || chargeValue === 0) return "Free ($0.00)";
    if (chargeType === "fixed") return `$${chargeValue.toFixed(2)}`;
    if (chargeType === "percent") return `${chargeValue}% of plan`;
    return "-";
  };

  return (
    <div className="space-y-6">
      {/* 1. Base Delivery Charge Card */}
      <SectionCard
        title="Base Delivery Charge"
        subtitle={`Standard baseline charge added to every order before delivery strategy${showAddressTags ? " or address tag" : ""} charges are applied.`}
        action={
          <Button variant="outline" size="sm" onClick={handleOpenBaseDialog}>
            <PencilIcon className="mr-1.5 size-3.5" />
            Edit base charge
          </Button>
        }
      >
        <div className="flex items-center gap-4 py-2">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <DollarSignIcon className="size-6" />
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight">
              ${baseCharge.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Applied automatically to all orders during checkout calculation.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* 2. Delivery strategies: groups, each with its options */}
      <SectionCard
        title="Delivery strategies"
        subtitle="Questions the customer answers per address (e.g. Drop-off spot, Contact). They pick one option in each."
        action={
          <Button size="sm" onClick={() => setEditingGroup("new")}>
            <PlusIcon className="mr-1.5 size-3.5" />
            Add strategy
          </Button>
        }
      >
        <div className="space-y-4">
          {groups.length === 0 && ungrouped.length === 0 ? (
            <p className="rounded-md border py-10 text-center text-sm text-muted-foreground">
              No delivery strategies yet. Click &quot;Add strategy&quot; to create one.
            </p>
          ) : null}
          {groups.map((g) => (
            <StrategyGroupBlock
              key={g.id}
              group={g}
              options={deliveryStrategies.filter((o) => o.groupId === g.id)}
              onEditGroup={() => setEditingGroup(g)}
              onDeleteGroup={() => handleDeleteGroup(g.id, g.name)}
              onAddOption={() => {
                setEditingDeliveryStrategy(null);
                setNewOptionGroupId(g.id);
                setDeliveryStrategyDialogOpen(true);
              }}
              onEditOption={handleOpenEditDeliveryStrategy}
              onDeleteOption={(o) => handleDeleteDeliveryStrategy(o.id, o.name)}
              formatCharge={formatChargeDisplay}
            />
          ))}
          {ungrouped.length > 0 && (
            <StrategyGroupBlock
              options={ungrouped}
              onEditOption={handleOpenEditDeliveryStrategy}
              onDeleteOption={(o) => handleDeleteDeliveryStrategy(o.id, o.name)}
              formatCharge={formatChargeDisplay}
            />
          )}
        </div>
      </SectionCard>

      {showAddressTags && (
        <>
      {/* 3. Address Tags Table */}
      <SectionCard
        title="Address Tags"
        subtitle="Pricing rules linked to the customer's dwelling or address tag (e.g. House, Apartment, Commercial Building)."
        action={
          <Button size="sm" onClick={handleOpenAddAddressTag}>
            <PlusIcon className="mr-1.5 size-3.5" />
            Add address tag
          </Button>
        }
      >
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Tag Name</TableHead>
                <TableHead className="w-[30%]">Description</TableHead>
                <TableHead className="w-[15%]">Charge Type</TableHead>
                <TableHead className="w-[15%]">Amount / Rate</TableHead>
                <TableHead className="w-[10%]">Status</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {addressTags.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No address tags configured yet. Click &quot;Add address tag&quot; to create one.
                  </TableCell>
                </TableRow>
              ) : (
                addressTags.map((at) => (
                  <TableRow key={at.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <HomeIcon className="size-4 text-muted-foreground" />
                        <span>{at.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {at.description || "—"}
                    </TableCell>
                    <TableCell className="capitalize">
                      {at.chargeType}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatChargeDisplay(at.chargeType, at.chargeValue)}
                    </TableCell>
                    <TableCell>
                      {at.active ? (
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-muted text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => handleOpenEditAddressTag(at)}
                          title="Edit"
                        >
                          <PencilIcon className="size-3.5" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteAddressTag(at.id, at.name)}
                          title="Delete"
                        >
                          <Trash2Icon className="size-3.5" />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
        </>
      )}

      {/* Edit Base Charge Dialog */}
      <ResponsiveDialog
        open={baseChargeOpen}
        onOpenChange={setBaseChargeOpen}
        title="Edit base delivery charge"
        description="Added to every order before any delivery strategy charge."
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBaseChargeOpen(false)}
              disabled={isSavingBase}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveBaseCharge}
              disabled={isSavingBase}
            >
              {isSavingBase && <Loader2Icon className="mr-1.5 size-4 animate-spin" />}
              Save changes
            </Button>
          </>
        }
      >
        <div className="grid gap-5">
          <div className="space-y-2">
            <Label htmlFor="base-charge-val">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span>
              <Input
                id="base-charge-val"
                type="number"
                step="0.01"
                min="0"
                className="pl-7"
                value={baseChargeInput}
                onChange={(e) => setBaseChargeInput(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Applied automatically to all orders as the base delivery fee.
            </p>
          </div>
        </div>
      </ResponsiveDialog>

      {/* Strategy option Add/Edit Dialog */}
      <ItemChargeDialog
        open={deliveryStrategyDialogOpen}
        onOpenChange={setDeliveryStrategyDialogOpen}
        item={editingDeliveryStrategy ?? (newOptionGroupId ? { ...EMPTY_OPTION, groupId: newOptionGroupId } : null)}
        title={editingDeliveryStrategy ? "Edit option" : "Add option"}
        namePlaceholder="e.g. Front Door, Lobby, Garage"
        groups={groups}
        onSave={async (values) => {
          const saved = await saveDeliveryStrategyAction(values);
          setDeliveryStrategies((prev) => upsert(prev, saved));
        }}
      />

      {editingGroup && (
        <StrategyGroupDialog
          group={editingGroup === "new" ? null : editingGroup}
          onClose={() => setEditingGroup(null)}
          onSave={async (values) => {
            const saved = await saveGroupAction(values);
            setGroups((prev) => upsert(prev, saved));
          }}
        />
      )}

      {showAddressTags && (
        <>
      {/* Address Tag Add/Edit Dialog */}
      <ItemChargeDialog
        open={addressTagDialogOpen}
        onOpenChange={setAddressTagDialogOpen}
        item={editingAddressTag}
        title={editingAddressTag ? "Edit address tag" : "Add address tag"}
        namePlaceholder="e.g. House, Apartment, Commercial Building"
        onSave={async (values) => {
          const saved = await saveAddressTagAction(values);
          setAddressTags((prev) => {
            const idx = prev.findIndex((p) => p.id === saved.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = saved;
              return next;
            }
            return [...prev, saved];
          });
        }}
      />
        </>
      )}
    </div>
  );
}

interface ItemChargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id?: string;
    name: string;
    description: string | null;
    chargeType: DeliveryChargeType;
    chargeValue: number;
    active: boolean;
    tag?: string | null;
    groupId?: string | null;
  } | null;
  title: string;
  namePlaceholder: string;
  /** Strategy options: shows the Strategy select and the Tag field. */
  groups?: DeliveryStrategyGroupDto[];
  onSave: (values: DeliveryChargeRuleInput) => Promise<void>;
}

function ItemChargeDialog({
  open,
  onOpenChange,
  item,
  title,
  namePlaceholder,
  groups,
  onSave,
}: ItemChargeDialogProps) {
  return open ? (
    <ItemChargeDialogBody
      key={item?.id ?? `__new__${item?.groupId ?? ""}`}
      open={open}
      onOpenChange={onOpenChange}
      item={item}
      title={title}
      namePlaceholder={namePlaceholder}
      groups={groups}
      onSave={onSave}
    />
  ) : null;
}

function ItemChargeDialogBody({
  onOpenChange,
  item,
  title,
  namePlaceholder,
  groups,
  onSave,
}: ItemChargeDialogProps) {
  const [name, setName] = useState(item?.name ?? "");
  const [tag, setTag] = useState(item?.tag ?? "");
  const [groupId, setGroupId] = useState(item?.groupId ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [chargeType, setChargeType] = useState<DeliveryChargeType>(item?.chargeType ?? "none");
  const [chargeValue, setChargeValue] = useState(
    item?.chargeValue != null ? String(item.chargeValue) : "0.00",
  );
  const [active, setActive] = useState(item?.active ?? true);
  const [saving, startSaving] = useTransition();

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Please enter a name.");
      return;
    }

    const val = chargeType === "none" ? 0 : Number(chargeValue);
    if (!Number.isFinite(val) || val < 0) {
      toast.error("Please enter a valid charge value (0 or greater).");
      return;
    }
    if (chargeType === "percent" && val > 100) {
      toast.error("Percentage charge cannot exceed 100%.");
      return;
    }
    if (groups && !groupId) {
      toast.error("Pick the strategy this option belongs to.");
      return;
    }

    startSaving(async () => {
      try {
        await onSave({
          id: item?.id,
          name: trimmedName,
          description: description.trim() || null,
          chargeType,
          chargeValue: val,
          active,
          ...(groups ? { tag: tag.trim() || null, groupId: groupId || null } : {}),
        });
        toast.success(`${title} saved successfully.`);
        onOpenChange(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  };

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={title}
      description="Customers see the name; the charge is added to their plan price."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
          >
            {saving && <Loader2Icon className="mr-1.5 size-4 animate-spin" />}
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <div className="space-y-2">
          <Label htmlFor="charge-item-name">Name</Label>
          <Input
            id="charge-item-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={namePlaceholder}
          />
        </div>

        {groups && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="charge-item-group">Strategy</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger id="charge-item-group" className="w-full">
                  <SelectValue placeholder="Pick a strategy" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="charge-item-tag">
                Tag <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input id="charge-item-tag" value={tag} maxLength={24} onChange={(e) => setTag(e.target.value)} placeholder="e.g. Secure" />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="charge-item-desc">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="charge-item-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Helpful note for staff or customers"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
        {/* Free has no amount: the type takes the whole row so it never sits half-empty. */}
        <div className={chargeType === "none" ? "space-y-2 sm:col-span-2" : "space-y-2"}>
          <Label htmlFor="charge-item-type">Charge type</Label>
          <Select
            value={chargeType}
            onValueChange={(val) => setChargeType(val as DeliveryChargeType)}
          >
            <SelectTrigger id="charge-item-type" className="w-full">
              <SelectValue placeholder="Select charge type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Zero charge (Free)</SelectItem>
              <SelectItem value="fixed">Fixed amount ($)</SelectItem>
              <SelectItem value="percent">Percentage of plan price (%)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {chargeType !== "none" && (
          <div className="space-y-2">
            <Label htmlFor="charge-item-val">
              {chargeType === "fixed" ? "Amount" : "Percentage"}
            </Label>
            <div className="relative">
              {chargeType === "fixed" && (
                <span className="absolute left-3 top-2.5 text-sm text-muted-foreground">$</span>
              )}
              <Input
                id="charge-item-val"
                type="number"
                step={chargeType === "fixed" ? "0.01" : "0.5"}
                min="0"
                max={chargeType === "percent" ? "100" : undefined}
                className={chargeType === "fixed" ? "pl-7" : "pr-7"}
                value={chargeValue}
                onChange={(e) => setChargeValue(e.target.value)}
                placeholder="0.00"
              />
              {chargeType === "percent" && (
                <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">%</span>
              )}
            </div>
            {chargeType === "percent" && (
              <p className="text-xs text-muted-foreground">
                Calculated against the customer&apos;s selected plan price (e.g. 5% on a $100 plan = $5.00).
              </p>
            )}
          </div>
        )}

        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-4 py-3.5">
          <div className="space-y-0.5">
            <Label htmlFor="charge-item-active" className="text-sm font-medium">
              Active
            </Label>
            <p className="text-xs text-muted-foreground">
              Inactive options can't be picked on new orders.
            </p>
          </div>
          <Switch
            id="charge-item-active"
            checked={active}
            onCheckedChange={setActive}
          />
        </div>

      </div>
    </ResponsiveDialog>
  );
}

const EMPTY_OPTION = {
  name: "",
  description: null,
  chargeType: "none" as DeliveryChargeType,
  chargeValue: 0,
  active: true,
};

function upsert<T extends { id: string }>(prev: T[], saved: T): T[] {
  return prev.some((p) => p.id === saved.id) ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved];
}

function TagChip({ tag }: { tag: string | null | undefined }) {
  if (!tag) return null;
  return (
    <Badge variant="secondary" className="rounded-full px-2 py-0 text-[11px] font-medium">
      {tag}
    </Badge>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30">
      Active
    </Badge>
  ) : (
    <Badge variant="outline" className="border-muted text-muted-foreground">
      Inactive
    </Badge>
  );
}

/** One strategy and its options. No `group` = the options that have none yet. */
function StrategyGroupBlock({
  group,
  options,
  onEditGroup,
  onDeleteGroup,
  onAddOption,
  onEditOption,
  onDeleteOption,
  formatCharge,
}: {
  group?: DeliveryStrategyGroupDto;
  options: DeliveryStrategyDto[];
  onEditGroup?: () => void;
  onDeleteGroup?: () => void;
  onAddOption?: () => void;
  onEditOption: (o: DeliveryStrategyDto) => void;
  onDeleteOption: (o: DeliveryStrategyDto) => void;
  formatCharge: (type: DeliveryChargeType, value: number) => string;
}) {
  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-3">
        <TruckIcon className="size-4 text-muted-foreground" />
        <span className="font-medium">{group?.name ?? "No strategy yet"}</span>
        <TagChip tag={group?.tag} />
        {group?.required ? <Badge variant="outline">Required</Badge> : null}
        {group && !group.active ? <StatusBadge active={false} /> : null}
        {!group ? (
          <span className="text-xs text-muted-foreground">Edit each option to move it into a strategy.</span>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          {onAddOption && (
            <Button variant="outline" size="sm" onClick={onAddOption}>
              <PlusIcon className="mr-1 size-3.5" />
              Add option
            </Button>
          )}
          {onEditGroup && (
            <Button variant="ghost" size="icon" className="size-8" onClick={onEditGroup} title="Edit strategy">
              <PencilIcon className="size-3.5" />
              <span className="sr-only">Edit strategy</span>
            </Button>
          )}
          {onDeleteGroup && (
            <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={onDeleteGroup} title="Delete strategy">
              <Trash2Icon className="size-3.5" />
              <span className="sr-only">Delete strategy</span>
            </Button>
          )}
        </div>
      </div>
      {group?.description ? <p className="px-4 pt-2 text-xs text-muted-foreground">{group.description}</p> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%]">Option</TableHead>
            <TableHead className="w-[30%]">Description</TableHead>
            <TableHead className="w-[15%]">Charge</TableHead>
            <TableHead className="w-[10%]">Status</TableHead>
            <TableHead className="w-[80px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {options.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                No options yet. Click &quot;Add option&quot;.
              </TableCell>
            </TableRow>
          ) : (
            options.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{o.name}</span>
                    <TagChip tag={o.tag} />
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{o.description || "—"}</TableCell>
                <TableCell className="font-medium">{formatCharge(o.chargeType, o.chargeValue)}</TableCell>
                <TableCell><StatusBadge active={o.active} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => onEditOption(o)} title="Edit">
                      <PencilIcon className="size-3.5" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => onDeleteOption(o)} title="Delete">
                      <Trash2Icon className="size-3.5" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function StrategyGroupDialog({
  group,
  onClose,
  onSave,
}: {
  group: DeliveryStrategyGroupDto | null;
  onClose: () => void;
  onSave: (values: DeliveryStrategyGroupInput) => Promise<void>;
}) {
  const [name, setName] = useState(group?.name ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [tag, setTag] = useState(group?.tag ?? "");
  const [required, setRequired] = useState(group?.required ?? false);
  const [active, setActive] = useState(group?.active ?? true);
  const [saving, startSaving] = useTransition();

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Please enter a name.");
      return;
    }
    startSaving(async () => {
      try {
        await onSave({
          id: group?.id,
          name: name.trim(),
          description: description.trim() || null,
          tag: tag.trim() || null,
          required,
          active,
          sortOrder: group?.sortOrder,
        });
        toast.success("Strategy saved.");
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  };

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={group ? "Edit strategy" : "Add strategy"}
      description="Customers see the name as a question and pick one of its options."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving && <Loader2Icon className="mr-1.5 size-4 animate-spin" />}
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="strategy-group-name">Name</Label>
            <Input id="strategy-group-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Drop-off spot" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="strategy-group-tag">
              Tag <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input id="strategy-group-tag" value={tag} maxLength={24} onChange={(e) => setTag(e.target.value)} placeholder="e.g. Contactless" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="strategy-group-desc">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input id="strategy-group-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Helpful note for customers" />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-4 py-3.5">
          <div className="space-y-0.5">
            <Label htmlFor="strategy-group-required" className="text-sm font-medium">Required</Label>
            <p className="text-xs text-muted-foreground">Customers must pick an option; no &quot;No preference&quot;.</p>
          </div>
          <Switch id="strategy-group-required" checked={required} onCheckedChange={setRequired} />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border bg-muted/30 px-4 py-3.5">
          <div className="space-y-0.5">
            <Label htmlFor="strategy-group-active" className="text-sm font-medium">Active</Label>
            <p className="text-xs text-muted-foreground">Inactive strategies are hidden from customers.</p>
          </div>
          <Switch id="strategy-group-active" checked={active} onCheckedChange={setActive} />
        </div>
      </div>
    </ResponsiveDialog>
  );
}
