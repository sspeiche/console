import * as _ from 'lodash-es';
import * as classnames from 'classnames';
import * as fuzzy from 'fuzzysearch';
import * as PropTypes from 'prop-types';
import * as React from 'react';
import { connect } from 'react-redux';
import { CSSTransition } from 'react-transition-group';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Toolbar } from 'patternfly-react';

import store from '../redux';
import { ALL_NAMESPACES_KEY } from '../const';
import { LabelSelector } from '../module/k8s';
import { UIActions } from '../ui/ui-actions';
import {
  DaemonSetModel,
  DeploymentModel,
  DeploymentConfigModel,
  ReplicationControllerModel,
  ReplicaSetModel,
  StatefulSetModel
} from '../models';

import { ProjectOverview } from './project-overview';
import { ResourceOverviewPage } from './resource-list';
import { StartGuide } from './start-guide';
import { TextFilter } from './factory';
import {
  CloseButton,
  Disabled,
  Dropdown,
  Firehose,
  MsgBox,
  StatusBox,
} from './utils';

// Should not be a valid label value to avoid conflicts.
// https://kubernetes.io/docs/concepts/overview/working-with-objects/labels/#syntax-and-character-set
const EMPTY_GROUP_LABEL = 'other resources';
const DEPLOYMENT_REVISION_ANNOTATION = 'deployment.kubernetes.io/revision';
const DEPLOYMENT_CONFIG_LATEST_VERSION_ANNOTATION = 'openshift.io/deployment-config.latest-version';

const getDeploymentRevision = obj => {
  const revision = _.get(obj, ['metadata', 'annotations', DEPLOYMENT_REVISION_ANNOTATION]);
  return revision && parseInt(revision, 10);
};

const getDeploymentConfigVersion = obj => {
  const version = _.get(obj, ['metadata', 'annotations', DEPLOYMENT_CONFIG_LATEST_VERSION_ANNOTATION]);
  return version && parseInt(version, 10);
};

const getDeploymentPhase = rc => _.get(rc, ['metadata', 'annotations', 'openshift.io/deployment.phase']);

// Only show an alert once if multiple pods have the same error for the same owner.
const podAlertKey = (alert, pod, containerName = 'all') => {
  const id = _.get(pod, 'metadata.ownerReferences[0].uid', pod.metadata.uid);
  return `${alert}--${id}--${containerName}`;
};

const getPodAlerts = pod => {
  const alerts = {};
  const statuses = [
    ..._.get(pod, 'status.initContainerStatuses', []),
    ..._.get(pod, 'status.containerStatuses', []),
  ];
  statuses.forEach(status => {
    const { name, state } = status;
    const waitingReason = _.get(state, 'waiting.reason');
    if (waitingReason === 'CrashLoopBackOff') {
      const key = podAlertKey(waitingReason, pod, name);
      alerts[key] = {
        severity: 'error',
        message: `Container ${name} is crash-looping.`,
      };
    }
  });

  _.get(pod, 'status.conditions', []).forEach(condition => {
    const { type, status, reason, message } = condition;
    if (type === 'PodScheduled' && status === 'False' && reason === 'Unschedulable') {
      const key = podAlertKey(reason, pod, name);
      alerts[key] = {
        severity: 'error',
        message: `${reason}: ${message}`,
      };
    }
  });

  return alerts;
};

const combinePodAlerts = pods => _.reduce(pods, (acc, pod) => ({
  ...acc,
  ...getPodAlerts(pod),
}), {});

const getReplicationControllerAlerts = rc => {
  const phase = getDeploymentPhase(rc);
  const version = getDeploymentConfigVersion(rc);
  const label = _.isFinite(version) ? `#${version}` : rc.metadata.name;
  const key = `${rc.metadata.uid}--Rollout${phase}`;
  switch (phase) {
    case 'Cancelled':
      return {
        [key]: {
          severity: 'info',
          message: `Rollout ${label} was cancelled.`,
        },
      };
    case 'Failed':
      return {
        [key]: {
          severity: 'error',
          message: `Rollout ${label} failed.`,
        },
      };
    default:
      return {};
  }
};

const getOwnedResources = ({metadata:{uid}}, resources) => {
  return _.filter(resources, ({metadata:{ownerReferences}}) => {
    return _.some(ownerReferences, {
      uid,
      controller: true
    });
  });
};

