import {
  clubArchiveChallenges,
  clubArchives,
  type ArchivedChallenge,
  type DatabaseClient,
} from '@rctf/db'
import { defineCommand } from 'citty'
import { withDbAndRedis } from '../lib/context'

type DemoChallenge = {
  challengeId: string
  publicData: ArchivedChallenge
  staticFlags: string[]
}

// These are public demo fixtures, not secrets or real competition history.
// Only publicData is exposed by archive APIs; answer keys stay in staticFlags.
const challenge = (
  id: string,
  name: string,
  category: string,
  points: number,
  description: string,
  flag: string | null,
  reason: string | null = null
): DemoChallenge => ({
  challengeId: id,
  publicData: {
    id,
    name,
    category,
    points,
    description,
    author: 'UCS Demo Team',
    files: [],
    solves: 0,
    tags: ['Demo', 'Beginner'],
    practiceAvailable: flag !== null,
    practiceUnavailableReason: reason,
  },
  staticFlags: flag === null ? [] : [flag],
})

const event = (
  id: string,
  name: string,
  date: string,
  description: string,
  challenges: DemoChallenge[]
) => {
  // Fictional teams solved all, the first three, and the first two challenges.
  // Derive both frozen scores and challenge solve counts from those results.
  const solvedCounts = [challenges.length, 3, 2]
  const leaderboard = ['Aurora', 'Vector', 'Orbit'].map((team, index) => ({
    id: `${id}-team-${index + 1}`,
    name: `Demo Team ${team}`,
    division: 'Demo',
    rank: index + 1,
    score: challenges
      .slice(0, solvedCounts[index])
      .reduce((sum, item) => sum + item.publicData.points, 0),
  }))
  return {
    summary: {
      id,
      name,
      description: `Demo archive for club practice. ${description} Standings are fictional demo results.`,
      startTime: Date.parse(`${date}T09:00:00Z`),
      endTime: Date.parse(`${date}T14:00:00Z`),
      challengeCount: challenges.length,
      participantCount: leaderboard.length,
      leaderboard,
    },
    challenges: challenges.map((item, index) => ({
      ...item,
      publicData: {
        ...item.publicData,
        solves: solvedCounts.filter(count => count > index).length,
      },
    })),
  }
}

