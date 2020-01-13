/* eslint-disable react-hooks/exhaustive-deps */
import * as React from 'react'
import * as Container from '../../../util/container'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as WaitingGen from '../../../actions/waiting-gen'
import * as TeamsGen from '../../../actions/teams-gen'
import * as Teams from '../../../constants/teams'
import * as Types from '../../../constants/types/chat2'
import * as TeamTypes from '../../../constants/types/teams'
import * as TeamConstants from '../../../constants/teams'
import * as Constants from '../../../constants/chat2'
import * as RPCTypes from '../../../constants/types/rpc-gen'
import ChannelPicker from './channel-picker'

const RestrictedItem = '---RESTRICTED---'

export const useBotConversationIDKey = (inConvIDKey?: Types.ConversationIDKey, teamID?: TeamTypes.TeamID) => {
  const [conversationIDKey, setConversationIDKey] = React.useState(inConvIDKey)
  const generalConvID = Container.useSelector(
    (state: Container.TypedState) => teamID && state.chat2.teamIDToGeneralConvID.get(teamID)
  )
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    if (!conversationIDKey && teamID) {
      if (!generalConvID) {
        dispatch(Chat2Gen.createFindGeneralConvIDFromTeamID({teamID}))
      } else {
        setConversationIDKey(generalConvID)
      }
    }
  }, [conversationIDKey, dispatch, generalConvID, teamID])
  return conversationIDKey
}

type LoaderProps = Container.RouteProps<{
  botUsername: string
  conversationIDKey?: Types.ConversationIDKey
  teamID?: TeamTypes.TeamID
}>

const InstallBotPopupLoader = (props: LoaderProps) => {
  const botUsername = Container.getRouteProps(props, 'botUsername', '')
  const inConvIDKey = Container.getRouteProps(props, 'conversationIDKey', undefined)
  const teamID = Container.getRouteProps(props, 'teamID', undefined)
  const conversationIDKey = useBotConversationIDKey(inConvIDKey, teamID)
  return <InstallBotPopup botUsername={botUsername} conversationIDKey={conversationIDKey} />
}

type Props = {
  botUsername: string
  conversationIDKey?: Types.ConversationIDKey
}

