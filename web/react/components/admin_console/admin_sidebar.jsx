// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import AdminSidebarHeader from './admin_sidebar_header.jsx';
import SelectTeamModal from './select_team_modal.jsx';
import * as Utils from '../../utils/utils.jsx';

const Tooltip = ReactBootstrap.Tooltip;
const OverlayTrigger = ReactBootstrap.OverlayTrigger;

export default class AdminSidebar extends React.Component {
    constructor(props) {
        super(props);

        this.isSelected = this.isSelected.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.removeTeam = this.removeTeam.bind(this);

        this.showTeamSelect = this.showTeamSelect.bind(this);
        this.teamSelectedModal = this.teamSelectedModal.bind(this);
        this.teamSelectedModalDismissed = this.teamSelectedModalDismissed.bind(this);

        this.state = {
            showSelectModal: false
        };
    }

    handleClick(name, teamId, e) {
        e.preventDefault();
        this.props.selectTab(name, teamId);
        var tokenIndex = Utils.getUrlParameter('session_token_index');
        history.pushState({name, teamId}, null, `/admin_console/${name}/${teamId || ''}?session_token_index=${tokenIndex}`);
    }

    isSelected(name, teamId) {
        if (this.props.selected === name) {
            if (name === 'team_users' || name === 'team_analytics') {
                if (this.props.selectedTeam != null && this.props.selectedTeam === teamId) {
                    return 'active';
                }
            } else {
                return 'active';
            }
        }

        return '';
    }

    removeTeam(teamId, e) {
        e.preventDefault();
        Reflect.deleteProperty(this.props.selectedTeams, teamId);
        this.props.removeSelectedTeam(teamId);

        if (this.props.selected === 'team_users') {
            if (this.props.selectedTeam != null && this.props.selectedTeam === teamId) {
                this.props.selectTab('service_settings', null);
            }
        }
    }

    componentDidMount() {
        if ($(window).width() > 768) {
            $('.nav-pills__container').perfectScrollbar();
        }
    }

    showTeamSelect(e) {
        e.preventDefault();
        this.setState({showSelectModal: true});
    }

    teamSelectedModal(teamId) {
        this.props.selectedTeams[teamId] = 'true';
        this.setState({showSelectModal: false});
        this.props.addSelectedTeam(teamId);
        this.forceUpdate();
    }

    teamSelectedModalDismissed() {
        this.setState({showSelectModal: false});
    }

