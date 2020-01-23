import * as classNames from 'classnames';
import * as _ from 'lodash-es';
import * as React from 'react';
import { Helmet } from 'react-helmet';
import { connect } from 'react-redux';
import { Map as ImmutableMap } from 'immutable';

import Dashboard from '@console/shared/src/components/dashboard/Dashboard';
import DashboardCard from '@console/shared/src/components/dashboard/dashboard-card/DashboardCard';
import DashboardCardBody from '@console/shared/src/components/dashboard/dashboard-card/DashboardCardBody';
import DashboardCardHeader from '@console/shared/src/components/dashboard/dashboard-card/DashboardCardHeader';
import DashboardCardTitle from '@console/shared/src/components/dashboard/dashboard-card/DashboardCardTitle';

import * as UIActions from '../../../actions/ui';
import { coFetchJSON } from '../../../co-fetch';
import { ConfigMapModel } from '../../../models';
import { ConfigMapKind, k8sList } from '../../../module/k8s';
import { ErrorBoundaryFallback } from '../../error';
import { RootState } from '../../../redux';
import { getPrometheusURL, PrometheusEndpoint } from '../../graphs/helpers';
import { Dropdown, LoadError, useSafeFetch } from '../../utils';
import { setQueryArgument } from '../../utils/router';
import { parsePrometheusDuration } from '../../utils/datetime';
import { withFallback } from '../../utils/error-boundary';
import BarChart from './bar-chart';
import Graph from './graph';
import SingleStat from './single-stat';
import Table from './table';
import { GranafaDashboard, Panel, TemplateVariable } from './types';

const evaluateTemplate = (s: string, variables: VariablesMap) =>
  _.reduce(
    variables,
    (result: string, v: Variable, k: string): string => {
      return result.replace(new RegExp(`\\$${k}`, 'g'), v.value);
    },
    s,
  );

const VariableDropdown: React.FC<VariableDropdownProps> = ({
  buttonClassName,
  onChange,
  options,
  selected,
  title,
}) => (
  <div className="form-group monitoring-dashboards__dropdown-wrap">
    {title && <label>{title}</label>}
    <Dropdown
      buttonClassName={buttonClassName}
      items={_.zipObject(options, options)}
      onChange={onChange}
      selectedKey={selected}
    />
  </div>
);

const AllVariableDropdowns_: React.FC<AllVariableDropdownsProps> = ({
  patchVariable,
  variables,
}) => (
  <>
    {_.map(variables.toJS(), ({ options, value }, k) =>
      _.isEmpty(options) ? null : (
        <VariableDropdown
          key={k}
          onChange={(v: string) => patchVariable(k, { value: v })}
          options={options}
          selected={value}
          title={k}
        />
      ),
    )}
  </>
);
const AllVariableDropdowns = connect(
  ({ UI }: RootState) => ({
    variables: UI.getIn(['monitoringDashboards', 'variables']),
  }),
  { patchVariable: UIActions.monitoringDashboardsPatchVariable },
)(AllVariableDropdowns_);

const timespanOptions = ['5m', '15m', '30m', '1h', '2h', '6h', '12h', '1d', '2d', '1w', '2w'];
const defaultTimespan = '30m';

const pollOffText = 'Off';
const pollIntervalOptions = [pollOffText, '15s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'];
const defaultPollInterval = '30s';

// Matches Prometheus labels surrounded by {{ }} in the graph legend label templates
const legendTemplateOptions = { interpolate: /{{([a-zA-Z_][a-zA-Z0-9_]*)}}/g };