const InstallBotPopup = (props: Props) => {
  const {botUsername, conversationIDKey} = props

  // state
  const [installScreen, setInstallScreen] = React.useState(false)
  const [channelPickerScreen, setChannelPickerScreen] = React.useState(false)
  const [installWithCommands, setInstallWithCommands] = React.useState(true)
  const [installWithMentions, setInstallWithMentions] = React.useState(true)
  const [installWithRestrict, setInstallWithRestrict] = React.useState(true)
  const [installInConvs, setInstallInConvs] = React.useState<string[]>([])
  const {
    commands,
    channelInfos,
    featured,
    inTeam,
    inTeamUnrestricted,
    readOnly,
    settings,
    teamID,
    teamName,
  } = Container.useSelector((state: Container.TypedState) => {
    let inTeam: boolean | undefined
    let teamRole: TeamTypes.TeamRoleType | null | undefined
    let teamName: string | null | undefined
    let teamID: TeamTypes.TeamID | undefined
    let channelInfos: Map<string, TeamTypes.ChannelInfo> | undefined
    let readOnly = false
    if (conversationIDKey) {
      const meta = state.chat2.metaMap.get(conversationIDKey)
      if (meta && meta.teamname) {
        teamID = meta.teamID
        teamName = meta.teamname
        readOnly = !TeamConstants.getCanPerformByID(state, meta.teamID).manageBots
        channelInfos = Teams.getTeamChannelInfos(state, teamID)
      }
      teamRole = state.chat2.botTeamRoleInConvMap.get(conversationIDKey)?.get(botUsername)
      if (teamRole !== undefined) {
        inTeam = !!teamRole
      }
    }
    return {
      channelInfos,
      commands: state.chat2.botPublicCommands.get(botUsername),
      featured: state.chat2.featuredBotsMap.get(botUsername),
      inTeam,
      inTeamUnrestricted: inTeam && teamRole === 'bot',
      readOnly,
      settings: conversationIDKey
        ? state.chat2.botSettings.get(conversationIDKey)?.get(botUsername) ?? undefined
        : undefined,
      teamID,
      teamName,
    }
  })
  const error = Container.useAnyErrors(Constants.waitingKeyBotAdd, Constants.waitingKeyBotRemove)
  // dispatch
  const dispatch = Container.useDispatch()
  const onClose = () => {
    dispatch(RouteTreeGen.createClearModals())
  }
  const onLeftAction = () => {
    if (installScreen) {
      setInstallScreen(false)
    } else {
      onClose()
    }
  }
  const onInstall = () => {
    if (!conversationIDKey) {
      return
    }
    dispatch(
      Chat2Gen.createAddBotMember({
        allowCommands: installWithCommands,
        allowMentions: installWithMentions,
        conversationIDKey,
        convs: installInConvs,
        restricted: installWithRestrict,
        username: botUsername,
      })
    )
  }
  const onEdit = () => {
    if (!conversationIDKey) {
      return
    }
    dispatch(
      Chat2Gen.createEditBotSettings({
        allowCommands: installWithCommands,
        allowMentions: installWithMentions,
        conversationIDKey,
        convs: installInConvs,
        username: botUsername,
      })
    )
  }
  const onRemove = () => {
    if (!conversationIDKey) {
      return
    }
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {
              botUsername,
              conversationIDKey,
              namespace: 'chat2',
            },
            selected: 'chatConfirmRemoveBot',
          },
        ],
      })
    )
  }
  const onFeedback = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: ['feedback']}))
  }

  // lifecycle
  React.useEffect(() => {
    dispatch(
      WaitingGen.createClearWaiting({key: [Constants.waitingKeyBotAdd, Constants.waitingKeyBotRemove]})
    )
    dispatch(Chat2Gen.createRefreshBotPublicCommands({username: botUsername}))
    if (conversationIDKey) {
      dispatch(Chat2Gen.createRefreshBotRoleInConv({conversationIDKey, username: botUsername}))
      if (inTeam) {
        dispatch(Chat2Gen.createRefreshBotSettings({conversationIDKey, username: botUsername}))
      }
    }
  }, [conversationIDKey, inTeam])
  React.useEffect(() => {
    if (!teamID) {
      return
    }
    dispatch(TeamsGen.createGetChannels({teamID}))
  }, [teamID])

  const restrictedButton = (
    <Kb.Box2 key={RestrictedItem} direction="vertical" fullWidth={true} style={styles.dropdownButton}>
      <Kb.Text type="BodySemibold">Restricted bot (recommended)</Kb.Text>
      <Kb.Text type="BodySmall">Customize which messages get encrypted for this bot.</Kb.Text>
    </Kb.Box2>
  )
  const unrestrictedButton = (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.dropdownButton}>
      <Kb.Text type="BodySemibold">Unrestricted bot</Kb.Text>
      <Kb.Text type="BodySmall">All messages will be encrypted for this bot.</Kb.Text>
    </Kb.Box2>
  )
  const dropdownButtons = [restrictedButton, unrestrictedButton]
  const restrictPicker = !inTeam && !readOnly && (
    <Kb.Dropdown
      items={dropdownButtons}
      selected={installWithRestrict ? restrictedButton : unrestrictedButton}
      onChanged={selected => setInstallWithRestrict(selected.key === RestrictedItem)}
      style={styles.dropdown}
      overlayStyle={{width: '100%'}}
    />
  )
  const featuredContent = !!featured && (
    <Kb.Box2
      direction="vertical"
      style={Styles.collapseStyles([styles.container, {flex: 1}])}
      fullWidth={true}
      gap="tiny"
    >
      <Kb.Box2 direction="vertical" gap="small" fullWidth={true}>
        <Kb.Box2 direction="horizontal" gap="small" fullWidth={true}>
          <Kb.Avatar username={botUsername} size={64} />
          <Kb.Box2 direction="vertical" fullWidth={true} style={{flex: 1}} gap="tiny">
            <Kb.Box2 direction="vertical" fullWidth={true}>
              <Kb.Text type="BodyBigExtrabold">{featured.botAlias}</Kb.Text>
              <Kb.ConnectedUsernames
                colorFollowing={true}
                type="BodySemibold"
                usernames={[botUsername]}
                withProfileCardPopup={false}
              />
            </Kb.Box2>
            <Kb.Text type="BodySmall" lineClamp={1}>
              {featured.description}
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Text type="Body">{featured.extendedDescription}</Kb.Text>
      </Kb.Box2>
      {inTeam && !inTeamUnrestricted && (
        <PermsList channelInfos={channelInfos} settings={settings} username={botUsername} />
      )}
    </Kb.Box2>
  )
  const usernameContent = !featured && (
    <Kb.Box2 direction="vertical" gap="small" style={styles.container} fullWidth={true}>
      <Kb.Box2 direction="horizontal" gap="small" fullWidth={true}>
        <Kb.Avatar username={botUsername} size={64} />
        <Kb.Box2 direction="vertical" fullWidth={true} style={{flex: 1}}>
          <Kb.Text type="BodyBigExtrabold">{botUsername}</Kb.Text>
          <Kb.ConnectedUsernames
            colorFollowing={true}
            type="BodySemibold"
            usernames={[botUsername]}
            withProfileCardPopup={false}
          />
        </Kb.Box2>
      </Kb.Box2>
      {inTeam && !inTeamUnrestricted && <PermsList settings={settings} username={botUsername} />}
    </Kb.Box2>
  )
  const installContent = installScreen && (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container} gap="small">
      <Kb.Box2 direction="horizontal" gap="small" fullWidth={true}>
        <Kb.Avatar username={botUsername} size={64} />
        <Kb.Box2 direction="vertical" fullWidth={true} style={{flex: 1}} gap="tiny">
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.Text type="BodyBigExtrabold">{featured ? featured.botAlias : botUsername}</Kb.Text>
            <Kb.ConnectedUsernames
              colorFollowing={true}
              type="BodySemibold"
              usernames={[botUsername]}
              withProfileCardPopup={false}
            />
          </Kb.Box2>
          {!!featured && (
            <Kb.Text type="BodySmall" lineClamp={1}>
              {featured.description}
            </Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Box2>
      {installWithRestrict ? (
        <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
          <Kb.Text type="BodyBig">It will be able to read:</Kb.Text>
          <Kb.Box2 direction="vertical" fullWidth={true} gap="xtiny">
            <Kb.Checkbox
              checked={installWithCommands}
              labelComponent={<CommandsLabel commands={commands} />}
              onCheck={() => setInstallWithCommands(!installWithCommands)}
            />
            <Kb.Checkbox
              checked={installWithMentions}
              labelComponent={
                <Kb.Text
                  style={{flex: 1}}
                  type="Body"
                >{`messages it has been mentioned in with @${botUsername}`}</Kb.Text>
              }
              onCheck={() => setInstallWithMentions(!installWithMentions)}
            />
          </Kb.Box2>
          {teamID && teamName && channelInfos && (
            <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
              <Kb.Text type="BodyBig">In these channels:</Kb.Text>
              <Kb.DropdownButton
                selected={
                  <Kb.Box2 direction="horizontal" alignItems="center">
                    <Kb.Avatar
                      size={16}
                      teamname={teamName}
                      style={{marginRight: Styles.globalMargins.tiny}}
                    />
                    <Kb.Text type="BodySemibold">
                      {teamName}{' '}
                      {installInConvs.length === 1
                        ? `(#${channelInfos.get(installInConvs[0])?.channelname ?? ''})`
                        : `(${installInConvs.length > 0 ? installInConvs.length : 'all'} channels)`}
                    </Kb.Text>
                  </Kb.Box2>
                }
                toggleOpen={() => setChannelPickerScreen(true)}
              />
            </Kb.Box2>
          )}
          <Kb.Text type="BodySmall">
            This bot will not be able to read any other messages, channels, files, repositories, or team
            members.
          </Kb.Text>
        </Kb.Box2>
      ) : (
        <Kb.Box2 direction="vertical" gap="tiny">
          <Kb.Text type="Body">
            <Kb.Text type="BodySemibold">Warning:</Kb.Text> This bot will be able to read all messages,
            channels, files, repositories, and team members.
          </Kb.Text>
          <Kb.Text type="Body">
            <Kb.Text type="BodyPrimaryLink" onClick={() => setInstallWithRestrict(true)}>
              Install as a restricted bot
            </Kb.Text>{' '}
            if you’d like to customize which messages are encrypted for this bot.
          </Kb.Text>
        </Kb.Box2>
      )}
    </Kb.Box2>
  )

  const channelPickerContent = channelPickerScreen && teamID && teamName && channelInfos && (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="small">
      <ChannelPicker
        channelInfos={channelInfos}
        installInConvs={installInConvs}
        setChannelPickerScreen={setChannelPickerScreen}
        setInstallInConvs={setInstallInConvs}
        teamID={teamID}
        teamName={teamName}
      />
    </Kb.Box2>
  )

  const content = channelPickerScreen
    ? channelPickerContent
    : installScreen
    ? installContent
    : featured
    ? featuredContent
    : usernameContent
  const showInstallButton = installScreen && !inTeam && !channelPickerScreen
  const showReviewButton = !installScreen && !inTeam
  const showRemoveButton = inTeam && !installScreen
  const showEditButton = inTeam && !inTeamUnrestricted && !installScreen
  const showSaveButton = inTeam && installScreen && !channelPickerContent
  const showDoneButton = channelPickerContent
  const installButton = showInstallButton && (
    <Kb.WaitingButton
      fullWidth={true}
      label="Install"
      onClick={onInstall}
      mode="Primary"
      type="Default"
      waitingKey={Constants.waitingKeyBotAdd}
    />
  )
  const reviewButton = showReviewButton && (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny" style={{marginTop: -Styles.globalMargins.tiny}}>
      {readOnly ? (
        <Kb.Text style={{alignSelf: 'center'}} type="BodySmall">
          Ask an admin or owner to install this bot
        </Kb.Text>
      ) : (
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
          <Kb.Text type="BodySmall" style={{alignSelf: 'center'}}>
            Install as
          </Kb.Text>
          {restrictPicker}
        </Kb.Box2>
      )}
      <Kb.WaitingButton
        fullWidth={true}
        label="Review"
        onClick={() => setInstallScreen(true)}
        mode="Primary"
        type="Default"
        waitingKey={Constants.waitingKeyBotAdd}
        disabled={readOnly}
      />
    </Kb.Box2>
  )
  const removeButton = showRemoveButton && (
    <Kb.WaitingButton
      fullWidth={true}
      label="Uninstall"
      onClick={onRemove}
      mode="Secondary"
      type="Danger"
      waitingKey={Constants.waitingKeyBotRemove}
    />
  )
  const editButton = showEditButton && (
    <Kb.Button
      fullWidth={true}
      label="Edit settings"
      onClick={() => {
        if (settings) {
          setInstallWithCommands(settings.cmds)
          setInstallWithMentions(settings.mentions)
          setInstallInConvs(settings.convs ?? [])
        }
        setInstallScreen(true)
      }}
      mode="Secondary"
      type="Default"
    />
  )
  const saveButton = showSaveButton && (
    <Kb.WaitingButton
      fullWidth={true}
      label="Save"
      onClick={onEdit}
      mode="Primary"
      type="Default"
      waitingKey={Constants.waitingKeyBotAdd}
    />
  )
  const doneButton = showDoneButton && (
    <Kb.Button
      fullWidth={true}
      label="Done"
      onClick={() => setChannelPickerScreen(false)}
      mode="Primary"
      type="Default"
    />
  )
  const backButton = Styles.isMobile ? 'Back' : <Kb.Icon type="iconfont-arrow-left" />
  const enabled = !!conversationIDKey && inTeam !== undefined
  return (
    <Kb.Modal
      onClose={!Styles.isMobile ? onClose : undefined}
      header={{
        leftButton: channelPickerScreen ? (
          <Kb.Text type="BodyBigLink" onClick={() => setChannelPickerScreen(false)}>
            Back
          </Kb.Text>
        ) : Styles.isMobile || installScreen ? (
          <Kb.Text type="BodyBigLink" onClick={onLeftAction}>
            {installScreen ? backButton : inTeam || readOnly ? 'Close' : 'Cancel'}
          </Kb.Text>
        ) : (
          undefined
        ),
        title: channelPickerScreen ? 'Channels' : '',
      }}
      footer={
        enabled && (!readOnly || showReviewButton)
          ? {
              content: (
                <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
                  <Kb.ButtonBar direction="column">
                    {doneButton}
                    {editButton}
                    {saveButton}
                    {reviewButton}
                    {installButton}
                    {removeButton}
                  </Kb.ButtonBar>
                  {!!error && (
                    <Kb.Text type="Body" style={{color: Styles.globalColors.redDark}}>
                      {'Something went wrong! Please try again, or send '}
                      <Kb.Text
                        type="Body"
                        style={{color: Styles.globalColors.redDark}}
                        underline={true}
                        onClick={onFeedback}
                      >
                        {'feedback'}
                      </Kb.Text>
                    </Kb.Text>
                  )}
                </Kb.Box2>
              ),
            }
          : undefined
      }
    >
      <Kb.Box2 direction="vertical" style={styles.outerContainer} fullWidth={true}>
        {enabled ? (
          content
        ) : (
          <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} centerChildren={true}>
            <Kb.ProgressIndicator type="Large" />
          </Kb.Box2>
        )}
      </Kb.Box2>
    </Kb.Modal>
  )
}

