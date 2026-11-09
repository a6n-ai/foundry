import { sliceAccessors } from "@foundry/commons/plugin-kit";
import { uberEatsConfigSchema } from "./config";
import { UBER_EATS_PLUGIN_ID } from "./plugin";

const accessors = sliceAccessors(UBER_EATS_PLUGIN_ID, uberEatsConfigSchema);

/** Install/uninstall merge into this key; the rest of the config survives an uninstall. */
export const uberEatsSlice = accessors.slice;
export const getUberEatsConfig = accessors.get;
export const setUberEatsConfig = accessors.set;
