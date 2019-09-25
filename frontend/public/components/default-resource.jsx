import * as _ from 'lodash-es';
import * as React from 'react';
import * as classNames from 'classnames';
import { sortable } from '@patternfly/react-table';
import { DetailsPage, ListPage, Table, TableRow, TableData } from './factory';
import { fromNow } from './utils/datetime';
import { referenceFor, kindForReference } from '../module/k8s';
import {
  Kebab,
  kindObj,
  navFactory,
  ResourceKebab,
  ResourceLink,
  ResourceSummary,
  SectionHeading,
} from './utils';

const { common } = Kebab.factory;
const menuActions = [...Kebab.getExtensionsActionsForKind(), ...common];

const tableColumnClasses = [
  classNames('col-xs-6', 'col-sm-4'),
  classNames('col-xs-6', 'col-sm-4'),
  classNames('col-sm-4', 'hidden-xs'),
  Kebab.columnClass,
];

const TableHeader = (props) => {
  console.log(props);
  return [
    {
      title: 'Name', sortField: 'metadata.name', transforms: [sortable],
      props: { className: tableColumnClasses[0] },
    },
    {
      title: 'Namespace', sortField: 'metadata.namespace', transforms: [sortable],
      props: { className: tableColumnClasses[1] },
    },
    {
      title: 'Created', sortField: 'metadata.creationTimestamp', transforms: [sortable],
      props: { className: tableColumnClasses[2] },
    },
    {
      title: '', props: { className: tableColumnClasses[3] },
    },
  ];
};
TableHeader.displayName = 'TableHeader';

const TableRowForKind = ({obj: row, index, key, style, customData}) => {
  const { metadata } = row.object;
  const cells = _.take(row.cells, 4);
  const colWidth = _.floor(12 / (cells.length + 2));
  const colClass = `col-sm-${colWidth}`;
  return (
    <TableRow id={metadata.uid} index={index} trKey={key} style={style}>
      <TableData className={colClass}>
        <ResourceLink kind={customData.kind} name={metadata.name} namespace={metadata.namespace} title={metadata.name} />
      </TableData>
      <TableData className={colClass}>
        { metadata.namespace
          ? <ResourceLink kind="Namespace" name={metadata.namespace} title={metadata.namespace} />
          : 'None'
        }
      </TableData>
      {cells.map((cell, i) => <TableData key={i} className={colClass}>{cell}</TableData>)}
      <TableData className={Kebab.columnClass}>
        <ResourceKebab actions={menuActions} kind={referenceFor(row.object) || customData.kind} resource={row.object} />
      </TableData>
    </TableRow>
  );
};
TableRowForKind.displayName = 'TableRowForKind';

const DetailsForKind = kind => function DetailsForKind_({obj}) {
  return <React.Fragment>
    <div className="co-m-pane__body">
      <SectionHeading text={`${kindForReference(kind)} Overview`} />
      <ResourceSummary resource={obj} podSelector="spec.podSelector" showNodeSelector={false} />
    </div>
  </React.Fragment>;
};

export const DefaultList = props => {
  const { kinds } = props;

  return <Table {...props}
    aria-label="Default Resource"
    kinds={[kinds[0]]}
    customData={{kind: kinds[0]}}
    Header={TableHeader}
    Row={TableRowForKind}
    virtualize />;
};
DefaultList.displayName = DefaultList;

export const DefaultPage = props =>
  <ListPage {...props} ListComponent={DefaultList} asTable canCreate={props.canCreate || _.get(kindObj(props.kind), 'crd')} />;
DefaultPage.displayName = 'DefaultPage';


export const DefaultDetailsPage = props => {
  const pages = [navFactory.details(DetailsForKind(props.kind)), navFactory.editYaml()];
  return <DetailsPage {...props} menuActions={menuActions} pages={pages} />;
};
DefaultDetailsPage.displayName = 'DefaultDetailsPage';