type CommandsLabelProps = {
  commands: Types.BotPublicCommands | undefined
}

const maxCommandsShown = 3

const CommandsLabel = (props: CommandsLabelProps) => {
  const [expanded, setExpanded] = React.useState(false)
  let inner: React.ReactNode | undefined
  if (!props.commands) {
    inner = <Kb.ProgressIndicator />
  } else if (props.commands.loadError) {
    inner = (
      <Kb.Text type="BodySemibold" style={{color: Styles.globalColors.redDark}}>
        Error loading bot public commands.
      </Kb.Text>
    )
  } else {
    const numCommands = props.commands.commands.length
    inner = props.commands.commands.map((c: string, i: number) => {
      if (!expanded && i >= maxCommandsShown) {
        return i === maxCommandsShown ? (
          <Kb.Text type="Body">
            {'• and '}
            <Kb.Text
              type="BodyPrimaryLink"
              onClick={(e: React.BaseSyntheticEvent) => {
                e.stopPropagation()
                setExpanded(true)
              }}
            >{`${numCommands - maxCommandsShown} more`}</Kb.Text>
          </Kb.Text>
        ) : null
      }
      return (
        <Kb.Text key={i} type="Body">
          {`• !${c}`}
        </Kb.Text>
      )
    })
  }
  return (
    <Kb.Box2 direction="vertical" gap="tiny">
      <Kb.Text type="Body">messages that begin with bot commands:</Kb.Text>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        {inner}
      </Kb.Box2>
    </Kb.Box2>
  )
}