const sortByRevision = (replicators, getRevision, descending = true) => {
  const compare = (left, right) => {
    const leftVersion = getRevision(left);
    const rightVersion = getRevision(right);
    if (!_.isFinite(leftVersion) && !_.isFinite(rightVersion)) {
      const leftName = _.get(left, 'metadata.name', '');
      const rightName = _.get(right, 'metadata.name', '');
      if (descending) {
        return rightName.localeCompare(leftName);
      }
      return leftName.localeCompare(rightName);
    }

    if (!leftVersion) {
      return descending ? 1 : -1;
    }

    if (!rightVersion) {
      return descending ? -1 : 1;
    }

    if (descending) {
      return rightVersion - leftVersion;
    }

    return leftVersion - rightVersion;
  };

  return _.toArray(replicators).sort(compare);
};

const sortReplicaSetsByRevision = (replicaSets) => {
  return sortByRevision(replicaSets, getDeploymentRevision);
};

const sortReplicationControllersByRevision = (replicationControllers) => {
  return sortByRevision(replicationControllers, getDeploymentConfigVersion);
};

const OverviewHeading = ({disabled, groupOptions, handleFilterChange, handleGroupChange, selectedGroup, title}) => (
  <div className="co-m-nav-title co-m-nav-title--overview">
    {
      title &&
      <h1 className="co-m-pane__heading">
        <div className="co-m-pane__name">{title}</div>
      </h1>
    }
    <Toolbar className="overview-toolbar">
      <Toolbar.RightContent>
        {
          !_.isEmpty(groupOptions) &&
          <div className="form-group overview-toolbar__form-group">
            <label className="overview-toolbar__label">
              Group by label
            </label>
            <Dropdown
              className="overview-toolbar__dropdown"
              disabled={disabled}
              items={groupOptions}
              onChange={handleGroupChange}
              style={{display: 'inline-block'}}
              title={selectedGroup}
            />
          </div>
        }
        <div className="form-group overview-toolbar__form-group">
          <TextFilter
            autofocus={!disabled}
            disabled={disabled}
            label="Resources by name"
            onChange={handleFilterChange}
          />
        </div>
      </Toolbar.RightContent>
    </Toolbar>
  </div>
);

OverviewHeading.displayName = 'OverviewHeading';

OverviewHeading.propTypes = {
  disabled: PropTypes.bool,
  groupOptions: PropTypes.object,
  handleFilterChange: PropTypes.func,
  handleGroupChange: PropTypes.func,
  selectedGroup: PropTypes.string,
  title: PropTypes.string
};

OverviewHeading.defaultProps = {
  disabled: false,
  groupOptions: {},
  handleFilterChange: _.noop,
  handleGroupChange: _.noop,
  selectedGroup: ''
};

class OverviewDetails extends React.Component {
  constructor(props) {
    super(props);
    this.handleFilterChange = this.handleFilterChange.bind(this);
    this.handleGroupChange = this.handleGroupChange.bind(this);
    this.clearFilter = this.clearFilter.bind(this);

    this.state = {
      filterValue: '',
      items: props.items,
      filteredItems: [],
      groupedItems: [],
      groupOptions: {},
      selectedGroupLabel: ''
    };
  }

  componentDidUpdate(prevProps, prevState) {
    const {
      daemonSets,
      deployments,
      deploymentConfigs,
      loaded,
      namespace,
      pods,
      replicaSets,
      replicationControllers,
      routes,
      services,
      statefulSets
    } = this.props;
    const {filterValue, selectedGroupLabel} = this.state;

    if (!_.isEqual(namespace, prevProps.namespace)
      || loaded !== prevProps.loaded
      || !_.isEqual(daemonSets, prevProps.daemonSets)
      || !_.isEqual(deploymentConfigs, prevProps.deploymentConfigs)
      || !_.isEqual(deployments, prevProps.deployments)
      || !_.isEqual(pods, prevProps.pods)
      || !_.isEqual(replicaSets, prevProps.replicaSets)
      || !_.isEqual(replicationControllers, prevProps.replicationControllers)
      || !_.isEqual(routes, prevProps.routes)
      || !_.isEqual(services, prevProps.services)
      || !_.isEqual(statefulSets, prevProps.statefulSets)) {
      this.createOverviewData();
    } else if (filterValue !== prevState.filterValue) {
      const filteredItems = this.filterItems(this.state.items);
      this.setState({
        filteredItems,
        groupedItems: this.groupItems(filteredItems, selectedGroupLabel)
      });
    } else if (selectedGroupLabel !== prevState.selectedGroupLabel) {
      this.setState({
        groupedItems: this.groupItems(this.state.filteredItems, selectedGroupLabel)
      });
    }
  }

