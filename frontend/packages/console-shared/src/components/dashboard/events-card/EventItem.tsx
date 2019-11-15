import * as React from 'react';
import { getLastTime, RedExclamationCircleIcon } from '@console/shared';
import { categoryFilter } from '@console/internal/components/events';
import { EventComponentProps } from '@console/internal/components/utils/event-stream';
import { twentyFourHourTime } from '@console/internal/components/utils/datetime';

const EventItem: React.FC<EventComponentProps> = React.memo(({ event }) => {
  const { note, reason } = event;
  const isError = categoryFilter('error', { reason });
  const lastTime = getLastTime(event);
  return (
    <div className="co-events-card__item">
      <div className="co-recent-item__title">
        <div className="co-recent-item__title-timestamp text-secondary">
          {lastTime ? twentyFourHourTime(new Date(lastTime)) : '-'}
        </div>
        <div className="co-recent-item__title-message">
          {isError && (
            <RedExclamationCircleIcon className="co-dashboard-icon co-recent-item__icon--error" />
          )}
        </div>
      </div>
      <div className="co-dashboard-text--small co-events-card__item-message">{note}</div>
    </div>
  );
});

export default EventItem;