type PermsListProps = {
  channelInfos?: Map<string, TeamTypes.ChannelInfo>
  settings?: RPCTypes.TeamBotSettings
  username: string
}

const PermsList = (props: PermsListProps) => {
  return (
    <Kb.Box2 direction="vertical" gap="small" fullWidth={true}>
      <Kb.Text type="BodySemibold">This bot can currently read:</Kb.Text>
      {props.settings ? (
        <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
          {!(props.settings.cmds || props.settings.mentions) && (
            <Kb.Text type="Body">{'• no messages, the bot is in write only mode'}</Kb.Text>
          )}
          {props.settings.cmds && <Kb.Text type="Body">{'• messages that begin with bot commands.'}</Kb.Text>}
          {props.settings.mentions && (
            <Kb.Text type="Body">{`• messages it has been mentioned in with @${props.username}`}</Kb.Text>
          )}
          {props.settings.convs && props.channelInfos && (
            <Kb.Box2 direction="vertical" gap="tiny" fullWidth={true}>
              <Kb.Text type="BodySemibold">In these channels:</Kb.Text>
              {props.settings.convs?.map(convID => (
                <Kb.Text type="Body" key={convID}>{`• #${props.channelInfos?.get(convID)?.channelname ??
                  ''}`}</Kb.Text>
              ))}
            </Kb.Box2>
          )}
        </Kb.Box2>
      ) : (
        <Kb.ProgressIndicator type="Large" />
      )}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.padding(Styles.globalMargins.medium, Styles.globalMargins.small),
  },
  dropdown: {
    width: '100%',
  },
  dropdownButton: {
    padding: Styles.globalMargins.tiny,
  },
  outerContainer: Styles.platformStyles({
    isElectron: {
      height: 560,
    },
  }),
}))

export default InstallBotPopupLoader