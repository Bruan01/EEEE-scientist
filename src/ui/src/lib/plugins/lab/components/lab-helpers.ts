import { formatDistanceToNowStrict } from 'date-fns'
import type { LabAgentInstance, LabQuest, LabQuestEventItem, LabTemplate } from '@/lib/api/lab'
import type { AgentDescriptor } from '@/lib/api/projects'

export const LAB_AVATAR_PALETTE = [
  '#FF6B6B',
  '#FF9F1C',
  '#F9C74F',
  '#90BE6D',
  '#43AA8B',
  '#2EC4B6',
  '#00B4D8',
  '#4D96FF',
  '#277DA1',
  '#F28482',
  '#F3722C',
  '#F94144',
]

export const labStatusToneMap: Record<string, string> = {
  idle: 'bg-[#EFEFEF] text-[#5A5A5A]',
  working: 'bg-[#E6E6E6] text-[#444444]',
  running: 'bg-[#E6E6E6] text-[#444444]',
  blocked: 'bg-[#DEDEDE] text-[#4A4A4A]',
  failed: 'bg-[#DEDEDE] text-[#4A4A4A]',
  completed: 'bg-[#ECECEC] text-[#3F3F3F]',
  waiting: 'bg-[#EFE6DA] text-[#6F5330]',
  online: 'bg-[#ECECEC] text-[#3F3F3F]',
  offline: 'bg-[#E0E0E0] text-[#4A4A4A]',
  unbound: 'bg-[#EFEFEF] text-[#5A5A5A]',
  pending: 'bg-[#E8E8E8] text-[#4F4F4F]',
  archived: 'bg-[#ECECEC] text-[#3F3F3F]',
  archive_failed: 'bg-[#DEDEDE] text-[#4A4A4A]',
  local_only: 'bg-[#EFEFEF] text-[#5A5A5A]',
}

export const getLabStatusTone = (status?: string | null) => {
  if (!status) return 'bg-[#EFEFEF] text-[#5A5A5A]'
  return labStatusToneMap[status.toLowerCase()] ?? 'bg-[#EFEFEF] text-[#5A5A5A]'
}

export const normalizeLabStatus = (status?: string | null) => {
  const normalized = status?.toLowerCase() ?? 'idle'
  if (normalized === 'running' || normalized === 'working') return 'working'
  if (normalized === 'blocked' || normalized === 'failed') return 'blocked'
  return normalized
}

export const isLabWorkingStatus = (status?: string | null) => {
  const normalized = status?.toLowerCase() ?? 'idle'
  return (
    normalized === 'pending' ||
    normalized === 'running' ||
    normalized === 'waiting' ||
    normalized === 'working'
  )
}

export const isLabWaitingStatus = (status?: string | null) => {
  const normalized = status?.toLowerCase() ?? ''
  return normalized === 'waiting'
}

export const formatRelativeTime = (timestamp?: string | null) => {
  if (!timestamp) return 'n/a'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return 'n/a'
  return formatDistanceToNowStrict(date, { addSuffix: true })
}

