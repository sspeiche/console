import * as React from 'react';
import * as classNames from 'classnames';
import * as _ from 'lodash-es';

const Tab = ({active, onClick, title}) => {
  const className = classNames('co-m-horizontal-nav__menu-item', {'co-m-horizontal-nav-item--active': active});
  return <li className={className}>
    <a href="#" onClick={(e)=>onClick(e, title)}>{title}</a>
  </li>;
};

export class RoutelessTabs extends React.PureComponent {
  constructor(props) {
    super(props);
    this.onClickTab = this.onClickTab.bind(this);
  }

  onClickTab(e, tab) {
    e.preventDefault();
    this.props.onClickTab(tab);
  }

  render() {
    const {active, tabs} = this.props;
    return <div className="co-m-horizontal-nav">
      <ul className="co-m-horizontal-nav__menu">
        {
          _.map(tabs, (tab) => (
            <Tab
              active={active === tab}
              key={tab}
              onClick={this.onClickTab}
              title={tab}
            />
          ))
        }
      </ul>
    </div>;
  }
}
