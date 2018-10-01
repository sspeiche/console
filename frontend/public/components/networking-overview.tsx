import * as React from 'react';
import * as _ from 'lodash-es';
import { Icon, ListGroup, ListGroupItem } from 'patternfly-react';

import { K8sResourceKind } from '../module/k8s';
import { ResourceLink } from './utils';
import { RouteLocation } from './routes';

export const ServicePortList: React.SFC<ServicePortListProps> = ({service}) => {
  const ports = _.get(service, 'spec.ports', []);
  return <ul className="port-list">
    {
      _.map(ports, ({name, port, protocol, targetPort}, i) =>
        <li key={port || i}>
          <span className="text-muted">{'Service port: '}</span> {name || `${protocol}/${port}`}
          &nbsp;<Icon type="fa" name="long-arrow-right" />&nbsp;
          <span className="text-muted">{'Pod Port: '}</span> {targetPort}
        </li>
      )
    }
  </ul>;
};

export const ServicesOverviewListItem: React.SFC<ServiceOverviewListItemProps> = ({service}) => {
  const {name, namespace} = service.metadata;
  const header = <ResourceLink kind="Service" name={name} namespace={namespace} />;
  return <ListGroupItem header={header}>
    <ServicePortList service={service} />
  </ListGroupItem>;
};

export const ServicesOverviewList: React.SFC<ServiceOverviewListProps> = ({services}) => (
  <ListGroup>
    {_.map(services, (service) => <ServicesOverviewListItem key={service.metadata.uid} service={service} />)}
  </ListGroup>
);

export const RoutesOverviewListItem: React.SFC<RoutesOverviewListItemProps> = ({route}) => {
  const {name, namespace} = route.metadata;
  const header = <ResourceLink kind="Route" name={name} namespace={namespace} />;
  return <ListGroupItem header={header}>
    <span className="text-muted">{'Location: '}</span><RouteLocation obj={route} />
  </ListGroupItem>;
};

export const RoutesOverviewList: React.SFC<RoutesOverviewListProps> = ({routes}) => <ListGroup>
  {_.map(routes, route => <RoutesOverviewListItem route={route} />)}
</ListGroup>;

export const NetworkingOverview: React.SFC<NetworkingOverviewProps> = ({routes, services}) => {
  return <dl>
    <dt>Internal Traffic</dt>
    <dd>
      {
        _.isEmpty(services)
          ? <span className="text-muted">No Services found for this resource.</span>
          : <ServicesOverviewList services={services} />
      }
    </dd>
    <dt>External Traffic</dt>
    <dd>
      {
        _.isEmpty(routes)
          ? <span className="text-muted">No Routes found for this resource.</span>
          : <RoutesOverviewList routes={routes} />
      }
    </dd>
  </dl>;
};

/* eslint-disable no-unused-vars, no-undef */
type RoutesOverviewListProps = {
  routes: K8sResourceKind[];
};

type RoutesOverviewListItemProps = {
  route: K8sResourceKind;
};

type NetworkingOverviewProps = {
  routes: K8sResourceKind[];
  services: K8sResourceKind[];
};

type ServicePortListProps = {
  service: K8sResourceKind;
};

type ServiceOverviewListProps = {
  services: K8sResourceKind[];
};

type ServiceOverviewListItemProps = {
  service: K8sResourceKind;
};
/* eslint-enable no-unused-vars, no-undef */
