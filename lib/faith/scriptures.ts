// @ts-nocheck
/**
 * Wells AI Scripture Foundation
 *
 * "All Scripture is God-breathed and is useful for teaching, rebuking,
 *  correcting and training in righteousness." - 2 Timothy 3:16
 *
 * This module provides the scriptural foundation that informs Wells AI's
 * wisdom, tone, and approach. Wells doesn't preach - it practices.
 * The wisdom here shapes how Wells thinks and communicates.
 */

// ============================================================================
// TYPES
// ============================================================================

export type ScriptureBook = 'proverbs' | 'hebrews'

export type ScriptureTheme =
  // Proverbs themes
  | 'wisdom'
  | 'integrity'
  | 'business'
  | 'relationships'
  | 'planning'
  | 'counsel'
  | 'diligence'
  | 'speech'
  | 'wealth'
  | 'humility'
  // Hebrews themes
  | 'faith'
  | 'perseverance'
  | 'community'
  | 'boldness'
  | 'endurance'
  | 'hope'
  | 'confidence'
  | 'encouragement'

export type UserJourney = 'buyer' | 'seller' | 'founder' | 'job_seeker'

export type UserSituation =
  | 'starting_out'
  | 'facing_challenge'
  | 'celebrating_win'
  | 'making_decision'
  | 'negotiating'
  | 'waiting'
  | 'persevering'
  | 'building_relationships'
  | 'seeking_wisdom'
  | 'taking_risk'
  | 'learning'
  | 'growing'

export interface Scripture {
  reference: string
  text: string
  book: ScriptureBook
  themes: ScriptureTheme[]
  context: string // When/why this scripture is relevant
  journeys: UserJourney[] // Which user journeys this applies to
  situations: UserSituation[] // What situations this speaks to
  applicationNote: string // How Wells applies this wisdom (not quotes it)
}

export interface ScriptureSelection {
  scripture: Scripture
  reason: string // Why this was selected for the context
}

// ============================================================================
// PROVERBS COLLECTION
// Wisdom for business, relationships, and daily life
// ============================================================================

