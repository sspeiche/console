import * as React from 'react';
import * as _ from 'lodash-es';

import { DeploymentConfigModel } from '../models';
import { K8sResourceKind } from '../module/k8s';
import { DeploymentConfigDetailsList, menuActions } from './deployment-config';
import { NetworkingOverview } from './networking-overview';
import {
  DeploymentPodCounts,
  LoadingInline,
  ResourceOverviewHeading,
  ResourceSummary,
  RoutelessTabs,
  SectionHeading
} from './utils';

const DeploymentConfigOverviewDetails = ({item: {obj: dc}}) => {
  return <div className="overview__sidebar-pane-body resource-overview__body">
    <div className="resource-overview__pod-counts">
      <DeploymentPodCounts resource={dc} resourceKind={DeploymentConfigModel} />
    </div>
    <div className="resource-overview__summary">
      <ResourceSummary resource={dc}>
        <dt>Status</dt>
        <dd>
          {
            dc.status.availableReplicas === dc.status.updatedReplicas
              ? 'Active'
              : <div>
                <span className="co-icon-space-r"><LoadingInline /></span> Updating
              </div>
          }
        </dd>
      </ResourceSummary>
    </div>
    <div className="resource-overview__details">
      <DeploymentConfigDetailsList dc={dc} />
    </div>
  </div>;
};

const DeploymentConfigResources = ({item: {services, routes}}) => {
  return <div className="co-m-pane__body">
    <SectionHeading text="Networking" />
    <NetworkingOverview routes={routes} services={services} />
  </div>;
};

const tabs = {
  'Overview': DeploymentConfigOverviewDetails,
  'Resources': DeploymentConfigResources
};

export class DeploymentConfigOverviewPage extends React.Component<DeploymentConfigOverviewPageProps, DeploymentConfigOverviewPageState> {
  constructor(props) {
    super(props);
    this.onClickTab = this.onClickTab.bind(this);
    this.state = {
      activeTab: _.head(_.keys(tabs))
    };
  }

  componentDidUpdate(prevProps) {
    const {item} = this.props;
    if (!_.isEqual(item, prevProps.item)) {
      this.setState({activeTab: _.head(_.keys(tabs))});
    }
  }

  onClickTab(activeTab) {
    this.setState({activeTab});
  }

  render() {
    const {item} = this.props;
    const {activeTab} = this.state;
    const Content = _.get(tabs, activeTab);

    return <div className="overview__sidebar-pane resource-overview">
      <ResourceOverviewHeading
        actions={menuActions}
        kindObj={DeploymentConfigModel}
        resource={item.obj}
      />
      <RoutelessTabs tabs={_.keys(tabs)} active={activeTab} onClickTab={this.onClickTab} />
      <Content item={item} />
    </div>;
  }
}

/* eslint-disable no-unused-vars, no-undef */
type DeploymentConfigOverviewPageProps = {
  item: {
    obj: K8sResourceKind;
    services?: K8sResourceKind[];
    routes?: K8sResourceKind[];
  };
};

type DeploymentConfigOverviewPageState = {
  activeTab: string;
};
/* eslint-enable no-unused-vars, no-undef */
