// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import RulerIcon from "@mdi/svg/svg/ruler.svg";
import Video3dIcon from "@mdi/svg/svg/video-3d.svg";
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  useTheme,
} from "@mui/material";
import { isEqual, cloneDeep, merge } from "lodash";
import React, { useCallback, useLayoutEffect, useEffect, useState, useMemo, useRef } from "react";
import ReactDOM from "react-dom";
import { useLatest, useLongPress } from "react-use";
import { DeepPartial } from "ts-essentials";
import { useDebouncedCallback } from "use-debounce";

import Logger from "@foxglove/log";
import { CameraState, DEFAULT_CAMERA_STATE, MouseEventObject } from "@foxglove/regl-worldview";
import { definitions as commonDefs } from "@foxglove/rosmsg-msgs-common";
import { fromDate, toNanoSec } from "@foxglove/rostime";
import {
  LayoutActions,
  MessageEvent,
  PanelExtensionContext,
  RenderState,
  SettingsTreeAction,
  SettingsTreeNodes,
  Topic,
} from "@foxglove/studio";
import PublishGoalIcon from "@foxglove/studio-base/components/PublishGoalIcon";
import PublishPointIcon from "@foxglove/studio-base/components/PublishPointIcon";
import PublishPoseEstimateIcon from "@foxglove/studio-base/components/PublishPoseEstimateIcon";
import useCleanup from "@foxglove/studio-base/hooks/useCleanup";
import { DEFAULT_PUBLISH_SETTINGS } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/CoreSettings";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";
import { Point, makeCovarianceArray } from "@foxglove/studio-base/util/geometry";

import { DebugGui } from "./DebugGui";
import Interactions, { InteractionContextMenu, SelectionObject, TabType } from "./Interactions";
import type { Renderable } from "./Renderable";
import { MessageHandler, Renderer, RendererConfig } from "./Renderer";
import { RendererContext, useRenderer, useRendererEvent } from "./RendererContext";
import { Stats } from "./Stats";
import { FRAME_TRANSFORM_DATATYPES } from "./foxglove";
import { PublishClickEvent, PublishClickType } from "./renderables/PublishClickTool";
import { TF_DATATYPES, TRANSFORM_STAMPED_DATATYPES } from "./ros";
import { Pose } from "./transforms/geometry";

const log = Logger.getLogger(__filename);

const SHOW_DEBUG: true | false = false;
const PANEL_STYLE: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  position: "relative",
};

const PublishClickIcons: Record<PublishClickType, React.ReactNode> = {
  pose: <PublishGoalIcon fontSize="inherit" />,
  point: <PublishPointIcon fontSize="inherit" />,
  pose_estimate: <PublishPoseEstimateIcon fontSize="inherit" />,
};

const PublishDatatypes = new Map(
  (
    [
      "geometry_msgs/Point",
      "geometry_msgs/PointStamped",
      "geometry_msgs/Pose",
      "geometry_msgs/PoseStamped",
      "geometry_msgs/PoseWithCovariance",
      "geometry_msgs/PoseWithCovarianceStamped",
      "geometry_msgs/Quaternion",
      "std_msgs/Header",
    ] as Array<keyof typeof commonDefs>
  ).map((type) => [type, commonDefs[type]]),
);

function makePointMessage(point: Point, frameId: string) {
  const time = fromDate(new Date());
  return {
    header: { seq: 0, stamp: time, frame_id: frameId },
    point: { x: point.x, y: point.y, z: 0 },
  };
}

function makePoseMessage(pose: Pose, frameId: string) {
  const time = fromDate(new Date());
  return {
    header: { seq: 0, stamp: time, frame_id: frameId },
    pose,
  };
}

function makePoseEstimateMessage(
  pose: Pose,
  frameId: string,
  xDev: number,
  yDev: number,
  thetaDev: number,
) {
  const time = fromDate(new Date());
  return {
    header: { seq: 0, stamp: time, frame_id: frameId },
    pose: {
      covariance: makeCovarianceArray(xDev, yDev, thetaDev),
      pose,
    },
  };
}