    render() {
        var count = '*';
        var teams = 'Loading';
        const removeTooltip = (
            <Tooltip id='remove-team-tooltip'>{'Remove team from sidebar menu'}</Tooltip>
        );
        const addTeamTooltip = (
            <Tooltip id='add-team-tooltip'>{'Add team from sidebar menu'}</Tooltip>
        );

        if (this.props.teams != null) {
            count = '' + Object.keys(this.props.teams).length;

            teams = [];
            for (var key in this.props.selectedTeams) {
                if (this.props.selectedTeams.hasOwnProperty(key)) {
                    var team = this.props.teams[key];

                    if (team != null) {
                        teams.push(
                            <ul
                                key={'team_' + team.id}
                                className='nav nav__sub-menu'
                            >
                                <li>
                                    <a
                                        href='#'
                                        onClick={this.handleClick.bind(this, 'team_users', team.id)}
                                        className={'nav__sub-menu-item ' + this.isSelected('team_users', team.id) + ' ' + this.isSelected('team_analytics', team.id)}
                                    >
                                        {team.name}
                                        <OverlayTrigger
                                            delayShow={1000}
                                            placement='top'
                                            overlay={removeTooltip}
                                        >
                                        <span
                                            className='menu-icon--right menu__close'
                                            onClick={this.removeTeam.bind(this, team.id)}
                                            style={{cursor: 'pointer'}}
                                        >
                                            {'×'}
                                        </span>
                                        </OverlayTrigger>
                                    </a>
                                </li>
                                <li>
                                    <ul className='nav nav__inner-menu'>
                                        <li>
                                            <a
                                                href='#'
                                                className={this.isSelected('team_users', team.id)}
                                                onClick={this.handleClick.bind(this, 'team_users', team.id)}
                                            >
                                                {'- Users'}
                                            </a>
                                        </li>
                                        <li>
                                            <a
                                                href='#'
                                                className={this.isSelected('team_analytics', team.id)}
                                                onClick={this.handleClick.bind(this, 'team_analytics', team.id)}
                                            >
                                                {'- Statistics'}
                                            </a>
                                        </li>
                                    </ul>
                                </li>
                            </ul>
                        );
                    }
                }
            }
        }

        let ldapSettings;
        let licenseSettings;
        if (global.window.mm_config.BuildEnterpriseReady === 'true') {
            if (global.window.mm_license.IsLicensed === 'true') {
                ldapSettings = (
                    <li>
                        <a
                            href='#'
                            className={this.isSelected('ldap_settings')}
                            onClick={this.handleClick.bind(this, 'ldap_settings', null)}
                        >
                            {'LDAP Settings'}
                        </a>
                    </li>
                );
            }

            licenseSettings = (
                <li>
                    <a
                        href='#'
                        className={this.isSelected('license')}
                        onClick={this.handleClick.bind(this, 'license', null)}
                    >
                        {'Edition and License'}
                    </a>
                </li>
            );
        }

        return (
            <div className='sidebar--left sidebar--collapsable'>
                <div>
                    <AdminSidebarHeader />
                    <div className='nav-pills__container'>
                        <ul className='nav nav-pills nav-stacked'>
                            <li>
                                <ul className='nav nav__sub-menu'>
                                    <li>
                                        <h4>
                                            <span className='icon fa fa-gear'></span>
                                            <span>{'SETTINGS'}</span>
                                        </h4>
                                    </li>
                                </ul>
                                <ul className='nav nav__sub-menu padded'>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('service_settings')}
                                            onClick={this.handleClick.bind(this, 'service_settings', null)}
                                        >
                                            {'Service Settings'}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('team_settings')}
                                            onClick={this.handleClick.bind(this, 'team_settings', null)}
                                        >
                                            {'Team Settings'}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('sql_settings')}
                                            onClick={this.handleClick.bind(this, 'sql_settings', null)}
                                        >
                                            {'SQL Settings'}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('email_settings')}
                                            onClick={this.handleClick.bind(this, 'email_settings', null)}
                                        >
                                            {'Email Settings'}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('image_settings')}
                                            onClick={this.handleClick.bind(this, 'image_settings', null)}
                                        >
                                            {'File Settings'}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('log_settings')}
                                            onClick={this.handleClick.bind(this, 'log_settings', null)}
                                        >
                                            {'Log Settings'}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('rate_settings')}
                                            onClick={this.handleClick.bind(this, 'rate_settings', null)}
                                        >
                                            {'Rate Limit Settings'}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('privacy_settings')}
                                            onClick={this.handleClick.bind(this, 'privacy_settings', null)}
                                        >
                                            {'Privacy Settings'}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('gitlab_settings')}
                                            onClick={this.handleClick.bind(this, 'gitlab_settings', null)}
                                        >
                                            {'GitLab Settings'}
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('cloudron_settings')}
                                            onClick={this.handleClick.bind(this, 'cloudron_settings', null)}
                                        >
                                            {'Cloudron Settings'}
                                        </a>
                                    </li>
                                    {ldapSettings}
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('legal_and_support_settings')}
                                            onClick={this.handleClick.bind(this, 'legal_and_support_settings', null)}
                                        >
                                            {'Legal and Support Settings'}
                                        </a>
                                    </li>
                                </ul>
                                <ul className='nav nav__sub-menu'>
                                     <li>
                                        <h4>
                                            <span className='icon fa fa-gear'></span>
                                            <span>{'TEAMS (' + count + ')'}</span>
                                            <span className='menu-icon--right'>
                                                <OverlayTrigger
                                                    delayShow={1000}
                                                    placement='top'
                                                    overlay={addTeamTooltip}
                                                >
                                                <a
                                                    href='#'
                                                    onClick={this.showTeamSelect}
                                                >
                                                    <i
                                                        className='fa fa-plus'
                                                    ></i>
                                                </a>
                                                </OverlayTrigger>
                                            </span>
                                        </h4>
                                    </li>
                                </ul>
                                <ul className='nav nav__sub-menu padded'>
                                    <li>
                                        {teams}
                                    </li>
                                </ul>
                                <ul className='nav nav__sub-menu'>
                                    <li>
                                        <h4>
                                            <span className='icon fa fa-gear'></span>
                                            <span>{'OTHER'}</span>
                                        </h4>
                                    </li>
                                </ul>
                                <ul className='nav nav__sub-menu padded'>
                                    {licenseSettings}
                                    <li>
                                        <a
                                            href='#'
                                            className={this.isSelected('logs')}
                                            onClick={this.handleClick.bind(this, 'logs', null)}
                                        >
                                            {'Logs'}
                                        </a>
                                    </li>
                                </ul>
                            </li>
                        </ul>
                    </div>
                </div>

                <SelectTeamModal
                    teams={this.props.teams}
                    show={this.state.showSelectModal}
                    onModalSubmit={this.teamSelectedModal}
                    onModalDismissed={this.teamSelectedModalDismissed}
                />
            </div>
        );
    }
}

AdminSidebar.propTypes = {
    teams: React.PropTypes.object,
    selectedTeams: React.PropTypes.object,
    removeSelectedTeam: React.PropTypes.func,
    addSelectedTeam: React.PropTypes.func,
    selected: React.PropTypes.string,
    selectedTeam: React.PropTypes.string,
    selectTab: React.PropTypes.func
};
