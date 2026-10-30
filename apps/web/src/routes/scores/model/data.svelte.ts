import { ApiError } from '$lib/query/core'
import { ChallengeScoringKind } from '@rctf/types'
import {
  mergeLeaderboardPages,
  useLeaderboardChallenges,
  useLeaderboardWithGraph,
  useSelfUserGraph,
} from '$lib/query/leaderboard'
import type { useClubEvent } from '$lib/query/club-events'
import { useCurrentUser } from '$lib/query/user'
import type { SortMode } from '../leaderboard/url-params'
import {
  getBloodIndex,
  getCategoryGroups,
  getCategoryStatsForSolves,
  getChallengesByCategory,
  getChallengesBySolves,
  getFocusedEntries,
  getRankDeltaByTeam,
  getSparklineDataByTeam,
  getTeamColorMap,
  getTeamRanks,
} from './transforms'

export type ScoresData = ReturnType<typeof createScoresData>

interface ScoresDataConfig {
  division: () => string | undefined
  search: () => string | undefined
  sortMode: () => SortMode
  focusedChallengeId: () => string | null
  showTop3Context: () => boolean
  showSelfContext: () => boolean
}

export function createScoresData(config: ScoresDataConfig) {
  const leaderboardQuery = useLeaderboardWithGraph(() => ({
    division: config.division(),
    search: config.search(),
    challenge: config.focusedChallengeId() ?? undefined,
  }))
  const challengesQuery = useLeaderboardChallenges()
  const userQuery = useCurrentUser()

  const merged = $derived(
    mergeLeaderboardPages(leaderboardQuery.data?.pages ?? [])
  )
  const rawEntries = $derived(merged.leaderboard)
  const allGraphData = $derived(merged.graph)
  const total = $derived(merged.total)
  const currentUser = $derived(userQuery.data)
  const currentUserId = $derived(currentUser?.id ?? null)
  const challengesData = $derived(challengesQuery.data ?? {})
  const entries = $derived(
    getFocusedEntries(rawEntries, config.focusedChallengeId(), challengesData)
  )

  const selfGraphQuery = useSelfUserGraph(
    () =>
      config.showSelfContext() && currentUser?.globalPlace
        ? currentUser.globalPlace
        : null,
    () => currentUser?.id ?? null
  )

  const challengesByCategory = $derived(getChallengesByCategory(challengesData))
  const challengesBySolves = $derived(
    getChallengesBySolves(challengesByCategory)
  )
  const challenges = $derived(
    config.sortMode() === 'solves' ? challengesBySolves : challengesByCategory
  )
  const categoryGroups = $derived(getCategoryGroups(challengesByCategory))

  const teamColorMap = $derived(getTeamColorMap(rawEntries, currentUser))
  const teamRanks = $derived(getTeamRanks(entries))
  const sparklineDataByTeam = $derived(
    getSparklineDataByTeam(allGraphData, selfGraphQuery.data)
  )
  const rankDeltaByTeam = $derived(
    getRankDeltaByTeam(config.search(), allGraphData, selfGraphQuery.data)
  )

  const isLoading = $derived(
    leaderboardQuery.isLoading || challengesQuery.isLoading
  )
  const isBoardFetching = $derived(
    leaderboardQuery.isFetching && leaderboardQuery.isPlaceholderData
  )
  const isNotStarted = $derived(ApiError.isNotStarted(leaderboardQuery.error))
  const loadError = $derived(
    isNotStarted
      ? null
      : (leaderboardQuery.error ?? challengesQuery.error ?? null)
  )

  return {
    get entries() {
      return entries
    },
    get total() {
      return total
    },
    get currentUser() {
      return currentUser
    },
    get currentUserId() {
      return currentUserId
    },
    get challengesData() {
      return challengesData
    },
    get challenges() {
      return challenges
    },
    get categoryGroups() {
      return categoryGroups
    },
    get teamColorMap() {
      return teamColorMap
    },
    get teamRanks() {
      return teamRanks
    },
    get sparklineDataByTeam() {
      return sparklineDataByTeam
    },
    get rankDeltaByTeam() {
      return rankDeltaByTeam
    },
    get graphData() {
      return allGraphData
    },
    get showTop3Context() {
      return config.showTop3Context()
    },
    get showSelfContext() {
      return config.showSelfContext()
    },
    get isLoading() {
      return isLoading
    },
    get isBoardFetching() {
      return isBoardFetching
    },
    get isNotStarted() {
      return isNotStarted
    },
    get loadError() {
      return loadError
    },
    get hasNextPage() {
      return leaderboardQuery.hasNextPage
    },
    get isFetchingNextPage() {
      return leaderboardQuery.isFetchingNextPage
    },
    fetchNextPage: () => leaderboardQuery.fetchNextPage(),
    getBloodIndex: (challengeId: string, teamId: string) =>
      getBloodIndex(challengesData, challengeId, teamId),
    getCategoryStatsForSolves,
  }
}