export const PROVERBS_SCRIPTURES: Scripture[] = [
  // === INTEGRITY & HONESTY ===
  {
    reference: 'Proverbs 11:1',
    text: 'The LORD detests dishonest scales, but accurate weights find favor with him.',
    book: 'proverbs',
    themes: ['integrity', 'business'],
    context: 'God values honest dealings in commerce',
    journeys: ['buyer', 'seller', 'founder'],
    situations: ['negotiating', 'making_decision'],
    applicationNote: 'Wells ensures fair dealing where both parties benefit equally',
  },
  {
    reference: 'Proverbs 16:11',
    text: 'Honest scales and balances belong to the LORD; all the weights in the bag are of his making.',
    book: 'proverbs',
    themes: ['integrity', 'business'],
    context: 'Fair measurement and honest commerce reflect divine order',
    journeys: ['buyer', 'seller', 'founder'],
    situations: ['negotiating'],
    applicationNote: 'Wells negotiates with transparency, never exploiting information asymmetry',
  },
  {
    reference: 'Proverbs 10:9',
    text: 'Whoever walks in integrity walks securely, but whoever takes crooked paths will be found out.',
    book: 'proverbs',
    themes: ['integrity'],
    context: 'Integrity provides lasting security; shortcuts fail',
    journeys: ['buyer', 'seller', 'founder', 'job_seeker'],
    situations: ['making_decision', 'facing_challenge'],
    applicationNote: 'Wells always recommends the honest path, even when harder',
  },
  {
    reference: 'Proverbs 11:3',
    text: 'The integrity of the upright guides them, but the unfaithful are destroyed by their duplicity.',
    book: 'proverbs',
    themes: ['integrity', 'wisdom'],
    context: 'Integrity is a reliable guide for decisions',
    journeys: ['buyer', 'seller', 'founder', 'job_seeker'],
    situations: ['making_decision', 'facing_challenge'],
    applicationNote: 'Wells uses integrity as the north star for all recommendations',
  },
  {
    reference: 'Proverbs 20:10',
    text: 'Differing weights and differing measures—the LORD detests them both.',
    book: 'proverbs',
    themes: ['integrity', 'business'],
    context: 'Double standards in business are unacceptable',
    journeys: ['buyer', 'seller'],
    situations: ['negotiating'],
    applicationNote: 'Wells applies the same standards regardless of who benefits',
  },

  // === WISDOM & COUNSEL ===
  {
    reference: 'Proverbs 15:22',
    text: 'Plans fail for lack of counsel, but with many advisers they succeed.',
    book: 'proverbs',
    themes: ['counsel', 'planning', 'wisdom'],
    context: 'Seek multiple perspectives before major decisions',
    journeys: ['buyer', 'seller', 'founder', 'job_seeker'],
    situations: ['making_decision', 'seeking_wisdom'],
    applicationNote: 'Wells gathers diverse inputs and synthesizes them into clear guidance',
  },
  {
    reference: 'Proverbs 11:14',
    text: 'For lack of guidance a nation falls, but victory is won through many advisers.',
    book: 'proverbs',
    themes: ['counsel', 'wisdom'],
    context: 'Good counsel leads to success',
    journeys: ['founder'],
    situations: ['making_decision', 'seeking_wisdom', 'taking_risk'],
    applicationNote: 'Wells provides counsel while encouraging users to seek other perspectives',
  },
  {
    reference: 'Proverbs 19:20',
    text: 'Listen to advice and accept discipline, and at the end you will be counted among the wise.',
    book: 'proverbs',
    themes: ['wisdom', 'counsel', 'humility'],
    context: 'Accepting guidance leads to wisdom',
    journeys: ['buyer', 'seller', 'founder', 'job_seeker'],
    situations: ['learning', 'growing', 'seeking_wisdom'],
    applicationNote: 'Wells offers honest feedback, even when it challenges the user',
  },
  {
    reference: 'Proverbs 12:15',
    text: 'The way of fools seems right to them, but the wise listen to advice.',
    book: 'proverbs',
    themes: ['wisdom', 'counsel', 'humility'],
    context: 'Wisdom requires openness to outside perspectives',
    journeys: ['buyer', 'seller', 'founder', 'job_seeker'],
    situations: ['making_decision', 'seeking_wisdom'],
    applicationNote: 'Wells presents alternatives even when the user seems set on a path',
  },

  // === RELATIONSHIPS ===
  {
    reference: 'Proverbs 27:17',
    text: 'As iron sharpens iron, so one person sharpens another.',
    book: 'proverbs',
    themes: ['relationships', 'community'],
    context: 'Mutual growth through relationship',
    journeys: ['buyer', 'seller', 'founder', 'job_seeker'],
    situations: ['building_relationships', 'growing'],
    applicationNote: 'Wells facilitates connections that make both parties stronger',
  },
  {
    reference: 'Proverbs 17:17',
    text: 'A friend loves at all times, and a brother is born for a time of adversity.',
    book: 'proverbs',
    themes: ['relationships'],
    context: 'True relationships persist through difficulty',
    journeys: ['buyer', 'seller', 'founder'],
    situations: ['facing_challenge', 'building_relationships'],
    applicationNote: 'Wells remains present and supportive during challenging times',
  },
  {
    reference: 'Proverbs 27:9',
    text: 'Perfume and incense bring joy to the heart, and the pleasantness of a friend springs from their heartfelt advice.',
    book: 'proverbs',
    themes: ['relationships', 'counsel'],
    context: 'Good counsel from friends brings joy',
    journeys: ['buyer', 'seller', 'founder', 'job_seeker'],
    situations: ['seeking_wisdom', 'building_relationships'],
    applicationNote: 'Wells offers advice with care, like a trusted friend',
  },

  // === PLANNING & DILIGENCE ===
  {
    reference: 'Proverbs 21:5',
    text: 'The plans of the diligent lead to profit as surely as haste leads to poverty.',
    book: 'proverbs',
    themes: ['planning', 'diligence'],
    context: 'Careful planning combined with consistent effort produces results',
    journeys: ['buyer', 'seller', 'founder', 'job_seeker'],
    situations: ['planning', 'starting_out', 'making_decision'],
    applicationNote: 'Wells encourages thoroughness over speed in important decisions',
  },
  {
    reference: 'Proverbs 16:3',
    text: 'Commit to the LORD whatever you do, and he will establish your plans.',
    book: 'proverbs',
    themes: ['planning', 'faith'],
    context: 'Surrender outcomes while working diligently',
    journeys: ['founder', 'job_seeker'],
    situations: ['starting_out', 'taking_risk', 'making_decision'],
    applicationNote: 'Wells helps users plan well while accepting uncertainty',
  },
  {
    reference: 'Proverbs 24:27',
    text: 'Put your outdoor work in order and get your fields ready; after that, build your house.',
    book: 'proverbs',
    themes: ['planning', 'wisdom'],
    context: 'Proper sequencing of priorities matters',
    journeys: ['founder'],
    situations: ['planning', 'starting_out'],
    applicationNote: 'Wells helps prioritize foundational work before scaling',
  },
  {
    reference: 'Proverbs 6:6-8',
    text: 'Go to the ant, you sluggard; consider its ways and be wise! It has no commander, no overseer or ruler, yet it stores its provisions in summer and gathers its food at harvest.',
    book: 'proverbs',
    themes: ['diligence', 'planning', 'wisdom'],
    context: 'Self-motivated preparation for the future',
    journeys: ['buyer', 'seller', 'founder', 'job_seeker'],
    situations: ['planning', 'persevering'],
    applicationNote: 'Wells works proactively, not waiting to be asked',
  },

  // === SPEECH & COMMUNICATION ===
  {
    reference: 'Proverbs 25:11',
    text: 'A word fitly spoken is like apples of gold in a setting of silver.',
    book: 'proverbs',
    themes: ['speech', 'wisdom'],
    context: 'The right words at the right time are precious',
    journeys: ['buyer', 'seller', 'founder', 'job_seeker'],
    situations: ['negotiating', 'building_relationships'],
    applicationNote: 'Wells chooses words carefully, speaking truth at the right moment',
  },
  {
    reference: 'Proverbs 15:1',
    text: 'A gentle answer turns away wrath, but a harsh word stirs up anger.',
    book: 'proverbs',
    themes: ['speech', 'relationships', 'wisdom'],
    context: 'Tone matters as much as content',
    journeys: ['buyer', 'seller', 'founder', 'job_seeker'],
    situations: ['negotiating', 'facing_challenge'],
    applicationNote: 'Wells maintains calm, constructive communication even in tension',
  },
  {
    reference: 'Proverbs 18:21',
    text: 'The tongue has the power of life and death, and those who love it will eat its fruit.',
    book: 'proverbs',
    themes: ['speech'],
    context: 'Words have profound impact',
    journeys: ['buyer', 'seller', 'founder', 'job_seeker'],
    situations: ['negotiating', 'building_relationships'],
    applicationNote: 'Wells speaks with intentionality, knowing words shape outcomes',
  },
  {
    reference: 'Proverbs 10:19',
    text: 'Sin is not ended by multiplying words, but the prudent hold their tongues.',
    book: 'proverbs',
    themes: ['speech', 'wisdom'],
    context: 'Wisdom often means saying less',
    journeys: ['buyer', 'seller', 'founder', 'job_seeker'],
    situations: ['negotiating'],
    applicationNote: 'Wells is concise and does not over-explain',
  },

  // === WEALTH & BUSINESS ===
  {
    reference: 'Proverbs 22:1',
    text: 'A good name is more desirable than great riches; to be esteemed is better than silver or gold.',
    book: 'proverbs',
    themes: ['wealth', 'integrity', 'business'],
    context: 'Reputation matters more than short-term gain',
    journeys: ['seller', 'founder'],
    situations: ['making_decision', 'negotiating'],
    applicationNote: 'Wells prioritizes long-term reputation over quick wins',
  },
  {
    reference: 'Proverbs 13:11',
    text: 'Dishonest money dwindles away, but whoever gathers money little by little makes it grow.',
    book: 'proverbs',
    themes: ['wealth', 'integrity', 'diligence'],
    context: 'Sustainable growth beats get-rich-quick schemes',
    journeys: ['founder', 'seller'],
    situations: ['planning', 'making_decision'],
    applicationNote: 'Wells recommends sustainable growth strategies',
  },
  {
    reference: 'Proverbs 11:25',
    text: 'A generous person will prosper; whoever refreshes others will be refreshed.',
    book: 'proverbs',
    themes: ['wealth', 'relationships'],
    context: 'Generosity creates mutual flourishing',
    journeys: ['buyer', 'seller', 'founder'],
    situations: ['negotiating', 'building_relationships'],
    applicationNote: 'Wells encourages generosity as a business strategy',
  },

  // === HUMILITY ===
  {
    reference: 'Proverbs 11:2',
    text: 'When pride comes, then comes disgrace, but with humility comes wisdom.',
    book: 'proverbs',
    themes: ['humility', 'wisdom'],
    context: 'Humility opens the door to learning',
    journeys: ['buyer', 'seller', 'founder', 'job_seeker'],
    situations: ['learning', 'facing_challenge'],
    applicationNote: 'Wells admits uncertainty and learns from mistakes',
  },
  {
    reference: 'Proverbs 16:18',
    text: 'Pride goes before destruction, a haughty spirit before a fall.',
    book: 'proverbs',
    themes: ['humility'],
    context: 'Overconfidence precedes failure',
    journeys: ['founder', 'seller'],
    situations: ['making_decision', 'celebrating_win'],
    applicationNote: 'Wells tempers celebration with continued vigilance',
  },
  {
    reference: 'Proverbs 27:2',
    text: 'Let someone else praise you, and not your own mouth; an outsider, and not your own lips.',
    book: 'proverbs',
    themes: ['humility', 'speech'],
    context: 'Let work speak for itself',
    journeys: ['seller', 'job_seeker'],
    situations: ['building_relationships'],
    applicationNote: 'Wells lets results speak, not self-promotion',
  },

  // === FORESIGHT & WISDOM ===
  {
    reference: 'Proverbs 27:12',
    text: 'The prudent see danger and take refuge, but the simple keep going and pay the penalty.',
    book: 'proverbs',
    themes: ['wisdom', 'planning'],
    context: 'Anticipate problems before they arrive',
    journeys: ['buyer', 'seller', 'founder'],
    situations: ['making_decision', 'facing_challenge'],
    applicationNote: 'Wells proactively identifies risks before they materialize',
  },
  {
    reference: 'Proverbs 22:3',
    text: 'The prudent see danger and take refuge, but the simple keep going and pay the penalty.',
    book: 'proverbs',
    themes: ['wisdom', 'planning'],
    context: 'Wisdom means seeing what others miss',
    journeys: ['buyer', 'seller', 'founder'],
    situations: ['making_decision'],
    applicationNote: 'Wells surfaces risks that might otherwise go unnoticed',
  },
  {
    reference: 'Proverbs 3:5-6',
    text: 'Trust in the LORD with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight.',
    book: 'proverbs',
    themes: ['faith', 'wisdom', 'humility'],
    context: 'Ultimate wisdom comes from beyond ourselves',
    journeys: ['buyer', 'seller', 'founder', 'job_seeker'],
    situations: ['making_decision', 'facing_challenge', 'waiting'],
    applicationNote: 'Wells acknowledges the limits of analysis and the role of trust',
  },
]

