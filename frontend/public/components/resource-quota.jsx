import * as _ from 'lodash-es';
import * as React from 'react';

import { ColHead, DetailsPage, List, ListHeader, MultiListPage } from './factory';
import { Cog, SectionHeading, navFactory, ResourceCog, ResourceLink, ResourceSummary } from './utils';
import { FLAGS, connectToFlags, flagPending } from '../features';
import { LoadingBox } from './utils/status-box';
import { referenceForModel } from '../module/k8s';
import { AppliedClusterResourceQuotaModel, ClusterResourceQuotaModel, ResourceQuotaModel } from '../models';

const menuActions = [Cog.factory.ModifyLabels, Cog.factory.ModifyAnnotations, Cog.factory.Edit, Cog.factory.Delete];

const resourceQuotaReference = referenceForModel(ResourceQuotaModel);
const clusterQuotaReference = referenceForModel(ClusterResourceQuotaModel);
const appliedClusterQuotaReference = referenceForModel(AppliedClusterResourceQuotaModel);

const quotaKind = (quota, canListClusterQuota) => {
  if (quota.metadata.namespace) {
    return resourceQuotaReference;
  }

  // We all
  return canListClusterQuota ? clusterQuotaReference : appliedClusterQuotaReference;
};

const Header = props => <ListHeader>
  <ColHead {...props} className="col-md-5 col-xs-6" sortField="metadata.name">Name</ColHead>
  <ColHead {...props} className="col-md-7 col-xs-6" sortField="metadata.namespace">Namespace</ColHead>
</ListHeader>;

const Row_ = ({obj: rq, flags}) => {
  const kind = quotaKind(rq, flags[FLAGS.CAN_LIST_CLUSTER_QUOTA]);
  return <div className="row co-resource-list__item">
    <div className="col-md-5 col-xs-6 co-resource-link-wrapper">
      <ResourceCog actions={menuActions} kind={kind} resource={rq} />
      <ResourceLink kind={kind} name={rq.metadata.name} namespace={rq.metadata.namespace} className="co-resource-link__resource-name" />
    </div>
    <div className="col-md-7 col-xs-6 co-break-word">
      {rq.metadata.namespace ? <ResourceLink kind="Namespace" name={rq.metadata.namespace} title={rq.metadata.namespace} /> : 'all'}
    </div>
  </div>;
};
const Row = connectToFlags(FLAGS.CAN_LIST_CLUSTER_QUOTA)(Row_);

const Details = ({obj: rq}) => <React.Fragment>
  <div className="co-m-pane__body">
    <SectionHeading text="Resource Quota Overview" />
    <ResourceSummary resource={rq} podSelector="spec.podSelector" showNodeSelector={false} />
  </div>
</React.Fragment>;

export const ResourceQuotasList = props => <List {...props} Header={Header} Row={Row} />;

export const quotaType = quota => {
  if (!quota) {
    return undefined;
  }
  return quota.metadata.namespace ? 'namespace' : 'cluster';
};

// Split each resource quota into one row per subject
export const flatten = resources => _.flatMap(resources, resource => _.compact(resource.data));

export const ResourceQuotasPage = connectToFlags(FLAGS.OPENSHIFT, FLAGS.CAN_LIST_CLUSTER_QUOTA)(({namespace, flags}) => {
  if (flagPending(flags[FLAGS.OPENSHIFT]) || flagPending(flags[FLAGS.CAN_LIST_CLUSTER_QUOTA])) {
    return <LoadingBox />;
  }

  let resources = [{kind: 'ResourceQuota', namespaced: true}];
  let rowFilters = null;
  if (flags[FLAGS.OPENSHIFT]) {
    if (flags[FLAGS.CAN_LIST_CLUSTER_QUOTA]) {
      resources.push({kind: 'ClusterResourceQuota', namespaced: false});
    } else {
      resources.push({kind: 'AppliedClusterResourceQuota', namespaced: true});
    }
    rowFilters = [{
      type: 'role-kind',
      selected: ['cluster', 'namespace'],
      reducer: quotaType,
      items: [
        {id: 'cluster', title: 'Cluster-wide Resource Quotas'},
        {id: 'namespace', title: 'Namespace Resource Quotas'},
      ]
    }];
  }
  return <MultiListPage
    canCreate={true}
    createButtonText="Create Resource Quota"
    createProps={{to: `/k8s/ns/${namespace || 'default'}/resourcequotas/new`}}
    ListComponent={ResourceQuotasList}
    resources={resources}
    filterLabel="Resource Quotas by name"
    label="Resource Quotas"
    namespace={namespace}
    flatten={flatten}
    title="Resource Quotas"
    rowFilters={rowFilters}
  />;
});

export const ResourceQuotasDetailsPage = props => <DetailsPage
  {...props}
  menuActions={menuActions}
  pages={[navFactory.details(Details), navFactory.editYaml()]}
/>;
