/**
 * ROME — city copy (E5). Fields and limits: ../cities.ts.
 */
import type { CityCopy } from '../cities';

export const rome: CityCopy = {
  name: 'Rome',
  tagline: "Rome wasn't cleared in a day. Daje!",
  capitol: 'Palazzo Montecitorio',
  victoryDecks: [
    'Ministry hails "proportionate response". The Senate notes it only took 2,000 years.',
    'Order restored at the Pantheon. Officers toss coins in the Trevi, to be posted here again.',
    'Calm returns. Vespas resume their usual, perfectly legal, chaos. Traffic police elated.',
    'Minister celebrates with a carbonara. Adds cream. Rome demands his resignation.',
  ],
  defeatDecks: [
    'Protesters dance on Montecitorio. Minister last seen on a "routine" Vespa to Ostia.',
    'Regime falls. Archaeologists dig up the barricades at once. Filed as "Late Empire".',
    'Rome falls. Again. Locals unimpressed: "We have a whole Forum of this."',
  ],
  welcome: 'Benvenuti a Roma. Seven hills, three thousand years of riots. Ours is the newest.',
  flavour: [
    'A pause. In Rome we call it lunch. It lasts until the next empire.',
    'The protesters are late. In Rome that is not a tactic, it is a lifestyle.',
    'A cat sits on our barricade. Roman cats are protected. Our barricade is not.',
    'Someone dug a trench and found a temple. Works halted. The riot, sadly, was not.',
  ],
  masthead: {
    title: "L'Ordinanza",
    dateline: 'ROMA · STRAORDINARIA · 2 €',
    motto: '»Roma non si sgombera in un giorno«',
  },
  slogans: ['NO!', 'DAJE', 'AO!', 'BOH', 'MA DAI', 'UFFA', 'BASTA'],
};
