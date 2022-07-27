// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { transform } from "lodash";

import { filterMap } from "@foxglove/den/collection";
import { SettingsTreeFields, SettingsTreeNodes } from "@foxglove/studio";

// Persisted panel state
export type Config = {
  customTileUrl: string;
  disabledTopics: string[];
  layer: string;
  zoomLevel?: number;
  followTopic: string;
  topicColors: Record<string, string>;
};

export function validateCustomUrl(url: string): Error | undefined {
  const placeholders = url.match(/\{.+?\}/g) ?? [];
  const validPlaceholders = ["{x}", "{y}", "{z}"];
  for (const placeholder of placeholders) {
    if (!validPlaceholders.includes(placeholder)) {
      return new Error(`Invalid placeholder ${placeholder}`);
    }
  }

  return undefined;
}

export function buildSettingsTree(config: Config, eligibleTopics: string[]): SettingsTreeNodes {
  const topics: SettingsTreeNodes = transform(
    eligibleTopics,
    (result, topic) => {
      const coloring = config.topicColors[topic];
      result[topic] = {
        label: topic,
        fields: {
          enabled: {
            label: "Enabled",
            input: "boolean",
            value: !config.disabledTopics.includes(topic),
          },
          coloring: {
            label: "Coloring",
            input: "select",
            value: coloring ? "Custom" : "Automatic",
            options: [
              { label: "Automatic", value: "Automatic" },
              { label: "Custom", value: "Custom" },
            ],
          },
          color: coloring
            ? {
                label: "Color",
                input: "rgb",
                value: coloring,
              }
            : undefined,
        },
      };
    },
    {} as SettingsTreeNodes,
  );

  const eligibleFollowTopicOptions = filterMap(eligibleTopics, (topic) =>
    config.disabledTopics.includes(topic) ? undefined : { label: topic, value: topic },
  );
  const followTopicOptions = [{ label: "Off", value: "" }, ...eligibleFollowTopicOptions];
  const generalSettings: SettingsTreeFields = {
    layer: {
      label: "Tile Layer",
      input: "select",
      value: config.layer,
      options: [
        { label: "Map", value: "map" },
        { label: "Satellite", value: "satellite" },
        { label: "Custom", value: "custom" },
      ],
    },
  };

  // Only show the custom url input when the user selects the custom layer
  if (config.layer === "custom") {
    let error: string | undefined;
    if (config.customTileUrl.length > 0) {
      error = validateCustomUrl(config.customTileUrl)?.message;
    }

    generalSettings.customTileUrl = {
      label: "Custom map tile URL",
      input: "string",
      value: config.customTileUrl,
      error,
    };
  }

  generalSettings.followTopic = {
    label: "Follow topic",
    input: "select",
    value: config.followTopic,
    options: followTopicOptions,
  };

  const settings: SettingsTreeNodes = {
    general: {
      label: "General",
      icon: "Settings",
      fields: generalSettings,
    },
    topics: {
      label: "Topics",
      children: topics,
    },
  };

  return settings;
}