  filterItems(items) {
    const {filterValue} = this.state;
    const {selectedItem} = this.props;

    if (!filterValue) {
      return items;
    }

    const filterString = filterValue.toLowerCase();
    return _.filter(items, item => {
      return fuzzy(filterString, _.get(item, 'obj.metadata.name', '')) || _.get(item, 'obj.metadata.uid') === _.get(selectedItem, 'obj.metadata.uid');
    });
  }

  groupItems(items, label) {
    const compareGroups = (a, b) => {
      if (a.name === EMPTY_GROUP_LABEL) {
        return 1;
      }
      if (b.name === EMPTY_GROUP_LABEL) {
        return -1;
      }
      return a.name.localeCompare(b.name);
    };

    if (!label) {
      return [{items}];
    }

    const groups = _.groupBy(items, item => _.get(item, ['obj', 'metadata', 'labels', label]) || EMPTY_GROUP_LABEL);
    return _.map(groups, (group, name) => {
      return {
        name,
        items: group
      };
    }).sort(compareGroups);
  }

  getGroupOptionsFromLabels(items) {
    const {groupOptions} = this.state;
    const labelKeys = _.flatMap(items, item => _.keys(_.get(item,'obj.metadata.labels', {})));
    return _.reduce(labelKeys, (accumulator, key) => {
      if (_.has(key, accumulator)) {
        return accumulator;
      }
      return {
        ...accumulator,
        [key]: key
      };
    }, groupOptions);
  }

  getPodsForResource(resource) {
    const {pods} = this.props;
    return getOwnedResources(resource, pods.data);
  }

  getRoutesForServices(services) {
    const {routes} = this.props;
    return _.filter(routes.data, route => {
      const name = _.get(route, 'spec.to.name');
      return _.some(services, {metadata: {name}});
    });
  }

  getServicesForResource(resource) {
    const {services} = this.props;
    const template = _.get(resource, 'spec.template');
    return _.filter(services.data, service => {
      const selector = new LabelSelector(_.get(service, 'spec.selector', {}));
      return selector.matches(template);
    });
  }

  toReplicationControllerItem(rc) {
    const pods = this.getPodsForResource(rc);
    const alerts = [
      ...combinePodAlerts(pods),
      ...getReplicationControllerAlerts(rc)
    ];
    const phase = getDeploymentPhase(rc);
    const revision = getDeploymentConfigVersion(rc);
    const obj = {
      ...rc,
      kind: ReplicationControllerModel.kind
    };
    return {
      alerts,
      obj,
      phase,
      pods,
      revision,
    };
  }

  getActiveReplicationControllers(resource) {
    const {replicationControllers} = this.props;
    const currentVersion = _.get(resource, 'status.latestVersion');
    const ownedRC = getOwnedResources(resource, replicationControllers.data);
    return _.filter(ownedRC, rc => _.get(rc, 'status.replicas') || getDeploymentConfigVersion(rc) === currentVersion);
  }

  getReplicationControllersForResource(resource) {
    const replicationControllers = this.getActiveReplicationControllers(resource);
    const rcItems = sortReplicationControllersByRevision(replicationControllers).map(rc => this.toReplicationControllerItem(rc));
    const current = _.first(rcItems);
    const previous = _.nth(rcItems, 1);
    const isRollingOut = current && previous && current.phase !== 'Cancelled' && current.phase !== 'Failed';

    return {
      current,
      previous,
      isRollingOut,
    };
  }

  toReplicaSetItem(rs) {
    const obj = {
      ...rs,
      kind: ReplicaSetModel.kind,
    };
    return {
      obj,
      pods: this.getPodsForResource(rs),
      revision: getDeploymentRevision(rs),
    };
  }

