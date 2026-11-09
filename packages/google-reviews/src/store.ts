import { sliceAccessors } from "@foundry/commons/plugin-kit";
import { googleReviewsConfigSchema } from "./config";
import { GOOGLE_REVIEWS_PLUGIN_ID } from "./plugin";

const accessors = sliceAccessors(GOOGLE_REVIEWS_PLUGIN_ID, googleReviewsConfigSchema);

/** Install/uninstall merge into this key; the rest of the config survives an uninstall (placeId kept). */
export const googleReviewsSlice = accessors.slice;
export const getGoogleReviewsConfig = accessors.get;
export const setGoogleReviewsConfig = accessors.set;