// ============================================================================
// HEBREWS COLLECTION
// Faith, perseverance, and running the race
// ============================================================================

export const HEBREWS_SCRIPTURES: Scripture[] = [
  // === FAITH ===
  {
    reference: 'Hebrews 11:1',
    text: 'Now faith is confidence in what we hope for and assurance about what we do not see.',
    book: 'hebrews',
    themes: ['faith', 'hope', 'confidence'],
    context: 'Faith is confident action despite uncertainty',
    journeys: ['founder', 'job_seeker'],
    situations: ['starting_out', 'taking_risk', 'waiting'],
    applicationNote: 'Wells helps users take confident action even with incomplete information',
  },
  {
    reference: 'Hebrews 11:6',
    text: 'And without faith it is impossible to please God, because anyone who comes to him must believe that he exists and that he rewards those who earnestly seek him.',
    book: 'hebrews',
    themes: ['faith', 'diligence'],
    context: 'Faith requires both belief and earnest seeking',
    journeys: ['founder', 'job_seeker'],
    situations: ['persevering', 'seeking_wisdom'],
    applicationNote: 'Wells encourages persistent, faithful effort',
  },

  // === BOLDNESS & CONFIDENCE ===
  {
    reference: 'Hebrews 4:16',
    text: 'Let us then approach God\'s throne of grace with confidence, so that we may receive mercy and find grace to help us in our time of need.',
    book: 'hebrews',
    themes: ['boldness', 'confidence', 'hope'],
    context: 'Approach with confidence, especially when in need',
    journeys: ['buyer', 'seller', 'founder', 'job_seeker'],
    situations: ['facing_challenge', 'negotiating', 'taking_risk'],
    applicationNote: 'Wells encourages confident action, not timidity',
  },
  {
    reference: 'Hebrews 10:35-36',
    text: 'So do not throw away your confidence; it will be richly rewarded. You need to persevere so that when you have done the will of God, you will receive what he has promised.',
    book: 'hebrews',
    themes: ['confidence', 'perseverance', 'hope'],
    context: 'Maintain confidence through difficulty; rewards come through perseverance',
    journeys: ['founder', 'job_seeker'],
    situations: ['facing_challenge', 'persevering', 'waiting'],
    applicationNote: 'Wells reinforces confidence when users face setbacks',
  },
  {
    reference: 'Hebrews 13:6',
    text: 'So we say with confidence, "The Lord is my helper; I will not be afraid. What can mere mortals do to me?"',
    book: 'hebrews',
    themes: ['boldness', 'confidence', 'faith'],
    context: 'Confidence displaces fear',
    journeys: ['founder', 'job_seeker'],
    situations: ['taking_risk', 'facing_challenge', 'negotiating'],
    applicationNote: 'Wells helps users overcome fear with grounded confidence',
  },

  // === PERSEVERANCE & ENDURANCE ===
  {
    reference: 'Hebrews 10:36',
    text: 'You need to persevere so that when you have done the will of God, you will receive what he has promised.',
    book: 'hebrews',
    themes: ['perseverance', 'hope'],
    context: 'Perseverance is required to receive promises',
    journeys: ['founder', 'job_seeker'],
    situations: ['persevering', 'waiting', 'facing_challenge'],
    applicationNote: 'Wells reminds users that persistence leads to breakthrough',
  },
  {
    reference: 'Hebrews 12:1',
    text: 'Therefore, since we are surrounded by such a great cloud of witnesses, let us throw off everything that hinders and the sin that so easily entangles. And let us run with perseverance the race marked out for us.',
    book: 'hebrews',
    themes: ['perseverance', 'endurance', 'community'],
    context: 'Run your unique race with persistence, supported by community',
    journeys: ['founder', 'job_seeker'],
    situations: ['persevering', 'starting_out'],
    applicationNote: 'Wells helps users focus on their own race, not comparing to others',
  },
  {
    reference: 'Hebrews 12:2',
    text: 'fixing our eyes on Jesus, the pioneer and perfecter of faith. For the joy set before him he endured the cross, scorning its shame, and sat down at the right hand of the throne of God.',
    book: 'hebrews',
    themes: ['endurance', 'faith', 'hope'],
    context: 'Endure present difficulty for future joy',
    journeys: ['founder', 'job_seeker'],
    situations: ['facing_challenge', 'persevering'],
    applicationNote: 'Wells helps users see beyond current struggles to future possibilities',
  },
  {
    reference: 'Hebrews 12:3',
    text: 'Consider him who endured such opposition from sinners, so that you will not grow weary and lose heart.',
    book: 'hebrews',
    themes: ['endurance', 'encouragement'],
    context: 'Draw strength from examples of endurance',
    journeys: ['founder', 'job_seeker'],
    situations: ['facing_challenge', 'persevering'],
    applicationNote: 'Wells provides encouragement when users feel like giving up',
  },
  {
    reference: 'Hebrews 12:11',
    text: 'No discipline seems pleasant at the time, but painful. Later on, however, it produces a harvest of righteousness and peace for those who have been trained by it.',
    book: 'hebrews',
    themes: ['endurance', 'perseverance', 'hope'],
    context: 'Present difficulty produces future growth',
    journeys: ['founder', 'job_seeker'],
    situations: ['facing_challenge', 'learning', 'growing'],
    applicationNote: 'Wells reframes setbacks as training for future success',
  },

  // === COMMUNITY & ENCOURAGEMENT ===
  {
    reference: 'Hebrews 10:24-25',
    text: 'And let us consider how we may spur one another on toward love and good deeds, not giving up meeting together, as some are in the habit of doing, but encouraging one another—and all the more as you see the Day approaching.',
    book: 'hebrews',
    themes: ['community', 'encouragement'],
    context: 'Mutual encouragement and accountability in community',
    journeys: ['buyer', 'seller', 'founder', 'job_seeker'],
    situations: ['building_relationships', 'persevering'],
    applicationNote: 'Wells facilitates connections that encourage and strengthen',
  },
  {
    reference: 'Hebrews 3:13',
    text: 'But encourage one another daily, as long as it is called "Today," so that none of you may be hardened by sin\'s deceitfulness.',
    book: 'hebrews',
    themes: ['encouragement', 'community'],
    context: 'Daily encouragement prevents discouragement',
    journeys: ['buyer', 'seller', 'founder', 'job_seeker'],
    situations: ['persevering', 'facing_challenge'],
    applicationNote: 'Wells offers regular, consistent encouragement',
  },
  {
    reference: 'Hebrews 13:1',
    text: 'Keep on loving one another as brothers and sisters.',
    book: 'hebrews',
    themes: ['community', 'relationships'],
    context: 'Persistent love in community',
    journeys: ['buyer', 'seller', 'founder'],
    situations: ['building_relationships'],
    applicationNote: 'Wells treats all parties with respect and care',
  },

  // === HOPE & PROMISE ===
  {
    reference: 'Hebrews 6:19',
    text: 'We have this hope as an anchor for the soul, firm and secure.',
    book: 'hebrews',
    themes: ['hope', 'faith', 'confidence'],
    context: 'Hope provides stability in turbulent times',
    journeys: ['founder', 'job_seeker'],
    situations: ['facing_challenge', 'waiting', 'persevering'],
    applicationNote: 'Wells helps users maintain hope during uncertainty',
  },
  {
    reference: 'Hebrews 10:23',
    text: 'Let us hold unswervingly to the hope we profess, for he who promised is faithful.',
    book: 'hebrews',
    themes: ['hope', 'faith', 'perseverance'],
    context: 'Hold onto hope because of faithful promises',
    journeys: ['founder', 'job_seeker'],
    situations: ['waiting', 'persevering'],
    applicationNote: 'Wells encourages steadfast hope grounded in track record',
  },
  {
    reference: 'Hebrews 11:8',
    text: 'By faith Abraham, when called to go to a place he would later receive as his inheritance, obeyed and went, even though he did not know where he was going.',
    book: 'hebrews',
    themes: ['faith', 'boldness'],
    context: 'Faith sometimes means moving forward without full clarity',
    journeys: ['founder', 'job_seeker'],
    situations: ['starting_out', 'taking_risk'],
    applicationNote: 'Wells helps users take faith-filled action despite uncertainty',
  },

  // === REST & TRUST ===
  {
    reference: 'Hebrews 4:9-10',
    text: 'There remains, then, a Sabbath-rest for the people of God; for anyone who enters God\'s rest also rests from their works, just as God did from his.',
    book: 'hebrews',
    themes: ['faith', 'hope'],
    context: 'There is rest available beyond constant striving',
    journeys: ['founder'],
    situations: ['facing_challenge', 'waiting'],
    applicationNote: 'Wells reminds users that rest is part of sustainable success',
  },
  {
    reference: 'Hebrews 13:5',
    text: 'Keep your lives free from the love of money and be content with what you have, because God has said, "Never will I leave you; never will I forsake you."',
    book: 'hebrews',
    themes: ['faith', 'hope', 'confidence'],
    context: 'Contentment comes from security in relationship, not possessions',
    journeys: ['founder', 'job_seeker'],
    situations: ['waiting', 'facing_challenge'],
    applicationNote: 'Wells helps users find contentment while pursuing growth',
  },
]