/**
 * Provides DOM overlay elements on top of the 3D scene (e.g. stats, debug GUI).
 */
function RendererOverlay(props: {
  canvas: HTMLCanvasElement | ReactNull;
  addPanel: LayoutActions["addPanel"];
  enableStats: boolean;
  perspective: boolean;
  onTogglePerspective: () => void;
  measureActive: boolean;
  onClickMeasure: () => void;
  canPublish: boolean;
  publishActive: boolean;
  publishClickType: PublishClickType;
  onChangePublishClickType: (_: PublishClickType) => void;
  onClickPublish: () => void;
}): JSX.Element {
  const [clickedPosition, setClickedPosition] = useState<{ clientX: number; clientY: number }>({
    clientX: 0,
    clientY: 0,
  });
  const [selectedRenderables, setSelectedRenderables] = useState<Renderable[]>([]);
  const [selectedRenderable, setSelectedRenderable] = useState<Renderable | undefined>(undefined);
  const [interactionsTabType, setInteractionsTabType] = useState<TabType | undefined>(undefined);
  const renderer = useRenderer();

  // Toggle object selection mode on/off in the renderer
  useEffect(() => {
    if (renderer) {
      renderer.setPickingEnabled(interactionsTabType != undefined);
    }
  }, [interactionsTabType, renderer]);

  useRendererEvent("renderablesClicked", (renderables, cursorCoords) => {
    const rect = props.canvas!.getBoundingClientRect();
    setClickedPosition({ clientX: rect.left + cursorCoords.x, clientY: rect.top + cursorCoords.y });
    setSelectedRenderables(renderables);
    setSelectedRenderable(renderables.length === 1 ? renderables[0] : undefined);
  });

  const stats = props.enableStats ? (
    <div id="stats" style={{ position: "absolute", top: "10px", left: "10px" }}>
      <Stats />
    </div>
  ) : undefined;

  const debug = SHOW_DEBUG ? (
    <div id="debug" style={{ position: "absolute", top: "70px", left: "10px" }}>
      <DebugGui />
    </div>
  ) : undefined;

  // Convert the list of selected renderables (if any) into MouseEventObjects
  // that can be passed to <InteractionContextMenu>, which shows a context menu
  // of candidate objects to select
  const clickedObjects = useMemo<MouseEventObject[]>(
    () =>
      selectedRenderables.map((renderable) => ({
        object: {
          pose: renderable.userData.pose,
          scale: renderable.scale,
          color: undefined,
          interactionData: {
            topic: renderable.name,
            highlighted: undefined,
            renderable,
          },
        },
        instanceIndex: undefined,
      })),
    [selectedRenderables],
  );

  // Once a single renderable is selected, convert it to the SelectionObject
  // format to populate the object inspection dialog (<Interactions>)
  const selectedObject = useMemo<SelectionObject | undefined>(
    () =>
      selectedRenderable
        ? {
            object: {
              pose: selectedRenderable.userData.pose,
              interactionData: {
                topic: selectedRenderable.name,
                highlighted: true,
                originalMessage: selectedRenderable.details(),
              },
            },
            instanceIndex: undefined,
          }
        : undefined,
    [selectedRenderable],
  );

  // Inform the Renderer when a renderable is selected
  useEffect(() => {
    renderer?.setSelectedRenderable(selectedRenderable);
  }, [renderer, selectedRenderable]);

  const publickClickButtonRef = useRef<HTMLButtonElement>(ReactNull);
  const [publishMenuExpanded, setPublishMenuExpanded] = useState(false);
  const selectedPublishClickIcon = PublishClickIcons[props.publishClickType];

  const onLongPressPublish = useCallback(() => {
    setPublishMenuExpanded(true);
  }, []);
  const longPressPublishEvent = useLongPress(onLongPressPublish);

  const theme = useTheme();

  return (
    <React.Fragment>
      <div
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 10,
          pointerEvents: "none",
        }}
      >
        <Interactions
          addPanel={props.addPanel}
          selectedObject={selectedObject}
          interactionsTabType={interactionsTabType}
          setInteractionsTabType={setInteractionsTabType}
        />
        <Paper square={false} elevation={4} style={{ display: "flex", flexDirection: "column" }}>
          <IconButton
            color={props.perspective ? "info" : "inherit"}
            title={props.perspective ? "Switch to 2D camera" : "Switch to 3D camera"}
            onClick={props.onTogglePerspective}
            style={{ pointerEvents: "auto" }}
          >
            <Video3dIcon style={{ width: 16, height: 16 }} />
          </IconButton>
          <IconButton
            data-test="measure-button"
            color={props.measureActive ? "info" : "inherit"}
            title={props.measureActive ? "Cancel measuring" : "Measure distance"}
            onClick={props.onClickMeasure}
            style={{ position: "relative", pointerEvents: "auto" }}
          >
            <RulerIcon style={{ width: 16, height: 16 }} />
          </IconButton>

          {props.canPublish && (
            <>
              <IconButton
                {...longPressPublishEvent}
                color={props.publishActive ? "info" : "inherit"}
                title={props.publishActive ? "Click to cancel" : "Click to publish"}
                ref={publickClickButtonRef}
                onClick={props.onClickPublish}
                data-test="publish-button"
                style={{ fontSize: "1rem", pointerEvents: "auto" }}
              >
                {selectedPublishClickIcon}
                <div
                  style={{
                    borderBottom: "6px solid currentColor",
                    borderRight: "6px solid transparent",
                    bottom: 0,
                    left: 0,
                    height: 0,
                    width: 0,
                    margin: theme.spacing(0.25),
                    position: "absolute",
                  }}
                />
              </IconButton>
              <Menu
                id="publish-menu"
                anchorEl={publickClickButtonRef.current}
                anchorOrigin={{ vertical: "top", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
                open={publishMenuExpanded}
                onClose={() => setPublishMenuExpanded(false)}
              >
                <MenuItem
                  selected={props.publishClickType === "pose_estimate"}
                  onClick={() => {
                    props.onChangePublishClickType("pose_estimate");
                    setPublishMenuExpanded(false);
                  }}
                >
                  <ListItemIcon>{PublishClickIcons.pose_estimate}</ListItemIcon>
                  <ListItemText>Publish pose estimate</ListItemText>
                </MenuItem>
                <MenuItem
                  selected={props.publishClickType === "pose"}
                  onClick={() => {
                    props.onChangePublishClickType("pose");
                    setPublishMenuExpanded(false);
                  }}
                >
                  <ListItemIcon>{PublishClickIcons.pose}</ListItemIcon>
                  <ListItemText>Publish pose</ListItemText>
                </MenuItem>
                <MenuItem
                  selected={props.publishClickType === "point"}
                  onClick={() => {
                    props.onChangePublishClickType("point");
                    setPublishMenuExpanded(false);
                  }}
                >
                  <ListItemIcon>{PublishClickIcons.point}</ListItemIcon>
                  <ListItemText>Publish point</ListItemText>
                </MenuItem>
              </Menu>
            </>
          )}
        </Paper>
      </div>
      {clickedObjects.length > 1 && !selectedObject && (
        <InteractionContextMenu
          clickedPosition={clickedPosition}
          clickedObjects={clickedObjects}
          selectObject={(selection) => {
            if (selection) {
              const renderable = (
                selection.object as unknown as { interactionData: { renderable: Renderable } }
              ).interactionData.renderable;
              setSelectedRenderables([]);
              setSelectedRenderable(renderable);
            }
          }}
        />
      )}
      {stats}
      {debug}
    </React.Fragment>
  );
}