const Card_: React.FC<CardProps> = ({ panel, pollInterval, timespan, variables }) => {
  // If panel doesn't specify a span, default to 12
  const panelSpan: number = _.get(panel, 'span', 12);
  // If panel.span is greater than 12, default colSpan to 12
  const colSpan: number = panelSpan > 12 ? 12 : panelSpan;
  // If colSpan is less than 7, double it for small
  const colSpanSm: number = colSpan < 7 ? colSpan * 2 : colSpan;

  const formatLegendLabel = React.useCallback(
    (labels, i) => {
      const compiled = _.template(panel.targets?.[i]?.legendFormat, legendTemplateOptions);
      return compiled(labels);
    },
    [panel],
  );

  const rawQueries = _.map(panel.targets, 'expr');
  if (!rawQueries.length) {
    return null;
  }
  const queries = rawQueries.map((expr) => evaluateTemplate(expr, variables.toJS()));

  return (
    <div className={`col-xs-12 col-sm-${colSpanSm} col-lg-${colSpan}`}>
      <DashboardCard className="monitoring-dashboards__panel">
        <DashboardCardHeader className="monitoring-dashboards__card-header">
          <DashboardCardTitle>{panel.title}</DashboardCardTitle>
        </DashboardCardHeader>
        <DashboardCardBody
          className={classNames({
            'co-dashboard-card__body--dashboard-graph': panel.type === 'graph',
          })}
        >
          {panel.type === 'grafana-piechart-panel' && <BarChart query={queries[0]} />}
          {panel.type === 'graph' && (
            <Graph
              formatLegendLabel={panel.legend?.show ? formatLegendLabel : undefined}
              isStack={panel.stack}
              pollInterval={pollInterval}
              queries={queries}
              timespan={timespan}
            />
          )}
          {panel.type === 'row' && !_.isEmpty(panel.panels) && (
            <div className="row">
              {_.map(panel.panels, (p) => (
                <Card key={p.id} panel={p} pollInterval={pollInterval} timespan={timespan} />
              ))}
            </div>
          )}
          {panel.type === 'singlestat' && (
            <SingleStat
              decimals={panel.decimals}
              format={panel.format}
              pollInterval={pollInterval}
              postfix={panel.postfix}
              prefix={panel.prefix}
              query={queries[0]}
              units={panel.units}
            />
          )}
          {panel.type === 'table' && panel.transform === 'table' && (
            <Table panel={panel} pollInterval={pollInterval} queries={queries} />
          )}
        </DashboardCardBody>
      </DashboardCard>
    </div>
  );
};
const Card = connect(({ UI }: RootState) => ({
  variables: UI.getIn(['monitoringDashboards', 'variables']),
}))(Card_);

const Board: React.FC<BoardProps> = ({ board, patchVariable, pollInterval, timespan }) => {
  const safeFetch = React.useCallback(useSafeFetch(), []);

  const loadVariableValues = React.useCallback(
    (name: string, rawQuery: string) => {
      // Convert label_values queries to something Prometheus can handle
      const query = rawQuery.replace(/label_values\((.*), (.*)\)/, 'count($1) by ($2)');

      const url = getPrometheusURL({ endpoint: PrometheusEndpoint.QUERY, query });
      safeFetch(url).then((response) => {
        const result = _.get(response, 'data.result');
        const options = _.flatMap(result, ({ metric }) => _.values(metric)).sort();
        patchVariable(name, options.length ? { options, value: options[0] } : { value: '' });
      });
    },
    [patchVariable, safeFetch],
  );

  React.useEffect(() => {
    const newVars: TemplateVariable[] = board?.templating?.list || [];
    const optionsVars = newVars.filter(
      (v: TemplateVariable) => v.type === 'query' || v.type === 'interval',
    );
    optionsVars.forEach((v: TemplateVariable) => {
      if (v.options.length === 1) {
        patchVariable(v.name, { value: v.options[0].value });
      } else if (v.options.length > 1) {
        const options = _.map(v.options, 'value');
        const selected = _.find(v.options, { selected: true });
        const value = (selected || v.options[0]).value;
        patchVariable(v.name, { options, value });
      } else if (!_.isEmpty(v.query)) {
        loadVariableValues(v.name, v.query);
      }
    });
  }, [board, loadVariableValues, patchVariable]);

  if (!board) {
    return null;
  }

  const rows = _.isEmpty(board.rows) ? [{ panels: board.panels }] : board.rows;

  return (
    <>
      {_.map(rows, (row, i) => (
        <div className="row monitoring-dashboards__row" key={i}>
          {_.map(row.panels, (panel, j) => (
            <Card key={j} panel={panel} pollInterval={pollInterval} timespan={timespan} />
          ))}
        </div>
      ))}
    </>
  );
};