// ============================================================================
// ALL SCRIPTURES
// ============================================================================

export const ALL_SCRIPTURES: Scripture[] = [
  ...PROVERBS_SCRIPTURES,
  ...HEBREWS_SCRIPTURES,
]

// ============================================================================
// SCRIPTURE SELECTION
// ============================================================================

/**
 * Get contextually appropriate scriptures based on user situation
 */
export function getScripturesForContext(options: {
  journey?: UserJourney
  situation?: UserSituation
  theme?: ScriptureTheme
  book?: ScriptureBook
  limit?: number
}): Scripture[] {
  const { journey, situation, theme, book, limit = 3 } = options

  let filtered = ALL_SCRIPTURES

  if (book) {
    filtered = filtered.filter((s) => s.book === book)
  }

  if (journey) {
    filtered = filtered.filter((s) => s.journeys.includes(journey))
  }

  if (situation) {
    filtered = filtered.filter((s) => s.situations.includes(situation))
  }

  if (theme) {
    filtered = filtered.filter((s) => s.themes.includes(theme))
  }

  // Shuffle and limit
  const shuffled = filtered.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, limit)
}

/**
 * Select the most appropriate scripture for a specific context
 */
export function selectScripture(options: {
  journey: UserJourney
  situation: UserSituation
  preferredThemes?: ScriptureTheme[]
}): ScriptureSelection | null {
  const { journey, situation, preferredThemes } = options

  // First, try to match on journey AND situation
  let candidates = ALL_SCRIPTURES.filter(
    (s) => s.journeys.includes(journey) && s.situations.includes(situation)
  )

  // If we have preferred themes, prioritize those
  if (preferredThemes && preferredThemes.length > 0) {
    const withTheme = candidates.filter((s) =>
      s.themes.some((t) => preferredThemes.includes(t))
    )
    if (withTheme.length > 0) {
      candidates = withTheme
    }
  }

  if (candidates.length === 0) {
    // Fall back to just situation matching
    candidates = ALL_SCRIPTURES.filter((s) => s.situations.includes(situation))
  }

  if (candidates.length === 0) {
    return null
  }

  // Select randomly from candidates
  const selected = candidates[Math.floor(Math.random() * candidates.length)]

  return {
    scripture: selected,
    reason: `Selected for ${journey} in ${situation.replace('_', ' ')} situation`,
  }
}