export const hashSeed = (seed: string) => {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

export const pickAvatarFrameColor = (seed?: string | null, fallbackIndex = 0) => {
  if (!seed) {
    return LAB_AVATAR_PALETTE[fallbackIndex % LAB_AVATAR_PALETTE.length]
  }
  const index = hashSeed(seed) % LAB_AVATAR_PALETTE.length
  return LAB_AVATAR_PALETTE[index]
}

export const buildAvatarColorMap = (agents: LabAgentInstance[]) => {
  const palette = LAB_AVATAR_PALETTE
  const paletteKeys = palette.map((color) => color.toLowerCase())
  const counts = new Map<string, number>()
  const result = new Map<string, string>()

  const bump = (color: string) => {
    const key = color.toLowerCase()
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  agents.forEach((agent) => {
    if (!agent.avatar_frame_color) return
    result.set(agent.instance_id, agent.avatar_frame_color)
    if (paletteKeys.includes(agent.avatar_frame_color.toLowerCase())) {
      bump(agent.avatar_frame_color)
    }
  })

  const missing = agents
    .filter((agent) => !result.has(agent.instance_id))
    .sort((a, b) => a.instance_id.localeCompare(b.instance_id))

  missing.forEach((agent) => {
    const startIndex = hashSeed(agent.instance_id) % palette.length
    let minCount = Number.MAX_SAFE_INTEGER
    paletteKeys.forEach((key) => {
      const count = counts.get(key) ?? 0
      if (count < minCount) minCount = count
    })

    let chosenIndex = startIndex
    for (let offset = 0; offset < palette.length; offset += 1) {
      const idx = (startIndex + offset) % palette.length
      const key = paletteKeys[idx]
      const count = counts.get(key) ?? 0
      if (count === minCount) {
        chosenIndex = idx
        break
      }
    }

    const chosenColor = palette[chosenIndex]
    result.set(agent.instance_id, chosenColor)
    bump(chosenColor)
  })

  return result
}

export type TemplateTheme = {
  gradient: string
  accent: string
  icon: string
}

export const TEMPLATE_THEMES: Record<string, TemplateTheme> = {
  reproducer: {
    gradient: 'from-[#4A9B8C]/15 via-[#2D5A52]/10 to-transparent',
    accent: '#4A9B8C',
    icon: 'git-branch',
  },
  researcher: {
    gradient: 'from-[#9B8FB8]/18 via-[#C4B1D6]/10 to-transparent',
    accent: '#9B8FB8',
    icon: 'sparkles',
  },
  hypothesizer: {
    gradient: 'from-[#6E7F9C]/18 via-[#9FB0C7]/10 to-transparent',
    accent: '#6E7F9C',
    icon: 'sigma',
  },
  experimenter: {
    gradient: 'from-[#CC9F6D]/18 via-[#E1C09A]/10 to-transparent',
    accent: '#CC9F6D',
    icon: 'beaker',
  },
  analyst: {
    gradient: 'from-[#53B0AE]/18 via-[#8AD0CA]/10 to-transparent',
    accent: '#53B0AE',
    icon: 'line-chart',
  },
  writer: {
    gradient: 'from-[#BC8E87]/18 via-[#D7B3AE]/10 to-transparent',
    accent: '#BC8E87',
    icon: 'feather',
  },
  reviewer: {
    gradient: 'from-[#9E9E9E]/18 via-[#C9C9C9]/10 to-transparent',
    accent: '#9E9E9E',
    icon: 'search-check',
  },
}

export const getTemplateTheme = (templateKey?: string | null): TemplateTheme => {
  if (!templateKey) {
    return TEMPLATE_THEMES.reviewer
  }
  return TEMPLATE_THEMES[templateKey] ?? TEMPLATE_THEMES.reviewer
}

export const resolveTemplateLogo = (template?: LabTemplate | null) => {
  if (!template) return '/logo-small.png'
  if (template.logo_svg_path) return template.logo_svg_path
  return '/logo-small.png'
}

const ROLE_LOGO_MAP: Record<string, string> = {
  pi: '/agent-logos/pi.png',
  reproducer: '/agent-logos/Reproducer.png',
  researcher: '/agent-logos/Ideator.png',
  reviewer: '/agent-logos/Reviewer.png',
  'idea-reviewer': '/agent-logos/idea-reviewer.png',
  writer: '/agent-logos/Writer.png',
  experimenter: '/agent-logos/Experimenter.png',
  analyst: '/agent-logos/analyst.svg',
  hypothesizer: '/agent-logos/hypothesizer.svg',
}

const resolveLogoKey = (text: string) => {
  const value = text.toLowerCase()
  if (value === 'pi' || value.startsWith('pi-') || value.startsWith('pi_') || value.startsWith('pi ')) {
    return 'pi'
  }
  if (value.includes('analysis-experimenter') || value.includes('analysisexperimenter')) {
    return 'experimenter'
  }
  if (value.includes('idea-reviewer') || value.includes('ideareviewer')) {
    return 'idea-reviewer'
  }
  if (value.includes('reproducer')) return 'reproducer'
  if (value.includes('researcher')) return 'researcher'
  if (value.includes('reviewer')) return 'reviewer'
  if (value.includes('writer')) return 'writer'
  if (value.includes('experimenter')) return 'experimenter'
  if (value.includes('analyst')) return 'analyst'
  if (value.includes('hypothesizer')) return 'hypothesizer'
  return null
}

export const resolveAgentLogo = (
  agent?: LabAgentInstance | null,
  template?: LabTemplate | null
) => {
  if (!agent) return '/logo-small.png'
  const explicit = agent.avatar_logo?.trim()
  if (explicit) return explicit
  if (template?.logo_svg_path) return template.logo_svg_path
  const composite = [
    template?.template_key,
    template?.role,
    agent.display_name,
    agent.agent_id,
  ]
    .filter(Boolean)
    .join(' ')
  const key = resolveLogoKey(composite)
  if (key && ROLE_LOGO_MAP[key]) return ROLE_LOGO_MAP[key]
  return '/logo-small.png'
}

export const resolveAgentDisplayName = (agent: LabAgentInstance) => {
  const trimmed = agent.display_name?.trim()
  return trimmed || agent.agent_id
}

export const resolveAgentMentionLabel = (agent: LabAgentInstance) => {
  const rawLabel = agent.mention_label?.trim() || agent.agent_id
  return rawLabel.startsWith('@') ? rawLabel : `@${rawLabel}`
}

export const shouldShowAgentMentionLabel = (
  agent: LabAgentInstance,
  displayNameOverride?: string | null
) => {
  const displayName = (displayNameOverride ?? resolveAgentDisplayName(agent)).trim()
  const mentionLabel = resolveAgentMentionLabel(agent).replace(/^@/, '').trim()
  if (!displayName) return true
  return mentionLabel.toLowerCase() !== displayName.toLowerCase()
}

export const buildAgentDescriptor = (
  agent: LabAgentInstance,
  template?: LabTemplate | null
): AgentDescriptor => {
  return {
    id: agent.agent_id,
    label: agent.mention_label ?? `@${agent.agent_id}`,
    description: agent.profile_md ?? undefined,
    role: template?.role ?? agent.agent_id,
    source: 'cli',
    execution_target: template?.execution_target ?? 'cli',
    agent_engine: template?.agent_engine ?? undefined,
  }
}

export const resolveQuestLabel = (quest?: LabQuest | null) => {
  if (!quest) return 'Unassigned'
  return quest.title || 'Untitled Quest'
}

export const resolveAgentStatusLabel = (
  agent?: LabAgentInstance | null,
  waitingForAnswer: boolean = false
) => {
  if (!agent) return 'Idle'
  const status = agent.status?.trim()
  if (status) {
    const normalized = status.toLowerCase()
    if (normalized === 'waiting') return waitingForAnswer ? 'Waiting for answer' : 'Paused'
    return status
  }
  return agent.active_quest_id ? 'Assigned' : 'Idle'
}

const MOTTOS: Record<string, string[]> = {
  reproducer: [
    'In God we trust; all others must bring data. - W. Edwards Deming',
    'Reproducibility is the cornerstone of science.',
    'The goal of reproducibility is not perfection, it\'s reliability.',
    'If you can\'t replicate it, you haven\'t proven it.',
    'Good experiments are like good recipes - they work every time.',
    'Trust, but verify. - Ronald Reagan',
    'A well-documented experiment is a gift to your future self.',
    'Environment is everything - from seeds to silicon.',
    'Science advances one successful replication at a time.',
    'The devil is in the dependencies.',
    'Code that runs once is a miracle; code that runs twice is science.',
    'Reproducibility transforms anecdotes into evidence.',
    'What I cannot create, I do not understand. - Richard Feynman',
    'Consistency is the hallmark of the unimaginative. - Oscar Wilde (but we like it anyway)',
    'Measure twice, cut once.',
    'The only constant is change - so pin your versions.',
    'A result without reproducibility is just a story.',
    'First, make it work. Then, make it work again.',
    'Good code is its own best documentation. - Steve McConnell',
    'Errors using inadequate data are much less than those using no data at all. - Charles Babbage',
    'Nature uses only the longest threads to weave her patterns. - Richard Feynman',
    'Simplicity is the ultimate sophistication. - Leonardo da Vinci',
    'The most exciting phrase in science is not \'Eureka!\' but \'That\'s funny...\' - Isaac Asimov',
    'An experiment is a question which science poses to Nature. - Max Planck',
    'Science is organized knowledge. - Herbert Spencer',
    'Data beats opinions.',
    'Clean code always looks like it was written by someone who cares. - Robert C. Martin',
    'Version control is a love letter to your future self.',
    'Debugging is twice as hard as writing code. - Brian Kernighan',
    'The best code is no code at all.',
  ],
  researcher: [
    'Imagination is more important than knowledge. - Albert Einstein',
    'The best way to have a good idea is to have lots of ideas. - Linus Pauling',
    'Creativity is intelligence having fun. - Albert Einstein',
    'Innovation distinguishes between a leader and a follower. - Steve Jobs',
    'Ideas are like rabbits. You get a couple and learn how to handle them, and soon you have a dozen. - John Steinbeck',
    'The only way to discover the limits of the possible is to go beyond them into the impossible. - Arthur C. Clarke',
    'Logic will get you from A to B. Imagination will take you everywhere. - Albert Einstein',
    'Every great advance in science has issued from a new audacity of imagination. - John Dewey',
    'The world as we have created it is a process of our thinking. - Albert Einstein',
    'Curiosity is the engine of achievement. - Ken Robinson',
    'The true sign of intelligence is not knowledge but imagination. - Albert Einstein',
    'Discovery consists of seeing what everybody has seen and thinking what nobody has thought. - Albert Szent-Gyorgyi',
    'If I have seen further it is by standing on the shoulders of giants. - Isaac Newton',
    'The important thing is not to stop questioning. - Albert Einstein',
    'What if? - Every scientist ever',
    'The mind that opens to a new idea never returns to its original size. - Albert Einstein',
    'Research is to see what everybody else has seen, and to think what nobody else has thought. - Albert Szent-Gyorgyi',
    'Great ideas often receive violent opposition from mediocre minds. - Albert Einstein',
    'Genius is one percent inspiration and ninety-nine percent perspiration. - Thomas Edison',
    'The only true wisdom is in knowing you know nothing. - Socrates',
    'Stay hungry, stay foolish. - Steve Jobs',
    'Think different. - Apple',
    'All our dreams can come true, if we have the courage to pursue them. - Walt Disney',
    'Problems cannot be solved at the same level of awareness that created them. - Albert Einstein',
    'The greatest obstacle to discovery is not ignorance - it is the illusion of knowledge. - Daniel Boorstin',
    'An idea that is not dangerous is unworthy of being called an idea at all. - Oscar Wilde',
    'The difficulty lies not so much in developing new ideas as in escaping from old ones. - John Maynard Keynes',
    'Chance favors the prepared mind. - Louis Pasteur',
    'Be alone, that is the secret of invention. - Nikola Tesla',
    'Everything you can imagine is real. - Pablo Picasso',
  ],
  hypothesizer: [
    'A theory is a good theory if it satisfies two requirements: it must describe observations and make predictions. - Stephen Hawking',
    'The formulation of the problem is often more essential than its solution. - Albert Einstein',
    'A hypothesis is a proposition made as a basis for reasoning, without assumption of its truth.',
    'No amount of experimentation can ever prove me right; a single experiment can prove me wrong. - Albert Einstein',
    'The scientific method is simply a way of not fooling yourself. - Richard Feynman',
    'It is a capital mistake to theorize before one has data. - Arthur Conan Doyle',
    'A fact is a simple statement that everyone believes. A hypothesis is a novel suggestion that no one wants to believe. - Edward Teller',
    'Science is built up of facts, as a house is built of stones; but an accumulation of facts is no more a science than a heap of stones is a house. - Henri Poincare',
    'The great tragedy of science - the slaying of a beautiful hypothesis by an ugly fact. - Thomas Huxley',
    'All truths are easy to understand once they are discovered; the point is to discover them. - Galileo Galilei',
    'The hypothesis may be wrong, but the experiment is never wrong.',
    'A good hypothesis is testable, falsifiable, and predictive.',
    'Hypothesis testing is the engine of scientific progress.',
    'The null hypothesis is guilty until proven innocent.',
    'Strong theories make bold predictions.',
    'Correlation does not imply causation. - Every statistician',
    'The plural of anecdote is not data.',
    'Extraordinary claims require extraordinary evidence. - Carl Sagan',
    'Science progresses one funeral at a time. - Max Planck',
    'The universe is not only queerer than we suppose, but queerer than we can suppose. - J.B.S. Haldane',
    'What we observe is not nature itself, but nature exposed to our method of questioning. - Werner Heisenberg',
    'The most incomprehensible thing about the world is that it is comprehensible. - Albert Einstein',
    'Every genuine test of a theory is an attempt to falsify it. - Karl Popper',
    'We are stuck with technology when what we really want is just stuff that works. - Douglas Adams',
    'The important thing in science is not so much to obtain new facts as to discover new ways of thinking about them. - William Lawrence Bragg',
    'Prediction is very difficult, especially about the future. - Niels Bohr',
    'In theory, theory and practice are the same. In practice, they are not.',
    'A model is a lie that helps you see the truth. - Howard Skipper',
    'The map is not the territory. - Alfred Korzybski',
    'Theories crumble, but good observations never fade. - Harlow Shapley',
  ],
  experimenter: [
    'I have not failed. I\'ve just found 10,000 ways that won\'t work. - Thomas Edison',
    'Experiment is the sole judge of scientific truth. - Richard Feynman',
    'The experiment serves two purposes: it allows observation of new facts, and it verifies the results of theoretical deductions. - Niels Bohr',
    'If your experiment needs statistics, you ought to have done a better experiment. - Ernest Rutherford',
    'An experiment is never a failure solely because it fails to achieve predicted results. - Robert Pirsig',
    'The best scientist is open to experience and begins with romance - the idea that anything is possible. - Ray Bradbury',
    'Research is formalized curiosity. - Zora Neale Hurston',
    'Every experiment proves something. If it doesn\'t prove what you wanted it to prove, it proves something else.',
    'The laboratory is the temple of the scientist.',
    'Success is a lousy teacher. It seduces smart people into thinking they can\'t lose. - Bill Gates',
    'The only real mistake is the one from which we learn nothing. - Henry Ford',
    'Science is nothing but trained and organized common sense. - Thomas Huxley',
    'Experimentation is the least arrogant method of gaining knowledge. - Isaac Asimov',
    'The scientist is not a person who gives the right answers, he\'s one who asks the right questions. - Claude Levi-Strauss',
    'In the fields of observation, chance favors only the prepared mind. - Louis Pasteur',
    'Trial and error is the mother of success.',
    'You can observe a lot just by watching. - Yogi Berra',
    'The harder I work, the luckier I get.',
    'An expert is a person who has made all the mistakes that can be made in a very narrow field. - Niels Bohr',
    'Science is a way of thinking much more than it is a body of knowledge. - Carl Sagan',
    'Experiment and theory go hand in hand.',
    'The experiment must be reproducible - it should fail in the same way each time.',
    'Progress lies in the direction of more and more experiment. - Aldous Huxley',
    'There are no shortcuts to any place worth going.',
    'Fortune favors the bold. - Virgil',
    'The best time to plant a tree was 20 years ago. The second best time is now.',
    'Data is the new oil. - Clive Humby',
    'One accurate measurement is worth a thousand expert opinions. - Grace Hopper',
    'Science is the belief in the ignorance of experts. - Richard Feynman',
    'Do not wait; the time will never be \'just right.\' - Napoleon Hill',
  ],
  writer: [
    'Easy reading is damn hard writing. - Nathaniel Hawthorne',
    'A picture is worth a thousand words, but a table is worth a thousand pictures.',
    'The first draft is just you telling yourself the story. - Terry Pratchett',
    'Writing is thinking on paper. - William Zinsser',
    'Clarity is the counterbalance of profound thoughts. - Luc de Clapiers',
    'Write to be understood, speak to be heard, read to grow.',
    'The scariest moment is always just before you start. - Stephen King',
    'There is no great writing, only great rewriting. - Justice Brandeis',
    'Good prose is like a window pane. - George Orwell',
    'Writing is the painting of the voice. - Voltaire',
    'If you want to be a writer, you must do two things: read a lot and write a lot. - Stephen King',
    'The pen is mightier than the sword. - Edward Bulwer-Lytton',
    'Start writing, no matter what. The water does not flow until the faucet is turned on. - Louis L\'Amour',
    'A word after a word after a word is power. - Margaret Atwood',
    'Fill your paper with the breathings of your heart. - William Wordsworth',
    'The role of a writer is not to say what we can all say, but what we are unable to say. - Anais Nin',
    'I can shake off everything as I write; my sorrows disappear, my courage is reborn. - Anne Frank',
    'Either write something worth reading or do something worth writing. - Benjamin Franklin',
    'You don\'t start out writing good stuff. You start out writing crap and thinking it\'s good stuff. - Octavia Butler',
    'The difference between the right word and the almost right word is the difference between lightning and a lightning bug. - Mark Twain',
    'The first draft of anything is garbage. - Ernest Hemingway',
    'Brevity is the soul of wit. - William Shakespeare',
    'Make it simple. Make it memorable. Make it inviting to look at. - Leo Burnett',
    'Vigorous writing is concise. - William Strunk Jr.',
    'The secret of good writing is to strip every sentence to its cleanest components. - William Zinsser',
    'A good essay must have this permanent quality about it; it must draw its curtain round us. - Virginia Woolf',
    'The greatest part of a writer\'s time is spent in reading; a man will turn over half a library to make one book. - Samuel Johnson',
    'Papers are love letters to your future self.',
    'Cut the fancy words. Say what you mean.',
    'The abstract is the trailer for the paper - make it count.',
  ],
  analyst: [
    'Without data, you\'re just another person with an opinion. - W. Edwards Deming',
    'Torture the data, and it will confess to anything. - Ronald Coase',
    'The goal is to turn data into information, and information into insight. - Carly Fiorina',
    'In God we trust. All others must bring data.',
    'Data is not information, information is not knowledge, knowledge is not wisdom. - Clifford Stoll',
    'The world is one big data problem. - Andrew McAfee',
    'Numbers have an important story to tell. They rely on you to give them a voice. - Stephen Few',
    'Statistics are like bikinis. What they reveal is suggestive, but what they conceal is vital. - Aaron Levenstein',
    'The price of light is less than the cost of darkness. - Arthur Nielsen',
    'It\'s easy to lie with statistics. It\'s hard to tell the truth without them. - Andrejs Dunkels',
    'Errors using inadequate data are much less than those using no data at all. - Charles Babbage',
    'If you can\'t measure it, you can\'t improve it. - Peter Drucker',
    'Not everything that counts can be counted, and not everything that can be counted counts. - William Bruce Cameron',
    'Big data is like teenage sex: everyone talks about it, nobody really knows how to do it. - Dan Ariely',
    'The numbers don\'t lie, but they don\'t always tell the whole truth.',
    'Correlation is not causation, but it sure is a hint.',
    'A single outlier can ruin your day.',
    'The plural of anecdote is not data.',
    'All models are wrong, but some are useful. - George Box',
    'Data matures like wine, applications like fish. - James Governor',
    'Information is the oil of the 21st century, and analytics is the combustion engine. - Peter Sondergaard',
    'Think like a wise man but communicate in the language of the people. - William Butler Yeats',
    'What gets measured gets managed. - Peter Drucker',
    'Hide not your talents. They for use were made. - Benjamin Franklin',
    'The only statistics you can trust are those you falsified yourself. - Winston Churchill (apocryphal)',
    'There are three kinds of lies: lies, damned lies, and statistics. - Mark Twain (quoting Disraeli)',
    'A point of view can be a dangerous luxury when substituted for insight and understanding. - Marshall McLuhan',
    'The most valuable commodity I know of is information. - Gordon Gekko (Wall Street)',
    'Data science is the sexiest job of the 21st century. - Harvard Business Review',
    'Trust the data, but verify it thrice.',
  ],
  reviewer: [
    'It is the mark of an educated mind to be able to entertain a thought without accepting it. - Aristotle',
    'Criticism may not be agreeable, but it is necessary. - Winston Churchill',
    'The highest form of scholarship is good reviewing.',
    'Peer review: because even Einstein needed a second opinion.',
    'A critic is someone who knows the way but can\'t drive the car. - Kenneth Tynan',
    'Constructive criticism is about finding something good and positive to soften the blow to the negative feedback. - Sandip Maiti',
    'The eye sees only what the mind is prepared to comprehend. - Robertson Davies',
    'Judge a man by his questions rather than by his answers. - Voltaire',
    'To avoid criticism, do nothing, say nothing, be nothing. - Elbert Hubbard',
    'Any fool can criticize, condemn, and complain - and most fools do. - Benjamin Franklin',
    'I have yet to see any problem, however complicated, which when looked at in the right way did not become still more complicated. - Poul Anderson',
    'The trouble with most of us is that we would rather be ruined by praise than saved by criticism. - Norman Vincent Peale',
    'Feedback is the breakfast of champions. - Ken Blanchard',
    'Before you criticize someone, walk a mile in their shoes.',
    'A good review is a roadmap for improvement.',
    'The art of being wise is knowing what to overlook. - William James',
    'Honest criticism is hard to take, particularly from a relative, a friend, an acquaintance, or a stranger. - Franklin P. Jones',
    'Reviewers are like editors, with tenure.',
    'Science advances through argument and counterargument.',
    'The best mirror is an old friend. - George Herbert',
    'Quality is not an act, it is a habit. - Aristotle',
    'Excellence is not a destination but a continuous journey. - Brian Tracy',
    'The only real mistake is the one from which we learn nothing. - Henry Ford',
    'Iron sharpens iron.',
    'Two heads are better than one.',
    'The purpose of review is improvement, not judgment.',
    'Reviewer 2 was right all along.',
    'Good judgment comes from experience, and experience comes from bad judgment. - Rita Mae Brown',
    'A critic is a man who creates nothing and thereby feels qualified to judge the work of creative men. - Robert Heinlein',
    'Every criticism is an opportunity in disguise.',
  ],
  default: [
    'The only way to do great work is to love what you do. - Steve Jobs',
    'Science is a wonderful thing if one does not have to earn one\'s living at it. - Albert Einstein',
    'Research is what I\'m doing when I don\'t know what I\'m doing. - Wernher von Braun',
    'The important thing is not to stop questioning. - Albert Einstein',
    'Stay curious.',
  ],
}

export const generateMotto = (templateKey: string | null | undefined, seed: string) => {
  const options = MOTTOS[templateKey || ''] || MOTTOS.default
  const index = hashSeed(seed) % options.length
  return options[index]
}

export type QuestPipelineStageStatus = 'done' | 'active' | 'pending' | 'skipped'

export type QuestPipelineStage = {
  key: string
  label: string
  optional?: boolean
  match: (event: LabQuestEventItem) => boolean
}

export type QuestPipelineStageState = {
  stage: QuestPipelineStage
  status: QuestPipelineStageStatus
  event?: LabQuestEventItem | null
}

export const normalizeStageKey = (event: LabQuestEventItem) => {
  return String(event.stage_key || '').toLowerCase()
}

const matchEventType = (eventType: string) => {
  return (event: LabQuestEventItem) => event.event_type === eventType
}

const matchExperimentMain = (event: LabQuestEventItem) => {
  if (event.event_type !== 'experiment.finished') return false
  const stageKey = normalizeStageKey(event)
  return stageKey !== 'analysis'
}

const matchExperimentAnalysis = (event: LabQuestEventItem) => {
  return event.event_type === 'experiment.finished' && normalizeStageKey(event) === 'analysis'
}

export const QUEST_PIPELINE_STAGES: QuestPipelineStage[] = [
  { key: 'baseline', label: 'Baseline ready', match: matchEventType('baseline.ready') },
  { key: 'outline', label: 'PI outline ready', match: matchEventType('pi.outline_ready') },
  { key: 'limitations', label: 'Limitations ready', match: matchEventType('pi.limitations_ready') },
  { key: 'selection', label: 'Direction selected', match: matchEventType('pi.limitation_selected') },
  { key: 'idea', label: 'Idea created', match: matchEventType('idea.created') },
  { key: 'review', label: 'Idea review ready', match: matchEventType('idea.review_ready') },
  { key: 'decision', label: 'Decision validate', match: matchEventType('decision.validate') },
  { key: 'experiment', label: 'Experiment finished', match: matchExperimentMain },
  { key: 'outcome', label: 'Outcome reviewed', match: matchEventType('pi.outcome_reviewed') },
  { key: 'promotion', label: 'Branch promoted', match: matchEventType('branch.promoted'), optional: true },
  { key: 'write_outline', label: 'Write outline ready', match: matchEventType('write.outline_ready') },
  { key: 'write_needs', label: 'Write needs experiment', match: matchEventType('write.needs_experiment'), optional: true },
  { key: 'analysis', label: 'Analysis experiment', match: matchExperimentAnalysis, optional: true },
  { key: 'write_draft', label: 'Write draft ready', match: matchEventType('write.draft_ready') },
  { key: 'write_self_review', label: 'Write self-review ready', match: matchEventType('write.self_review_ready') },
  { key: 'write_review', label: 'Write review ready', match: matchEventType('write.review_ready') },
  { key: 'write_revision', label: 'Write revision ready', match: matchEventType('write.revision_ready'), optional: true },
  { key: 'write_completed', label: 'Write completed', match: matchEventType('write.completed') },
]

export const buildQuestPipeline = (events: LabQuestEventItem[]): QuestPipelineStageState[] => {
  if (!events || events.length === 0) {
    return QUEST_PIPELINE_STAGES.map((stage) => ({
      stage,
      status: 'pending',
      event: null,
    }))
  }

  const sorted = [...events].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
    return aTime - bTime
  })

  const stageCount = QUEST_PIPELINE_STAGES.length
  const stageEvents: Array<LabQuestEventItem | null> = Array.from(
    { length: stageCount },
    () => null
  )
  const stageHasEvent = new Array(stageCount).fill(false)

  sorted.forEach((event) => {
    QUEST_PIPELINE_STAGES.forEach((stage, index) => {
      if (!stage.match(event)) return
      stageEvents[index] = event
      stageHasEvent[index] = true
    })
  })

  const hasLaterEvent = new Array(stageCount).fill(false)
  let seenLater = false
  for (let i = stageCount - 1; i >= 0; i -= 1) {
    hasLaterEvent[i] = seenLater
    if (stageHasEvent[i]) {
      seenLater = true
    }
  }

  let activeIndex = -1
  for (let i = 0; i < stageCount; i += 1) {
    if (stageHasEvent[i]) continue
    const stage = QUEST_PIPELINE_STAGES[i]
    if (stage.optional && hasLaterEvent[i]) continue
    activeIndex = i
    break
  }

  return QUEST_PIPELINE_STAGES.map((stage, index) => {
    const event = stageEvents[index]
    let status: QuestPipelineStageStatus = 'pending'
    if (event) {
      status = 'done'
    } else if (stage.optional && hasLaterEvent[index]) {
      status = 'skipped'
    } else if (index === activeIndex) {
      status = 'active'
    }
    return {
      stage,
      status,
      event,
    }
  })
}