  getActiveReplicaSets(deployment) {
    const {replicaSets} = this.props;
    const currentRevision = getDeploymentRevision(deployment);
    const ownedRS = getOwnedResources(deployment, replicaSets.data);
    return _.filter(ownedRS, rs => _.get(rs, 'status.replicas') || getDeploymentRevision(rs) === currentRevision);
  }

  getReplicaSetsForResource(deployment) {
    const replicaSets = this.getActiveReplicaSets(deployment);
    const rsItems = sortReplicaSetsByRevision(replicaSets).map(rs => this.toReplicaSetItem(rs));
    const current = _.first(rsItems);
    const previous = _.nth(rsItems, 1);
    const isRollingOut = current && previous;
    return {
      current,
      previous,
      isRollingOut,
    };
  }

  createDaemonSetItems() {
    const {daemonSets} = this.props;
    return _.map(daemonSets.data, ds => {
      const services = this.getServicesForResource(ds);
      const routes = this.getRoutesForServices(services);
      const obj = {
        ...ds,
        kind: DaemonSetModel.kind
      };
      const readiness = {
        desired: ds.status.desiredNumberScheduled || 0,
        ready: ds.status.currentNumberScheduled || 0
      };

      return {
        obj,
        pods: this.getPodsForResource(ds),
        readiness,
        routes,
        services
      };
    });
  }

  createDeploymentItems() {
    const {deployments} = this.props;
    return _.map(deployments.data, d => {
      const {current, previous, isRollingOut} = this.getReplicaSetsForResource(d);
      const services = this.getServicesForResource(d);
      const routes = this.getRoutesForServices(services);
      const obj = {
        ...d,
        kind: DeploymentModel.kind
      };
      const readiness = {
        desired: d.spec.replicas || 0,
        ready: d.status.replicas || 0
      };

      return {
        current,
        isRollingOut,
        obj,
        previous,
        readiness,
        routes,
        services,
      };
    });
  }

  createDeploymentConfigItems() {
    const {deploymentConfigs} = this.props;
    return _.map(deploymentConfigs.data, dc => {
      const {current, previous, isRollingOut} = this.getReplicationControllersForResource(dc);
      const services = this.getServicesForResource(dc);
      const routes = this.getRoutesForServices(services);
      const obj = {
        ...dc,
        kind: DeploymentConfigModel.kind
      };
      const readiness = {
        desired: dc.spec.replicas || 0,
        ready: dc.status.replicas || 0
      };

      return {
        current,
        isRollingOut,
        obj,
        previous,
        readiness,
        routes,
        services,
      };
    });
  }

  createStatefulSetItems() {
    const {statefulSets} = this.props;
    return _.map(statefulSets.data, (ss) => {
      const obj = {
        ...ss,
        kind: StatefulSetModel.kind
      };
      const readiness = {
        desired: ss.spec.replicas || 0,
        ready: ss.status.replicas || 0
      };

      return {
        obj,
        pods: this.getPodsForResource(ss),
        readiness,
      };
    });
  }

  createOverviewData() {
    const {loaded} = this.props;

    if (!loaded) {
      return;
    }

    const items = [
      ...this.createDaemonSetItems(),
      ...this.createDeploymentItems(),
      ...this.createDeploymentConfigItems(),
      ...this.createStatefulSetItems()
    ];

    store.dispatch(UIActions.updateOverviewResources(items));

    const filteredItems = this.filterItems(items);
    const groupOptions = this.getGroupOptionsFromLabels(filteredItems);
    const selectedGroupLabel = _.has(groupOptions, 'app') ? 'app' : _.head(_.keys(groupOptions));
    const groupedItems = this.groupItems(filteredItems, selectedGroupLabel);
    this.setState({
      filteredItems,
      groupedItems,
      groupOptions,
      items,
      selectedGroupLabel
    });
  }

  handleFilterChange(event) {
    this.setState({filterValue: event.target.value});
  }

  handleGroupChange(selectedGroupLabel) {
    this.setState({selectedGroupLabel});
  }

  clearFilter() {
    this.setState({filterValue: ''});
  }

  render() {
    const {loaded, loadError, title} = this.props;
    const {filteredItems, groupedItems, groupOptions, selectedGroupLabel} = this.state;
    return <div className="co-m-pane">
      <OverviewHeading
        groupOptions={groupOptions}
        handleFilterChange={this.handleFilterChange}
        handleGroupChange={this.handleGroupChange}
        selectedGroup={selectedGroupLabel}
        title={title}
      />
      <div className="co-m-pane__body">
        <StatusBox
          data={filteredItems}
          loaded={loaded}
          loadError={loadError}
          label="Resources"
        >
          <ProjectOverview groups={groupedItems} />
        </StatusBox>
      </div>
    </div>;
  }
}