/**
 * Get a scripture for celebration moments
 */
export function getCelebrationScripture(journey: UserJourney): ScriptureSelection | null {
  return selectScripture({
    journey,
    situation: 'celebrating_win',
    preferredThemes: ['encouragement', 'hope', 'community'],
  })
}

/**
 * Get a scripture for challenging moments
 */
export function getChallengeScripture(journey: UserJourney): ScriptureSelection | null {
  return selectScripture({
    journey,
    situation: 'facing_challenge',
    preferredThemes: ['perseverance', 'endurance', 'faith', 'hope'],
  })
}

/**
 * Get a scripture for decision-making moments
 */
export function getDecisionScripture(journey: UserJourney): ScriptureSelection | null {
  return selectScripture({
    journey,
    situation: 'making_decision',
    preferredThemes: ['wisdom', 'counsel', 'integrity'],
  })
}

/**
 * Get a scripture for negotiation contexts
 */
export function getNegotiationScripture(): ScriptureSelection | null {
  const negotiationScriptures = ALL_SCRIPTURES.filter(
    (s) =>
      s.situations.includes('negotiating') &&
      s.themes.some((t) => ['integrity', 'business', 'speech'].includes(t))
  )

  if (negotiationScriptures.length === 0) return null

  const selected =
    negotiationScriptures[Math.floor(Math.random() * negotiationScriptures.length)]

  return {
    scripture: selected,
    reason: 'Selected for fair dealing in negotiation',
  }
}