export function createEventScoresData(
  eventQuery: ReturnType<typeof useClubEvent>,
  config: ScoresDataConfig,
  startTime: () => number
): ScoresData {
  const userQuery = useCurrentUser()
  const currentUser = $derived(userQuery.data)
  const currentUserId = $derived(currentUser?.id ?? null)

  const eventData = $derived(eventQuery.data)

  const challengesData = $derived.by(() => {
    const map: Record<
      string,
      {
        name: string
        category: string
        solves: number
        points: number
        sortWeight: number | null
        scoringKind: ChallengeScoringKind
        firstSolvers: { id: string }[]
      }
    > = {}
    if (!eventData?.challenges) return map
    for (const c of eventData.challenges) {
      map[c.id] = {
        name: c.name,
        category: c.category,
        points: c.points,
        solves: c.solves ?? 0,
        sortWeight: null,
        scoringKind: ChallengeScoringKind.DECAY,
        firstSolvers: c.firstSolvers ?? [],
      }
    }
    return map
  })

  const rawEntries = $derived.by(() => {
    if (!eventData?.leaderboard) return []
    return eventData.leaderboard.map((team, idx) => ({
      id: team.id,
      name: team.name,
      division: team.division,
      score: team.score,
      globalPlace: team.rank ?? idx + 1,
      divisionPlace: team.rank ?? idx + 1,
      avatarUrl: null,
      countryCode: null,
      statusText: null,
      solves: team.solves ?? [],
      dynamicScores: [],
    }))
  })

  const allGraphData = $derived.by(() => {
    if (!eventData?.leaderboard) return []
    const start = startTime()
    return eventData.leaderboard.map(team => {
      const points =
        team.graph && team.graph.length > 0
          ? [{ score: 0, time: start }, ...team.graph]
          : [{ score: 0, time: start }]
      return {
        id: team.id,
        name: team.name,
        points,
      }
    })
  })

  const filteredEntries = $derived.by(() => {
    const div = config.division()
    const search = config.search()?.trim().toLowerCase()
    let list = rawEntries
    if (div) {
      list = list.filter(team => team.division === div)
    }
    if (search) {
      list = list.filter(team => team.name.toLowerCase().includes(search))
    }
    return list
  })

  const total = $derived(filteredEntries.length)
  const entries = $derived(
    getFocusedEntries(
      filteredEntries,
      config.focusedChallengeId(),
      challengesData
    )
  )

  const challengesByCategory = $derived(getChallengesByCategory(challengesData))
  const challengesBySolves = $derived(
    getChallengesBySolves(challengesByCategory)
  )
  const challenges = $derived(
    config.sortMode() === 'solves' ? challengesBySolves : challengesByCategory
  )
  const categoryGroups = $derived(getCategoryGroups(challengesByCategory))

  const teamColorMap = $derived(getTeamColorMap(rawEntries, currentUser))
  const teamRanks = $derived(getTeamRanks(entries))
  const sparklineDataByTeam = $derived(
    getSparklineDataByTeam(allGraphData, null)
  )
  const rankDeltaByTeam = $derived(
    getRankDeltaByTeam(config.search(), allGraphData, null)
  )

  const isLoading = $derived(eventQuery.isLoading)
  const isBoardFetching = $derived(
    eventQuery.isFetching && eventQuery.isPlaceholderData
  )
  const isNotStarted = $derived(
    eventData ? Date.now() < eventData.startTime : false
  )
  const loadError = $derived(eventQuery.error ?? null)

  return {
    get entries() {
      return entries
    },
    get total() {
      return total
    },
    get currentUser() {
      return currentUser
    },
    get currentUserId() {
      return currentUserId
    },
    get challengesData() {
      return challengesData
    },
    get challenges() {
      return challenges
    },
    get categoryGroups() {
      return categoryGroups
    },
    get teamColorMap() {
      return teamColorMap
    },
    get teamRanks() {
      return teamRanks
    },
    get sparklineDataByTeam() {
      return sparklineDataByTeam
    },
    get rankDeltaByTeam() {
      return rankDeltaByTeam
    },
    get graphData() {
      return allGraphData
    },
    get showTop3Context() {
      return config.showTop3Context()
    },
    get showSelfContext() {
      return config.showSelfContext()
    },
    get isLoading() {
      return isLoading
    },
    get isBoardFetching() {
      return isBoardFetching
    },
    get isNotStarted() {
      return isNotStarted
    },
    get loadError() {
      return loadError
    },
    get hasNextPage() {
      return false
    },
    get isFetchingNextPage() {
      return false
    },
    fetchNextPage: () => Promise.resolve({} as never),
    getBloodIndex: (challengeId: string, teamId: string) =>
      getBloodIndex(challengesData, challengeId, teamId),
    getCategoryStatsForSolves,
  }
}
