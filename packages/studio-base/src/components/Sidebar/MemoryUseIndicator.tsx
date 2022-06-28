// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Tooltip } from "@mui/material";
import { useEffect, useState } from "react";

import Logger from "@foxglove/log";

const log = Logger.getLogger(__filename);

type MemoryInfo = {
  /// Maximum heap size in bytes
  jsHeapSizeLimit: number;
  /// current size in bytes of the JS heap including free space not occupied by any JS objects
  totalJSHeapSize: number;
  /// total amount of memory in bytes being used by JS objects including V8 internal objects
  usedJSHeapSize: number;
};

interface Performance {
  memory?: MemoryInfo;
}

const performance = window.performance as Performance;

function MemoryUseIndicator(): JSX.Element {
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | undefined>(performance.memory);

  useEffect(() => {
    if (!performance.memory) {
      log.info("No memory information available");
      return;
    }

    const interval = setInterval(() => {
      setMemoryInfo(performance.memory);
    }, 5000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  // If we can't load memory info (maybe not supported) then we don't show any indicator
  if (!memoryInfo) {
    return <></>;
  }

  const totalPercent = (memoryInfo.totalJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100;
  const usedPercent = (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100;

  return (
    <Tooltip
      title={`Used Memory: ${memoryInfo.usedJSHeapSize.toLocaleString()} / ${memoryInfo.jsHeapSizeLimit.toLocaleString()}`}
    >
      <div
        style={{
          width: "100%",
          position: "relative",
          borderTop: "1px solid gray",
          borderBottom: "1px solid gray",
          fontSize: "11px",
          textAlign: "right",
        }}
      >
        <div
          style={{
            position: "absolute",
            backgroundClip: "green",
            height: "100%",
            width: `${totalPercent}%`,
          }}
        />
        <div
          style={{
            position: "absolute",
            backgroundColor: "red",
            height: "100%",
            width: `${usedPercent}%`,
          }}
        ></div>
        {usedPercent.toFixed(2)}%
      </div>
    </Tooltip>
  );
}

export { MemoryUseIndicator };
