import { sliceAccessors } from "@foundry/commons/plugin-kit";
import { doorDashConfigSchema } from "./config";
import { DOORDASH_PLUGIN_ID } from "./plugin";

const accessors = sliceAccessors(DOORDASH_PLUGIN_ID, doorDashConfigSchema);

/** Install/uninstall merge into this key; the rest of the config survives an uninstall. */
export const doorDashSlice = accessors.slice;
export const getDoorDashConfig = accessors.get;
export const setDoorDashConfig = accessors.set;
