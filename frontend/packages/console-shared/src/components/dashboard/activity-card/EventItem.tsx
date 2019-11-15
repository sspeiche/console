import * as React from 'react';
import { AccordionContent, AccordionItem, AccordionToggle } from '@patternfly/react-core';
import classNames from 'classnames';
import { getLastTime, RedExclamationCircleIcon } from '@console/shared';
import { categoryFilter } from '@console/internal/components/events';
import { twentyFourHourTime } from '@console/internal/components/utils/datetime';
import { ResourceIcon } from '@console/internal/components/utils/resource-icon';
import { ResourceLink } from '@console/internal/components/utils/resource-link';
import { EventKind, referenceFor } from '@console/internal/module/k8s';

const propsAreEqual = (prevProps: EventItemProps, nextProps: EventItemProps) =>
  prevProps.event.metadata.uid === nextProps.event.metadata.uid &&
  getLastTime(prevProps.event) === getLastTime(nextProps.event) &&
  prevProps.isExpanded === nextProps.isExpanded &&
  prevProps.onToggle === nextProps.onToggle;

const EventItem: React.FC<EventItemProps> = React.memo(({ event, isExpanded, onToggle }) => {
  const { regarding, note, reason, metadata } = event;
  const isError = categoryFilter('error', { reason });
  const lastTime = getLastTime(event);
  const expanded = isExpanded(metadata.uid);
  return (
    <div className="co-recent-item__body">
      <AccordionItem>
        <AccordionToggle
          onClick={() => onToggle(metadata.uid)}
          isExpanded={expanded}
          id={metadata.uid}
          className={classNames('co-recent-item__toggle', {
            'co-recent-item--error': isError && expanded,
          })}
        >
          <div className="co-recent-item__title">
            <div className="co-recent-item__title-timestamp text-secondary">
              {lastTime ? twentyFourHourTime(new Date(lastTime)) : '-'}
            </div>
            <div className="co-recent-item__title-message">
              {isError && (
                <RedExclamationCircleIcon className="co-dashboard-icon co-recent-item__icon--error" />
              )}
              {!expanded && (
                <>
                  <ResourceIcon kind={regarding.kind} />
                  <div className="co-recent-item__title-message-text">{note}</div>
                </>
              )}
            </div>
          </div>
        </AccordionToggle>
        <AccordionContent
          isHidden={!expanded}
          className={classNames('co-recent-item__content', { 'co-recent-item--error': isError })}
        >
          <div>
            <div className="co-recent-item__content-header">
              <ResourceLink
                className="co-recent-item__content-resourcelink"
                kind={referenceFor(regarding)}
                namespace={regarding.namespace}
                name={regarding.name}
                title={regarding.uid}
              />
            </div>
            <div className="co-dashboard-text--small co-recent-item__content-message">{note}</div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </div>
  );
}, propsAreEqual);

export default EventItem;

type EventItemProps = {
  event: EventKind;
  isExpanded: (key: string) => boolean;
  onToggle: (key: string) => void;
};