const demoArchives = [
  event(
    'ucs-demo-rookie-2026-09',
    'UCS Rookie CTF',
    '2026-09-12',
    'Start with short encoding, source-reading, and log-analysis puzzles.',
    [
      challenge(
        'signal',
        'First Signal',
        'Crypto',
        100,
        `A club radio left this Base64 message. Decode it as UTF-8 and wrap the decoded text in the flag format \`UCS{decoded_text}\`.

\`\`\`text
cm9va2llX3NpZ25hbA==
\`\`\`

All required input is shown above; no network connection is needed.`,
        'UCS{rookie_signal}'
      ),
      challenge(
        'hidden-in-markup',
        'Hidden in Markup',
        'Web',
        150,
        `The visible page says "Coming soon", but its source carries a developer note. Find the \`data-key\` value in the HTML comment and submit it inside \`UCS{...}\`.

\`\`\`html
<main><h1>Coming soon</h1></main>
<!-- release checklist: <span data-key="view-source"></span> -->
\`\`\`

This is a source-reading exercise; there is no hidden website to visit.`,
        'UCS{view-source}'
      ),
      challenge(
        'backward-greeting',
        'Backward Greeting',
        'Reverse',
        200,
        `A tiny program reverses a phrase before displaying it. Recover the original phrase from this output and submit it inside \`UCS{...}\`.

\`\`\`python
# The original program:
print(phrase[::-1])
# Captured output:
# tsrif_esrever
\`\`\`

Keep the underscore and use lowercase letters.`,
        'UCS{reverse_first}'
      ),
      challenge(
        'quiet-login',
        'Quiet Login',
        'Forensics',
        250,
        `Review this authentication log. Which username completed the only successful login? Submit the username inside \`UCS{...}\`; the IP addresses are background evidence.

\`\`\`log
09:00:01 user=drone ip=192.0.2.10 result=denied
09:00:04 user=guest ip=192.0.2.11 result=denied
09:00:09 user=mira ip=192.0.2.12 result=success
09:00:12 user=drone ip=192.0.2.10 result=denied
\`\`\``,
        'UCS{mira}'
      ),
      challenge(
        'octet-postcard',
        'Octet Postcard',
        'Misc',
        300,
        `Each decimal number below is one ASCII character. Read the characters from left to right and wrap the resulting phrase in \`UCS{...}\`.

\`\`\`text
99 108 117 98 95 114 101 97 100 121
\`\`\`

The number 95 represents an underscore, not a space.`,
        'UCS{club_ready}'
      ),
    ]
  ),
  event(
    'ucs-demo-web-crypto-2026-08',
    'UCS Web & Crypto Lab',
    '2026-08-22',
    'Follow browser artifacts and decode small cryptographic clues offline.',
    [
      // Deliberately shares an ID with another event, with a different answer.
      challenge(
        'signal',
        'Second Signal',
        'Crypto',
        150,
        `This event uses a different signal. Interpret each pair of hexadecimal digits as an ASCII byte, then wrap the resulting phrase in \`UCS{...}\`.

\`\`\`text
77 65 62 5f 73 69 67 6e 61 6c
\`\`\`

This is the complete capture; no earlier event is required.`,
        'UCS{web_signal}'
      ),
      challenge(
        'cookie-crumbs',
        'Cookie Crumbs',
        'Web',
        200,
        `A browser sent this Cookie header. Extract the \`access\` value and URL-decode it once. Submit the decoded value inside \`UCS{...}\`.

\`\`\`http
GET /club HTTP/1.1
Host: demo.invalid
Cookie: session=guest; theme=night; access=member%5Fpreview
\`\`\`

The hostname is fictional. Work only from the captured header.`,
        'UCS{member_preview}'
      ),
      challenge(
        'rotating-key',
        'Rotating Key',
        'Crypto',
        250,
        `The club encoded a phrase with ROT13: each letter moves thirteen places through the alphabet, while punctuation stays unchanged. Decode this text and submit it inside \`UCS{...}\`.

\`\`\`text
fuvsg_unccraf
\`\`\`

Applying ROT13 a second time reverses the encoding.`,
        'UCS{shift_happens}'
      ),
      challenge(
        'small-xor',
        'Small XOR',
        'Crypto',
        300,
        `Every ASCII byte of a phrase was XORed with the single-byte key \`0x2a\`. XOR these hexadecimal bytes with the same key, decode as ASCII, and submit the phrase inside \`UCS{...}\`.

\`\`\`text
52 45 58 75 43 59 75 4c 5f 44
\`\`\`

All numbers in the capture are hexadecimal.`,
        'UCS{xor_is_fun}'
      ),
      challenge(
        'route-inspector',
        'Route Inspector',
        'Web',
        350,
        `Read this JavaScript route registration. Decode the URL escapes and find the final path segment. Submit only that segment inside \`UCS{...}\`, without slashes.

\`\`\`javascript
const path = decodeURIComponent('/vault/%70%72%61%63%74%69%63%65');
router.get(path, () => 'Welcome to the club');
\`\`\`

No server is running; the source contains all necessary information.`,
        'UCS{practice}'
      ),
    ]
  ),
  event(
    'ucs-demo-forensics-2026-07',
    'UCS Forensics Night',
    '2026-07-18',
    'Reconstruct a small incident from logs, fragments, and captured code.',
    [
      challenge(
        'midnight-trace',
        'Midnight Trace',
        'Forensics',
        100,
        `Find the filename in the first successful upload after midnight UTC. Status 201 means success. Submit the full filename inside \`UCS{...}\`.

\`\`\`log
2026-07-17T23:59:59Z POST /upload file=old.txt status=201
2026-07-18T00:00:02Z POST /upload file=secret.bin status=403
2026-07-18T00:03:17Z POST /upload file=case_notes.txt status=201
2026-07-18T00:04:00Z GET /upload file=decoy.txt status=200
\`\`\``,
        'UCS{case_notes.txt}'
      ),
      challenge(
        'split-evidence',
        'Split Evidence',
        'Forensics',
        200,
        `Three fragments of a text file arrived out of order. Sort by numeric index, then join each \`data\` value without spaces. Submit the recovered text inside \`UCS{...}\`.

\`\`\`text
index=3 data=und
index=1 data=trace_
index=2 data=fo
\`\`\`

The index and data labels are metadata, not part of the message.`,
        'UCS{trace_found}'
      ),
      challenge(
        'packet-notes',
        'Packet Notes',
        'Forensics',
        250,
        `A capture contains DNS TXT fragments. Ignore responses for other names, order the \`evidence.invalid\` fragments by sequence, and join their data. Submit the result inside \`UCS{...}\`.

\`\`\`text
name=evidence.invalid sequence=02 data=packet
name=noise.invalid sequence=00 data=decoy
name=evidence.invalid sequence=03 data=_trail
name=evidence.invalid sequence=01 data=follow_
\`\`\`

These fictional names do not need to resolve.`,
        'UCS{follow_packet_trail}'
      ),
      challenge(
        'array-walker',
        'Array Walker',
        'Reverse',
        300,
        `Determine the text printed by this Python code. Each stored value is seven greater than its ASCII character. Submit the printed text inside \`UCS{...}\`.

\`\`\`python
encoded = [122, 123, 104, 106, 114, 102, 123, 121, 104, 106, 108]
print(''.join(chr(value - 7) for value in encoded))
\`\`\`

You can trace it by hand or run the snippet locally.`,
        'UCS{stack_trace}'
      ),
      challenge(
        'live-memory-desk',
        'Live Memory Desk',
        'Misc',
        400,
        `Reference-only demo challenge. In the fictional original event, teams inspected a short-lived virtual machine and recovered a marker from its live process memory.

The virtual machine and its memory image are not included in this demo archive. There is no reproducible input or accepted practice answer. The archived points and solves illustrate historical results only.`,
        null,
        'The original live virtual machine and memory image are not available in this demo archive.'
      ),
    ]
  ),
]

export const seedDemoArchives = async (db: DatabaseClient) => {
  const result = { created: [] as string[], skipped: [] as string[] }
  for (const archive of demoArchives) {
    const created = await db.transaction(async tx => {
      const inserted = await tx
        .insert(clubArchives)
        .values(archive.summary)
        .onConflictDoNothing({ target: clubArchives.id })
        .returning({ id: clubArchives.id })
      if (!inserted.length) return false
      await tx.insert(clubArchiveChallenges).values(
        archive.challenges.map(item => ({
          ...item,
          archiveId: archive.summary.id,
        }))
      )
      return true
    })
    result[created ? 'created' : 'skipped'].push(archive.summary.id)
  }
  return result
}

export default defineCommand({
  meta: {
    name: 'seed-archives',
    description:
      'Add three fictional demo archives for practice; skip existing archive IDs and preserve live event data',
  },
  run: async () => {
    const result = await withDbAndRedis(({ db }) => seedDemoArchives(db))
    console.log(
      `Demo archives: ${result.created.length} created, ${result.skipped.length} already present.`
    )
    for (const id of result.created) console.log(`Created ${id}`)
    for (const id of result.skipped) console.log(`Skipped ${id}`)
  },
})
