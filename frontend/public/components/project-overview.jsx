import * as React from 'react';
import * as _ from 'lodash-es';
import * as PropTypes from 'prop-types';
import * as classnames from 'classnames';
import { Link } from 'react-router-dom';
import { ListView } from 'patternfly-react';
import { connect } from 'react-redux';

import store from '../redux';
import { UIActions } from '../ui/ui-actions';
import { Tooltip } from './utils/tooltip';
import {
  pluralize,
  ResourceIcon,
  resourceObjPath,
  resourcePath
} from './utils';

const ControllerLink = ({controller}) => {
  const { obj, revision } = controller;
  const { name } = obj.metadata;
  const label = _.isFinite(revision) ? `#${revision}` : name;
  return <Link to={resourceObjPath(obj, obj.kind)} title={name}>{label}</Link>;
};

export const ComponentLabel = ({text}) => <div className="co-component-label">{text}</div>;

const Status = ({item}) => {
  const {isRollingOut, readiness, obj} = item;
  const {namespace, name} = obj.metadata;
  if (isRollingOut) {
    // TODO: Show pod status for previous and next revisions.
    return <div className="project-overview__detail project-overview__detail--status text-muted">
      Rollout in progress...
    </div>;
  }

  if (readiness) {
    return <div className="project-overview__detail project-overview__detail--status">
      <ComponentLabel text="Status" />
      <Link to={`${resourcePath(obj.kind, name, namespace)}/pods`}>
        {readiness.ready} of {readiness.desired} pods
      </Link>
    </div>;
  }

  return null;
};

const iconClassBySeverity = Object.freeze({
  error: 'pficon pficon-error-circle-o text-danger',
  info: 'pficon pficon-info',
  warning: 'pficon pficon-warning-triangle-o text-warning',
});

const alertLabelBySeverity = Object.freeze({
  error: 'Error',
  info: 'Message',
  warning: 'Warning',
});

const AlertTooltip = ({alerts, severity}) => {
  const iconClass = iconClassBySeverity[severity];
  const label = alertLabelBySeverity[severity];
  const count = _.size(alerts);
  const message = _.map(alerts, 'message').join('\n');
  const content = [<span key="message" className="co-pre-wrap">{message}</span>];
  return <Tooltip content={content}>
    <i className={iconClass} aria-hidden="true" /> {pluralize(count, label)}
  </Tooltip>;
};

const Alerts = ({item}) => {
  const currentAlerts = _.get(item, 'current.alerts', {});
  const previousAlerts = _.get(item, 'previous.alerts', {});
  const itemAlerts = _.get(item, 'alerts', {});
  const alerts ={
    ...itemAlerts,
    ...currentAlerts,
    ...previousAlerts,
  };
  if (_.isEmpty(alerts)) {
    return null;
  }

  const { error, warning, info } = _.groupBy(alerts, 'severity');
  return <div className="project-overview__detail project-overview__detail--alert">
    {error && <AlertTooltip severity="error" alerts={error} />}
    {warning && <AlertTooltip severity="warning" alerts={warning} />}
    {info && <AlertTooltip severity="info" alerts={info} />}
  </div>;
};

const ProjectOverviewListItem = ({item, selectedUID}) => {
  const {current, obj} = item;
  const {namespace, name, uid} = obj.metadata;
  const {kind} = obj;
  const isSelected = selectedUID === uid;
  const className = classnames('project-overview__item', {'project-overview__item--selected': isSelected});
  const heading = <h3 className="project-overview__item-heading">
    <span className="co-resource-link co-resource-link-truncate">
      <ResourceIcon kind={kind} />
      <Link to={resourcePath(kind, name, namespace)} className="co-resource-link__resource-name">
        {name}
      </Link>
      {current && <React.Fragment>,&nbsp;<ControllerLink controller={current} /></React.Fragment>}
    </span>
  </h3>;

  const additionalInfo = <div key={uid} className="project-overview__additional-info">
    <Alerts item={item} />
    <Status item={item} />
  </div>;
  return <ListView.Item
    onClick={() => store.dispatch(UIActions.selectOverviewItem(isSelected ? '' : uid))}
    className={className}
    heading={heading}
    additionalInfo={[additionalInfo]}
  />;
};

ProjectOverviewListItem.displayName = 'ProjectOverviewListItem';

ProjectOverviewListItem.propTypes = {
  item: PropTypes.shape({
    controller: PropTypes.object,
    obj: PropTypes.object.isRequired,
    readiness: PropTypes.object,
  }).isRequired
};

const ProjectOverviewList = ({items, selectedUID}) => {
  const listItems = _.map(items, (item) =>
    <ProjectOverviewListItem
      item={item}
      key={item.obj.metadata.uid}
      selectedUID={selectedUID}
    />
  );
  return <ListView className="project-overview__list">
    {listItems}
  </ListView>;
};

ProjectOverviewList.displayName = 'ProjectOverviewList';

ProjectOverviewList.propTypes = {
  items: PropTypes.array.isRequired
};

const ProjectOverviewGroup = ({heading, items, selectedUID}) =>
  <div className="project-overview__group">
    {heading && <h2 className="project-overview__group-heading">{heading}</h2>}
    <ProjectOverviewList items={items} selectedUID={selectedUID} />
  </div>;


ProjectOverviewGroup.displayName = 'ProjectOverviewGroup';

ProjectOverviewGroup.propTypes = {
  heading: PropTypes.string,
  items: PropTypes.array.isRequired
};

const stateToProps = ({UI}) => {
  return {selectedUID: UI.getIn(['overview', 'selectedUID'])};
};

export const ProjectOverview = connect(stateToProps)(({groups, selectedUID}) =>
  <div className="project-overview">
    {_.map(groups, ({name, items, index}) =>
      <ProjectOverviewGroup
        key={name || `_${index}`}
        heading={name}
        items={items}
        selectedUID={selectedUID}
      />
    )}
  </div>);

ProjectOverview.displayName = 'ProjectOverview';

ProjectOverview.propTypes = {
  groups: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      items: PropTypes.array.isRequired
    })
  )
};
