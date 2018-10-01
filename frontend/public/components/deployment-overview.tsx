import * as React from 'react';
import { DeploymentPodCounts, ResourceOverviewHeading, ResourceSummary, LoadingInline } from './utils';
import { DeploymentDetailsList, menuActions } from './deployment';
import { DeploymentModel } from '../models';
import { } from './overview';

const DeploymentOverviewDetails = ({item: {obj: deployment}}) => {
  return <React.Fragment>
    <div className="resource-overview__pod-counts">
      <DeploymentPodCounts resource={deployment} resourceKind={DeploymentModel} />
    </div>
    <div className="resource-overview__summary">
      <ResourceSummary resource={deployment}>
        <dt>Status</dt>
        <dd>
          {
            deployment.status.availableReplicas === deployment.status.updatedReplicas
              ? 'Active'
              : <div>
                <span className="co-icon-space-r"><LoadingInline /></span> Updating
              </div>
          }
        </dd>
      </ResourceSummary>
    </div>
    <div className="resource-overview__details">
      <DeploymentDetailsList deployment={deployment} />
    </div>
  </React.Fragment>;
};

export const DeploymentOverviewPage = ({item}) =>
  <div className="overview__sidebar-pane resource-overview">
    <ResourceOverviewHeading
      actions={menuActions}
      kindObj={DeploymentModel}
      resource={item.obj}
    />
    <div className="overview__sidebar-pane-body resource-overview__body">
      <DeploymentOverviewDetails item={item} />
    </div>
  </div>;