const MonitoringDashboardsPage_: React.FC<MonitoringDashboardsPageProps> = ({
  clearVariables,
  deleteAll,
  patchVariable,
}) => {
  // Clear queries on unmount
  React.useEffect(() => deleteAll, [deleteAll]);

  const [boards, setBoards] = React.useState<DashboardMap>({});
  const [loadError, setLoadError] = React.useState('');
  const [pollInterval, setPollInterval] = React.useState(
    parsePrometheusDuration(defaultPollInterval),
  );
  const [timespan, setTimespan] = React.useState(parsePrometheusDuration(defaultTimespan));

  React.useEffect(() => {
    const updateBoards = (items: ConfigMapKind[]) => {
      const updatedBoards: DashboardMap = (items || []).reduce(
        (acc: DashboardMap, item: ConfigMapKind) => {
          try {
            // Assumes the config map only has one value, which is the dashboard JSON.
            const data: DashboardDefinition = JSON.parse(Object.values(item.data)[0]);
            if (!data.title) {
              data.title = item.metadata.name;
            }
            acc[item.metadata.name] = data;
          } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Error parsing board JSON', e);
          }
          return acc;
        },
        {},
      );

      setBoards(updatedBoards);
    };

    coFetchJSON('/api/console/monitoring-dashboard-config')
      .then(({ items }: { items: ConfigMapKind[] }) => updateBoards(items))
      .catch(() =>
        k8sList(ConfigMapModel, {
          ns: 'openshift-config-managed',
          labelSelector: {
            'console.openshift.io/dashboard': 'true',
          },
        }).then(updateBoards),
      )
      .catch(({ message = 'An error occurred' }) => setLoadError(message));
  }, []);

  const orderedBoards = _.sortBy(
    _.map(boards, ({ title }: DashboardDefinition, key: string) => ({ title, key })),
    ({ title }: { title: string; key: string }) => title.toLowerCase(),
  );
  const sp = new URLSearchParams(window.location.search);
  const defaultBoard = orderedBoards?.[0]?.key;
  if (defaultBoard && !sp.has('board')) {
    setQueryArgument('board', defaultBoard);
  }
  const board = sp.get('board');
  const setBoard = (newBoard: string) => {
    if (newBoard !== board) {
      clearVariables();
      setQueryArgument('board', newBoard);
    }
  };

  if (loadError) {
    return (
      <LoadError
        message={loadError}
        label="Dashboards"
        className="loading-box loading-box__errored"
      />
    );
  }

  return (
    <>
      <Helmet>
        <title>Metrics Dashboards</title>
      </Helmet>
      <div className="co-m-nav-title co-m-nav-title--detail">
        <div className="monitoring-dashboards__options">
          <VariableDropdown
            buttonClassName="monitoring-dashboards__dropdown"
            onChange={(v: string) => setTimespan(parsePrometheusDuration(v))}
            options={timespanOptions}
            selected={defaultTimespan}
            title="Time Range"
          />
          <VariableDropdown
            onChange={(v: string) =>
              setPollInterval(v === pollOffText ? null : parsePrometheusDuration(v))
            }
            options={pollIntervalOptions}
            selected={defaultPollInterval}
            title="Refresh Interval"
          />
        </div>
        <h1 className="co-m-pane__heading">Dashboards</h1>
        <div className="monitoring-dashboards__variables">
          <div className="form-group monitoring-dashboards__dropdown-wrap">
            <label>Board Type</label>
            <Dropdown
              items={orderedBoards.reduce((acc, { key, title }) => {
                acc[key] = title;
                return acc;
              }, {})}
              onChange={setBoard}
              selectedKey={board}
            />
          </div>
          <AllVariableDropdowns />
        </div>
      </div>
      <Dashboard>
        <Board
          board={boards[board]}
          patchVariable={patchVariable}
          pollInterval={pollInterval}
          timespan={timespan}
        />
      </Dashboard>
    </>
  );
};
const MonitoringDashboardsPage = connect(null, {
  clearVariables: UIActions.monitoringDashboardsClearVariables,
  deleteAll: UIActions.queryBrowserDeleteAllQueries,
  patchVariable: UIActions.monitoringDashboardsPatchVariable,
})(MonitoringDashboardsPage_);

type DashboardMap = {
  [key: string]: DashboardDefinition;
};

type Variable = {
  options?: string[];
  value?: string;
};

type VariablesMap = { [key: string]: Variable };

type VariableDropdownProps = {
  buttonClassName?: string;
  onChange: (v: string) => void;
  options: string[];
  selected: string;
  title?: string;
};

type BoardProps = {
  board: DashboardDefinition;
  patchVariable: (key: string, patch: Variable) => undefined;
  pollInterval: null | number;
  timespan: number;
};

type AllVariableDropdownsProps = {
  patchVariable: (key: string, patch: Variable) => undefined;
  variables: ImmutableMap<string, Variable>;
};

type CardProps = {
  panel: Panel;
  pollInterval: null | number;
  timespan: number;
  variables: ImmutableMap<string, Variable>;
};

type MonitoringDashboardsPageProps = {
  clearVariables: () => undefined;
  deleteAll: () => undefined;
  patchVariable: (key: string, patch: Variable) => undefined;
};

export default withFallback(MonitoringDashboardsPage, ErrorBoundaryFallback);
