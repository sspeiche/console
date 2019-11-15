import { EventKind } from '@console/internal/module/k8s';

export const getCount = (event: EventKind): number => {
  const { deprecatedCount, series } = event;
  return series ? series.count : deprecatedCount;
};

export const getLastTime = (event: EventKind): string => {
  const { deprecatedLastTimestamp, eventTime, series } = event;
  return series ? series.lastObservedTime : deprecatedLastTimestamp || eventTime;
};

export const getReportingController = (event: EventKind): string => {
  const { reportingController, deprecatedSource = {} } = event;
  return reportingController || deprecatedSource.component;
};

export const getReportingInstance = (event: EventKind): string => {
  const { reportingInstance, deprecatedSource = {} } = event;
  return reportingInstance || deprecatedSource.host;
};