OverviewDetails.displayName = 'OverviewDetails';

OverviewDetails.propTypes = {
  deploymentConfigs: PropTypes.object,
  deployments: PropTypes.object,
  loaded: PropTypes.bool,
  loadError: PropTypes.object,
  pods: PropTypes.object,
  replicationControllers: PropTypes.object,
  replicaSets: PropTypes.object,
  statefulSets: PropTypes.object,
};

const overviewStateToProps = ({UI}) => {
  const selectedUID = UI.getIn(['overview', 'selectedUID']);
  const resources = UI.getIn(['overview', 'resources']);
  if (_.isEmpty(selectedUID)) {
    return { selectedItem: {}};
  }
  return { selectedItem: resources.get(selectedUID) };
};

export const Overview = connect(overviewStateToProps)(({namespace, selectedItem, title}) => {
  const className = classnames('overview', {'overview--sidebar-shown': !_.isEmpty(selectedItem)});
  const resources = [
    {
      isList: true,
      kind: 'DaemonSet',
      namespace,
      prop: 'daemonSets'
    },
    {
      isList: true,
      kind: 'Deployment',
      namespace,
      prop: 'deployments'
    },
    {
      isList: true,
      kind: 'DeploymentConfig',
      namespace,
      prop: 'deploymentConfigs'
    },
    {
      isList: true,
      kind: 'Pod',
      namespace,
      prop: 'pods'
    },
    {
      isList: true,
      kind: 'ReplicaSet',
      namespace,
      prop: 'replicaSets'
    },
    {
      isList: true,
      kind: 'ReplicationController',
      namespace,
      prop: 'replicationControllers'
    },
    {
      isList: true,
      kind: 'Route',
      namespace,
      prop: 'routes'
    },
    {
      isList: true,
      kind: 'StatefulSet',
      namespace,
      prop: 'statefulSets'
    },
    {
      isList: true,
      kind: 'Service',
      namespace,
      prop: 'services'
    }
  ];

  if (_.isEmpty(namespace) || namespace === ALL_NAMESPACES_KEY) {
    return <div className="co-m-pane">
      <Disabled>
        <OverviewHeading disabled title={title} />
      </Disabled>
      <div className="co-m-pane__body">
        <MsgBox
          detail={<React.Fragment>
            Select a project from the dropdown above to see an overview of its workloads.
            To view the status of all projects in the cluster, go to the <Link to="/status">status page</Link>.
          </React.Fragment>}
          title="Select a Project"
        />
      </div>
    </div>;
  }

  return <div className={className}>
    <div className="overview__main-column">
      <div className="overview__main-column-section">
        <Firehose resources={resources} forceUpdate={true}>
          <OverviewDetails
            namespace={namespace}
            title={title}
          />
        </Firehose>
      </div>
    </div>
    {
      !_.isEmpty(selectedItem) &&
      <CSSTransition in appear timeout={1} classNames="overview__sidebar">
        <div className="overview__sidebar">
          <div className="overview__sidebar-dismiss clearfix">
            <CloseButton onClick={() => store.dispatch(UIActions.selectOverviewItem(''))} />
          </div>
          <ResourceOverviewPage
            kind={selectedItem.obj.kind}
            item={selectedItem}
          />
        </div>
      </CSSTransition>
    }
  </div>;
});

Overview.displayName = 'Overview';

Overview.propTypes = {
  namespace: PropTypes.string,
  selectedItem: PropTypes.object,
  title: PropTypes.string
};

export const OverviewPage = ({match}) => {
  const namespace = _.get(match, 'params.ns');
  const title = 'Overview';
  return <React.Fragment>
    <Helmet>
      <title>{title}</title>
    </Helmet>
    <StartGuide dismissible={true} style={{margin: 15}} />
    <Overview namespace={namespace} title={title} />
  </React.Fragment>;
};

OverviewPage.displayName = 'OverviewPage';

OverviewPage.propTypes = {
  match: PropTypes.object.isRequired
};
