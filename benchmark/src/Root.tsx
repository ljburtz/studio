// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo, useState } from "react";

import { App, IDataSourceFactory, ConsoleApi, AppSetting } from "@foxglove/studio-base";

import McapLocalBenchmarkDataSourceFactory from "./dataSources/McapLocalBenchmarkDataSourceFactory";
import { LAYOUTS } from "./layouts";
import { PredefinedLayoutStorage, MemoryAppConfiguration } from "./services";

export function Root(): JSX.Element {
  const [appConfiguration] = useState(
    () =>
      new MemoryAppConfiguration({
        defaults: {
          [AppSetting.LAUNCH_PREFERENCE]: "web",
        },
      }),
  );

  const dataSources: IDataSourceFactory[] = useMemo(() => {
    const sources = [new McapLocalBenchmarkDataSourceFactory()];

    return sources;
  }, []);

  const layoutStorage = useMemo(() => new PredefinedLayoutStorage(LAYOUTS), []);
  const [extensionLoaders] = useState(() => []);
  const consoleApi = useMemo(() => new ConsoleApi(process.env.FOXGLOVE_API_URL!), []);

  // Enable dialog auth in development since using cookie auth does not work between
  // localhost and the hosted dev deployment due to browser cookie/host security.
  const enableDialogAuth = process.env.NODE_ENV === "development";

  return (
    <App
      enableDialogAuth={enableDialogAuth}
      enableLaunchPreferenceScreen
      deepLinks={[window.location.href]}
      dataSources={dataSources}
      appConfiguration={appConfiguration}
      layoutStorage={layoutStorage}
      consoleApi={consoleApi}
      extensionLoaders={extensionLoaders}
    />
  );
}