/**
 * A panel that renders a 3D scene. This is a thin wrapper around a `Renderer` instance.
 */
export function ThreeDeeRender({ context }: { context: PanelExtensionContext }): JSX.Element {
  const { initialState, saveState } = context;

  // Load and save the persisted panel configuration
  const [config, setConfig] = useState<RendererConfig>(() => {
    const partialConfig = initialState as DeepPartial<RendererConfig> | undefined;

    // Initialize the camera from default settings overlaid with persisted settings
    const cameraState: CameraState = merge(
      cloneDeep(DEFAULT_CAMERA_STATE),
      partialConfig?.cameraState,
    );
    const publish = merge(cloneDeep(DEFAULT_PUBLISH_SETTINGS), partialConfig?.publish);

    return {
      cameraState,
      followTf: partialConfig?.followTf,
      scene: partialConfig?.scene ?? {},
      transforms: partialConfig?.transforms ?? {},
      topics: partialConfig?.topics ?? {},
      layers: partialConfig?.layers ?? {},
      publish,
    };
  });
  const configRef = useRef(config);
  const { cameraState } = config;
  const backgroundColor = config.scene.backgroundColor;

  const [canvas, setCanvas] = useState<HTMLCanvasElement | ReactNull>(ReactNull);
  const [renderer, setRenderer] = useState<Renderer | ReactNull>(ReactNull);
  useEffect(
    () => setRenderer(canvas ? new Renderer(canvas, configRef.current) : ReactNull),
    [canvas],
  );

  const [colorScheme, setColorScheme] = useState<"dark" | "light" | undefined>();
  const [topics, setTopics] = useState<ReadonlyArray<Topic> | undefined>();
  const [parameters, setParameters] = useState<ReadonlyMap<string, unknown> | undefined>();
  const [messages, setMessages] = useState<ReadonlyArray<MessageEvent<unknown>> | undefined>();
  const [currentTime, setCurrentTime] = useState<bigint | undefined>();
  const [didSeek, setDidSeek] = useState<boolean>(false);

  const renderRef = useRef({ needsRender: false });
  const [renderDone, setRenderDone] = useState<(() => void) | undefined>();

  const datatypeHandlers = useMemo(
    () => renderer?.datatypeHandlers ?? new Map<string, MessageHandler[]>(),
    [renderer],
  );

  const topicHandlers = useMemo(
    () => renderer?.topicHandlers ?? new Map<string, MessageHandler[]>(),
    [renderer],
  );

  // Config cameraState
  useEffect(() => {
    const listener = () => {
      if (renderer) {
        setConfig((prevConfig) => ({ ...prevConfig, cameraState: renderer.getCameraState() }));
      }
    };
    renderer?.addListener("cameraMove", listener);
    return () => void renderer?.removeListener("cameraMove", listener);
  }, [renderer]);

  // Build a map from topic name to datatype
  const topicsToDatatypes = useMemo(() => {
    const map = new Map<string, string>();
    if (!topics) {
      return map;
    }
    for (const topic of topics) {
      map.set(topic.name, topic.datatype);
    }
    return map;
  }, [topics]);

  // Handle user changes in the settings sidebar
  const actionHandler = useCallback(
    (action: SettingsTreeAction) => renderer?.settings.handleAction(action),
    [renderer],
  );

  // Maintain the settings tree
  const [settingsTree, setSettingsTree] = useState<SettingsTreeNodes | undefined>(undefined);
  const updateSettingsTree = useCallback(
    (curRenderer: Renderer) => setSettingsTree(curRenderer.settings.tree()),
    [],
  );
  useRendererEvent("settingsTreeChange", updateSettingsTree, renderer);

  // Save the panel configuration when it changes
  const updateConfig = useCallback((curRenderer: Renderer) => setConfig(curRenderer.config), []);
  useRendererEvent("configChange", updateConfig, renderer);

  // Rebuild the settings sidebar tree as needed
  useEffect(() => {
    context.updatePanelSettingsEditor({
      actionHandler,
      enableFilter: true,
      nodes: settingsTree ?? {},
    });
  }, [actionHandler, context, settingsTree]);

  // Update the renderer's reference to `config` when it changes
  useEffect(() => {
    if (renderer) {
      renderer.config = config;
      renderRef.current.needsRender = true;
    }
  }, [config, renderer]);

  // Update the renderer's reference to `topics` when it changes
  useEffect(() => {
    if (renderer) {
      renderer.setTopics(topics);
      renderRef.current.needsRender = true;
    }
  }, [topics, renderer]);

  // Tell the renderer if we are connected to a ROS data source
  useEffect(() => {
    if (renderer) {
      renderer.ros = context.dataSourceProfile === "ros1" || context.dataSourceProfile === "ros2";
    }
  }, [context.dataSourceProfile, renderer]);

  // Save panel settings whenever they change
  const throttledSave = useDebouncedCallback(
    (newConfig: RendererConfig) => saveState(newConfig),
    1000,
    { leading: false, trailing: true, maxWait: 1000 },
  );
  useEffect(() => throttledSave(config), [config, throttledSave]);

  // Dispose of the renderer (and associated GPU resources) on teardown
  useCleanup(() => renderer?.dispose());

  // Establish a connection to the message pipeline with context.watch and context.onRender
  useLayoutEffect(() => {
    context.onRender = (renderState: RenderState, done) => {
      ReactDOM.unstable_batchedUpdates(() => {
        if (renderState.currentTime) {
          setCurrentTime(toNanoSec(renderState.currentTime));
        }

        // Increment the seek count if didSeek is set to true, to trigger a
        // state flush in Renderer
        if (renderState.didSeek === true) {
          setDidSeek(true);
        }

        // Set the done callback into a state variable to trigger a re-render
        setRenderDone(done);

        // Keep UI elements and the renderer aware of the current color scheme
        setColorScheme(renderState.colorScheme);

        // We may have new topics - since we are also watching for messages in
        // the current frame, topics may not have changed
        setTopics(renderState.topics);

        // Watch for any changes in the map of observed parameters
        setParameters(renderState.parameters);

        // currentFrame has messages on subscribed topics since the last render call
        if (renderState.currentFrame) {
          // Fully parse lazy messages
          for (const messageEvent of renderState.currentFrame) {
            const maybeLazy = messageEvent.message as { toJSON?: () => unknown };
            if ("toJSON" in maybeLazy) {
              (messageEvent as { message: unknown }).message = maybeLazy.toJSON!();
            }
          }
        }
        setMessages(renderState.currentFrame);
      });
    };

    context.watch("colorScheme");
    context.watch("currentFrame");
    context.watch("currentTime");
    context.watch("didSeek");
    context.watch("parameters");
    context.watch("topics");
  }, [context]);

  // Build a list of topics to subscribe to
  const [topicsToSubscribe, setTopicsToSubscribe] = useState<string[] | undefined>(undefined);
  useEffect(() => {
    const subscriptions = new Set<string>();
    if (!topics) {
      setTopicsToSubscribe(undefined);
      return;
    }

    for (const topic of topics) {
      if (
        FRAME_TRANSFORM_DATATYPES.has(topic.datatype) ||
        TF_DATATYPES.has(topic.datatype) ||
        TRANSFORM_STAMPED_DATATYPES.has(topic.datatype)
      ) {
        // Subscribe to all transform topics
        subscriptions.add(topic.name);
      } else if (config.topics[topic.name]?.visible === true) {
        // Subscribe if the topic is visible
        subscriptions.add(topic.name);
      } else if (
        // prettier-ignore
        (topicHandlers.get(topic.name)?.length ?? 0) +
        (datatypeHandlers.get(topic.datatype)?.length ?? 0) > 1
      ) {
        // Subscribe if there are multiple handlers registered for this topic
        subscriptions.add(topic.name);
      }
    }

    const newTopics = Array.from(subscriptions.keys()).sort();
    setTopicsToSubscribe((prevTopics) => (isEqual(prevTopics, newTopics) ? prevTopics : newTopics));
  }, [topics, config.topics, datatypeHandlers, topicHandlers]);

  // Notify the extension context when our subscription list changes
  useEffect(() => {
    if (!topicsToSubscribe) {
      return;
    }
    log.debug(`Subscribing to [${topicsToSubscribe.join(", ")}]`);
    context.subscribe(topicsToSubscribe.map((topic) => ({ topic, preload: false })));
  }, [context, topicsToSubscribe]);

  // Keep the renderer parameters up to date
  useEffect(() => {
    if (renderer) {
      renderer.setParameters(parameters);
    }
  }, [parameters, renderer]);

  // Keep the renderer currentTime up to date
  useEffect(() => {
    if (renderer && currentTime != undefined) {
      renderer.currentTime = currentTime;
      renderRef.current.needsRender = true;
    }
  }, [currentTime, renderer]);

  // Flush the renderer's state when the seek count changes
  useEffect(() => {
    if (renderer && didSeek) {
      renderer.clear();
      setDidSeek(false);
    }
  }, [renderer, didSeek]);

  // Keep the renderer colorScheme and backgroundColor up to date
  useEffect(() => {
    if (colorScheme && renderer) {
      renderer.setColorScheme(colorScheme, backgroundColor);
      renderRef.current.needsRender = true;
    }
  }, [backgroundColor, colorScheme, renderer]);

  // Handle messages and render a frame if new messages are available
  useEffect(() => {
    if (!renderer || !messages) {
      return;
    }

    for (const message of messages) {
      const datatype = topicsToDatatypes.get(message.topic);
      if (!datatype) {
        continue;
      }

      renderer.addMessageEvent(message, datatype);
    }

    renderRef.current.needsRender = true;
  }, [messages, renderer, topicsToDatatypes]);

  // Update the renderer when the camera moves
  useEffect(() => {
    renderer?.setCameraState(cameraState);
    renderRef.current.needsRender = true;
  }, [cameraState, renderer]);

  // Render a new frame if requested
  useEffect(() => {
    if (renderer && renderRef.current.needsRender) {
      renderer.animationFrame();
      renderRef.current.needsRender = false;
    }
  });

  // Invoke the done callback once the render is complete
  useEffect(() => {
    renderDone?.();
  }, [renderDone]);

  // Create a useCallback wrapper for adding a new panel to the layout, used to open the
  // "Raw Messages" panel from the object inspector
  const addPanel = useCallback(
    (params: Parameters<LayoutActions["addPanel"]>[0]) => context.layout.addPanel(params),
    [context.layout],
  );

  const [measureActive, setMeasureActive] = useState(false);
  useEffect(() => {
    const onStart = () => setMeasureActive(true);
    const onEnd = () => setMeasureActive(false);
    renderer?.measurementTool.addEventListener("foxglove.measure-start", onStart);
    renderer?.measurementTool.addEventListener("foxglove.measure-end", onEnd);
    return () => {
      renderer?.measurementTool.removeEventListener("foxglove.measure-start", onStart);
      renderer?.measurementTool.removeEventListener("foxglove.measure-end", onEnd);
    };
  }, [renderer?.measurementTool]);

  const onClickMeasure = useCallback(() => {
    if (measureActive) {
      renderer?.measurementTool.stopMeasuring();
    } else {
      renderer?.measurementTool.startMeasuring();
      renderer?.publishClickTool.stop();
    }
  }, [measureActive, renderer]);

  const [publishActive, setPublishActive] = useState(false);
  useEffect(() => {
    if (renderer?.publishClickTool.publishClickType !== config.publish.type) {
      renderer?.publishClickTool.setPublishClickType(config.publish.type);
      // stop if we changed types while a publish action was already in progress
      renderer?.publishClickTool.stop();
    }
  }, [config.publish.type, renderer]);

  const publishTopics = useMemo(() => {
    return {
      goal: config.publish.poseTopic,
      point: config.publish.pointTopic,
      pose: config.publish.poseEstimateTopic,
    };
  }, [config.publish.poseTopic, config.publish.pointTopic, config.publish.poseEstimateTopic]);

  useEffect(() => {
    context.advertise?.(publishTopics.goal, "geometry_msgs/PoseStamped", {
      datatypes: PublishDatatypes,
    });
    context.advertise?.(publishTopics.point, "geometry_msgs/PointStamped", {
      datatypes: PublishDatatypes,
    });
    context.advertise?.(publishTopics.pose, "geometry_msgs/PoseWithCovarianceStamped", {
      datatypes: PublishDatatypes,
    });

    return () => {
      context.unadvertise?.(publishTopics.goal);
      context.unadvertise?.(publishTopics.point);
      context.unadvertise?.(publishTopics.pose);
    };
  }, [publishTopics, context]);

  const latestPublishConfig = useLatest(config.publish);

  useEffect(() => {
    const onStart = () => setPublishActive(true);
    const onSubmit = (event: PublishClickEvent & { type: "foxglove.publish-submit" }) => {
      const frameId = renderer?.fixedFrameId;
      if (frameId == undefined) {
        log.warn("Unable to publish, fixedFrameId is not set");
        return;
      }
      if (!context.publish) {
        log.error("Data source does not support publishing");
        return;
      }
      try {
        switch (event.publishClickType) {
          case "point": {
            const message = makePointMessage(event.point, frameId);
            context.publish(publishTopics.point, message);
            break;
          }
          case "pose": {
            const message = makePoseMessage(event.pose, frameId);
            context.publish(publishTopics.goal, message);
            break;
          }
          case "pose_estimate": {
            const message = makePoseEstimateMessage(
              event.pose,
              frameId,
              latestPublishConfig.current.poseEstimateXDeviation,
              latestPublishConfig.current.poseEstimateYDeviation,
              latestPublishConfig.current.poseEstimateThetaDeviation,
            );
            context.publish(publishTopics.pose, message);
            break;
          }
        }
      } catch (error) {
        log.info(error);
      }
    };
    const onEnd = () => setPublishActive(false);
    renderer?.publishClickTool.addEventListener("foxglove.publish-start", onStart);
    renderer?.publishClickTool.addEventListener("foxglove.publish-submit", onSubmit);
    renderer?.publishClickTool.addEventListener("foxglove.publish-end", onEnd);
    return () => {
      renderer?.publishClickTool.removeEventListener("foxglove.publish-start", onStart);
      renderer?.publishClickTool.removeEventListener("foxglove.publish-submit", onSubmit);
      renderer?.publishClickTool.removeEventListener("foxglove.publish-end", onEnd);
    };
  }, [
    context,
    latestPublishConfig,
    publishTopics,
    renderer?.fixedFrameId,
    renderer?.publishClickTool,
  ]);

  const onClickPublish = useCallback(() => {
    if (publishActive) {
      renderer?.publishClickTool.stop();
    } else {
      renderer?.publishClickTool.start();
      renderer?.measurementTool.stopMeasuring();
    }
  }, [publishActive, renderer]);

  const onTogglePerspective = useCallback(() => {
    setConfig((prevConfig) => ({
      ...prevConfig,
      cameraState: { ...prevConfig.cameraState, perspective: !prevConfig.cameraState.perspective },
    }));
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "3") {
        onTogglePerspective();
        event.stopPropagation();
        event.preventDefault();
      }
    },
    [onTogglePerspective],
  );

  return (
    <ThemeProvider isDark={colorScheme === "dark"}>
      <div style={PANEL_STYLE} onKeyDown={onKeyDown}>
        <canvas
          ref={setCanvas}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            ...((measureActive || publishActive) && { cursor: "crosshair" }),
          }}
        />
        <RendererContext.Provider value={renderer}>
          <RendererOverlay
            canvas={canvas}
            addPanel={addPanel}
            enableStats={config.scene.enableStats ?? false}
            perspective={config.cameraState.perspective}
            onTogglePerspective={onTogglePerspective}
            measureActive={measureActive}
            onClickMeasure={onClickMeasure}
            canPublish={context.publish != undefined}
            publishActive={publishActive}
            onClickPublish={onClickPublish}
            publishClickType={renderer?.publishClickTool.publishClickType ?? "point"}
            onChangePublishClickType={(type) => {
              renderer?.publishClickTool.setPublishClickType(type);
              renderer?.publishClickTool.start();
            }}
          />
        </RendererContext.Provider>
      </div>
    </ThemeProvider>
  );
}
