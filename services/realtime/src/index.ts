import { handle } from "./routes";

export { ChannelRoom } from "./room";
export default { fetch: handle } satisfies ExportedHandler<import("./routes").Env>;
