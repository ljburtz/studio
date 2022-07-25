// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Log from "@foxglove/log";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import { IIterableSource } from "@foxglove/studio-base/players/IterablePlayer/IIterableSource";
import {
  AdvertiseOptions,
  Player,
  PlayerPresence,
  PlayerState,
  PublishPayload,
  SubscribePayload,
} from "@foxglove/studio-base/players/types";

const log = Log.getLogger(__filename);

class BenchmarkPlayer implements Player {
  private source: IIterableSource;
  private name: string;
  private listener?: (state: PlayerState) => Promise<void>;
  private subscriptions: SubscribePayload[] = [];

  constructor(name: string, source: BenchmarkPlayer["source"]) {
    this.name = name;
    this.source = source;
  }

  setListener(listener: (state: PlayerState) => Promise<void>): void {
    this.listener = listener;
    void this.run();
  }
  close(): void {
    //throw new Error("Method not implemented.");
  }
  setSubscriptions(subscriptions: SubscribePayload[]): void {
    this.subscriptions = subscriptions;
  }
  setPublishers(_publishers: AdvertiseOptions[]): void {
    //throw new Error("Method not implemented.");
  }
  setParameter(_key: string, _value: unknown): void {
    throw new Error("Method not implemented.");
  }
  publish(_request: PublishPayload): void {
    throw new Error("Method not implemented.");
  }
  async callService(_service: string, _request: unknown): Promise<unknown> {
    throw new Error("Method not implemented.");
  }
  requestBackfill(): void {
    // no-op
  }
  setGlobalVariables(_globalVariables: GlobalVariables): void {
    throw new Error("Method not implemented.");
  }

  private async run() {
    const listener = this.listener;
    if (!listener) {
      throw new Error("Invariant: listener is not set");
    }

    log.debug("Initializing benchmark player");

    await listener({
      profile: undefined,
      presence: PlayerPresence.INITIALIZING,
      name: this.name + "\ninitializing source",
      playerId: this.name,
      capabilities: [],
      progress: {},
    });

    // initialize
    const result = await this.source.initialize();

    await listener({
      profile: undefined,
      presence: PlayerPresence.INITIALIZING,
      name: this.name + "\ngetting messages",
      playerId: this.name,
      capabilities: [],
      progress: {},
    });

    // Get all messages
    const iterator = this.source.messageIterator({
      topics: result.topics.map((topic) => topic.name),
    });

    // Load all messages into memory
    for await (const item of iterator) {
      item;

      // any problem bails the iterator
    }

    performance.mark("message-emit-start");

    // we have messages - now we should emit them one by one
    for (const message of parsedMessages) {
      await listener({
        profile: undefined,
        presence: PlayerPresence.PRESENT,
        name: this.name,
        playerId: this.name,
        capabilities: [],
        progress: {},
        activeData: {
          messages: [message],
          totalBytesReceived: 0,
          messageOrder: "receiveTime",
          startTime: start,
          endTime: end,
          currentTime: message.receiveTime,
          isPlaying: true,
          speed: 1,
          lastSeekTime: 1,
          topics,
          topicStats,
          datatypes,
        },
      });
    }

    performance.mark("message-emit-end");
    performance.measure("message-emit", "message-emit-start", "message-emit-end");
  }
}

export { BenchmarkPlayer };
