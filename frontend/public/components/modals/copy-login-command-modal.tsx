/* eslint-disable no-unused-vars */

import * as React from 'react';

import { getSessionToken } from '../../co-fetch';
import {createModalLauncher, ModalComponentProps, ModalTitle, ModalBody, ModalFooter} from '../factory/modal';
import { CopyToClipboard } from '../utils';

const apiServerURL = window.SERVER_FLAGS.apiServer;

const copyOpenShiftLogin = () => {
  const token = getSessionToken();
  return `oc login ${apiServerURL} ${token ? `--token=${token}` : ''}`;
};

const CopyLoginCommandModal: React.SFC<ModalComponentProps> = ({cancel}) => {
  const token = getSessionToken();
  const loginCommand = `oc login ${apiServerURL} ${token ? `--token=${token}` : ''}`;
  return <div>
    <ModalTitle>Copy Login Command</ModalTitle>
    <ModalBody>
      <CopyToClipboard value={loginCommand} />
    </ModalBody>
    <ModalFooter inProgress={false} errorMessage=""><button type="button" onClick={(e) => cancel(e)} className="btn btn-default">OK</button></ModalFooter>
  </div>;
};

export const errorModal = createModalLauncher(CopyLoginCommandModal);

