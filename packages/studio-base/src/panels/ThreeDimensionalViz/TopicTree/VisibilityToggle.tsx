// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import BlockIcon from "@mui/icons-material/Block";
import { IconButton, SvgIcon, Theme } from "@mui/material";
import { makeStyles } from "@mui/styles";
import cx from "classnames";
import { MouseEvent, KeyboardEvent, useCallback } from "react";

import { Color } from "@foxglove/regl-worldview";
import { defaultedRGBStringFromColorObj } from "@foxglove/studio-base/util/colorUtils";

const useStyles = makeStyles((theme: Theme) => ({
  unavailable: {
    cursor: "not-allowed",
  },
  button: ({ overrideRGB }: StyleProps) => ({
    fontSize: `10px !important`,
    color: `${theme.palette.text.secondary} !important`,
    position: "relative",

    "&.Mui-focusVisible": {
      backgroundColor: theme.palette.text.secondary,
      color: theme.palette.info.main,
    },
    "&:hover, &.Mui-focusVisible": {
      backgroundColor: "transparent",

      "& circle": {
        stroke: overrideRGB ?? theme.palette.info.main,
        strokeWidth: 5,
      },
      "& .MuiTouchRipple-child": {
        backgroundColor: theme.palette.action.focus,
      },
    },
  }),
  circle: ({ checked, overrideRGB, visibleInScene }: StyleProps) => ({
    color: overrideRGB ?? "currentcolor",
    stroke: "currentcolor",
    strokeWidth: 2,
    fill: "currentcolor",
    fillOpacity: checked ? (visibleInScene ? 1 : theme.palette.action.disabledOpacity) : 0,
  }),
}));

type VisibilityToggleProps = {
  available: boolean;
  checked: boolean;
  dataTest?: string;
  onAltToggle?: () => void;
  onShiftToggle?: () => void;
  onToggle: () => void;
  onMouseEnter?: (arg0: React.MouseEvent) => void;
  onMouseLeave?: (arg0: React.MouseEvent) => void;
  overrideColor?: Color;
  visibleInScene: boolean;
};

type StyleProps = {
  checked: boolean;
  overrideRGB?: string;
  visibleInScene: boolean;
};

// A toggle component that supports using tab key to focus and using space key to check/uncheck.
export default function VisibilityToggle(props: VisibilityToggleProps): JSX.Element {
  const {
    available,
    checked,
    dataTest,
    onAltToggle,
    onShiftToggle,
    onToggle,
    overrideColor,
    visibleInScene,
    onMouseEnter,
    onMouseLeave,
  } = props;
  const overrideRGB = overrideColor ? defaultedRGBStringFromColorObj(overrideColor) : undefined;

  const classes = useStyles({
    checked,
    overrideRGB,
    visibleInScene,
  });

  // Handle shift + click/enter, option + click/enter, and click/enter.
  const onChange = useCallback(
    (event: MouseEvent | KeyboardEvent) => {
      if (onShiftToggle && event.shiftKey) {
        onShiftToggle();
      } else if (onAltToggle && event.altKey) {
        onAltToggle();
      } else {
        onToggle();
      }
    },
    [onAltToggle, onShiftToggle, onToggle],
  );

  return (
    <IconButton
      size="small"
      className={cx(classes.button, {
        [classes.unavailable]: !available,
      })}
      disabled={!available}
      data-test={dataTest}
      title={!available ? "Unavailable" : "Toggle visibility"}
      tabIndex={0}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === "Enter") {
          onChange(event);
        }
      }}
      onClick={onChange}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {available ? (
        <SvgIcon fontSize="inherit">
          <circle className={classes.circle} cx={12} cy={12} r={10} />
        </SvgIcon>
      ) : (
        <BlockIcon fontSize="inherit" />
      )}
    </IconButton>
  );
}
