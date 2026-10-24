import { createModules } from '../../lib/route-module'
import adminGroup from './admin'
import authGroup from './auth'
import challsGroup from './challs'
import clubGroup from './club'
import clubEventsGroup from './club-events'
import externalAuthGroup from './external-auth'
import integrationsGroup from './integrations'
import leaderboardGroup from './leaderboard'
import usersGroup from './users'

export default [
  ...createModules(clubGroup),
  ...createModules(clubEventsGroup),
  ...createModules(adminGroup),
  ...createModules(authGroup),
  ...createModules(usersGroup),
  ...createModules(leaderboardGroup),
  ...createModules(challsGroup),
  ...createModules(integrationsGroup),
  ...createModules(externalAuthGroup),
]