/**
 * Get a scripture for perseverance (especially for job seekers)
 */
export function getPerseveranceScripture(journey: UserJourney): ScriptureSelection | null {
  return selectScripture({
    journey,
    situation: 'persevering',
    preferredThemes: ['perseverance', 'endurance', 'hope', 'faith'],
  })
}

/**
 * Get the application note for a scripture (how Wells applies it, not quotes it)
 */
export function getApplicationNote(scripture: Scripture): string {
  return scripture.applicationNote
}

// ============================================================================
// THEME COLLECTIONS
// ============================================================================

/**
 * Get all scriptures for a specific theme
 */
export function getScripturesByTheme(theme: ScriptureTheme): Scripture[] {
  return ALL_SCRIPTURES.filter((s) => s.themes.includes(theme))
}

/**
 * Get scripture themes relevant to a user journey
 */
export function getRelevantThemes(journey: UserJourney): ScriptureTheme[] {
  const journeyThemes: Record<UserJourney, ScriptureTheme[]> = {
    buyer: ['integrity', 'business', 'counsel', 'wisdom', 'relationships'],
    seller: ['integrity', 'business', 'diligence', 'speech', 'relationships'],
    founder: [
      'faith',
      'perseverance',
      'wisdom',
      'planning',
      'boldness',
      'endurance',
    ],
    job_seeker: [
      'perseverance',
      'faith',
      'hope',
      'confidence',
      'endurance',
      'boldness',
    ],
  }

  return journeyThemes[journey] || ['wisdom', 'integrity']
}

// ============================================================================
// EXPORTS
// ============================================================================

export const Scriptures = {
  all: ALL_SCRIPTURES,
  proverbs: PROVERBS_SCRIPTURES,
  hebrews: HEBREWS_SCRIPTURES,
  getForContext: getScripturesForContext,
  select: selectScripture,
  getForCelebration: getCelebrationScripture,
  getForChallenge: getChallengeScripture,
  getForDecision: getDecisionScripture,
  getForNegotiation: getNegotiationScripture,
  getForPerseverance: getPerseveranceScripture,
  getApplication: getApplicationNote,
  getByTheme: getScripturesByTheme,
  getRelevantThemes,
}

export default Scriptures
