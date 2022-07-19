// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo, useState, Suspense } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { useMedia } from "react-use";

import { IDataSourceFactory, AppSetting, ConsoleApi } from "@foxglove/studio-base";
import Workspace from "@foxglove/studio-base/Workspace";
import CssBaseline from "@foxglove/studio-base/components/CssBaseline";
import ErrorBoundary from "@foxglove/studio-base/components/ErrorBoundary";
import GlobalCss from "@foxglove/studio-base/components/GlobalCss";
import MultiProvider from "@foxglove/studio-base/components/MultiProvider";
import PlayerManager from "@foxglove/studio-base/components/PlayerManager";
import SendNotificationToastAdapter from "@foxglove/studio-base/components/SendNotificationToastAdapter";
import StudioToastProvider from "@foxglove/studio-base/components/StudioToastProvider";
import AnalyticsProvider from "@foxglove/studio-base/context/AnalyticsProvider";
import AppConfigurationContext from "@foxglove/studio-base/context/AppConfigurationContext";
import { AssetsProvider } from "@foxglove/studio-base/context/AssetsContext";
import ConsoleApiContext from "@foxglove/studio-base/context/ConsoleApiContext";
import { HoverValueProvider } from "@foxglove/studio-base/context/HoverValueContext";
import ModalHost from "@foxglove/studio-base/context/ModalHost";
import { UserNodeStateProvider } from "@foxglove/studio-base/context/UserNodeStateContext";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";
import CurrentLayoutProvider from "@foxglove/studio-base/providers/CurrentLayoutProvider";
import ExtensionCatalogProvider from "@foxglove/studio-base/providers/ExtensionCatalogProvider";
import ExtensionMarketplaceProvider from "@foxglove/studio-base/providers/ExtensionMarketplaceProvider";
import HelpInfoProvider from "@foxglove/studio-base/providers/HelpInfoProvider";
import LayoutManagerProvider from "@foxglove/studio-base/providers/LayoutManagerProvider";
import PanelCatalogProvider from "@foxglove/studio-base/providers/PanelCatalogProvider";
import ThemeProvider from "@foxglove/studio-base/theme/ThemeProvider";
import { makeMockAppConfiguration } from "@foxglove/studio-base/util/makeMockAppConfiguration";

import MemoryLayoutStorageProvider from "./providers/MemoryLayoutStorageProvider";
import MemoryUserProfileProvider from "./providers/MemoryUserProfileProvider";
import McapLocalBenchmarkDataSourceFactory from "./services/McapLocalBenchmarkDataSourceFactory";

function ColorSchemeThemeProvider({ children }: React.PropsWithChildren<unknown>): JSX.Element {
  const [colorScheme = "dark"] = useAppConfigurationValue<string>(AppSetting.COLOR_SCHEME);
  const systemSetting = useMedia("(prefers-color-scheme: dark)");
  const isDark = colorScheme === "dark" || (colorScheme === "system" && systemSetting);
  return <ThemeProvider isDark={isDark}>{children}</ThemeProvider>;
}

export function Root(): JSX.Element {
  const dataSources: IDataSourceFactory[] = useMemo(() => {
    return [new McapLocalBenchmarkDataSourceFactory()];
  }, []);

  const [appConfiguration] = useState(() =>
    makeMockAppConfiguration([
      [AppSetting.SHOW_OPEN_DIALOG_ON_STARTUP, false],
      [AppSetting.TELEMETRY_ENABLED, false],
      [AppSetting.UPDATES_ENABLED, false],
      [AppSetting.CRASH_REPORTING_ENABLED, false],
      [AppSetting.HIDE_SIGN_IN_PROMPT, true],
    ]),
  );

  const providers = [
    /* eslint-disable react/jsx-key */
    <ConsoleApiContext.Provider value={new ConsoleApi("")} />,
    <StudioToastProvider />,
    <MemoryLayoutStorageProvider />,
    <MemoryUserProfileProvider />,
    <AnalyticsProvider />,
    <LayoutManagerProvider />,
    <ModalHost />,
    <AssetsProvider loaders={[]} />,
    <HelpInfoProvider />,
    <HoverValueProvider />,
    <UserNodeStateProvider />,
    <CurrentLayoutProvider />,
    <ExtensionMarketplaceProvider />,
    <ExtensionCatalogProvider loaders={[]} />,
    <PlayerManager playerSources={dataSources} />,
    /* eslint-enable react/jsx-key */
  ];

  return (
    <AppConfigurationContext.Provider value={appConfiguration}>
      <ColorSchemeThemeProvider>
        <GlobalCss />
        <CssBaseline>
          <ErrorBoundary>
            <MultiProvider providers={providers}>
              <SendNotificationToastAdapter />
              <DndProvider backend={HTML5Backend}>
                <Suspense fallback={<></>}>
                  <PanelCatalogProvider>
                    <Workspace deepLinks={[window.location.href]} />
                  </PanelCatalogProvider>
                </Suspense>
              </DndProvider>
            </MultiProvider>
          </ErrorBoundary>
        </CssBaseline>
      </ColorSchemeThemeProvider>
    </AppConfigurationContext.Provider>
  );
}
