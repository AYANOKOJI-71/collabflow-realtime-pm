import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import type { Server } from "socket.io";

export async function attachRedisAdapter(io: Server, redisUrl: string): Promise<() => Promise<void>> {
  const publisher = createClient({ url: redisUrl });
  const subscriber = publisher.duplicate();
  await Promise.all([publisher.connect(), subscriber.connect()]);
  io.adapter(createAdapter(publisher, subscriber));
  return async () => Promise.all([publisher.quit(), subscriber.quit()]).then(() => undefined);
}
