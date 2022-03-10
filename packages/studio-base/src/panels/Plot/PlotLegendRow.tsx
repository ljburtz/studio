// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useTheme as useFluentUITheme } from "@fluentui/react";
import {
  Close as CloseIcon,
  Error as ErrorIcon,
  Remove as RemoveIcon,
  MoreVert as MoreVertIcon,
} from "@mui/icons-material";
import { IconButton, Theme, Tooltip, Typography, useTheme } from "@mui/material";
import { createStyles, makeStyles } from "@mui/styles";
import { useCallback, useState } from "react";

import MessagePathInput from "@foxglove/studio-base/components/MessagePathSyntax/MessagePathInput";
import { getLineColor } from "@foxglove/studio-base/util/plotColors";

import PathSettingsModal from "./PathSettingsModal";
import { PlotPath, isReferenceLinePlotPathType } from "./internalTypes";
import { plotableRosTypes, PlotXAxisVal } from "./types";

type PlotLegendRowProps = {
  index: number;
  xAxisVal: PlotXAxisVal;
  path: PlotPath;
  value?: number;
  hasMismatchedDataLength: boolean;
};

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      display: "contents",

      "&:hover, &:focus-within": {
        "& .MuiIconButton-root": {
          backgroundColor: theme.palette.action.hover,
        },
        "& > *:last-child": {
          opacity: 1,
        },
        "& > *": {
          backgroundColor: theme.palette.action.hover,
        },
      },
    },
    listIcon: {
      padding: theme.spacing(0.25),
      position: "sticky",
      left: 0,
      // creates an opaque background for the sticky element
      backgroundImage: `linear-gradient(${theme.palette.background.paper}, ${theme.palette.background.paper})`,
      backgroundBlendMode: "overlay",
    },
    legendIconButton: {
      padding: `${theme.spacing(0.125)} !important`,
      marginLeft: theme.spacing(0.25),
    },
    inputWrapper: {
      display: "flex",
      alignItems: "center",
      padding: theme.spacing(0.25),
    },
    plotValue: {
      display: "flex",
      alignItems: "center",
      justifyContent: "right",
      padding: theme.spacing(0.25),
    },
    actionButton: {
      padding: `${theme.spacing(0.25)} !important`,
      color: theme.palette.text.secondary,

      "&:hover": {
        color: theme.palette.text.primary,
      },
    },
    actions: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      padding: theme.spacing(0.25),
      gap: theme.spacing(0.25),
      position: "sticky",
      right: 0,
      opacity: 0,
      // creates an opaque background for the sticky element
      backgroundImage: `linear-gradient(${theme.palette.background.paper}, ${theme.palette.background.paper})`,
      backgroundBlendMode: "overlay",

      "&:hover": {
        opacity: 1,
      },
    },
  }),
);

export default function PlotLegendRow({
  index,
  xAxisVal,
  path,
  value,
  hasMismatchedDataLength,
}: PlotLegendRowProps): JSX.Element {
  // const fluentUITheme = useFluentUITheme();
  const theme = useTheme();

  /*
  const currentDisplay = useMemo(() => {
    if (value == undefined) {
      return {
        value: undefined,
        color: "inherit",
      };
    }
    const timeToCompare = hoverValue?.value ?? currentTime;

    let value;
    for (const pt of correspondingData) {
      if (timeToCompare == undefined || pt == undefined || pt.x > timeToCompare) {
        break;
      }
      value = pt.y;
    }
    return {
      value,
      color: hoverValue?.value != undefined ? fluentUITheme.palette.yellowDark : "inherit",
    };
  }, [
    hoverValue?.value,
    currentTime,
    fluentUITheme.palette.yellowDark,
    correspondingData,
  ]);
  */

  const legendIconColor = path.enabled
    ? getLineColor(path.color, index)
    : theme.palette.text.secondary;

  const classes = useStyles();

  const isReferenceLinePlotPath = isReferenceLinePlotPathType(path);

  const onInputChange = useCallback((inputValue: string, idx?: number) => {
    console.log("input change", value, idx);
    /*
      if (idx == undefined) {
        throw new Error("index not set");
      }
      const newPaths = paths.slice();
      const newPath = newPaths[idx];
      if (newPath) {
        newPaths[idx] = { ...newPath, value: inputValue.trim() };
      }
      saveConfig({ paths: newPaths });
      */
  }, []);

  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  return (
    <div className={classes.root}>
      <div style={{ position: "absolute" }}>
        {settingsModalOpen && (
          <PathSettingsModal
            xAxisVal={xAxisVal}
            path={path}
            index={index}
            onDismiss={() => setSettingsModalOpen(false)}
          />
        )}
      </div>
      <div className={classes.listIcon}>
        <IconButton
          className={classes.legendIconButton}
          centerRipple={false}
          size="small"
          title="Toggle visibility"
          onClick={() => {
            /*
            const newPaths = paths.slice();
            const newPath = newPaths[index];
            if (newPath) {
              newPaths[index] = { ...newPath, enabled: !newPath.enabled };
            }
            saveConfig({ paths: newPaths });
            */
          }}
        >
          <RemoveIcon style={{ color: legendIconColor }} color="inherit" />
        </IconButton>
      </div>
      <div className={classes.inputWrapper}>
        <MessagePathInput
          supportsMathModifiers
          path={path.value}
          onChange={onInputChange}
          validTypes={plotableRosTypes}
          placeholder="Enter a topic name or a number"
          index={index}
          autoSize
          disableAutocomplete={isReferenceLinePlotPath}
          inputStyle={{ textDecoration: !path.enabled ? "line-through" : undefined }}
        />
        {hasMismatchedDataLength && (
          <Tooltip
            placement="top"
            title="Mismatch in the number of elements in x-axis and y-axis messages"
          >
            <ErrorIcon fontSize="small" color="error" />
          </Tooltip>
        )}
      </div>
      {value != undefined && (
        <div className={classes.plotValue}>
          <Typography component="div" variant="body2" align="right" color="inherit">
            {value}
          </Typography>
        </div>
      )}
      {value == undefined && <div></div>}
      <div className={classes.actions}>
        <IconButton
          className={classes.actionButton}
          size="small"
          title="Edit settings"
          onClick={() => setSettingsModalOpen(true)}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
        <IconButton
          className={classes.actionButton}
          size="small"
          title={`Remove ${path.value}`}
          onClick={() => {
            /*
            const newPaths = paths.slice();
            newPaths.splice(index, 1);
            saveConfig({ paths: newPaths });
            */
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </div>
    </div>
  );
}
