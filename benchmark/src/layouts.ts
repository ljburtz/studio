// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Layout, LayoutID, ISO8601Timestamp } from "@foxglove/studio-base";

const LAYOUTS = new Map<string, Layout>([
  [
    "benchmark-raw-messages",
    {
      id: "benchmark-raw-messages" as LayoutID,
      name: "Benchmark - RawMessages",
      permission: "CREATOR_WRITE",
      baseline: {
        data: {
          configById: {
            "RawMessages!os6rgs": {
              topicPath: "/gps",
            },
          },
          globalVariables: {},
          userNodes: {},
          linkedGlobalVariables: [],
          playbackConfig: { speed: 1.0 },
          layout: "RawMessages!os6rgs",
        },
        savedAt: new Date().toISOString() as ISO8601Timestamp,
      },
      working: undefined,
      syncInfo: undefined,
    },
  ],
  [
    "benchmark-3d-panel",
    {
      id: "benchmark-3d-panel" as LayoutID,
      name: "Benchmark - ThreeDimensionalViz",
      permission: "CREATOR_WRITE",
      baseline: {
        data: {
          configById: {
            "3D Panel!2duripi": {
              autoSyncCameraState: false,
              autoTextBackgroundColor: true,
              cameraState: {
                distance: 30.07301531859491,
                perspective: true,
                phi: 0.8206301608559966,
                targetOffset: [3.518847932546147, 0.42976146327776205, 0],
                thetaOffset: 0.913787862462246,
                fovy: 0.7853981633974483,
                near: 0.01,
                far: 5000,
              },
              checkedKeys: ["name:Topics", "t:/LIDAR_TOP", "t:/markers/annotations", "t:/pose"],
              clickToPublishPoseTopic: "/move_base_simple/goal",
              clickToPublishPointTopic: "/clicked_point",
              clickToPublishPoseEstimateTopic: "/initialpose",
              clickToPublishPoseEstimateXDeviation: 0.5,
              clickToPublishPoseEstimateYDeviation: 0.5,
              clickToPublishPoseEstimateThetaDeviation: 0.2617993877991494,
              customBackgroundColor: "#000000",
              diffModeEnabled: true,
              expandedKeys: ["name:Topics"],
              followMode: "follow",
              modifiedNamespaceTopics: [],
              pinTopics: false,
              settingsByKey: {
                "t:/pose/mesh": {
                  overrideColor: {
                    r: 1,
                    g: 1,
                    b: 1,
                    a: 1,
                  },
                },
              },
              useThemeBackgroundColor: true,
            },
          },
          globalVariables: {},
          userNodes: {},
          linkedGlobalVariables: [],
          playbackConfig: { speed: 1.0 },
          layout: "3D Panel!2duripi",
        },
        savedAt: new Date().toISOString() as ISO8601Timestamp,
      },
      working: undefined,
      syncInfo: undefined,
    },
  ],
]);

export { LAYOUTS };
