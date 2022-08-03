// example plotting several x/y coordinates on the 3D panel
// use case: robot trajectory (estimated vs ground truth etc)

import { Input, Point, Message, Pose, RGBA, Header } from "./types";
type Marker = Message<"visualization_msgs/Marker">;

export const inputs = [
  "/small_scout_1/rover_odometry_gt",
  "/small_scout_1/rover_odometry",
  "/small_scout_1/rover_odometry_naive",
];
export const output = "/small_scout_1/trajectory2dplot";

export function create_marker(
  position: Point,
  header: Header,
  ns: string,
  color: RGBA
): Marker {
  // Prepare Marker-specific attributes
  position.z = 0; // for just 2D 'plot'
  let scale_ = {
    x: 3,
    y: 3,
    z: 3,
  }; // size of the Points in the panel
  let default_pose_: Pose = {
    position: {
      x: 0,
      y: 0,
      z: 0,
    },
    orientation: {
      x: 0,
      y: 0,
      z: 0,
      w: 1,
    },
  }; // no offset compared to world frame
  let duration_ = {
    sec: 0,
    nsec: 0,
  }; // zero duration means Point is persistent forever

  // fill in marker message for display in 3D panel
  let marker: Marker = {
    header: {
      frame_id: "world",
      seq: header.seq,
      stamp: header.stamp,
    },
    ns: ns,
    id: header.seq,
    type: 8, // POINT
    action: 0, // ADD/MODIFY
    pose: default_pose_,
    scale: scale_,
    color: color,
    lifetime: duration_,
    frame_locked: false,
    points: [position],
    colors: [],
    text: "",
    mesh_resource: "",
    mesh_use_embedded_materials: false,
  };
  return marker;
}

export default function node(
  event:
    | Input<"/small_scout_1/rover_odometry_gt">
    | Input<"/small_scout_1/rover_odometry">
    | Input<"/small_scout_1/rover_odometry_naive">
): Marker | undefined {
  let namespace_: string;
  let color_: RGBA;
  let position: Point;

  //  Parse incoming topics, extract position and assign color / namespace
  if (event.topic === "/small_scout_1/rover_odometry_gt") {
    position = event.message.pose.position;
    namespace_ = "groundtruth";
    color_ = {
      r: 1,
      g: 165 / 255,
      b: 0,
      a: 0.7,
    }; // orange
  } else if (event.topic === "/small_scout_1/rover_odometry") {
    position = event.message.pose.pose.position;
    namespace_ = "rover_odometry";
    color_ = {
      r: 160 / 255,
      g: 32 / 255,
      b: 240 / 255,
      a: 0.7,
    }; // purple
  } else if (event.topic === "/small_scout_1/rover_odometry_naive") {
    position = event.message.pose.pose.position;
    namespace_ = "rover_odometry_naive";
    color_ = {
      r: 0,
      g: 128 / 255,
      b: 128 / 255,
      a: 0.7,
    }; // teal
  } else {
    log("unexpected topic name, skipping");
    return;
  }

  return create_marker(position, event.message.header, namespace_, color_);
}
